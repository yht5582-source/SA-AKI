import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { Script } from 'node:vm';

test('built app boots under the project subpath and supplies the identical shell for Pages 404s', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.ok(existsSync('dist/404.html'), 'GitHub Pages cold deep links need a built 404.html app shell');
  assert.equal(await readFile('dist/404.html', 'utf8'), html);
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  assert.ok(references.some(reference => reference.endsWith('/manifest.webmanifest')));
  for (const reference of references) {
    assert.ok(reference.startsWith('/SA-AKI/'), `build URL escapes project scope: ${reference}`);
    assert.ok(existsSync(`dist/${reference.slice('/SA-AKI/'.length)}`), `unresolvable build URL: ${reference}`);
  }
});

test('install manifest stays in /SA-AKI/ and every declared icon ships', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
  assert.deepEqual([manifest.id, manifest.scope, manifest.start_url], ['/SA-AKI/', '/SA-AKI/', '/SA-AKI/']);
  for (const icon of manifest.icons) assert.ok(existsSync(`dist/${icon.src}`));
});

test('built service worker parses as a classic script with no unresolved imports', async () => {
  const worker = await readFile('dist/sw.js', 'utf8');
  assert.doesNotThrow(() => new Script(worker));
});

test('no individual JavaScript download exceeds the 500 kB offline installation budget', async () => {
  const files = (await readdir('dist/assets')).filter(file => file.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const file of files) assert.ok((await stat(`dist/assets/${file}`)).size <= 500_000, `${file} exceeds 500 kB; split at a stable dependency boundary`);
});

test('HTML does not preload the shared Rolldown helper across service-worker response worlds', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  const modulePreloads = [...html.matchAll(/<link rel="modulepreload"[^>]+href="([^"]+)"/g)].map(match => match[1]);
  assert.ok(modulePreloads.some(reference => /\/assets\/vendor-[^/]+\.js$/.test(reference)), 'keep the substantive vendor preload');
  assert.ok(
    modulePreloads.every(reference => !/\/assets\/rolldown-runtime-[^/]+\.js$/.test(reference)),
    'the tiny shared runtime is imported immediately and its redundant preload triggers Chromium cross-world service-worker mismatch warnings',
  );
});

test('small semantic text keeps WCAG AA contrast in its actual design-token background pairs', async () => {
  const css = await readFile('src/styles/tokens.css', 'utf8');
  const colors = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*#([\da-f]{3,6})\b/gi)].map(([, name, hex]) => [name, hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex]));
  const luminance = hex => hex.match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  for (const [foreground, background] of [['surface', 'teal'], ['text', 'surface'], ['muted', 'background'], ['warning', 'warning-surface'], ['navy', 'safety']]) {
    const light = luminance(colors[foreground]), dark = luminance(colors[background]);
    const contrast = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
    assert.ok(contrast >= 4.5, `${foreground} on ${background}: ${contrast.toFixed(2)}:1 is below 4.5:1`);
  }
});
