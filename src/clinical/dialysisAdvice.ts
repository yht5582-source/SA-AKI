import type { KrtTreatmentState } from './diagnosis';
import type { DecisionResult } from './types';

type Tone = 'urgent' | 'check' | 'defer';
export interface DialysisAdvice { heading: string; text: string; tone: Tone; }

/** A missing or unconfirmed emergency screen must never read as a negative indication. */
export function dialysisAdvice(indication: DecisionResult, state: KrtTreatmentState = 'none'): DialysisAdvice {
  const urgent = indication.severity === 'critical';
  const confirming = indication.conclusion.startsWith('urgent confirmation');
  const missing = indication.missingData.length > 0;
  if (state === 'on') {
    const heading = '目前 CRRT 適應症複核';
    if (urgent) return { heading, text: '已在 CRRT，適應症仍在：持續治療，並由臨床與腎臟科複核交付劑量與處方；同步處理生命威脅。', tone: 'urgent' };
    if (confirming) return { heading, text: '已在 CRRT，仍有危險訊號：立即確認治療反應與實際交付；不能視為適應症已解決。', tone: 'check' };
    if (missing) return { heading, text: '已在 CRRT，資料不足以判定適應症是否解決：先補齊評估；未知不代表已解決。', tone: 'check' };
    return { heading, text: '已在 CRRT，目前未見持續的危急適應症：這不等於可以停機；是否脫離依脫離評估。', tone: 'defer' };
  }
  if (state === 'off') {
    const heading = '是否需要重新開始透析？';
    if (urgent) return { heading, text: '建議立即複核重新開始透析（KRT）：已停機，但有需臨床與腎臟科複核的危急適應症；同步處理生命威脅。', tone: 'urgent' };
    if (confirming) return { heading, text: '已停機，有危險訊號：立即確認病因與治療難治性，判斷是否需重新開始；不能等待填表或自動啟動。', tone: 'check' };
    if (missing) return { heading, text: '已停機，資料不足，無法判定是否需重新開始：先補齊危急併發症評估；未知不代表沒有適應症。', tone: 'check' };
    return { heading, text: '已停機，目前不建議重新開始透析（KRT）：尚無已確認的危急適應症；持續監測，病況變化立即重評。', tone: 'defer' };
  }
  const heading = '現在是否建議透析？';
  const prefix = state === 'uncertain' ? 'CRRT 開始／停止紀錄有矛盾，目前是否在治療中無法判定，請先核對。' : '';
  if (urgent) return { heading, text: `${prefix}建議立即評估啟動透析（KRT）：已有需臨床與腎臟科複核的危急適應症；同步處理生命威脅。`, tone: 'urgent' };
  if (confirming) return { heading, text: `${prefix}立即確認是否需要透析：已有危險訊號，須立即確認病因與治療難治性；不能等待填表或自動啟動。`, tone: 'check' };
  if (missing) return { heading, text: `${prefix}資料不足，無法判定是否需要透析：先補齊危急併發症評估；未知不代表沒有透析適應症。`, tone: 'check' };
  return { heading, text: `${prefix}目前不建議開始透析（KRT）：尚無已確認的危急適應症；持續監測，病況變化立即重評。`, tone: state === 'uncertain' ? 'check' : 'defer' };
}
