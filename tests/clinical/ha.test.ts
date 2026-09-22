import { evaluateHaEligibility, evaluateHaResponse, matchHaDevice, type HaEligibility } from '../../src/clinical/ha';
import { evidenceSources, resolveRuleSources } from '../../src/clinical/sources';
import { clinicalSnapshotSchema } from '../../src/data/schema';
import type { ClinicalSnapshot, DecisionResult, HaDevice, HemoadsorptionAssessment } from '../../src/clinical/types';
import { haAssessment, haInput, haResponseInput, haSnapshot } from './haFixtures';

const words = (results: DecisionResult[]) => results.flatMap(r => [r.conclusion, ...r.evidence, ...r.missingData, ...r.actions, ...r.counterfactuals]).join(' ');
const inputWith = (assessment: Partial<HemoadsorptionAssessment>) => haInput({ hemoadsorptionAssessment: haAssessment(assessment) });
const decision = (results: DecisionResult[], id: string) => {
  const found = results.find(r => r.id === id);
  expect(found, `missing decision ${id}`).toBeDefined();
  return found!;
};

describe('HA opt-in and four fail-closed gates', () => {
  it.each([undefined, false])('never opens HA from measurements or CRRT alone when opt-in is %s', optedIn => {
    const input = inputWith({ optedIn });
    input.snapshot.crrtMode = 'CVVHDF';
    expect(evaluateHaEligibility(input)).toMatchObject({ status: 'not-eligible', results: [] });
    expect(matchHaDevice(input)).toEqual([]);
    const response = haResponseInput();
    response.baseline.snapshot.hemoadsorptionAssessment!.optedIn = optedIn;
    response.snapshot.hemoadsorptionAssessment!.optedIn = optedIn;
    expect(evaluateHaResponse(response)).toEqual([]);
  });

  it('has no implicit assessment defaults', () => {
    expect(evaluateHaEligibility(haInput({ hemoadsorptionAssessment: undefined })).results).toEqual([]);
  });

  it('caps the strongest result at the exact review-only label', () => {
    const result = evaluateHaEligibility(haInput());
    expect(result.status).toBe('multidisciplinary-review');
    expect(result.gates).toEqual({ clinical: true, target: true, safety: true, governance: true });
    expect(decision(result.results, 'ha-gated-review').conclusion).toBe('eligible for multidisciplinary review');
    expect(result.results[0].id).toBe('ha-not-routine');
    expect(words(result.results)).toMatch(/SSC 2026.*conditional.*against.*routine/i);
    expect(words(result.results)).toMatch(/ADQI.*experimental/i);
  });

  const positiveFields = [
    ['clinical', 'adultConfirmed'], ['clinical', 'septicShockConfirmed'], ['clinical', 'reversibleTrait'],
    ['target', 'hyperinflammatoryPhenotype'],
  ] as const;
  for (const [gate, field] of positiveFields) {
    it.each([undefined, false])(`blocks ${gate} when ${field} is %s`, value => {
      const result = evaluateHaEligibility(inputWith({ [field]: value }));
      expect(result.status).toBe(value === undefined ? 'incomplete' : 'not-eligible');
      expect(result.gates[gate]).toBe(false);
    });
  }

  for (const field of ['antimicrobials', 'sourceControl', 'fluids', 'vasopressors', 'corticosteroids'] as const) {
    it.each([undefined, false])(`blocks clinical gate when standard care ${field} is %s`, value => {
      const assessment = haAssessment();
      assessment.standardCare![field] = value;
      const result = evaluateHaEligibility(haInput({ hemoadsorptionAssessment: assessment }));
      expect(result.status).toBe(value === undefined ? 'incomplete' : 'not-eligible');
      expect(result.gates.clinical).toBe(false);
    });
  }

  for (const field of ['plateletsAcceptable', 'coagulationAcceptable', 'albuminAcceptable', 'hepaticRenalReviewed', 'electrolytesReviewed', 'vascularAccessReviewed', 'anticoagulationReviewed', 'circuitCompatible', 'drugRemovalPlan', 'goalsCompatible'] as const) {
    it.each([undefined, false])(`blocks safety gate when ${field} is %s`, value => {
      const assessment = haAssessment();
      assessment.safety![field] = value;
      const result = evaluateHaEligibility(haInput({ hemoadsorptionAssessment: assessment }));
      expect(result.status).toBe(value === undefined ? 'incomplete' : 'not-eligible');
      expect(result.gates.safety).toBe(false);
    });
  }

  for (const field of ['uncontrolledBleeding', 'irreversibleOrganFailure'] as const) {
    it.each([undefined, true])(`blocks safety gate when ${field} is %s`, value => {
      const assessment = haAssessment();
      assessment.safety![field] = value;
      const result = evaluateHaEligibility(haInput({ hemoadsorptionAssessment: assessment }));
      expect(result.status).toBe(value === undefined ? 'incomplete' : 'not-eligible');
      expect(result.gates.safety).toBe(false);
    });
  }

  for (const field of ['criticalCareApproved', 'nephrologyApproved', 'infectiousDiseasesApproved', 'pharmacistExposurePlan', 'monitoringPlan', 'stopPlan', 'deviceProtocolReviewed'] as const) {
    it.each([undefined, false])(`blocks governance when ${field} is %s`, value => {
      const assessment = haAssessment();
      assessment.governance![field] = value;
      const result = evaluateHaEligibility(haInput({ hemoadsorptionAssessment: assessment }));
      expect(result.status).toBe(value === undefined ? 'incomplete' : 'not-eligible');
      expect(result.gates.governance).toBe(false);
    });
  }

  it.each(['standardCare', 'safety', 'governance'] as const)('keeps missing %s incomplete, never normal', field => {
    expect(evaluateHaEligibility(inputWith({ [field]: undefined })).status).toBe('incomplete');
  });

  it.each([undefined, 'pending', 'declined'] as const)('requires applicable consent: %s', consent => {
    const a = haAssessment();
    a.governance!.consent = consent;
    expect(evaluateHaEligibility(haInput({ hemoadsorptionAssessment: a })).gates.governance).toBe(false);
  });

  it.each(['protocol', 'registry', 'research'] as const)('allows only governed %s review with explicit non-required consent', setting => {
    const a = haAssessment();
    a.governance!.setting = setting;
    a.governance!.consent = 'not-required';
    expect(evaluateHaEligibility(haInput({ hemoadsorptionAssessment: a })).status).toBe('multidisciplinary-review');
  });

  it('blocks ungoverned review', () => {
    const a = haAssessment();
    a.governance!.setting = undefined;
    expect(evaluateHaEligibility(haInput({ hemoadsorptionAssessment: a })).gates.governance).toBe(false);
  });

  it.each([undefined, 5.99, 12.01, NaN, Infinity])('withholds a trial when the review ceiling is %s hours', reviewAtHours => {
    const a = haAssessment();
    a.governance!.reviewAtHours = reviewAtHours;
    const result = evaluateHaEligibility(haInput({ hemoadsorptionAssessment: a }));
    expect(result.gates.governance).toBe(false);
    expect(result.results.some(r => r.id === 'ha-time-limited-review')).toBe(false);
  });

  it.each([6, 9, 12])('retains an explicitly bounded %s-hour review plan only after gates pass', reviewAtHours => {
    const a = haAssessment();
    a.governance!.reviewAtHours = reviewAtHours;
    const result = evaluateHaEligibility(haInput({ hemoadsorptionAssessment: a }));
    const trial = decision(result.results, 'ha-time-limited-review');
    expect(trial.reassessWithinHours).toBe(2);
    expect(words([trial])).toMatch(/0 h.*NE-equivalent.*lactate.*perfusion.*SOFA/i);
    expect(words([trial])).toContain('2–4 h');
    expect(words([trial])).toContain('6–12 h');
    expect(words([trial])).toContain(`${reviewAtHours} h`);
    expect(words([trial])).toMatch(/stop.*futility/i);
    expect(words(result.results)).toMatch(/Right patient.*Right device.*Right time.*Right dose.*Right stop/i);
  });
});

