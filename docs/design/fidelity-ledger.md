# Task 13 visual fidelity ledger

Reference surfaces:

- `docs/design/concepts/desktop-command-center.png` — 1586 × 992 command-center concept
- `docs/design/concepts/mobile-assessment-wizard.png` — mobile assessment concept

Status: **APPROVED — reviewed remote feature commit `a893e51d648d7e81eddec680805e10caff67298b` and its successful CI #5 fidelity artifact.**

Visual signoff complements the functional test gates; it is not clinical validation or a determination of clinical safety/effectiveness.

## CI #5 visual signoff — run 35704571691

GitHub CI run `35704571691` passed full verification and all 16 Playwright cases, then uploaded the successful fidelity artifact `fidelity-screenshots-a893e51d648d7e81eddec680805e10caff67298b` (artifact ID `10683134797`, digest `sha256:383ce6fcb69036168c6f6b6a6cfa9eaa23be7a7df55e702d4328b3c1192c9b15`). The reviewed remote commit was `a893e51d648d7e81eddec680805e10caff67298b`.

Independent visual verdict: **APPROVE**. Native-size captures were inspected at desktop 1586 × 992, mobile 390 × 844, and mobile 430 × 764. No Critical or Important findings were observed; there were no visible collisions or overflow, and mobile sticky actions remained fully visible. Non-blocking minor observations were excess desktop whitespace above the columns, a mixed English clinical phrase/local convention, subtle horizontal tab affordance, and muted helper text.

The earlier deferred service-worker registration hypothesis is browser-confirmed for this CI run in the limited sense that the prior warning did not recur and offline/update scenarios passed; this is not universal proof across all browsers or environments.

## CI #4 status — 35702747637

CI #4 passed 14 of 16 Playwright cases, but the two desktop offline cases failed console-health checks before a successful fidelity-artifact upload. Chromium reported a service-worker/modulepreload cross-world resource-mismatch warning during first installation and byte-changed service-worker activation. The pinned Workbox implementation documents immediate registration as a not-recommended pre-window-load timing condition; this is a plausible mechanism, so the follow-up defers application registration until window load without suppressing or filtering the warning. Only the next browser CI can confirm whether that mitigation eliminates Chromium's warning. The visual gate remains blocked until a successful CI run uploads all three required native-size captures and they are reviewed.

## CI capture evidence — 35701472321

CI run `35701472321` completed its functional gates successfully and produced all three required screenshot files. Manual inspection found both mobile assessment captures (390 × 844 and 430 × 764) usable. The desktop 1586 × 992 image is **invalid as visual-release evidence**: it opened a newly created case with no snapshots, so the dashboard rendered only `尚無時間點；請先新增評估。` instead of the mandated three-column command-center comparison. This does not invalidate the functional CI result, but it does leave visual signoff blocked. The capture must be rerun from a validated case with a timepoint and the resulting desktop image, plus both retained mobile images, must be reviewed before release.

The repository contains a Playwright capture scenario (`e2e/fidelity.spec.ts`) at the approved desktop size and at 390 × 844 and 430 × 764 mobile sizes. The local environment cannot launch Playwright Chromium because revision `chromium_headless_shell-1243` is absent, and repeated official browser-download attempts failed at the CDN/network boundary. Therefore no newly rendered screenshot was available for honest native-size inspection. Screenshot generation by the test is evidence collection only; it is not an automated fidelity assertion.

| Review dimension | Automated protection available now | Rendered comparison still required | Signoff |
|---|---|---|---|
| Copy and safety boundaries | Component tests pin adult-only, anonymous-data, non-order, pediatric/pregnancy/newborn exclusion, and clinical-judgment wording | Compare wrapping, clipping, and prominence to both approved concepts | Approved — CI #5 review |
| Layout and hierarchy | E2E locators cover the command center, eight-step wizard, decision cards, and HA opt-in | Inspect desktop three-column balance and mobile step hierarchy at native size | Approved — CI #5 review |
| Typography | Production build contains Noto Sans TC assets; E2E waits for `document.fonts.ready` before capture | Inspect weight, line length, fallbacks, and CJK glyph rendering | Approved — CI #5 review |
| Palette and contrast | Delivery test calculates five real token/background pairs at WCAG AA ≥ 4.5:1; warning token was darkened after a failing check | Inspect status differentiation and visual prominence, including color-independent labels | Approved — CI #5 review |
| Spacing and density | Responsive CSS and semantic components are covered by DOM/component tests | Compare gutters, card rhythm, and controls against the concepts | Approved — CI #5 review |
| Status semantics | Tests assert text labels and decision severity; semantics do not rely only on color | Inspect visual consistency of critical/warning/monitor/stable states | Approved — CI #5 review |
| Responsive behavior | Mobile E2E asserts exact 390 px client/scroll width after each wizard step | Run it in Chromium and inspect both mobile reference sizes for overlap and tap-target usability | Approved — CI #5 review |
| Core interaction | Browser scenarios exercise case creation, two timepoints, export/download, handoff, HA fail-closed behavior, skip-link activation, cold deep links, offline navigation, and service-worker update persistence | Execute all 16 cases and inspect screenshots/traces | CI #5 passed; production gate pending |

Release rule: Task 14 first pushes the feature branch, not `main`. Non-production CI must pass `npm run verify` and upload `fidelity-screenshots-<commit SHA>` with all three native-size captures. A reviewer must download and inspect the desktop image plus both mobile images against the two approved concepts. Only that reviewed commit may then be integrated and pushed to `main`, which triggers a fresh gated Pages verification/deployment. Task 14 must not claim visual, responsive, keyboard, offline, service-worker-update, or end-to-end clinical-flow verification before these checks. Any material mismatch requires a focused regression, another feature-branch CI run, and normal follow-up commit before release.
