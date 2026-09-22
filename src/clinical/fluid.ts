import { clinicalSnapshotSchema } from '../data/schema';
import { resolveRuleSources } from './sources';
import type { ClinicalSnapshot, DecisionResult } from './types';

type RosePhase = 'resuscitation' | 'optimization' | 'stabilization' | 'evacuation';
type Axis = boolean | 'unknown';
const localSource = 'APP_FLUID_SAFETY_V1';
const localNotice = 'app-local 安全篩檢與操作性閾值，非經驗證治療指令；需臨床醫師確認';
const supportRank = { 'room-air': 0, 'conventional-oxygen': 1, 'high-flow-nasal-oxygen': 2, 'noninvasive-ventilation': 3, 'invasive-ventilation': 4 };

function assess(snapshot: ClinicalSnapshot, previous?: ClinicalSnapshot) {
  clinicalSnapshotSchema.parse(snapshot);
  let recent = previous;
  const trajectoryMissing: string[] = [];
  if (previous) {
    clinicalSnapshotSchema.parse(previous);
    const hours = (Date.parse(snapshot.timestamp) - Date.parse(previous.timestamp)) / 3_600_000;
    if (snapshot.caseId !== previous.caseId || hours <= 0) throw new Error('Previous snapshot must be earlier and belong to the same case');
    if (hours > 6) {
      recent = undefined;
      trajectoryMissing.push('近期 ≤6 h 可比較趨勢（app-local lookback；舊資料不可作為目前穩定證據）');
    }
  }
  const pressorsRising = snapshot.vasopressorTrend === 'worsening'
    || (recent?.norepinephrineEquivalentMcgKgMin !== undefined && snapshot.norepinephrineEquivalentMcgKgMin !== undefined
      && snapshot.norepinephrineEquivalentMcgKgMin > recent.norepinephrineEquivalentMcgKgMin);
  const pressorConflict = pressorsRising && snapshot.vasopressorTrend !== undefined && snapshot.vasopressorTrend !== 'worsening';
  const oxygenWorsening = (recent?.pao2Fio2RatioMmHg !== undefined && snapshot.pao2Fio2RatioMmHg !== undefined
    && snapshot.pao2Fio2RatioMmHg < recent.pao2Fio2RatioMmHg)
    || (recent?.respiratorySupport !== undefined && snapshot.respiratorySupport !== undefined
      && supportRank[snapshot.respiratorySupport] > supportRank[recent.respiratorySupport]);
  const hypotension = snapshot.mapMmHg !== undefined && snapshot.mapMmHg < 65;
  const lactateRising = recent?.lactateMmolL !== undefined && snapshot.lactateMmolL !== undefined
    && snapshot.lactateMmolL > recent.lactateMmolL;
  const perfusionConcern = hypotension || pressorsRising
    || (snapshot.lactateMmolL !== undefined && snapshot.lactateMmolL > 2)
    || (snapshot.capillaryRefillSeconds !== undefined && snapshot.capillaryRefillSeconds > 3)
    || lactateRising || snapshot.skinMottling === true || snapshot.peripheralTemperature === 'cool'
    || snapshot.mentalStatus === 'altered' || snapshot.mentalStatus === 'unresponsive';
  const perfusionMissing: string[] = [...trajectoryMissing];
  if (snapshot.mapMmHg === undefined) perfusionMissing.push('目前 MAP 與個別灌流目標');
  if (snapshot.lactateMmolL === undefined) perfusionMissing.push('Lactate 與灌流趨勢');
  if (snapshot.capillaryRefillSeconds === undefined) perfusionMissing.push('CRT／周邊灌流');
  if (snapshot.norepinephrineEquivalentMcgKgMin === undefined) perfusionMissing.push('目前 NE-equivalent 劑量');
  if (snapshot.vasopressorTrend === undefined) perfusionMissing.push('升壓劑趨勢');
  const stable = !perfusionConcern && perfusionMissing.length === 0;
  const congestion = snapshot.pulmonaryEdema === true || snapshot.lungBLines === 'bilateral-diffuse'
    || (snapshot.vexusGrade !== undefined && snapshot.vexusGrade >= 2);
  const accumulation = (snapshot.cumulativeFluidBalanceMl !== undefined && snapshot.cumulativeFluidBalanceMl > 0)
    || (snapshot.bodyWeightChangeKg !== undefined && snapshot.bodyWeightChangeKg > 0);
  const balanceConflict = snapshot.cumulativeFluidBalanceMl !== undefined && snapshot.bodyWeightChangeKg !== undefined
    && snapshot.cumulativeFluidBalanceMl * snapshot.bodyWeightChangeKg < 0;
  const cardiacUncertainty = snapshot.rvFunction === 'impaired' || snapshot.rvDilation === true || snapshot.lvSystolicFunction === 'severely-reduced';
  const oxygenUncertainty = snapshot.pao2Fio2RatioMmHg === undefined
    ? snapshot.respiratorySupport !== 'room-air' : snapshot.pao2Fio2RatioMmHg < 200;
  const tolerance: Axis = congestion || oxygenWorsening ? false : cardiacUncertainty || oxygenUncertainty ? 'unknown'
    : snapshot.pulmonaryEdema === false && snapshot.lungBLines === 'absent' && snapshot.vexusGrade === 0 ? true : 'unknown';
  const measuredResponses = [snapshot.vtiResponsePercent, snapshot.strokeVolumeResponsePercent].filter((value): value is number => value !== undefined);
  const allPositive = measuredResponses.length > 0 && measuredResponses.every(value => value >= 10);
  const allNegative = measuredResponses.length > 0 && measuredResponses.every(value => value < 10);
  const responsive: Axis = snapshot.passiveLegRaiseResult === 'responsive' && allPositive ? true
    : snapshot.passiveLegRaiseResult === 'nonresponsive' && allNegative ? false : 'unknown';
  const phase: RosePhase = hypotension || pressorsRising ? 'resuscitation'
    : !stable || oxygenWorsening ? 'optimization'
      : congestion && accumulation && !balanceConflict ? 'evacuation' : 'stabilization';
  const lactateTrend = lactateRising ? `${recent!.lactateMmolL} → ${snapshot.lactateMmolL} mmol/L；上升需複核，非單獨低灌流診斷` : '近期 lactate 上升未證實';
  return { pressorConflict, oxygenWorsening, oxygenUncertainty, cardiacUncertainty, lactateTrend, perfusionConcern, perfusionMissing, balanceConflict, tolerance, responsive, phase };
}

