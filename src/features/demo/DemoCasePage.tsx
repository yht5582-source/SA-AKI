import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { zh } from '../../clinical/display';
import type { ClinicalSnapshot } from '../../clinical/types';
import { caseRepository } from '../../data/caseRepository';
import { clearAssessmentDrafts } from '../assessment/draft';
import { demoCases, demoExport, findDemoCase, type DemoCase } from './demoCases';
import { evaluateDemoTimepoint } from './evaluateDemo';

function keyValues(s: ClinicalSnapshot): [string, string][] {
  const rows: [string, string | undefined][] = [
    ['SCr', s.creatinineMgDl === undefined ? undefined : `${s.creatinineMgDl} mg/dL`],
    ['BUN', s.bunMgDl === undefined ? undefined : `${s.bunMgDl} mg/dL`],
    ['尿量', s.urineVolumeMl === undefined ? undefined : `${s.urineVolumeMl} mL / ${s.urineObservationHours} h${s.urineNormalizationWeightKg ? `（${(s.urineVolumeMl / s.urineObservationHours! / s.urineNormalizationWeightKg).toFixed(2)} mL/kg/h）` : ''}`],
    ['血鉀', s.potassiumMmolL === undefined ? undefined : `${s.potassiumMmolL} mmol/L${s.refractoryHyperkalemia ? '（難治）' : ''}`],
    ['pH／HCO₃', s.arterialPh === undefined ? undefined : `${s.arterialPh}／${s.bicarbonateMmolL ?? '未知'}${s.refractoryAcidemia ? '（難治）' : ''}`],
    ['MAP', s.mapMmHg === undefined ? undefined : `${s.mapMmHg} mmHg`],
    ['NE 當量', s.norepinephrineEquivalentMcgKgMin === undefined ? undefined : `${s.norepinephrineEquivalentMcgKgMin} mcg/kg/min（${zh(s.vasopressorTrend)}）`],
    ['乳酸', s.lactateMmolL === undefined ? undefined : `${s.lactateMmolL} mmol/L`],
    ['CRT', s.capillaryRefillSeconds === undefined ? undefined : `${s.capillaryRefillSeconds} 秒`],
    ['PLR', s.passiveLegRaiseResult === undefined ? undefined : `${zh(s.passiveLegRaiseResult)}，VTI +${s.vtiResponsePercent ?? '?'}%`],
    ['肺水腫', s.pulmonaryEdema === undefined ? undefined : `${zh(s.pulmonaryEdema)}${s.refractoryPulmonaryEdema ? '（難治）' : ''}`],
    ['B-lines／VExUS', s.lungBLines === undefined ? undefined : `${zh(s.lungBLines)}／${s.vexusGrade ?? '未知'}`],
    ['P/F', s.pao2Fio2RatioMmHg === undefined ? undefined : `${s.pao2Fio2RatioMmHg} mmHg（${zh(s.respiratorySupport)}）`],
    ['累積平衡', s.cumulativeFluidBalanceMl === undefined ? undefined : `${s.cumulativeFluidBalanceMl > 0 ? '+' : ''}${s.cumulativeFluidBalanceMl} mL`],
    ['尿毒併發症', s.uremicManifestations?.includes('pericarditis') ? '心包炎' : undefined],
    ['耐受性標記', s.hemodynamicTolerance === undefined ? undefined : zh(s.hemodynamicTolerance)],
    ['CRRT', s.crrtMode === undefined ? undefined : s.crrtStoppedTimestamp ? `${s.crrtMode}（試停中）` : s.crrtMode],
  ];
  return rows.filter((row): row is [string, string] => row[1] !== undefined);
}

export function DemoCasePage() {
  const { demoId } = useParams();
  const demo = findDemoCase(demoId);
  if (!demo) return <p role="alert">找不到示範病例。<Link to="/demo">回到示範病例</Link></p>;
  return <DemoWalkthrough key={demo.id} demo={demo}/>;
}

