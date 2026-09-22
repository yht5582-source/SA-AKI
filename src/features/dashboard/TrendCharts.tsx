import { useState } from 'react';
import type { ClinicalSnapshot, PatientCase } from '../../clinical/types';
import { normalizeUrineOutput } from '../../utils/units';

const trendMetrics = [
  { key: 'creatinineMgDl', label: 'SCr', unit: 'mg/dL' },
  { key: 'urineRate', label: '標準化尿量', unit: 'mL/kg/h' },
  { key: 'lactateMmolL', label: '乳酸', unit: 'mmol/L' },
  { key: 'norepinephrineEquivalentMcgKgMin', label: 'NE 等效劑量', unit: 'μg/kg/min' },
  { key: 'cumulativeFluidBalanceMl', label: '累積液體平衡', unit: 'mL' },
  { key: 'actualWeightKg', label: '實際體重', unit: 'kg' },
  { key: 'sofaScore', label: 'SOFA', unit: '分' },
  { key: 'deliveredEffluentMlKgHours', label: '實際交付劑量', unit: 'mL/kg/h' },
] as const;
type Metric = typeof trendMetrics[number];
const finite = (value: number | undefined): number | null => value !== undefined && Number.isFinite(value) ? value : null;
function measure(snapshot: ClinicalSnapshot, metric: Metric): number | null {
  return metric.key === 'urineRate'
    ? finite(normalizeUrineOutput({ volumeMl: snapshot.urineVolumeMl, hours: snapshot.urineObservationHours, weightKg: snapshot.urineWeightBasis ? snapshot.urineNormalizationWeightKg : undefined }))
    : finite(snapshot[metric.key]);
}
const format = (value: number) => new Intl.NumberFormat('en', { maximumSignificantDigits: 4 }).format(value);
function sameNormalization(left: ClinicalSnapshot | undefined, right: ClinicalSnapshot | undefined, metric: Metric): boolean {
  if (metric.key === 'urineRate') return !!left?.urineWeightBasis && left.urineWeightBasis === right?.urineWeightBasis && left.urineNormalizationWeightKg !== undefined && left.urineNormalizationWeightKg === right?.urineNormalizationWeightKg;
  if (metric.key === 'deliveredEffluentMlKgHours') return !!left?.crrtDoseWeightBasis && left.crrtDoseWeightBasis === right?.crrtDoseWeightBasis && left.crrtDoseWeightKg !== undefined && left.crrtDoseWeightKg === right?.crrtDoseWeightKg;
  return true;
}
function measurementBasis(snapshot: ClinicalSnapshot | undefined, metric: Metric): string {
  return metric.key === 'urineRate' ? `${snapshot?.urineWeightBasis ?? '未知'} / ${snapshot?.urineNormalizationWeightKg ?? '未知'} kg / ${snapshot?.urineObservationHours ?? '未知'} h`
    : metric.key === 'deliveredEffluentMlKgHours' ? `${snapshot?.crrtDoseWeightBasis ?? '未知'} / ${snapshot?.crrtDoseWeightKg ?? '未知'} kg` : snapshot?.timestamp ?? '尚無觀察';
}
/** Scheduled landmarks are explicit unknowns; no interpolation, resampling or last-value carry. */
function buildTrendSeries(patient: PatientCase, snapshots: ClinicalSnapshot[], metric: Metric, delta = false) {
  const ordered = snapshots.filter(s => s.caseId === patient.id && s.hoursFromSepsisOnset >= 0 && s.hoursFromSepsisOnset <= 72).sort((a, b) => a.hoursFromSepsisOnset - b.hoursFromSepsisOnset || Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
  const caseBaseline = metric.key === 'creatinineMgDl' && patient.baselineCreatinineMgDl !== undefined && patient.baselineCreatinineMgDl > 0;
  const first = ordered[0] && ordered.filter(s => s.hoursFromSepsisOnset === ordered[0].hoursFromSepsisOnset).length === 1 ? ordered[0] : undefined;
  const baseline = caseBaseline ? patient.baselineCreatinineMgDl! : first ? measure(first, metric) : null;
  const baselineLabel = caseBaseline ? '病例基準' : ordered[0] ? `首個時間點 ${ordered[0].hoursFromSepsisOnset} h` : '尚無時間點';
  const hours = [...new Set([0, 6, 12, 24, 48, 72, ...ordered.map(s => s.hoursFromSepsisOnset)])].sort((a, b) => a - b);
  const points = hours.map(hour => {
    const samples = ordered.filter(s => s.hoursFromSepsisOnset === hour);
    const snapshot = samples.length === 1 ? samples[0] : undefined;
    const measured = snapshot ? measure(snapshot, metric) : null;
    return { hour, snapshot, samples, value: delta ? measured === null || baseline === null || !sameNormalization(first, snapshot, metric) ? null : measured - baseline : measured };
  });
  return { points, baseline, baselineLabel };
}
function TrendPanel({ patient, snapshots, metric, delta }: { patient: PatientCase; snapshots: ClinicalSnapshot[]; metric: Metric; delta: boolean }) {
  const { points, baseline, baselineLabel } = buildTrendSeries(patient, snapshots, metric, delta);
  const numbers = points.flatMap(point => point.value === null ? [] : [point.value]);
  const min = Math.min(...numbers), max = Math.max(...numbers);
  const y = (value: number) => max === min ? 65 : 110 - 90 * (value - min) / (max - min);
  const x = (hour: number) => 32 + hour / 72 * 316;
  return <section className="trend-panel" aria-label={`${metric.label} 圖表`}>
    <h3>{metric.label}</h3><p>{delta ? '變化量 Δ' : '絕對值'} · {metric.unit}</p>
    <p>{metric.label} 基準：{baseline === null ? '未知' : format(baseline)} {metric.unit}（{baselineLabel}）</p>
    <svg viewBox="0 0 380 145" role="img" aria-label={`${metric.label} 趨勢；${delta ? '相對基準變化' : '絕對值'}；缺值不連線`}>
      <path d="M32 15V115H348" fill="none" stroke="currentColor" opacity="0.4"/>
      {numbers.length > 0 && <><text x="2" y="25">{format(max)}</text><text x="2" y="110">{format(min)}</text></>}
      {points.map((point, index) => {
        const before = points[index - 1];
        return <g key={point.hour}>
          {[0, 6, 12, 24, 48, 72].includes(point.hour) && <text x={x(point.hour)} y="135" textAnchor="middle">{point.hour} h</text>}
          {point.value !== null && <>
            {before?.value !== undefined && before.value !== null && sameNormalization(before.snapshot, point.snapshot, metric) && <line data-segment="observed" x1={x(before.hour)} y1={y(before.value)} x2={x(point.hour)} y2={y(point.value)} stroke="var(--teal)" strokeWidth="2"/>}
            <circle cx={x(point.hour)} cy={y(point.value)} r="3.5" fill="var(--teal)"><title>{point.hour} h: {format(point.value)} {metric.unit}</title></circle>
          </>}
        </g>;
      })}
    </svg>
    <details open><summary>數據與缺值</summary><div className="trend-table-wrap"><table aria-label={`${metric.label} 數據`}><thead><tr><th scope="col">時間</th><th scope="col">{delta ? 'Δ' : '數值'}（{metric.unit}）</th><th scope="col">量測基準</th></tr></thead><tbody>{points.map(point => <tr key={point.hour}><th scope="row">{point.hour} h</th><td>{point.value === null ? '缺值' : format(point.value)}{point.samples.length > 1 && <small>（多筆觀察；原始絕對值：{point.samples.map(sample => { const value = measure(sample, metric); return value === null ? '未知' : format(value); }).join(' / ')} {metric.unit}；不擅自合併或計算變化）</small>}</td><td>{point.samples.length > 1 ? point.samples.map(sample => measurementBasis(sample, metric)).join('；') : measurementBasis(point.snapshot, metric)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export function TrendCharts({ patient, snapshots }: { patient: PatientCase; snapshots: ClinicalSnapshot[] }) {
  const [delta, setDelta] = useState(false);
  return <section className="trend-charts" aria-label="0–72 小時病程" id="trajectory"><h2>0–72 小時病程</h2>
    <p>時間軸：距 sepsis 起始時數。缺值不補零、不跨缺值連線；線段僅連接相鄰已知觀察，不表示連續量測。病例 SCr 基準優先，其餘使用首個時間點；首點缺值時不另找替代基準。</p>
    <p>SCr 來源：{patient.baselineCreatinineSource ?? '未記錄'}；可信度：{patient.baselineCreatinineConfidence ?? '未記錄'}；基準時間：{patient.baselineCreatinineTimestamp ?? '未記錄'}。尿量／劑量體重或基準不同、未知時不連線，變化量標為缺值；重複時間點不擅自選值。</p>
    <div className="workflow-actions" aria-label="趨勢顯示方式"><button className="button" aria-pressed={!delta} onClick={() => setDelta(false)}>絕對值</button><button className="button" aria-pressed={delta} onClick={() => setDelta(true)}>相對基準變化</button></div>
    {trendMetrics.map(metric => <TrendPanel key={metric.key} patient={patient} snapshots={snapshots} metric={metric} delta={delta}/>)}
  </section>;
}
