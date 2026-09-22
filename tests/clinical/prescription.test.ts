import { calculatePrescription, evaluatePrescriptionSafety, type PrescriptionInput } from '../../src/clinical/prescription';
import { resolveRuleSources } from '../../src/clinical/sources';

const input = (patch: Partial<PrescriptionInput> = {}): PrescriptionInput => ({
  adultConfirmed: true, actualWeightKg: 80, weightBasis: 'actual', weightBasisReason: 'Clinician selected current measured weight',
  deliveredTargetMlKgHr: 25, downtimeFraction: 0.2, mode: 'CVVHDF', bloodFlowMlMin: 200,
  hematocritFraction: 0.3, dialysateMlHr: 1000, preReplacementMlHr: 0, postReplacementMlHr: 1000, preBloodPumpMlHr: 0,
  requestedUfNetMlHr: 100, pressorTrend: 'stable', perfusionAdequate: true,
  anticoagulation: 'regional-citrate', citrateContraindication: false, citrateProtocolAvailable: true,
  bleedingRiskReviewed: true, systemicAnticoagulationReviewed: true, ...patch,
});

describe('adult CRRT prescription arithmetic (independent literal fixtures)', () => {
  it.each([[20, 0, 20, 1600], [25, 0, 25, 2000], [25, 0.2, 31.3, 2500], [20, 0.25, 26.7, 2133]] as const)(
    'compensates target %s for downtime %s without confusing hourly dose and volume', (target, downtime, dose, volume) => {
      const result = calculatePrescription(input({ deliveredTargetMlKgHr: target, downtimeFraction: downtime }));
      expect(result.prescribedEffluentMlKgHr).toBe(dose);
      expect(result.totalEffluentMlHr).toBe(volume);
      expect(result.deliveredTargetMlKgHr).toBe(target);
    });

  it.each([19.9, 25.1, 0, -20, NaN, Infinity])('rejects unsupported routine adult target %s', target => {
    const result = calculatePrescription(input({ deliveredTargetMlKgHr: target }));
    expect(result.totalEffluentMlHr).toBeUndefined();
    expect(result.missingData.join(' ')).toContain('20–25');
  });

  it.each([undefined, -0.1, 0.5, 0.99, 1, 1.1, Infinity, NaN])('fails closed on unknown or extreme downtime %s', downtimeFraction => {
    const result = calculatePrescription(input({ downtimeFraction }));
    expect(result.prescribedEffluentMlKgHr).toBeUndefined();
    expect(result.missingData.join(' ')).toContain('downtime');
  });

  it.each([undefined, 0, -1, NaN, Infinity])('rejects unknown/invalid selected weight %s', actualWeightKg => {
    const result = calculatePrescription(input({ actualWeightKg }));
    expect(result.weightKg).toBeUndefined();
    expect(result.totalEffluentMlHr).toBeUndefined();
    expect(result.missingData.length).toBeGreaterThan(0);
  });

  it.each([['actual', 120, 3000], ['ideal', 70, 1750], ['adjusted', 90, 2250]] as const)(
    'respects explicitly selected %s weight in obesity', (weightBasis, weight, volume) => {
      const result = calculatePrescription(input({ actualWeightKg: 120, idealWeightKg: 70, weightBasis, downtimeFraction: 0 }));
      expect(result.weightKg).toBe(weight);
      expect(result.weightBasis).toBe(weightBasis);
      expect(result.weightBasisReason).toBe('Clinician selected current measured weight');
      expect(result.totalEffluentMlHr).toBe(volume);
    });

  it('uses existing ideal-weight helper only after explicit selection', () => {
    expect(calculatePrescription(input({ weightBasis: 'ideal', heightCm: 177.8, sex: 'male' })).weightKg).toBe(73);
  });

  it.each([{ weightBasis: undefined }, { weightBasisReason: '' }, { adultConfirmed: undefined }] as Partial<PrescriptionInput>[])(
    'does not infer adult eligibility or weight basis from high BMI: %j', patch => {
      const result = calculatePrescription(input({ actualWeightKg: 150, heightCm: 160, ...patch }));
      expect(result.totalEffluentMlHr).toBeUndefined();
      expect(result.missingData.length).toBeGreaterThan(0);
    });

  it.each([
    ['CVVHD', 2000, 0, 0, 100, 2100, 100, 1.2],
    ['CVVH', 0, 0, 2000, 100, 2100, 2100, 25],
    ['CVVHDF', 1000, 0, 1000, 100, 2100, 1100, 13.1],
    ['CVVH', 0, 1000, 1000, 100, 2100, 2100, 22.3],
  ] as const)('accounts for %s Qd %s / Qpre %s / Qpost %s / UFNET %s', (mode, dialysateMlHr, preReplacementMlHr, postReplacementMlHr, requestedUfNetMlHr, effluent, uf, ff) => {
    const result = calculatePrescription(input({ mode, dialysateMlHr, preReplacementMlHr, postReplacementMlHr, requestedUfNetMlHr }));
    expect(result.configuredEffluentMlHr).toBe(effluent);
    expect(result.totalUltrafiltrationMlHr).toBe(uf);
    expect(result.plasmaFlowMlHr).toBe(8400);
    expect(result.filtrationFractionPct).toBe(ff);
  });

  it('pre-dilution reduces estimated small-solute delivery and increases nominal compensation', () => {
    const result = calculatePrescription(input({ mode: 'CVVH', dialysateMlHr: 0, preReplacementMlHr: 1000 }));
    // Qp=8400; dilution=8400/9400; Qeff=2100; uptime=.8; W=80.
    expect(result.predilutionFactor).toBeCloseTo(0.893617, 6);
    expect(result.estimatedDeliveredMlKgHr).toBe(18.8);
    expect(result.prescribedEffluentMlKgHr).toBe(35);
    expect(result.totalEffluentMlHr).toBe(2798);
  });

  it('post-dilution has no dilution loss and reports configured vs target separately', () => {
    const result = calculatePrescription(input());
    expect(result.predilutionFactor).toBe(1);
    expect(result.estimatedDeliveredMlKgHr).toBe(21);
    expect(result.configuredEffluentMlHr).toBe(2100);
    expect(result.totalEffluentMlHr).toBe(2500);
  });

  it.each([
    [20, 2000, 80, 0], // Qb 1200 mL/h, Qp 840: configured clearance 2000 is impossible.
    [50, 2101, 84, 0], // Qp 2100: configured clearance just exceeds conservative plasma-model ceiling.
    [50, 2000, 84, 0.2], // Configured 2000 is in domain, but target runtime clearance is 2625 > Qp 2100.
  ])('withholds clearance/target and completion outside the model domain: Qb %s, Qd %s, W %s, downtime %s',
    (bloodFlowMlMin, dialysateMlHr, actualWeightKg, downtimeFraction) => {
      const unsafe = input({ mode: 'CVVHD', bloodFlowMlMin, dialysateMlHr, actualWeightKg, downtimeFraction,
        preReplacementMlHr: 0, postReplacementMlHr: 0, preBloodPumpMlHr: 0, requestedUfNetMlHr: 0,
        device: 'PrisMax', confirmations: { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true },
      });
      const result = calculatePrescription(unsafe);
      expect(result.estimatedDeliveredMlKgHr).toBeUndefined();
      expect(result.prescribedEffluentMlKgHr).toBeUndefined();
      expect(result.totalEffluentMlHr).toBeUndefined();
      expect(result.checklistComplete).toBe(false);
      expect(result.missingData.join(' ')).toMatch(/saturation.*model.domain/i);
      expect(result.missingData.join(' ')).toContain('Qb');
      expect(result.missingData.join(' ')).toContain('unit');
      const dose = evaluatePrescriptionSafety(unsafe).find(decision => decision.id === 'crrt-delivered-dose')!;
      expect(dose.severity).toBe('warning');
      expect(dose.missingData.join(' ')).toMatch(/model.domain/i);
    });

  it.each([
    [2000, 0, 'CVVHD', 2000, 23.8],
    [2100, 0, 'CVVHD', 2100, 25],
    [2100, 200, 'CVVHDF', 2300, 25],
  ] as const)('keeps an in-domain estimate at Qd %s / pre %s, including the plasma-model ceiling',
    (dialysateMlHr, preReplacementMlHr, mode, effluent, delivered) => {
      // Qp 2100. With pre200, effluent2300 > native plasma2100, but corrected clearance=2100.
      const result = calculatePrescription(input({ mode, bloodFlowMlMin: 50, actualWeightKg: 84, downtimeFraction: 0,
        dialysateMlHr, preReplacementMlHr, postReplacementMlHr: 0, preBloodPumpMlHr: 0, requestedUfNetMlHr: 0,
      }));
      expect(result.plasmaFlowMlHr).toBe(2100);
      expect(result.configuredEffluentMlHr).toBe(effluent);
      expect(result.estimatedDeliveredMlKgHr).toBe(delivered);
      expect(result.missingData).toEqual([]);
    });

  it('includes separate citrate/PBP fluid in CVVHD filtration and dilution without calling it replacement modality', () => {
    const result = calculatePrescription(input({ mode: 'CVVHD', dialysateMlHr: 2000, postReplacementMlHr: 0, preBloodPumpMlHr: 600 }));
    // Patient Qb 200 -> Qp 8400; PBP 600 -> denominator 9000; UF 700; effluent 2700.
    expect(result.filtrationFractionPct).toBe(7.8);
    expect(result.totalUltrafiltrationMlHr).toBe(700);
    expect(result.configuredEffluentMlHr).toBe(2700);
    expect(result.estimatedDeliveredMlKgHr).toBe(25.2);
    expect(result.totalEffluentMlHr).toBe(2679);
  });

  it.each([undefined, -1, NaN, Infinity])('requires explicit PBP/citrate flow accounting, including measured zero: %s', preBloodPumpMlHr => {
    const result = calculatePrescription(input({ preBloodPumpMlHr }));
    expect(result.totalEffluentMlHr).toBeUndefined();
    expect(result.missingData.join(' ')).toContain('PBP');
  });

  it.each([
    { mode: 'CVVHD', preReplacementMlHr: 1 }, { mode: 'CVVH', dialysateMlHr: 1 },
    { mode: 'CVVHDF', dialysateMlHr: 0 }, { mode: 'CVVHDF', postReplacementMlHr: 0 },
    { mode: 'SCUF' }, { mode: undefined }, { dialysateMlHr: undefined }, { preReplacementMlHr: -1 },
    { postReplacementMlHr: NaN }, { bloodFlowMlMin: 0 }, { bloodFlowMlMin: Infinity },
    { hematocritFraction: undefined }, { hematocritFraction: 1 }, { hematocritFraction: -0.1 },
    { hematocritFraction: 30 }, { requestedUfNetMlHr: -1 },
  ] as Partial<PrescriptionInput>[])('blocks invalid or inconsistent flow assumptions %j', patch => {
    const result = calculatePrescription(input(patch));
    expect(result.totalEffluentMlHr).toBeUndefined();
    expect(result.filtrationFractionPct).toBeUndefined();
    expect(result.missingData.length).toBeGreaterThan(0);
  });

  it('does not use whole blood as the filtration-fraction denominator', () => {
    const result = calculatePrescription(input({ mode: 'CVVH', dialysateMlHr: 0, postReplacementMlHr: 2000, hematocritFraction: 0.5 }));
    expect(result.plasmaFlowMlHr).toBe(6000);
    expect(result.filtrationFractionPct).toBe(35);
    expect(result.warnings.join(' ')).toContain('filtration fraction');
  });

  it.each([{ bloodFlowMlMin: Number.MAX_VALUE }, { postReplacementMlHr: Number.MAX_VALUE }, { actualWeightKg: Number.MIN_VALUE }])(
    'never emits NaN/Infinity or unsafe extreme calculated values: %j', patch => {
      const result = calculatePrescription(input(patch));
      expect(result.totalEffluentMlHr).toBeUndefined();
      expect(result.missingData.length).toBeGreaterThan(0);
      Object.values(result).filter(value => typeof value === 'number').forEach(value => expect(Number.isFinite(value)).toBe(true));
    });
});

