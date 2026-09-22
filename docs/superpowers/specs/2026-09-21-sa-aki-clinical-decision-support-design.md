# SA-AKI 臨床決策支援系統設計規格

日期：2026-09-21  
Repository：`yht5582-source/SA-AKI`  
狀態：已核准設計，待使用者審閱書面規格

## 1. 產品目的

建立一套成人臨床醫護專用的 sepsis-associated acute kidney injury（SA-AKI）互動式決策支援工具，協助 ICU、腎臟科、急診與 NP 團隊：

- 正確辨識 sepsis、AKI 與 SA-AKI 的時間關係。
- 以 serum creatinine 與 urine output 雙軌完成 KDIGO 分期。
- 追蹤 0–72 小時病程，而非只做單點判斷。
- 區分 fluid responsiveness、fluid tolerance、congestion 與 shock phenotype。
- 判斷何時需要 KRT、何時可 deferred observation，以及多久必須重評。
- 選擇 IHD、PIRRT、CRRT 與 CRRT 模式，並支援成人 ECMO 情境。
- 建立 CRRT 處方、安全檢查、治療監測與 liberation 評估。
- 在難治性敗血性休克情境提供 hemoadsorption（HA）候選評估、裝置匹配、監測與停損支援。
- 以透明、可追溯的規則說明判斷依據、缺失資料與不確定性。

本系統是臨床決策支援工具，不是醫療器材認證產品、自動醫囑系統或取代床邊判斷的黑箱模型。

## 2. 使用者與適用範圍

### 2.1 主要使用者

- 成人 ICU、急診與急性病房醫師。
- 腎臟科、重症醫學科與感染科團隊。
- 經院內授權的 NP、護理師、藥師及體外循環／ECMO 團隊。

### 2.2 納入範圍

- 成人 sepsis 或 septic shock。
- AKI、SA-AKI、AKD 與 CRRT 評估。
- 成人 ECMO 合併 AKI／CRRT。
- 與 SA-AKI／septic shock 相關的研究性或極少數救援性 HA 評估。
- 手動輸入的匿名病例與連續時間點。

### 2.3 排除範圍

- 兒科、孕婦及新生兒。
- 直接連接 HIS、FHIR、雲端病歷或可識別病人資料。
- 自動產生或傳送可執行醫囑。
- AI 自由文字診療建議。
- 取代 nephrology／critical care consultation。

## 3. 指導原則與證據治理

1. 正式指引優先於立場文、回顧文章或院內操作門檻。
2. 每條建議需標示來源、年份、證據層級與內容版本。
3. KDIGO 2026 AKI/AKD 若仍是 public review draft，介面必須清楚標示為草案，不得呈現為最終正式指引。
4. ADQI 28 用於 SA-AKI 的定義、病程、fluid stewardship、biomarker 與 extracorporeal blood purification 框架。
5. SSC 2026 用於 sepsis、shock、抗菌藥、感染源控制、液體、升壓劑、類固醇及血液淨化立場。
6. CRRT 啟動、劑量、抗凝、液體移除與 liberation 規則須區分：正式建議、觀察性訊號、專家框架、院內操作值。
7. SSC 2026 對 sepsis／septic shock 的 blood purification 與 polymyxin B hemoperfusion 均為條件式不建議；HA 不得進入常規路徑，只能呈現為研究／登錄優先或嚴格治理的救援選項。
8. ADQI 30 將現代 HA 視為實驗性介入，且沒有提出可直接套用的臨床實務建議；裝置、表型、時機與療程不得互相外推。
9. 所有規則變更記錄於 changelog；介面顯示臨床內容版本與最後審查日。

核心 HA 證據來源包括：SSC 2026 正式建議、ADQI 30 hemoadsorption consensus、Molnar 等 2026 Critical Care position statement、TIGRIS phase 3 trial，以及 ADQI 28 SA-AKI consensus。實作時每條 HA 規則須連結至其中一項來源，並標記為 guideline、consensus、trial、position statement 或 local operational rule。

## 4. 技術架構

### 4.1 前端與部署

- React + TypeScript + Vite。
- Progressive Web App，可安裝、可離線讀取及操作既有規則。
- GitHub Pages 靜態部署，base path 為 `/SA-AKI/`。
- 預期網址：`https://yht5582-source.github.io/SA-AKI/`。
- 不使用後端、登入、第三方分析追蹤或遠端資料庫。

