// Runs the first `ts` block of the installation page on a throwaway database, then checks the sign-in page and the dashboard.
// Usage : node apps/docs/examples/check-installation.mjs
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = readFileSync(path.join(here, '../content/01-getting-started/02-installation.md'), 'utf8');
const code = /```ts\n([\s\S]*?)```/.exec(page)[1].replace('app.listen(3000', 'app.listen(3312');
// Written next to the examples so that it resolves the repository's @navette-js/* packages; the database goes to a temporary directory.
const dir = mkdtempSync(path.join(tmpdir(), 'navette-install-'));
const file = path.join(here, '_installation.ts');
writeFileSync(file, code);
const KEY = 'install-check-key';
const server = spawn(process.execPath, [file], { cwd: dir, env: { ...process.env, APP_KEY: KEY, ADMIN_PASSWORD: 'install-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
const value = Buffer.from(JSON.stringify({ uid: 1 })).toString('base64url');
const cookie = `navette_admin_session=${value}.${createHmac('sha256', KEY).update(value).digest('base64url')}`;
const failures = [];
try {
    for (let i = 0; ; i++) {
        if (i > 80) throw new Error('the server does not answer\n' + log);
        try { if ((await fetch('http://127.0.0.1:3312/login')).ok) break; } catch {}
        await new Promise((r) => setTimeout(r, 250));
    }
    const home = await fetch('http://127.0.0.1:3312/', { headers: { cookie }, redirect: 'manual' });
    if (home.status !== 200) failures.push(`/: status ${home.status}`);
    if (!(await home.text()).includes('Dashboard')) failures.push('/: no dashboard');
} finally {
    server.kill();
    await new Promise((r) => server.on('exit', r));
    rmSync(file, { force: true });
    rmSync(dir, { recursive: true, force: true });
}
if (/Error/.test(log)) failures.push(log.split('\n').filter((l) => /Error/.test(l)).slice(0, 5).join('\n'));
console.log(failures.length ? `✖ installation:\n - ${failures.join('\n - ')}` : '✔ installation: the example starts, sign-in and dashboard work');
process.exitCode = failures.length ? 1 : 0;
