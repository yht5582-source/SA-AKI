import { ChartNoAxesColumnIncreasing, Info, TrendingUp } from 'lucide-react';

export function TrajectoryPanel() {
  return <section className="trajectory-panel desktop-only" id="trajectory" aria-labelledby="trajectory-heading">
    <h2 id="trajectory-heading">0–72 小時病程</h2>
    <ol className="timeline">
      {[0, 6, 12, 24, 48, 72].map(hour => <li key={hour} className={hour === 0 ? 'current' : ''}><span className="time-dot" /><span>{hour} h</span><span>{hour === 0 ? '目前時間點' : '尚無資料'}</span></li>)}
    </ol>
    <section className="trend-summary"><h2><ChartNoAxesColumnIncreasing aria-hidden="true" />趨勢摘要</h2><p>新增至少兩個時間點後比較病程</p><a href="#trajectory-heading" className="button outline"><TrendingUp aria-hidden="true" />查看病程趨勢</a></section>
    <aside className="ha-note"><Info aria-hidden="true" /><div><strong>HA 非常規治療路徑</strong><p>僅由使用者主動進入救援評估</p></div></aside>
  </section>;
}
