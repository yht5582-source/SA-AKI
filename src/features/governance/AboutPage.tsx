import { ExternalLink, ShieldCheck } from 'lucide-react';

export function AboutPage() {
  return <section className="governance-page" aria-labelledby="about-heading">
    <div className="governance-intro">
      <h2 id="about-heading">關於與治理</h2>
      <p>SA-AKI Clinical Navigator 是本機優先的成人臨床決策支援工具，用來整理觀察、資料缺口、證據與重評提示。</p>
      <p><strong>僅供成人醫護人員使用；不適用於兒科、孕婦及新生兒。</strong></p>
      <p><strong>本應用程式不是緊急服務、不是自動醫囑，也不能取代臨床判斷。</strong></p>
    </div>
    <section className="governance-section" aria-labelledby="version-heading">
      <h3 id="version-heading">內容版本與操作慣例</h3>
      <p>臨床內容版本：0.1.0；證據查核日期：2026-09-21。</p>
      <p>所有本機操作閾值與時間上限都必須視為保守的工作流程慣例，不是經驗證的治療閾值。</p>
      <p>本機規則只能在其列明的資料、來源與範圍內使用；缺失、衝突、過期或未驗證資訊必須維持不確定並交由臨床人員覆核。</p>
    </section>
    <section className="governance-section" aria-labelledby="limitations-heading">
      <h3 id="limitations-heading">已知排除與限制</h3>
      <ul>
        <li>不涵蓋兒科、妊娠、新生兒、院前急救或非成人照護。</li>
        <li>不控制醫療設備、不開立或傳送醫囑、不取代床邊評估及機構流程。</li>
        <li>不提供個人死亡率、腎臟恢復機率或已驗證的預後計算。</li>
        <li>HA 並非常規照護路徑；只能在使用者主動選擇且符合研究、登錄或核准協議治理時進入受限制覆核。</li>
      </ul>
    </section>
    <section className="governance-section report-section" aria-labelledby="report-heading">
      <h3 id="report-heading"><ShieldCheck aria-hidden="true" />回報差異</h3>
      <p>如發現來源版本、引文、規則範圍、安全文字或實作與臨床內容不一致，請停止依賴受影響輸出，記錄應用程式版本、匿名重現步驟及來源，並提交問題。</p>
      <a href="https://github.com/yht5582-source/SA-AKI/issues" target="_blank" rel="noreferrer">在 GitHub 回報證據或安全差異<ExternalLink aria-hidden="true" /></a>
    </section>
  </section>;
}
