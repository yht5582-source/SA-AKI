import type { ClinicalSnapshot, PatientCase } from '../clinical/types';
import { db } from './db';
import {
  assertNoDirectIdentifiers,
  caseExportSchema,
  clinicalSnapshotSchema,
  patientCaseSchema,
  type CaseExport,
} from './schema';

export interface StoredCase {
  case: PatientCase;
  snapshots: ClinicalSnapshot[];
}

function sortSnapshots(snapshots: ClinicalSnapshot[]): ClinicalSnapshot[] {
  return snapshots.sort((left, right) => (
    left.hoursFromSepsisOnset - right.hoursFromSepsisOnset || left.id.localeCompare(right.id)
  ));
}

export const caseRepository = {
  async updateCase(candidate: PatientCase): Promise<PatientCase> {
    assertNoDirectIdentifiers(candidate);
    const patientCase = patientCaseSchema.parse(candidate);
    await db.transaction('rw', db.cases, db.snapshots, async () => {
      if (!await db.cases.get(patientCase.id)) throw new Error(`Case not found: ${patientCase.id}`);
      const snapshots = await db.snapshots.where('caseId').equals(patientCase.id).toArray();
      caseExportSchema.parse({ schemaVersion: 1, case: patientCase, snapshots });
      await db.cases.put(patientCase);
    });
    return patientCase;
  },

  async createCase(candidate: PatientCase): Promise<PatientCase> {
    assertNoDirectIdentifiers(candidate);
    const patientCase = patientCaseSchema.parse(candidate);
    await db.cases.add(patientCase);
    return patientCase;
  },

  async saveSnapshot(candidate: ClinicalSnapshot): Promise<ClinicalSnapshot> {
    assertNoDirectIdentifiers(candidate);
    const snapshot = clinicalSnapshotSchema.parse(candidate);

    await db.transaction('rw', db.cases, db.snapshots, async () => {
      const patientCase = await db.cases.get(snapshot.caseId);
      if (!patientCase) throw new Error(`Case not found: ${snapshot.caseId}`);
      caseExportSchema.parse({ schemaVersion: 1, case: patientCase, snapshots: [snapshot] });
      await db.snapshots.add(snapshot);
    });

    return snapshot;
  },

  async listCases(): Promise<PatientCase[]> {
    const cases = await db.cases.toArray();
    return cases.sort((left, right) => left.id.localeCompare(right.id));
  },

  async getCase(caseId: string): Promise<StoredCase | undefined> {
    return db.transaction('r', db.cases, db.snapshots, async () => {
      const patientCase = await db.cases.get(caseId);
      if (!patientCase) return undefined;
      const snapshots = await db.snapshots.where('caseId').equals(caseId).toArray();
      return { case: patientCase, snapshots: sortSnapshots(snapshots) };
    });
  },

  async deleteCase(caseId: string): Promise<void> {
    await db.transaction('rw', db.cases, db.snapshots, async () => {
      await db.snapshots.where('caseId').equals(caseId).delete();
      await db.cases.delete(caseId);
    });
  },

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.cases, db.snapshots, async () => {
      await db.snapshots.clear();
      await db.cases.clear();
    });
  },

  async exportCase(caseId: string): Promise<CaseExport> {
    const storedCase = await this.getCase(caseId);
    if (!storedCase) throw new Error(`Case not found: ${caseId}`);
    return caseExportSchema.parse({ schemaVersion: 1, ...storedCase });
  },

  async importCase(candidate: unknown): Promise<StoredCase> {
    assertNoDirectIdentifiers(candidate);
    const payload = caseExportSchema.parse(candidate);

    await db.transaction('rw', db.cases, db.snapshots, async () => {
      await db.cases.add(payload.case);
      if (payload.snapshots.length > 0) await db.snapshots.bulkAdd(payload.snapshots);
    });

    return { case: payload.case, snapshots: sortSnapshots(payload.snapshots) };
  },
};