describe('prescription safety and review-only operational defaults', () => {
  it('sets UFNET to zero when pressors are escalating and recomputes effluent', () => {
    const result = calculatePrescription(input({ pressorTrend: 'rising', requestedUfNetMlHr: 150 }));
    expect(result.ufNetMlHr).toBe(0);
    expect(result.configuredEffluentMlHr).toBe(2000);
    expect(result.warnings).toContain('升壓劑增加：先暫停淨脫水並重新評估灌流');
    expect(result.checklistComplete).toBe(false);
  });

  it.each([{ pressorTrend: undefined }, { perfusionAdequate: undefined }, { perfusionAdequate: false }])('never approves requested removal with unknown/poor perfusion %j', patch => {
    expect(calculatePrescription(input(patch)).ufNetMlHr).toBe(0);
  });

  it('fails closed when measured perfusion evidence conflicts with a positive clinician label', () => {
    const conflict = input({
      requestedUfNetMlHr: 150,
      device: 'PrisMax',
      confirmations: { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true },
      perfusionConflictReasons: ['MAP 40 mmHg conflicts with perfusion adequate', 'NE-equivalent 0.1 → 0.4 mcg/kg/min conflicts with stable trend'],
    });

    const prescription = calculatePrescription(conflict);
    expect(prescription.ufNetMlHr).toBe(0);
    expect(prescription.checklistComplete).toBe(false);
    expect(prescription.warnings.join(' ')).toContain('量測與人工標記衝突');
    expect(prescription.missingData.join(' ')).toContain('Resolve measured perfusion');

    const decision = evaluatePrescriptionSafety(conflict).find(item => item.id === 'crrt-prescription-safety')!;
    expect(decision.reassessWithinHours).toBe(0.25);
    expect(decision.actions.join(' ')).toContain('立即重新評估');
    expect(decision.evidence.join(' ')).toContain('0.1 → 0.4');
  });

  it('exposes calculated prescription outputs and editable device defaults in the review card payload', () => {
    const confirmations = { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true };
    const decision = evaluatePrescriptionSafety(input({ device: 'PrisMax', confirmations })).find(item => item.id === 'crrt-prescription-safety')!;
    const text = decision.evidence.join(' ');

    expect(text).toContain('處方目標總 effluent：2500 mL/h');
    expect(text).toContain('目前設定 effluent：2100 mL/h');
    expect(text).toContain('Filtration fraction：13.1%');
    expect(text).toContain('安全調整後 UFNET：100 mL/h');
    expect(text).toContain('處方安全 checklist：complete');
    expect(text).toContain('PrisMax');
    expect(text).toContain('150 mL/min');
    expect(text).toContain('可編輯');
    expect(text).toContain('非機器醫囑');
  });

  it('reports unknowns instead of manufacturing a prescription from an empty form', () => {
    const result = calculatePrescription({});
    expect(result.totalEffluentMlHr).toBeUndefined();
    expect(result.missingData.length).toBeGreaterThan(5);
    expect(evaluatePrescriptionSafety({}).some(decision => decision.missingData.length > 0)).toBe(true);
  });

  it('offers conditional RCA review without making an anticoagulation order', () => {
    const decision = evaluatePrescriptionSafety(input()).find(item => item.id === 'crrt-anticoagulation')!;
    expect(decision.conclusion).toContain('RCA review');
    expect(decision.actions.join(' ')).toMatch(/ionized calcium/);
    expect(decision.actions.join(' ')).toContain('total/ionized');
  });

  it.each([{ citrateContraindication: true }, { citrateContraindication: undefined }, { citrateProtocolAvailable: false }, { systemicAnticoagulationReviewed: false }])(
    'withholds RCA preference until contraindications, protocol, and overlap are reviewed %j', patch => {
      const result = evaluatePrescriptionSafety(input(patch)).find(item => item.id === 'crrt-anticoagulation')!;
      expect(result.conclusion).not.toContain('RCA review');
      expect(result.severity).toBe('warning');
      expect(result.actions.join(' ')).toContain('liver');
    });

  it.each([0, 18, 26])('flags measured delivered dose %s outside adult target', observedDeliveredMlKgHr => {
    const result = evaluatePrescriptionSafety(input({ observedDeliveredMlKgHr })).find(item => item.id === 'crrt-delivered-dose')!;
    expect(result.severity).toBe('warning');
    expect(result.evidence.join(' ')).toContain(`observed ${observedDeliveredMlKgHr}`);
  });
  it.each([
    [{ citrateContraindication: undefined }, 'Citrate contraindication / impaired-metabolism assessment'],
    [{ citrateProtocolAvailable: false }, 'Local citrate protocol and trained monitoring team'],
    [{ bleedingRiskReviewed: false }, 'Bleeding / coagulation / HIT risk review'],
    [{ systemicAnticoagulationReviewed: false }, 'Existing systemic anticoagulation and overlap review'],
    [{ anticoagulation: undefined }, 'Explicit anticoagulation selection'],
  ] satisfies [Partial<PrescriptionInput>, string][])('explains each isolated anticoagulation gap %j', (patch, missing) => {
    const result = evaluatePrescriptionSafety(input(patch)).find(item => item.id === 'crrt-anticoagulation')!;
    expect(result.missingData).toEqual([missing]);
  });

  it.each([20, 25])('accepts measured delivered target boundary %s', observedDeliveredMlKgHr => {
    expect(evaluatePrescriptionSafety(input({ observedDeliveredMlKgHr })).find(item => item.id === 'crrt-delivered-dose')!.severity).toBe('monitor');
  });

  it('reports missing measured delivery separately from theoretical estimate', () => {
    expect(evaluatePrescriptionSafety(input()).find(item => item.id === 'crrt-delivered-dose')!.missingData.join(' ')).toContain('observed');
  });

  it.each(['Prismaflex', 'PrisMax'] as const)('requires all confirmations before completing a %s checklist', device => {
    const confirmations = { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true };
    const complete = calculatePrescription(input({ device, confirmations }));
    expect(complete.deviceNeutralRecommendation).toContain('20–25');
    expect(complete.operationalDefaults).toMatchObject({ device, label: 'operational starting point', editable: true });
    expect(complete.checklistComplete).toBe(true);
    for (const key of Object.keys(confirmations) as (keyof typeof confirmations)[]) {
      expect(calculatePrescription(input({ device, confirmations: { ...confirmations, [key]: false } })).checklistComplete).toBe(false);
    }
    expect(calculatePrescription(input({ confirmations })).checklistComplete).toBe(false);
  });

  it('provides electrolyte, buffer, glucose, thermal, nutrition, filter and dose monitoring', () => {
    const monitoring = calculatePrescription(input()).monitoring.join(' ');
    for (const term of ['potassium', 'phosphate', 'magnesium', 'calcium', 'buffer', 'glucose', 'temperature', 'nutrition', 'filter life', 'prescribed', 'delivered']) expect(monitoring).toContain(term);
  });

  it('resolves each decision only against verified rule-specific sources', () => {
    const decisions = evaluatePrescriptionSafety(input());
    expect(decisions).toHaveLength(3);
    for (const decision of decisions) {
      expect(resolveRuleSources(decision.id, decision.sourceIds).length).toBeGreaterThan(0);
      expect(decision.counterfactuals.length).toBeGreaterThan(0);
    }
  });
});
