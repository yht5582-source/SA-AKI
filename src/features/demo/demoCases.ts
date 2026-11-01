import type { ClinicalSnapshot, PatientCase } from '../../clinical/types';

/** Fictional teaching data. Every engine result shown beside it is computed live, never written here. */
export const DEMO_ID_PREFIX = 'demo-';
export const isDemoCase = (caseId: string) => caseId.startsWith(DEMO_ID_PREFIX);

export interface DemoTimepoint {
  snapshot: ClinicalSnapshot;
  label: string;
  /** What happened at the bedside; carries the facts the numbers cannot. */
  story: string;
  /** Asked before the engine output is revealed. */
  prompt: string;
  /** Read after the reveal: why the output is what it is. */
  teaching: string;
}

export interface DemoCase {
  id: string;
  title: string;
  oneLine: string;
  tags: string[];
  learningPoints: string[];
  patient: PatientCase;
  timepoints: DemoTimepoint[];
}

const ISO = (ms: number) => new Date(ms).toISOString();
const clock = (onset: string) => {
  const start = Date.parse(onset);
  return (hours: number) => ISO(start + hours * 3_600_000);
};
type Observation = Omit<ClinicalSnapshot, 'id' | 'caseId' | 'timestamp' | 'hoursFromSepsisOnset' | 'onEcmo'>;
const observe = (caseId: string, at: (hours: number) => string, hours: number, values: Observation): ClinicalSnapshot => ({
  id: `${caseId}-${hours}h`, caseId, timestamp: at(hours), hoursFromSepsisOnset: hours, onEcmo: false, ...values,
});

// Explicitly assessed negatives: an unassessed item stays unknown and would keep the KRT screen open.
const noRareIndication = { lifeThreateningElectrolyteDisturbance: false, dialyzableToxin: false, requiresControlledSodiumCorrection: false };
const modeScreen = { intracranialPressureRisk: false, preciseFluidElectrolyteControlNeeded: false };

const t1Onset = '2026-03-02T00:00:00Z';
const t1At = clock(t1Onset);
const t1Id = `${DEMO_ID_PREFIX}t1`;
const t1Urine = { urineWeightBasis: 'actual' as const, urineNormalizationWeightKg: 72, diureticExposure: false };

const t2Onset = '2026-03-09T00:00:00Z';
const t2At = clock(t2Onset);
const t2Id = `${DEMO_ID_PREFIX}t2`;
const t2Urine = { urineWeightBasis: 'actual' as const, urineNormalizationWeightKg: 58, diureticExposure: false };

const t3Onset = '2026-03-16T00:00:00Z';
const t3At = clock(t3Onset);
const t3Id = `${DEMO_ID_PREFIX}t3`;
const t3Urine = { urineWeightBasis: 'actual' as const, urineNormalizationWeightKg: 96 };

const t4Onset = '2026-03-23T00:00:00Z';
const t4At = clock(t4Onset);
const t4Id = `${DEMO_ID_PREFIX}t4`;
const t4Common = {
  urineWeightBasis: 'actual' as const, urineNormalizationWeightKg: 75, diureticExposure: false,
  crrtMode: 'CVVHDF' as const, crrtStartedTimestamp: t4At(20), respiratorySupport: 'room-air' as const,
  ...noRareIndication, uremicManifestations: [],
};
const t4Ready = {
  originalIndicationResolved: true, nativeSoluteControlAdequate: true, nativeFluidBalanceAdequate: true,
  observationAdequate: true, downtimeReviewed: true,
  monitoringPlan: { urineOutput: true, fluidBalance: true, electrolytesAcidBase: true, respiratoryHemodynamic: true, restartTriggersReviewed: true, reviewWithinHours: 4 },
};

const t5Onset = '2026-03-30T00:00:00Z';
const t5At = clock(t5Onset);
const t5Id = `${DEMO_ID_PREFIX}t5`;
const t5Urine = { urineWeightBasis: 'actual' as const, urineNormalizationWeightKg: 62, diureticExposure: false };

const t6Onset = '2026-04-06T00:00:00Z';
const t6At = clock(t6Onset);
const t6Id = `${DEMO_ID_PREFIX}t6`;
const t6Common = {
  urineWeightBasis: 'actual' as const, urineNormalizationWeightKg: 80, diureticExposure: false,
  ...noRareIndication, ...modeScreen, uremicManifestations: [],
  potassiumMmolL: 6.8, refractoryHyperkalemia: true, arterialPh: 7.22, bicarbonateMmolL: 15, pulmonaryEdema: false,
  rapidSoluteClearanceNeeded: true,
};

