import { z } from 'zod';
import { allFields } from './steps/fields';
import { toTaipeiInput } from '../../clinical/taipeiTime';
const prefix = 'sa-aki:assessment-draft:v1:';
export interface AssessmentDraft { values: Record<string, string>; step: number; haEnabled: boolean; timeZone?: 'Asia/Taipei'; legacyTimeInstants?: Record<string, string> }
const schema = z.strictObject({ values: z.record(z.string(), z.string()), step: z.number().int().min(0).max(7), haEnabled: z.boolean(), timeZone: z.literal('Asia/Taipei').optional(), legacyTimeInstants: z.record(z.string(), z.string()).optional() });
export function readDraft(caseId: string): AssessmentDraft {
  try { const parsed = schema.parse(JSON.parse(sessionStorage.getItem(prefix + caseId) ?? 'null'));
    if (Object.keys(parsed.values).every(key => allFields.some(field => field.key === key))) {
      if (parsed.timeZone) return parsed;
      const values = { ...parsed.values }, legacyTimeInstants: Record<string, string> = {};
      for (const field of allFields.filter(field => field.type === 'datetime-local')) {
        const raw = values[field.key];
        if (!raw) continue;
        const instant = Date.parse(`${raw}Z`);
        if (!Number.isFinite(instant)) continue;
        legacyTimeInstants[field.key] = new Date(instant).toISOString();
        values[field.key] = toTaipeiInput(legacyTimeInstants[field.key]);
      }
      return { ...parsed, values, timeZone: 'Asia/Taipei', legacyTimeInstants };
    }
  } catch { /* Corrupt/blocked storage never seeds clinical defaults. */ }
  return { values: {}, step: 0, haEnabled: false, timeZone: 'Asia/Taipei' };
}
export function writeDraft(caseId: string, draft: AssessmentDraft): boolean {
  try { sessionStorage.setItem(prefix + caseId, JSON.stringify({ ...draft, timeZone: 'Asia/Taipei' })); return true; } catch { return false; }
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
