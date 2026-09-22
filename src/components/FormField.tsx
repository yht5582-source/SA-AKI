import { useId } from 'react';

export interface FieldDefinition {
  key: string; label: string; type: 'number' | 'boolean' | 'select' | 'numeric-select' | 'multi-select' | 'json' | 'datetime-local' | 'text';
  unit?: string; help?: string; example?: string; options?: readonly (readonly [string, string])[];
}
export function FormField({ field, value, error, onChange, disabled = false }: {
  field: FieldDefinition; value: string; error?: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const shared = { id, value, disabled, 'aria-describedby': `${id}-help${error ? ` ${id}-error` : ''}`, 'aria-invalid': !!error, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  if (field.type === 'multi-select') {
    let selected: string[] = [];
    try { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) selected = parsed; } catch { /* Unknown is not an explicitly negative assessment. */ }
    return <fieldset className="workflow-field multi-field" disabled={disabled} aria-describedby={`${id}-help`}><legend>{field.label}</legend>
      <p>{value === '' ? '未知／尚未評估' : selected.length === 0 ? '已明確評估未見' : '已記錄的明確表現'}</p>
      {field.options?.map(([key, label]) => <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={event => onChange(JSON.stringify(event.target.checked ? [...selected, key] : selected.filter(item => item !== key)))}/>{label}</label>)}
      <div className="workflow-actions"><button type="button" className="button" onClick={() => onChange('[]')}>{field.label}：已評估未見</button><button type="button" className="button" onClick={() => onChange('')}>{field.label}：清除為未知</button></div>
      <small id={`${id}-help`}>{field.help}</small>{error && <span className="field-error" role="alert">{error}</span>}
    </fieldset>;
  }
  return <div className={`workflow-field${field.type === 'json' ? ' json-field' : ''}`}><label htmlFor={id}>{field.label}</label>
    {field.type === 'boolean' || field.type === 'select' || field.type === 'numeric-select' ? <select {...shared}><option value="">未知／尚未記錄</option>{(field.type === 'boolean' ? [['true', '是'], ['false', '否']] : field.options ?? []).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      : field.type === 'json' ? <textarea {...shared} rows={5} spellCheck={false}/>
      : <input {...shared} type={field.type} step={field.type === 'number' ? 'any' : field.type === 'datetime-local' ? '0.001' : undefined} />}
    <small id={`${id}-help`}>{field.unit ? `${field.unit} · ` : ''}{field.help ?? '未確認請留空；未知不等於否。'}</small>
    {field.example && <details><summary>結構範例（格式示意，不會帶入資料）</summary><pre>{field.example}</pre></details>}
    {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
  </div>;
}
