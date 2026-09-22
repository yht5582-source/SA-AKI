import { useState } from 'react';
import { caseRepository } from '../../data/caseRepository';
import { FormField, type FieldDefinition } from '../../components/FormField';
import { patientCaseSchema } from '../../data/schema';
import type { PatientCase } from '../../clinical/types';

const fields: FieldDefinition[] = [
  { key: 'ageRange', label: '成人年齡區間', type: 'select', options: [['18-39', '18–39'], ['40-64', '40–64'], ['65-79', '65–79'], ['80-plus', '80 以上']] },
  { key: 'baselineCreatinineMgDl', label: '基準 SCr', type: 'number', unit: 'mg/dL', help: '可接受範圍：≥ 0；未知請留空。' },
  { key: 'baselineCreatinineSource', label: '基準 SCr 來源', type: 'select', options: [['measured-outpatient', '門診實測'], ['measured-inpatient', '住院實測'], ['estimated', '估計'], ['back-calculated', '回推']] },
  { key: 'baselineCreatinineConfidence', label: '基準 SCr 可信度', type: 'select', options: [['high', '高'], ['moderate', '中'], ['low', '低']] },
  { key: 'baselineCreatinineTimestamp', label: '基準 SCr 時間（UTC）', type: 'datetime-local', help: 'UTC 時間；未知請留空。' },
  { key: 'sepsisOnsetTimestamp', label: 'Sepsis 起始時間（UTC）', type: 'datetime-local', help: 'UTC 時間；未知請留空。' },
  { key: 'shockOnsetTimestamp', label: '休克起始時間（UTC）', type: 'datetime-local', help: 'UTC 時間；不得早於 Sepsis 起始時間。' },
];

export function CaseForm({ onCreated, onCancel, initial }: { onCreated: (id: string) => void; onCancel: () => void; initial?: PatientCase }) {
  const [values, setValues] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const candidate: Record<string, unknown> = initial ? { ...initial } : { id: 'draft', anonymousCode: 'draft' };
  const display: Record<string, string> = {};
  for (const field of fields) {
    const original = initial?.[field.key as keyof PatientCase];
    display[field.key] = original === undefined ? '' : field.type === 'datetime-local' ? new Date(String(original)).toISOString().slice(0, -1) : String(original);
    if (Object.hasOwn(values, field.key)) {
      const raw = values[field.key]; display[field.key] = raw;
      if (!raw) delete candidate[field.key];
      else candidate[field.key] = field.type === 'number' ? Number(raw) : field.type === 'datetime-local' && Number.isFinite(Date.parse(raw + 'Z')) ? new Date(raw + 'Z').toISOString() : raw;
    }
  }
  const validation = patientCaseSchema.safeParse(candidate);
  const errors: Record<string, string> = {};
  if (!validation.success) for (const issue of validation.error.issues) errors[issue.path.join('.')] = '請依範圍及時間關係輸入有效資料。';
  return <form aria-label={initial ? '編輯匿名病例' : '建立匿名病例'} onSubmit={async event => {
    event.preventDefault(); if (busy || !validation.success) return; setBusy(true); setError('');
    try {
      const id = initial?.id ?? crypto.randomUUID();
      if (initial) await caseRepository.updateCase(validation.data);
      else await caseRepository.createCase({ ...validation.data, id, anonymousCode: `A-${id.slice(0, 8).toUpperCase()}` });
      onCreated(id);
    } catch { setError(initial ? '更新失敗：資料或時間關係與既有時間點衝突，或本機儲存失敗；原有資料未變更。' : '無法建立病例；請確認本機儲存空間。'); setBusy(false); }
  }}><h2>{initial ? `編輯匿名病例 ${initial.anonymousCode}` : '建立匿名病例'}</h2><p>僅限成人；請勿輸入姓名、病歷號或任何可識別資料。</p>{initial && <p>更新前會檢查所有既有時間點；不會重算或覆寫已儲存觀察。</p>}
    <div className="assessment-fields">{fields.map(field => <FormField key={field.key} field={field} value={display[field.key]} error={errors[field.key]} onChange={value => setValues(current => ({ ...current, [field.key]: value }))}/>)}</div>
    {error && <p role="alert">{error}</p>}<div className="workflow-actions"><button className="button primary" disabled={busy}>{initial ? '確認更新病例' : '建立病例'}</button><button type="button" className="button" disabled={busy} onClick={onCancel}>取消</button></div>
  </form>;
}
