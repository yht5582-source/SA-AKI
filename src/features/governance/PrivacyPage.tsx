import { LockKeyhole, TriangleAlert } from 'lucide-react';

export function PrivacyPage() {
  return <section className="governance-page" aria-labelledby="privacy-heading">
    <div className="governance-intro">
      <h2 id="privacy-heading">隱私與資料</h2>
      <p>已確認儲存的匿名病例與時間點存放於此瀏覽器設定檔的 IndexedDB。</p>
      <p>尚未確認的評估草稿值存放於目前分頁／瀏覽工作階段的 sessionStorage，尚未寫入病例或時間點。</p>
      <p>本應用程式沒有後端、帳號、分析或遙測服務。</p>
    </div>
    <section className="governance-section" aria-labelledby="draft-lifecycle-heading">
      <h3 id="draft-lifecycle-heading">草稿生命週期與清除範圍</h3>
      <p>sessionStorage 草稿通常可在同一分頁重新載入後恢復；關閉分頁或瀏覽工作階段、清除網站資料或瀏覽器自動清理可能使草稿消失。是否在工作階段還原後保留由瀏覽器決定。</p>
      <p>時間點成功儲存後，應用程式會嘗試清除該病例在目前分頁的評估草稿。</p>
      <p>病例刪除成功後會從 IndexedDB 永久刪除該病例與時間點，並嘗試清除該病例在目前分頁的草稿；「清除全部本機資料」成功後會從 IndexedDB 清除所有病例與時間點，並嘗試清除目前分頁的所有 SA-AKI 評估草稿。</p>
      <p>上述 sessionStorage 清除僅為盡力而為；瀏覽器或儲存體拒絕／錯誤可能使草稿仍留在目前分頁。使用共用裝置時，完成後請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。</p>
      <p>離開評估頁、返回病例清單、取消刪除或取消清除全部，都不會清除評估草稿；目前沒有獨立的「捨棄草稿」按鈕。</p>
      <p>其他已開啟分頁有各自的 sessionStorage；本分頁的刪除或清除動作不能清除其他分頁的草稿。</p>
    </section>
    <section className="governance-section" aria-labelledby="minimum-data-heading">
      <h3 id="minimum-data-heading"><LockKeyhole aria-hidden="true" />資料最小化</h3>
      <p>只可使用匿名病例代碼；禁止輸入姓名、病歷號、電話、地址或其他可直接識別個人的資料。</p>
      <p>匿名代碼本身不保證無法重新識別。請依所在地法規、機構政策及最小必要原則處理資料。</p>
    </section>
    <section className="governance-section governance-warning" aria-labelledby="threat-model-heading">
      <TriangleAlert aria-hidden="true" />
      <div>
        <h3 id="threat-model-heading">裝置、匯出與刪除風險</h3>
        <p>JSON 匯出檔可能包含敏感健康資料；使用者須自行負責安全儲存、傳送、匯入及刪除。</p>
        <p>能存取此裝置、瀏覽器設定檔或仍開啟之分頁工作階段的人，可能讀取已儲存病例、未確認草稿與匯出檔。</p>
        <p>刪除應用程式內病例不會刪除已下載、複製、備份或分享的 JSON 檔。</p>
        <p>清除瀏覽器網站資料、使用私人瀏覽或瀏覽器自動清理，可能永久移除本機資料。</p>
        <p>本應用程式不宣稱提供應用層加密；請使用受管理、已加密且有存取控制的裝置。</p>
      </div>
    </section>
  </section>;
}