export const demoCases: DemoCase[] = [
  {
    id: t1Id,
    title: 'KDIGO 第 3 期，卻不必急著透析',
    oneLine: '肺炎併敗血性休克；分期一路上升，但始終沒有確立的透析適應症。',
    tags: ['監測下延後', '輸液反應性'],
    learningPoints: [
      'AKI 分期、BUN、少尿本身都不是透析適應症。',
      'SSC 2026 建議無確定適應症時不做 RRT；STARRT-AKI 也未顯示提早透析改善 90 天死亡。',
      '輸液要同時看反應性、耐受性與灌流需求，三者一致才考慮小量 challenge。',
    ],
    patient: {
      id: t1Id, anonymousCode: '示範-T1', ageRange: '65-79', sex: 'male', heightCm: 170, actualWeightKg: 72,
      infectionSource: 'pulmonary', sepsisOnsetTimestamp: t1Onset, shockOnsetTimestamp: t1At(2),
      baselineCreatinineMgDl: 1, baselineCreatinineSource: 'measured-outpatient',
      baselineCreatinineTimestamp: t1At(-72), baselineCreatinineConfidence: 'high',
    },
    timepoints: [
      {
        label: '6 小時', prompt: '現在可以再給一次輸液嗎？要符合哪些條件？',
        story: '肺炎致敗血性休克，已用抗生素、norepinephrine 維持。肢端冰冷、CRT 4 秒。床邊 PLR 測得 VTI 上升 14%，肺超音波無 B-lines，VExUS 0。',
        teaching: '反應性陽性、未見肺或靜脈不耐受、且仍有灌流問題，三者同時成立，工具才提示「可考慮小量監測 challenge」。這不是自動 bolus，要先訂好 VTI／MAP／CRT 目標，並於每次試驗後重評。',
        snapshot: observe(t1Id, t1At, 6, {
          ...t1Urine, actualWeightKg: 72, creatinineMgDl: 1.7, bunMgDl: 34, urineVolumeMl: 150, urineObservationHours: 6,
          mapMmHg: 66, norepinephrineEquivalentMcgKgMin: 0.18, vasopressorTrend: 'unchanged', lactateMmolL: 3.4, capillaryRefillSeconds: 4, peripheralTemperature: 'cool', mentalStatus: 'alert',
          passiveLegRaiseResult: 'responsive', vtiResponsePercent: 14, pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0,
          respiratorySupport: 'conventional-oxygen', pao2Fio2RatioMmHg: 280, cumulativeFluidBalanceMl: 2100, bodyWeightChangeKg: 1.5,
          potassiumMmolL: 4.8, arterialPh: 7.3, bicarbonateMmolL: 18, uremicManifestations: [], ...noRareIndication,
        }),
      },
      {
        label: '30 小時', prompt: 'SCr 3.2、BUN 88、24 小時尿量只有 300 mL。該開始透析嗎？',
        story: '休克改善、升壓劑下降。SCr 升到 3.2 mg/dL，24 小時尿量 300 mL。血鉀 5.3、pH 7.29，無肺水腫，無尿毒併發症。',
        teaching: '已是 KDIGO 第 3 期，但高血鉀、酸血症、肺水腫、尿毒併發症都未達「危及生命或難治」。因此工具建議目前不開始，改為密切監測並設定重評時間。分期回答的是「腎傷多重」，不是「要不要透析」。',
        snapshot: observe(t1Id, t1At, 30, {
          ...t1Urine, actualWeightKg: 74, creatinineMgDl: 3.2, bunMgDl: 88, urineVolumeMl: 300, urineObservationHours: 24,
          mapMmHg: 72, norepinephrineEquivalentMcgKgMin: 0.08, vasopressorTrend: 'improving', lactateMmolL: 1.7, capillaryRefillSeconds: 2.5, peripheralTemperature: 'warm', mentalStatus: 'alert',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'conventional-oxygen', pao2Fio2RatioMmHg: 260, cumulativeFluidBalanceMl: 3200, bodyWeightChangeKg: 2,
          potassiumMmolL: 5.3, arterialPh: 7.29, bicarbonateMmolL: 17, uremicManifestations: [], ...noRareIndication,
        }),
      },
      {
        label: '54 小時', prompt: '延後策略等到了什麼？下一步還要看什麼？',
        story: '已停升壓劑，未透析。尿量回升至 24 小時 720 mL，SCr 3.0，血鉀 4.9，pH 7.35。',
        teaching: '這次等待避開了一次透析。但尿量回升不代表腎功能已恢復；分期仍以 SCr 倍數計，需繼續追蹤 SCr、液體平衡，並依 KDIGO 於 3 個月評估腎功能恢復或 CKD。',
        snapshot: observe(t1Id, t1At, 54, {
          ...t1Urine, actualWeightKg: 73, creatinineMgDl: 3, bunMgDl: 92, urineVolumeMl: 720, urineObservationHours: 24,
          mapMmHg: 78, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'improving', lactateMmolL: 1.2, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'room-air', pao2Fio2RatioMmHg: 320, cumulativeFluidBalanceMl: 3000, bodyWeightChangeKg: 1.5,
          potassiumMmolL: 4.9, arterialPh: 7.35, bicarbonateMmolL: 21, uremicManifestations: [], ...noRareIndication,
        }),
      },
    ],
  },
  {
    id: t2Id,
    title: '第 2 期就要透析：難治性高血鉀',
    oneLine: '泌尿道敗血性休克；分期不高，但內科治療後血鉀與酸血症仍惡化。',
    tags: ['立即評估 KRT', 'CRRT'],
    learningPoints: [
      '適應症看的是危及生命的併發症與治療反應，分期低不代表不需要透析。',
      '第一次高血鉀先「立即確認與治療」；確認難治後才升級為立即評估 KRT。',
      '循環不穩時傾向 CRRT，但快速清除需求與循環風險衝突，需專科權衡。',
    ],
    patient: {
      id: t2Id, anonymousCode: '示範-T2', ageRange: '65-79', sex: 'female', heightCm: 155, actualWeightKg: 58, ckdStage: 'G3a',
      infectionSource: 'urinary', sepsisOnsetTimestamp: t2Onset, shockOnsetTimestamp: t2At(1),
      baselineCreatinineMgDl: 1.3, baselineCreatinineSource: 'measured-outpatient',
      baselineCreatinineTimestamp: t2At(-96), baselineCreatinineConfidence: 'high',
    },
    timepoints: [
      {
        label: '4 小時', prompt: '血鉀 6.4、pH 7.24。工具會直接建議透析嗎？你現在先做什麼？',
        story: '阻塞性腎盂腎炎併休克，泌尿科安排引流。血鉀 6.4 mmol/L，心電圖 T 波高尖，治療才剛開始，尚無反應可評估。',
        teaching: '數值只觸發「立即確認」。此刻應排除採檢誤差、立即治療高血鉀並看反應。工具不因單一數值自動啟動透析，也不允許因資料未齊而延誤處置。',
        snapshot: observe(t2Id, t2At, 4, {
          ...t2Urine, actualWeightKg: 58, creatinineMgDl: 2.2, bunMgDl: 52, urineVolumeMl: 40, urineObservationHours: 4,
          mapMmHg: 63, norepinephrineEquivalentMcgKgMin: 0.3, vasopressorTrend: 'worsening', lactateMmolL: 5.2, capillaryRefillSeconds: 5, peripheralTemperature: 'cool', mentalStatus: 'altered',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'conventional-oxygen', pao2Fio2RatioMmHg: 240,
          potassiumMmolL: 6.4, arterialPh: 7.24, bicarbonateMmolL: 14, uremicManifestations: [], ...noRareIndication,
        }),
      },
      {
        label: '7 小時', prompt: '治療後血鉀 6.9、pH 7.16，仍近乎無尿。要透析嗎？選哪種模式？',
        story: '已給靜脈鈣、胰島素加葡萄糖與 bicarbonate，血鉀反升至 6.9，pH 7.16，團隊判定難治。norepinephrine 持續上調，MAP 61。',
        teaching: 'SCr 2.9 只到第 2 期，但已有經確認的難治高血鉀與酸血症，轉為立即評估 KRT。循環不穩傾向 CRRT，不過此病人也需要快速降鉀，兩者衝突時需由腎臟科與重症團隊權衡。兩件事先後分開：先確立適應症，再選模式。',
        snapshot: observe(t2Id, t2At, 7, {
          ...t2Urine, actualWeightKg: 59, creatinineMgDl: 2.9, bunMgDl: 61, urineVolumeMl: 20, urineObservationHours: 6,
          mapMmHg: 61, norepinephrineEquivalentMcgKgMin: 0.42, vasopressorTrend: 'worsening', lactateMmolL: 6.8, capillaryRefillSeconds: 5, peripheralTemperature: 'cool', mentalStatus: 'altered',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'conventional-oxygen', pao2Fio2RatioMmHg: 230,
          potassiumMmolL: 6.9, refractoryHyperkalemia: true, arterialPh: 7.16, refractoryAcidemia: true, bicarbonateMmolL: 11, uremicManifestations: [], ...noRareIndication,
          hemodynamicTolerance: 'unstable', rapidSoluteClearanceNeeded: true, ...modeScreen,
        }),
      },
    ],
  },
  {
    id: t3Id,
    title: 'PLR 陽性但肺已滿：液體過載與 CRRT 處方',
    oneLine: '腹腔敗血症術後；從反應性與耐受性衝突，一路走到 CVVHDF 處方與去復甦。',
    tags: ['難治肺水腫', 'CVVHDF 處方', 'RCA'],
    learningPoints: [
      '輸液反應性陽性不等於該輸液；耐受性不佳時應停止追加。',
      '處方量要補償停機與前稀釋；模型估算不能取代實際量到的交付劑量。',
      '循環穩定與充血同時存在，才考慮漸進去復甦，且要先訂好停止條件。',
    ],
    patient: {
      id: t3Id, anonymousCode: '示範-T3', ageRange: '40-64', sex: 'male', heightCm: 178, actualWeightKg: 96,
      infectionSource: 'abdominal', sepsisOnsetTimestamp: t3Onset, shockOnsetTimestamp: t3At(3),
      baselineCreatinineMgDl: 1, baselineCreatinineSource: 'measured-inpatient',
      baselineCreatinineTimestamp: t3At(-48), baselineCreatinineConfidence: 'high',
    },
    timepoints: [
      {
        label: '24 小時', prompt: 'PLR 後 VTI 上升 12%，同時 P/F 148、VExUS 2。還要再輸液嗎？',
        story: '腸穿孔術後插管。累積正平衡 9.2 L，體重增 7.5 kg。PLR 測得 VTI 上升 12%，但雙側瀰漫 B-lines、VExUS 2、P/F 148。',
        teaching: '反應性與耐受性是兩個獨立問題。此時反應性陽性、耐受性不佳，工具明確判定不可直接追加。肺水腫併低氧也已觸發「立即確認」，下一步是試利尿並評估反應，不是再給液。',
        snapshot: observe(t3Id, t3At, 24, {
          ...t3Urine, diureticExposure: false, actualWeightKg: 103, creatinineMgDl: 2.6, bunMgDl: 58, urineVolumeMl: 460, urineObservationHours: 12,
          mapMmHg: 68, norepinephrineEquivalentMcgKgMin: 0.2, vasopressorTrend: 'unchanged', lactateMmolL: 2.6, capillaryRefillSeconds: 3, peripheralTemperature: 'warm', mentalStatus: 'sedated',
          passiveLegRaiseResult: 'responsive', vtiResponsePercent: 12, pulmonaryEdema: true, lungBLines: 'bilateral-diffuse', vexusGrade: 2,
          respiratorySupport: 'invasive-ventilation', pao2Fio2RatioMmHg: 148, cumulativeFluidBalanceMl: 9200, bodyWeightChangeKg: 7.5,
          potassiumMmolL: 5.1, arterialPh: 7.31, bicarbonateMmolL: 19, uremicManifestations: [], ...noRareIndication,
        }),
      },
      {
        label: '30 小時', prompt: '利尿無效、P/F 降到 122。適應症成立了嗎？模式怎麼選？',
        story: '高劑量 loop diuretic 反應差，呼吸器已調整，P/F 仍降至 122，團隊確認對內科與呼吸支持皆難治。需要精準控制脫水。',
        teaching: '「水腫、P/F ≤200、呼吸支持中、且確認難治」全部相符，工具才認定肺水腫適應症成立。需要精密液體控制且循環尚不穩，討論 CRRT。此時 UFNET 預設仍是 0：灌流未穩就不主動增加脫水。',
        snapshot: observe(t3Id, t3At, 30, {
          ...t3Urine, diureticExposure: true, actualWeightKg: 103, creatinineMgDl: 3, bunMgDl: 66, urineVolumeMl: 120, urineObservationHours: 6,
          mapMmHg: 67, norepinephrineEquivalentMcgKgMin: 0.2, vasopressorTrend: 'unchanged', lactateMmolL: 2.4, capillaryRefillSeconds: 3, peripheralTemperature: 'warm', mentalStatus: 'sedated',
          pulmonaryEdema: true, refractoryPulmonaryEdema: true, lungBLines: 'bilateral-diffuse', vexusGrade: 2,
          respiratorySupport: 'invasive-ventilation', pao2Fio2RatioMmHg: 122, cumulativeFluidBalanceMl: 9600, bodyWeightChangeKg: 7.8,
          potassiumMmolL: 5.4, arterialPh: 7.28, bicarbonateMmolL: 18, uremicManifestations: [], ...noRareIndication,
          hemodynamicTolerance: 'unstable', intracranialPressureRisk: false, rapidSoluteClearanceNeeded: false, preciseFluidElectrolyteControlNeeded: true,
        }),
      },
      {
        label: '36 小時', prompt: '設定 effluent 2,300 mL/h、校正體重 82 kg，等於有達到 25 mL/kg/h 嗎？可以開始脫水嗎？',
        story: 'CVVHDF 已跑 5 小時：Qb 180 mL/min、Hct 0.30、透析液 1,200、前稀釋 600、後稀釋 400、要求淨脫水 100 mL/h；局部 citrate，流程與監測已備妥。停機 1/12 小時，實測交付僅 19.5 mL/kg/h。灌流改善，升壓劑已下降。',
        teaching: '2,300 ÷ 82 ≈ 28 mL/kg/h 只是名目值；扣掉前稀釋與停機，模型估算約 23.8，而實測只有 19.5，低於 KDIGO 20–25 的交付目標，應回頭查停機與濾器，不要直接加量。灌流穩定且仍充血，ROSE 走到 evacuation，可由臨床醫師訂定漸進脫水與停止條件。',
        snapshot: observe(t3Id, t3At, 36, {
          ...t3Urine, diureticExposure: true, actualWeightKg: 103, creatinineMgDl: 2.4, bunMgDl: 49, urineVolumeMl: 60, urineObservationHours: 6,
          mapMmHg: 72, norepinephrineEquivalentMcgKgMin: 0.12, vasopressorTrend: 'improving', lactateMmolL: 1.8, capillaryRefillSeconds: 2.5, peripheralTemperature: 'warm', mentalStatus: 'sedated',
          pulmonaryEdema: true, lungBLines: 'bilateral-diffuse', vexusGrade: 2,
          respiratorySupport: 'invasive-ventilation', pao2Fio2RatioMmHg: 150, cumulativeFluidBalanceMl: 9400, bodyWeightChangeKg: 7.6,
          potassiumMmolL: 4.6, arterialPh: 7.36, bicarbonateMmolL: 22, ionizedCalciumMmolL: 1.1, uremicManifestations: [], ...noRareIndication,
          hemodynamicTolerance: 'intermediate', intracranialPressureRisk: false, rapidSoluteClearanceNeeded: false, preciseFluidElectrolyteControlNeeded: true,
          crrtMode: 'CVVHDF', crrtStartedTimestamp: t3At(31), crrtDoseWeightBasis: 'adjusted', crrtDoseWeightKg: 82,
          crrtDowntimeHours: 1, crrtObservationHours: 12, deliveredEffluentMlKgHours: 19.5, ufNetMlHours: 100, filterLifeHours: 5, anticoagulation: 'regional-citrate',
          prescriptionAssessment: {
            adultConfirmed: true, weightBasisReason: '肥胖且急性液體過載，實際體重高估；團隊選用校正體重', deliveredTargetMlKgHr: 25,
            dialysateMlHr: 1200, preReplacementMlHr: 600, postReplacementMlHr: 400, preBloodPumpMlHr: 0, bloodFlowMlMin: 180, hematocritFraction: 0.3,
            perfusionAdequate: true, citrateContraindication: false, citrateProtocolAvailable: true, bleedingRiskReviewed: true, systemicAnticoagulationReviewed: true,
            device: 'Prismaflex', confirmations: { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true },
          },
        }),
      },
    ],
  },
  {
    id: t4Id,
    title: '脫離 CRRT 與重啟觸發',
    oneLine: '因難治性酸血症上機；尿量回升後考慮試停，試停後血鉀復發。',
    tags: ['CRRT 脫離', '重啟'],
    learningPoints: [
      '不能只憑單一尿量或 SCr 判定可脫離；SCr 下降可能只是機器清除。',
      '要兩個時間點一致改善，並先訂好監測計畫與重啟條件。',
      '試停中適應症復發，應立即複核重啟；不等排程。',
    ],
    patient: {
      id: t4Id, anonymousCode: '示範-T4', ageRange: '40-64', sex: 'male', heightCm: 170, actualWeightKg: 75,
      infectionSource: 'bloodstream', sepsisOnsetTimestamp: t4Onset, shockOnsetTimestamp: t4At(4),
      baselineCreatinineMgDl: 1.1, baselineCreatinineSource: 'measured-outpatient',
      baselineCreatinineTimestamp: t4At(-120), baselineCreatinineConfidence: 'high',
    },
    timepoints: [
      {
        label: '96 小時', prompt: '已停升壓劑，尿量 24 小時 500 mL，SCr 1.8。可以試停了嗎？',
        story: '第 20 小時因難治性酸血症開始 CVVHDF。現已停升壓劑、室內空氣，但團隊尚未完成原生清除與液體能力的評估，也還沒有監測計畫。',
        teaching: '數字看起來不錯，但 SCr 1.8 有機器清除的貢獻，不能代表原生腎功能。原適應症、原生清除、液體能力與監測計畫都還沒確認，工具維持「continue and reassess」。',
        snapshot: observe(t4Id, t4At, 96, {
          ...t4Common, actualWeightKg: 76, creatinineMgDl: 1.8, bunMgDl: 32, urineVolumeMl: 500, urineObservationHours: 24,
          mapMmHg: 76, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'improving', lactateMmolL: 1.3, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert', hemodynamicTolerance: 'stable',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, fluidIntervalHours: 24, intervalFluidInputMl: 2200, intervalFluidOutputMl: 2400, intervalNetFluidBalanceMl: -200, cumulativeFluidBalanceMl: 4000,
          potassiumMmolL: 4.2, arterialPh: 7.38, bicarbonateMmolL: 23, crrtDowntimeHours: 1, crrtObservationHours: 24,
        }),
      },
      {
        label: '120 小時', prompt: '尿量升到 1,100 mL/24 h，團隊評估都完成了。工具會怎麼說？誰來決定？',
        story: '原適應症已解決，團隊確認原生溶質與液體控制足夠，停機紀錄已複核，並訂好監測內容、4 小時內複評與重啟條件。兩個時間點的 SCr、BUN、累積平衡都未上升。',
        teaching: '所有閘門都通過，才出現「consider supervised trial-off」。這仍只是提示由重症與腎臟科共同考慮，何時停機由團隊決定。尿量升高而沒有用利尿劑，解讀才比較單純。',
        snapshot: observe(t4Id, t4At, 120, {
          ...t4Common, actualWeightKg: 75, creatinineMgDl: 1.7, bunMgDl: 30, urineVolumeMl: 1100, urineObservationHours: 24,
          mapMmHg: 80, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'improving', lactateMmolL: 1.1, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert', hemodynamicTolerance: 'stable',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, fluidIntervalHours: 24, intervalFluidInputMl: 2000, intervalFluidOutputMl: 2400, intervalNetFluidBalanceMl: -400, cumulativeFluidBalanceMl: 3600,
          potassiumMmolL: 4.1, arterialPh: 7.39, bicarbonateMmolL: 24, crrtDowntimeHours: 1, crrtObservationHours: 24,
          liberationAssessment: t4Ready,
        }),
      },
      {
        label: '130 小時（試停中）', prompt: '已試停 8 小時，血鉀 4.7。這代表腎功能恢復了嗎？',
        story: '第 122 小時由團隊決定試停。目前尿量 6 小時 250 mL，血鉀 4.7，pH 7.36，血流動力穩定。',
        teaching: '工具標示試停中，維持密切觀察。尚無適應症復發，但這不等於已恢復：SCr 與血鉀停機後才會反映真實清除。實際停機時間只在停機後記錄。',
        snapshot: observe(t4Id, t4At, 130, {
          ...t4Common, actualWeightKg: 75, crrtStoppedTimestamp: t4At(122), creatinineMgDl: 2.1, bunMgDl: 38, urineVolumeMl: 250, urineObservationHours: 6,
          mapMmHg: 78, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', lactateMmolL: 1.2, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert', hemodynamicTolerance: 'stable',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, fluidIntervalHours: 8, intervalFluidInputMl: 800, intervalFluidOutputMl: 300, intervalNetFluidBalanceMl: 500, cumulativeFluidBalanceMl: 4100,
          potassiumMmolL: 4.7, arterialPh: 7.36, bicarbonateMmolL: 22, crrtDowntimeHours: 0, crrtObservationHours: 8, liberationAssessment: t4Ready,
        }),
      },
      {
        label: '140 小時（復發）', prompt: '尿量掉了，血鉀 6.5 且治療無效。怎麼處理？',
        story: '試停 18 小時，尿量降到 6 小時 60 mL，血鉀 6.5，已給內科治療仍未下降，團隊判定難治。',
        teaching: '試停中適應症復發，工具直接顯示「restart trigger met」，要求立即複核重啟。試停失敗是資訊，不是錯誤；它告訴我們原生清除還不足，下次要再評估。',
        snapshot: observe(t4Id, t4At, 140, {
          ...t4Common, actualWeightKg: 76, crrtStoppedTimestamp: t4At(122), creatinineMgDl: 3, bunMgDl: 58, urineVolumeMl: 60, urineObservationHours: 6,
          mapMmHg: 76, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', lactateMmolL: 1.4, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert', hemodynamicTolerance: 'stable',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, fluidIntervalHours: 10, intervalFluidInputMl: 900, intervalFluidOutputMl: 150, intervalNetFluidBalanceMl: 750, cumulativeFluidBalanceMl: 4850,
          potassiumMmolL: 6.5, refractoryHyperkalemia: true, arterialPh: 7.3, bicarbonateMmolL: 18, crrtDowntimeHours: 0, crrtObservationHours: 10, liberationAssessment: t4Ready,
          rapidSoluteClearanceNeeded: true, ...modeScreen,
        }),
      },
    ],
  },
  {
    id: t5Id,
    title: '暫定分期與尿毒性心包炎：循環穩定選 IHD',
    oneLine: '軟組織感染已控制；基準 SCr 是回推值，之後出現尿毒併發症。',
    tags: ['暫定分期', '尿毒併發症', 'IHD'],
    learningPoints: [
      '基準 SCr 是估計或回推時，分期只能算暫定；連續實測能把它確立。',
      '明確尿毒併發症（如心包炎）本身就是適應症。',
      '循環穩定且需快速清除可討論 IHD；若不需快速清除，IHD 或 PIRRT 都合理。',
    ],
    patient: {
      id: t5Id, anonymousCode: '示範-T5', ageRange: '40-64', sex: 'female', heightCm: 160, actualWeightKg: 62,
      infectionSource: 'skin-soft-tissue', sepsisOnsetTimestamp: t5Onset,
      baselineCreatinineMgDl: 0.9, baselineCreatinineSource: 'back-calculated', baselineCreatinineConfidence: 'low',
    },
    timepoints: [
      {
        label: '72 小時', prompt: 'SCr 5.0，基準 0.9 是回推值，也沒有測量時間。分期可信嗎？',
        story: '蜂窩性組織炎併敗血症，清創後未再用升壓劑。沒有發病前的實測 SCr，基準 0.9 由 eGFR 75 回推。',
        teaching: '倍數達第 3 期，但比較基準不可靠，也無法確認升幅發生在 7 天內，所以工具標示「暫定」與低可信度。下一次實測才能提供可靠的比較。',
        snapshot: observe(t5Id, t5At, 72, {
          ...t5Urine, actualWeightKg: 62, creatinineMgDl: 5, bunMgDl: 110, urineVolumeMl: 900, urineObservationHours: 24,
          mapMmHg: 82, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', lactateMmolL: 1.2, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'room-air', cumulativeFluidBalanceMl: 1500, bodyWeightChangeKg: 1,
          potassiumMmolL: 5, arterialPh: 7.34, bicarbonateMmolL: 20, uremicManifestations: [], ...noRareIndication,
        }),
      },
      {
        label: '120 小時', prompt: '新出現胸痛與心包摩擦音。血鉀、pH 都還可以，要透析嗎？選哪種？',
        story: 'SCr 7.2、BUN 168。病人胸痛、可聽到心包摩擦音，心超確認少量心包積液，評估為尿毒性心包炎。循環穩定、未用升壓劑。',
        teaching: '48 小時內實測上升，加上 SCr ≥4，分期由暫定轉為確立。血鉀與 pH 雖未達危險值，尿毒性心包炎本身就是適應症。循環穩定、無顱內壓風險、需快速清除，所以工具提示討論 IHD。因有心包炎，抗凝的選擇要特別留意，交由團隊決定。',
        snapshot: observe(t5Id, t5At, 120, {
          ...t5Urine, actualWeightKg: 63, creatinineMgDl: 7.2, bunMgDl: 168, urineVolumeMl: 800, urineObservationHours: 24,
          mapMmHg: 84, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', lactateMmolL: 1.1, capillaryRefillSeconds: 2, peripheralTemperature: 'warm', mentalStatus: 'alert',
          pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'room-air', cumulativeFluidBalanceMl: 2000, bodyWeightChangeKg: 1.5,
          potassiumMmolL: 5.4, arterialPh: 7.31, bicarbonateMmolL: 18, uremicManifestations: ['pericarditis'], ...noRareIndication,
          hemodynamicTolerance: 'stable', rapidSoluteClearanceNeeded: true, ...modeScreen,
        }),
      },
    ],
  },
  {
    id: t6Id,
    title: '標籤與數據矛盾：工具為何拒答',
    oneLine: '有適應症，但「循環穩定」與升壓劑、乳酸互相矛盾；家屬另詢問血液吸附。',
    tags: ['資料衝突', 'HA 閘門'],
    learningPoints: [
      '「穩定」標籤與 MAP、升壓劑、乳酸矛盾時，工具暫不選模式，以免誤選 IHD。',
      '更正資料後才會給出模式偏好；危急處置不等待填表。',
      'SSC 2026 建議不要常規使用血液淨化；HA 要主動選入並通過四道閘門，非常規路徑。',
    ],
    patient: {
      id: t6Id, anonymousCode: '示範-T6', ageRange: '18-39', sex: 'male', heightCm: 175, actualWeightKg: 80,
      infectionSource: 'other', sepsisOnsetTimestamp: t6Onset, shockOnsetTimestamp: t6At(1),
      baselineCreatinineMgDl: 1, baselineCreatinineSource: 'measured-outpatient',
      baselineCreatinineTimestamp: t6At(-24), baselineCreatinineConfidence: 'high',
    },
    timepoints: [
      {
        label: '10 小時', prompt: '有難治高血鉀。評估表寫「循環穩定」，但 NE 0.15、乳酸 3.8。模式建議會是什麼？',
        story: '交班時血流動力耐受性被填成「穩定」，實際仍在用 norepinephrine，乳酸 3.8。血鉀 6.8 經治療無效。',
        teaching: '透析適應症已成立，要立即評估。但模式部分工具拒絕給答案：若照「穩定」標籤走，可能提示 IHD，而數據不支持。這種 fail-closed 行為是刻意的，先核對資料，同時不延誤降鉀處置。',
        snapshot: observe(t6Id, t6At, 10, {
          ...t6Common, actualWeightKg: 80, creatinineMgDl: 3.1, bunMgDl: 60, urineVolumeMl: 60, urineObservationHours: 6,
          mapMmHg: 67, norepinephrineEquivalentMcgKgMin: 0.15, vasopressorTrend: 'unchanged', lactateMmolL: 3.8, capillaryRefillSeconds: 3, peripheralTemperature: 'warm', mentalStatus: 'alert',
          lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'conventional-oxygen', pao2Fio2RatioMmHg: 300, hemodynamicTolerance: 'stable',
        }),
      },
      {
        label: '11 小時', prompt: '改填「不穩定」後模式會變嗎？家屬要求加血液吸附，工具會同意嗎？',
        story: '床邊重新評估後，耐受性更正為「不穩定」。家屬在網路上看到血液吸附，希望加上 CytoSorb；團隊先在評估中選入 HA 並記錄裝置，其餘條件都尚未評估。',
        teaching: '資料一致後，模式才收斂到 CRRT 討論。HA 雖已選入，四道閘門的資料大多未知，工具不會給出資格，並同時列出 SSC 2026 對常規血液淨化的條件式反對與 ADQI 30 的實驗性定位。可依此與家屬說明。',
        snapshot: observe(t6Id, t6At, 11, {
          ...t6Common, actualWeightKg: 80, creatinineMgDl: 3.4, bunMgDl: 64, urineVolumeMl: 70, urineObservationHours: 6,
          mapMmHg: 66, norepinephrineEquivalentMcgKgMin: 0.15, vasopressorTrend: 'unchanged', lactateMmolL: 3.6, capillaryRefillSeconds: 3, peripheralTemperature: 'warm', mentalStatus: 'alert',
          lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'conventional-oxygen', pao2Fio2RatioMmHg: 300, hemodynamicTolerance: 'unstable',
          hemoadsorptionAssessment: { optedIn: true, requestedDevice: 'CytoSorb', targetAdsorbate: 'cytokines', adultConfirmed: true, septicShockConfirmed: true },
        }),
      },
    ],
  },
];

export const findDemoCase = (id: string | undefined) => demoCases.find(demo => demo.id === id);
export const demoExport = (demo: DemoCase) => ({ schemaVersion: 1 as const, case: demo.patient, snapshots: demo.timepoints.map(point => point.snapshot) });