### 4.2 模組邊界

臨床規則以純 TypeScript 函式實作，不得寫入 React 元件：

- `diagnosis`：Sepsis-3、AKI、SA-AKI 時間軸、KDIGO stage、baseline confidence。
- `differential`：可逆因素與替代診斷提示。
- `fluid`：ROSE phase、responsiveness、tolerance、congestion、fluid plan。
- `crrt-initiation`：緊急適應症、deferred strategy、重評時間。
- `modality`：IHD／PIRRT／CRRT、CVVHD／CVVH／CVVHDF、ECMO pathway。
- `prescription`：dose、weight basis、filtration fraction、UFNET、fluid composition、anticoagulation。
- `hemoadsorption`：HA eligibility gate、5 Rights、biomarker、device matching、time-limited trial、drug monitoring、stop rules。
- `liberation`：每日停機評估、trial-off 與重啟條件。
- `prognosis`：trajectory、renal recovery、MAKE30/90 與不確定性。

每個規則模組回傳統一結構：

- `severity`：critical、warning、monitor、stable。
- `conclusion`：目前判斷。
- `evidence`：觸發判斷的輸入與規則。
- `missingData`：會影響可信度的缺失資料。
- `actions`：下一步與重評時間。
- `counterfactuals`：哪些改變會讓建議升級或降級。
- `sources`：來源識別與證據層級。

### 4.3 資料保存

- 使用 IndexedDB 保存匿名病例、時間點及使用者自訂的設備設定。
- 不允許姓名、病歷號、完整生日、電話或地址欄位。
- 病例以使用者自訂匿名代碼識別。
- 支援 JSON 匯出、JSON 匯入、單筆刪除與全部清除。
- 匯入時執行 schema validation 與版本遷移；錯誤資料不得污染既有病例。

## 5. 資料模型

### 5.1 病例層級

- 匿名病例代碼。
- 年齡範圍、sex、身高、actual／ideal／adjusted body weight。
- CKD stage、baseline creatinine 來源與日期、共病。
- 感染起點、sepsis time zero、shock time zero。
- ECMO 類型、啟動時間、迴路與抗凝基本資料。

### 5.2 時間點層級

- 時間戳與距 sepsis onset 小時數。
- SCr、BUN、尿量、觀察時數、是否使用利尿劑。
- MAP、heart rate、NE-equivalent、lactate、CRT、意識與灌流指標。
- 輸入、輸出、淨平衡、累積平衡、體重變化。
- POCUS／hemodynamic：PLR、VTI/SV response、LV/RV、B-lines、IVC、VExUS/CVP。
- pH、HCO3、K、Na、iCa、Mg、P、glucose、uremic manifestations。
- 呼吸支持、PaO2/FiO2、肺水腫與顱壓風險。
- SOFA components、感染源控制狀態、抗菌藥時間。
- CRRT 模式、處方與 delivered dose、downtime、UFNET、filter life、抗凝與不良事件。
- HA 評估資料：IL-6、EAA、CRP、PCT、ferritin、platelet、fibrinogen、D-dimer、albumin、SOFA／MODS、source-control 狀態與升壓劑軌跡。
- HA 治療資料：裝置、目標 adsorbate、起訖時間、血流量、cartridge change、累積處理血量、藥物時間、TDM、反應與不良事件。

## 6. 臨床決策設計

### 6.1 診斷與分期

- SA-AKI 操作性範圍：sepsis 發生後 7 天內的 AKI；early ≤48 小時，late 為 48 小時至 7 天。
- KDIGO stage 同時計算 SCr 與 urine output，採較嚴重者。
- 顯示 baseline SCr 的資料來源與可信度，不把反推值偽裝成實測值。
- 尿量必須同時記錄觀察時數、體重基準及利尿劑使用。
- 若資料不足，顯示 provisional stage 與缺失資料，而不是回傳正常。

### 6.2 鑑別診斷

提示並記錄以下可逆或替代原因：

- 持續低灌流、出血、心因性或阻塞性休克。
- 腎靜脈充血、右心衰竭、腹腔高壓。
- 尿路阻塞。
- 腎毒性藥物、顯影劑、色素腎病。
- TMA、GN、AIN、hepatorenal physiology。
- 既有 CKD 或 creatinine dilution effect。

### 6.3 液體評估與控制

