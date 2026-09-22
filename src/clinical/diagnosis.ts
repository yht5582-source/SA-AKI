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

/** Current staging plus first documented AKI timing; never equates detection with exact onset. */
export function evaluateDiagnosis(caseData: PatientCase, snapshots: ClinicalSnapshot[]): DecisionResult[] {
  caseExportSchema.parse({ schemaVersion: 1, case: caseData, snapshots });
  resolveRuleSources('sepsis-diagnostic-context', ['SEPSIS_3_2016']);
  resolveRuleSources('sa-aki-seven-day-window', ['ADQI_28']);
  resolveRuleSources('sa-aki-early-late-local', ['APP_SA_AKI_TIMING_V1']);
  resolveRuleSources('krt-emergency-indications', ['KDIGO_2012']);
  // Persistence permits zero as entered data, but it is not a usable comparator.
  // Drop only the comparator so independently valid urine/serial-SCr axes still run.
  const unusableBaseline = caseData.baselineCreatinineMgDl === 0;
  const ordered = [...snapshots].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const staged = ordered.map((snapshot, index) => ({
    snapshot,
    result: calculateKdigoStage({
      currentCreatinineMgDl: snapshot.creatinineMgDl,
      baselineCreatinineMgDl: unusableBaseline ? undefined : caseData.baselineCreatinineMgDl,
      baselineSource: caseData.baselineCreatinineSource,
      baselineAgeHours: caseData.baselineCreatinineTimestamp ? elapsed(snapshot.timestamp, caseData.baselineCreatinineTimestamp) : undefined,
      baselineConfidence: caseData.baselineCreatinineConfidence,
      priorCreatinineMeasurements: ordered.slice(0, index).filter(prior => prior.creatinineMgDl !== undefined).map(prior => ({ creatinineMgDl: prior.creatinineMgDl!, hoursAgo: elapsed(snapshot.timestamp, prior.timestamp) })),
      urineVolumeMl: snapshot.urineVolumeMl,
      urineObservationHours: snapshot.urineObservationHours,
      urineWeightKg: snapshot.urineWeightBasis ? snapshot.urineNormalizationWeightKg : undefined,
      renalReplacementTherapy: !!snapshot.crrtStartedTimestamp && elapsed(snapshot.timestamp, snapshot.crrtStartedTimestamp) >= 0 && (!snapshot.crrtStoppedTimestamp || elapsed(snapshot.timestamp, snapshot.crrtStoppedTimestamp) < 0),
    }),
  }));
  const current = staged.at(-1);
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
