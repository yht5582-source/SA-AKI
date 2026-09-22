export function ChangelogPage() {
  return <section className="governance-page" aria-labelledby="changelog-heading">
    <div className="governance-intro">
      <h2 id="changelog-heading">版本紀錄</h2>
      <p>臨床內容、證據與安全邊界的可追溯變更摘要。</p>
    </div>
    <section className="governance-section" aria-labelledby="unreleased-heading">
      <h3 id="unreleased-heading">未發布</h3>
      <p>同一事件／給藥／TDM 的衝突修訂只計一次，爭議細節維持未知，不誤判為反覆事件；歷史用藥監測卡與來源不確定警示並存，不能據此授權治療或自動調整劑量。</p>
      <p>修正跨時點 HA 療程追蹤：未重填不等於停機，明確停止會保留；重複／衝突需立即重評，歷史給藥、TDM 與不良事件不會因後續省略而消失。</p>
      <p>補齊 CRRT 算式／RCA 的明確評估輸入與五項確認，以及呼吸、P/F、VExUS、尿毒併發症、ECMO 抗凝及 HA 暴露紀錄；保留未知與非自動醫囑界線。新增欄位與 schema version 1 相容。</p>
      <p>導覽快取依頁面版本分開，避免離線更新後引用舊程式檔；真實瀏覽器與畫面驗證仍須通過發布閘門。</p>
      <p>更正儲存揭露：區分 IndexedDB 已確認病例／時間點與目前分頁 sessionStorage 未確認評估草稿，並說明草稿生命週期、清除為盡力而為及清除失敗警示；臨床規則未變更。</p>
    </section>
    <section className="governance-section" aria-labelledby="version-010-heading">
      <h3 id="version-010-heading">0.1.0 — 2026-09-21</h3>
      <ul>
        <li>建立 KDIGO 2012、KDIGO 2026 Public Review Draft、SSC 2026、ADQI、Sepsis-3、ELSO、試驗、觀察性研究與本機操作規範的版本化證據登錄。</li>
        <li>新增草案與未驗證來源的不可執行防線，並將來源支援限制在列明規則與範圍。</li>
        <li>新增成人限定、兒科／孕婦／新生兒排除與非緊急服務警示。</li>
        <li>新增診斷、液體、KRT／模式／ECMO、CRRT 處方、HA、脫離、軌跡、病例、評估、儀表板、趨勢、交班與本機匯入／匯出模組。</li>
        <li>明確標示 SSC 2026 對常規血液淨化／PMX 的條件式反對，以及 HA 的受限制實驗性輔助／研究／登錄脈絡。</li>
      </ul>
    </section>
  </section>;
}
