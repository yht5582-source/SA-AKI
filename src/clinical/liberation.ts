import type { ClinicalSnapshot, DecisionResult } from './types';
import { evaluateKrtInitiation } from './krt';
import { resolveRuleSources } from './sources';
import { clinicalSnapshotSchema } from '../data/schema';

const finite = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);
const respiratoryRank = { 'room-air': 0, 'conventional-oxygen': 1, 'high-flow-nasal-oxygen': 2, 'noninvasive-ventilation': 3, 'invasive-ventilation': 4 };

/** A missing stop is not evidence of a new active episode after a recorded stop. */
function treatmentState(s: ClinicalSnapshot, history: ClinicalSnapshot[], validHistory: boolean): { off: boolean; uncertainty?: string } {
  const uncertain = (detail: string) => ({ off: false, uncertainty: `treatment-state uncertainty: ${detail}` });
  if (!validHistory) return uncertain('nonunique, foreign, future or conflicting snapshot chronology');
  const now = Date.parse(s.timestamp);
  const start = s.crrtStartedTimestamp === undefined ? undefined : Date.parse(s.crrtStartedTimestamp);
  const stop = s.crrtStoppedTimestamp === undefined ? undefined : Date.parse(s.crrtStoppedTimestamp);
  if (!finite(start) || start > now) return uncertain('current CRRT start is missing or invalid; reconcile the recorded episode');
  const episodeStops = new Map<number, number>();
  for (const point of [...history, s]) {
    const time = Date.parse(point.timestamp);
    const pointStart = point.crrtStartedTimestamp === undefined ? undefined : Date.parse(point.crrtStartedTimestamp);
    const pointStop = point.crrtStoppedTimestamp === undefined ? undefined : Date.parse(point.crrtStoppedTimestamp);
    if ((pointStart !== undefined && (!finite(pointStart) || pointStart > time))
      || (pointStop !== undefined && (!finite(pointStop) || !finite(pointStart) || pointStop <= pointStart || pointStop > time))) {
      return uncertain('CRRT events must have a valid start before stop and occur no later than their documenting snapshot');
    }
    if (pointStart !== undefined && pointStop !== undefined) {
      const recordedStop = episodeStops.get(pointStart);
      if (recordedStop !== undefined && recordedStop !== pointStop) {
        return uncertain('conflicting stop times for the same CRRT episode; reconcile original records before establishing treatment state');
      }
      episodeStops.set(pointStart, pointStop);
    }
  }
  const historicalStarts = history.flatMap(point => point.crrtStartedTimestamp === undefined ? [] : [Date.parse(point.crrtStartedTimestamp)]);
  const historicalStops = history.flatMap(point => point.crrtStoppedTimestamp === undefined ? [] : [Date.parse(point.crrtStoppedTimestamp)]);
  const lastStart = Math.max(-Infinity, ...historicalStarts);
  const lastStop = Math.max(-Infinity, ...historicalStops);
  if (start < lastStart) return uncertain('current start predates a later documented episode');
  if (stop === undefined && lastStop >= start) return uncertain('historical stop persists; a strictly later documented start is required to establish another active episode');
  if (stop !== undefined && (stop < lastStop || (lastStop >= start && stop !== lastStop))) return uncertain('current stop conflicts with the historical episode; reconcile stop/restart records');
  return { off: stop !== undefined };
}

