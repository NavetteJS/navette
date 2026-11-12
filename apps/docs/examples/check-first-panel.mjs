// Runs the tutorial's example on a throwaway database and checks its pages, signed in as user 1 (forged session cookie).
// Usage : node apps/docs/examples/check-first-panel.mjs
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'navette-first-panel-'));
const PORT = 3311, KEY = 'tutorial-check-key';
const server = spawn(process.execPath, [path.join(here, 'first-panel.ts')], { cwd: dir, env: { ...process.env, PORT: String(PORT), APP_KEY: KEY, DATABASE_FILE: path.join(dir, 'db.sqlite'), ADMIN_PASSWORD: 'tutorial-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
const value = Buffer.from(JSON.stringify({ uid: 1 })).toString('base64url');
const cookie = `navette_admin_session=${value}.${createHmac('sha256', KEY).update(value).digest('base64url')}`;
const base = `http://127.0.0.1:${PORT}`;
const failures = [];
try {
    for (let i = 0; ; i++) {
        if (i > 80) throw new Error('the server does not answer\n' + log);
        try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
        await new Promise((r) => setTimeout(r, 250));
    }
    const get = async (route, expected) => {
        const response = await fetch(`${base}${route}`, { headers: route === '/login' ? {} : { cookie }, redirect: 'manual' });
        const html = await response.text();
        if (response.status !== 200) failures.push(`${route}: status ${response.status}`);
        for (const text of expected) if (!html.includes(text)) failures.push(`${route}: "${text}" missing`);
    };
    await get('/login', ['Sign in']);
    await get('/', ['Dashboard', 'Customers']);
    await get('/customers', ['Customers', 'Country']);
    await get('/customers/create', ['Create', 'Email']);
    const { default: Database } = await import(new URL('../../../node_modules/better-sqlite3/lib/index.js', import.meta.url).href);
    const db = new Database(path.join(dir, 'db.sqlite'));
    db.prepare("insert into customers (name, email, country) values ('Ada Lovelace', 'ada@example.com', 'fr')").run();
    db.prepare("insert into orders (customer_id, number, status) values (1, 'A-1', 'new')").run();
    db.close();
    await get('/customers', ['Ada Lovelace']);
    await get('/customers/1/edit', ['Ada Lovelace', 'Orders']);
} finally {
    server.kill();
    await new Promise((r) => server.on('exit', r));
    rmSync(dir, { recursive: true, force: true });
}
if (log.match(/Error/)) failures.push('server errors:\n' + log.split('\n').filter((l) => /Error/.test(l)).slice(0, 5).join('\n'));
console.log(failures.length ? `✖ tutorial:\n - ${failures.join('\n - ')}` : '✔ tutorial: every page answers');
process.exitCode = failures.length ? 1 : 0;
