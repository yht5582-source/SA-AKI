import type { DecisionResult } from './types';

/** A mode preference is shown only after a confirmed indication and a complete mode screen. */
export function modalityAdvice(indication: DecisionResult | undefined, modality: DecisionResult | undefined): string {
  if (!indication || indication.severity !== 'critical') return '尚不選定 KRT 模式；先確認是否需要透析。';
  if (!modality || modality.missingData.length > 0) return '資料不足，暫不選定透析模式；請補齊下列評估，危急處置不等待填表。';
  if (modality.evidence.some(item => item.includes('資料衝突')) || modality.conclusion.includes('資料不足或衝突'))
    return '模式資料互相衝突，暫不選定透析模式；請重新核對循環與灌流評估。';
  const mode = (['CRRT', 'IHD', 'PIRRT'] as const).find(value => modality.conclusion.includes(`${value} review`));
  return mode ? `可優先討論 ${mode}；須由臨床與腎臟團隊依清除目標、循環及神經風險確認，非機器處方。` : '暫不選定透析模式；請臨床團隊複核。';
}
