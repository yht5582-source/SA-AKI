import { useState } from 'react';
import { caseRepository } from '../../data/caseRepository';

export function ImportExportPanel({ exported, onImported }: { exported: string; onImported: () => void }) {
  const [input, setInput] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <section className="data-panel" aria-labelledby="data-title"><h2 id="data-title">資料管理</h2><p>JSON 版本 1；檔案包含匿名臨床資料，請妥善保管。本機匯入不會上傳。</p>
    <label htmlFor="import-json">匯入 JSON</label><textarea id="import-json" value={input} onChange={event => setInput(event.target.value)} spellCheck={false}/>
    <button className="button" disabled={busy || !input.trim()} onClick={async () => {
      setBusy(true); setError('');
      try { await caseRepository.importCase(JSON.parse(input)); setInput(''); onImported(); }
      catch { setError('匯入失敗：格式、版本、識別資料或重複 ID 不符合要求；原有資料未變更。'); }
      finally { setBusy(false); }
    }}>驗證並匯入</button>{error && <p role="alert">{error}</p>}
    {exported && <><label htmlFor="export-json">匯出 JSON</label><textarea id="export-json" value={exported} readOnly/><a className="button" download="anonymous-case-v1.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(exported)}`}>下載 JSON</a></>}
  </section>;
}
