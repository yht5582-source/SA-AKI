import type { ClinicalSnapshot, DecisionResult } from './types';
import { resolveRuleSources } from './sources';

/** Pure triage support. Numeric screens establish urgency, never refractoriness. */
export function evaluateKrtInitiation(s: Partial<ClinicalSnapshot>): DecisionResult[] {
  const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);
  const highK = finite(s.potassiumMmolL) && s.potassiumMmolL >= 6;
  const acidemia = finite(s.arterialPh) && s.arterialPh <= 7.2;
  const lowBicarbonate = finite(s.bicarbonateMmolL) && s.bicarbonateMmolL <= 12;
  const hypoxemia = finite(s.pao2Fio2RatioMmHg) && s.pao2Fio2RatioMmHg <= 200;
  const supported = s.respiratorySupport !== undefined && s.respiratorySupport !== 'room-air';
  const confirmed: string[] = [];
  const missingData: string[] = [];
  const evidence = ['本機安全篩檢值與重評時限是 local convention，非已驗證 KRT 啟動門檻；單一 BUN、SCr、少尿、SOFA、炎症或設備可用性不構成適應症'];

  if (!finite(s.potassiumMmolL)) missingData.push('血鉀與 ECG／電解質危險評估');
  if (!finite(s.arterialPh)) missingData.push('arterial pH 與酸鹼病因');
  if (s.pulmonaryEdema === undefined) missingData.push('肺水腫與氧合評估');
  if (s.uremicManifestations === undefined) missingData.push('明確尿毒併發症評估');
  for (const [flag, label] of [
    [s.lifeThreateningElectrolyteDisturbance, '生命威脅電解質異常的臨床確認'],
    [s.dialyzableToxin, '需體外清除的可透析毒物／毒理確認'],
    [s.requiresControlledSodiumCorrection, '特殊受控鈉校正的專科確認'],
  ] as const) if (flag === undefined) missingData.push(label);

  if (finite(s.potassiumMmolL)) evidence.push(`血鉀 ${s.potassiumMmolL} mmol/L；治療難治性 ${s.refractoryHyperkalemia ?? '未知'}`);
  if (finite(s.arterialPh)) evidence.push(`arterial pH ${s.arterialPh}；治療難治性 ${s.refractoryAcidemia ?? '未知'}`);
  if (finite(s.bicarbonateMmolL)) evidence.push(`HCO3 ${s.bicarbonateMmolL} mmol/L`);
  if (s.pulmonaryEdema !== undefined || s.refractoryPulmonaryEdema !== undefined) evidence.push(`肺水腫 ${s.pulmonaryEdema ?? '未知'}；P/F ${s.pao2Fio2RatioMmHg ?? '未知'} mmHg；呼吸支持 ${s.respiratorySupport ?? '未知'}；對醫療與呼吸支持難治性 ${s.refractoryPulmonaryEdema ?? '未知'}`);
  if (s.uremicManifestations !== undefined) evidence.push(`尿毒表現 ${s.uremicManifestations.join(', ') || '明確評估未見'}`);

  if (highK && s.refractoryHyperkalemia === true) confirmed.push('有相符高血鉀且已確認對適當治療難治');
  else if (highK || s.refractoryHyperkalemia === true) missingData.push('高血鉀與治療反應／難治性的相符紀錄；排除採檢錯誤並立即處理危險');
  if (acidemia && s.refractoryAcidemia === true) confirmed.push('有相符嚴重酸血症且已確認對適當治療難治');
  else if (acidemia || lowBicarbonate || s.refractoryAcidemia === true) missingData.push('嚴重酸血症病因、pH 與治療反應／難治性的相符紀錄');
  if (s.refractoryPulmonaryEdema === true && s.pulmonaryEdema === true && hypoxemia && supported) confirmed.push('肺水腫／低氧血症對醫療與呼吸支持無反應已確認');
  else if (s.pulmonaryEdema === true || s.refractoryPulmonaryEdema === true || hypoxemia) missingData.push('肺水腫病因、P/F、呼吸支持及對醫療／呼吸支持無反應的相符紀錄');
  for (const manifestation of s.uremicManifestations ?? []) {
    if (manifestation === 'other') missingData.push('other 尿毒表現的具體診斷與因果確認');
    else confirmed.push(`明確尿毒併發症：${manifestation}`);
  }
  if (s.lifeThreateningElectrolyteDisturbance === true) confirmed.push('臨床已確認生命威脅電解質異常');
  if (s.dialyzableToxin === true) confirmed.push('毒理已確認需體外清除評估的可透析毒物');
  if (s.requiresControlledSodiumCorrection === true) confirmed.push('專科已確認需要 KRT 評估的特殊受控鈉校正');

  const danger = highK || acidemia || lowBicarbonate || hypoxemia || s.pulmonaryEdema === true
    || s.refractoryHyperkalemia === true || s.refractoryAcidemia === true || s.refractoryPulmonaryEdema === true
    || s.uremicManifestations?.includes('other') === true;
  const urgent = confirmed.length > 0;
  const decision: DecisionResult = {
    id: 'krt-emergency-indications', severity: urgent ? 'critical' : danger || missingData.length > 0 ? 'warning' : 'monitor',
    conclusion: urgent ? 'urgent KRT evaluation：立即專科／臨床醫師評估；非機器處方'
      : danger ? 'urgent confirmation：立即確認生命威脅與難治性；未確認前不自動啟動 KRT；非機器處方'
        : `deferred with reassessment：目前無已確立 KRT 適應症${missingData.length > 0 ? '，資料不足不等於排除適應症' : ''}；非機器處方`,
    evidence: [...evidence, ...confirmed], missingData,
    actions: [
      urgent ? '立即由臨床醫師、腎臟科與重症團隊複核 KRT 適應症及方式，同步處理生命威脅，不等待排程重評'
        : danger ? '立即床邊確認 ECG、重複電解質／血氣、氧合與治療反應；同步緊急醫療處置，不能因資料未齊延誤處理'
          : missingData.length > 0 ? '立即補齊危險併發症評估並重評；延後策略需持續監测，不代表可安全等待'
            : '採取監測下延後策略，至遲 1 小時內重評電解質、血氣、尿量趨勢、液體平衡與氧合',
      '惡化時立即重評：高血鉀／ECG 改變、酸血症、難治肺水腫／低氧或明確尿毒併發症；勿等待下個時點',
      '毒物需毒理專科確認清除特性；鈉校正需專科個別目標與頻繁監測，不自動設定清除速率或液體配方',
    ],
    reassessWithinHours: urgent ? 0 : danger || missingData.length > 0 ? 0.25 : 1,
    counterfactuals: ['若新出現／確認難治高血鉀、嚴重酸血症、肺水腫／低氧、尿毒併發症、毒物或特殊鈉校正需求，立即轉 urgent KRT evaluation；若改善則維持重評，不因 BUN／SCr 或少尿單獨升階'],
    sourceIds: ['KDIGO_2012', 'SSC_2026', 'STARRT_AKI_2020', 'APP_KRT_SAFETY_V1'],
  };
  resolveRuleSources(decision.id, decision.sourceIds);
  return [decision];
}
