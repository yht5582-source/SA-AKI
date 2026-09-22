import { caseExportSchema } from '../data/schema';
import { resolveRuleSources } from './sources';
import type { ClinicalSnapshot, DecisionResult, PatientCase } from './types';

type Stage = 0 | 1 | 2 | 3;
type Confidence = 'high' | 'moderate' | 'low';

export interface KdigoInput {
  currentCreatinineMgDl?: number;
  baselineCreatinineMgDl?: number;
  baselineSource?: PatientCase['baselineCreatinineSource'];
  /** Age of baseline at the current measurement; an older comparison cannot prove an acute rise. */
  baselineAgeHours?: number;
  baselineConfidence?: Confidence;
  priorCreatinineMeasurements?: { creatinineMgDl: number; hoursAgo: number }[];
  urineVolumeMl?: number;
  /** A contiguous observation interval; averages do not prove hourly persistence. */
  urineObservationHours?: number;
  urineWeightKg?: number;
  /** Acute RRT in this episode, not maintenance dialysis or a proposed prescription. */
  renalReplacementTherapy?: boolean;
}

export interface KdigoResult {
  stage: Stage;
  creatinineStage: Stage | null;
  urineStage: Stage | null;
  confidence: Confidence;
  provisional: boolean;
  status: 'criteria-met' | 'provisional' | 'insufficient-data' | 'no-criteria-demonstrated';
  missingData: string[];
  evidence: string[];
}

const maxStage = (...stages: (Stage | null)[]): Stage => Math.max(...stages.map(stage => stage ?? 0)) as Stage;
const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0;
const within = (age: number | undefined, hours: number) => positive(age) && age! <= hours;
// Decimal SCr division can land a few representation units below an exact fold cutoff.
// This threshold-scale tolerance is not clinical rounding or a measurement-error margin.
const reachesFold = (ratio: number, threshold: number) => ratio >= threshold - Number.EPSILON * 8 * threshold;
const foldStage = (ratio: number): Stage => reachesFold(ratio, 3) ? 3 : reachesFold(ratio, 2) ? 2 : reachesFold(ratio, 1.5) ? 1 : 0;
// Only compensate for floating-point representation (e.g. 2.3 − 2), not clinical rounding.
const risesByPointThree = (current: number, prior: number) => current - prior >= 0.3 - Number.EPSILON * 8 * Math.max(1, current, prior);