- 以 ROSE phase 標記 resuscitation、optimization、stabilization、evacuation。
- 將「是否可能增加心輸出」與「是否能耐受更多液體」分開判斷。
- 優先採動態測試，例如 PLR + VTI/SV；CVP 或 IVC 不得單獨觸發給液。
- 充血評估整合肺部超音波、VExUS/CVP、體重、氧合與累積平衡。
- 每次液體建議包含 indication、test、response 與 stop rule。
- 休克未穩或升壓劑增加時，UFNET 預設為 0 或極低；穩定後依 congestion 與 tolerance 漸進調整。

### 6.4 KRT／CRRT 啟動

優先辨識需立即處理的併發症：

- 難治性高鉀或其他致命電解質異常。
- 難治性嚴重酸血症。
- 對藥物與呼吸支持無反應的肺水腫／低氧。
- 尿毒症性腦病、心包膜炎或其他明確尿毒症併發症。
- 可透析毒物或需要精確控制鈉矯正速度的特殊情境。

沒有 definitive indication 時採 deferred strategy，系統必須給出重評時間與惡化觸發條件。不得以單一 SCr、BUN、少尿、SOFA 或發炎標誌預防性啟動 CRRT。

### 6.5 模式選擇

- 血流動力穩定且需快速清除者可考慮 IHD。
- 介於 IHD 與 CRRT 之間的情境可選 PIRRT。
- 血流動力不穩、顱壓風險或需精細液體／電解質控制者偏向 CRRT。
- CVVHD、CVVH、CVVHDF 依 diffusion、convection、filtration fraction、藥物與耗材需求選擇；不得宣稱任一模式有穩定存活優勢。
- 提供設備中立建議後，再顯示 Prismaflex／PrisMax 可編輯預設。

### 6.6 成人 ECMO pathway

- 比較獨立 dialysis catheter 與整合 ECMO circuit 的利弊。
- 記錄 CRRT access／return 位置、壓力、air risk、flow interaction 與有效 delivered dose。
- 監測 hemolysis、filter clotting、跨膜壓、抗凝重疊與出血。
- ECMO 系統性抗凝不等於 CRRT circuit 一定有足夠 filter life；須依實際迴路表現判斷。
- ECMO 或 CRRT 中斷時顯示 hemodynamic、air embolism、electrolyte rebound 與 fluid balance 風險。

### 6.7 CRRT 處方

- 成人 delivered effluent 目標 20–25 mL/kg/h；處方值依 downtime 個別補償。
- 顯示 actual、ideal 或 adjusted body weight 的選擇及理由。
- 計算 pre/post dilution、filtration fraction、replacement 與 dialysate contribution。
- 電解質、buffer、glucose、溫度及營養損失需列入監測。
- 可行且無禁忌時提供 regional citrate anticoagulation pathway；另提供 heparin／no anticoagulation 分支。
- Prisma 預設值僅是可編輯起點，必須由使用者確認設備、液體與院內 SOP。

### 6.8 Hemoadsorption 選項

HA 在本系統中是獨立於 CRRT indication 的選配模組，預設關閉。只有使用者主動進入「HA 救援評估」後才顯示，不得因 AKI、CRRT、CRP/PCT 上升或裝置可用而自動推薦。

#### 6.8.1 定位與啟動 gate

四項 gate 全部通過才顯示為「可送多專科審查」，而不是「建議治療」：

1. **Clinical gate**：明確 septic shock；適當抗菌藥、感染源控制計畫、精準液體、升壓劑及適用的類固醇等標準治療已落實；仍持續惡化且具有可逆 treatable trait。
2. **Target gate**：裝置與靶標匹配，且必要靶向檢驗結果已回報。
3. **Safety gate**：血球、凝血、albumin、肝腎功能、電解質、血管路徑與抗凝風險已評估；無不可控制出血、不可逆多器官衰竭或不符合照護目標。
4. **Governance gate**：重症、腎臟、感染三方核准；藥師完成 TDM／暴露量計畫；取得同意；預先寫入 6–12 小時反應與停損；納入研究或 registry。

候選富集訊號可包括 NE-equivalent 持續上升或約 ≥0.2 mcg/kg/min、需第二升壓劑、lactate 2–8 mmol/L 且清除不佳、器官功能持續惡化、動態 hyperinflammation 及 platelet >100 × 10^9/L。這些只屬專家框架，不是經驗證的適應症或評分系統。

