import { caseExportSchema, clinicalSnapshotSchema, patientCaseSchema } from '../../src/data/schema';
import type { ClinicalSnapshot, PatientCase } from '../../src/clinical/types';

function validCase(overrides: Partial<PatientCase> = {}): PatientCase {
  return {
    id: 'case-1',
    anonymousCode: 'A001',
    sepsisOnsetTimestamp: '2026-09-21T00:00:00Z',
    ...overrides,
  };
}

function validSnapshot(overrides: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot {
  return {
    id: 'snapshot-1',
    caseId: 'case-1',
    timestamp: '2026-09-21T06:00:00Z',
    hoursFromSepsisOnset: 6,
    actualWeightKg: 70,
    onEcmo: false,
    ...overrides,
  };
}

describe('clinical persistence schemas', () => {
  it('preserves an unknown clinical value as absent instead of defaulting it', () => {
    const parsed = patientCaseSchema.parse({ id: 'case-1', anonymousCode: 'A001' });

    expect(parsed).not.toHaveProperty('baselineCreatinineMgDl');
  });

  it('rejects negative urine volume', () => {
    expect(() => clinicalSnapshotSchema.parse(validSnapshot({ urineVolumeMl: -0.01 }))).toThrow();
    expect(clinicalSnapshotSchema.parse(validSnapshot({ urineVolumeMl: 0 })).urineVolumeMl).toBe(0);
  });

  it.each([
    [6.49, false],
    [6.5, true],
    [8, true],
    [8.01, false],
  ])('enforces the physiologic arterial pH boundary for %s', (arterialPh, valid) => {
    const parse = () => clinicalSnapshotSchema.parse(validSnapshot({ arterialPh }));
    if (valid) expect(parse).not.toThrow();
    else expect(parse).toThrow();
  });

  it.each([
    [-0.001, false],
    [0, true],
    [1, true],
    [1.001, false],
  ])('enforces the dimensionless EAA boundary for %s', (endotoxinActivityAssay, valid) => {
    const parse = () => clinicalSnapshotSchema.parse(validSnapshot({ endotoxinActivityAssay }));
    if (valid) expect(parse).not.toThrow();
    else expect(parse).toThrow();
  });

  it('rejects unknown measurement units instead of silently coercing them', () => {
    const payload = { ...validSnapshot(), urineVolumeUnit: 'oz' };

    expect(() => clinicalSnapshotSchema.parse(payload)).toThrow();
  });

  it.each([[0, true], [24, true], [25, false], [999, false], [-1, false], [9.5, false]] as const)(
    'enforces the 0–24 integer MODS domain at snapshot persistence: %s', (modsScore, valid) => {
      const result = clinicalSnapshotSchema.safeParse(validSnapshot({ modsScore }));
      expect(result.success).toBe(valid);
      if (result.success) expect(result.data.modsScore).toBe(modsScore);
    });

  it.each([[24, true], [25, false], [999, false]] as const)(
    'enforces the MODS upper bound through the JSON import schema: %s', (modsScore, valid) => {
      const payload = JSON.parse(JSON.stringify({ schemaVersion: 1, case: validCase(), snapshots: [validSnapshot({ modsScore })] }));
      const result = caseExportSchema.safeParse(payload);
      expect(result.success).toBe(valid);
      if (result.success) expect(result.data.snapshots[0].modsScore).toBe(modsScore);
      else expect(result.error.issues.some(issue => issue.path.join('.') === 'snapshots.0.modsScore')).toBe(true);
    });

  it('requires timestamps with an explicit UTC offset', () => {
    expect(() => clinicalSnapshotSchema.parse(validSnapshot({ timestamp: '2026-09-21T06:00:00' }))).toThrow();
    expect(() => clinicalSnapshotSchema.parse(validSnapshot({ timestamp: 'not-a-date' }))).toThrow();
  });

  it('accepts schema version 1 and rejects unsupported versions', () => {
    const valid = { schemaVersion: 1, case: validCase(), snapshots: [validSnapshot()] };

    expect(caseExportSchema.parse(valid).schemaVersion).toBe(1);
    expect(() => caseExportSchema.parse({ ...valid, schemaVersion: 2 })).toThrow();
  });

  it('rejects duplicate snapshot IDs in one import', () => {
    const snapshot = validSnapshot();

    expect(() => caseExportSchema.parse({
      schemaVersion: 1,
      case: validCase(),
      snapshots: [snapshot, { ...snapshot, hoursFromSepsisOnset: 7, timestamp: '2026-09-21T07:00:00Z' }],
    })).toThrow(/snapshot ID/i);
  });

  it('rejects a snapshot owned by another case', () => {
    expect(() => caseExportSchema.parse({
      schemaVersion: 1,
      case: validCase(),
      snapshots: [validSnapshot({ caseId: 'case-2' })],
    })).toThrow(/caseId/i);
  });

  it('rejects a snapshot whose timestamp conflicts with hours from sepsis onset', () => {
    expect(() => caseExportSchema.parse({
      schemaVersion: 1,
      case: validCase(),
      snapshots: [validSnapshot({ hoursFromSepsisOnset: 7 })],
    })).toThrow(/sepsis onset/i);
  });
});
