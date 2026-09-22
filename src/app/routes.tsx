import { Route, Routes } from 'react-router-dom';
import { WorkflowLayout } from '../components/WorkflowLayout';
import { CaseListPage } from '../features/cases/CaseListPage';
import { AssessmentWizard } from '../features/assessment/AssessmentWizard';
import { DecisionDashboard } from '../features/dashboard/DecisionDashboard';
import { HaWorkspace } from '../features/ha/HaWorkspace';
import { EvidencePage } from '../features/governance/EvidencePage';
import { PrivacyPage } from '../features/governance/PrivacyPage';
import { AboutPage } from '../features/governance/AboutPage';
import { ChangelogPage } from '../features/governance/ChangelogPage';
import { OfflinePage } from '../features/governance/OfflinePage';
import '../styles/workflow.css';
import '../styles/dashboard.css';
import '../styles/governance.css';
// Legacy concept-shell anchors; maintained until the decision workspace is integrated.
// eslint-disable-next-line react-refresh/only-export-components
export const routes = {
  decision: '#decision',
  assessment: '#assessment',
  trajectory: '#trajectory',
  evidence: '#evidence',
} as const;

export function ApplicationRoutes() {
  return <WorkflowLayout><Routes><Route path="/" element={<CaseListPage/>}/><Route path="/case/:caseId" element={<DecisionDashboard/>}/><Route path="/case/:caseId/ha" element={<HaWorkspace/>}/><Route path="/case/:caseId/assessment/:snapshotId?" element={<AssessmentWizard/>}/><Route path="/evidence" element={<EvidencePage/>}/><Route path="/privacy" element={<PrivacyPage/>}/><Route path="/about" element={<AboutPage/>}/><Route path="/changelog" element={<ChangelogPage/>}/><Route path="/offline" element={<OfflinePage/>}/><Route path="*" element={<p role="alert">找不到頁面；請返回病例總覽。</p>}/></Routes></WorkflowLayout>;
}
