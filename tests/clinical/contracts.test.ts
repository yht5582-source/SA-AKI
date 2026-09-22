import { evidenceSources, resolveDecisionSources, resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot, DecisionResult, EvidenceSource, PatientCase, Severity, WeightBasis } from '../../src/clinical/types';

const decision: DecisionResult = {
  id: 'ha-standard-care', severity: 'warning', conclusion: 'Routine HA is not supported.',
  evidence: [], missingData: [], actions: [], counterfactuals: [], sourceIds: ['SSC_2026', 'ADQI_30'],
};

it('resolves each decision citation to displayable provenance', () => {
  const resolved = resolveDecisionSources(decision);
  expect(resolved.map(source => source.id)).toEqual(['SSC_2026', 'ADQI_30']);
  for (const source of resolved) {
    expect(source.level).toBeTruthy();
    expect(source.status).not.toBe('unverified');
    expect(source.year).toBeGreaterThan(2000);
    expect(source.url).toMatch(/^https:\/\//);
  }
});

it('rejects dangling and inherited-property citation IDs', () => {
  for (const sourceId of ['MISSING', 'toString', '__proto__']) {
    expect(() => resolveDecisionSources({ ...decision, sourceIds: [sourceId] })).toThrow(/Unknown evidence source/);
  }
});

it('rejects unverified citations even if a claim was accidentally added', () => {
  const unverified: EvidenceSource = {
    id: 'UNVERIFIED', title: 'Unverified supplied reference', status: 'unverified',
    level: undefined, year: undefined, url: undefined, verification: 'unverified',
    checkedOn: '2026-09-21', supportedClaims: [{ ruleId: 'ha-not-routine', scope: 'Must never execute' }],
  };
  const registry = { UNVERIFIED: unverified };
  expect(() => resolveDecisionSources({ ...decision, sourceIds: ['UNVERIFIED'] }, registry)).toThrow(/Unverified evidence source/);
  expect(() => resolveRuleSources('ha-not-routine', ['UNVERIFIED'], registry)).toThrow(/Unverified evidence source/);
});

it('does not allow a verified study to support an unrelated rule', () => {
  expect(resolveRuleSources('ha-not-routine', ['SSC_2026']).map(source => source.id)).toEqual(['SSC_2026']);
  expect(() => resolveRuleSources('ha-class-survival-benefit', ['IMMUNOSEP_2026'])).toThrow(/does not support/);
  expect(() => resolveRuleSources('ha-not-routine', [])).toThrow(/requires evidence/);
});

it('keeps the public-review draft visible but unusable as an executable guideline', () => {
  const draft = resolveDecisionSources({ ...decision, sourceIds: ['KDIGO_2026_DRAFT'] })[0];
  expect(draft.status).toBe('draft');
  expect(draft.title).toContain('Public Review Draft');
  expect(() => resolveRuleSources('crrt-delivered-dose', ['KDIGO_2026_DRAFT'])).toThrow(/does not support/);
});

it('blocks draft execution even if a supported claim is accidentally entered', () => {
  const registry = {
    KDIGO_2026_DRAFT: {
      ...evidenceSources.KDIGO_2026_DRAFT,
      supportedClaims: [{ ruleId: 'crrt-delivered-dose', scope: 'Accidental draft support' }],
    },
  };
  expect(() => resolveRuleSources('crrt-delivered-dose', ['KDIGO_2026_DRAFT'], registry)).toThrow(/does not support/);
});

it('retains every requested reference with explicit verified or unverified provenance', () => {
  for (const id of ['SSC_2026', 'ADQI_28', 'ADQI_30', 'KDIGO_2026_DRAFT', 'TIGRIS_2026', 'MOLNAR_2026', 'PHIND_2026', 'IMMUNOSEP_2026']) {
    const source = evidenceSources[id];
    expect(source.id).toBe(id);
    for (const field of ['level', 'status', 'year', 'url']) expect(source).toHaveProperty(field);
    if (source.verification === 'unverified') expect(source.supportedClaims).toEqual([]);
    else expect(source.url).toMatch(/^https:\/\//);
  }
});

it('retains an observational study as context without pretending it is a treatment trial', () => {
  expect(evidenceSources.PHIND_2026.status).toBe('observational');
  expect(evidenceSources.PHIND_2026.supportedClaims).toEqual([]);
});

// Compile-time contract assertions are checked with the explicit tests tsc command.
// A regression that makes an unknown field required/normal, or widens categories,
// fails compilation; runtime tests above exercise the actual evidence boundary.
const sparseSnapshot: ClinicalSnapshot = {
  id: 's1', caseId: 'case-1', timestamp: '2026-09-21T00:00:00Z',
  hoursFromSepsisOnset: 6, actualWeightKg: 60, onEcmo: false,
};
const sparseCase: PatientCase = { id: 'case-1', anonymousCode: 'A001' };
expectTypeOf(sparseSnapshot.potassiumMmolL).toEqualTypeOf<number | undefined>();
expectTypeOf(sparseSnapshot.diureticExposure).toEqualTypeOf<boolean | undefined>();
expectTypeOf(sparseCase.baselineCreatinineMgDl).toEqualTypeOf<number | undefined>();
expectTypeOf<Severity>().toEqualTypeOf<'critical' | 'warning' | 'monitor' | 'stable'>();
expectTypeOf<WeightBasis>().toEqualTypeOf<'actual' | 'ideal' | 'adjusted'>();
