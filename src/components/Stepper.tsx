export function Stepper({ labels, current, onChange }: { labels: readonly string[]; current: number; onChange: (index: number) => void }) {
  return <><div className="assessment-progress" role="progressbar" aria-label="評估進度" aria-valuemin={1} aria-valuemax={8} aria-valuenow={current + 1}><span>步驟 {current + 1} / 8</span><div>{labels.map((label, index) => <i key={label} className={index <= current ? 'filled' : ''}/>)}</div></div>
    <nav className="assessment-steps" aria-label="評估步驟">{labels.map((label, index) => <button key={label} type="button" aria-current={index === current ? 'step' : undefined} onClick={() => onChange(index)}>{label}</button>)}</nav></>;
}
