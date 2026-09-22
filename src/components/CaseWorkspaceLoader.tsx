import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { caseRepository, type StoredCase } from '../data/caseRepository';

export function CaseWorkspaceLoader({ children }: { children: (stored: StoredCase) => ReactNode }) {
  const { caseId = '' } = useParams();
  return <LoadCase key={caseId} caseId={caseId}>{children}</LoadCase>;
}
function LoadCase({ caseId, children }: { caseId: string; children: (stored: StoredCase) => ReactNode }) {
  const [stored, setStored] = useState<StoredCase>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void caseRepository.getCase(caseId).then(value => {
      if (!active) return;
      if (!value) setError('找不到病例'); else setStored(value);
    }).catch(() => { if (active) setError('無法讀取本機資料'); });
    return () => { active = false; };
  }, [caseId]);
  if (error) return <p role="alert">{error}</p>;
  if (!stored) return <p role="status">讀取本機病例…</p>;
  return children(stored);
}