describe('HA clinical trajectory and biomarker shortcuts', () => {
  it.each([
    ['CRP', { crpMgL: 320 }], ['PCT', { procalcitoninNgMl: 45 }],
    ['ferritin', { ferritinNgMl: 9000 }], ['all nonspecific markers', { crpMgL: 320, procalcitoninNgMl: 45, ferritinNgMl: 9000 }],
  ] as [string, Partial<ClinicalSnapshot>][] )('cannot replace IL-6 with %s', (_name, patch) => {
    const result = evaluateHaEligibility(haInput({ il6PgMl: undefined, ...patch }));
    expect(result.status).toBe('incomplete');
    expect(result.gates.target).toBe(false);
    expect(words(result.results)).toContain('IL-6');
  });

  it.each([undefined, NaN, Infinity, -1])('requires valid quantitative IL-6: %s', il6PgMl => {
    expect(evaluateHaEligibility(haInput({ il6PgMl })).gates.target).toBe(false);
  });

  it('does not accept a single IL-6 result without a serial trajectory', () => {
    const input = haInput();
    input.previousSnapshot.il6PgMl = undefined;
    expect(evaluateHaEligibility(input).gates.target).toBe(false);
  });

  it.each([undefined, 'resolving'] as const)('requires persistent/worsening shock, not %s', shockTrajectory => {
    expect(evaluateHaEligibility(inputWith({ shockTrajectory })).gates.clinical).toBe(false);
  });

  it('requires timestamped same-case measurements, not a trend label', () => {
    expect(evaluateHaEligibility({ snapshot: haSnapshot() }).gates.clinical).toBe(false);
    for (const patch of [{ caseId: 'other-case' }, { timestamp: '2026-09-21T07:00:00Z' }, { timestamp: '2026-09-21T06:00:00Z' }]) {
      const input = haInput();
      Object.assign(input.previousSnapshot, patch);
      expect(evaluateHaEligibility(input).status).not.toBe('multidisciplinary-review');
    }
  });

  it('blocks measured recovery despite a stale worsening label', () => {
    const result = evaluateHaEligibility(haInput({ norepinephrineEquivalentMcgKgMin: 0.01, lactateMmolL: 1, sofaScore: 5 }));
    expect(result.gates.clinical).toBe(false);
  });

  it('retains persistent shock with compatible repeated hyperinflammation', () => {
    const input = inputWith({ shockTrajectory: 'persistent' });
    input.snapshot.norepinephrineEquivalentMcgKgMin = 0.2;
    input.snapshot.lactateMmolL = 3.5;
    input.snapshot.sofaScore = 11;
    input.snapshot.il6PgMl = 1200;
    expect(evaluateHaEligibility(input).status).toBe('multidisciplinary-review');
  });

  it.each([undefined, 'inadequate'] as const)('blocks missing/failed source-control assessment: %s', sourceControlStatus => {
    expect(evaluateHaEligibility(haInput({ sourceControlStatus })).gates.clinical).toBe(false);
  });

  it.each(['platelets10e9L', 'fibrinogenGL', 'albuminGL', 'mapMmHg', 'norepinephrineEquivalentMcgKgMin', 'lactateMmolL', 'capillaryRefillSeconds', 'sofaScore', 'urineVolumeMl', 'urineObservationHours', 'firstAntimicrobialTimestamp'] as const)(
    'does not invent missing baseline measurement %s', field => {
      expect(evaluateHaEligibility(haInput({ [field]: undefined })).status).toBe('incomplete');
    });

  for (const field of ['immunoparalysis', 'lowHlaDr'] as const) {
    it.each([undefined, true])(`withholds broad adsorption when ${field} is %s`, value => {
      const result = evaluateHaEligibility(inputWith({ [field]: value }));
      expect(result.gates.target).toBe(false);
      expect(result.status).toBe(value === undefined ? 'incomplete' : 'not-eligible');
    });
  }
});

