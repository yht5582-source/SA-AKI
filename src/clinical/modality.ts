import type { ClinicalSnapshot, DecisionResult } from './types';
import { resolveRuleSources } from './sources';

/** Options are conditional on a separately confirmed KRT indication. */
export function selectKrtModality(s: ClinicalSnapshot): DecisionResult[] {
  const unstable = s.hemodynamicTolerance === 'unstable' || (s.mapMmHg !== undefined && s.mapMmHg < 65) || s.vasopressorTrend === 'worsening';
  const perfusionConcern = (s.lactateMmolL !== undefined && s.lactateMmolL > 2)
    || (s.capillaryRefillSeconds !== undefined && s.capillaryRefillSeconds > 3)
    || s.skinMottling === true || s.peripheralTemperature === 'cool' || s.mentalStatus === 'altered' || s.mentalStatus === 'unresponsive';
  const noPressor = s.norepinephrineEquivalentMcgKgMin === 0;
  const conflict = s.hemodynamicTolerance === 'stable' && (unstable || perfusionConcern || (s.norepinephrineEquivalentMcgKgMin !== undefined && !noPressor));
  const knownPerfusion = s.mapMmHg !== undefined && Number.isFinite(s.mapMmHg) && s.norepinephrineEquivalentMcgKgMin !== undefined
    && Number.isFinite(s.norepinephrineEquivalentMcgKgMin) && s.vasopressorTrend !== undefined && s.lactateMmolL !== undefined && Number.isFinite(s.lactateMmolL);
  const stable = s.hemodynamicTolerance === 'stable' && knownPerfusion && noPressor && !unstable && !perfusionConcern && !conflict;
  const missingData: string[] = [];
  if (s.mapMmHg === undefined) missingData.push('MAP 與趨勢');
  if (s.norepinephrineEquivalentMcgKgMin === undefined || s.vasopressorTrend === undefined) missingData.push('升壓劑劑量與趨勢');
  if (s.lactateMmolL === undefined) missingData.push('lactate 與灌流評估');
  if (s.intracranialPressureRisk === undefined) missingData.push('顱內壓／急性腦損傷風險');
  if (s.hemodynamicTolerance === undefined) missingData.push('血流動力耐受性評估');
  if (s.rapidSoluteClearanceNeeded === undefined) missingData.push('是否需快速溶質清除');
  if (s.preciseFluidElectrolyteControlNeeded === undefined) missingData.push('是否需精密液體／電解質控制');
  const precision = s.preciseFluidElectrolyteControlNeeded === true || s.requiresControlledSodiumCorrection === true;
  const option = unstable || s.intracranialPressureRisk === true || precision ? 'CRRT review'
    : stable && s.intracranialPressureRisk === false && s.preciseFluidElectrolyteControlNeeded === false ? 'IHD review'
      : s.hemodynamicTolerance === 'intermediate' && knownPerfusion && !perfusionConcern && s.intracranialPressureRisk === false && s.preciseFluidElectrolyteControlNeeded === false ? 'PIRRT review'
        : '資料不足或衝突，暫不偏好單一模式';
  const decisions: DecisionResult[] = [{
    id: 'krt-modality-selection', severity: unstable || conflict || perfusionConcern ? 'warning' : 'monitor',
    conclusion: `若 KRT 適應症另經確認：${option}；僅供團隊討論，非機器處方`,
    evidence: [
      'KDIGO 最終指引支持不穩定／顱內壓風險時 CRRT 選項；本機穩定篩檢為 local convention；各模式無已證實存活優勢',
      `耐受性 ${s.hemodynamicTolerance ?? '未知'}；MAP ${s.mapMmHg ?? '未知'} mmHg；升壓劑 ${s.norepinephrineEquivalentMcgKgMin ?? '未知'} mcg/kg/min；趨勢 ${s.vasopressorTrend ?? '未知'}；lactate ${s.lactateMmolL ?? '未知'} mmol/L`,
      `CRT ${s.capillaryRefillSeconds ?? '未知'} s；mottling ${s.skinMottling ?? '未知'}；周邊溫度 ${s.peripheralTemperature ?? '未知'}；意識 ${s.mentalStatus ?? '未知'}`,
      `顱內壓風險 ${s.intracranialPressureRisk ?? '未知'}；快速清除需求 ${s.rapidSoluteClearanceNeeded ?? '未知'}；精密控制需求 ${precision ? '已確認' : s.preciseFluidElectrolyteControlNeeded === false ? '未見' : '未知'}`,
      ...(conflict ? ['穩定標籤與 MAP／升壓／灌流資料衝突；不可優先套用 IHD'] : []),
    ],
    missingData,
    actions: ['由臨床醫師先確認 KRT 適應症，再整合血流動力、清除速度、顱內壓與液體／電解質控制目標重評模式',
      '穩定且需快速清除可討論 IHD；中間耐受性可討論 PIRRT；不穩定、顱內壓風險或精密控制可討論 CRRT，快速清除與腦／循環風險衝突時需專科權衡',
      '連續監測耐受性與治療中斷；循環、氧合、神經或電解質惡化時立即重評，不因機器可用就開始 CRRT'],
    reassessWithinHours: unstable || conflict || perfusionConcern ? 0.25 : 1,
    counterfactuals: ['若循環轉穩且需快速清除，可重新討論 IHD／PIRRT；若 ICP 風險、循環惡化或需要精密控制，重新討論 CRRT；模式偏好永不構成啟動適應症'],
    sourceIds: ['KDIGO_2012', 'APP_KRT_SAFETY_V1'],
  }, {
    id: 'krt-modality-mechanisms', severity: 'monitor', conclusion: 'CVVHD／CVVH／CVVHDF 是機制選項，無已證實存活優勢',
    evidence: ['CVVHD 以擴散為主；CVVH 以對流為主；CVVHDF 結合擴散與對流；機制不等同臨床結局優越'],
    missingData: [], actions: ['由臨床醫師依溶質、液體目標及可實際交付劑量選擇；此比較非機器處方'],
    counterfactuals: ['若有效交付下降、頻繁停機或清除需求改變，重評方法與交付，不因模式名稱推論存活效益'], sourceIds: ['KDIGO_2012'],
  }];
  for (const decision of decisions) resolveRuleSources(decision.id, decision.sourceIds);
  return decisions;
}