/** Stage 0 means no criterion demonstrated, never inferred normal kidney function. */
export function calculateKdigoStage(input: KdigoInput): KdigoResult {
  resolveRuleSources('aki-definition-staging', ['KDIGO_2012']);
  const { currentCreatinineMgDl: current, baselineCreatinineMgDl: baseline, urineVolumeMl: volume, urineObservationHours: hours, urineWeightKg: weight } = input;
  for (const [name, value] of Object.entries({ current, volume })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(`Invalid ${name}`);
  }
  for (const [name, value] of Object.entries({ baseline, hours, weight })) {
    if (value !== undefined && !positive(value)) throw new Error(`Invalid ${name}`);
  }
  if (input.baselineAgeHours !== undefined && !Number.isFinite(input.baselineAgeHours)) throw new Error('Invalid baseline age');
  for (const prior of input.priorCreatinineMeasurements ?? []) {
    if (!Number.isFinite(prior.creatinineMgDl) || prior.creatinineMgDl < 0 || !Number.isFinite(prior.hoursAgo)) throw new Error('Invalid prior creatinine measurement');
  }
  const missingData: string[] = [];
  const evidence: string[] = [];
  let urineStage: Stage | null = null;
  if (volume === 0 && hours !== undefined && hours >= 12) {
    urineStage = 3;
    evidence.push(`Anuria：0 mL / ${hours} h`);
  } else if (volume !== undefined && hours !== undefined && hours >= 6 && weight !== undefined) {
    const rate = volume / weight / hours;
    urineStage = rate < 0.3 && hours >= 24 ? 3 : rate < 0.5 && hours >= 12 ? 2 : rate < 0.5 ? 1 : 0;
    evidence.push(`尿量 ${volume} mL / ${hours} h / ${weight} kg = ${rate.toFixed(3)} mL/kg/h（連續觀察區間平均；需確認持續性）`);
  }
  if (urineStage === null) missingData.push('尿量、足夠連續觀察時數與正規化體重');

  let creatinineStage: Stage | null = null;
  let reliableCreatinineStage: Stage | null = null;
  let lowBaselineConfidence = false;
  if (current !== undefined) {
    if (baseline !== undefined && (input.baselineAgeHours === undefined || input.baselineAgeHours > 0)) {
      const timed = within(input.baselineAgeHours, 168);
      const measured = input.baselineSource === 'measured-inpatient' || input.baselineSource === 'measured-outpatient';
      const reliable = measured && timed && input.baselineConfidence !== 'low';
      lowBaselineConfidence = !reliable;
      // Unknown/stale timing can suggest a fold-based stage, but never a confirmed acute delta.
      const candidate = maxStage(foldStage(current / baseline), within(input.baselineAgeHours, 48) && risesByPointThree(current, baseline) ? 1 : 0);
      creatinineStage = candidate;
      if (reliable) reliableCreatinineStage = candidate;
      if (!timed) missingData.push('SCr 升幅是否發生於過去 7 天內（基準時間缺失或過舊）');
      if (!measured || input.baselineConfidence === 'low') missingData.push('可靠實測基準 SCr（估計／回推或低可信度不可視為實測）');
      evidence.push(`SCr ${current} mg/dL；基準 ${baseline} mg/dL；來源 ${input.baselineSource ?? '未記錄'}；相距 ${input.baselineAgeHours ?? '未知'} h`);
    }
    for (const prior of input.priorCreatinineMeasurements ?? []) {
      if (!within(prior.hoursAgo, 168)) continue;
      const stage = maxStage(prior.creatinineMgDl > 0 ? foldStage(current / prior.creatinineMgDl) : 0, within(prior.hoursAgo, 48) && risesByPointThree(current, prior.creatinineMgDl) ? 1 : 0);
      reliableCreatinineStage = maxStage(reliableCreatinineStage, stage);
      creatinineStage = maxStage(creatinineStage, stage);
      evidence.push(`連續實測 SCr ${prior.creatinineMgDl} → ${current} mg/dL / ${prior.hoursAgo} h`);
    }
    // The absolute threshold applies only after AKI definition is satisfied.
    if (current >= 4 && maxStage(creatinineStage, urineStage) > 0) {
      creatinineStage = 3;
      if (maxStage(reliableCreatinineStage, urineStage) > 0) reliableCreatinineStage = 3;
    }
  }
  if (creatinineStage === null) missingData.push('目前 SCr 與可比較的定時 SCr／可靠基準');
  const stage = maxStage(creatinineStage, urineStage, input.renalReplacementTherapy ? 3 : 0);
  const reliableStage = maxStage(reliableCreatinineStage, urineStage, input.renalReplacementTherapy ? 3 : 0);
  const provisional = stage > reliableStage;
  const incomplete = creatinineStage === null || urineStage === null;
  const status = provisional ? 'provisional' : stage > 0 ? 'criteria-met' : incomplete || lowBaselineConfidence ? 'insufficient-data' : 'no-criteria-demonstrated';
  const confidence: Confidence = lowBaselineConfidence || status === 'insufficient-data' ? 'low' : incomplete || input.baselineConfidence === 'moderate' ? 'moderate' : 'high';
  if (input.renalReplacementTherapy) evidence.push('此急性病程已開始 RRT：KDIGO stage 3；需排除維持性透析');
  return { stage, creatinineStage, urineStage, confidence, provisional, status, missingData, evidence };
}

const elapsed = (later: string, earlier: string) => (Date.parse(later) - Date.parse(earlier)) / 3_600_000;

type AcuteRrtEpisode = {
  historicalStage3: boolean;
  currentRrt: boolean;
  uncertain: boolean;
  evidence: string[];
  missingData: string[];
};

/**
 * Reconciles immutable CRRT observations known at an observation time. An event must be
 * no later than the snapshot that documents it; passing wall-clock time cannot turn a
 * planned field into performed treatment. A same-snapshot start/stop pair is the only
 * reliable episode boundary in this sparse model. Unlinked or conflicting records remain
 * visible uncertainty rather than being arbitrarily paired or treated as recovery.
 */
