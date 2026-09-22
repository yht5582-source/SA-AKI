import { ArrowRight, BookOpen, ChevronDown, CircleHelp, ExternalLink, FileText, TriangleAlert } from 'lucide-react';

export function DecisionPanel() {
  return <section className="decision-panel" aria-labelledby="judgment-heading">
    <h2 id="judgment-heading"><FileText className="desktop-only" aria-hidden="true" />目前判斷</h2>
    <div className="judgment warning">
      <TriangleAlert className="judgment-icon" aria-hidden="true" />
      <div><strong className="severity-label">需重評</strong><p className="conclusion">資料不足，尚無法完成分期</p><p className="desktop-only provisional">AKI / SA-AKI 判斷待完成</p></div>
    </div>
    <section className="evidence desktop-only">
      <h3>判斷依據</h3>
      <ul><li>SCr 與尿量需雙軌評估</li><li>需確認 sepsis 與 AKI 時間關係</li></ul>
    </section>
    <section className="missing-data">
      <h3><TriangleAlert className="desktop-only" aria-hidden="true" />缺失資料</h3>
      <ol className="desktop-only"><li>基準 SCr 與資料來源</li><li>尿量、觀察時數與體重基準</li><li>Sepsis 與 AKI 起始時間</li></ol>
      <p className="mobile-only">SCr、尿量資料與起始時間</p>
    </section>
    <section className="next-action">
      <h3><span className="next-symbol desktop-only"><ArrowRight aria-hidden="true" /></span>下一步</h3>
      <p className="desktop-only">補齊缺失資料後重新評估</p><p className="mobile-only">補齊資料後重新評估</p>
      <small>重評時間：待臨床確認</small>
    </section>
    <details className="counterfactual desktop-only">
      <summary><CircleHelp aria-hidden="true" />哪些變化會改變判斷？<ChevronDown aria-hidden="true" /></summary>
      <p>補齊缺失資料後重新評估</p>
    </details>
    <div className="evidence-footer desktop-only" id="evidence"><BookOpen aria-hidden="true" /><a href="#evidence-review">查看規則與來源<ExternalLink aria-hidden="true" /></a><small id="evidence-review">內容審查：待完成</small></div>
  </section>;
}
