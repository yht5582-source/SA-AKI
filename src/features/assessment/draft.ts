import { z } from 'zod';
import { allFields } from './steps/fields';
const prefix = 'sa-aki:assessment-draft:v1:';
export interface AssessmentDraft { values: Record<string, string>; step: number; haEnabled: boolean }
const schema = z.strictObject({ values: z.record(z.string(), z.string()), step: z.number().int().min(0).max(7), haEnabled: z.boolean() });
export function readDraft(caseId: string): AssessmentDraft {
  try { const parsed = schema.parse(JSON.parse(sessionStorage.getItem(prefix + caseId) ?? 'null'));
    if (Object.keys(parsed.values).every(key => allFields.some(field => field.key === key))) return parsed;
  } catch { /* Corrupt/blocked storage never seeds clinical defaults. */ }
  return { values: {}, step: 0, haEnabled: false };
}
export function writeDraft(caseId: string, draft: AssessmentDraft): boolean {
  try { sessionStorage.setItem(prefix + caseId, JSON.stringify(draft)); return true; } catch { return false; }
}
export function clearAssessmentDrafts(caseId?: string): boolean {
  let cleared = true;
  let keys: string[];
  try { keys = Object.keys(sessionStorage); } catch { return false; }
  for (const key of keys) {
    if (!(caseId ? key === prefix + caseId : key.startsWith(prefix))) continue;
    try { sessionStorage.removeItem(key); } catch { cleared = false; }
  }
  return cleared;
}
