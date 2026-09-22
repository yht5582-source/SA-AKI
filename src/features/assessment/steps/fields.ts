import type { FieldDefinition } from '../../../components/FormField';

const n = (key: string, label: string, unit: string, help = '可接受範圍：≥ 0；未知請留空。'): FieldDefinition => ({ key, label, type: 'number', unit, help });
const b = (key: string, label: string): FieldDefinition => ({ key, label, type: 'boolean' });
const s = (key: string, label: string, options: string[]): FieldDefinition => ({ key, label, type: 'select', options: options.map(value => [value, value]) });
const time = (key: string, label: string): FieldDefinition => ({ key, label, type: 'datetime-local', help: 'UTC 時間；未確認請留空。' });
const weight = ['actual', 'ideal', 'adjusted'];
const prescriptionFields: FieldDefinition[] = [
  b('prescriptionAssessment.adultConfirmed', '處方評估：已確認成人'),
  { key: 'prescriptionAssessment.weightBasisReason', label: '劑量體重選擇理由', type: 'text', help: '僅記錄臨床理由；請勿輸入姓名、病歷號或其他識別資料。未知請留空。' },
  n('prescriptionAssessment.deliveredTargetMlKgHr', '交付劑量目標', 'mL/kg/h', '可記錄範圍：> 0；本算式僅支援成人 20–25，其他目標須專科審查。未知請留空。'),
  n('prescriptionAssessment.dialysateMlHr', '透析液流量', 'mL/h'),
  n('prescriptionAssessment.preReplacementMlHr', '前稀釋置換流量', 'mL/h'),
  n('prescriptionAssessment.postReplacementMlHr', '後稀釋置換流量', 'mL/h'),
  n('prescriptionAssessment.preBloodPumpMlHr', 'PBP／citrate 獨立流量', 'mL/h', '可接受範圍：≥ 0；無此輸入時明確填 0，不可與前稀釋重複計數；未知留空。'),
  n('prescriptionAssessment.bloodFlowMlMin', '病人全血流量 Qb', 'mL/min', '可接受範圍：> 0；PBP 注入前的病人全血流量，非含 PBP 的泵總流量；未知留空。'),
  n('prescriptionAssessment.hematocritFraction', 'Hct 比例', 'fraction', '可接受範圍：0 ≤ Hct < 1；30% 請輸入 0.30，不是 30。未知請留空。'),
  b('prescriptionAssessment.perfusionAdequate', '灌流已確認足夠'),
  b('prescriptionAssessment.citrateContraindication', 'Citrate 禁忌／代謝風險已判定存在'),
  b('prescriptionAssessment.citrateProtocolAvailable', '具備本地 citrate 規範與監測團隊'),
  b('prescriptionAssessment.bleedingRiskReviewed', '出血／凝血／HIT 風險已審查'),
  b('prescriptionAssessment.systemicAnticoagulationReviewed', '既有全身抗凝與重疊已審查'),
  s('prescriptionAssessment.device', 'CRRT 裝置', ['Prismaflex', 'PrisMax', 'other']),
  ...['device', 'solutionComposition', 'weightBasis', 'anticoagulation', 'pharmacyDosing'].map((key, index) => b(`prescriptionAssessment.confirmations.${key}`, ['確認裝置與濾器', '確認溶液成分', '確認劑量體重基準', '確認抗凝計畫', '確認藥師劑量／TDM'][index])),
];
export const stepLabels = ['感染／休克', 'AKI 評估', '灌流／液體', 'KRT', '模式／ECMO', '處方', '選配 HA', '監測／脫離'] as const;
export const stepFields: FieldDefinition[][] = [
  [time('timestamp', '評估時間（UTC）'), n('hoursFromSepsisOnset', '距 Sepsis 起始時數', 'h', '可接受範圍：有限數值；負值表示 Sepsis 前。未知請留空。'), s('sourceControlStatus', '感染源控制', ['not-indicated', 'planned', 'in-progress', 'achieved', 'inadequate']), time('sourceControlTimestamp', '感染源控制時間（UTC）'), time('firstAntimicrobialTimestamp', '首次抗菌藥時間（UTC）'), n('sofaScore', 'SOFA', '分', '可接受範圍：整數 0–24；未知請留空。'), n('norepinephrineEquivalentMcgKgMin', 'NE 等效劑量', 'μg/kg/min'), s('vasopressorTrend', '升壓劑趨勢', ['improving', 'unchanged', 'worsening']), n('lactateMmolL', '乳酸', 'mmol/L')],
  [n('creatinineMgDl', '目前 SCr', 'mg/dL'), n('bunMgDl', 'BUN', 'mg/dL'), n('urineVolumeMl', '尿量', 'mL'), n('urineObservationHours', '觀察時數', 'h', '可接受範圍：> 0；未知請留空。'), n('actualWeightKg', '目前實際體重', 'kg', '可接受範圍：> 0 至 500；儲存必填。'), n('urineNormalizationWeightKg', '尿量標準化體重', 'kg', '可接受範圍：> 0；未知請留空。'), s('urineWeightBasis', '尿量體重基準', weight), b('diureticExposure', '利尿劑使用')],
  [n('mapMmHg', 'MAP', 'mmHg'), n('heartRateBeatsMin', '心率', '次/min'), n('capillaryRefillSeconds', '微血管回填時間', 's'), s('mentalStatus', '意識狀態', ['alert', 'altered', 'unresponsive', 'sedated']), b('skinMottling', '皮膚斑駁'), n('fluidIntervalHours', '液體觀察時數', 'h', '可接受範圍：> 0；未知請留空。'), n('intervalFluidInputMl', '區間輸入', 'mL'), n('intervalFluidOutputMl', '區間輸出', 'mL'), n('cumulativeFluidBalanceMl', '累積液體平衡', 'mL', '可接受範圍：有限數值（可負）；未知請留空。'), s('passiveLegRaiseResult', '被動抬腿反應', ['responsive', 'nonresponsive', 'indeterminate', 'not-performed']), n('vtiResponsePercent', 'VTI 變化', '%', '可接受範圍：有限數值（可負）；未知請留空。'), s('lungBLines', '肺部 B-lines', ['absent', 'focal', 'bilateral-diffuse'])],
  [n('potassiumMmolL', '鉀', 'mmol/L'), n('arterialPh', '動脈 pH', 'pH', '可接受範圍：6.5–8；未知請留空。'), n('bicarbonateMmolL', '碳酸氫根', 'mmol/L'), b('refractoryHyperkalemia', '難治性高血鉀'), b('refractoryAcidemia', '難治性酸血症'), b('refractoryPulmonaryEdema', '難治性肺水腫'), b('lifeThreateningElectrolyteDisturbance', '危及生命的電解質異常'), b('dialyzableToxin', '可透析毒物'), b('pulmonaryEdema', '肺水腫')],
  [s('hemodynamicTolerance', '血流動力耐受性', ['stable', 'intermediate', 'unstable']), b('intracranialPressureRisk', '顱內壓風險'), b('rapidSoluteClearanceNeeded', '需要快速溶質清除'), b('preciseFluidElectrolyteControlNeeded', '需要精準液體電解質控制'), b('requiresControlledSodiumCorrection', '需要控制鈉矯正'), b('onEcmo', '目前使用 ECMO'), s('ecmoConnection', 'ECMO 連接方式', ['independent-catheter', 'integrated-circuit', 'not-established']), n('ecmoAccessPressureMmHg', 'ECMO 進入壓力', 'mmHg', '可接受範圍：有限數值（可負）；未知請留空。'), n('ecmoReturnPressureMmHg', 'ECMO 回流壓力', 'mmHg', '可接受範圍：有限數值（可負）；未知請留空。'), b('ecmoAirRiskReviewed', 'ECMO 空氣風險已審查'), b('ecmoPressureCompatibilityReviewed', 'ECMO 壓力相容已審查'), n('ecmoFlowLMin', 'ECMO 流量', 'L/min')],
  [s('crrtMode', 'CRRT 模式', ['CVVH', 'CVVHD', 'CVVHDF', 'SCUF']), time('crrtStartedTimestamp', 'CRRT 開始（UTC）'), time('crrtStoppedTimestamp', 'CRRT 停止（UTC）'), n('prescribedEffluentMlKgHours', '處方 effluent', 'mL/kg/h'), n('deliveredEffluentMlKgHours', '實際 effluent', 'mL/kg/h'), n('crrtDoseWeightKg', '劑量體重', 'kg', '可接受範圍：> 0；未知請留空。'), s('crrtDoseWeightBasis', '劑量體重基準', weight), n('crrtDowntimeHours', '停機時數', 'h'), n('crrtObservationHours', 'CRRT 觀察時數', 'h', '可接受範圍：> 0；未知請留空。'), n('ufNetMlHours', 'UFNET', 'mL/h', '可接受範圍：有限數值（可負）；未知請留空。'), s('anticoagulation', '抗凝', ['regional-citrate', 'systemic-heparin', 'none', 'other']), ...prescriptionFields],
  [],
  [n('sodiumMmolL', '鈉', 'mmol/L'), n('ionizedCalciumMmolL', '游離鈣', 'mmol/L'), n('magnesiumMmolL', '鎂', 'mmol/L'), n('phosphateMmolL', '磷', 'mmol/L'), n('filterLifeHours', '濾器壽命', 'h'), b('liberationAssessment.originalIndicationResolved', '原 KRT 適應症已解除'), b('liberationAssessment.nativeSoluteControlAdequate', '原生腎功能溶質控制足夠'), b('liberationAssessment.nativeFluidBalanceAdequate', '原生腎功能液體平衡足夠'), b('liberationAssessment.observationAdequate', '觀察期間足夠'), b('liberationAssessment.downtimeReviewed', '停機影響已審查'), b('liberationAssessment.diureticEffectReviewed', '利尿劑影響已審查'), n('liberationAssessment.timedCreatinineClearanceMlMin', '定時肌酸酐清除率', 'mL/min'), n('liberationAssessment.clearanceCollectionHours', '清除率收集時數', 'h', '可接受範圍：> 0；未知請留空。'), ...['urineOutput', 'fluidBalance', 'electrolytesAcidBase', 'respiratoryHemodynamic', 'restartTriggersReviewed'].map((key, i) => b(`liberationAssessment.monitoringPlan.${key}`, ['尿量監測計畫', '液體平衡監測計畫', '電解質酸鹼監測計畫', '呼吸循環監測計畫', '重啟條件已審查'][i])), n('liberationAssessment.monitoringPlan.reviewWithinHours', '脫離重評時限', 'h', '可接受範圍：> 0；未知請留空。')],
];
export const haFields: FieldDefinition[] = [
  n('fibrinogenGL', '纖維蛋白原', 'g/L'), n('modsScore', 'MODS', '分', '可接受範圍：整數 0–24；未知請留空。'),
  b('hemoadsorptionAssessment.adultConfirmed', '已確認成人'), b('hemoadsorptionAssessment.septicShockConfirmed', '已確認感染性休克'), b('hemoadsorptionAssessment.reversibleTrait', '可逆特徵'),
  s('hemoadsorptionAssessment.requestedDevice', '待審查裝置', ['CytoSorb', 'HA330', 'HA380', 'polymyxin-B', 'oXiris', 'other']), s('hemoadsorptionAssessment.targetAdsorbate', '目標吸附物', ['cytokines', 'endotoxin', 'cytokines-and-endotoxin', 'other']), s('hemoadsorptionAssessment.shockTrajectory', '休克病程', ['persistent', 'worsening', 'resolving']),
  ...['antimicrobials', 'sourceControl', 'fluids', 'vasopressors', 'corticosteroids'].map((key, i) => b(`hemoadsorptionAssessment.standardCare.${key}`, ['抗菌藥標準照護已評估', '感染源控制已評估', '液體已評估', '升壓劑已評估', '類固醇已評估'][i])),
  ...['hyperinflammatoryPhenotype', 'endotoxinPhenotype', 'immunoparalysis', 'lowHlaDr', 'suspectedGramNegativeInfection', 'targetStillPresent'].map((key, i) => b(`hemoadsorptionAssessment.${key}`, ['高發炎表型', '內毒素表型', '免疫麻痺', '低 HLA-DR', '疑革蘭陰性菌感染', '目標仍存在'][i])),
  n('il6PgMl', 'IL-6', 'pg/mL'), n('endotoxinActivityAssay', 'EAA', '比值', '可接受範圍：0–1；未知請留空。'), n('platelets10e9L', '血小板', '10⁹/L'), n('albuminGL', '白蛋白', 'g/L'),
  ...['plateletsAcceptable', 'coagulationAcceptable', 'albuminAcceptable', 'hepaticRenalReviewed', 'electrolytesReviewed', 'vascularAccessReviewed', 'anticoagulationReviewed', 'circuitCompatible', 'drugRemovalPlan', 'uncontrolledBleeding', 'irreversibleOrganFailure', 'goalsCompatible'].map((key, i) => b(`hemoadsorptionAssessment.safety.${key}`, ['血小板可接受', '凝血可接受', '白蛋白可接受', '肝腎已審查', '電解質已審查', '血管通路已審查', '抗凝已審查', '管路相容', '藥物移除計畫', '未控制出血', '不可逆器官衰竭', '照護目標相容'][i])),
  ...['criticalCareApproved', 'nephrologyApproved', 'infectiousDiseasesApproved', 'pharmacistExposurePlan', 'monitoringPlan', 'stopPlan', 'deviceProtocolReviewed'].map((key, i) => b(`hemoadsorptionAssessment.governance.${key}`, ['重症團隊審查', '腎臟團隊審查', '感染團隊審查', '藥師暴露計畫', 'HA 監測計畫', 'HA 停止計畫', '裝置規範已審查'][i])),
  s('hemoadsorptionAssessment.governance.setting', '治理場域', ['protocol', 'registry', 'research']), s('hemoadsorptionAssessment.governance.consent', '同意程序', ['obtained', 'not-required', 'pending', 'declined']), n('hemoadsorptionAssessment.governance.reviewAtHours', 'HA 重評時限', 'h', '可接受範圍：> 0；未知請留空。'),
];
stepFields[2].push(
  n('intervalNetFluidBalanceMl', '區間淨液體平衡', 'mL', '可接受範圍：有限數值（可負）；必須對應液體觀察時數。未知請留空。'),
  { key: 'vexusGrade', label: 'VExUS 分級', type: 'numeric-select', options: [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], help: '整數 0–3；需完整床邊靜脈充血評估，未知請留空。' },
);
stepFields[3].push(
  s('respiratorySupport', '呼吸支持', ['room-air', 'conventional-oxygen', 'high-flow-nasal-oxygen', 'noninvasive-ventilation', 'invasive-ventilation']),
  n('pao2Fio2RatioMmHg', 'P/F 比值', 'mmHg'),
  { key: 'uremicManifestations', label: '尿毒併發症', type: 'multi-select', options: [['encephalopathy', '尿毒性腦病變'], ['pericarditis', '尿毒性心包炎'], ['bleeding', '尿毒性出血'], ['other', '其他疑似尿毒表現']], help: '僅勾選已明確診斷且因果經臨床確認的表現，可複選。other 仍需專科確認；未勾選不自動等於排除，請明確記錄「已評估未見」。' },
);
stepFields[4].push(s('ecmoAnticoagulation', 'ECMO 抗凝', ['regional-citrate', 'systemic-heparin', 'none', 'other']));

