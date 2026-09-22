import { CalendarDays, ChevronDown, FileText, Pencil } from 'lucide-react';

function Measurement({ label, unit, name, className = '' }: { label: string; unit: string; name: string; className?: string }) {
  return <div className={`measurement ${className}`}>
    <label htmlFor={name}>{label}</label>
    <div className="input-unit"><input id={name} name={name} type="number" min="0" step="any" placeholder="—" aria-label={label} /><span>{unit}</span></div>
    {name === 'baseline' && <small className="baseline-helper desktop-only">來源與可信度尚未記錄</small>}
  </div>;
}

export function ClinicalInputs() {
  return <section className="input-panel" id="assessment" aria-labelledby="input-heading">
    <h2 id="input-heading" className="desktop-only"><Pencil aria-hidden="true" />目前輸入</h2>
    <div className="module-tabs desktop-only" aria-label="評估模組">
      <span aria-current="step">AKI</span><button disabled>灌流</button><button disabled>KRT</button>
    </div>
    <h3>腎功能與尿量</h3>
    <p className="mobile-only input-intro">請記錄數值、觀察時數與體重基準</p>
    <form className="clinical-form" autoComplete="off">
      <div className="measurement-grid">
        <Measurement name="baseline" label="基準 SCr" unit="mg/dL" className="wide" />
        <Measurement name="creatinine" label="目前 SCr" unit="mg/dL" className="wide" />
        <Measurement name="urine" label="尿量" unit="mL" className="wide" />
        <Measurement name="hours" label="觀察時數" unit="h" />
        <Measurement name="weight" label="體重基準" unit="kg" />
        <div className="measurement diuretic wide">
          <label htmlFor="diuretic">利尿劑使用</label>
          <div className="select-wrap"><select id="diuretic" aria-label="利尿劑使用" defaultValue=""><option value="">尚未記錄</option></select><ChevronDown aria-hidden="true" /></div>
        </div>
      </div>
      <small className="mobile-only mobile-provenance">基準 SCr 來源與可信度尚未記錄</small>
      <div className="time-inputs desktop-only">
        <h3>時間關係</h3>
        <label>Sepsis 起始時間<div className="date-input"><input type="datetime-local" aria-label="Sepsis 起始時間" /><CalendarDays aria-hidden="true" /></div></label>
        <label>AKI 起始時間<div className="date-input"><input type="datetime-local" aria-label="AKI 起始時間" /><CalendarDays aria-hidden="true" /></div></label>
      </div>
      <a className="button outline fill desktop-only" href="#baseline"><FileText aria-hidden="true" />補齊評估資料</a>
    </form>
  </section>;
}
