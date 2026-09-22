import { BookOpen, TriangleAlert } from 'lucide-react';
import { evidenceSources } from '../clinical/sources';
import type { SourceStatus } from '../clinical/types';

const labels: Record<SourceStatus, string> = {
  guideline: '正式指引', draft: '草案｜不可作為可執行規則', consensus: '共識', trial: '試驗',
  position: '專家立場', local: '本機規則｜非經驗證治療閾值', unverified: '未核實｜不可作為可執行規則', observational: '觀察研究',
};
// Diagnosis cards aggregate the named pure-engine rules; publication status remains independent.
const claimIds: Record<string, readonly string[]> = {
  'aki-staging': ['aki-definition-staging'],
  'sepsis-assessment': ['sepsis-diagnostic-context'],
  'sa-aki-timing': ['sa-aki-seven-day-window', 'sa-aki-early-late-local'],
};
export function EvidenceBadge({ sourceId, ruleId }: { sourceId: string; ruleId?: string }) {
  const source = evidenceSources[sourceId];
  const restricted = !source || source.verification !== 'verified' || source.status === 'unverified' || source.status === 'draft';
  const supports = !restricted && !!ruleId && source.supportedClaims.some(claim => (claimIds[ruleId] ?? [ruleId]).includes(claim.ruleId));
  const Icon = restricted ? TriangleAlert : BookOpen;
  return <span className={`evidence-badge ${restricted ? 'restricted' : ''}`}>
    <Icon size={15} aria-hidden="true"/>
    <span>{source ? labels[source.status] : '未知來源｜不可作為可執行規則'} · {sourceId}
      {source?.verification === 'unverified' && source.status !== 'unverified' ? ' · 未核實｜不可作為可執行規則' : ''}
      {source && <small>{source.title} · {source.year ?? '年份未核實'} · {source.level ?? '證據層級未核實'}</small>}
      <small>文獻核實：{source?.verification === 'verified' ? '已核實' : '未核實'} · 核對日期：{source?.checkedOn ?? '未知'}；不代表臨床規則已驗證。</small>
      <small>{supports ? '來源適用範圍已對應；仍非自動醫囑' : '僅供背景查閱；不支持此可執行規則'}</small>
      {source?.url && <a href={source.url} target="_blank" rel="noreferrer">查閱來源（新分頁）</a>}
    </span>
  </span>;
}
