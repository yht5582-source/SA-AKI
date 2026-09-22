import { CloudOff, Wifi } from 'lucide-react';

export function OfflinePage() {
  return <section className="governance-page" aria-labelledby="offline-heading">
    <div className="governance-intro">
      <h2 id="offline-heading">離線使用</h2>
      <p>離線能力取決於瀏覽器是否已完成首次載入及服務工作程式安裝。</p>
    </div>
    <section className="governance-section" aria-labelledby="offline-works-heading">
      <h3 id="offline-works-heading"><CloudOff aria-hidden="true" />離線時可用</h3>
      <p>完成首次載入及安裝後，已快取的應用程式介面、治理頁面與此裝置 IndexedDB 中的既有病例可離線開啟。</p>
      <p>離線時仍可在本機建立或編輯匿名病例及匯出 JSON；變更不會同步到任何伺服器。</p>
    </section>
    <section className="governance-section governance-warning" aria-labelledby="network-required-heading">
      <Wifi aria-hidden="true" />
      <div>
        <h3 id="network-required-heading">需要網路或不能保證</h3>
        <p>首次載入、應用程式更新及外部證據／DOI 連結需要網際網路。</p>
        <p>未曾載入或尚未快取的資源可能無法離線開啟；實際離線行為由瀏覽器儲存政策及服務工作程式狀態決定。</p>
        <p>離線快取不是備份；瀏覽器可能清除網站資料，私人瀏覽也可能不保留資料。</p>
      </div>
    </section>
  </section>;
}
