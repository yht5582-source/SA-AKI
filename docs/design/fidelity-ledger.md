# Task 13 visual fidelity ledger

Reference surfaces:

- `docs/design/concepts/desktop-command-center.png` — 1586 × 992 command-center concept
- `docs/design/concepts/mobile-assessment-wizard.png` — mobile assessment concept

Status: **BLOCKED — CI run 35701472321 is functionally green, but a corrected desktop capture and reviewer inspection are still required.**

## CI capture evidence — 35701472321

CI run `35701472321` completed its functional gates successfully and produced all three required screenshot files. Manual inspection found both mobile assessment captures (390 × 844 and 430 × 764) usable. The desktop 1586 × 992 image is **invalid as visual-release evidence**: it opened a newly created case with no snapshots, so the dashboard rendered only `尚無時間點；請先新增評估。` instead of the mandated three-column command-center comparison. This does not invalidate the functional CI result, but it does leave visual signoff blocked. The capture must be rerun from a validated case with a timepoint and the resulting desktop image, plus both retained mobile images, must be reviewed before release.

The repository contains a Playwright capture scenario (`e2e/fidelity.spec.ts`) at the approved desktop size and at 390 × 844 and 430 × 764 mobile sizes. The local environment cannot launch Playwright Chromium because revision `chromium_headless_shell-1243` is absent, and repeated official browser-download attempts failed at the CDN/network boundary. Therefore no newly rendered screenshot was available for honest native-size inspection. Screenshot generation by the test is evidence collection only; it is not an automated fidelity assertion.

| Review dimension | Automated protection available now | Rendered comparison still required | Signoff |
|---|---|---|---|
| Copy and safety boundaries | Component tests pin adult-only, anonymous-data, non-order, pediatric/pregnancy/newborn exclusion, and clinical-judgment wording | Compare wrapping, clipping, and prominence to both approved concepts | Pending browser gate |
| Layout and hierarchy | E2E locators cover the command center, eight-step wizard, decision cards, and HA opt-in | Inspect desktop three-column balance and mobile step hierarchy at native size | Pending browser gate |
| Typography | Production build contains Noto Sans TC assets; E2E waits for `document.fonts.ready` before capture | Inspect weight, line length, fallbacks, and CJK glyph rendering | Pending browser gate |
| Palette and contrast | Delivery test calculates five real token/background pairs at WCAG AA ≥ 4.5:1; warning token was darkened after a failing check | Inspect status differentiation and visual prominence, including color-independent labels | Pending browser gate |
| Spacing and density | Responsive CSS and semantic components are covered by DOM/component tests | Compare gutters, card rhythm, and controls against the concepts | Pending browser gate |
| Status semantics | Tests assert text labels and decision severity; semantics do not rely only on color | Inspect visual consistency of critical/warning/monitor/stable states | Pending browser gate |
| Responsive behavior | Mobile E2E asserts exact 390 px client/scroll width after each wizard step | Run it in Chromium and inspect both mobile reference sizes for overlap and tap-target usability | Pending browser gate |
| Core interaction | Browser scenarios exercise case creation, two timepoints, export/download, handoff, HA fail-closed behavior, skip-link activation, cold deep links, offline navigation, and service-worker update persistence | Execute all 16 cases and inspect screenshots/traces | Pending CI/production gate |

Release rule: Task 14 first pushes the feature branch, not `main`. Non-production CI must pass `npm run verify` and upload `fidelity-screenshots-<commit SHA>` with all three native-size captures. A reviewer must download and inspect the desktop image plus both mobile images against the two approved concepts. Only that reviewed commit may then be integrated and pushed to `main`, which triggers a fresh gated Pages verification/deployment. Task 14 must not claim visual, responsive, keyboard, offline, service-worker-update, or end-to-end clinical-flow verification before these checks. Any material mismatch requires a focused regression, another feature-branch CI run, and normal follow-up commit before release.
