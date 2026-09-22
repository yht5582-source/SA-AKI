import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ClinicalSnapshot } from '../../clinical/types';
import { evaluateHaEligibility } from '../../clinical/ha';
import { caseExportSchema, clinicalSnapshotSchema } from '../../data/schema';
import { caseRepository, type StoredCase } from '../../data/caseRepository';
import { Stepper } from '../../components/Stepper';
import { AssessmentStep } from './steps/AssessmentStep';
import { allFields, haFields, haExposureFields, stepFields, stepLabels } from './steps/fields';
import { clearAssessmentDrafts, readDraft, writeDraft } from './draft';
import { HaWarning } from '../ha/HaWarning';
import { haStatusLabel } from '../ha/haPresentation';
import { strictlyEarlierSnapshot } from '../dashboard/snapshotContext';

function candidateFrom(values: Record<string, string>, caseId: string, snapshotId: string, haEnabled: boolean): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id: snapshotId, caseId };
  for (const field of allFields) {
    const raw = values[field.key]; if (!raw || (!haEnabled && field.key.startsWith('hemoadsorptionAssessment.'))) continue;
    let value: unknown = raw;
    if (field.type === 'number' || field.type === 'numeric-select') value = Number(raw);
    if (field.type === 'json' || field.type === 'multi-select') {
      try { value = JSON.parse(raw); } catch { value = raw; /* Invalid syntax remains invalid for strict persistence validation. */ }
    }
    if (field.type === 'boolean') value = raw === 'true' ? true : raw === 'false' ? false : raw;
    if (field.type === 'datetime-local') value = Number.isFinite(Date.parse(raw + 'Z')) ? new Date(raw + 'Z').toISOString() : raw;
    const path = field.key.split('.'); let object = candidate;
    path.slice(0, -1).forEach((key, index) => { object[key] ??= /^\d+$/.test(path[index + 1]) ? [] : {}; object = object[key] as Record<string, unknown>; });
    object[path[path.length - 1]] = value;
  }
  if (haEnabled) { candidate.hemoadsorptionAssessment ??= {}; (candidate.hemoadsorptionAssessment as Record<string, unknown>).optedIn = true; }
  return candidate;
}
function valueAtPath(snapshot: ClinicalSnapshot, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, snapshot);
}
function valuesFrom(snapshot: ClinicalSnapshot): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of allFields) {
    const value = valueAtPath(snapshot, field.key);
    if (value !== undefined) values[field.key] = field.type === 'datetime-local' ? new Date(String(value)).toISOString().slice(0, -1) : field.type === 'json' || field.type === 'multi-select' ? JSON.stringify(value) : String(value);
  }
  return values;
}

export function AssessmentWizard() {
  const location = useLocation();
  return <AssessmentLoader key={location.pathname}/>;
}
function AssessmentLoader() {
  const { caseId = '', snapshotId } = useParams(); const [stored, setStored] = useState<StoredCase>(); const [error, setError] = useState('');
  useEffect(() => { let active = true;
    void caseRepository.getCase(caseId).then(result => { if (!active) return; if (!result) setError('找不到病例'); else if (snapshotId && !result.snapshots.some(snapshot => snapshot.id === snapshotId)) setError('找不到時間點'); else setStored(result); }).catch(() => { if (active) setError('無法讀取本機資料'); });
    return () => { active = false; };
  }, [caseId, snapshotId]);
  if (error) return <p role="alert">{error}</p>;
  if (!stored || stored.case.id !== caseId) return <p role="status">讀取本機病例…</p>;
  return <WizardForm key={`${caseId}/${snapshotId ?? 'new'}`} stored={stored} snapshotId={snapshotId}/>;
}

