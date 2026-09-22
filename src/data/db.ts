import Dexie, { type Table } from 'dexie';
import type { ClinicalSnapshot, PatientCase } from '../clinical/types';

export class SaAkiDatabase extends Dexie {
  cases!: Table<PatientCase, string>;
  snapshots!: Table<ClinicalSnapshot, string>;

  constructor() {
    super('sa-aki-clinical-navigator');
    this.version(1).stores({
      cases: 'id, anonymousCode',
      snapshots: 'id, caseId, hoursFromSepsisOnset, [caseId+hoursFromSepsisOnset]',
    });
  }
}

export const db = new SaAkiDatabase();
