import { BookOpen, FileText, House, LaptopMinimal, LifeBuoy, List, Settings, TrendingUp } from 'lucide-react';
import { routes } from './routes';

export function Navigation() {
  return <aside className="sidebar desktop-only">
    <div className="brand"><img src={`${import.meta.env.BASE_URL}icons/compass.svg`} alt="" /><strong>SA-AKI</strong></div>
    <nav aria-label="主要導覽">
      <button disabled><House aria-hidden="true" />病例總覽</button>
      <a href={routes.decision} aria-current="page"><FileText aria-hidden="true" />決策首頁</a>
      <a href={routes.assessment}><List aria-hidden="true" />逐步評估</a>
      <a href={routes.trajectory}><TrendingUp aria-hidden="true" />病程趨勢</a>
      <button disabled><FileText aria-hidden="true" />床邊摘要</button>
      <div className="nav-divider" />
      <button disabled className="ha-nav"><LifeBuoy aria-hidden="true" /><span>HA 救援評估<small>選配・未啟用</small></span></button>
      <a href={routes.evidence}><BookOpen aria-hidden="true" />證據與版本</a>
      <button disabled><Settings aria-hidden="true" />資料管理</button>
    </nav>
    <p className="local-note"><LaptopMinimal aria-hidden="true" />資料只存在本機</p>
  </aside>;
}
