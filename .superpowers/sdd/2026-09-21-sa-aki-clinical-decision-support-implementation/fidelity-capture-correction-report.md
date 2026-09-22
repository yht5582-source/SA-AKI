# Fidelity capture correction report

Status: **IMPLEMENTED — release remains blocked pending corrected CI capture and manual review.**

## Finding

GitHub Actions CI run `35701472321` completed its functional gate and produced the three required fidelity files. Manual inspection confirmed that the two mobile assessment images, 390 × 844 and 430 × 764, are usable. The desktop 1586 × 992 image, however, navigated a newly created case with zero snapshots. The dashboard therefore displayed `尚無時間點；請先新增評估。`, not the required three-column command-center comparison. It is invalid visual-release evidence despite the green functional run.

## Correction

`e2e/fidelity.spec.ts` now:

1. Sets the 1586 × 992 desktop viewport, imports the existing validated `DEMO-001` export, and opens `決策首頁 DEMO-001`.
2. Explicitly asserts the semantic command-center review surfaces before capture: the `目前輸入` heading, `目前判斷` region, and `0–72 小時病程` region.
3. Preserves `desktop-command-center-1586x992.png` unchanged.
4. Returns to the case list, creates a separate anonymous case, opens its assessment wizard, and retains `mobile-assessment-390x844.png` and `mobile-assessment-430x764.png` unchanged.

No production code, browser configuration, screenshot artifact contract, or assertion was weakened.

## Documentation and release status

`docs/design/fidelity-ledger.md` now records the green functional CI result, the successful manual inspection of both mobile captures, and the precise invalid-desktop condition. The ledger remains blocked until a new CI run captures the populated desktop dashboard and a reviewer checks all three native-size images against the approved concepts.

## Verification

Requested commands were run after the correction:

- `npm run typecheck`: PASS.
- `npm run test:typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test -- --run`: PASS, 25 files / 925 tests.
- `npm run build`: PASS, 116 precache entries.
- `npm run test:delivery`: PASS, 10/10.
- `npm run test:e2e -- --list`: PASS, 16 tests collected.
- `npm run test:e2e -- e2e/fidelity.spec.ts --project=desktop-chromium`: BLOCKED before application execution. Playwright reports that `/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` does not exist.

The targeted browser command did not reach the corrected locators, screenshot assertion, or application runtime. No browser result is represented as a pass without the required executable.

## Remaining concern

The next feature-branch CI run must produce and retain the corrected desktop artifact. A reviewer must inspect that desktop image along with both mobile images before release or integration to `main`.
