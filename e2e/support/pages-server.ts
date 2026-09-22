import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

/** Serve the actual build with GitHub Pages-style 404s and a byte-changed SW update. */
export async function startPagesServer() {
  const root = resolve('dist');
  let revision = 1;
  const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
    '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
  };
  const server = createServer((request, response) => {
    void (async () => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (!pathname.startsWith('/SA-AKI/')) { response.writeHead(404).end(); return; }
      const file = resolve(root, decodeURIComponent(pathname.slice('/SA-AKI/'.length)) || 'index.html');
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      response.setHeader('Cache-Control', 'no-store');
      try {
        let data = await readFile(file);
        if (pathname === '/SA-AKI/sw.js') {
          data = Buffer.concat([data, Buffer.from(`\nself.addEventListener('message', event => { if (event.data === 'e2e-version') event.ports[0].postMessage(${revision}); });\n`)]);
        }
        response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(data);
      } catch {
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(await readFile(resolve(root, '404.html')));
      }
    })().catch(() => { response.writeHead(500).end(); });
  });
  await new Promise<void>((resolveReady, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveReady); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
  return {
    url: `http://127.0.0.1:${address.port}/SA-AKI/`,
    update: () => { revision += 1; },
    close: () => new Promise<void>((resolveClosed, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolveClosed()); }),
  };
}
