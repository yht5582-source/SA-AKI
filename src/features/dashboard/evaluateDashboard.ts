import { evaluateDiagnosis } from '../../clinical/diagnosis';
import { evaluateFluid } from '../../clinical/fluid';
import { evaluateKrtInitiation } from '../../clinical/krt';
import { selectKrtModality, evaluateEcmoConnection } from '../../clinical/modality';
import { evaluatePrescriptionSafety, type PrescriptionInput } from '../../clinical/prescription';
import { evaluateLiberation } from '../../clinical/liberation';
import { evaluatePrognosis } from '../../clinical/prognosis';
import { evaluateHaDrugExposure, evaluateHaResponse, matchHaDevice } from '../../clinical/ha';
import type { ClinicalSnapshot, DecisionResult, PatientCase } from '../../clinical/types';
import { duplicateSnapshotTimes, orderSnapshots, strictlyEarlierSnapshot } from './snapshotContext';
import { reconcileHaExposures } from '../ha/exposureHistory';

export function sortDecisions(results: DecisionResult[]): DecisionResult[] {
  const priority = { critical: 0, warning: 1, monitor: 2, stable: 3 };
  return [...results].sort((a, b) => priority[a.severity] - priority[b.severity]);
}
function prescriptionPerfusionContext(snapshot: ClinicalSnapshot, previous?: ClinicalSnapshot): Pick<PrescriptionInput, 'pressorTrend' | 'perfusionConflictReasons'> {
  const labeledTrend: PrescriptionInput['pressorTrend'] = snapshot.vasopressorTrend === 'worsening' ? 'rising' : snapshot.vasopressorTrend === 'improving' ? 'falling' : snapshot.vasopressorTrend === 'unchanged' ? 'stable' : undefined;
  const elapsedHours = previous ? (Date.parse(snapshot.timestamp) - Date.parse(previous.timestamp)) / 3_600_000 : undefined;
  const comparable = previous?.caseId === snapshot.caseId && elapsedHours !== undefined && elapsedHours > 0 && elapsedHours <= 6;
  const measuredPressorsRising = comparable
    && previous.norepinephrineEquivalentMcgKgMin !== undefined
    && snapshot.norepinephrineEquivalentMcgKgMin !== undefined
    && snapshot.norepinephrineEquivalentMcgKgMin > previous.norepinephrineEquivalentMcgKgMin;
  const measuredLactateRising = comparable
    && previous.lactateMmolL !== undefined
    && snapshot.lactateMmolL !== undefined
    && snapshot.lactateMmolL > previous.lactateMmolL;
  const perfusionSignals: string[] = [];
  if (snapshot.mapMmHg !== undefined && snapshot.mapMmHg < 65) perfusionSignals.push(`MAP ${snapshot.mapMmHg} mmHg`);
  if (snapshot.lactateMmolL !== undefined && snapshot.lactateMmolL > 2) perfusionSignals.push(`lactate ${snapshot.lactateMmolL} mmol/L`);
  if (snapshot.capillaryRefillSeconds !== undefined && snapshot.capillaryRefillSeconds > 3) perfusionSignals.push(`CRT ${snapshot.capillaryRefillSeconds} s`);
  if (snapshot.skinMottling === true) perfusionSignals.push('mottling present');
  if (snapshot.peripheralTemperature === 'cool') perfusionSignals.push('cool periphery');
  if (snapshot.mentalStatus === 'altered' || snapshot.mentalStatus === 'unresponsive') perfusionSignals.push(`mental status ${snapshot.mentalStatus}`);
  const perfusionConflictReasons: string[] = [];
  if (snapshot.prescriptionAssessment?.perfusionAdequate === true && perfusionSignals.length) {
    perfusionConflictReasons.push(`「灌流足夠」與目前量測需核對（${perfusionSignals.join('、')}）；這些訊號各自不等同低灌流診斷`);
  }
  if (snapshot.prescriptionAssessment?.perfusionAdequate === true && measuredLactateRising) {
    perfusionConflictReasons.push(`lactate ${previous!.lactateMmolL} → ${snapshot.lactateMmolL} mmol/L（≤6 h）上升與「灌流足夠」標記需核對；此趨勢是複核訊號，非單獨診斷`);
  }
  if (measuredPressorsRising && labeledTrend !== 'rising') {
    perfusionConflictReasons.push(`NE-equivalent ${previous!.norepinephrineEquivalentMcgKgMin} → ${snapshot.norepinephrineEquivalentMcgKgMin} mcg/kg/min（≤6 h）與標記 ${snapshot.vasopressorTrend ?? '未知'} 不一致`);
  }
  return {
    pressorTrend: measuredPressorsRising ? 'rising' as const : labeledTrend,
    perfusionConflictReasons: perfusionConflictReasons.length ? perfusionConflictReasons : undefined,
  };
}

