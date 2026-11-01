/** A node is a study aid over the engine's rules, never a treatment order. `src` names a registered evidence source. */
export interface MapNode {
  text: string;
  src?: string;
  /** App convention with no registered source that scopes it. */
  local?: boolean;
  children?: MapNode[];
}
export interface MapBranch extends MapNode {
  id: string;
  color: 'teal' | 'blue' | 'amber' | 'red' | 'violet' | 'green' | 'slate';
  demoId?: string;
}
export interface MindMap { id: 'diagnosis' | 'treatment'; title: string; branches: MapBranch[]; }

export const mindMaps: MindMap[] = [
  {
    id: 'diagnosis', title: 'SA-AKI 診斷',
    branches: [
      {
        id: 'sepsis', text: '1. 確認 Sepsis', color: 'teal',
        children: [
          { text: '疑似或確診感染', src: 'SEPSIS_3_2016' },
          { text: 'SOFA 急性上升 ≥2；不可假設感染前為 0', src: 'SEPSIS_3_2016' },
          { text: '器官障礙須歸因於感染', src: 'SEPSIS_3_2016' },
          { text: '記錄 sepsis 與休克起始時間，後續判讀都以此為準', local: true },
        ],
      },
      {
        id: 'kdigo', text: '2. KDIGO 分期', color: 'blue', demoId: 'demo-t2',
        children: [
          {
            text: '符合 AKI',
            children: [
              { text: '48 小時內 SCr 上升 ≥0.3 mg/dL', src: 'KDIGO_2012' },
              { text: '7 天內 SCr ≥1.5 倍基準', src: 'KDIGO_2012' },
              { text: '尿量 <0.5 mL/kg/h 達 6 小時', src: 'KDIGO_2012' },
            ],
          },
          {
            text: 'SCr 軸',
            children: [
              { text: '第 1 期：1.5–1.9 倍或上升 ≥0.3', src: 'KDIGO_2012' },
              { text: '第 2 期：2.0–2.9 倍', src: 'KDIGO_2012' },
              { text: '第 3 期：≥3 倍；已符合 AKI 且 SCr ≥4.0；或開始急性 RRT', src: 'KDIGO_2012' },
            ],
          },
          {
            text: '尿量軸',
            children: [
              { text: '第 1 期：<0.5 mL/kg/h，6–12 小時', src: 'KDIGO_2012' },
              { text: '第 2 期：<0.5 mL/kg/h，≥12 小時', src: 'KDIGO_2012' },
              { text: '第 3 期：<0.3 mL/kg/h ≥24 小時，或無尿 ≥12 小時', src: 'KDIGO_2012' },
            ],
          },
          { text: '兩軸取較嚴重者；分期不等於透析適應症', src: 'KDIGO_2012' },
        ],
      },
      {
        id: 'baseline', text: '3. 基準 SCr 可信嗎', color: 'amber', demoId: 'demo-t5',
        children: [
          { text: '實測、7 天內、非低可信度 → 可確立分期', local: true },
          { text: '估計、回推、無時間或低可信度 → 只能算「暫定」', local: true },
          { text: '連續實測可獨立確立分期', src: 'KDIGO_2012' },
        ],
      },
      {
        id: 'timing', text: '4. 時間關係', color: 'violet', demoId: 'demo-t5',
        children: [
          { text: 'AKI 發生在 sepsis 起始後 7 天內', src: 'ADQI_28' },
          { text: 'Early ≤48 小時；late >48–168 小時', src: 'APP_SA_AKI_TIMING_V1' },
          { text: '首次偵測不等於真正起始；要回顧先前資料', src: 'APP_SA_AKI_TIMING_V1' },
          { text: 'AKI 早於 sepsis 或超過 7 天：不能僅憑時間確診', src: 'ADQI_28' },
        ],
      },
      {
        id: 'pitfalls', text: '5. 判讀陷阱', color: 'red',
        children: [
          { text: '時間相符不證明因果；仍須排除其他 AKI 病因', src: 'APP_SA_AKI_TIMING_V1' },
          { text: '未量測不等於無尿；核對收集與導尿管通暢', src: 'APP_FLUID_SAFETY_V1' },
          { text: '利尿劑會改變尿量解讀', src: 'KDIGO_2012' },
          { text: '維持性透析不可套用急性 RRT 分期', local: true },
        ],
      },
      {
        id: 'course', text: '6. 追蹤病程', color: 'green', demoId: 'demo-t4',
        children: [
          { text: '目前分期與本次病程最高分期分開記載', src: 'KDIGO_2012' },
          { text: '3 個月評估腎功能恢復或新發／惡化 CKD', src: 'KDIGO_2012' },
          { text: 'MAKE30／90：死亡、新透析或依賴、持續腎功能不良', src: 'MAKE_DEFINITIONS_2024' },
          { text: '趨勢不等於個人預後預測', src: 'APP_TRAJECTORY_V1' },
        ],
      },
    ],
  },
  {
    id: 'treatment', title: 'SA-AKI 治療',
    branches: [
      {
        id: 'fluid', text: '1. 液體管理', color: 'blue', demoId: 'demo-t1',
        children: [
          {
            text: '反應性',
            children: [
              { text: '動態指標優於理學檢查或靜態指標單獨使用', src: 'SSC_2026' },
              { text: 'PLR 加 VTI／SV 上升 ≥10%，且標記一致', src: 'APP_FLUID_SAFETY_V1' },
              { text: 'CVP、IVC 不可單獨觸發輸液', src: 'APP_FLUID_SAFETY_V1' },
            ],
          },
          {
            text: '耐受性',
            children: [
              { text: '肺水腫、雙側瀰漫 B-lines、VExUS ≥2、氧合惡化 → 不佳', src: 'APP_FLUID_SAFETY_V1' },
              { text: 'P/F <200、RV 異常、LV 重度下降 → 需再確認', src: 'APP_FLUID_SAFETY_V1' },
            ],
          },
          {
            text: '灌流',
            children: [{ text: 'MAP <65、乳酸 >2、CRT >3 秒 → 觸發複核', src: 'APP_FLUID_SAFETY_V1' }],
          },
          { text: '三者一致才考慮小量 challenge；先訂目標與停止條件', src: 'APP_FLUID_SAFETY_V1' },
          { text: 'ROSE 依當下評估，不依經過時數', src: 'APP_FLUID_SAFETY_V1' },
          { text: '灌流不穩：UFNET 0 為討論預設；穩定且充血才漸進去復甦', src: 'APP_FLUID_SAFETY_V1' },
        ],
      },
      {
        id: 'start', text: '2. KRT 啟動', color: 'red', demoId: 'demo-t2',
        children: [
          {
            text: '不構成適應症',
            children: [
              { text: '單看分期、BUN、SCr、少尿或 SOFA', src: 'KDIGO_2012' },
              { text: '無確定適應症時建議不做 RRT（條件式）', src: 'SSC_2026' },
              { text: '提早啟動未降低 90 天死亡', src: 'STARRT_AKI_2020' },
            ],
          },
          {
            text: '立即確認（篩檢值）',
            children: [
              { text: 'K ≥6、pH ≤7.2、HCO₃ ≤12、肺水腫、P/F ≤200', src: 'APP_KRT_SAFETY_V1' },
              { text: '同步治療並評估反應，不等填表', src: 'APP_KRT_SAFETY_V1' },
              { text: 'pH ≤7.2 併 AKIN 2–3：建議 bicarbonate（條件式）', src: 'SSC_2026' },
            ],
          },
          {
            text: '立即評估 KRT',
            children: [
              { text: '難治高血鉀、難治酸血症（標記須與數值相符）', src: 'APP_KRT_SAFETY_V1' },
              { text: '難治肺水腫：水腫＋P/F ≤200＋呼吸支持', src: 'APP_KRT_SAFETY_V1' },
              { text: '明確尿毒併發症', src: 'KDIGO_2012' },
              { text: '生命威脅電解質、可透析毒物、受控鈉校正', src: 'APP_KRT_SAFETY_V1' },
            ],
          },
        ],
      },
      {
        id: 'mode', text: '3. 模式選擇', color: 'violet', demoId: 'demo-t6',
        children: [
          { text: '連續或間歇皆可（條件式）；無已證實存活優勢', src: 'SSC_2026' },
          { text: '不穩定、顱內壓風險 → CRRT', src: 'KDIGO_2012' },
          { text: '需精密液體／電解質控制 → CRRT', src: 'APP_KRT_SAFETY_V1' },
          { text: '穩定且需快速清除 → IHD', src: 'APP_KRT_SAFETY_V1' },
          { text: '穩定、不需快速清除 → IHD 或 PIRRT', src: 'APP_KRT_SAFETY_V1' },
          { text: '中間耐受性 → PIRRT', src: 'APP_KRT_SAFETY_V1' },
          { text: '標記與數據矛盾 → 暫不選定，先核對', src: 'APP_KRT_SAFETY_V1' },
          {
            text: 'CRRT 機制',
            children: [
              { text: 'CVVHD 擴散；CVVH 對流；CVVHDF 兩者並用', src: 'KDIGO_2012' },
              { text: 'SCUF 以脫水為主，溶質清除有限', src: 'KDIGO_2012' },
            ],
          },
          { text: 'ECMO：不自動選接法，團隊複核迴路與壓力', src: 'ELSO_FLUID_AKI_2022' },
        ],
      },
      {
        id: 'rx', text: '4. CRRT 處方', color: 'teal', demoId: 'demo-t3',
        children: [
          { text: '交付 20–25 mL/kg/h；常需開較高處方量', src: 'KDIGO_2012' },
          { text: '處方量 = 目標 ÷ 運轉比例 ÷ 稀釋因子', src: 'APP_CRRT_PRESCRIPTION_V1' },
          { text: '明確選定體重基準並寫下理由', src: 'APP_CRRT_PRESCRIPTION_V1' },
          { text: 'FF = 總超濾 ÷（Qp＋前稀釋＋PBP）；≥25% 複核', src: 'APP_CRRT_PRESCRIPTION_V1' },
          { text: '模型估算不等於實測，兩者要核對', src: 'KDIGO_2012' },
          {
            text: '抗凝',
            children: [
              { text: '無禁忌且有流程時，建議局部 citrate', src: 'KDIGO_2012' },
              { text: '肝衰竭、休克：評估 citrate 代謝與蓄積', src: 'APP_CRRT_PRESCRIPTION_V1' },
              { text: '不自動改用 heparin', src: 'APP_CRRT_PRESCRIPTION_V1' },
            ],
          },
          { text: '監測電解質、血氣、血糖、體溫、營養、藥物劑量', src: 'APP_CRRT_PRESCRIPTION_V1' },
        ],
      },
      {
        id: 'liberation', text: '5. 脫離與重啟', color: 'green', demoId: 'demo-t4',
        children: [
          { text: '評估腎功能是否足以滿足病人需求', src: 'KDIGO_2012' },
          {
            text: '試停前全部通過',
            children: [
              { text: '原適應症解決；原生溶質與液體控制足夠', src: 'APP_LIBERATION_V1' },
              { text: '循環、氧合穩定；代謝控制無疑慮', src: 'APP_LIBERATION_V1' },
              { text: '兩個相隔 6–24 小時、區間不重疊的時間點', src: 'APP_LIBERATION_V1' },
              { text: '監測計畫與重啟條件；≤4 小時內複評', src: 'APP_LIBERATION_V1' },
            ],
          },
          { text: '尿量或 SCr 不可單獨判定；留意利尿劑與機器清除', src: 'KDIGO_2012' },
          { text: '適應症復發 → 立即複核重啟', src: 'APP_LIBERATION_V1' },
        ],
      },
      {
        id: 'ha', text: '6. 血液吸附（非常規）', color: 'slate', demoId: 'demo-t6',
        children: [
          { text: '建議不常規用血液淨化、PMX（條件式）', src: 'SSC_2026' },
          { text: '現代血液吸附仍屬實驗性', src: 'ADQI_30' },
          { text: '主動選入＋臨床、目標、安全、治理四道閘門', src: 'APP_HA_REVIEW_V1' },
          { text: '僅限研究、登錄或核准流程；不產生資格或醫囑', src: 'APP_HA_REVIEW_V1' },
        ],
      },
    ],
  },
];

export const findMindMap = (id: string | null) => mindMaps.find(map => map.id === id) ?? mindMaps[0];
