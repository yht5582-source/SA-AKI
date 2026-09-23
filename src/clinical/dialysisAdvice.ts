import type { DecisionResult } from './types';

/** A missing or unconfirmed emergency screen must never read as a negative indication. */
export function dialysisAdvice(indication: DecisionResult): { text: string; tone: 'urgent' | 'check' | 'defer' } {
  if (indication.severity === 'critical') return {
    text: '建議立即評估啟動透析（KRT）：已有需臨床與腎臟科複核的危急適應症；同步處理生命威脅。', tone: 'urgent',
  };
  if (indication.conclusion.startsWith('urgent confirmation')) return {
    text: '立即確認是否需要透析：已有危險訊號，須立即確認病因與治療難治性；不能等待填表或自動啟動。', tone: 'check',
  };
  if (indication.missingData.length > 0) return {
    text: '資料不足，無法判定是否需要透析：先補齊危急併發症評估；未知不代表沒有透析適應症。', tone: 'check',
  };
  return { text: '目前不建議開始透析（KRT）：尚無已確認的危急適應症；持續監測，病況變化立即重評。', tone: 'defer' };
}