describe('device-specific trait matching and evidence isolation', () => {
  const pmx = (eaa: number | undefined = 0.7, modsScore = 10) => haInput({
    hemoadsorptionAssessment: haAssessment({ requestedDevice: 'polymyxin-B', targetAdsorbate: 'endotoxin' }),
    endotoxinActivityAssay: eaa, modsScore,
  });

  it.each([[0.599, false], [0.6, true], [0.89, true], [0.8901, false], [0.9, false], [1, false], [-1, false], [NaN, false], [Infinity, false]] as const)(
    'confines PMX EAA %s to verified exploratory range (review %s)', (eaa, eligible) => {
      const result = evaluateHaEligibility(pmx(eaa));
      expect(result.status === 'multidisciplinary-review').toBe(eligible);
      expect(result.gates.target).toBe(eligible);
    });

  it.each([9, 9.99, 10])('requires exploratory MODS >9 as an integer: %s', modsScore => {
    expect(evaluateHaEligibility(pmx(0.7, modsScore)).status === 'multidisciplinary-review').toBe(modsScore === 10);
  });

  it.each([[24, true], [25, false], [999, false]] as const)('defends PMX review against out-of-domain direct MODS %s', (modsScore, eligible) => {
    const input = pmx(0.7, modsScore);
    const result = evaluateHaEligibility(input);
    expect(result.status === 'multidisciplinary-review').toBe(eligible);
    expect(result.gates.target).toBe(eligible);
    if (!eligible) {
      expect(result.status).toBe('incomplete');
      expect(words(result.results)).toMatch(/MODS.*0.?24/i);
      expect(matchHaDevice(input).some(r => r.conclusion.includes('phenotype match'))).toBe(false);
    }
  });

  it('does not substitute suspected gram-negative infection or cytokines for EAA', () => {
    const input = pmx();
    input.snapshot.endotoxinActivityAssay = undefined;
    input.snapshot.hemoadsorptionAssessment!.suspectedGramNegativeInfection = true;
    expect(evaluateHaEligibility(input).status).toBe('incomplete');
    expect(words(evaluateHaEligibility(input).results)).toMatch(/EAA.*Gram-negative/i);
    expect(matchHaDevice(input).some(r => r.conclusion.includes('phenotype match'))).toBe(false);
  });

  it('does not convert post-hoc PMX review into TIGRIS or efficacy support', () => {
    const results = matchHaDevice(pmx());
    const match = decision(results, 'pmx-exploratory-enrichment');
    expect(match.sourceIds).toContain('EUPHRATES_POSTHOC_2018');
    expect(words(results)).toMatch(/post.hoc/i);
    expect(words(results)).toMatch(/exploratory/i);
    expect(results.flatMap(r => r.sourceIds)).not.toContain('TIGRIS_2026');
    expect(evidenceSources.TIGRIS_2026.supportedClaims).toEqual([]);
    expect(() => resolveRuleSources('pmx-exploratory-enrichment', ['TIGRIS_2026'])).toThrow(/Unverified/);
    expect(words(results)).toMatch(/SSC 2026.*conditional.*against/i);
  });

  it.each(['CytoSorb', 'HA330', 'HA380', 'oXiris'] as HaDevice[])('never lends PMX evidence to %s', device => {
    const input = inputWith({ requestedDevice: device });
    if (device === 'oXiris') {
      input.snapshot.potassiumMmolL = 6.5;
      input.snapshot.refractoryHyperkalemia = true;
    }
    const results = matchHaDevice(input);
    expect(results.some(r => r.conclusion.includes(`${device} phenotype match`))).toBe(true);
    expect(results.flatMap(r => r.sourceIds)).not.toContain('EUPHRATES_POSTHOC_2018');
    expect(() => resolveRuleSources('ha-device-match', ['EUPHRATES_POSTHOC_2018'])).toThrow(/does not support/);
  });

  it.each([{}, { crrtMode: 'CVVHDF' }, { crpMgL: 500, creatinineMgDl: 8, bunMgDl: 150 }, { potassiumMmolL: 6.5 } ] as Partial<ClinicalSnapshot>[])(
    'oXiris cannot manufacture a CRRT indication from %j', patch => {
      const input = haInput({ ...patch, hemoadsorptionAssessment: haAssessment({ requestedDevice: 'oXiris' }) });
      expect(evaluateHaEligibility(input).gates.target).toBe(false);
      expect(words(evaluateHaEligibility(input).results)).toContain('independent CRRT indication');
    });

  it('oXiris endotoxin phenotype does not inherit the PMX EAA range', () => {
    const input = haInput({
      hemoadsorptionAssessment: haAssessment({ requestedDevice: 'oXiris', targetAdsorbate: 'endotoxin', endotoxinPhenotype: true }),
      endotoxinActivityAssay: 0.95, potassiumMmolL: 6.5, refractoryHyperkalemia: true,
    });
    expect(evaluateHaEligibility(input).gates.target).toBe(true);
    expect(words(matchHaDevice(input))).not.toMatch(/0\.60|0\.89|EUPHRATES/);
    input.snapshot.endotoxinActivityAssay = undefined;
    expect(evaluateHaEligibility(input).gates.target).toBe(false);
  });

  for (const field of ['immunoparalysis', 'lowHlaDr'] as const) {
    it.each([undefined, true])(`oXiris cannot bypass broad-device immune safety by selecting endotoxin: ${field} %s`, value => {
      const input = haInput({
        hemoadsorptionAssessment: haAssessment({ requestedDevice: 'oXiris', targetAdsorbate: 'endotoxin', endotoxinPhenotype: true, [field]: value }),
        potassiumMmolL: 6.5, refractoryHyperkalemia: true,
      });
      expect(evaluateHaEligibility(input).gates.target).toBe(false);
      expect(matchHaDevice(input).some(r => r.id === 'ha-device-match')).toBe(false);
    });
  }

  it.each([
    { requestedDevice: undefined }, { requestedDevice: 'other' }, { targetAdsorbate: undefined },
    { requestedDevice: 'polymyxin-B', targetAdsorbate: 'cytokines' },
    { requestedDevice: 'CytoSorb', targetAdsorbate: 'endotoxin' },
  ] as Partial<HemoadsorptionAssessment>[])('fails closed on unknown or mismatched target/device %j', patch => {
    expect(evaluateHaEligibility(inputWith(patch)).gates.target).toBe(false);
  });
});

