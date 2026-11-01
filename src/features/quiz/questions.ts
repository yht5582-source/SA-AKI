export type QuizDomain = '診斷與分期' | '液體管理' | 'KRT 啟動' | '模式選擇' | 'CRRT 處方' | 'CRRT 脫離' | '血液吸附';
export type QuizLevel = '基礎' | '高階';

export interface QuizOption { text: string; why: string; }
export interface QuizQuestion {
  id: string;
  level: QuizLevel;
  domain: QuizDomain;
  stem: string;
  options: readonly [QuizOption, QuizOption, QuizOption, QuizOption];
  /** Index into options in authored order; display order is shuffled per attempt. */
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  sourceIds: string[];
  demoId?: string;
}

export const PASS_RATIO = 0.8;
export const passMark = (total: number) => Math.ceil(total * PASS_RATIO);

export const questions: QuizQuestion[] = [
  {
    id: 'q01', level: '基礎', domain: '診斷與分期',
    stem: '70 kg 病人，3 天前門診實測 SCr 0.9 mg/dL，今日 2.0 mg/dL；近 6 小時尿量 336 mL。依 KDIGO 2012，目前分期為何？',
    options: [
      { text: '第 1 期', why: '1.5–1.9 倍才是第 1 期；此例已達 2.2 倍。' },
      { text: '第 2 期', why: '2.0 / 0.9 ≈ 2.2 倍，落在 2.0–2.9 倍。' },
      { text: '第 3 期', why: '需達 3 倍以上、SCr ≥4.0（且符合 AKI）或開始 RRT。' },
      { text: '尿量正常，未達 AKI', why: '尿量為 0.8 mL/kg/h，但 SCr 軸已達標；兩軸取較嚴重者。' },
    ],
    answer: 1,
    explanation: 'SCr 與尿量兩軸分別判定，採較嚴重者。尿量正常不能抵銷 SCr 的分期。',
    sourceIds: ['KDIGO_2012'], demoId: 'demo-t2',
  },
  {
    id: 'q02', level: '基礎', domain: '診斷與分期',
    stem: '依 ADQI 28，SA-AKI 要求 AKI 發生在 sepsis 起始後 7 天內。若首次觀察到 AKI 是在第 200 小時，應如何解讀？',
    options: [
      { text: '仍屬 late SA-AKI', why: '168 小時已是 7 天上限；第 200 小時超出。' },
      { text: '有 sepsis 病史就算 SA-AKI，時間不影響判定', why: '定義同時要求時間關係；也需排除其他病因。' },
      { text: '超出 7 天窗，不能僅憑時間判定', why: '首次觀察不等於真正起始，應回顧先前資料與替代病因。' },
      { text: '應改以 SOFA 判定，不看時間', why: 'SOFA 用於 sepsis 定義，不能取代 AKI 的時間與 KDIGO 條件。' },
    ],
    answer: 2,
    explanation: 'ADQI 28 的 7 天窗是定義的一部分。本工具另把 48 小時分成 early／late，那是操作性慣例。時間相符也不代表因果。',
    sourceIds: ['ADQI_28', 'APP_SA_AKI_TIMING_V1'], demoId: 'demo-t5',
  },
  {
    id: 'q03', level: '基礎', domain: '液體管理',
    stem: '插管病人，PLR 後 VTI 上升 12%，但新出現雙側瀰漫 B-lines、VExUS 2、P/F 148，MAP 68。下一步最適合的是？',
    options: [
      { text: 'PLR 陽性，再給一次 bolus', why: '反應性陽性不等於該輸液；此例耐受性不佳。' },
      { text: '不追加輸液，重評休克型態', why: '反應性與耐受性衝突時，停止追加並重評。' },
      { text: '依 CVP 決定是否輸液', why: 'CVP 單獨不能決定輸液，也解不開此衝突。' },
      { text: '立即開始 CRRT 脫水', why: '要先確認肺水腫適應症與治療反應；此時灌流也未穩定。' },
    ],
    answer: 1,
    explanation: '反應性與耐受性要分開判讀。小量 challenge 的前提是反應性陽性、未見不耐受、且確有灌流需求，三者同時成立。',
    sourceIds: ['APP_FLUID_SAFETY_V1'], demoId: 'demo-t3',
  },
  {
    id: 'q04', level: '基礎', domain: '液體管理',
    stem: 'MAP 70，乳酸 3 mmol/L，CVP 4 mmHg，IVC 塌陷。未做動態評估。依 SSC 2026，如何引導輸液？',
    options: [
      { text: 'CVP 低，直接輸液', why: '靜態指標單獨不能觸發輸液。' },
      { text: 'IVC 塌陷代表血管內容量不足，應立即輸液補足', why: 'IVC 受呼吸與腹內壓影響，也不是獨立依據。' },
      { text: '依理學檢查判斷即可', why: 'SSC 2026 建議動態指標優於理學檢查或靜態指標單獨使用。' },
      { text: '先做 PLR 配合 VTI／SV 等動態評估', why: 'SSC 2026 條件式建議以動態指標引導液體復甦。' },
    ],
    answer: 3,
    explanation: 'SSC 2026 是條件式建議（低確定性）。本工具以 PLR 加 VTI／SV 上升 ≥10% 為陽性，這個數字是操作性慣例，需確認量測品質。',
    sourceIds: ['SSC_2026', 'APP_FLUID_SAFETY_V1'], demoId: 'demo-t1',
  },
  {
    id: 'q05', level: '基礎', domain: 'KRT 啟動',
    stem: 'SA-AKI 第 3 期，BUN 110、少尿，血鉀 5.2，pH 7.30，無肺水腫，無尿毒併發症。最符合 SSC 2026 的處置是？',
    options: [
      { text: '分期已達第 3 期，立即開始 RRT', why: 'KDIGO 分期本身不是 RRT 適應症。' },
      { text: 'BUN >100，立即開始 RRT', why: '單一 BUN 不構成適應症。' },
      { text: '不開始 RRT，密切監測並設定重評', why: 'SSC 2026 建議無確定適應症時不做 RRT（條件式、中等確定性）。' },
      { text: '先做預防性 CRRT，保護腎臟', why: '沒有證據支持預防性 RRT；STARRT-AKI 也未顯示提早啟動有益。' },
    ],
    answer: 2,
    explanation: 'STARRT-AKI 中，無緊急適應症的嚴重 AKI 提早啟動並未降低 90 天死亡，存活者透析依賴反而較高。延後不等於放著不管，要持續監測。',
    sourceIds: ['SSC_2026', 'STARRT_AKI_2020', 'KDIGO_2012'], demoId: 'demo-t1',
  },
  {
    id: 'q06', level: '基礎', domain: 'KRT 啟動',
    stem: '下列哪一項，本身就足以轉為「立即評估 KRT」？',
    options: [
      { text: 'BUN 120 mg/dL，無症狀', why: '單一 BUN 不構成適應症。' },
      { text: '無尿 14 小時，其他皆穩定', why: '這達第 3 期尿量標準，但少尿或無尿本身不是適應症。' },
      { text: '確認的尿毒性心包炎', why: '明確尿毒併發症是 KRT 評估的適應症。' },
      { text: 'SOFA 由 8 升到 12', why: 'SOFA 反映器官衰竭，不是 KRT 適應症。' },
    ],
    answer: 2,
    explanation: 'KDIGO 以危及生命的液體、電解質、酸鹼異常與臨床趨勢為依據，不看單一 BUN 或 SCr 閾值。',
    sourceIds: ['KDIGO_2012', 'APP_KRT_SAFETY_V1'], demoId: 'demo-t5',
  },
  {
    id: 'q07', level: '基礎', domain: '模式選擇',
    stem: '外傷性腦損傷併 sepsis，有顱內壓風險；難治性高血鉀已確認。MAP 80、未用升壓劑、乳酸正常。討論模式時傾向？',
    options: [
      { text: 'CRRT', why: 'KDIGO 建議急性腦損傷或顱內壓升高時選用 CRRT。' },
      { text: 'IHD，因循環穩定', why: 'IHD 的快速溶質移除可能使腦水腫惡化。' },
      { text: 'SCUF', why: 'SCUF 溶質清除有限，無法處理高血鉀。' },
      { text: '不透析，因 SSC 無偏好', why: '適應症已成立；SSC 的「無偏好」是指連續與間歇之間。' },
    ],
    answer: 0,
    explanation: '顱內壓風險優先於循環穩定的判斷。若快速降鉀與腦部風險衝突，需專科權衡。',
    sourceIds: ['KDIGO_2012', 'APP_KRT_SAFETY_V1'],
  },
  {
    id: 'q08', level: '基礎', domain: 'CRRT 處方',
    stem: '70 kg（已說明體重基準），CVVHD，無前稀釋，交付目標 25 mL/kg/h。預期停機 20%。處方 effluent 約需多少？',
    options: [
      { text: '1,400 mL/h', why: '這是用 20 mL/kg/h 計算，也沒有補償停機。' },
      { text: '1,750 mL/h', why: '這是目標量，尚未補償 20% 停機，實際只交付約 20 mL/kg/h。' },
      { text: '2,100 mL/h', why: '這是 ×1.2；補償應除以實際運轉比例 0.8。' },
      { text: '2,188 mL/h', why: '25 ÷ 0.8 = 31.25 mL/kg/h，×70 kg ≈ 2,188 mL/h。' },
    ],
    answer: 3,
    explanation: 'KDIGO 的 20–25 mL/kg/h 指實際交付劑量，常需開較高的處方量。高於 30 mL/kg/h 時，應先檢討停機原因，不是把高強度當作好處。',
    sourceIds: ['KDIGO_2012', 'APP_CRRT_PRESCRIPTION_V1'], demoId: 'demo-t3',
  },
  {
    id: 'q09', level: '基礎', domain: 'CRRT 脫離',
    stem: '試停 CRRT 18 小時。下列哪一項最應立即複核是否重啟？',
    options: [
      { text: 'SCr 由 1.7 升到 2.1，尿量穩定', why: '停機後 SCr 上升是預期中的變化，要追蹤，不單獨構成重啟。' },
      { text: 'BUN 上升，但無症狀', why: '溶質反彈需提前評估，不單獨下達重啟。' },
      { text: '血鉀 6.5，內科治療無效', why: '難治高血鉀是持續或復發的適應症，應立即複核。' },
      { text: '累積平衡增加 300 mL，氧合穩定', why: '應提前評估輸入需求，但本身不是立即重啟條件。' },
    ],
    answer: 2,
    explanation: '重啟複核的核心是適應症復發：難治高血鉀、嚴重酸血症、難治肺水腫或低氧、尿毒併發症。其他變化要提前評估，不自動重啟。',
    sourceIds: ['KDIGO_2012', 'APP_LIBERATION_V1'], demoId: 'demo-t4',
  },
  {
    id: 'q10', level: '基礎', domain: '血液吸附',
    stem: '敗血性休克病人 IL-6 很高，家屬要求使用血液吸附。下列何者最正確？',
    options: [
      { text: 'SSC 2026 條件式反對常規使用，僅限研究或核准流程', why: 'SSC 條件式反對，ADQI 30 也定位為實驗性。' },
      { text: 'IL-6 夠高就是明確適應症', why: '沒有已驗證的 IL-6 切點，也不能由單一生物標記決定。' },
      { text: '各種吸附裝置的證據可互相通用', why: 'CytoSorb、HA330/380、oXiris、PMX 的證據不可互相外推。' },
      { text: '若已在做 CRRT，把吸附匣接上迴路即屬常規照護，不需另外評估', why: '已有 CRRT 不構成 HA 適應症，也不改變非常規定位。' },
    ],
    answer: 0,
    explanation: '本工具的 HA 是主動選入的路徑，需通過臨床、目標、安全與治理四道閘門，且不產生治療資格或醫囑。移除目標分子也不代表結局獲益。',
    sourceIds: ['SSC_2026', 'ADQI_30', 'APP_HA_REVIEW_V1'], demoId: 'demo-t6',
  },
  {
    id: 'q11', level: '高階', domain: '診斷與分期',
    stem: '無發病前實測值，基準 SCr 0.9 由 eGFR 回推，無測量時間。第 72 小時 SCr 5.0；第 120 小時實測 7.2。兩個時間點應如何解讀？',
    options: [
      { text: '兩次都是確立的第 3 期，因為都超過基準 3 倍', why: '基準回推且無時間，倍數只能算暫定，也無法確認 7 天內升幅。' },
      { text: '第 72 小時暫定第 3 期；第 120 小時因 48 小時內實測上升且 SCr ≥4 而確立', why: '連續實測提供可靠比較，AKI 成立後 SCr ≥4 即第 3 期。' },
      { text: '兩次都無法分期，因為沒有可靠基準', why: '可給暫定分期並標示低可信度；連續實測也可獨立分期。' },
      { text: '第 120 小時只是第 1 期，因為 7.2 / 5.0 僅 1.44 倍', why: '忽略了 SCr ≥4 的絕對條件，AKI 定義成立後應歸第 3 期。' },
    ],
    answer: 1,
    explanation: '回推或估計的基準不能當實測。工具顯示「暫定」，等連續實測建立可靠比較才確立。分期要同時交代可信度。',
    sourceIds: ['KDIGO_2012'], demoId: 'demo-t5',
  },
  {
    id: 'q12', level: '高階', domain: '診斷與分期',
    stem: '本次病程曾用 CRRT，已有成對的開始與停止紀錄。目前 SCr 1.3（6 天前基準 1.0，48 小時前 1.7），尿量 0.6 mL/kg/h。KDIGO 應如何記載？',
    options: [
      { text: '一旦用過 RRT，之後都維持第 3 期', why: 'RRT 第 3 期適用進行中的急性 RRT；已停止者依當下資料分期，歷史另記。' },
      { text: '目前未達 AKI 條件，代表腎功能已恢復，可結案', why: '未達條件不等於恢復；要追蹤並於 3 個月評估。' },
      { text: '目前依當下資料未達 AKI 條件；歷史最高第 3 期另記，仍不等於已恢復', why: '目前分期與歷史最高分開記載，也不推論恢復。' },
      { text: '1.3 / 1.0 為 1.3 倍，屬第 1 期', why: '1.5 倍才達第 1 期；與基準相距 >48 小時也不適用 0.3 升幅。' },
    ],
    answer: 2,
    explanation: '要分清三件事：目前分期、本次病程最高分期、腎功能恢復。工具也提醒，維持性透析不可套用急性 RRT 分期。',
    sourceIds: ['KDIGO_2012'], demoId: 'demo-t4',
  },
  {
    id: 'q13', level: '高階', domain: '液體管理',
    stem: 'CRRT 中，4 小時內 NE 由 0.1 升到 0.25，趨勢欄仍標「不變」，並勾選「灌流足夠」，要求淨脫水 100 mL/h。工具的試算會如何處理？',
    options: [
      { text: '依勾選的「灌流足夠」，照 100 mL/h 試算，完成處方安全 checklist 後放行執行', why: '實測與標記衝突時，不能採信標記。' },
      { text: '依實測視為升壓需求上升；UFNET 歸零，阻擋 checklist，要求立即重評', why: '數值趨勢優先，衝突未釐清前不脫水也不放行。' },
      { text: '直接判定低灌流，並建議停止 CRRT', why: '單一量測不是低灌流診斷，也不產生停機指令。' },
      { text: '趨勢欄有填就以趨勢欄為準，只在畫面提示一下', why: '≤6 小時內的數值上升會覆蓋不一致的標記。' },
    ],
    answer: 1,
    explanation: '人工標記與 ≤6 小時內量測矛盾時，安全上採惡化訊號。數值仍照 UFNET 0 透明試算，但 checklist 不會完成。',
    sourceIds: ['APP_FLUID_SAFETY_V1', 'APP_CRRT_PRESCRIPTION_V1'], demoId: 'demo-t3',
  },
  {
    id: 'q14', level: '高階', domain: '液體管理',
    stem: 'PLR 標記陽性，VTI +14%，但同次 SV 僅 +6%。無肺水腫、無 B-lines、VExUS 0、P/F 300；乳酸 3.2、CRT 4 秒。輸液決策為何？',
    options: [
      { text: 'VTI 已達 10%，可進行小量 challenge', why: '有多項量測時須一致；一項達標不足以判為陽性。' },
      { text: 'SV 未達 10%，判定無反應，改用升壓劑', why: '不一致時是「未知」，不是陰性。' },
      { text: '有灌流問題且耐受性佳，反應性就不必看，可直接給小量 challenge', why: '小量 challenge 需三者同時成立。' },
      { text: '反應性判為未知；先核對量測品質並重測，暫不追加輸液', why: '量測矛盾應維持未知，重測後再決定。' },
    ],
    answer: 3,
    explanation: '工具要求 PLR 與所有記錄到的 VTI／SV 一致，才判定陽性或陰性。先確認同一試驗、節律、姿勢及量測品質。',
    sourceIds: ['SSC_2026', 'APP_FLUID_SAFETY_V1'], demoId: 'demo-t1',
  },
  {
    id: 'q15', level: '高階', domain: 'KRT 啟動',
    stem: '交班寫「難治性肺水腫」。檢視資料：有肺水腫，P/F 260，只用一般氧氣；血鉀、pH 正常，無尿毒併發症。工具會如何判定？',
    options: [
      { text: '已標記難治，立即評估 KRT', why: '需同時有水腫、P/F ≤200 與呼吸支持，標記才算相符。' },
      { text: '立即確認：標記與氧合資料不符，先核對病因、呼吸支持與治療反應', why: '不相符時維持「立即確認」，不自動啟動也不忽略。' },
      { text: '無適應症，改為常規監測即可', why: '已有肺水腫與難治標記，屬危險訊號，須立即確認。' },
      { text: 'P/F 尚可，先安排 SCUF 脫水', why: '適應症未確立時不選模式，模式偏好也不能當啟動理由。' },
    ],
    answer: 1,
    explanation: '「難治」是臨床判斷，但要與數據相符才算成立。這條規則同樣適用於高血鉀與酸血症：標記與數值必須一致。',
    sourceIds: ['KDIGO_2012', 'APP_KRT_SAFETY_V1'], demoId: 'demo-t3',
  },
  {
    id: 'q16', level: '高階', domain: 'KRT 啟動',
    stem: '敗血性休克，KDIGO 第 3 期。pH 7.16、HCO₃ 13、乳酸 7，血鉀 5.0，尚無酸血症治療反應紀錄。下列何者最符合 SSC 2026 與本工具？',
    options: [
      { text: 'pH ≤7.2 已確定透析適應症，直接上機', why: 'pH 是篩檢值，尚未確認病因與難治性。' },
      { text: '依 SSC 反對所有 bicarbonate，只能處理灌流，酸血症不另外介入', why: 'SSC 反對的是以其改善血流動力；此族群則建議使用。' },
      { text: '處理灌流與病因，可考慮 bicarbonate，確認難治才評估 KRT', why: 'SSC 對 pH ≤7.2 併 AKIN 2–3 條件式建議用 bicarbonate。' },
      { text: '資料不足，暫不判定，待下次血氣再處理', why: '危險訊號須立即處理，不能等待。' },
    ],
    answer: 2,
    explanation: 'SSC 2026 兩條要分清：單純低灌流乳酸酸血症，不建議為改善血流動力用 bicarbonate；嚴重代謝性酸血症（pH ≤7.2）併 AKIN 2–3 則條件式建議使用（極低確定性）。',
    sourceIds: ['SSC_2026', 'APP_KRT_SAFETY_V1'], demoId: 'demo-t2',
  },
  {
    id: 'q17', level: '高階', domain: '模式選擇',
    stem: '難治高血鉀已確認，需快速降鉀，無顱內壓風險。耐受性欄標「穩定」，但 NE 0.15、乳酸 3.8。工具的模式建議是？',
    options: [
      { text: '可討論 IHD：標記穩定且需要快速清除', why: '穩定標記與升壓劑、乳酸矛盾，不能優先套用 IHD。' },
      { text: '可討論 PIRRT：折衷選擇', why: 'PIRRT 需已知灌流無疑慮；衝突時不會以折衷帶過。' },
      { text: '暫不選定模式；先核對循環與灌流評估，同時不延誤降鉀處置', why: '資料衝突時不給偏好，危急處置仍要同步進行。' },
      { text: '用了升壓劑就必定選 CRRT，標記可忽略', why: '工具不自行改寫標記；更正資料後才會收斂到 CRRT。' },
    ],
    answer: 2,
    explanation: '這是刻意的 fail-closed。若有顱內壓風險或精密控制需求，即使標記衝突也會提示 CRRT；此例沒有，所以暫不給答案。',
    sourceIds: ['KDIGO_2012', 'APP_KRT_SAFETY_V1'], demoId: 'demo-t6',
  },
  {
    id: 'q18', level: '高階', domain: 'CRRT 處方',
    stem: 'CVVHDF，校正體重 82 kg：Qb 180、Hct 0.30、透析液 1,200、前稀釋 600、後稀釋 400、淨脫水 100 mL/h；停機 1/12。模型估算交付約多少 mL/kg/h？',
    options: [
      { text: '28.0', why: '這是 2,300 ÷ 82 的名目值，未校正稀釋與停機。' },
      { text: '26.0', why: '只校正前稀釋（×0.926），未扣停機。' },
      { text: '25.7', why: '只扣停機（×0.917），未校正前稀釋。' },
      { text: '23.8', why: '28.05 × 7,560/8,160 × 11/12 ≈ 23.8。' },
    ],
    answer: 3,
    explanation: 'Qp = 180×60×0.7 = 7,560；稀釋因子 = 7,560 ÷（7,560 + 600）。這仍是模型值，不是量到的清除率，要與實測交付劑量核對。',
    sourceIds: ['KDIGO_2012', 'NSI_CRRT_2016', 'APP_CRRT_PRESCRIPTION_V1'], demoId: 'demo-t3',
  },
  {
    id: 'q19', level: '高階', domain: 'CRRT 處方',
    stem: '100 kg，CVVHD 2,800 mL/h，目標 25 mL/kg/h，停機 10%；Qb 輸入 60 mL/min，Hct 0.35。工具不提供試算結果，最可能的原因與處理是？',
    options: [
      { text: '目標與設定都超過血漿流量上限；先核對 Qb 與單位、Hct 及飽和度', why: 'Qp 僅 2,340 mL/h，低於 2,800 與目標所需的 2,778。' },
      { text: '劑量不足，把透析液調到 3,500 mL/h 就能補償', why: '增加名目流量無法創造原本沒有的溶質輸入。' },
      { text: '濾過分率太高，改用前稀釋即可解決', why: 'CVVHD 無超濾置換；前稀釋會再降低清除。' },
      { text: '100 kg 超過工具上限，應改用理想體重', why: '不是體重上限；體重基準也要依臨床理由選擇。' },
    ],
    answer: 0,
    explanation: 'Qp = 60×60×0.65 = 2,340 mL/h。這是保守的模型上限檢查，不是通用生理限制。低 Qb 或 mL/min 與 mL/h 誤鍵，常是原因。',
    sourceIds: ['NSI_CRRT_2016', 'APP_CRRT_PRESCRIPTION_V1'],
  },
  {
    id: 'q20', level: '高階', domain: 'CRRT 脫離',
    stem: 'CRRT 中，兩筆觀察相隔 12 小時，都記錄「近 24 小時尿量」，且尿量上升；其他評估與監測計畫皆已完成。工具為何仍不提示試停？',
    options: [
      { text: '必須相隔滿 48 小時才能比較', why: '本機慣例是最近 6–24 小時；12 小時在範圍內。' },
      { text: '尿量收集區間重疊，無法證明獨立且持續的改善', why: '24 小時窗大於間隔，兩筆有重複計算。' },
      { text: '只要還在 CRRT，就一律不提示試停，必須先停機才能評估', why: '條件全部通過時，CRRT 中仍可提示共同考慮試停。' },
      { text: '尿量需超過固定門檻才算', why: '工具沒有單一尿量門檻，也不以尿量單獨判定脫離。' },
    ],
    answer: 1,
    explanation: '觀察窗的設計會影響結論。要用不重疊的區間比較，並留意利尿劑、機器清除與停機等干擾。',
    sourceIds: ['KDIGO_2012', 'APP_LIBERATION_V1'], demoId: 'demo-t4',
  },
];

export const quizDomains = [...new Set(questions.map(question => question.domain))];
