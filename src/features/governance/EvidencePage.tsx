import { ExternalLink, ShieldAlert } from 'lucide-react';
import { evidenceSources } from '../../clinical/sources';
import type { EvidenceSource, SourceStatus } from '../../clinical/types';

const statusLabels: Record<SourceStatus, string> = {
  guideline: '指南',
  draft: '公開審查草案',
  consensus: '共識',
  trial: '試驗',
  position: '立場聲明',
  observational: '觀察性研究',
  local: '本機操作規範',
  unverified: '未驗證',
};

function isExecutable(source: EvidenceSource) {
  return source.verification === 'verified'
    && source.status !== 'draft'
    && source.supportedClaims.length > 0;
}

function EvidenceRecord({ source }: { source: EvidenceSource }) {
  const headingId = `source-${source.id}`;
  return <article className="evidence-record" aria-labelledby={headingId}>
    <header className="evidence-record-header">
      <div>
        <h3 id={headingId}>{source.title}</h3>
        <p className="source-id">{source.id}</p>
      </div>
      <span className={`source-status source-status-${source.status}`}>{statusLabels[source.status]}</span>
    </header>
    <dl className="evidence-metadata">
      <div><dt>年份</dt><dd>{source.year === undefined ? '年份：未確認' : `年份：${source.year}`}</dd></div>
      <div><dt>查核</dt><dd>{source.verification === 'verified' ? '查核狀態：已查核' : '查核狀態：未驗證'}</dd></div>
      <div><dt>執行資格</dt><dd>{isExecutable(source) ? '執行資格：僅限列出的規則與範圍' : '執行資格：不可執行'}</dd></div>
      {source.level && <div><dt>來源設計</dt><dd>{source.level}</dd></div>}
      {source.version && <div><dt>版本</dt><dd>{source.version}</dd></div>}
      <div><dt>查核日期</dt><dd>{source.checkedOn}</dd></div>
    </dl>
    <div className="source-links">
      {source.url
        ? <a href={source.url} target="_blank" rel="noreferrer">開啟主要來源<ExternalLink aria-hidden="true" /></a>
        : <p>主要來源：本機操作規範，無外部連結</p>}
      {source.doi && <p>DOI：{source.doi}</p>}
    </div>
    <section className="evidence-scope" aria-label={`${source.title} 適用範圍`}>
      <h4>適用範圍與不確定性</h4>
      <p className="scope-boundary">不確定性：僅限列明範圍；不可外推為未列出的診斷、閾值或治療效益。</p>
      {source.supportedClaims.length > 0
        ? <ul>{source.supportedClaims.map(claim => <li key={`${claim.ruleId}-${claim.scope}`}>
          <strong>{claim.ruleId}</strong>
          <p>{claim.scope}</p>
          {claim.strength && <small>強度／確定性：{claim.strength}</small>}
        </li>)}</ul>
        : <p>範圍：背景脈絡；沒有可執行的支援主張</p>}
      {source.notes && <p className="source-notes"><strong>限制：</strong>{source.notes}</p>}
    </section>
  </article>;
}

export function EvidencePage() {
  return <section className="governance-page evidence-page" aria-labelledby="evidence-heading">
    <div className="governance-intro">
      <h2 id="evidence-heading">證據與版本</h2>
      <p>每筆來源分別呈現出版類型、查核狀態、可支援範圍及執行資格。來源存在不等於可用於所有規則。</p>
      <p className="version-line">臨床內容版本 0.1.0 · 證據查核至 2026-09-21</p>
    </div>
    <div className="governance-warning" role="note">
      <ShieldAlert aria-hidden="true" />
      <div>
        <h3>不可省略的證據限制</h3>
        <p>公開審查草案（Public Review Draft）：非最終指引，不可執行。</p>
        <p>TIGRIS 未驗證：不可執行，且不得用來啟用門檻或療效主張。</p>
        <p>SSC 2026 為條件式反對成人敗血症／敗血性休克常規使用血液淨化及 polymyxin B hemoperfusion（PMX）；HA 僅限受限制的實驗性輔助措施，以及研究、登錄或核准協議脈絡。</p>
        <p>以上狀態不是只靠顏色表達；草案、未驗證及不可執行均有文字標示。</p>
      </div>
    </div>
    <div className="evidence-list">
      {Object.values(evidenceSources).map(source => <EvidenceRecord key={source.id} source={source} />)}
    </div>
  </section>;
}