function WizardForm({ stored, snapshotId }: { stored: StoredCase; snapshotId?: string }) {
  const navigate = useNavigate(); const location = useLocation();
  const existing = stored.snapshots.find(snapshot => snapshot.id === snapshotId);
  const [draft, setDraft] = useState(() => {
    const initial = existing ? { values: valuesFrom(existing), step: 0, haEnabled: existing.hemoadsorptionAssessment?.optedIn === true } : readDraft(stored.case.id);
    return new URLSearchParams(location.search).get('step') === 'ha' ? { ...initial, step: 6 } : initial;
  });
  const [id] = useState(() => crypto.randomUUID()); const [review, setReview] = useState(!!existing); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [haReviewed, setHaReviewed] = useState(false);
  const [saveIncompleteHa, setSaveIncompleteHa] = useState(false);
  const [stepFocusRequest, setStepFocusRequest] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null); const readonly = !!existing;
  // Saved observations are immutable inputs to validation/rules, never round-tripped through form strings.
  const candidate = existing ?? candidateFrom(draft.values, stored.case.id, id, draft.haEnabled);
  const validation = clinicalSnapshotSchema.safeParse(candidate);
  const errors: Record<string, string> = {};
  if (!validation.success) for (const issue of validation.error.issues) {
    const path = issue.path.join('.');
    const field = allFields.find(item => path === item.key || path.startsWith(item.key + '.'));
    errors[field?.key ?? path] = '請依可接受範圍與精確結構輸入有效資料；JSON 不可加入其他欄位或轉換數字型別，不可將未知設為零或否。';
  }
  const previous = validation.success ? strictlyEarlierSnapshot(validation.data, stored.snapshots) : undefined;
  const ha = validation.success && draft.haEnabled ? evaluateHaEligibility({ snapshot: validation.data, previousSnapshot: previous }) : undefined;
  const haEligible = ha?.status === 'multidisciplinary-review';
  const retainedIncompleteHa = readonly && existing?.hemoadsorptionAssessment?.reviewStatus === 'incomplete';
  const visibleHaResults = retainedIncompleteHa && haEligible ? [] : ha?.results ?? [];
  const exportValidation = validation.success ? caseExportSchema.safeParse({ schemaVersion: 1, case: stored.case, snapshots: [validation.data] }) : undefined;
  const haReviewRecorded = haEligible && (haReviewed || existing?.hemoadsorptionAssessment?.reviewStatus === 'multidisciplinary-review');
  const canSave = validation.success && exportValidation?.success && (!draft.haEnabled || haReviewRecorded || saveIncompleteHa);
  const missing = allFields.filter(field => !draft.values[field.key] && ['timestamp', 'hoursFromSepsisOnset', 'actualWeightKg', 'onEcmo', 'creatinineMgDl', 'urineVolumeMl', 'urineObservationHours', 'urineWeightBasis', 'potassiumMmolL', 'arterialPh', 'mapMmHg', 'lactateMmolL'].includes(field.key));
  function update(values: Record<string, string>) { setDraft(current => ({ ...current, values })); setHaReviewed(false); setSaveIncompleteHa(false); }
  function selectStep(step: number) { setDraft(current => current.step === step ? current : { ...current, step }); setStepFocusRequest(current => current + 1); }
  useEffect(() => { if (!readonly && !writeDraft(stored.case.id, draft)) { /* The status below describes session persistence as best effort. */ } }, [draft, readonly, stored.case.id]);
  useEffect(() => { heading.current?.focus(); }, [draft.step, review, stepFocusRequest]);
  return <section className="assessment"><div className="page-heading"><h2>匿名病例 {stored.case.anonymousCode}</h2><Link to="/">返回病例清單</Link><Link to={`/case/${encodeURIComponent(stored.case.id)}`}>決策首頁</Link></div>
    {location.state?.saved === true && <p role="status">時間點已儲存</p>}
    {location.state?.draftCleanupFailed === true && <p role="status" className="field-error">時間點已儲存，但瀏覽器無法清除目前分頁的評估草稿；草稿可能仍保留。請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。</p>}
    {readonly && <p>已儲存時間點（唯讀）</p>}
    {!review && <Stepper labels={stepLabels} current={draft.step} onChange={selectStep}/>}
    <div className="assessment-workspace"><section className="assessment-input"><h2 ref={heading} tabIndex={-1}>{review ? '最終檢視' : stepLabels[draft.step]}</h2>
      {(draft.step === 6 || draft.haEnabled) && <HaWarning/>}
      {draft.step === 5 && <p>處方算式與 RCA 僅供臨床團隊審查，非機器醫囑；所有確認均須明確輸入，未知不代表同意或無禁忌。不得據此自動設定機器或 citrate／calcium 輸注。</p>}
      {draft.haEnabled && <p role="status">{haReviewRecorded ? 'HA 多專科審查已記錄；非治療資格或自動醫囑。' : haStatusLabel(ha, validation.success ? validation.data.hemoadsorptionAssessment : { optedIn: true })}</p>}
      {review ? <><p>請確認資料與缺失項目。未知值會保留為未知；儲存不表示完成診斷或治療建議。</p><dl className="review-values">{allFields.filter(field => draft.haEnabled || ![...haFields, ...haExposureFields].includes(field) || (!field.key.startsWith('hemoadsorptionAssessment.') && draft.values[field.key])).map(field => <div key={field.key}><dt>{field.label}：{draft.values[field.key] ? `${existing && field.type === 'datetime-local' ? valueAtPath(existing, field.key) : draft.values[field.key]} ${field.unit ?? ''}` : '未知'}</dt>{errors[field.key] && <dd className="field-error">{errors[field.key]}</dd>}</div>)}</dl>{existing?.hemoadsorptionExposures && <details><summary>全部 HA 暴露紀錄（{existing.hemoadsorptionExposures.length} 筆，唯讀）</summary><pre>{JSON.stringify(existing.hemoadsorptionExposures, null, 2)}</pre></details>}{!readonly && draft.haEnabled && !haReviewRecorded && <label className="ha-optin"><input type="checkbox" checked={saveIncompleteHa} onChange={event => setSaveIncompleteHa(event.target.checked)}/>僅儲存未完成 HA 觀察（不代表符合資格）</label>}</>
        : draft.step === 6 ? <>
          <p className="ha-note">HA 非常規治療路徑；最高狀態僅為多專科審查，不是治療醫囑。</p>
          <label className="ha-optin"><input type="checkbox" checked={draft.haEnabled} disabled={readonly} onChange={event => { setDraft(current => ({ ...current, haEnabled: event.target.checked })); setHaReviewed(false); setSaveIncompleteHa(false); }}/>主動啟用 HA 救援評估</label>
          {!draft.haEnabled && <p>已輸入的 HA 觀察值會保留；不啟用 HA 評估。</p>}
          {draft.haEnabled && <>
            <AssessmentStep fields={haFields} values={draft.values} errors={errors} onChange={(key, value) => update({ ...draft.values, [key]: value })} disabled={readonly}/>
            <h3>已接受 HA 暴露的紀錄（非啟動指令）</h3><p>此表單可記錄一個療程；開始時間用於跨時點核對。停止須明確記錄，後续空白不代表已停機。重複／多重療程需人工核對；完整多療程資料可由已驗證 JSON 匯入，唯讀檢視保留全部原始紀錄。下列範例僅示範格式，非給藥或裝置建議。</p>
            <AssessmentStep fields={haExposureFields} values={draft.values} errors={errors} onChange={(key, value) => update({ ...draft.values, [key]: value })} disabled={readonly}/>
            <p>{retainedIncompleteHa ? 'HA 尚未完成：此時間點僅保存觀察，未記錄審查完成。' : haEligible ? '可送多專科審查' : 'HA 尚未完成：必要資料或安全門檻未通過'}</p>
            {visibleHaResults.map(result => <details key={result.id}><summary>{result.conclusion}</summary><ul>{[...result.missingData, ...result.evidence].map((item, i) => <li key={i}>{item}</li>)}</ul></details>)}
            <button className="button" disabled={!haEligible || readonly} onClick={() => { setHaReviewed(true); setSaveIncompleteHa(false); }}>完成 HA 多專科審查</button>
            {haReviewed && <p>多專科審查已確認；非自動醫囑。</p>}
          </>}
        </>
          : <><AssessmentStep fields={stepFields[draft.step]} values={draft.values} errors={errors} onChange={(key, value) => update({ ...draft.values, [key]: value })} disabled={readonly}/>{draft.step === 1 && <p>基準 SCr：{stored.case.baselineCreatinineMgDl ?? '未知'} mg/dL；來源：{stored.case.baselineCreatinineSource ?? '尚未記錄'}。Sepsis 起始時間：{stored.case.sepsisOnsetTimestamp ?? '尚未記錄'}。</p>}</>}
    </section><aside className="assessment-judgment"><h2>目前判斷</h2><div className="judgment"><div><strong>需重評</strong><p>資料仍需臨床確認；未完成判斷不等於正常。</p></div></div><section className="missing-data"><h3>缺失資料</h3><ul>{missing.map(field => <li key={field.key}>{field.label}{['timestamp', 'hoursFromSepsisOnset', 'actualWeightKg', 'onEcmo'].includes(field.key) ? '（儲存必填）' : '（臨床評估未完成）'}</li>)}</ul>{!stored.case.baselineCreatinineSource && <p>基準 SCr 與資料來源尚未記錄</p>}{draft.haEnabled && !haEligible && <p>HA 四項門檻尚未通過；可明確確認僅儲存未完成觀察，再於後續時間點重評。</p>}</section><section className="next-action"><h3>下一步</h3><p>補齊缺失資料後重新評估</p><small>重評時間：待臨床確認</small></section></aside><aside className="assessment-timeline"><h2>既有時間點</h2><ul>{stored.snapshots.map(snapshot => <li key={snapshot.id}><Link to={`/case/${encodeURIComponent(stored.case.id)}/assessment/${encodeURIComponent(snapshot.id)}`}>{snapshot.hoursFromSepsisOnset} h · {snapshot.timestamp}</Link></li>)}</ul>{stored.snapshots.length === 0 && <p>尚無資料</p>}<Link className="button" to={`/case/${encodeURIComponent(stored.case.id)}/assessment`}>新增時間點</Link></aside></div>
    {error && <p role="alert">{error}</p>}{review && exportValidation && !exportValidation.success && <p role="alert">時間點與病例時間關係不一致，請修正後儲存。</p>}
    <div className="assessment-actions">{review ? <><button className="button" onClick={() => setReview(false)}>返回編輯</button>{!readonly && <button className="button primary" disabled={!canSave || busy} onClick={async () => {
      if (!canSave || !validation.success || busy) return; setBusy(true); setError('');
      const observation: ClinicalSnapshot = draft.haEnabled ? { ...validation.data, hemoadsorptionAssessment: { ...validation.data.hemoadsorptionAssessment, reviewStatus: haReviewRecorded ? 'multidisciplinary-review' : 'incomplete' } } : validation.data;
      try {
        await caseRepository.saveSnapshot(observation);
        const draftCleared = clearAssessmentDrafts(stored.case.id);
        navigate(`/case/${encodeURIComponent(stored.case.id)}/assessment/${id}`, { replace: true, state: { saved: true, draftCleanupFailed: !draftCleared } });
      } catch { setError('儲存失敗；資料未確認寫入，請重試。'); } finally { setBusy(false); }
    }}>確認儲存時間點</button>}</> : <><button className="button" disabled={draft.step === 0} onClick={() => setDraft(current => ({ ...current, step: current.step - 1 }))}>上一步</button><button className="button primary" disabled={draft.step === 7} onClick={() => setDraft(current => ({ ...current, step: current.step + 1 }))}>下一步</button><button className="button" onClick={() => setReview(true)}>檢視並確認</button></>}<small>未確認草稿以 sessionStorage 嘗試保留於目前分頁工作階段；尚未儲存至病例。儲存後會嘗試清除，若瀏覽器拒絕則顯示警示。</small></div>
  </section>;
}
