import { describe, expect, it } from 'vitest';
import { formatConsoleDiagnostic } from '../../e2e/support/flow';

describe('formatConsoleDiagnostic', () => {
  it('records console severity, the exact resource URL, and source coordinates', () => {
    const diagnostic = formatConsoleDiagnostic({
      type: () => 'error',
      text: () => 'Failed to load resource: the server responded with a status of 404',
      location: () => ({ url: 'http://127.0.0.1:4173/SA-AKI/missing.js', lineNumber: 0, columnNumber: 0 }),
    });

    expect(diagnostic).toBe(
      '[console.error] Failed to load resource: the server responded with a status of 404 (http://127.0.0.1:4173/SA-AKI/missing.js:0:0)',
    );
  });
});
