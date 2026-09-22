import { caseExportSchema, clinicalSnapshotSchema } from '../../src/data/schema';
import { haAssessment, haSnapshot } from '../clinical/haFixtures';

it('round-trips all HA gates through schema v1 without losing false or zero observations', () => {
  const snapshot = haSnapshot({ hemoadsorptionAssessment: haAssessment({ optedIn: false, immunoparalysis: true, lowHlaDr: true,
    suspectedGramNegativeInfection: true, endotoxinPhenotype: false, targetStillPresent: false }), urineVolumeMl: 0 });
  const parsed = caseExportSchema.parse(JSON.parse(JSON.stringify({ schemaVersion: 1, case: { id: 'ha-case', anonymousCode: 'HA01' }, snapshots: [snapshot] })));
  expect(parsed.snapshots[0].hemoadsorptionAssessment).toEqual(snapshot.hemoadsorptionAssessment);
  expect(parsed.snapshots[0].urineVolumeMl).toBe(0);
  expect(parsed.schemaVersion).toBe(1);
});

it('keeps old schema v1 snapshots valid with HA off/absent', () => {
  const parsed = clinicalSnapshotSchema.parse(JSON.parse(JSON.stringify(haSnapshot({ hemoadsorptionAssessment: undefined }))));
  expect(parsed.hemoadsorptionAssessment).toBeUndefined();
});

it('preserves missing HA assessments as missing, not granted clearance', () => {
  const parsed = clinicalSnapshotSchema.parse(haSnapshot({ hemoadsorptionAssessment: { optedIn: true } }));
  expect(parsed.hemoadsorptionAssessment).toEqual({ optedIn: true });
});

it.each([
  { optedIn: 'true' }, { shockTrajectory: 'normal' }, { requestedDevice: 'generic filter' },
  { safety: { plateletsAcceptable: 'yes' } }, { governance: { consent: true } },
  { governance: { reviewAtHours: -1 } }, { governance: { reviewAtHours: Infinity } },
  { unknownGate: true },
])('rejects malformed HA assessment %j', hemoadsorptionAssessment => {
  expect(clinicalSnapshotSchema.safeParse({ ...haSnapshot(), hemoadsorptionAssessment }).success).toBe(false);
});