#### 6.8.2 5 Rights

- **Right patient**：標準治療後仍惡化，且有可逆、可監測的生物特徵。
- **Right device**：先定義要移除的分子，再選裝置。
- **Right time**：必要復甦、抗菌藥及 source control 後，若決定使用則儘早開始；12–24 小時只作建議窗口，不是 RCT cut-off。
- **Right dose**：遵循裝置 IFU／研究 protocol；不得把 8–12 小時換匣或 13 L/kg 套用到所有 HA。
- **Right stop**：開始前先定義無效、受害、免疫麻痺、不可逆性及已無靶點的停損條件。

#### 6.8.3 Biomarker 與裝置匹配

- **廣效 cytokine adsorber（CytoSorb、HA330/380）**：需有 quantitative IL-6 結果與 serial trend；目前沒有經驗證的通用 IL-6 cut-off。CRP、PCT、ferritin 只能支持發炎軌跡，不能單獨構成適應症。
- **Polymyxin B hemoperfusion**：必須有 EAA；EAA 0.60–0.89 可顯示為 TIGRIS-like research candidate。Gram-negative culture 不得取代 EAA。TIGRIS 結果不能外推至其他 HA 裝置。
- **oXiris**：病人必須先有正式 CRRT 適應症，再依欲處理的 endotoxin／cytokine phenotype 評估吸附膜；不得為 adsorption 製造 CRRT indication。
- **Immunoparalysis**：低 HLA-DR、持續感染或明顯免疫麻痺時，廣效吸附原則上顯示為不合理或需專家否決性審查。

#### 6.8.4 治療監測與停損

- 0 小時建立 NE-equivalent、MAP、lactate、CRT、尿量、SOFA、IL-6／EAA、platelet、albumin 與抗菌藥時間基線。
- 2–4 小時監測 hemodynamics、circuit、出血、抗凝、電解質與藥物暴露。
- 6–12 小時執行 time-limited trial review；NE 不降或上升、lactate／灌流／SOFA 無改善、靶標不降、感染源未控制或器官衰竭惡化時，顯示停止並重新診斷。
- 任何時間出現嚴重 thrombocytopenia、出血、反覆 circuit clot、不可接受的藥物／albumin 下降、免疫麻痺、不可逆多器官衰竭或照護目標改變時，立即停止。
- NE <0.05 mcg/kg/min 且 lactate <2 mmol/L 只能作 shock reversal 參考，不能呈現為已驗證的 HA 停機標準。

#### 6.8.5 抗菌藥與其他藥物

- 不延誤或減少完整 loading dose。
- 記錄藥物給藥、HA 啟用與每次換匣時間。
- vancomycin 採 AUC／濃度監測；linezolid、azole 與 beta-lactam 在可行時採 TDM。
- 不因「可能吸附」直接產生固定追加劑量；須整合感染源、MIC、分布容積、殘餘腎功能、CRRT dose 與裝置影響個別調整。

### 6.9 停止 CRRT

每日 liberation screen 包含：

- 原始 KRT 適應症是否解除。
- 血流動力與升壓劑是否穩定。
- fluid input、自然尿量與去除需求是否可在無 CRRT 下平衡。
- SCr、BUN、K、酸鹼與短期 creatinine clearance 軌跡。
- 利尿劑使用與自然恢復必須分開呈現。
- trial-off 後的重測時間與 restart triggers。

任何 urine output 或 creatinine clearance 數字都只能作支持訊號，不設為自動停機標準。

### 6.10 預後

- 以 improving、persistent、relapsing、worsening trajectory 呈現病程。
- 顯示 CKD、shock duration、fluid overload、multiorgan failure、CRRT duration 與 nephrotoxin exposure 等 recovery risk factors。
- 顯示 MAKE30／MAKE90 概念及其組成，不製造未驗證的個人死亡百分比。
- NGAL、TIMP-2×IGFBP7、CCL14 等生物標記只作補充，不單獨觸發 CRRT、停止治療或預測不可恢復。

## 7. 使用者流程

