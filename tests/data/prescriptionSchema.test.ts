import { caseExportSchema, clinicalSnapshotSchema } from '../../src/data/schema';
import { calculatePrescription, evaluatePrescriptionSafety } from '../../src/clinical/prescription';
import { prescriptionInput } from '../../src/features/dashboard/evaluateDashboard';

const patient = { id: 'c1', anonymousCode: 'A-001' };
const snapshot = { id: 's1', caseId: 'c1', timestamp: '2026-09-21T12:00:00Z', hoursFromSepsisOnset: 12, actualWeightKg: 80, onEcmo: false,
  crrtMode: 'CVVHDF', crrtDoseWeightKg: 80, crrtDoseWeightBasis: 'actual', crrtObservationHours: 6, crrtDowntimeHours: 0, ufNetMlHours: 0, vasopressorTrend: 'unchanged', anticoagulation: 'regional-citrate' };
const assessment = { adultConfirmed: true, weightBasisReason: '目前實測體重經團隊確認', deliveredTargetMlKgHr: 25,
  dialysateMlHr: 1000, preReplacementMlHr: 0, postReplacementMlHr: 1000, preBloodPumpMlHr: 0, bloodFlowMlMin: 200, hematocritFraction: 0.3,
  perfusionAdequate: true, citrateContraindication: false, citrateProtocolAvailable: true, bleedingRiskReviewed: true, systemicAnticoagulationReviewed: true, device: 'PrisMax',
  confirmations: { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true } };

it('round-trips a complete schema-v1 prescription assessment to reachable arithmetic and conditional RCA review', () => {
  const imported = caseExportSchema.safeParse({ schemaVersion: 1, case: patient, snapshots: [{ ...snapshot, prescriptionAssessment: assessment }] });
  expect(imported.success).toBe(true);
  if (!imported.success) return;
  const input = prescriptionInput(imported.data.case, imported.data.snapshots[0]);
  expect(calculatePrescription(input)).toMatchObject({ totalEffluentMlHr: 2000, configuredEffluentMlHr: 2000, estimatedDeliveredMlKgHr: 25, checklistComplete: true });
  expect(evaluatePrescriptionSafety(input).find(result => result.id === 'crrt-anticoagulation')?.conclusion).toContain('Conditional RCA review');
  expect(imported.data.snapshots[0].prescriptionAssessment).toEqual(assessment);
});

it('preserves legacy unknowns and incomplete prescription confirmations without inferred approval', () => {
  const legacy = clinicalSnapshotSchema.parse(snapshot);
  expect(prescriptionInput(patient, legacy).adultConfirmed).toBeUndefined();
  expect(calculatePrescription(prescriptionInput(patient, legacy)).totalEffluentMlHr).toBeUndefined();
  const partial = clinicalSnapshotSchema.safeParse({ ...snapshot, prescriptionAssessment: { ...assessment, citrateContraindication: undefined, confirmations: { device: true } } });
  expect(partial.success).toBe(true);
  if (!partial.success) return;
  const input = prescriptionInput(patient, partial.data);
  expect(input.citrateContraindication).toBeUndefined();
  expect(calculatePrescription(input).checklistComplete).toBe(false);
  expect(evaluatePrescriptionSafety(input).find(result => result.id === 'crrt-anticoagulation')?.conclusion).toContain('withhold citrate preference');
});

it('fails closed on a unique recent lactate rise that conflicts with a positive perfusion label', () => {
  const previous = clinicalSnapshotSchema.parse({ ...snapshot, id: 'prior', timestamp: '2026-09-21T06:00:00Z', hoursFromSepsisOnset: 6,
    mapMmHg: 75, capillaryRefillSeconds: 2, norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: 1 });
  const current = clinicalSnapshotSchema.parse({ ...snapshot, ufNetMlHours: 150, mapMmHg: 75, capillaryRefillSeconds: 2,
    norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: 1.9, prescriptionAssessment: assessment });

  const input = prescriptionInput(patient, current, previous);
  const prescription = calculatePrescription(input);
  const decision = evaluatePrescriptionSafety(input).find(result => result.id === 'crrt-prescription-safety')!;

  expect(input.perfusionConflictReasons).toBeDefined();
  expect((input.perfusionConflictReasons ?? []).join(' ')).toContain('lactate 1 → 1.9');
  expect(prescription.ufNetMlHr).toBe(0);
  expect(prescription.checklistComplete).toBe(false);
  expect(decision.missingData.join(' ')).toContain('Resolve measured perfusion');
  expect(decision.evidence.join(' ')).toContain('非單獨診斷');
  expect(decision.reassessWithinHours).toBe(0.25);
});

it.each([
  ['same timestamp', '2026-09-21T12:00:00Z', 1, 1.9],
  ['older than six hours', '2026-09-21T05:59:59Z', 1, 1.9],
  ['falling', '2026-09-21T06:00:00Z', 1.9, 1],
  ['unchanged', '2026-09-21T06:00:00Z', 1.5, 1.5],
] as const)('does not manufacture a lactate trajectory from %s provenance/data', (_label, priorTimestamp, priorLactate, currentLactate) => {
  const previous = clinicalSnapshotSchema.parse({ ...snapshot, id: 'prior', timestamp: priorTimestamp,
    mapMmHg: 75, capillaryRefillSeconds: 2, norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: priorLactate });
  const current = clinicalSnapshotSchema.parse({ ...snapshot, ufNetMlHours: 150, mapMmHg: 75, capillaryRefillSeconds: 2,
    norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: currentLactate, prescriptionAssessment: assessment });

  const input = prescriptionInput(patient, current, previous);
  expect(input.perfusionConflictReasons).toBeUndefined();
  expect(calculatePrescription(input)).toMatchObject({ ufNetMlHr: 150, checklistComplete: true });
});

it.each([
  { hematocritFraction: 30 }, { bloodFlowMlMin: 0 }, { preBloodPumpMlHr: -1 }, { deliveredTargetMlKgHr: '25' },
  { perfusionAdequate: 'true' }, { confirmations: { device: true, unknownApproval: true } }, { device: 'default-machine' },
])('rejects invalid persisted prescription units/types/unknown keys: %j', patch => {
  expect(clinicalSnapshotSchema.safeParse({ ...snapshot, prescriptionAssessment: { ...assessment, ...patch } }).success).toBe(false);
});
