import { stepFields } from './steps/fields';

const targets: readonly (readonly [string, string])[] = [
  ['血鉀', 'potassiumMmolL'], ['高血鉀', 'potassiumMmolL'], ['arterial pH', 'arterialPh'], ['酸血症', 'arterialPh'], ['肺水腫', 'pulmonaryEdema'], ['尿毒', 'uremicManifestations'],
  ['電解質異常', 'lifeThreateningElectrolyteDisturbance'], ['毒物', 'dialyzableToxin'], ['受控鈉', 'requiresControlledSodiumCorrection'],
  ['MAP', 'mapMmHg'], ['升壓劑劑量', 'norepinephrineEquivalentMcgKgMin'], ['升壓劑趨勢', 'vasopressorTrend'], ['lactate', 'lactateMmolL'],
  ['顱內壓', 'intracranialPressureRisk'], ['血流動力耐受性', 'hemodynamicTolerance'], ['快速溶質清除', 'rapidSoluteClearanceNeeded'], ['精密液體', 'preciseFluidElectrolyteControlNeeded'],
];

export function fieldsForMissingItem(item: string): { key: string; label: string }[] {
  const keys = item.includes('升壓劑劑量與趨勢') ? ['norepinephrineEquivalentMcgKgMin', 'vasopressorTrend']
    : [targets.find(([phrase]) => item.includes(phrase))?.[1] ?? 'hemodynamicTolerance'];
  return keys.map(key => {
    const field = stepFields.flat().find(candidate => candidate.key === key);
    return { key, label: field?.label ?? '相關資料' };
  });
}
