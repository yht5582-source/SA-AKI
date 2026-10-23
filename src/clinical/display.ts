// Stored values stay English (schema/export contract); only the visible option text is localized.
export const optionLabels: Record<string, string> = {
  'not-indicated': '不需要', planned: '已規劃', 'in-progress': '進行中', achieved: '已達成', inadequate: '不足／失敗',
  improving: '改善', unchanged: '不變', worsening: '惡化', resolving: '緩解中', persistent: '持續',
  actual: '實際體重', ideal: '理想體重', adjusted: '校正體重',
  alert: '清醒', altered: '意識改變', unresponsive: '無反應', sedated: '鎮靜中',
  responsive: '有反應', nonresponsive: '無反應', indeterminate: '無法判定', 'not-performed': '未執行',
  absent: '無', focal: '局部', 'bilateral-diffuse': '雙側瀰漫',
  stable: '穩定', intermediate: '中間', unstable: '不穩定',
  'independent-catheter': '獨立導管', 'integrated-circuit': '整合於 ECMO 管路', 'not-established': '尚未建立',
  'regional-citrate': '局部 citrate', 'systemic-heparin': '全身 heparin', none: '無', other: '其他',
  'room-air': '室內空氣', 'conventional-oxygen': '一般氧氣', 'high-flow-nasal-oxygen': '高流量鼻導管 (HFNC)', 'noninvasive-ventilation': '非侵襲性通氣 (NIV)', 'invasive-ventilation': '侵襲性通氣',
  cytokines: '細胞激素', endotoxin: '內毒素', 'cytokines-and-endotoxin': '細胞激素＋內毒素',
  protocol: '院內規範', registry: '登錄研究', research: '臨床研究',
  warm: '溫暖', cool: '冰冷', preserved: '保留', 'mildly-reduced': '輕度下降', 'moderately-reduced': '中度下降', 'severely-reduced': '重度下降', impaired: '受損',
  obtained: '已取得', 'not-required': '不需要', pending: '待取得', declined: '拒絕',
};

/** Human-readable value for evidence text; unknown stays explicit and never reads as negative. */
export const zh = (value: string | boolean | undefined, unknown = '未知'): string =>
  value === undefined ? unknown : value === true ? '是' : value === false ? '否' : optionLabels[value] ?? value;