function DemoWalkthrough({ demo }: { demo: DemoCase }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const point = demo.timepoints[index];
  const shown = revealed.has(index);
  const { outputs } = useMemo(() => evaluateDemoTimepoint(demo, index), [demo, index]);
  const position = demoCases.indexOf(demo);
  const next = demoCases[position + 1];

  useEffect(() => {
    let active = true;
    void caseRepository.getCase(demo.id).then(stored => { if (active) setLoaded(!!stored); }).catch(() => undefined);
    return () => { active = false; };
  }, [demo.id]);

  const go = (target: number) => { setIndex(target); setMessage(''); heading.current?.focus(); };
  async function openDashboard() {
    try {
      if (!await caseRepository.getCase(demo.id)) await caseRepository.importCase(demoExport(demo));
      navigate(`/case/${encodeURIComponent(demo.id)}`);
    } catch { setMessage('無法載入示範病例；請確認本機儲存空間。'); }
  }
  async function restore() {
    try {
      await caseRepository.deleteCase(demo.id);
      clearAssessmentDrafts(demo.id);
      await caseRepository.importCase(demoExport(demo));
      setLoaded(true); setMessage('已還原為原始示範資料。');
    } catch { setMessage('無法還原示範病例；請確認本機儲存空間。'); }
  }

  return <section className="learning-page" aria-labelledby="demo-case-heading">
    <p className="learning-crumb"><Link to="/demo">示範病例</Link> / T{position + 1}</p>
    <div className="learning-intro">
      <h2 id="demo-case-heading">{demo.title}</h2>
      <p>{demo.oneLine}</p>
      <p className="learning-note">虛構教學病例・{demo.patient.ageRange?.replace('-', '–')} 歲・{demo.patient.sex === 'male' ? '男' : '女'}・{demo.patient.actualWeightKg} kg・基準 SCr {demo.patient.baselineCreatinineMgDl} mg/dL</p>
    </div>
    <nav className="demo-steps" aria-label="病程時間點">
      {demo.timepoints.map((item, itemIndex) => <button key={item.label} className={itemIndex === index ? 'current' : ''} aria-current={itemIndex === index ? 'step' : undefined} onClick={() => go(itemIndex)}>{item.label}</button>)}
    </nav>
    <div className="demo-layout">
      <div className="demo-bedside">
        <h3 ref={heading} tabIndex={-1}>{point.label}</h3>
        <p>{point.story}</p>
        <dl className="demo-values">{keyValues(point.snapshot).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </div>
      <div className="demo-thinking">
        <div className="demo-prompt"><h3>先想一想</h3><p>{point.prompt}</p></div>
        {!shown && <button className="button primary" onClick={() => setRevealed(current => new Set(current).add(index))}>看工具的判斷</button>}
        {shown && <div className="demo-reveal">
          <h3>工具的判斷</h3>
          <dl className="demo-outputs">{outputs.map(output => <div key={output.label} className={output.tone ? `tone-${output.tone}` : undefined}><dt>{output.label}</dt><dd>{output.text}</dd></div>)}</dl>
          <div className="demo-teaching"><h3>為什麼</h3><p>{point.teaching}</p></div>
          {index < demo.timepoints.length - 1
            ? <button className="button primary" onClick={() => go(index + 1)}>下一個時間點：{demo.timepoints[index + 1].label}</button>
            : <div className="demo-summary"><h3>帶走這幾點</h3><ul>{demo.learningPoints.map(item => <li key={item}>{item}</li>)}</ul></div>}
        </div>}
      </div>
    </div>
    <div className="workflow-actions demo-actions">
      <button className="button" onClick={() => void openDashboard()}>在決策首頁開啟完整結果</button>
      {loaded && <button className="button" onClick={() => void restore()}>還原示範資料</button>}
      {next ? <Link className="button" to={`/demo/${next.id}`}>下一個病例</Link> : <Link className="button" to="/quiz">開始 20 題測驗</Link>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
