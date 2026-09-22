import { caseRepository } from '../../src/data/caseRepository';
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

function validExport() {
  return {
    schemaVersion: 1 as const,
    case: validCase(),
    snapshots: [validSnapshot()],
  };
}

beforeEach(async () => {
  await caseRepository.clearAll();
});

afterAll(async () => {
  await caseRepository.clearAll();
});

describe('anonymous longitudinal case repository', () => {
  it('atomically updates validated anonymous metadata without changing snapshots', async () => {
    await caseRepository.createCase(validCase());
    await caseRepository.saveSnapshot(validSnapshot());
    await caseRepository.updateCase(validCase({ baselineCreatinineMgDl: 0.8, baselineCreatinineSource: 'measured-outpatient' }));
    expect(await caseRepository.getCase('case-1')).toEqual({ case: validCase({ baselineCreatinineMgDl: 0.8, baselineCreatinineSource: 'measured-outpatient' }), snapshots: [validSnapshot()] });
  });

  it('rejects conflicting, invalid, identifier-bearing and missing-case updates without partial writes', async () => {
    await caseRepository.createCase(validCase());
    await caseRepository.saveSnapshot(validSnapshot());
    await expect(caseRepository.updateCase(validCase({ sepsisOnsetTimestamp: '2026-09-21T01:00:00Z', baselineCreatinineMgDl: 0.5 }))).rejects.toThrow();
    await expect(caseRepository.updateCase(validCase({ baselineCreatinineMgDl: -1 }))).rejects.toThrow();
    await expect(caseRepository.updateCase({ ...validCase(), name: 'not permitted' } as PatientCase)).rejects.toThrow(/識別資料/);
    await expect(caseRepository.updateCase(validCase({ id: 'missing' }))).rejects.toThrow(/Case not found/);
    expect(await caseRepository.getCase('case-1')).toEqual({ case: validCase(), snapshots: [validSnapshot()] });
    expect(await caseRepository.getCase('missing')).toBeUndefined();
  });

  it('creates and retrieves a case with snapshots sorted by sepsis-onset hours', async () => {
    await caseRepository.createCase(validCase());
    await caseRepository.saveSnapshot(validSnapshot({
      id: 'snapshot-2', timestamp: '2026-09-21T12:00:00Z', hoursFromSepsisOnset: 12,
    }));
    await caseRepository.saveSnapshot(validSnapshot());

    expect(await caseRepository.listCases()).toEqual([validCase()]);
    expect((await caseRepository.getCase('case-1'))?.snapshots.map(({ id }) => id)).toEqual([
      'snapshot-1', 'snapshot-2',
    ]);
  });

  it('rejects duplicate case and snapshot IDs without overwriting data', async () => {
    await caseRepository.createCase(validCase());
    await expect(caseRepository.createCase(validCase({ anonymousCode: 'changed' }))).rejects.toThrow();
    await caseRepository.saveSnapshot(validSnapshot());
    await expect(caseRepository.saveSnapshot(validSnapshot({ actualWeightKg: 99 }))).rejects.toThrow();

    expect((await caseRepository.getCase('case-1'))?.case.anonymousCode).toBe('A001');
    expect((await caseRepository.getCase('case-1'))?.snapshots[0].actualWeightKg).toBe(70);
  });

  it('rejects snapshots for a missing case', async () => {
    await expect(caseRepository.saveSnapshot(validSnapshot())).rejects.toThrow(/case/i);
    expect(await caseRepository.listCases()).toEqual([]);
  });

  it.each(['name', 'medicalRecordNumber', 'fullDateOfBirth', 'phone', 'address'])(
    'rejects direct identifier field %s',
    async (field) => {
      const payload: Record<string, unknown> = validExport();
      (payload.case as Record<string, unknown>)[field] = 'identifier';

      await expect(caseRepository.importCase(payload)).rejects.toThrow(/識別資料/);
      expect(await caseRepository.listCases()).toEqual([]);
    },
  );

  it('cannot bypass direct-identifier denial through casing, nested objects, or arrays', async () => {
    const payload = validExport() as unknown as Record<string, unknown>;
    (payload.snapshots as unknown[]).push({
      ...validSnapshot({ id: 'snapshot-2', timestamp: '2026-09-21T07:00:00Z', hoursFromSepsisOnset: 7 }),
      adverseEvents: [{ PHONE: 'identifier' }],
    });

    await expect(caseRepository.importCase(payload)).rejects.toThrow(/識別資料.*PHONE/);
    expect(await caseRepository.listCases()).toEqual([]);
  });

  it('rejects a corrupt import without changing existing cases', async () => {
    await caseRepository.createCase(validCase({ id: 'existing-case' }));

    await expect(caseRepository.importCase({ schemaVersion: 999 })).rejects.toThrow();

    expect((await caseRepository.listCases()).map(({ id }) => id)).toEqual(['existing-case']);
  });

  it('rolls back the imported case when a snapshot write collides', async () => {
    await caseRepository.createCase(validCase({ id: 'existing-case' }));
    await caseRepository.saveSnapshot(validSnapshot({ id: 'collision', caseId: 'existing-case' }));
    const payload = validExport();
    payload.case = validCase({ id: 'imported-case', anonymousCode: 'A002' });
    payload.snapshots = [validSnapshot({
      id: 'collision', caseId: 'imported-case', timestamp: '2026-09-21T06:00:00Z',
    })];

    await expect(caseRepository.importCase(payload)).rejects.toThrow();

    expect((await caseRepository.listCases()).map(({ id }) => id)).toEqual(['existing-case']);
    expect(await caseRepository.getCase('imported-case')).toBeUndefined();
  });

  it('exports and imports a complete versioned case without sharing mutable references', async () => {
    await caseRepository.createCase(validCase());
    await caseRepository.saveSnapshot(validSnapshot());

    const exported = await caseRepository.exportCase('case-1');
    await caseRepository.clearAll();
    const imported = await caseRepository.importCase(exported);
    exported.case.anonymousCode = 'mutated outside storage';

    expect(imported.case.anonymousCode).toBe('A001');
    expect((await caseRepository.getCase('case-1'))?.case.anonymousCode).toBe('A001');
    expect(imported.snapshots.map(({ id }) => id)).toEqual(['snapshot-1']);
  });

  it('deletes a case and all of its snapshots', async () => {
    await caseRepository.createCase(validCase());
    await caseRepository.saveSnapshot(validSnapshot());

    await caseRepository.deleteCase('case-1');

    expect(await caseRepository.getCase('case-1')).toBeUndefined();
    await caseRepository.createCase(validCase({ id: 'case-2' }));
    await caseRepository.saveSnapshot(validSnapshot({ caseId: 'case-2' }));
  });
});