1. 首頁：建立匿名病例、開啟病例、匯入／匯出、資料清除與證據版本。
2. 評估 wizard：感染與休克 → AKI → 容量與灌流 → KRT 適應症 → 模式／ECMO → 處方 → 選配 HA 救援評估 → 監測／liberation。
3. 決策首頁：critical、warning、monitor、stable 四級狀態。
4. 每張決策卡顯示判斷、依據、缺失資料、下一步、重評時間與 counterfactuals。
5. 趨勢頁：預設 0、6、12、24、48、72 小時，並允許自訂時間點。
6. HA 頁：先顯示 SSC／ADQI 警示，再依 5 Rights、四道 gate、裝置匹配與 time-limited trial 逐步評估。
7. 床邊摘要：可複製的交班摘要、CRRT／HA checklist 與待辦項目，不產生可直接下達的醫囑。

## 8. 視覺與可用性

- 院內 clinical command center 風格，深藍與青綠為主。
- 紅色只用於立即危險；琥珀色用於需重評；不得用顏色作唯一狀態提示。
- 桌面版同時顯示輸入、決策與趨勢；手機版採逐步 wizard。
- 支援鍵盤操作、清楚 focus state、ARIA 標籤、適當 contrast 與 reduced motion。
- 不使用裝飾性醫療圖片，不呈現容易造成權威錯覺的 AI 角色或聊天介面。

## 9. 驗證策略

### 9.1 規則測試

- 每個臨床規則模組建立單元測試。
- 覆蓋正常值、缺值、邊界值、衝突值與不可能值。
- 建立典型病例：early SA-AKI、late SA-AKI、CKD-on-AKI、fluid responsive shock、venous congestion、emergent KRT、deferred KRT、ECMO + CRRT、liberation success／failure。
- 建立 HA 安全病例：CRP/PCT 單獨升高不得通過、IL-6 未回報不得進入 cytokine HA、EAA 未測不得進入 PMX、oXiris 無 CRRT indication 必須阻擋、TIGRIS-like PMX、immunoparalysis、6–12 小時無反應停損、藥物 TDM 警示。
- 所有重要門檻至少有一個低於、等於與高於門檻的測試。

### 9.2 UI 與端到端測試

- 桌面與手機 viewport。
- 建立病例、加入時間點、保存、重開、匯出、刪除。
- 完成完整評估並驗證決策卡與趨勢同步更新。
- 驗證離線載入、base path、404 fallback 與 PWA manifest。
- 驗證 console 無錯誤、無框架 overlay、無水平溢位與主要內容裁切。

### 9.3 臨床內容審查

- 所有高風險規則在發布前由至少腎臟科與重症醫學專業人員審查。
- 每條規則保留 source ID，可由畫面追溯到參考文獻。
- 正式指引更新、KDIGO 草案轉正式版或院內 Prisma SOP 改版時觸發內容更新。

## 10. CI/CD 與發布

GitHub Actions 在 pull request 與 main branch push 時執行：

1. install with lockfile；
2. type-check；
3. lint；
4. unit tests；
5. production build；
6. Playwright smoke test；
7. 僅在 main 全部通過後部署 GitHub Pages。

發布頁面必須顯示版本、最後審查日、適用族群、責任聲明及資料只存在本機的說明。

## 11. 第一版完成條件

- 可建立與管理匿名成人病例。
- 可輸入至少兩個時間點並顯示趨勢。
- 可完成 SA-AKI 診斷與 KDIGO stage。
- 可完成液體表型與 CRRT 啟動／模式／處方／停機評估。
- 可處理成人 ECMO 分支。
- 可選擇進入 HA 模組，完成 5 Rights、四道 gate、IL-6／EAA、裝置匹配、藥物監測與停損；任何結果均不得顯示為常規推薦。
- 所有結果有可解釋依據、缺失資料、下一步與重評時間。
- 核心臨床規則、資料保存與主要流程均有自動測試。
- PWA 可在 GitHub Pages 正常載入並通過桌面與手機驗證。

## 12. 明確不做的事項

- 不建立後端、帳號、遠端同步或多人協作。
- 不輸入或儲存直接識別資訊。
- 不自動開立處方或控制 CRRT／ECMO 設備。
- 不因 AKI、CRRT、單一發炎指標、Gram-negative culture 或設備可用而自動推薦 HA。
- 不把 TIGRIS、PHIND、ImmunoSep 或單一裝置研究外推為所有 HA 的類別效益。
- 不將單一 biomarker、BUN、SCr 或尿量門檻當成不可逆的自動決策。
- 不宣稱預測模型能提供經驗證的個人死亡率或腎恢復百分比。
