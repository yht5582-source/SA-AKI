import { readFileSync } from 'node:fs';
import { evaluateHaDrugExposure, evaluateHaEligibility, evaluateHaResponse, matchHaDevice } from '../../src/clinical/ha';
import { evaluatePrescriptionSafety } from '../../src/clinical/prescription';
import { localizeClinicalText, ruleLabel } from '../../src/clinical/localize';
import type { DecisionResult } from '../../src/clinical/types';
import { evaluateDashboard } from '../../src/features/dashboard/evaluateDashboard';
import { demoCases } from '../../src/features/demo/demoCases';
import { evaluateDemoTimepoint } from '../../src/features/demo/evaluateDemo';
import { haAssessment, haInput, haResponseInput, haSnapshot } from './haFixtures';

const strings = (result: DecisionResult) => [result.conclusion, ...result.evidence, ...result.missingData, ...result.actions, ...result.counterfactuals];

function harvest(): { texts: Set<string>; rules: Set<string> } {
  const results: DecisionResult[] = [];
  for (const demo of demoCases) demo.timepoints.forEach((_, index) => results.push(...evaluateDemoTimepoint(demo, index).decisions));
  results.push(...evaluateDashboard({ id: 'c', anonymousCode: 'x' }, []));
  // HA: cleared, each failed gate, and the response review.
  results.push(...matchHaDevice(haInput()));
  for (const device of ['polymyxin-B', 'oXiris'] as const) results.push(...matchHaDevice(haInput({ hemoadsorptionAssessment: haAssessment({ requestedDevice: device, targetAdsorbate: device === 'oXiris' ? 'cytokines-and-endotoxin' : 'endotoxin' }) })));
  results.push(...evaluateHaEligibility({ snapshot: { ...haSnapshot(), hemoadsorptionAssessment: { optedIn: true } } }).results);
  results.push(...evaluateHaEligibility({ snapshot: haSnapshot({ sourceControlStatus: 'inadequate', hemoadsorptionAssessment: haAssessment({ shockTrajectory: 'resolving', requestedDevice: 'other', targetAdsorbate: 'other', targetStillPresent: false, governance: { consent: 'declined' } }) }) }).results);
  results.push(...evaluateHaResponse(haResponseInput()));
  results.push(...evaluateHaResponse(haResponseInput({ sourceControlStatus: 'inadequate', hemoadsorptionAssessment: { optedIn: true } })));
  results.push(evaluateHaDrugExposure(haSnapshot({ antimicrobials: [{ drugName: 'vancomycin', administeredTimestamp: '2026-05-01T00:00:00Z' }] })));
  // Prescription: nothing supplied, a domain failure and a stable-looking complete input.
  results.push(...evaluatePrescriptionSafety({}));
  results.push(...evaluatePrescriptionSafety({ adultConfirmed: true, actualWeightKg: 100, weightBasis: 'actual', weightBasisReason: 'x', deliveredTargetMlKgHr: 25, downtimeFraction: 0.1, mode: 'CVVHD', bloodFlowMlMin: 60, hematocritFraction: 0.35, dialysateMlHr: 2800, preReplacementMlHr: 0, postReplacementMlHr: 0, preBloodPumpMlHr: 0, requestedUfNetMlHr: 0 }));
  results.push(...evaluatePrescriptionSafety({ adultConfirmed: true, actualWeightKg: 70, weightBasis: 'actual', weightBasisReason: 'x', deliveredTargetMlKgHr: 25, downtimeFraction: 0.3, mode: 'CVVH', bloodFlowMlMin: 100, hematocritFraction: 0.3, dialysateMlHr: 0, preReplacementMlHr: 900, postReplacementMlHr: 900, preBloodPumpMlHr: 0, requestedUfNetMlHr: 100, pressorTrend: 'rising', device: 'PrisMax', observedDeliveredMlKgHr: 15 }));
  return { texts: new Set(results.flatMap(strings)), rules: new Set(results.map(result => result.id)) };
}

// Terms clinicians use untranslated, drug and device names.
const allowed = /^(citrate|heparin|bicarbonate|vancomycin|linezolid|azole|beta|lactam|polymyxin|oXiris|CytoSorb|Jafron|Prismaflex|PrisMax|Molnar|effluent|fluid|challenge|bolus|sepsis|septic|shock|early|late|resuscitation|optimization|stabilization|evacuation|checklist|ferritin|stage|Filtration|fraction|Effluent|Citrate|lines|protocol|per|Sepsis|mmol|Cyto|Sorb|Xiris|Pris|cytokines)$/;
const englishWords = (text: string) => (text.match(/[A-Za-z][a-z]{3,}/g) ?? []).filter(word => !allowed.test(word));
const numbers = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).sort((a, b) => a - b);

it('leaves no untranslated English in any harvested engine output', () => {
  const left = [...harvest().texts].filter(text => englishWords(localizeClinicalText(text)).length > 0).map(text => `${text} → ${localizeClinicalText(text)}`);
  expect(left).toEqual([]);
});

it('keeps every clinical number when translating', () => {
  for (const text of harvest().texts) {
    const output = localizeClinicalText(text);
    for (const number of numbers(text.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/g, '').replace('platelets10e9L', '').replace(/demo-t\d-(\d+)h/g, '$1'))) expect(numbers(output), `${text} → ${output}`).toContain(number);
  }
});

it('translates every static English sentence in the engines, including branches the fixtures miss', () => {
  const literals = ['ha', 'prescription', 'prognosis'].flatMap(name => {
    const source = readFileSync(`src/clinical/${name}.ts`, 'utf8');
    return [...source.matchAll(/'((?:[^'\\\n]|\\.)*[A-Za-z]+ [A-Za-z]+ [A-Za-z]+(?:[^'\\\n]|\\.)*)'/g)].map(match => match[1]);
  });
  expect(literals.length).toBeGreaterThan(100);
  const left = literals.filter(text => !/^(ha|krt|crrt|APP|aki)-|=>|^\}/.test(text) && englishWords(localizeClinicalText(text)).length > 0);
  expect(left).toEqual([]);
});

it('labels every rule in Chinese and leaves unknown text unchanged', () => {
  for (const rule of harvest().rules) expect(ruleLabel(rule), rule).not.toBe(rule);
  expect(localizeClinicalText('未對應的文字 42')).toBe('未對應的文字 42');
});

it('renders representative dynamic values exactly', () => {
  expect(localizeClinicalText('Target 20–25 mL/kg/h; prescribed 29.4; configured estimate 23.8; observed 19.5 mL/kg/h')).toBe('目標 20–25 mL/kg/h；處方 29.4；模型估算 23.8；實測 19.5 mL/kg/h');
  expect(localizeClinicalText('factor/trajectory review：renal worsening；organ domains remain separate；uncertainty applies')).toContain('腎臟 惡化');
  expect(localizeClinicalText('暫定 KDIGO stage 3；可信度 low')).toBe('暫定 KDIGO 第 3 期；可信度 低');
  expect(localizeClinicalText('urgent confirmation：立即確認生命威脅與難治性')).toBe('立即確認生命威脅與難治性');
  expect(localizeClinicalText('clinical: Baseline SOFA')).toBe('臨床門檻：基準 SOFA');
  expect(localizeClinicalText('12345678-aaaa-4bbb-8ccc-1234567890ab: metabolic control concern')).toBe('時間點 12345678：代謝控制疑慮');
});
