# Changelog

Clinical-content, evidence, safety, and application changes are recorded here.

## Unreleased

- Corrected HA subrecord reconciliation to count a conflicted event/drug/TDM identity only once and leave disputed details unknown, preventing revised events from becoming false recurrence evidence. Historical medication/TDM/cartridge monitoring now remains visible alongside provenance uncertainty, including omitted current exposure or opt-in documentation; no treatment or dose authorization is inferred.
- Fixed longitudinal HA exposure reconciliation: omitted later treatment records no longer erase ongoing monitoring; valid stops persist, while duplicate/conflicting/reopened records fail closed into immediate review. Timestamped medication/TDM/adverse-event histories are retained and deduplicated without inferring current clinical approvals.
- Added optional schema-v1 `prescriptionAssessment` and accessible CRRT flow, weight-rationale, perfusion, RCA-risk/protocol, device and five-confirmation inputs. Fully documented observations can reach the existing clinician-only arithmetic/conditional RCA branches; unknowns remain unknown and no machine order is generated.
- Added respiratory-support/PF, VExUS, interval-balance, multi-value uremic and ECMO-anticoagulation inputs, plus ordinary HA exposure controls and strictly validated repeatable JSON subrecords. Saved/imported arrays and objects remain intact in read-only round trips.
- Fixed stale offline navigation across changed builds by keying navigation caches to the precached shell revision and removing retired navigation caches. Added a two-build regression running the real application service worker/Workbox with simulated browser I/O; real-browser and visual release verification remains pending.
- Corrected privacy/storage disclosure to distinguish confirmed IndexedDB cases/snapshots from unconfirmed current-tab `sessionStorage` assessment drafts, including draft lifecycle, best-effort cleanup after successful save/delete/clear-all, visible cleanup-failure warnings, cross-tab limits, and shared-device/browser-profile risk. No clinical rule changed.

## 0.1.0 — 2026-09-21

### Clinical and workflow modules

- Added anonymous adult case management with local IndexedDB persistence, strict schema validation, JSON import/export, and deletion.
- Added the eight-step longitudinal assessment workflow.
- Added explainable AKI/SA-AKI diagnosis, fluid stewardship, KRT indication, modality and ECMO review, CRRT prescription/delivery/anticoagulation, HA gated review, CRRT liberation, and descriptive trajectory modules.
- Added the severity-ordered decision dashboard, 0–72-hour trends, provenance-linked decision cards, and allowlisted bedside handoff summary.
- Added evidence, privacy, governance, changelog, and offline-information routes.

### Evidence versions

- Registered KDIGO 2012, KDIGO 2026 Public Review Draft, SSC 2026, Sepsis-3 2016, ADQI 28, ADQI 30, ELSO 2022, NSI CRRT 2016, STARRT-AKI 2020, EUPHRATES post-hoc 2018, MAKE definitions 2024, Molnar 2026, PHIND 2026, ImmunoSep 2026, CRRTnet weight 2026, TIGRIS 2026, and version 1 app-local operational sources.
- Recorded evidence verification through 2026-09-21.
- Marked KDIGO 2026 as a Public Review Draft and non-executable.
- Marked TIGRIS 2026 unverified and non-executable.

### Safety changes

- Added fail-closed source resolution: only verified sources with an explicitly matching rule scope may support execution.
- Added visible adult clinician-only, pediatric/pregnancy/newborn exclusion, non-emergency, non-device, non-automatic-order, and clinical-judgment boundaries.
- Added the SSC 2026 conditional-against-routine blood-purification/PMX warning and retained HA only as a restricted experimental adjunct in research, registry, or approved-protocol contexts.
- Added privacy threat-model copy for device/browser access, exported JSON, deletion limits, browser eviction, and the absence of claimed application-level encryption.
- Added keyboard skip navigation, semantic page headings and landmarks, text-plus-color status labels, visible focus treatment, and reduced-motion handling.