/** Adapter only: unavailable prescription parameters remain unknown, never inferred approvals. */
export function prescriptionInput(patient: PatientCase, snapshot: ClinicalSnapshot, previous?: ClinicalSnapshot): PrescriptionInput {
  return {
    ...snapshot.prescriptionAssessment,
    actualWeightKg: snapshot.crrtDoseWeightBasis === 'actual' ? snapshot.crrtDoseWeightKg : snapshot.actualWeightKg,
    idealWeightKg: snapshot.crrtDoseWeightBasis === 'ideal' ? snapshot.crrtDoseWeightKg : patient.idealWeightKg,
    adjustedWeightKg: snapshot.crrtDoseWeightBasis === 'adjusted' ? snapshot.crrtDoseWeightKg : patient.adjustedWeightKg,
    heightCm: patient.heightCm, sex: patient.sex, weightBasis: snapshot.crrtDoseWeightBasis,
    weightBasisReason: snapshot.prescriptionAssessment?.weightBasisReason ?? (patient.weightBasis === snapshot.crrtDoseWeightBasis ? patient.weightBasisReason : undefined),
    mode: snapshot.crrtMode, observedDeliveredMlKgHr: snapshot.deliveredEffluentMlKgHours,
    downtimeFraction: snapshot.crrtDowntimeHours !== undefined && snapshot.crrtObservationHours !== undefined && snapshot.crrtObservationHours > 0 ? snapshot.crrtDowntimeHours / snapshot.crrtObservationHours : undefined,
    requestedUfNetMlHr: snapshot.ufNetMlHours, anticoagulation: snapshot.anticoagulation,
    ...prescriptionPerfusionContext(snapshot, previous),
  };
}
function haResponseReview(current: ClinicalSnapshot, ordered: ClinicalSnapshot[]): DecisionResult[] {
  const { active: exposures, issues } = reconcileHaExposures(current, ordered);
  if (!exposures.length && !issues.length) return [];
  const exposure = exposures.length === 1 ? exposures[0] : undefined;
  const candidates = exposure ? ordered.filter(item => Date.parse(item.timestamp) === Date.parse(exposure.startedTimestamp)
    && Date.parse(item.timestamp) < Date.parse(current.timestamp) && item.caseId === current.caseId
    && item.hemoadsorptionAssessment?.optedIn === true
    && item.hemoadsorptionAssessment.requestedDevice === exposure.device
    && item.hemoadsorptionAssessment.targetAdsorbate === exposure.targetAdsorbate) : [];
  const response = candidates.length === 1 && current.hemoadsorptionAssessment?.optedIn === true
    ? evaluateHaResponse({ baseline: { snapshot: candidates[0], previousSnapshot: strictlyEarlierSnapshot(candidates[0], ordered) }, snapshot: { ...current, hemoadsorptionExposures: exposures } }) : undefined;
  if (response && !issues.length) return response;
  // A missing/unassessed/ambiguous baseline cannot be supplied to the engine as though it were established.
  // Keep an immediate provenance review visible, including when current opt-in documentation is missing.
  const responseDrugReview = response?.find(result => result.id === 'ha-drug-exposure-review');
  const drugReviews = responseDrugReview ? [responseDrugReview] : exposures.map(active => evaluateHaDrugExposure(current, active));
  const drugReview: DecisionResult[] = drugReviews.length ? [{
    ...drugReviews[0],
    evidence: [...new Set(drugReviews.flatMap(result => result.evidence))],
    missingData: [...new Set(drugReviews.flatMap(result => result.missingData)), '歷史暴露紀錄需與目前給藥／TDM／換匣計畫核對；來源不確定警示仍有效，不能據此授權 HA 或自動調整劑量。'],
  }] : [];
  return [{
    id: 'ha-response-review', severity: 'critical', conclusion: 'HA 暴露基準來源不明確；立即多專科重評',
    evidence: [`記錄中的活動 HA 暴露：${exposures.length}；相符已評估基準：${candidates.length}。`, '資料來源不確定，無法判定反應；此警示不自行判定傷害、療效或授權繼續治療。', ...response?.find(result => result.id === 'ha-response-review')?.evidence ?? []],
    missingData: ['唯一、已評估且裝置／目標相容的同案 HA 起始基準、唯一活動暴露及目前 HA 評估', ...issues],
    actions: ['立即由床邊多專科團隊核對暴露起點、原始評估、裝置、目標與目前安全狀態；不得因基準缺失而省略監測或自動繼續。'],
    reassessWithinHours: 0,
    counterfactuals: ['只有核實唯一相容基準與目前評估後，才能重新解讀序列反應；任何惡化仍需立即床邊處理。'],
    sourceIds: ['APP_HA_REVIEW_V1'],
  }, ...drugReview];
}
export function evaluateDashboard(patient: PatientCase, snapshots: ClinicalSnapshot[], selectedId?: string): DecisionResult[] {
  const sorted = orderSnapshots(snapshots);
  const selected = selectedId ? sorted.find(snapshot => snapshot.id === selectedId) : sorted.at(-1);
  // Retain every same-instant observation for uncertainty checks while keeping the explicit selection current.
  const ordered = selected ? [...sorted.filter(snapshot => snapshot !== selected && Date.parse(snapshot.timestamp) <= Date.parse(selected.timestamp)), selected] : sorted;
  const results = evaluateDiagnosis(patient, ordered, selected?.id);
  const current = ordered.at(-1), previous = current ? strictlyEarlierSnapshot(current, ordered) : undefined;
  if (!current) return sortDecisions(results);
  const duplicateTimes = duplicateSnapshotTimes(ordered);
  if (duplicateTimes.length) results.push({
    id: 'snapshot-time-provenance', severity: 'warning', conclusion: '同一時間點有多筆觀察；時間來源需立即核對',
    evidence: duplicateTimes.map(time => `${new Date(time).toISOString()}：${ordered.filter(snapshot => Date.parse(snapshot.timestamp) === time).length} 筆觀察；不推定先後或相互取代。`),
    missingData: ['同時觀察的先後、量測來源及適用資料；重複時間不代表已確認連續趨勢。'],
    actions: ['核對所有同時觀察；液體比較僅採唯一且嚴格較早的時間點，模糊比較保留未知。'],
    reassessWithinHours: 0, counterfactuals: ['釐清原始時間與紀錄關係後重新評估；其他危險訊號與床邊處置不可因資料歧義而延誤。'], sourceIds: [],
  });
  results.push(...evaluateFluid(current, previous), ...evaluateKrtInitiation(current), ...selectKrtModality(current), ...evaluateEcmoConnection(current), ...evaluatePrescriptionSafety(prescriptionInput(patient, current, previous)), ...evaluateLiberation(current, ordered), ...evaluatePrognosis(patient, ordered));
  if (current.hemoadsorptionAssessment?.optedIn) {
    results.push(...matchHaDevice({ snapshot: current, previousSnapshot: previous }));
  }
  results.push(...haResponseReview(current, ordered));
  // HA cautions recur in response evaluation; retain the latest same-rule result.
  return sortDecisions([...new Map(results.map(result => [result.id, result])).values()]);
}
