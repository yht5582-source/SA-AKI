type ServiceWorkerRegistrar = (options: { immediate: boolean }) => unknown;

export function registerServiceWorker(registerSW: ServiceWorkerRegistrar) {
  return registerSW({ immediate: false });
}
