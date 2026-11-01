import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { evidenceSources } from '../../clinical/sources';
import { demoCases } from '../demo/demoCases';
import { findMindMap, mindMaps, type MapBranch, type MapNode } from './mindMapData';

function SourceTag({ id }: { id: string }) {
  const source = evidenceSources[id];
  if (source.status === 'local') return <span className="mm-src mm-src-local">本工具慣例</span>;
  const label = id.replace(/_/g, ' ').replace('ELSO FLUID AKI', 'ELSO').replace('MAKE DEFINITIONS', 'MAKE').replace(' 2016', '').replace('SEPSIS 3', 'Sepsis-3').replace('STARRT AKI', 'STARRT-AKI');
  return <span className="mm-src">{label}</span>;
}

function Leaf({ node }: { node: MapNode }) {
  return <li className="mm-item">
    <div className={node.children ? 'mm-node mm-topic' : 'mm-node mm-leaf'}>{node.text}{node.src && <SourceTag id={node.src}/>}{node.local && <span className="mm-src mm-src-local">本工具慣例</span>}</div>
    {node.children && <ul className="mm-children">{node.children.map(child => <Leaf key={child.text} node={child}/>)}</ul>}
  </li>;
}

function Branch({ branch, open, onToggle }: { branch: MapBranch; open: boolean; onToggle: () => void }) {
  const demo = demoCases.findIndex(item => item.id === branch.demoId);
  return <li className={`mm-item mm-branch mm-${branch.color}`}>
    <div className="mm-branch-head">
      <button className="mm-node mm-branch-node" aria-expanded={open} onClick={onToggle}><span aria-hidden="true">{open ? '−' : '＋'}</span>{branch.text}</button>
      {open && demo >= 0 && <Link className="mm-demo" to={`/demo/${branch.demoId}`}>示範 T{demo + 1}</Link>}
    </div>
    {open && branch.children && <ul className="mm-children">{branch.children.map(child => <Leaf key={child.text} node={child}/>)}</ul>}
  </li>;
}

export function MindMapPage() {
  const [params, setParams] = useSearchParams();
  const map = findMindMap(params.get('map'));
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const allClosed = map.branches.every(branch => closed.has(branch.id));
  const toggle = (id: string) => setClosed(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <section className="learning-page" aria-labelledby="mindmap-heading">
    <div className="learning-intro">
      <h2 id="mindmap-heading">心智圖</h2>
      <p>把診斷與治療的判斷順序畫成一張圖，按主幹可收合。每項標示來源：指引或共識名稱，或「本工具慣例」。</p>
      <p className="learning-note">複習用，非治療流程或醫囑。「本工具慣例」是本工具的操作性篩檢，不是經驗證的治療閾值；內容尚待專業審查。</p>
    </div>
    <div className="mm-toolbar">
      <div className="demo-steps" role="group" aria-label="選擇心智圖">
        {mindMaps.map(item => <button key={item.id} className={item.id === map.id ? 'current' : ''} aria-pressed={item.id === map.id} onClick={() => setParams({ map: item.id }, { replace: true })}>{item.id === 'diagnosis' ? '診斷' : '治療'}</button>)}
      </div>
      <button className="button mm-all" onClick={() => setClosed(allClosed ? new Set() : new Set(map.branches.map(branch => branch.id)))}>{allClosed ? '全部展開' : '全部收合'}</button>
    </div>
    <div className="mm-tree" role="region" aria-label={`${map.title}心智圖`}>
      <div className="mm-node mm-root">{map.title}</div>
      <ul className="mm-children mm-top">{map.branches.map(branch => <Branch key={branch.id} branch={branch} open={!closed.has(branch.id)} onToggle={() => toggle(branch.id)}/>)}</ul>
    </div>
  </section>;
}