function reconcileAcuteRrtEpisode(snapshots: ClinicalSnapshot[], observationTimestamp: string): AcuteRrtEpisode {
  const observationTime = Date.parse(observationTimestamp);
  const starts = new Set<number>(), stops = new Set<number>();
  const pairedStopsByStart = new Map<number, Set<number>>();
  const unverifiedStarts = new Set<number>(), unverifiedStops = new Set<number>();
  for (const snapshot of snapshots) {
    const documentedAt = Date.parse(snapshot.timestamp);
    if (documentedAt > observationTime) continue;
    const start = snapshot.crrtStartedTimestamp === undefined ? NaN : Date.parse(snapshot.crrtStartedTimestamp);
    const stop = snapshot.crrtStoppedTimestamp === undefined ? NaN : Date.parse(snapshot.crrtStoppedTimestamp);
    const validStart = Number.isFinite(start) && start <= documentedAt;
    const validStop = Number.isFinite(stop) && stop <= documentedAt;
    if (Number.isFinite(start)) {
      if (validStart) { starts.add(start); unverifiedStarts.delete(start); }
      else unverifiedStarts.add(start);
    }
    if (Number.isFinite(stop)) {
      if (validStop) { stops.add(stop); unverifiedStops.delete(stop); }
      else unverifiedStops.add(stop);
    }
    if (validStart && validStop) {
      const pair = pairedStopsByStart.get(start) ?? new Set<number>();
      pair.add(stop);
      pairedStopsByStart.set(start, pair);
    }
  }
  const linkedStarts = new Set<number>(), linkedStops = new Set<number>();
  let uncertain = false;
  const confirmedPairs: { start: number; stop: number }[] = [];
  for (const [start, stopsForStart] of pairedStopsByStart) {
    linkedStarts.add(start);
    for (const stop of stopsForStart) {
      linkedStops.add(stop);
      if (stop <= start) uncertain = true;
      else confirmedPairs.push({ start, stop });
    }
    if (stopsForStart.size > 1) uncertain = true;
  }
  confirmedPairs.sort((a, b) => a.start - b.start || a.stop - b.stop);
  for (let index = 1; index < confirmedPairs.length; index++) {
    if (confirmedPairs[index].start <= confirmedPairs[index - 1].stop) uncertain = true;
  }
  const unlinkedStarts = [...starts].filter(start => !linkedStarts.has(start));
  const unlinkedStops = [...stops].filter(stop => !linkedStops.has(stop));
  const latestConfirmedStop = confirmedPairs.at(-1)?.stop;
  const unlinkedStartConflictsWithCompletedEpisode = unlinkedStarts.some(start =>
    confirmedPairs.some(pair => start >= pair.start && start <= pair.stop)
    || (latestConfirmedStop !== undefined && start <= latestConfirmedStop),
  );
  if (unlinkedStops.length > 0 || unlinkedStarts.length > 1 || unlinkedStartConflictsWithCompletedEpisode) uncertain = true;
  const currentRrt = !uncertain && unlinkedStarts.length === 1 && unlinkedStops.length === 0;
  const historicalStage3 = starts.size > 0;
  const evidence: string[] = [];
  if (historicalStage3) evidence.push('本次急性病程歷史最高 KDIGO stage 3：已記錄急性 RRT；此歷史最高分期不等同目前分期、維持性透析或新的 KRT 適應症。');
  if (currentRrt) evidence.push('縱向 CRRT 病程：已記錄未停止的急性 RRT；後續空白不代表停機。');
  else if (historicalStage3 && !uncertain) evidence.push('縱向 CRRT 病程：有明確成對的開始／停止紀錄；目前 KDIGO 分期依本次 SCr、尿量與其他目前資料判定。');
  const missingData: string[] = [];
  if (unverifiedStarts.size > 0 || unverifiedStops.size > 0) missingData.push('CRRT 開始／停止時間晚於記錄它的觀察；除非後續觀察再次明確確認，不可視為已執行。');
  if ([...pairedStopsByStart.values()].some(stopsForStart => stopsForStart.size > 1)) missingData.push('同一 CRRT 開始時間有互相矛盾的停止時間；需人工核對原始紀錄。');
  if (confirmedPairs.some(pair => pair.stop <= pair.start) || [...pairedStopsByStart].some(([start, stopsForStart]) => [...stopsForStart].some(stop => stop <= start)) || confirmedPairs.some((pair, index) => index > 0 && pair.start <= confirmedPairs[index - 1].stop)) missingData.push('CRRT 成對病程區間重疊、相接或持續時間無效；需人工核對原始紀錄。');
  if (unlinkedStartConflictsWithCompletedEpisode) missingData.push('未連結 CRRT 開始時間落在或不晚於已完成病程區間；不可自動視為新的目前治療。');
  if (unlinkedStops.length > 0 || unlinkedStarts.length > 1) missingData.push('CRRT 開始／停止紀錄無法可靠連結為同一病程；不可據此判定已恢復或目前仍在治療。');
  if (uncertain) evidence.push('縱向 CRRT 病程存在矛盾／歧義；目前治療狀態與病程邊界不可由此自動判定。');
  return { historicalStage3, currentRrt, uncertain, evidence, missingData };
}

