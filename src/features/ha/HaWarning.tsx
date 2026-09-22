import { Info } from 'lucide-react';
export function HaWarning() {
  return <div className="ha-warning" role="note" aria-label="HA 非常規治療警告"><Info aria-hidden="true"/><div><strong>HA 非常規治療路徑</strong><p>SSC 2026：有條件反對成人 sepsis／septic shock 常規血液淨化；ADQI 30：現代 HA 仍屬實驗性。移除生物標記不證明臨床效益；裝置與表型證據不可互換。</p><p>僅由使用者主動進入救援評估；最高狀態不是治療資格、效益保證或自動醫囑。</p></div></div>;
}