describe('time-limited response, futility and adverse events', () => {
  const deviceTargets = [
    ['CytoSorb', 'cytokines', ['hyperinflammatoryPhenotype']],
    ['HA330', 'cytokines', ['hyperinflammatoryPhenotype']],
    ['HA380', 'cytokines', ['hyperinflammatoryPhenotype']],
    ['oXiris', 'cytokines', ['hyperinflammatoryPhenotype']],
    ['oXiris', 'endotoxin', ['endotoxinPhenotype']],
    ['oXiris', 'cytokines-and-endotoxin', ['hyperinflammatoryPhenotype', 'endotoxinPhenotype']],
    ['polymyxin-B', 'endotoxin', ['endotoxinPhenotype']],
  ] as const;

  function deviceResponse(device: HaDevice, targetAdsorbate: HemoadsorptionAssessment['targetAdsorbate']) {
    const hyperinflammatoryPhenotype = targetAdsorbate !== 'endotoxin';
    const endotoxinPhenotype = targetAdsorbate !== 'cytokines';
    const response = haResponseInput({ timestamp: '2026-09-21T10:00:00Z', hoursFromSepsisOnset: 10,
      endotoxinActivityAssay: 0.5,
      hemoadsorptionAssessment: haAssessment({ requestedDevice: device, targetAdsorbate, hyperinflammatoryPhenotype, endotoxinPhenotype }),
    });
    response.baseline.snapshot.hemoadsorptionAssessment = haAssessment({ requestedDevice: device, targetAdsorbate, hyperinflammatoryPhenotype, endotoxinPhenotype });
    if (device === 'oXiris') {
      response.baseline.snapshot.potassiumMmolL = 6.5;
      response.baseline.snapshot.refractoryHyperkalemia = true;
    }
    response.snapshot.hemoadsorptionExposures![0].device = device;
    response.snapshot.hemoadsorptionExposures![0].targetAdsorbate = targetAdsorbate;
    return response;
  }

  for (const [device, target, fields] of deviceTargets) {
    for (const field of fields) {
      it.each([false, undefined, true])(`${device}/${target} requires current ${field} confirmation: %s`, value => {
        const response = deviceResponse(device, target);
        response.snapshot.hemoadsorptionAssessment![field] = value;
        response.snapshot = clinicalSnapshotSchema.parse(response.snapshot);
        expect(evaluateHaEligibility(response.baseline).status).toBe('multidisciplinary-review');
        const result = decision(evaluateHaResponse(response), 'ha-response-review');
        expect(result.reassessWithinHours).toBe(value === true ? 2 : 0);
        if (value === false) {
          expect(result.severity).toBe('critical');
          expect(result.conclusion).toMatch(/stop.*reassess/i);
          expect(result.evidence.join(' ')).toContain(field);
        } else if (value === undefined) {
          expect(result.severity).toBe('warning');
          expect(result.conclusion).toMatch(/incomplete/i);
          expect(result.missingData.join(' ')).toContain(field);
        } else {
          // Falling IL-6/EAA is compatible with response; no renewed rising-marker prerequisite.
          expect(result.missingData).toEqual([]);
          expect(result.conclusion).toMatch(/Serial review pending/i);
        }
      });
    }

    it.each([false, undefined, true])(`${device}/${target} requires current target presence: %s`, targetStillPresent => {
      const response = deviceResponse(device, target);
      response.snapshot.hemoadsorptionAssessment!.targetStillPresent = targetStillPresent;
      response.snapshot = clinicalSnapshotSchema.parse(response.snapshot);
      const result = decision(evaluateHaResponse(response), 'ha-response-review');
      expect(result.reassessWithinHours).toBe(targetStillPresent === true ? 2 : 0);
      if (targetStillPresent === false) expect(result.conclusion).toMatch(/stop.*reassess/i);
      else if (targetStillPresent === undefined) {
        expect(result.conclusion).toMatch(/incomplete/i);
        expect(result.missingData.join(' ')).toContain('targetStillPresent');
      } else expect(result.missingData).toEqual([]);
    });

    it(`${device}/${target} rechecks the actual active exposure against the current device/target`, () => {
      const response = deviceResponse(device, target);
      // Isolate compatibility from a simultaneous explicitly absent alternate phenotype.
      response.snapshot.hemoadsorptionAssessment!.hyperinflammatoryPhenotype = true;
      response.snapshot.hemoadsorptionAssessment!.endotoxinPhenotype = true;
      response.snapshot.hemoadsorptionExposures![0].targetAdsorbate = target === 'cytokines' ? 'endotoxin' : 'cytokines';
      response.snapshot = clinicalSnapshotSchema.parse(response.snapshot);
      const result = decision(evaluateHaResponse(response), 'ha-response-review');
      expect(result.conclusion).toMatch(/incomplete/i);
      expect(result.missingData.length).toBeGreaterThan(0);
      expect(result.reassessWithinHours).toBe(0);
    });
  }

  it('does not treat an improved trajectory as proof of HA benefit or automatic continuation', () => {
    const result = decision(evaluateHaResponse(haResponseInput()), 'ha-response-review');
    expect(result.severity).toBe('warning');
    expect(words([result])).toMatch(/review due.*no automatic continuation/i);
    expect(words([result])).toMatch(/attribution.*not established/i);
  });

  it.each([
    ['no NE improvement', { norepinephrineEquivalentMcgKgMin: 0.3 }],
    ['rising NE', { norepinephrineEquivalentMcgKgMin: 0.4 }],
    ['lactate nonresponse', { lactateMmolL: 4 }],
    ['perfusion nonresponse', { capillaryRefillSeconds: 4 }],
    ['SOFA nonresponse', { sofaScore: 12 }],
    ['worsening SOFA', { sofaScore: 13 }],
    ['target nonresponse', { il6PgMl: 1800 }],
    ['uncontrolled source', { sourceControlStatus: 'inadequate' }],
  ] as [string, Partial<ClinicalSnapshot>][] )('raises stop/futility review for %s', (_name, patch) => {
    const result = decision(evaluateHaResponse(haResponseInput(patch)), 'ha-response-review');
    expect(result.severity).toBe('critical');
    expect(result.conclusion).toMatch(/stop.*reassess/i);
    expect(result.reassessWithinHours).toBe(0);
  });

  it.each([5.99, 6, 12, 12.01])('bounds nonresponse review at elapsed %s hours', elapsed => {
    const response = haResponseInput({ norepinephrineEquivalentMcgKgMin: 0.3 });
    response.snapshot.timestamp = new Date(Date.parse('2026-09-21T06:00:00Z') + elapsed * 3_600_000).toISOString();
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.conclusion.includes('stop')).toBe(elapsed >= 6);
    expect(result.reassessWithinHours).toBeLessThanOrEqual(elapsed < 6 ? 0.01 + 1e-9 : 0);
  });

  it.each(['bleeding', 'thrombocytopenia', 'drug-underexposure', 'albumin-loss', 'circuit-clotting'] as const)(
    'does not wait for the review window after severe %s', kind => {
      const response = haResponseInput({ timestamp: '2026-09-21T07:00:00Z' });
      response.snapshot.hemoadsorptionExposures![0].adverseEvents = [{ timestamp: '2026-09-21T06:30:00Z', kind, severity: 'severe' }];
      const result = decision(evaluateHaResponse(response), 'ha-response-review');
      expect(result.conclusion).toMatch(/stop.*reassess/i);
      expect(result.reassessWithinHours).toBe(0);
    });

  it('treats recurrent circuit clotting as a stop trigger without a severe label', () => {
    const response = haResponseInput();
    response.snapshot.hemoadsorptionExposures![0].adverseEvents = [
      { timestamp: '2026-09-21T07:00:00Z', kind: 'circuit-clotting', severity: 'moderate' },
      { timestamp: '2026-09-21T09:00:00Z', kind: 'circuit-clotting', severity: 'moderate' },
    ];
    expect(decision(evaluateHaResponse(response), 'ha-response-review').severity).toBe('critical');
  });

  it.each([
    { immunoparalysis: true }, { lowHlaDr: true }, { targetStillPresent: false },
    { safety: { irreversibleOrganFailure: true } }, { safety: { goalsCompatible: false } },
    { safety: { albuminAcceptable: false } }, { safety: { coagulationAcceptable: false } },
    { safety: { plateletsAcceptable: false } }, { safety: { drugRemovalPlan: false } },
  ] as Partial<HemoadsorptionAssessment>[])('surfaces current veto despite pre-treatment gate clearance: %j', patch => {
    const response = haResponseInput({ hemoadsorptionAssessment: haAssessment(patch) });
    expect(decision(evaluateHaResponse(response), 'ha-response-review').severity).toBe('critical');
  });

  it.each(['norepinephrineEquivalentMcgKgMin', 'lactateMmolL', 'capillaryRefillSeconds', 'sofaScore', 'il6PgMl', 'platelets10e9L', 'albuminGL'] as const)(
    'does not infer response with missing serial %s', field => {
      const result = decision(evaluateHaResponse(haResponseInput({ [field]: undefined })), 'ha-response-review');
      expect(result.severity).toBe('warning');
      expect(result.missingData.length).toBeGreaterThan(0);
      expect(words([result])).not.toMatch(/improved trajectory/i);
      expect(result.reassessWithinHours).toBe(0);
    });

  it('cannot bypass original gates to obtain a response trial plan', () => {
    const response = haResponseInput();
    response.baseline.snapshot.hemoadsorptionAssessment!.governance!.stopPlan = false;
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.conclusion).toMatch(/incomplete|not cleared/i);
    expect(result.reassessWithinHours).toBe(0);
  });

  for (const field of ['criticalCareApproved', 'nephrologyApproved', 'infectiousDiseasesApproved', 'pharmacistExposurePlan', 'monitoringPlan', 'stopPlan', 'deviceProtocolReviewed'] as const) {
    it.each([undefined, false])(`reassesses revoked or missing current governance: ${field} %s`, value => {
      const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
      response.snapshot.hemoadsorptionAssessment!.governance![field] = value;
      const result = decision(evaluateHaResponse(response), 'ha-response-review');
      expect(result.reassessWithinHours).toBe(0);
      expect(result.severity).toBe(value === false ? 'critical' : 'warning');
      if (value === undefined) expect(result.missingData.length).toBeGreaterThan(0);
    });
  }

  it.each(['declined', 'pending', undefined] as const)('cannot retain a review interval after consent becomes %s', consent => {
    const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
    response.snapshot.hemoadsorptionAssessment!.governance!.consent = consent;
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.reassessWithinHours).toBe(0);
    expect(result.severity).toBe(consent === 'declined' ? 'critical' : 'warning');
  });

  it.each(['immunoparalysis', 'lowHlaDr'] as const)('requires current broad-device immune reassessment: %s', field => {
    const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
    response.snapshot.hemoadsorptionAssessment![field] = undefined;
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.reassessWithinHours).toBe(0);
    expect(result.missingData.length).toBeGreaterThan(0);
  });

  it('does not interpret an unreviewed device/target change as the original trial', () => {
    const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
    response.snapshot.hemoadsorptionAssessment!.requestedDevice = 'polymyxin-B';
    response.snapshot.hemoadsorptionAssessment!.targetAdsorbate = 'endotoxin';
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.reassessWithinHours).toBe(0);
  });

  it.each(['fibrinogenGL', 'urineVolumeMl', 'urineObservationHours'] as const)('requires serial monitoring of %s', field => {
    const response = haResponseInput({ [field]: undefined, timestamp: '2026-09-21T11:00:00Z' });
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.reassessWithinHours).toBe(0);
  });

  for (const field of ['hepaticRenalReviewed', 'electrolytesReviewed', 'vascularAccessReviewed', 'anticoagulationReviewed'] as const) {
    it.each([undefined, false])(`requires renewed current safety assessment: ${field} %s`, value => {
      const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
      response.snapshot.hemoadsorptionAssessment!.safety![field] = value;
      const result = decision(evaluateHaResponse(response), 'ha-response-review');
      expect(result.reassessWithinHours).toBe(0);
      expect(result.severity).toBe(value === false ? 'critical' : 'warning');
    });
  }

  it.each(['uncontrolledBleeding', 'irreversibleOrganFailure'] as const)('does not assume a current negative veto assessment for %s', field => {
    const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
    response.snapshot.hemoadsorptionAssessment!.safety![field] = undefined;
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.reassessWithinHours).toBe(0);
  });

  it('requires the ongoing governance setting to remain documented', () => {
    const response = haResponseInput({ timestamp: '2026-09-21T11:00:00Z' });
    response.snapshot.hemoadsorptionAssessment!.governance!.setting = undefined;
    const result = decision(evaluateHaResponse(response), 'ha-response-review');
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.reassessWithinHours).toBe(0);
  });

  it.each([{ caseId: 'different' }, { timestamp: '2026-09-21T05:00:00Z' }, { hemoadsorptionExposures: undefined } ] as Partial<ClinicalSnapshot>[])(
    'rejects cross-case, reversed or undocumented exposure %j', patch => {
      const result = decision(evaluateHaResponse(haResponseInput(patch)), 'ha-response-review');
      expect(result.missingData.length).toBeGreaterThan(0);
      expect(result.reassessWithinHours).toBe(0);
    });

  it('labels shock reversal only as an unvalidated reference, never an automatic stop endpoint', () => {
    const result = decision(evaluateHaResponse(haResponseInput({ norepinephrineEquivalentMcgKgMin: 0.04, lactateMmolL: 1.9 })), 'ha-response-review');
    expect(words([result])).toMatch(/shock reversal reference.*not.*validated.*HA/i);
    expect(result.conclusion).not.toMatch(/stop/);
  });
});

