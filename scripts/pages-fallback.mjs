import { copyFile } from 'node:fs/promises';

// GitHub Pages serves 404.html for a cold BrowserRouter deep link. Absolute
// /SA-AKI/ asset URLs boot the same app without redirects or query rewriting.
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
