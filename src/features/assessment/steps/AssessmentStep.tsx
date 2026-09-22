import { FormField, type FieldDefinition } from '../../../components/FormField';
export function AssessmentStep({ fields, values, errors, onChange, disabled = false }: { fields: FieldDefinition[]; values: Record<string, string>; errors: Record<string, string>; onChange: (key: string, value: string) => void; disabled?: boolean }) {
  return <div className="assessment-fields">{fields.map(field => <FormField key={field.key} field={field} value={values[field.key] ?? ''} error={values[field.key] ? errors[field.key] : undefined} onChange={value => onChange(field.key, value)} disabled={disabled}/>)}</div>;
}
