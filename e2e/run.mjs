// Runs the end-to-end specs in a real browser against a throwaway instance of the demo app.
// The demo starts on a COPY of apps/demo/database/seed.sqlite: specs create and delete records and must never touch the seed.
// Usage: node e2e/run.mjs [spec…]   (default: every e2e/*.e2e.mjs; a spec can be given as `brands`, `brands.e2e.mjs` or a path)
// Environment: E2E_PORT (default 3399), NAVETTE_STORAGE (folder of the seeded product images; steps that need them are skipped without it).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PORT = Number(process.env.E2E_PORT ?? 3399);
const base = `http://127.0.0.1:${PORT}`;

const available = fs.readdirSync(here).filter((f) => f.endsWith('.e2e.mjs')).sort();
const requested = process.argv.slice(2).map((arg) => {
    const name = path.basename(arg).replace(/(\.e2e)?\.mjs$/, '') + '.e2e.mjs';
    if (!available.includes(name)) {
        console.error(`Unknown spec: ${arg}. Available: ${available.map((f) => f.replace('.e2e.mjs', '')).join(', ')}`);
        process.exit(2);
    }
    return name;
});
const specs = requested.length ? requested : available;

// Disposable state: a fresh copy of the seed database and an empty uploads folder, both git-ignored (one folder per port).
const tmp = path.join(here, '.tmp', String(PORT));
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const db = path.join(tmp, 'e2e.sqlite');
fs.copyFileSync(path.join(root, 'apps/demo/database/seed.sqlite'), db);
const uploads = path.join(tmp, 'uploads');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// A previous instance may still be shutting down: without this wait it would answer in place of the new one.
const portIsFree = async () => {
    try {
        await fetch(`${base}/login`, { signal: AbortSignal.timeout(500) });
        return false;
    } catch {
        return true;
    }
};
for (let i = 0; !(await portIsFree()); i++) {
    if (i > 40) {
        console.error(`Port ${PORT} is in use. Stop the process using it or set E2E_PORT.`);
        process.exit(1);
    }
    await sleep(250);
}

const server = spawn(process.execPath, ['apps/demo/server.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), NAVETTE_DB: db, NAVETTE_UPLOADS: uploads },
    stdio: ['ignore', 'pipe', 'pipe'],
});
const stopped = new Promise((resolve) => server.on('exit', resolve));
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stop = () => server.exitCode === null && server.kill();
process.on('SIGINT', () => { stop(); process.exit(130); });

const summary = [];
try {
    for (let i = 0; ; i++) {
        if (server.exitCode !== null || i > 120) throw new Error('The demo server did not start.\n' + serverLog);
        try {
            if ((await fetch(`${base}/login`)).ok) break;
        } catch {}
        await sleep(250);
    }
    for (const spec of specs) {
        console.log(`\n=== ${spec}`);
        const counts = { spec, passed: 0, failed: 0, skipped: 0, failures: [], code: 0 };
        const child = spawn(process.execPath, [path.join(here, spec), base, path.join(root, 'apps/demo/fixtures/users.json'), db], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
        let pending = '';
        const count = (line) => {
            if (line.startsWith('✔ ')) counts.passed++;
            else if (line.startsWith('✖ ')) { counts.failed++; counts.failures.push(line); }
            else if (line.startsWith('○ ')) counts.skipped++;
        };
        child.stdout.on('data', (chunk) => {
            process.stdout.write(chunk);
            pending += chunk;
            const lines = pending.split('\n');
            pending = lines.pop();
            lines.forEach((line) => count(line.trimEnd()));
        });
        counts.code = await new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
        count(pending.trimEnd());
        summary.push(counts);
    }
} finally {
    stop();
    await stopped;
}

const errors = serverLog.split('\n').filter((l) => /Error|\[wire\] 5/.test(l));
if (errors.length) console.log('\nServer errors:\n' + errors.slice(0, 10).join('\n'));

const total = (key) => summary.reduce((n, s) => n + s[key], 0);
console.log('\n=== Summary');
for (const s of summary) {
    const status = s.code === 0 ? 'ok  ' : 'FAIL';
    console.log(`${status} ${s.spec.padEnd(26)} ${String(s.passed).padStart(3)} passed  ${String(s.failed).padStart(2)} failed  ${String(s.skipped).padStart(2)} skipped${s.code !== 0 && !s.failed ? `  (exit code ${s.code})` : ''}`);
}
console.log(`\n${total('passed')} passed, ${total('failed')} failed, ${total('skipped')} skipped, ${summary.length} spec(s)`);
const failing = summary.filter((s) => s.code !== 0);
if (failing.length) {
    console.log('\nFailures:');
    for (const s of failing) {
        console.log(`  ${s.spec}`);
        for (const f of s.failures) console.log(`    ${f}`);
        if (!s.failures.length) console.log(`    exited with code ${s.code}`);
    }
}
process.exit(failing.length ? 1 : 0);