const json = (key: string, label: string, help: string, example: string): FieldDefinition => ({ key, label, type: 'json', help: `${help} 嚴格 JSON 陣列；數字不可加引號，時間需 ISO 8601 時區，未知留空。[] 表示本時間點無新增子紀錄，不會刪除先前紀錄或代表舊不良事件已解除。禁止姓名、病歷號等識別資料，不會自動修正型別。`, example });
export const haExposureFields: FieldDefinition[] = [
  s('hemoadsorptionExposures.0.device', 'HA 暴露裝置', ['CytoSorb', 'HA330', 'HA380', 'polymyxin-B', 'oXiris', 'other']),
  s('hemoadsorptionExposures.0.targetAdsorbate', 'HA 暴露目標', ['cytokines', 'endotoxin', 'cytokines-and-endotoxin', 'other']),
  time('hemoadsorptionExposures.0.startedTimestamp', 'HA 暴露開始（UTC）'),
  time('hemoadsorptionExposures.0.stoppedTimestamp', 'HA 暴露停止（UTC）'),
  n('hemoadsorptionExposures.0.bloodFlowMlMin', 'HA 血流量', 'mL/min', '可接受範圍：> 0；未知請留空。'),
  n('hemoadsorptionExposures.0.cumulativeProcessedBloodVolumeL', 'HA 累積處理血量', 'L', '可接受範圍：≥ 0；紀錄指標，非療程最低劑量或治療目標。未知留空。'),
  s('hemoadsorptionExposures.0.response', 'HA 記錄反應', ['improving', 'unchanged', 'worsening']),
  time('hemoadsorptionExposures.0.responseReviewedTimestamp', 'HA 反應審查時間（UTC）'),
  json('hemoadsorptionExposures.0.cartridgeChangeTimestamps', 'HA 換匣時間（JSON 陣列）', '每項為已執行換匣的時間字串。', '["2026-09-21T10:00:00Z"]'),
  json('hemoadsorptionExposures.0.drugExposures', 'HA 給藥紀錄（JSON 陣列）', '必填 drugName、administeredTimestamp；選填 doseMg、infusionRateMgHours（皆 ≥0）、route（intravenous/oral/other）。', '[{"drugName":"藥物名稱","administeredTimestamp":"2026-09-21T07:00:00Z","doseMg":1000,"route":"intravenous"}]'),
  json('hemoadsorptionExposures.0.therapeuticDrugMonitoring', 'HA TDM（JSON 陣列）', '必填 drugName、sampledTimestamp；選填 concentrationMgL、auc24MgHoursL、micMgL（皆 ≥0）及 pharmacistPlan（無識別資料文字）。', '[{"drugName":"藥物名稱","sampledTimestamp":"2026-09-21T11:00:00Z","concentrationMgL":12}]'),
  json('hemoadsorptionExposures.0.adverseEvents', 'HA 不良事件（JSON 陣列）', '必填 timestamp、kind（bleeding/thrombocytopenia/circuit-clotting/hypotension/electrolyte-disturbance/drug-underexposure/albumin-loss/hemolysis/other）；選填 severity（mild/moderate/severe）、description。', '[{"timestamp":"2026-09-21T11:00:00Z","kind":"hypotension","severity":"severe"}]'),
];
export const allFields = [...stepFields.flat(), ...haFields, ...haExposureFields];
