import type { DecisionResult, EvidenceSource } from './types';

export type EvidenceRegistry = Readonly<Record<string, EvidenceSource>>;

/**
 * Verified against primary publications on checkedOn. A source's existence does
 * not make it applicable to every rule. Only supportedClaims may back execution.
 * Draft and contextual research remain visible without treatment-rule support.
 */
export const evidenceSources: EvidenceRegistry = {
  APP_LIBERATION_V1: {
    id: 'APP_LIBERATION_V1', title: 'App-local supervised CRRT liberation review safeguards, version 1',
    status: 'local', level: 'Conservative review gates, not validated liberation thresholds', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'crrt-liberation-review', scope: 'Require explicit original-indication resolution, native solute/fluid adequacy, adequate observation, reviewed downtime and domain-complete monitoring/restart plan. Two same-case observations 6–24 h apart with >=6 h timed urine, nonfalling positive urine rate, nonrising BUN/SCr and balance, stable perfusion/pressors and nonworsening oxygenation. MAP >=65, lactate <=2, pH >7.2, HCO3 >12, K <6, P/F >200 if oxygen-supported are local conservative veto screens, not sufficient readiness thresholds. Any diuretic exposure needs explicit interpretation; no single clearance/urine threshold. Review ceiling <=4 h during supervised observation, <=15 min for danger/unknowns, immediate for confirmed indications. Confirmed recurrence after documented stop prompts restart review, never a device command.' }],
    notes: 'Local governance required. Continue and reassess means continue the current supervised evaluation, including when already off CRRT; it never orders continuation or restart. Conflicting, future, duplicate, missing, stale or overlapping urine observations block positive trial-off consideration. The strict snapshot schema also validates direct engine calls without coercion; affirmative clinical gates require literal true. Any malformed/nonfinite runtime value prompts immediate invalid-data review. CRRT history is reconciled across the supplied series: a recorded stop cannot disappear through omission, and a new active episode requires a strictly later documented start; equal-time or conflicting records remain uncertain. Before selecting latest events, every recorded episode start must map to at most one stop instant; identical repeats are allowed, conflicting stops are not erased by later episodes. Treatment-state uncertainty does not suppress confirmed urgent indication evidence or immediate bedside review.',
  },
  APP_TRAJECTORY_V1: {
    id: 'APP_TRAJECTORY_V1', title: 'App-local descriptive organ trajectory conventions, version 1',
    status: 'local', level: 'Measured direction framing, not a validated prognosis model', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'aki-prognosis-review', scope: 'Sort unique same-case timestamps without mutation. Renal classification requires paired timed urine rates and creatinine with known absent diuretic exposure and no recorded active RRT; conflicting/missing/confounded series is insufficient-data. Concordant latest direction defines improving/worsening; prior improvement followed by latest deterioration is relapsing; unchanged latest pair is persistent (descriptive, not a duration-defined AKI phenotype). Hemodynamic, respiratory, fluid and organ directions remain separate and indeterminate when incomplete/conflicting. CKD, time since shock onset (not proven shock duration), multiorgan observations and unknown nephrotoxin exposure are review context only. No individual probability, mortality prediction or recovery claim.' }],
    notes: 'Recorded CRRT without a valid timeline, overlapping a urine collection, or delivered between serial SCr observations prevents inference of native renal direction. No recorded RRT does not prove absence of extracorporeal clearance; clinical treatment reconciliation remains required.',
  },
  MAKE_DEFINITIONS_2024: {
    id: 'MAKE_DEFINITIONS_2024', title: 'Heterogeneity in the definition of major adverse kidney events: a scoping review',
    status: 'observational', level: 'Systematic scoping analysis of outcome definitions; not a prediction model', year: 2024,
    publicationDate: '2024-05-27', doi: '10.1007/s00134-024-07480-x',
    url: 'https://link.springer.com/article/10.1007/s00134-024-07480-x', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'aki-prognosis-review', scope: 'MAKE commonly frames death, dialysis/new KRT or dependence, and persistent kidney dysfunction at 30/90 days; component definitions, baselines and observation windows vary. Supports explaining outcomes and uncertainty, not calculating individual MAKE or mortality risk.' }],
  },
  APP_HA_REVIEW_V1: {
    id: 'APP_HA_REVIEW_V1', title: 'App-local fail-closed hemoadsorption review safeguards, version 1',
    status: 'local', level: 'Conservative review prerequisites; not validated eligibility or treatment thresholds', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [
      { ruleId: 'ha-gated-review', scope: 'Explicit opt-in and four mandatory gates. Standard septic-shock care/source-control assessment, persistent/worsening same-case measured trajectory, reversible trait; device-specific target; laboratory/circuit/drug safety; multidisciplinary/pharmacy approval, protocol/registry/research, applicable consent and monitoring/stop plan. Quantitative serial IL-6 plus compatible assessed phenotype for broad cytokine adsorption; no universal IL-6 threshold or CRP/PCT/ferritin shortcut. Immunoparalysis/low HLA-DR veto broad adsorption. oXiris needs separate Task 6 indication confirmation. Strongest label is eligible for multidisciplinary review.' },
      { ruleId: 'ha-device-match', scope: 'Trait-based device review only after all four gates, with no efficacy claim or cross-device extrapolation. oXiris requires independent KRT indication; its endotoxin phenotype uses explicit assessment and EAA, never the PMX post-hoc range. Device IFU/protocol remains separately required.' },
      { ruleId: 'ha-time-limited-review', scope: 'App-local 5 Rights and conditional time-limited review plan: baseline and serial NE-equivalent, MAP, lactate, perfusion, timed urine, SOFA, targets, platelets/albumin and drug timing. Early 2–4 h safety review; explicit 6–12 h futility ceiling. No universal initiation, cartridge or processed-volume target.' },
      { ruleId: 'ha-response-review', scope: 'App-local bedside stop/futility review for observed harm, worsening NE/SOFA, uncontrolled source, loss of target, immunoparalysis, irreversibility or goals change; nonresponse at the explicitly planned 6–12 h ceiling. Current device/target compatibility, applicable phenotype and target-presence confirmation are required: false prompts stop review; unknown prompts immediate incomplete review. Falling serial biomarkers need not rise again. Missing/cross-case/time-conflicting data never establish response. Shock reversal NE<0.05 with lactate<2 is an unvalidated reference only, not an HA endpoint. No automatic continuation or HA-attributed benefit.' },
      { ruleId: 'ha-drug-exposure-review', scope: 'Pharmacy review safeguard: preserve full loading dose without delay/reduction; record drug, HA initiation and cartridge times; vancomycin AUC/TDM, linezolid/azole/beta-lactam TDM when available, and extended-infusion review. Individual exposure assessment includes MIC, volume of distribution, residual renal function, CRRT and the specific device; no calculated supplemental doses.' },
    ],
    notes: 'Verified as explicitly declared local safeguards, not independently validated clinical rules. Adult clinical, pharmacy, device, consent and research governance remain required. Platelet/coagulation/albumin acceptability is clinician-assessed, not an invented universal cutoff. These deliberately stricter gates are not attributed to Molnar or ADQI as clinical practice guidance.',
  },
  EUPHRATES_POSTHOC_2018: {
    id: 'EUPHRATES_POSTHOC_2018', title: 'Polymyxin B hemoperfusion in endotoxemic septic shock patients without extreme endotoxemia: a post hoc analysis of the EUPHRATES trial',
    status: 'trial', level: 'Exploratory post-hoc, per-protocol subgroup analysis; hypothesis-generating only', year: 2018,
    publicationDate: '2018-11-23', doi: '10.1007/s00134-018-5463-7',
    url: 'https://link.springer.com/article/10.1007/s00134-018-5463-7',
    verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'pmx-exploratory-enrichment', scope: 'PMX only: exploratory subgroup EAA 0.60–0.89 and MODS >9. Supports description of an enrichment range for multidisciplinary review, not an indication, validated treatment threshold, efficacy or mortality-benefit claim. Parent trial was neutral; subgroup was post-hoc/per-protocol. No extrapolation to CytoSorb, HA330/HA380 or oXiris.' }],
    notes: 'Primary article independently verified. The app conservatively uses the explicitly reported 0.60–0.89 bounds; it does not round intermediate EAA values into the subgroup. TIGRIS remains independently unverified and cannot enable execution.',
  },
  NSI_CRRT_2016: {
    id: 'NSI_CRRT_2016', title: 'Nomenclature for renal replacement therapy in acute kidney injury: basic principles',
    status: 'consensus', level: 'Original Nomenclature Standardization Initiative consensus report', year: 2016,
    publicationDate: '2016-10-10', doi: '10.1186/s13054-016-1489-9',
    url: 'https://link.springer.com/article/10.1186/s13054-016-1489-9',
    verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'crrt-prescription-safety', scope: 'Fluids/flows and filtration-fraction sections distinguish total ultrafiltration from net fluid removal, plasma-based filtration fraction from whole-blood concentration ratio, and pre/post-dilution efficiency. Dose labels separate target, current and effective delivery. Supports accounting principles, not local downtime or safety thresholds.' }],
  },
  APP_CRRT_PRESCRIPTION_V1: {
    id: 'APP_CRRT_PRESCRIPTION_V1', title: 'App-local adult CRRT arithmetic and review safeguards, version 1',
    status: 'local', level: 'Declared arithmetic assumptions and conservative review gates; not validated clinical thresholds', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [
      { ruleId: 'crrt-prescription-safety', scope: 'Explicit adult and weight-basis confirmation. Qp=60*Qb*(1-Hct); QUF=Qpre+Qpost+QPBP+UFNET; Qeff=Qd+QUF; FF=100*QUF/(Qp+Qpre+QPBP). Simplified plasma-based pre-dilution factor Qp/(Qp+Qpre+QPBP); nominal prescription target/(uptime*factor). All flows mL/h except patient Qb before PBP in mL/min. Explicit separate PBP/citrate flow, zero when absent; no double counting. Downtime >=50% blocks automatic compensation; FF >=25% prompts review, not a device limit. UFNET held at zero for rising/unknown pressors or inadequate/unknown perfusion. Device presets are editable app-local starting points, not manufacturer recommendations or executable orders. Local reassessment ceilings: 15 minutes for rising pressors/inadequate perfusion, otherwise 1 hour.' },
      { ruleId: 'crrt-anticoagulation', scope: 'Conditional RCA discussion requires explicit contraindication assessment, available local protocol, bleeding and systemic-anticoagulation review. Unknowns block preference; no automatic heparin fallback. Monitor calcium, citrate accumulation, acid-base and filter life. Liver dysfunction/shock require specialist review, not an app-diagnosed absolute contraindication.' },
    ],
    notes: 'Declared local conventions, not independent clinical validation. Conservative plasma-model domain additionally requires dilution-corrected configured runtime clearance and target*weight/uptime not to exceed native Qp. Configured Qeff may exceed native Qp when pre/PBP fluid is included, but cannot exceed Qp+Qpre+QPBP in this model. This outer ceiling does not establish complete saturation, model accuracy, clinical adequacy or a universal device/physiologic limit; red-cell transport is not modeled. Review with nephrology, ICU, nursing, pharmacy and device governance before use. Predilution estimate is not measured clearance; reconcile PBP, machine blood-flow convention and external systemic infusions before application.',
  },
  APP_KRT_SAFETY_V1: {
    id: 'APP_KRT_SAFETY_V1', title: 'App-local KRT review safety conventions, version 1',
    status: 'local', level: 'Conservative review routing; not validated treatment thresholds', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [
      { ruleId: 'krt-emergency-indications', scope: 'K >=6, pH <=7.2, HCO3 <=12 or edema/PF <=200 are urgent-confirmation screens only. Refractory hyperkalemia/acidemia requires concordant K/pH; refractory edema requires edema, PF <=200 and respiratory support. Named uremic complications, explicit life-threatening electrolyte danger, toxicology-confirmed dialyzable exposure or specialist-confirmed sodium-control need prompt immediate review. No automatic KRT order. Reassessment: immediately for confirmed indication, <=15 min for uncertainty/danger, <=1 h otherwise; these ceilings are local.' },
      { ruleId: 'krt-modality-selection', scope: 'Conditional review only after separate indication confirmation. Stable label requires MAP >=65, no pressor, non-worsening trend, lactate <=2 and no observed hypoperfusion; conflicts block IHD preference. Intermediate tolerance permits PIRRT review; instability/ICP risk/precise control favors CRRT review. Missing information remains unknown.' },
      { ruleId: 'ecmo-krt-connection', scope: 'No automatic connection selection. Require site-specific pressure, compatibility, air-risk and flow review; compare both access routes. Review effective delivered dose, hemolysis, clotting/TMP, overlapping anticoagulation/bleeding and interruptions. Existing ECMO anticoagulation never guarantees CRRT filter life.' },
    ],
    notes: 'Local safety review convention verified as declared, not clinical validation. Requires clinical governance. Flags represent explicit clinician assessments, not raw-value inference.',
  },
  STARRT_AKI_2020: {
    id: 'STARRT_AKI_2020', title: 'Timing of Initiation of Renal-Replacement Therapy in Acute Kidney Injury',
    status: 'trial', level: 'Multinational randomized controlled trial', year: 2020,
    url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2000741', doi: '10.1056/NEJMoa2000741',
    verificationUrl: 'https://www.ualberta.ca/en/critical-care/media-library/documents/research-documents/starrt-aki_nejm-2020.pdf',
    verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'krt-emergency-indications', scope: 'In critically ill severe AKI without urgent indications, accelerated initiation did not lower 90-day mortality versus standard care. Supports monitored deferral, not withholding emergency treatment or a mandatory numeric/duration trigger.' }],
  },
  ELSO_FLUID_AKI_2022: {
    id: 'ELSO_FLUID_AKI_2022', title: 'ELSO Guidelines for Fluid Overload, Acute Kidney Injury, and Electrolyte Management',
    status: 'guideline', level: 'ELSO guidance; adult technical circuit sections', year: 2022,
    url: 'https://doi.org/10.1097/MAT.0000000000001702', doi: '10.1097/MAT.0000000000001702',
    verificationUrl: 'https://www.biomedsimulation.com/wp-content/uploads/2025/04/ELSO_Guidelines_for_Fluid_Overload_2022.pdf',
    verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'ecmo-krt-connection', scope: 'Adult technical section pp615–616: separate vascular access vs integrated CRRT, additional catheter bleeding/access burden, circuit pressure incompatibility, alarms, air/flow hazards, and effective dose review. No universal connection choice or survival superiority.' }],
  },
  APP_FLUID_SAFETY_V1: {
    id: 'APP_FLUID_SAFETY_V1', title: 'App-local fluid stewardship safety conventions, version 1',
    status: 'local', level: 'Conservative decision-support conventions; not validated treatment thresholds', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [
      { ruleId: 'fluid-dynamic-assessment', scope: 'Local interpretation requires recorded PLR plus concordant VTI/SV change, positive at >=10%; ambiguous tests remain unknown. Not an automatic fluid indication.' },
      { ruleId: 'fluid-tolerance', scope: 'Local safety screen: edema, diffuse bilateral B-lines, VExUS >=2 or deteriorating oxygenation block unqualified bolus. P/F <200, missing P/F unless on room air, impaired/dilated RV or severely reduced LV requires further review. Negative lung and venous observations do not establish universal safety.' },
      { ruleId: 'fluid-plan', scope: 'A clinician-reviewed small monitored challenge requires positive response, no observed intolerance and perfusion concern; include response target and stop rules. No executable order.' },
      { ruleId: 'fluid-rose', scope: 'Tentative ROSE classification: MAP <65 or rising pressors prompts resuscitation review; stability requires MAP >=65, lactate <=2, CRT <=3 and known non-rising pressors. Rising lactate, mottling, cool peripheries or altered/unresponsive mental status block stability. Congestion plus accumulation supports evacuation review only. Numeric trend lookback <=6 h.' },
      { ruleId: 'fluid-balance', scope: 'Balance, weight and timed urine are contextual observations, not independent fluid or KRT orders; preserve missing versus zero urine and discordance.' },
      { ruleId: 'fluid-ufnet', scope: 'During instability or perfusion risk, use UFNET 0 as a conservative review default, not a machine prescription. Stable congestion may support gradual clinician-reviewed removal; no automatic rate. Local reassessment ceilings 15 minutes during instability/challenge and 1 hour otherwise; continuous monitoring when unstable.' },
    ],
    notes: 'Verification confirms the explicitly declared app convention, not clinical validation or guideline endorsement. Requires local clinical governance before deployment.',
  },
  APP_SA_AKI_TIMING_V1: {
    id: 'APP_SA_AKI_TIMING_V1', title: 'App-local SA-AKI temporal subdivision, version 1',
    status: 'local', level: 'App operational convention; not an externally validated threshold', year: 2026,
    url: undefined, version: '1', verification: 'verified', checkedOn: '2026-09-21',
    supportedClaims: [{ ruleId: 'sa-aki-early-late-local', scope: 'App-local convention: early 0–48 h inclusive; late >48–168 h inclusive after recorded sepsis onset. First observed AKI is not necessarily true onset.' }],
    notes: 'Defined in app specification section 6.1. The 48-hour subdivision is not attributed to ADQI; clinical confirmation and onset review remain necessary.',
  },
  SEPSIS_3_2016: {
    id: 'SEPSIS_3_2016', title: 'The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3)',
    status: 'consensus', level: 'Consensus definitions', year: 2016,
    publicationDate: '2016-02-23', version: 'JAMA 315(8):801–810', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1001/jama.2016.0287', url: 'https://jamanetwork.com/journals/jama/fullarticle/2492881',
    supportedClaims: [{ ruleId: 'sepsis-diagnostic-context', scope: 'Sepsis requires infection-associated acute organ dysfunction; acute SOFA increase of at least 2 operationalizes organ dysfunction. An isolated SOFA score is not an observed change.' }],
  },
  SSC_2026: {
    id: 'SSC_2026',
    title: 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026',
    status: 'guideline', level: 'Clinical practice guideline; claim-specific certainty', year: 2026,
    publicationDate: '2026-03-23', version: '2026 guideline', verification: 'verified', checkedOn: '2026-09-21',
    url: 'https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-international-guidelines-for-management-of-sepsis-and-septic-shock-2026',
    supportedClaims: [
      { ruleId: 'ha-not-routine', scope: 'Suggest against blood purification in adult sepsis/septic shock.', strength: 'Conditional; very low certainty' },
      { ruleId: 'pmx-not-routine', scope: 'Suggest against polymyxin B hemoperfusion in adult sepsis/septic shock.', strength: 'Conditional; low certainty' },
      { ruleId: 'fluid-dynamic-assessment', scope: 'Prefer dynamic fluid-response measures to examination or static measures alone.', strength: 'Conditional; low certainty' },
      { ruleId: 'krt-emergency-indications', scope: 'For sepsis/septic shock with AKI and no definitive RRT indication, suggest against RRT. This guideline does not validate app-local numeric urgent-confirmation screens.', strength: 'Conditional; moderate certainty' },
      { ruleId: 'krt-modality-selection', scope: 'For sepsis/septic shock with AKI warranting RRT, suggest either continuous or intermittent RRT; patient-specific mode selection relies on other guidance and bedside tolerance.', strength: 'Conditional; low certainty' },
    ],
  },
  ADQI_28: {
    id: 'ADQI_28',
    title: 'Sepsis-associated acute kidney injury: consensus report of the 28th Acute Disease Quality Initiative workgroup',
    status: 'consensus', level: 'Consensus statement', year: 2023,
    publicationDate: '2023-02-23', version: 'Published consensus', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1038/s41581-023-00683-3', url: 'https://www.nature.com/articles/s41581-023-00683-3',
    supportedClaims: [{ ruleId: 'sa-aki-seven-day-window', scope: 'SA-AKI is AKI occurring within seven days of sepsis onset using KDIGO and Sepsis-3 definitions.' }],
    notes: 'Public abstract verified; early/late 48-hour subdivision requires separate full-text verification before rule support.',
  },
  ADQI_30: {
    id: 'ADQI_30',
    title: 'Hemoadsorption: consensus report of the 30th Acute Disease Quality Initiative workgroup',
    status: 'consensus', level: 'Consensus report', year: 2024,
    publicationDate: '2024-04-15', version: 'Advance access publication', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1093/ndt/gfae089', url: 'https://academic.oup.com/ndt/article/39/12/1945/7646075',
    verificationUrl: 'https://apheresis.com.ua/pdf/file16.pdf',
    supportedClaims: [{ ruleId: 'ha-experimental-evidence', scope: 'Modern HA remains experimental with limited clinical evidence; target removal does not establish outcome benefit.' }],
    notes: 'Original publisher PDF verified through publicly hosted copy; publisher HTML unavailable.',
  },
  KDIGO_2026_DRAFT: {
    id: 'KDIGO_2026_DRAFT',
    title: 'KDIGO 2026 Clinical Practice Guideline for Acute Kidney Injury (AKI) and Acute Kidney Disease (AKD) — Public Review Draft',
    status: 'draft', level: 'Public-review draft; not final guidance', year: 2026,
    publicationDate: '2026-03', version: 'March 2026 Public Review Draft', verification: 'verified', checkedOn: '2026-09-21',
    url: 'https://kdigo.org/wp-content/uploads/2026/03/KDIGO-2026-AKI-AKD-Guideline-Public-Review-Draft-March-2026.pdf',
    supportedClaims: [],
    notes: 'Cover restricts purpose to public review/feedback. Not executable clinical guidance; use verified final sources.',
  },
  TIGRIS_2026: {
    id: 'TIGRIS_2026', title: 'TIGRIS 2026 — primary publication verification incomplete',
    status: 'unverified', level: undefined, year: undefined,
    url: 'https://www.thelancet.com/journals/lanres/article/PIIS2213-2600(26)00047-0/fulltext',
    verification: 'unverified', checkedOn: '2026-09-21', supportedClaims: [],
    notes: 'Named report and publisher URL located, but primary article/DOI inaccessible during verification. Do not use secondary reports to enable EAA thresholds or efficacy claims.',
  },
  MOLNAR_2026: {
    id: 'MOLNAR_2026', title: 'The role of hemoadsorption in septic shock: toward a personalized approach',
    status: 'position', level: 'Expert position statement (published as Review)', year: 2026,
    publicationDate: '2026-06-13', version: 'Critical Care 30, 432', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1186/s13054-026-06135-1', url: 'https://link.springer.com/article/10.1186/s13054-026-06135-1',
    supportedClaims: [{ ruleId: 'ha-expert-phenotype-review', scope: 'Expert discussion of adjunctive HA for hyperinflammatory septic shock unresponsive to standard therapy, not a validated indication.' }],
    notes: 'Does not supply universal HA dosing, a validated IL-6 cutoff, or class-wide survival benefit.',
  },
  PHIND_2026: {
    id: 'PHIND_2026', title: 'Bedside identification of subphenotypes in acute respiratory failure (PHIND): a multicentre, observational cohort study',
    status: 'observational', level: 'Prospective multicentre observational cohort', year: 2026,
    publicationDate: '2026-03-23', version: 'Published online', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1016/S2213-2600(26)00040-8', url: 'https://news.randox.com/wp-content/uploads/2026/04/phind-paper.pdf',
    supportedClaims: [],
    notes: 'Primary article: ARDS/AHRF phenotype identification using IL-6, TNFR1 and bicarbonate. Context only; not an HA intervention or treatment-benefit trial.',
  },
  IMMUNOSEP_2026: {
    id: 'IMMUNOSEP_2026', title: 'Precision Immunotherapy to Improve Sepsis Outcomes: The ImmunoSep Randomized Clinical Trial',
    status: 'trial', level: 'Randomized clinical trial', year: 2026,
    publicationDate: '2025-12-08', version: 'Online 2025; JAMA 2026;335(9):775–786', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1001/jama.2025.24175', url: 'https://jamanetwork.com/journals/jama/fullarticle/2842634',
    supportedClaims: [],
    notes: 'Phenotype-directed immunotherapy study, not hemoadsorption. Organ-dysfunction results cannot be generalized to HA.',
  },
  KDIGO_2012: {
    id: 'KDIGO_2012', title: 'KDIGO Clinical Practice Guideline for Acute Kidney Injury',
    status: 'guideline', level: 'Clinical practice guideline; claim-specific grading', year: 2012,
    publicationDate: '2012-03', version: 'Kidney International Supplements 2(1)', verification: 'verified', checkedOn: '2026-09-21',
    url: 'https://kdigo.org/wp-content/uploads/2019/01/KDIGO-2012-AKI-Guideline-English.pdf',
    supportedClaims: [
      { ruleId: 'aki-definition-staging', scope: 'Sections 2.1.1–2.1.2/Table 2: timed creatinine/urine criteria; use the highest applicable stage.', strength: 'Not Graded' },
      { ruleId: 'crrt-liberation-review', scope: 'Sections 5.2.1–5.2.2 and Chapter 5.2 rationale: assess whether intrinsic function meets patient needs; individualize reassessment. Urine output and timed CrCl are contextual, affected by diuretics and extracorporeal clearance/volume state; no universal stopping threshold. Do not use diuretics to accelerate recovery or reduce RRT duration. Local observation/restart gates are not KDIGO recommendations.', strength: '5.2.1 Not Graded; 5.2.2 2B' },
      { ruleId: 'aki-prognosis-review', scope: 'Sections 2.2–2.3: review susceptibilities/exposures and serial SCr/urine; evaluate kidney resolution or new/worsening CKD at 3 months. Does not validate the app trajectory labels or individual prognosis calculation.', strength: '2.3.4 Not Graded' },
      { ruleId: 'krt-emergency-indications', scope: 'Sections 5.1.1–5.1.2: life-threatening fluid/electrolyte/acid-base changes and clinical trends, not isolated BUN/SCr thresholds.', strength: 'Not Graded' },
      { ruleId: 'krt-modality-selection', scope: 'Sections 5.6.1–5.6.3: continuous and intermittent therapies are complementary; CRRT suggested for instability and brain injury/raised ICP. Rationale discusses rapid IHD clearance and hybrid SLED. No overall survival superiority.', strength: '5.6.1 Not Graded; 5.6.2–5.6.3 2B' },
      { ruleId: 'krt-modality-mechanisms', scope: 'Chapter 5.6/Table 21: diffusion in CVVHD, convection in CVVH, both in CVVHDF; SCUF has minimal solute clearance and is mainly a fluid-removal technique. Mechanism is not proof of survival superiority.' },
      { ruleId: 'crrt-delivered-dose', scope: 'Section 5.8.4: delivered effluent 20–25 mL/kg/h, with higher prescribed volume often needed.', strength: '1A; prescription compensation Not Graded' },
      { ruleId: 'crrt-anticoagulation', scope: 'Sections 5.3.1–5.3.3 and rationale: individualized bleeding/coagulation/systemic anticoagulation assessment; suggest regional citrate in CRRT without contraindications and with an established protocol. Monitor acid-base, sodium and total/ionized calcium; impaired citrate metabolism needs careful review.', strength: '5.3.1 Not Graded; 5.3.2.2 2B; 5.3.3.1 2C' },
    ],
  },
  CRRTNET_WEIGHT_2026: {
    id: 'CRRTNET_WEIGHT_2026', title: 'Association between obesity and kidney outcomes in critically ill patients with acute kidney injury receiving continuous renal replacement therapy: a secondary analysis of the multicenter CRRTnet study',
    status: 'observational', level: 'Secondary observational cohort analysis', year: 2026,
    publicationDate: '2026-03-28', version: 'Version of record 2026-04-02', verification: 'verified', checkedOn: '2026-09-21',
    doi: '10.1186/s13054-026-05950-w', url: 'https://link.springer.com/article/10.1186/s13054-026-05950-w',
    supportedClaims: [{ ruleId: 'weight-formula-arithmetic', scope: 'Methods document Devine inch-based IBW and IBW + 0.4 × (actual − IBW). Arithmetic only; no automatic dosing-weight selection.' }],
  },
};

/** Resolve explanatory citations without silently dropping bad IDs. */
export function resolveDecisionSources(decision: Pick<DecisionResult, 'sourceIds'>, registry: EvidenceRegistry = evidenceSources): EvidenceSource[] {
  return decision.sourceIds.map(id => {
    if (!Object.hasOwn(registry, id)) throw new Error(`Unknown evidence source: ${id}`);
    const source = registry[id];
    if (source.verification !== 'verified' || source.status === 'unverified') throw new Error(`Unverified evidence source: ${id}`);
    return source;
  });
}

/** Executable rule boundary: require verified, specifically scoped support. */
export function resolveRuleSources(ruleId: string, sourceIds: string[], registry: EvidenceRegistry = evidenceSources): EvidenceSource[] {
  if (sourceIds.length === 0) throw new Error(`Rule ${ruleId} requires evidence`);
  const sources = resolveDecisionSources({ sourceIds }, registry);
  for (const source of sources) {
    if (source.status === 'draft' || !source.supportedClaims.some(claim => claim.ruleId === ruleId)) throw new Error(`Source ${source.id} does not support rule ${ruleId}`);
  }
  return sources;
}
