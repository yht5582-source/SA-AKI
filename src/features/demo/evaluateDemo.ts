import { krtTreatmentState } from '../../clinical/diagnosis';
import { dialysisAdvice } from '../../clinical/dialysisAdvice';
import { modalityAdvice } from '../../clinical/modalityAdvice';
import type { DecisionResult } from '../../clinical/types';
import { evaluateDashboard } from '../dashboard/evaluateDashboard';
import type { DemoCase } from './demoCases';

export interface DemoOutput { label: string; text: string; tone?: 'urgent' | 'check' | 'defer'; }
export const LIBERATION_LABELS: Record<string, string> = {
  'restart trigger met': '符合重啟觸發條件：立即由團隊複核，非機器處方',
  'consider supervised trial-off': '可由重症與腎臟科共同考慮監督下試停，非機器處方',
  'continue and reassess': '繼續目前評估並重評，尚不支持脫離；非機器處方',
};

/** Runs the real dashboard engine on the observations known at this timepoint. */
export function evaluateDemoTimepoint(demo: DemoCase, index: number): { decisions: DecisionResult[]; outputs: DemoOutput[] } {
  const known = demo.timepoints.slice(0, index + 1).map(point => point.snapshot);
  const current = known[index];
  const decisions = evaluateDashboard(demo.patient, known, current.id);
  const conclusion = (id: string) => decisions.find(result => result.id === id)?.conclusion;
  const indication = decisions.find(result => result.id === 'krt-emergency-indications')!;
  const state = krtTreatmentState(known, current.timestamp);
  const advice = dialysisAdvice(indication, state);
  const outputs: DemoOutput[] = [
    { label: 'AKI 分期', text: conclusion('aki-staging')! },
    ...(state === 'on'
      ? [{ label: '適應症複核（已在 CRRT 中）', text: advice.text, tone: advice.tone }]
      : [{ label: state === 'off' ? '是否重新開始透析' : '是否透析', text: advice.text, tone: advice.tone }, { label: '透析模式', text: modalityAdvice(indication, decisions.find(result => result.id === 'krt-modality-selection'), state) }]),
    { label: '輸液計畫', text: conclusion('fluid-plan')! },
    { label: 'ROSE 階段', text: conclusion('fluid-rose')! },
    { label: '淨脫水', text: conclusion('fluid-ufnet')! },
  ];
  if (current.crrtMode) {
    const prescription = decisions.find(result => result.id === 'crrt-prescription-safety');
    const dose = decisions.find(result => result.id === 'crrt-delivered-dose');
    if (current.prescriptionAssessment && prescription && dose) outputs.push(
      { label: '處方試算', text: prescription.evidence.slice(0, 4).join('；') },
      { label: '交付劑量', text: dose.evidence[0].replace('Target', '目標').replace('prescribed', '處方').replace('configured estimate', '模型估算').replace('observed', '實測') },
    );
    const liberation = conclusion('crrt-liberation-review');
    if (liberation) outputs.push({ label: 'CRRT 脫離', text: LIBERATION_LABELS[liberation.split('：')[0]] ?? liberation });
  }
  if (current.hemoadsorptionAssessment?.optedIn) outputs.push({ label: '血液吸附（HA）', text: 'SSC 2026 條件式反對常規血液淨化；ADQI 30 定位為實驗性輔助。資料未齊，不構成資格，也不是治療建議。' });
  return { decisions, outputs };
}
