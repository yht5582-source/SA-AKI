import { Link } from 'react-router-dom';
import type { DecisionResult } from '../../clinical/types';
import { stepFields } from '../assessment/steps/fields';

const fieldTargets: readonly (readonly [string, string])[] = [
  ['血鉀', 'potassiumMmolL'], ['高血鉀', 'potassiumMmolL'], ['arterial pH', 'arterialPh'], ['酸血症', 'arterialPh'], ['肺水腫', 'pulmonaryEdema'], ['尿毒', 'uremicManifestations'],
  ['電解質異常', 'lifeThreateningElectrolyteDisturbance'], ['毒物', 'dialyzableToxin'], ['受控鈉', 'requiresControlledSodiumCorrection'],
  ['MAP', 'mapMmHg'], ['升壓劑', 'norepinephrineEquivalentMcgKgMin'], ['lactate', 'lactateMmolL'], ['顱內壓', 'intracranialPressureRisk'],
  ['血流動力耐受性', 'hemodynamicTolerance'], ['快速溶質清除', 'rapidSoluteClearanceNeeded'], ['精密液體', 'preciseFluidElectrolyteControlNeeded'],
];

function MissingItems({ items, caseId, fallback }: { items: string[]; caseId: string; fallback: string }) {
  return <ul className="krt-missing">{items.map((item, index) => {
    const key = fieldTargets.find(([phrase]) => item.includes(phrase))?.[1] ?? fallback;
    const field = stepFields.flat().find(candidate => candidate.key === key);
    const label = field ? field.label : '相關資料';
    return <li key={`${item}-${index}`}><span>{item}</span><Link to={`/case/${encodeURIComponent(caseId)}/assessment?field=${encodeURIComponent(key)}`} aria-label={`前往填寫${item.includes('血鉀') ? '血鉀' : label}`}>前往填寫</Link></li>;
  })}</ul>;
}

export function KrtPathway({ decisions, caseId }: { decisions: DecisionResult[]; caseId: string }) {
  const aki = decisions.find(result => result.id === 'aki-staging');
  const indication = decisions.find(result => result.id === 'krt-emergency-indications');
  const modality = decisions.find(result => result.id === 'krt-modality-selection');
  if (!aki || !indication || !modality) return null;
  const confirmed = indication.severity === 'critical';
  const danger = indication.conclusion.startsWith('urgent confirmation');
  const positives = indication.evidence.filter(item => /有相符|明確尿毒|臨床已確認|毒理已確認|專科已確認/.test(item));
  return <section className="krt-pathway" aria-label="AKI 與 KRT 決策">
    <h2>AKI → KRT → 模式</h2>
    <div className="krt-pathway-stages">
      <section><h3>1. AKI 評估</h3><p>{aki.conclusion}</p><small>AKI 分期與單次 SCr、BUN、少尿、SOFA 或升壓劑劑量均不構成獨立 KRT 適應症。</small></section>
      <section className={confirmed ? 'krt-urgent' : danger ? 'krt-check' : ''}><h3>2. 是否達 KRT 適應症</h3><p className="krt-answer">{confirmed ? '立即評估 KRT：已有需專科複核的確定危險條件' : danger ? '立即確認 KRT 危險訊號與治療難治性' : indication.conclusion.includes('資料不足') ? '目前無已確立 KRT 適應症；資料不足不等於排除適應症' : '目前無已確立 KRT 適應症；持續監測重評'}</p>
        {positives.length > 0 && <ul>{positives.map(item => <li key={item}>{item}</li>)}</ul>}
        <p>{indication.actions[0]}</p>
      </section>
      <section><h3>3. 若需要 KRT，選哪種模式</h3>{confirmed ? <><p className="krt-answer">{modality.conclusion}</p><p>CRRT 用於循環不穩、顱內壓風險或需要精密液體／電解質控制等情境的團隊討論；若快速清除需求與腦／循環風險衝突，需專科權衡。</p>
        {modality.conclusion.includes('CRRT review') && <details><summary>CRRT 機制怎麼選？</summary><ul><li>CVVHD：以擴散清除小分子溶質為主。</li><li>CVVH：以對流清除為主。</li><li>CVVHDF：結合擴散與對流；無已證實存活優勢。</li><li>SCUF：以液體移除為主，不提供充分溶質清除；有酸鹼／電解質清除需求時不能以 SCUF 取代。</li></ul><p>實際選擇需核對溶質、液體目標、交付劑量、抗凝和本院設備；非機器處方。</p></details>}
      </> : <p className="krt-answer">尚不選定 KRT 模式；先處理危險訊號並確認適應症。模式偏好不能成為啟動理由。</p>}</section>
    </div>
    {(indication.missingData.length > 0 || modality.missingData.length > 0) && <div className="krt-pathway-missing"><h3>待補資料</h3><p>已儲存時間點保留唯讀；從以下入口新增觀察。未知不等於正常，危急處置不等待填表。</p>
      {indication.missingData.length > 0 && <><h4>KRT 適應症</h4><MissingItems items={indication.missingData} caseId={caseId} fallback="potassiumMmolL"/></>}
      {modality.missingData.length > 0 && <><h4>模式評估（僅在 KRT 指徵確認後使用）</h4><MissingItems items={modality.missingData} caseId={caseId} fallback="hemodynamicTolerance"/></>}
    </div>}
    <p className="krt-pathway-caveat">參考 KDIGO 與 SSC 2026；本機危險篩檢值與重評時限不是指引認定的啟動門檻。所有選項均需床邊複核，不能自動啟動或設定機器。</p>
  </section>;
}