/** Fail-closed review only; no executable cessation, continuation or restart order. */
export function evaluateLiberation(s: ClinicalSnapshot, trend: ClinicalSnapshot[]): DecisionResult[] {
  // Reuse the strict persistence contract at this direct-call boundary: no coercion or truthiness.
  // Validate before any downstream engine can access malformed arrays/enums/nested objects.
  const invalidData = [s, ...trend].flatMap((point, index) => {
    const parsed = clinicalSnapshotSchema.safeParse(point);
    return parsed.success ? [] : parsed.error.issues.map(issue => `invalid ${index === 0 ? 'current' : `history[${index - 1}]`}.${issue.path.join('.')}: ${issue.message}`);
  });
  if (invalidData.length > 0) {
    const result: DecisionResult = {
      id: 'crrt-liberation-review', severity: 'warning',
      conclusion: 'continue and reassess：invalid runtime clinical data；clinician review only；非機器處方',
      evidence: ['Local convention：malformed booleans, enums, numeric domains or treatment records cannot establish liberation readiness.'],
      missingData: invalidData,
      actions: ['立即床邊 review 並更正無效資料；不能排除持續或復發的緊急 KRT 適應症，不等待排程重評；不形成設備指令。'],
      reassessWithinHours: 0,
      counterfactuals: ['只有有效紀錄和 literal true 的必要臨床評估，才可進一步評估 supervised trial-off。'],
      sourceIds: ['KDIGO_2012', 'APP_LIBERATION_V1'],
    };
    resolveRuleSources(result.id, result.sourceIds);
    return [result];
  }
  const a = s.liberationAssessment;
  const missingData: string[] = [];
  const blockers: string[] = [];
  const evidence = ['Local convention：保守 review gates 與觀察時限未經臨床驗證，不是停機門檻。'];
  const now = Date.parse(s.timestamp);
  // Allow the exact current snapshot once in a complete series, never a conflicting duplicate.
  const currentEntries = trend.filter(x => x.id === s.id || Date.parse(x.timestamp) === now);
  const sameCurrent = currentEntries.length === 1 && JSON.stringify(currentEntries[0]) === JSON.stringify(s);
  const history = trend.filter(x => !(sameCurrent && x === currentEntries[0]));
  const seenTimes = new Set<number>(); const seenIds = new Set<string>();
  const validHistory = finite(now) && currentEntries.length <= 1 && (currentEntries.length === 0 || sameCurrent)
    && history.every(x => {
      const time = Date.parse(x.timestamp);
      if (!finite(time) || time >= now || x.caseId !== s.caseId || seenTimes.has(time) || seenIds.has(x.id)) return false;
      seenTimes.add(time); seenIds.add(x.id); return true;
    });
  const prior = validHistory ? [...history].sort((x, y) => Date.parse(y.timestamp) - Date.parse(x.timestamp))[0] : undefined;
  const elapsed = prior ? (now - Date.parse(prior.timestamp)) / 3_600_000 : undefined;
  if (!validHistory || !prior || !finite(elapsed) || elapsed < 6 || elapsed > 24) missingData.push('同一病例、唯一且有效時間點；最近 6–24 h 的連續觀察（local convention）');
  if (finite(elapsed) && finite(s.urineObservationHours) && s.urineObservationHours > elapsed) blockers.push('overlapping urine collection windows cannot establish sustained independent observation');

  for (const [value, label] of [
    [a?.originalIndicationResolved, 'original indication resolved'],
    [a?.nativeSoluteControlAdequate, 'native solute control adequate'],
    [a?.nativeFluidBalanceAdequate, 'native fluid balance adequate including nutrition/drug input needs'],
    [a?.observationAdequate, 'adequate observation'], [a?.downtimeReviewed, 'downtime reviewed'],
  ] as const) {
    evidence.push(`clinician assessment：${label} = ${value ?? 'unknown'}`);
    if (typeof value !== 'boolean') missingData.push(`${label}: missing/invalid boolean`);
    if (value !== true) blockers.push(label);
  }
  const krt = evaluateKrtInitiation(s)[0];
  const confirmed = krt.severity === 'critical';
  missingData.push(...krt.missingData);
  if (confirmed) blockers.push('persistent definitive KRT indication：' + krt.conclusion);
  if (krt.severity === 'warning') blockers.push('危險／未確認的電解質、酸鹼或肺水腫評估');
  evidence.push(...krt.evidence);

  for (const point of prior ? [prior, s] : [s]) {
    const label = point.id;
    for (const key of ['creatinineMgDl', 'bunMgDl', 'mapMmHg', 'lactateMmolL', 'norepinephrineEquivalentMcgKgMin', 'potassiumMmolL', 'arterialPh', 'bicarbonateMmolL', 'urineVolumeMl', 'urineObservationHours', 'fluidIntervalHours', 'intervalFluidInputMl', 'intervalFluidOutputMl', 'intervalNetFluidBalanceMl', 'cumulativeFluidBalanceMl', 'crrtDowntimeHours', 'crrtObservationHours'] as const) {
      if (!finite(point[key])) missingData.push(`${label}: ${key}`);
    }
    for (const key of ['creatinineMgDl', 'bunMgDl', 'norepinephrineEquivalentMcgKgMin', 'lactateMmolL', 'mapMmHg'] as const) {
      if (finite(point[key]) && point[key]! < 0) blockers.push(`${label}: invalid negative ${key}`);
    }
    if (finite(point.arterialPh) && (point.arterialPh < 6.5 || point.arterialPh > 8)) blockers.push(`${label}: invalid arterial pH`);
    if (point.diureticExposure === undefined) missingData.push(`${label}: diuretic exposure`);
    if (point.vasopressorTrend === undefined) missingData.push(`${label}: vasopressor trajectory`);
    if (point.hemodynamicTolerance === undefined) missingData.push(`${label}: hemodynamic tolerance`);
    if (point.pulmonaryEdema === undefined || point.lungBLines === undefined || point.vexusGrade === undefined) missingData.push(`${label}: congestion examination`);
    if (!point.respiratorySupport || (point.respiratorySupport !== 'room-air' && !finite(point.pao2Fio2RatioMmHg))) missingData.push(`${label}: oxygenation/support`);
    if ((finite(point.mapMmHg) && point.mapMmHg < 65) || (finite(point.lactateMmolL) && point.lactateMmolL > 2)
      || point.vasopressorTrend === 'worsening' || (point.hemodynamicTolerance !== undefined && point.hemodynamicTolerance !== 'stable')
      || point.skinMottling === true || point.peripheralTemperature === 'cool' || (finite(point.capillaryRefillSeconds) && point.capillaryRefillSeconds > 3)) blockers.push(`${label}: hemodynamic/perfusion instability`);
    if (point.pulmonaryEdema || point.lungBLines === 'bilateral-diffuse' || (point.vexusGrade ?? 0) >= 2
      || (finite(point.pao2Fio2RatioMmHg) && point.pao2Fio2RatioMmHg <= 200)) blockers.push(`${label}: congestion/oxygenation concern`);
    if ((finite(point.potassiumMmolL) && (point.potassiumMmolL >= 6 || point.potassiumMmolL < 0))
      || (finite(point.arterialPh) && point.arterialPh <= 7.2) || (finite(point.bicarbonateMmolL) && point.bicarbonateMmolL <= 12)) blockers.push(`${label}: metabolic control concern`);
    if (finite(point.urineVolumeMl)) evidence.push(`${label}: measured urine ${point.urineVolumeMl} mL / ${point.urineObservationHours ?? 'unknown'} h${point.urineVolumeMl === 0 ? '；observed anuria 無尿' : ''}；diuretic ${point.diureticExposure ?? 'unknown'}`);
    if ((point.urineVolumeMl ?? -1) <= 0 || (point.urineObservationHours ?? 0) < 6) blockers.push(`${label}: insufficient sustained urine observation`);
    if (point.diureticExposure === true || (point.diureticExposures?.length ?? 0) > 0) {
      if (a?.diureticEffectReviewed !== true) missingData.push('diuretic-associated urine interpretation');
      evidence.push('diuretics 可改變尿量，不能證明原生清除能力恢復。');
    }
    if ((point.crrtDowntimeHours ?? -1) < 0 || (point.crrtObservationHours ?? 0) <= 0
      || (point.crrtDowntimeHours ?? 0) > (point.crrtObservationHours ?? 0)) blockers.push(`${label}: invalid downtime interval`);
    if ((point.fluidIntervalHours ?? 0) <= 0 || (point.intervalFluidInputMl ?? -1) < 0 || (point.intervalFluidOutputMl ?? -1) < 0) blockers.push(`${label}: invalid fluid interval`);
    if (finite(point.intervalFluidInputMl) && finite(point.intervalFluidOutputMl) && finite(point.intervalNetFluidBalanceMl)
      && Math.abs(point.intervalFluidInputMl - point.intervalFluidOutputMl - point.intervalNetFluidBalanceMl) > 1) blockers.push(`${label}: conflicting recorded fluid balance`);
    evidence.push(`${label}: measured SCr ${point.creatinineMgDl ?? 'unknown'}, BUN ${point.bunMgDl ?? 'unknown'}；fluid input/output ${point.intervalFluidInputMl ?? 'unknown'}/${point.intervalFluidOutputMl ?? 'unknown'} mL；cumulative ${point.cumulativeFluidBalanceMl ?? 'unknown'} mL；downtime ${point.crrtDowntimeHours ?? 'unknown'}/${point.crrtObservationHours ?? 'unknown'} h`);
  }
  if (prior) {
    for (const key of ['creatinineMgDl', 'bunMgDl', 'norepinephrineEquivalentMcgKgMin', 'lactateMmolL', 'cumulativeFluidBalanceMl'] as const) {
      if (finite(s[key]) && finite(prior[key]) && s[key]! > prior[key]!) blockers.push(`measured ${key} increasing`);
    }
    if (finite(s.urineVolumeMl) && finite(prior.urineVolumeMl) && finite(s.urineObservationHours) && finite(prior.urineObservationHours)
      && s.urineVolumeMl / s.urineObservationHours < prior.urineVolumeMl / prior.urineObservationHours) blockers.push('measured urine rate declining');
    if (s.respiratorySupport && prior.respiratorySupport && respiratoryRank[s.respiratorySupport] > respiratoryRank[prior.respiratorySupport]) blockers.push('respiratory support escalation');
    if (finite(s.pao2Fio2RatioMmHg) && finite(prior.pao2Fio2RatioMmHg) && s.pao2Fio2RatioMmHg < prior.pao2Fio2RatioMmHg) blockers.push('oxygenation worsening');
  }
  if (a?.timedCreatinineClearanceMlMin !== undefined) {
    evidence.push(`short timed creatinine clearance ${a.timedCreatinineClearanceMlMin} mL/min / ${a.clearanceCollectionHours ?? 'unknown'} h：單一清除率不是停機授權，須核對收集完整性與 RRT clearance。`);
    if (!finite(a.clearanceCollectionHours) || a.clearanceCollectionHours <= 0) missingData.push('clearance collection duration/validity');
    if (!finite(a.timedCreatinineClearanceMlMin) || a.timedCreatinineClearanceMlMin < 0) blockers.push('invalid timed creatinine clearance');
  }
  const plan = a?.monitoringPlan;
  for (const key of ['urineOutput', 'fluidBalance', 'electrolytesAcidBase', 'respiratoryHemodynamic', 'restartTriggersReviewed'] as const) if (plan?.[key] !== true) missingData.push(`monitoring plan: ${key}`);
  if (!finite(plan?.reviewWithinHours) || plan.reviewWithinHours <= 0 || plan.reviewWithinHours > 4) missingData.push('monitoring reviewWithinHours >0 and <=4 (local ceiling)');
  const state = treatmentState(s, history, validHistory);
  if (state.uncertainty) missingData.push(state.uncertainty);
  const off = state.off;
  const restart = off && confirmed;
  const ready = !off && !confirmed && missingData.length === 0 && blockers.length === 0;
  const reassessWithinHours = confirmed ? 0 : ready || (off && blockers.length === 0 && missingData.length === 0) ? plan!.reviewWithinHours! : 0.25;
  const result: DecisionResult = {
    id: 'crrt-liberation-review', severity: confirmed ? 'critical' : ready ? 'monitor' : 'warning',
    conclusion: `${restart ? 'restart trigger met' : ready ? 'consider supervised trial-off' : 'continue and reassess'}：clinician review only；非機器處方`,
    evidence: [...evidence, ...blockers], missingData: [...new Set(missingData)],
    actions: [
      confirmed ? '立即由重症與腎臟科複核持續／復發適應症與緊急治療；restart review 不構成設備指令。'
        : off ? '目前已記錄 trial-off：維持密切 observation 與重新評估，不代表恢復或下達 CRRT 延續／重啟指令。'
          : ready ? '由重症與腎臟科共同考慮 supervised trial-off；開始時間與任何設備改變由臨床團隊另行決定。' : '補齊評估並 review 原適應症、原生清除、休克、容量與輸入需求；不能以單一尿量或 SCr 判定可脫離。',
      `Observation：連續監測灌流／呼吸，逐時尿量與液體平衡；複查電解質、血氣、SCr/BUN 趨勢；${reassessWithinHours === 0 ? '立即 review，不等待排程' : `至遲 ${reassessWithinHours} h review`}，惡化立即處理。`,
      'Restart triggers for immediate review：難治高血鉀／生命威脅電解質異常、嚴重酸血症、難治肺水腫／低氧、尿毒併發症；尿量下降、溶質反彈、累積正平衡或增加的輸入需求需提前評估，不單獨下達重啟命令。',
      '解讀 confounders：RRT clearance、dilution、diuretics、residual function、source control 與 downtime；低溶質可能來自治療，非原生功能證明。',
    ],
    reassessWithinHours,
    counterfactuals: ['若適應症未解決、休克／氧合惡化、native sufficiency 或監測未確認，不能進入正向 trial-off consideration；確認復發時立即 restart review。'],
    sourceIds: ['KDIGO_2012', 'APP_LIBERATION_V1'],
  };
  resolveRuleSources(result.id, result.sourceIds);
  return [result];
}
