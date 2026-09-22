# CI E2E diagnostics report

## Scope

This report records the investigation of GitHub CI run `35697996224` and the deliberately narrow test-support changes made on `feature/sa-aki-app`.

## Root-cause evidence

Eight of the ten Playwright failures stopped in `e2e/support/flow.ts` during anonymous-case creation. The failing locator was the semantic assertion that the form had zero `textbox` roles. Playwright reported three matches: the required `datetime-local` controls. Those controls are not identifying fields. The immediately following assertion queries the prohibited labels directly (`姓名|病歷號|出生日期|電話|地址`) and is the relevant privacy contract. The broad zero-textbox assertion was therefore invalid and was removed; the direct prohibited-label assertion remains unchanged.

The other two failures (desktop and mobile) were the byte-changed service-worker update scenario in `e2e/offline.spec.ts`. Its automatic `consoleHealth` assertion reported only a generic 404 message because it retained `ConsoleMessage.text()` and discarded `ConsoleMessage.location()`. The exact 404 resource is not yet known, so this change does not suppress, whitelist, retry, or otherwise alter 404 handling or production behavior.

## Change

`consoleHealth` now records warning/error diagnostics as:

```
[console.<type>] <message text> (<exact URL>:<line>:<column>)
```

This retains the original message while making the next CI failure identify the requesting resource and its browser source coordinates. A focused Vitest test was written first and failed with `TypeError: formatConsoleDiagnostic is not a function`; it then passed after the formatter was added. The test uses a hand-specified console-message boundary because no browser is required to verify the formatting contract.

## Verification

- Focused formatter test: passed (1/1) after its observed RED failure.
- `npm run test:typecheck`, `npm run typecheck`, and `npm run lint`: passed.
- `npm test -- --run`: passed, 25 files and 924 tests.
- `npm run build`: passed.
- `npm run test:delivery`: passed, 9/9.
- `npm run test:e2e -- --list`: collected 16 Playwright tests.
- A targeted browser attempt for the service-worker update test could not execute because Playwright Chromium is absent: `/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`. It failed before browser launch, so the service-worker flow and 404 diagnostic were not locally observed.

## Commit

Implementation commit: `80e375917f19db6e1216bfc3d2c8edd4a5b82c70` (`test: diagnose E2E console failures`).

## Remaining concern

The source of the service-worker-update 404 remains intentionally unresolved pending a browser-enabled CI run. That run should now include the exact URL and line/column in `consoleHealth` output; investigate that evidence before making any production or 404-handling change.