/** No universal plumbing choice is inferred from pressures or anticoagulation. */
export function evaluateEcmoConnection(s: ClinicalSnapshot): DecisionResult[] {
  if (!s.onEcmo) return [];
  const missingData: string[] = [];
  if (s.ecmoConnection === undefined || s.ecmoConnection === 'not-established') missingData.push('既有／擬議 ECMO–CRRT 接法與迴路圖');
  if (!Number.isFinite(s.ecmoAccessPressureMmHg) || !Number.isFinite(s.ecmoReturnPressureMmHg) || s.ecmoPressureCompatibilityReviewed !== true) missingData.push('接入／回輸壓力與機器相容性確認');
  if (s.ecmoAirRiskReviewed !== true) missingData.push('空氣進入／回流與氣栓風險確認');
  if (s.ecmoFlowLMin === undefined || !Number.isFinite(s.ecmoFlowLMin) || s.ecmoFlowLMin <= 0) missingData.push('ECMO 有效病人流量及分流／再循環評估');
  if (s.ecmoAnticoagulation === undefined) missingData.push('ECMO 抗凝與 CRRT 抗凝重疊／出血風險');
  if (s.anticoagulation === undefined) missingData.push('CRRT 抗凝選擇與 ECMO 抗凝重疊／出血風險');
  const decision: DecisionResult = {
    id: 'ecmo-krt-connection', severity: 'warning',
    conclusion: `${missingData.length > 0 ? '資料未齊／安全尚未確認，不選定接法' : '目前記錄仍需團隊複核接法'}；非接管指令，非 KRT 啟動適應症`,
    evidence: [
      '獨立導管：可獨立操作與中斷、較少干擾 ECMO；增加血管通路、置管出血／感染風險與通路競爭',
      '整合 ECMO 迴路：可能免除額外導管；需處理壓力／警報相容性、空氣、分流／再循環、流量及相互中斷風險',
      `接法 ${s.ecmoConnection ?? '未知'}；接入壓力 ${s.ecmoAccessPressureMmHg ?? '未知'} mmHg；回輸壓力 ${s.ecmoReturnPressureMmHg ?? '未知'} mmHg；流量 ${s.ecmoFlowLMin ?? '未知'} L/min`,
      `ECMO 抗凝 ${s.ecmoAnticoagulation ?? '未知'}；CRRT 抗凝 ${s.anticoagulation ?? '未知'}；ECMO 抗凝不保證 CRRT 濾器壽命`,
      '抗凝與監測檢核為本機安全 convention；ELSO 成人技術段落支援接法風險比較，非存活效益或通用接管法',
    ], missingData,
    actions: [
      '由重症／腎臟團隊與灌流師依實際迴路圖、廠商許可與本地流程共同複核；不可自行旁路壓力／空氣警報',
      '核對流量、再循環、停機時間及有效交付劑量／淨液體平衡；ECMO 主迴路流量不等同 CRRT 清除劑量',
      '追蹤溶血、濾器凝血及 TMP 趨勢；TMP 升高不能單獨證明需要加強抗凝',
      '複核重疊抗凝、出血風險與濾器壽命；預先規劃濾器更換、ECMO／CRRT 中斷及緊急分離的團隊處置',
    ],
    counterfactuals: ['若出現壓力不相容、空氣／流量問題、溶血、凝血、出血或頻繁中斷，立即團隊複核安全及改用獨立／整合路徑的取捨；不得以 ECMO 抗凝取代濾器監測'],
    sourceIds: ['ELSO_FLUID_AKI_2022', 'APP_KRT_SAFETY_V1'],
  };
  resolveRuleSources(decision.id, decision.sourceIds);
  return [decision];
}
