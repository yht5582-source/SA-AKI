import { Link } from 'react-router-dom';
import { demoCases } from './demoCases';

export function DemoListPage() {
  return <section className="learning-page" aria-labelledby="demo-heading">
    <div className="learning-intro">
      <h2 id="demo-heading">示範病例</h2>
      <p>6 個虛構病例，涵蓋分期、輸液、透析時機、模式、CRRT 處方到脫離。每個時間點先想一想，再看工具怎麼判斷、為什麼。</p>
      <p className="learning-note">全部為教學用虛構資料，非真實病人。判斷結果由與決策首頁相同的規則即時算出；內容尚待專業審查，不可作為處置依據。</p>
    </div>
    <ol className="demo-grid">
      {demoCases.map((demo, index) => <li key={demo.id}>
        <Link className="demo-card" to={`/demo/${demo.id}`}>
          <span className="demo-card-number">T{index + 1}</span>
          <strong>{demo.title}</strong>
          <span>{demo.oneLine}</span>
          <span className="demo-tags">{demo.tags.map(tag => <span key={tag}>{tag}</span>)}<span>{demo.timepoints.length} 個時間點</span></span>
        </Link>
      </li>)}
    </ol>
    <p className="learning-next">讀完了？<Link to="/quiz">做 20 題測驗檢驗一下</Link></p>
  </section>;
}
