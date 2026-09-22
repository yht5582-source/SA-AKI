import type { HaEvaluation } from '../../clinical/ha';
import type { HemoadsorptionAssessment } from '../../clinical/types';

/** Storage confirmation is separate from engine gates; neither authorizes treatment. */
export function haStatusLabel(evaluation: HaEvaluation | undefined, assessment: HemoadsorptionAssessment | undefined, confirmed = false): string {
  if (!assessment?.optedIn) return '尚未評估 HA；此路徑不會自動啟用。';
  if (assessment.reviewStatus === 'incomplete') return '已保存未完成 HA 觀察；未記錄審查完成。';
  if (evaluation?.status === 'not-eligible') return '不符合審查資格；至少一項門檻未通過。';
  if (evaluation?.status !== 'multidisciplinary-review') return '資料不足，HA 評估未完成。';
  return confirmed || assessment.reviewStatus === 'multidisciplinary-review' ? '可送多專科審查' : '待確認多專科審查；四項門檻已通過，尚未記錄審查確認。';
}