/** Current staging plus first documented AKI timing; never equates detection with exact onset. */
export function evaluateDiagnosis(caseData: PatientCase, snapshots: ClinicalSnapshot[], currentSnapshotId?: string): DecisionResult[] {
  caseExportSchema.parse({ schemaVersion: 1, case: caseData, snapshots });
  resolveRuleSources('sepsis-diagnostic-context', ['SEPSIS_3_2016']);
  resolveRuleSources('sa-aki-seven-day-window', ['ADQI_28']);
  resolveRuleSources('sa-aki-early-late-local', ['APP_SA_AKI_TIMING_V1']);
  resolveRuleSources('krt-emergency-indications', ['KDIGO_2012']);
  // Persistence permits zero as entered data, but it is not a usable comparator.
  // Drop only the comparator so independently valid urine/serial-SCr axes still run.
  const unusableBaseline = caseData.baselineCreatinineMgDl === 0;
  const ordered = [...snapshots].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
  const staged = ordered.map((snapshot, index) => {
    const rrt = reconcileAcuteRrtEpisode(ordered, snapshot.timestamp);
    const calculated = calculateKdigoStage({
      currentCreatinineMgDl: snapshot.creatinineMgDl,
      baselineCreatinineMgDl: unusableBaseline ? undefined : caseData.baselineCreatinineMgDl,
      baselineSource: caseData.baselineCreatinineSource,
      baselineAgeHours: caseData.baselineCreatinineTimestamp ? elapsed(snapshot.timestamp, caseData.baselineCreatinineTimestamp) : undefined,
      baselineConfidence: caseData.baselineCreatinineConfidence,
      priorCreatinineMeasurements: ordered.slice(0, index).filter(prior => prior.creatinineMgDl !== undefined).map(prior => ({ creatinineMgDl: prior.creatinineMgDl!, hoursAgo: elapsed(snapshot.timestamp, prior.timestamp) })),
      urineVolumeMl: snapshot.urineVolumeMl,
      urineObservationHours: snapshot.urineObservationHours,
      urineWeightKg: snapshot.urineWeightBasis ? snapshot.urineNormalizationWeightKg : undefined,
      renalReplacementTherapy: rrt.currentRrt,
    });
    return { snapshot, result: rrt.uncertain ? {
      ...calculated, confidence: 'low' as const, provisional: true,
      status: calculated.stage > 0 ? 'provisional' as const : 'insufficient-data' as const,
      evidence: [...calculated.evidence, ...rrt.evidence], missingData: [...calculated.missingData, ...rrt.missingData],
    } : { ...calculated, evidence: [...calculated.evidence, ...rrt.evidence], missingData: [...calculated.missingData, ...rrt.missingData] } };
  });
  // A caller's explicit current observation is clinical provenance, not a display-order tie-break.
  // Deterministic ordering above is retained solely for historical reconciliation.
  const current = currentSnapshotId === undefined ? staged.at(-1) : staged.find(item => item.snapshot.id === currentSnapshotId) ?? staged.at(-1);
  const stage = current?.result ?? calculateKdigoStage({});
  const first = staged.find(item => item.result.stage > 0);
  const timingMissing = ['真正 AKI 起始時間／未觀察區間（首次偵測不等同起始）'];
  if (!caseData.sepsisOnsetTimestamp) timingMissing.push('Sepsis 起始時間');
  if (!first) timingMissing.push('符合 AKI 條件的定時觀察');
  let timingConclusion = 'SA-AKI 時間關係資料不足，尚無法分類';
  if (first && caseData.sepsisOnsetTimestamp) {
    const hours = elapsed(first.snapshot.timestamp, caseData.sepsisOnsetTimestamp);
    const category = hours < 0 ? 'before：首次觀察 AKI 在 sepsis 之前' : hours <= 48 ? 'early：≤48 h' : hours <= 168 ? 'late：>48–168 h' : 'outside：首次觀察 AKI 超出 7 天';
    timingConclusion = `${first.result.provisional ? '暫定 ' : ''}SA-AKI 操作性時間分類 ${category}（須確認實際起始與 sepsis 診斷）`;
  }
  const sepsisMissing = ['感染前 SOFA 與急性變化／感染歸因'];
  if (!caseData.infectionSource && !caseData.infectionOnsetTimestamp) sepsisMissing.push('疑似或確診感染證據');
  if (!caseData.sepsisOnsetTimestamp) sepsisMissing.push('Sepsis 起始時間');
  if (current?.snapshot.sofaScore === undefined) sepsisMissing.push('完整 SOFA 評估');
  const stagingMissing = [...stage.missingData];
  if (unusableBaseline) stagingMissing.push('基準 SCr 為 0，無法作為有效比較值；請補齊可靠基準');
  if (current?.snapshot.urineVolumeMl !== undefined && (!current.snapshot.urineWeightBasis || current.snapshot.urineNormalizationWeightKg === undefined)) stagingMissing.push('尿量正規化體重與體重基準');
  if (current?.snapshot.urineVolumeMl !== undefined && current.snapshot.diureticExposure === undefined && current.snapshot.diureticExposures === undefined) stagingMissing.push('利尿劑使用情形');
  return [
    {
      id: 'sepsis-assessment', severity: 'monitor',
      conclusion: caseData.sepsisOnsetTimestamp ? '已記錄 sepsis 起始；本資料無法獨立確認 Sepsis-3，需臨床核實' : '資料不足，無法獨立確認 Sepsis-3',
      evidence: [caseData.sepsisOnsetTimestamp ? `已記錄起始 ${caseData.sepsisOnsetTimestamp}` : '未記錄 sepsis 起始', `目前 SOFA：${current?.snapshot.sofaScore ?? '未知'}；不可假設感染前 SOFA 為 0`],
      missingData: sepsisMissing,
      actions: ['核實感染相關急性器官功能障礙及 SOFA 變化；時間戳不是自動診斷'],
      counterfactuals: ['若器官障礙非感染所致，需重新判斷 sepsis 與 SA-AKI'],
      sourceIds: ['SEPSIS_3_2016'],
    },
    {
      id: 'aki-staging', severity: stage.stage === 3 ? 'critical' : stage.stage > 0 ? 'warning' : 'monitor',
      conclusion: stage.stage > 0 ? `${stage.provisional ? '暫定 ' : ''}KDIGO stage ${stage.stage}；可信度 ${stage.confidence}` : stage.status === 'insufficient-data' ? '資料不足，尚無法完成 AKI 分期；未證實不代表正常' : '目前觀察未達 AKI 條件；不排除未觀察區間病程',
      evidence: [...stage.evidence, `SCr 分期 ${stage.creatinineStage ?? '未知'}；尿量分期 ${stage.urineStage ?? '未知'}；採較嚴重者`],
      missingData: stagingMissing,
      actions: ['補齊實測基準、連續 SCr、尿量區間與體重基準；確認尿量持續性及可逆因素', 'KDIGO 分期不等同新啟動 KRT 適應症；另評估危及生命的液體、電解質及酸鹼異常與臨床趨勢'],
      counterfactuals: ['若基準估計、時間窗或尿量收集不可靠，分期需修正；另一軸惡化可提高分期', '若為維持性透析而非本次急性 RRT，不可套用急性 RRT 分期'],
      sourceIds: ['KDIGO_2012'],
    },
    {
      id: 'sa-aki-timing', severity: first ? 'warning' : 'monitor', conclusion: timingConclusion,
      evidence: [first ? `首次觀察 AKI：${first.snapshot.timestamp}；${first.result.provisional ? '暫定' : '符合觀察條件'}` : '尚無符合條件的 AKI 觀察', '7 天範圍：ADQI 28；48 h early/late 細分：app-local 操作性定義，非 ADQI 已驗證閾值', '時間相符不證明因果；仍須排除其他 AKI 病因'],
      missingData: timingMissing,
      actions: ['核對 sepsis 與真正 AKI 起點；回顧先前資料及替代病因，不以首次輸入時間代替起始'],
      counterfactuals: ['若有更早 AKI 或 sepsis 起點修正，early／late／7 天分類可能改變', '若 AKI 先於 sepsis 或首次觀察在 7 天後，不能僅據時間戳確診本操作性 SA-AKI'],
      sourceIds: ['ADQI_28', 'APP_SA_AKI_TIMING_V1'],
    },
  ];
}
