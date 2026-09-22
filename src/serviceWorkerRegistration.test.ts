import { describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from './serviceWorkerRegistration';

describe('registerServiceWorker', () => {
  it('defers registration until window load so modulepreload resources can finish', () => {
    const registerSW = vi.fn();

    registerServiceWorker(registerSW);

    expect(registerSW).toHaveBeenCalledWith({ immediate: false });
  });
});