/** Tentative phase only: consume fluid-rose from evaluateFluid for uncertainty/context. */
export function classifyRosePhase(snapshot: ClinicalSnapshot): RosePhase {
  return assess(snapshot).phase;
}

/** Pure advisory rules. No volume, dose, machine setting or executable order is emitted. */
export function evaluateFluid(snapshot: ClinicalSnapshot, previous?: ClinicalSnapshot): DecisionResult[] {
  const state = assess(snapshot, previous);
  const responsiveMissing = state.responsive === 'unknown' ? ['可解讀且一致的 PLR + 即時 VTI/SV 變化；確認量測品質及試驗時序'] : [];
  const toleranceMissing: string[] = [];
  if (snapshot.pulmonaryEdema === undefined) toleranceMissing.push('肺水腫評估');
  if (snapshot.lungBLines === undefined || snapshot.lungBLines === 'focal') toleranceMissing.push('可解讀的肺超音波 B-lines 與病因');
  if (snapshot.vexusGrade === undefined || snapshot.vexusGrade === 1) toleranceMissing.push('完整靜脈充血／VExUS 評估');
  if (state.oxygenUncertainty) toleranceMissing.push('氧合及呼吸支持趨勢；P/F <200 或補氧中缺少 P/F 需進一步確認耐受性（app-local，不等同肺水腫）');
  if (state.cardiacUncertainty) toleranceMissing.push('LV/RV 功能異常的血流動力影響與輸液耐受性需床邊複核');
  const accumulationMissing: string[] = [];
  if (snapshot.cumulativeFluidBalanceMl === undefined) accumulationMissing.push('累積液體平衡及記錄期間');
  if (snapshot.bodyWeightChangeKg === undefined) accumulationMissing.push('相對同一基準的體重變化');
  const balanceMissing = [...accumulationMissing];
  if (snapshot.urineVolumeMl === undefined) balanceMissing.push('尿量（未量測不可視為無尿）');
  if (snapshot.urineObservationHours === undefined) balanceMissing.push('尿量觀察時數');
  const challenge = state.responsive === true && state.tolerance === true && state.perfusionConcern;
  const conflict = state.responsive === true && state.tolerance === false;
  const urgent = state.perfusionConcern || state.tolerance === false;
  const dynamicEvidence = [
    `PLR ${snapshot.passiveLegRaiseResult ?? '未知'}；VTI 變化 ${snapshot.vtiResponsePercent ?? '未知'}%；SV 變化 ${snapshot.strokeVolumeResponsePercent ?? '未知'}%`,
    'app-local：PLR + VTI/SV 增加 ≥10% 且標記一致視為陽性；試驗方法與精確度需現場確認，非所有動態試驗通用閾值',
    `CVP ${snapshot.cvpMmHg ?? '未知'} mmHg；IVC ${snapshot.ivcDiameterMm ?? '未知'} mm／變異 ${snapshot.ivcRespiratoryVariationPercent ?? '未知'}%；CVP 或 IVC 單獨不能觸發輸液`,
  ];
  const toleranceEvidence = [
    `肺水腫 ${snapshot.pulmonaryEdema ?? '未知'}；B-lines ${snapshot.lungBLines ?? '未知'}；VExUS ${snapshot.vexusGrade ?? '未知'}`,
    `P/F ${snapshot.pao2Fio2RatioMmHg ?? '未知'} mmHg；呼吸支持 ${snapshot.respiratorySupport ?? '未知'}；近期氧合惡化 ${state.oxygenWorsening ? '有訊號' : '未證實（不代表排除）'}`,
    `LV ${snapshot.lvSystolicFunction ?? '未知'}；RV ${snapshot.rvFunction ?? '未知'}；RV 擴張 ${snapshot.rvDilation ?? '未知'}`,
    'app-local：肺水腫、雙側瀰漫 B-lines、VExUS ≥2 或近期氧合惡化為安全警示；不是病因診斷或單獨去除液體適應症',
  ];
  const perfusionEvidence = [
    `MAP ${snapshot.mapMmHg ?? '未知'} mmHg；lactate ${snapshot.lactateMmolL ?? '未知'} mmol/L；CRT ${snapshot.capillaryRefillSeconds ?? '未知'} s`,
    `NE-equivalent ${snapshot.norepinephrineEquivalentMcgKgMin ?? '未知'} mcg/kg/min；趨勢 ${snapshot.vasopressorTrend ?? '未知'}${state.pressorConflict ? '；數值上升與標記不一致，安全上採惡化訊號' : ''}`,
    `${state.lactateTrend}；mottling ${snapshot.skinMottling ?? '未知'}；周邊溫度 ${snapshot.peripheralTemperature ?? '未知'}；意識 ${snapshot.mentalStatus ?? '未知'}`,
    'app-local：MAP <65、lactate >2 或 CRT >3 為灌流複核觸發點，不等同休克確診或個別治療目標；數值趨勢限同案 ≤6 h',
  ];
  const balanceEvidence = [
    `累積平衡 ${snapshot.cumulativeFluidBalanceMl ?? '未知'} mL；體重變化 ${snapshot.bodyWeightChangeKg ?? '未知'} kg；正值不等同血管內充足或自動去除指令`,
    snapshot.urineVolumeMl === 0 && snapshot.urineObservationHours !== undefined
      ? `已記錄無尿：0 mL / ${snapshot.urineObservationHours} h；需核對收集、導尿管通暢及病因，不自動輸液或啟動 KRT`
      : `尿量 ${snapshot.urineVolumeMl ?? '未知'} mL / ${snapshot.urineObservationHours ?? '未知'} h`,
    ...(state.balanceConflict ? ['累積平衡與體重方向不一致；核實計量、時間窗與基準'] : []),
  ];
  const decisions: DecisionResult[] = [
    {
      id: 'fluid-dynamic-assessment', severity: 'monitor',
      conclusion: `Fluid responsiveness：${state.responsive === true ? '陽性' : state.responsive === false ? '陰性' : '未知／資料缺失、矛盾或不可解讀'}；不等同輸液適應症`,
      evidence: dynamicEvidence, missingData: responsiveMissing,
      actions: ['優先床邊 PLR + 即時 VTI/SV；確認同一試驗、節律、姿勢及量測品質；不可依 CVP／IVC 單獨決策'],
      counterfactuals: ['若重測 PLR/VTI/SV 不一致，維持未知並重新評估；陰性不等同不需要其他灌流支持'],
      sourceIds: ['SSC_2026', localSource],
    },
    {
      id: 'fluid-tolerance', severity: state.tolerance === false ? 'warning' : 'monitor',
      conclusion: `Fluid tolerance：${state.tolerance === false ? '不佳／安全警示' : state.tolerance === true ? '目前未見肺／靜脈不耐受訊號，仍非安全保證' : '未知'}；與 responsiveness 分開判讀`,
      evidence: toleranceEvidence, missingData: toleranceMissing,
      actions: ['複核肺部、心臟及靜脈 POCUS、氧合與 LV/RV 功能；B-lines／氧合下降可能有非容量病因'],
      counterfactuals: ['若出現新肺水腫、氧合惡化或靜脈充血，即使 PLR 陽性也須停止並重評輸液'],
      sourceIds: [localSource],
    },
    {
      id: 'fluid-plan', severity: urgent ? 'warning' : 'monitor',
      conclusion: challenge ? '經臨床醫師床邊確認後，可考慮小量監測 fluid challenge；非自動 bolus 指令'
        : `不可直接追加輸液：${conflict ? 'responsiveness 與 tolerance 衝突' : '反應性、耐受性或灌流需要尚未同時支持'}`,
      evidence: [localNotice, ...dynamicEvidence, ...toleranceEvidence, ...perfusionEvidence], missingData: [...responsiveMissing, ...toleranceMissing, ...state.perfusionMissing],
      actions: [
        ...(challenge ? ['臨床醫師決定是否進行小量 challenge；先設定 VTI/SV 上升及個別 MAP／CRT 改善目標，連續監測並於每次試驗後立即重評'] : ['先重測 PLR + VTI/SV、肺／靜脈 POCUS 與床邊灌流；未釐清前不開立 bolus']),
        '重新確認 shock phenotype 並考慮升壓或去充血策略',
        '若 VTI/SV 或灌流未改善、氧合下降、新肺水腫／B-lines／充血或升壓需求增加，停止追加液體並立即重評',
      ],
      reassessWithinHours: urgent || challenge ? 0.25 : 1,
      counterfactuals: ['只有重測反應性、耐受性與灌流需求一致時才重新考慮 challenge；無尿或低 CVP 不足以推翻停止規則'],
      sourceIds: [localSource],
    },
    {
      id: 'fluid-rose', severity: state.perfusionConcern ? 'warning' : 'monitor',
      conclusion: `ROSE 暫定 ${state.phase}；僅為目前評估框架，非以 sepsis 經過時數決定的治療階段`,
      evidence: [localNotice, ...perfusionEvidence, ...balanceEvidence, ...toleranceEvidence], missingData: [...state.perfusionMissing, ...toleranceMissing, ...accumulationMissing],
      actions: ['整合灌流、升壓趨勢、累積平衡與充血重評 ROSE；不明資料回到 optimization 評估，不能宣稱穩定'],
      reassessWithinHours: state.perfusionConcern ? 0.25 : 1,
      counterfactuals: ['若 MAP 下降或升壓劑增加，回到 resuscitation 複核；evacuation 必須重新確認穩定與去除耐受性'],
      sourceIds: [localSource],
    },
    {
      id: 'fluid-balance', severity: 'monitor',
      conclusion: '液體累積／體重／尿量為情境證據，不等同輸液、利尿或 KRT 指令',
      evidence: [localNotice, ...balanceEvidence], missingData: balanceMissing,
      actions: ['核對同一時間窗輸入、輸出、隱性輸液、體重基準與尿量收集；整合充血、氧合及灌流'],
      counterfactuals: ['若計量不可靠、體重和平衡不一致或尿量區間缺失，不能由單一數值判定容量需求'],
      sourceIds: [localSource],
    },
    {
      id: 'fluid-ufnet', severity: state.perfusionConcern ? 'warning' : 'monitor',
      conclusion: state.perfusionConcern ? 'UFNET 0 作為不穩定／灌流風險期的安全討論預設；非機器處方'
        : state.phase === 'evacuation' ? '可考慮漸進去復甦：需臨床醫師確認穩定充血與去除耐受性；非機器處方'
          : '資料未支持去復甦升階；不自動設定 UFNET 或啟動 KRT；非機器處方',
      evidence: [localNotice, ...perfusionEvidence, ...toleranceEvidence, ...balanceEvidence], missingData: [...state.perfusionMissing, ...balanceMissing],
      actions: [
        state.phase === 'evacuation' ? '由臨床醫師評估減少非必要輸入、利尿反應及是否需 KRT；個別訂定漸進去除策略，不提供自動速率'
          : '不因液體正平衡自行增加 UFNET；不穩定時先立即床邊複核灌流與病因，再由臨床醫師調整既有療程',
        '去除過程連續監測 MAP、升壓劑、CRT、lactate 與氧合；若 MAP／灌流下降或升壓需求增加，停止去除升階並立即重評，必要時由臨床醫師暫停去除',
      ],
      reassessWithinHours: state.perfusionConcern ? 0.25 : 1,
      counterfactuals: ['若升壓或灌流惡化，即使充血持續也不能自動增加去除；生命威脅肺水腫需立即專科評估，不能機械套用 UFNET 預設'],
      sourceIds: [localSource],
    },
  ];
  for (const decision of decisions) resolveRuleSources(decision.id, decision.sourceIds);
  return decisions;
}
