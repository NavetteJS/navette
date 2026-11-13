// Serves the built site (dist/). Usage: node server.ts   (DOCS_PORT, 3300 by default)
// With DOCS_BASE=/navette (the same value as for the build), the site is served under that sub-path, as on GitHub Pages.
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = process.env.DOCS_OUT ? path.resolve(process.env.DOCS_OUT) : path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const base = (process.env.DOCS_BASE ?? '').replace(/\/$/, '');
if (!existsSync(path.join(dist, 'index.html'))) throw new Error('No site to serve: run `node build.ts` first.');
const site = express.Router();
// Serve `/forms/select` from `dist/forms/select/index.html` without redirecting to `/forms/select/`.
site.use((req, res, next) => {
    if (req.method !== 'GET' || path.extname(req.path)) return next();
    const file = path.join(dist, ...req.path.split('/').filter((part) => part && part !== '..'), 'index.html');
    if (!file.startsWith(dist) || !existsSync(file)) return next();
    res.sendFile(file);
});
site.use(express.static(dist, { redirect: false }));
const app = express();
app.use(base || '/', site);
app.use((_req, res) => res.status(404).sendFile(path.join(dist, '404.html')));
const port = Number(process.env.DOCS_PORT ?? 3300);
app.listen(port, '127.0.0.1', () => console.log(`Navette docs : http://127.0.0.1:${port}${base}/`));
