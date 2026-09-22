import type { ClinicalSnapshot, DecisionResult, PatientCase } from './types';
import { resolveRuleSources } from './sources';

type Trajectory = 'improving' | 'persistent' | 'relapsing' | 'worsening' | 'insufficient-data';
type Direction = 'improving' | 'unchanged' | 'worsening' | 'indeterminate';
const finite = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);
const rank = { 'room-air': 0, 'conventional-oxygen': 1, 'high-flow-nasal-oxygen': 2, 'noninvasive-ventilation': 3, 'invasive-ventilation': 4 };

function ordered(snapshots: ClinicalSnapshot[], caseId = snapshots[0]?.caseId): ClinicalSnapshot[] | undefined {
  const times = new Set<number>(); const ids = new Set<string>();
  for (const s of snapshots) {
    const time = Date.parse(s.timestamp);
    if (!finite(time) || s.caseId !== caseId || times.has(time) || ids.has(s.id)) return undefined;
    times.add(time); ids.add(s.id);
  }
  return [...snapshots].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
function direction(before: number | undefined, after: number | undefined, higherIsBetter = false): Direction {
  if (!finite(before) || !finite(after)) return 'indeterminate';
  if (before === after) return 'unchanged';
  return (after > before) === higherIsBetter ? 'improving' : 'worsening';
}
function combine(values: Direction[]): Direction {
  if (values.includes('indeterminate') || (values.includes('improving') && values.includes('worsening'))) return 'indeterminate';
  return values.includes('worsening') ? 'worsening' : values.includes('improving') ? 'improving' : 'unchanged';
}
function urineRate(s: ClinicalSnapshot): number | undefined {
  return finite(s.urineVolumeMl) && s.urineVolumeMl >= 0 && finite(s.urineObservationHours) && s.urineObservationHours > 0 ? s.urineVolumeMl / s.urineObservationHours : undefined;
}
function renalConfounded(s: ClinicalSnapshot): boolean {
  const now = Date.parse(s.timestamp);
  const start = s.crrtStartedTimestamp ? Date.parse(s.crrtStartedTimestamp) : undefined;
  const stop = s.crrtStoppedTimestamp ? Date.parse(s.crrtStoppedTimestamp) : undefined;
  return s.diureticExposure !== false || (s.diureticExposures?.length ?? 0) > 0
    || (s.crrtMode !== undefined && start === undefined)
    || (start !== undefined && (!finite(start) || start > now || !finite(stop) || stop < start || stop > now))
    || (stop !== undefined && start === undefined)
    || (finite(stop) && finite(s.urineObservationHours) && stop > now - s.urineObservationHours * 3_600_000)
    || (finite(s.deliveredEffluentMlKgHours) && s.deliveredEffluentMlKgHours > 0);
}

/** Descriptive course only; not a duration-defined AKI phenotype or recovery prediction. */
export function classifyAkiTrajectory(snapshots: ClinicalSnapshot[]): Trajectory {
  const series = ordered(snapshots);
  if (!series || series.length < 2 || series.some(s => renalConfounded(s) || !finite(s.creatinineMgDl) || s.creatinineMgDl < 0 || !finite(urineRate(s)))) return 'insufficient-data';
  // A clearance episode between measurements can lower SCr even if the latest urine window is fully off therapy.
  if (series.some(s => s.crrtStoppedTimestamp && Date.parse(s.crrtStoppedTimestamp) > Date.parse(series[0].timestamp))) return 'insufficient-data';
  const changes = series.slice(1).map((s, index) => combine([
    direction(series[index].creatinineMgDl, s.creatinineMgDl), direction(urineRate(series[index]), urineRate(s), true),
  ]));
  if (changes.includes('indeterminate')) return 'insufficient-data';
  const latest = changes.at(-1)!;
  if (latest === 'worsening' && changes.slice(0, -1).includes('improving')) return 'relapsing';
  return latest === 'unchanged' ? 'persistent' : latest as 'improving' | 'worsening';
}

/** Factors and separate organ directions, never an individual risk score or deterministic outcome. */
export function evaluatePrognosis(caseData: PatientCase, snapshots: ClinicalSnapshot[]): DecisionResult[] {
  const series = ordered(snapshots, caseData.id);
  const latest = series?.at(-1); const previous = series?.at(-2);
  const renal = series ? classifyAkiTrajectory(series) : 'insufficient-data';
  const missingData: string[] = [];
  if (!series || !previous) missingData.push('at least two unique valid same-case timepoints');
  if (renal === 'insufficient-data') missingData.push('concordant renal trajectory with timed urine, diuretic and RRT context');
  const hemodynamic = previous && latest ? combine([
    direction(previous.mapMmHg, latest.mapMmHg, true), direction(previous.norepinephrineEquivalentMcgKgMin, latest.norepinephrineEquivalentMcgKgMin), direction(previous.lactateMmolL, latest.lactateMmolL),
  ]) : 'indeterminate';
  const respiratory = previous && latest ? combine([
    direction(previous.pao2Fio2RatioMmHg, latest.pao2Fio2RatioMmHg, true),
    direction(previous.respiratorySupport ? rank[previous.respiratorySupport] : undefined, latest.respiratorySupport ? rank[latest.respiratorySupport] : undefined),
  ]) : 'indeterminate';
  const fluid = direction(previous?.cumulativeFluidBalanceMl, latest?.cumulativeFluidBalanceMl);
  const organ = direction(previous?.sofaScore, latest?.sofaScore);
  for (const [domain, value] of Object.entries({ hemodynamic, respiratory, fluid, organ })) if (value === 'indeterminate') missingData.push(`${domain}: comparable serial observations absent or conflicting`);
  const shockHours = latest && caseData.shockOnsetTimestamp ? (Date.parse(latest.timestamp) - Date.parse(caseData.shockOnsetTimestamp)) / 3_600_000 : undefined;
  if (!finite(shockHours) || shockHours < 0) missingData.push('valid shock onset / duration and resolution assessment');
  if (!caseData.ckdStage) missingData.push('baseline CKD assessment');
  missingData.push('nephrotoxin exposure and dose/timing review: unknown; no automatic exposure inference from a drug name');
  const evidence = [
    `measured renal: ${renal}; hemodynamic: ${hemodynamic}; respiratory: ${respiratory}; fluid: ${fluid}; organ: ${organ}`,
    'Local convention：direction labels summarize recorded changes, not validated prognostic strata; persistent means unchanged latest observed pair, not a duration-defined persistent AKI diagnosis.',
    `measured latest SCr ${latest?.creatinineMgDl ?? 'unknown'} mg/dL; urine ${latest?.urineVolumeMl ?? 'unknown'} mL / ${latest?.urineObservationHours ?? 'unknown'} h; multiorgan SOFA ${latest?.sofaScore ?? 'unknown'} (score alone does not diagnose all affected organs).`,
    `baseline CKD ${caseData.ckdStage ?? 'unknown'}; baseline SCr ${caseData.baselineCreatinineMgDl ?? 'unknown'}; confidence ${caseData.baselineCreatinineConfidence ?? 'unknown'}.`,
    `shock: ${finite(shockHours) && shockHours >= 0 ? shockHours : 'unknown'} h since recorded onset; this is exposure context, not proven continuous shock duration.`,
    `clinician assessment: vasopressor trajectory ${latest?.vasopressorTrend ?? 'unknown'}; source control ${latest?.sourceControlStatus ?? 'unknown'}; native solute adequacy ${latest?.liberationAssessment?.nativeSoluteControlAdequate ?? 'unknown'}; not substituted for measurements.`,
    `fluid context: cumulative balance ${latest?.cumulativeFluidBalanceMl ?? 'unknown'} mL; balance alone does not establish intravascular overload or effective circulating volume.`,
    'Confounders: RRT clearance, dilution, diuretics, residual kidney function, catabolism, source control and treatment timing can change measured trajectories without demonstrating native renal recovery.',
    'MAKE30 / MAKE90 outcome framing: death, new KRT or dialysis dependence, and persistent kidney dysfunction at 30 / 90 days. Definitions, baseline, index date and follow-up windows must be specified; no composite outcome is calculated from these snapshots.',
    'Uncertainty 不確定性：observed trends and risk factors are not individual mortality or renal recovery probabilities; biomarkers cannot determine an individual recovery percentage.',
  ];
  const result: DecisionResult = {
    id: 'aki-prognosis-review', severity: [hemodynamic, respiratory, fluid, organ].includes('worsening') || renal === 'worsening' || renal === 'relapsing' ? 'warning' : 'monitor',
    conclusion: `factor/trajectory review：renal ${renal === 'insufficient-data' ? 'indeterminate' : renal}；organ domains remain separate；uncertainty applies`,
    evidence, missingData,
    actions: ['Review measured trends alongside clinician assessment of source control, perfusion, respiratory support, fluid needs, residual function and nephrotoxin exposure.', 'Track dialysis dependence, kidney function against a documented baseline and vital status with an agreed outcome definition at 30/90 days; arrange kidney reassessment around 3 months after AKI.'],
    counterfactuals: ['New deterioration, relapse, escalating organ support or inadequate source control changes the review context; concordant improvement does not establish treatment benefit or guaranteed recovery.'],
    sourceIds: ['KDIGO_2012', 'APP_TRAJECTORY_V1', 'MAKE_DEFINITIONS_2024'],
  };
  resolveRuleSources(result.id, result.sourceIds);
  return [result];
}