describe('drug protection and review-only output contract', () => {
  it('preserves drug and cartridge timing and prompts individualized exposure review without calculations', () => {
    const results = evaluateHaResponse(haResponseInput());
    const drugs = decision(results, 'ha-drug-exposure-review');
    const text = words([drugs]);
    expect(text).toMatch(/full loading dose.*without delay or reduction/i);
    expect(text).toMatch(/vancomycin.*AUC.*TDM/i);
    expect(text).toMatch(/linezolid.*azole.*beta-lactam.*TDM/i);
    expect(text).toMatch(/extended.infusion/i);
    for (const time of ['2026-09-21T06:00:00Z', '2026-09-21T07:00:00Z', '2026-09-21T10:00:00Z']) expect(text).toContain(time);
    expect(text).toMatch(/MIC.*residual renal.*CRRT.*device/i);
    expect(text).not.toMatch(/1500|\d+\s*mg\b|supplement.*\d/i);
  });

  it('all active decisions have rule-scoped verified support, including blockers', () => {
    const results = [
      ...evaluateHaEligibility(haInput()).results,
      ...evaluateHaEligibility(inputWith({ standardCare: undefined })).results,
      ...matchHaDevice(haInput()), ...evaluateHaResponse(haResponseInput()),
    ];
    expect(results.length).toBeGreaterThan(8);
    for (const result of results) {
      expect(resolveRuleSources(result.id, result.sourceIds).length).toBeGreaterThan(0);
      expect(result.sourceIds).not.toContain('TIGRIS_2026');
    }
  });

  it('never emits treatment imperative, fixed-dose or universal HA dose/timing language', () => {
    const matrices = [haInput(), inputWith({ requestedDevice: 'HA330' }), inputWith({ requestedDevice: 'HA380' }),
      inputWith({ requestedDevice: 'polymyxin-B', targetAdsorbate: 'endotoxin' }),
      inputWith({ requestedDevice: 'oXiris' }), inputWith({ immunoparalysis: true })];
    const results = matrices.flatMap(input => [...evaluateHaEligibility(input).results, ...matchHaDevice(input)]);
    results.push(...evaluateHaResponse(haResponseInput()), ...evaluateHaResponse(haResponseInput({ lactateMmolL: 8 })));
    expect(words(results)).not.toMatch(/\b(recommend(?:ed|ation|ations)?|start(?:ed|ing)?|order(?:ed|s)?|fixed-dose)\b|13\s*L\/kg|8[–-]12\s*h|12[–-]24\s*h/i);
  });
});

expectTypeOf<HaEligibility>().toEqualTypeOf<'not-eligible' | 'incomplete' | 'multidisciplinary-review'>();
