// Serves the built site (dist/). Usage: node server.ts   (DOCS_PORT, 3300 by default)
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
if (!existsSync(path.join(dist, 'index.html'))) throw new Error('No site to serve: run `node build.ts` first.');
const app = express();
// Serve `/forms/select` from `dist/forms/select/index.html` without redirecting to `/forms/select/`.
app.use((req, res, next) => {
    if (req.method !== 'GET' || path.extname(req.path)) return next();
    const file = path.join(dist, ...req.path.split('/').filter((part) => part && part !== '..'), 'index.html');
    if (!file.startsWith(dist) || !existsSync(file)) return next();
    res.sendFile(file);
});
app.use(express.static(dist, { redirect: false }));
app.use((_req, res) => res.status(404).sendFile(path.join(dist, '404.html')));
const port = Number(process.env.DOCS_PORT ?? 3300);
app.listen(port, '127.0.0.1', () => console.log(`Navette docs : http://127.0.0.1:${port}/`));
