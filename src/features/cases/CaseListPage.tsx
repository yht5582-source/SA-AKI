import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { caseRepository } from '../../data/caseRepository';
import type { PatientCase } from '../../clinical/types';
import { CaseForm } from './CaseForm';
import { ImportExportPanel } from './ImportExportPanel';
import { clearAssessmentDrafts } from '../assessment/draft';

export function CaseListPage() {
  const navigate = useNavigate(); const [cases, setCases] = useState<PatientCase[]>([]); const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PatientCase | null>(null); const [status, setStatus] = useState('');
  const [exported, setExported] = useState(''); const [error, setError] = useState(''); const [pending, setPending] = useState<PatientCase | 'all' | null>(null); const [busy, setBusy] = useState(false);
  async function refresh() { try { setCases(await caseRepository.listCases()); } catch { setError('無法讀取本機資料。'); } }
  useEffect(() => { let active = true; void caseRepository.listCases().then(result => { if (active) setCases(result); }).catch(() => { if (active) setError('無法讀取本機資料。'); }); return () => { active = false; }; }, []);
  return <><div className="page-heading"><h2>病例總覽</h2><button className="button primary" onClick={() => { setCreating(true); setEditing(null); setStatus(''); }}>新增匿名病例</button></div><p>已確認病例與時間點存於 IndexedDB；未確認評估草稿另存於目前分頁的 sessionStorage。刪除／清除會嘗試移除目前分頁草稿，若失敗會警示。</p>
    {creating && <CaseForm onCancel={() => setCreating(false)} onCreated={id => navigate(`/case/${id}/assessment`)}/>}
    {editing && <CaseForm key={editing.id} initial={editing} onCancel={() => setEditing(null)} onCreated={() => { setEditing(null); setStatus('病例資料已更新'); setExported(''); void refresh(); }}/>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
    <ul className="case-list">{cases.map(patient => <li key={patient.id}><div className="workflow-actions"><Link to={`/case/${encodeURIComponent(patient.id)}/assessment`}>開啟 {patient.anonymousCode}</Link><Link to={`/case/${encodeURIComponent(patient.id)}`}>決策首頁 {patient.anonymousCode}</Link></div><div className="workflow-actions"><button className="button" onClick={() => { setEditing(patient); setCreating(false); setStatus(''); }}>編輯 {patient.anonymousCode}</button><button className="button" onClick={async () => { try { setExported(JSON.stringify(await caseRepository.exportCase(patient.id), null, 2)); } catch { setError('無法匯出病例。'); } }}>匯出 {patient.anonymousCode}</button><button className="button" onClick={() => setPending(patient)}>刪除 {patient.anonymousCode}</button></div></li>)}</ul>
    {cases.length === 0 && <p>尚無匿名病例</p>}
    <ImportExportPanel exported={exported} onImported={() => { void refresh(); }}/>
    <button className="button" onClick={() => setPending('all')}>清除全部本機資料</button>
    {pending && <section role="alertdialog" aria-modal="false" aria-labelledby="delete-title" className="confirmation"><h2 id="delete-title">{pending === 'all' ? '清除全部本機資料？' : `刪除 ${pending.anonymousCode}？`}</h2><p>病例及時間點將永久刪除；請先匯出備份。</p><div className="workflow-actions"><button autoFocus className="button" disabled={busy} onClick={() => setPending(null)}>取消</button><button className="button primary" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const clearedAll = pending === 'all';
        let draftCleared: boolean;
        if (clearedAll) { await caseRepository.clearAll(); draftCleared = clearAssessmentDrafts(); }
        else { await caseRepository.deleteCase(pending.id); draftCleared = clearAssessmentDrafts(pending.id); }
        setStatus(draftCleared ? '' : clearedAll
          ? '病例與時間點已從 IndexedDB 清除，但瀏覽器無法清除目前分頁的評估草稿；草稿可能仍保留。請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。'
          : '病例已從 IndexedDB 刪除，但瀏覽器無法清除目前分頁的評估草稿；草稿可能仍保留。請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。');
        setPending(null); setExported(''); await refresh();
      }
      catch { setError('刪除失敗；請重新確認本機資料。'); } finally { setBusy(false); }
    }}>{pending === 'all' ? '確認清除全部' : '確認刪除'}</button></div></section>}
  </>;
}
