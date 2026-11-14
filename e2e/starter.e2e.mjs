// The starter app (apps/starter): what the getting-started guide builds must work.
// Starts its own instance on a throwaway database, on the port after the demo's (or E2E_STARTER_PORT).
// Run by e2e/run.mjs.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { reporter, specArgs } from './support.mjs';

const { base: demoBase, tmpDir } = specArgs();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_STARTER_PORT ?? Number(new URL(demoBase).port) + 1);
const db = path.join(tmpDir, 'starter.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(db + suffix, { force: true });
const PASSWORD = 'starter-test-password';
const READER_PASSWORD = 'starter-test-reader';
const server = spawn(process.execPath, ['apps/starter/server.ts'], { cwd: root, env: { ...process.env, PORT: String(PORT), STARTER_DB: db, ADMIN_PASSWORD: PASSWORD, READER_PASSWORD }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
const stopped = new Promise((resolve) => server.on('exit', resolve));
const BASE = `http://127.0.0.1:${PORT}`;
const { step: report, fail, exitCode } = reporter({ errorLines: 3 });
let browser;
try {
    for (let i = 0; ; i++) { if (server.exitCode !== null || i > 80) throw new Error('the starter server does not respond\n' + log); try { await fetch(`${BASE}/login`); break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    // The forged calls of the last steps make Livewire open its error dialog: that noise is expected.
    page.on('pageerror', (e) => { if (!/showModal/.test(String(e))) errors.push(String(e)); });
    const step = report;
    const rows = page.locator('.nv-ta-records tr.nv-ta-row');

    await step('wrong password refused, right password accepted', async () => {
        await page.goto(`${BASE}/login`);
        await page.locator('input[type=email]').fill('admin@example.test');
        await page.locator('input[type=password]').fill('wrong');
        await page.locator('button[type=submit]').click();
        await page.locator('.nv-fo-field-wrp-error-message').first().waitFor({ timeout: 8000 });
        await page.locator('input[type=password]').fill(PASSWORD);
        await page.locator('button[type=submit]').click();
        await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 8000 });
    });
    await step('dashboard: the panel widget', async () => {
        await page.goto(`${BASE}/`);
        await page.locator('.nv-wi-stats-overview-stat-value').first().waitFor({ timeout: 10000 });
        assert.deepEqual((await page.locator('.nv-wi-stats-overview-stat-value').allInnerTexts()).map((x) => x.trim()), ['2', '3']);
        assert.equal((await page.locator('h1.nv-header-heading').innerText()).trim(), 'Hello');
    });
    await step('custom page: read-only entry and raw markup', async () => {
        await page.goto(`${BASE}/status`);
        assert.equal((await page.locator('.nv-in-entry-content').first().innerText()).trim(), '3');
        assert.match(await page.locator('.nv-status-note').innerText(), /^Node v[0-9]+/);
    });
    await step('list: three tasks, stats, "To do" tab', async () => {
        await page.goto(`${BASE}/tasks`);
        await page.locator('.nv-wi-stats-overview-stat-value').first().waitFor({ timeout: 10000 });
        assert.equal(await rows.count(), 3);
        assert.deepEqual((await page.locator('.nv-wi-stats-overview-stat-value').allInnerTexts()).map((x) => x.trim()), ['3', '2']);
        await page.locator('.nv-sc-tabs .nv-tabs-item', { hasText: 'To do' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.nv-ta-records tr.nv-ta-row').length === 2, null, { timeout: 8000 });
    });
    await step('"Complete" row action', async () => {
        await rows.first().locator('button.nv-ac-link-action', { hasText: 'Complete' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.nv-ta-records tr.nv-ta-row').length === 1, null, { timeout: 8000 });
    });
    await step('create then edit a task', async () => {
        await page.goto(`${BASE}/tasks/create`);
        await page.locator('[id="form.title"]').fill('Task created by the test');
        await page.locator('[id="form.priority"]').selectOption('high');
        // Global setting (configureUsing) and custom field.
        assert.equal(await page.locator('[id="form.title"]').getAttribute('maxlength'), '255');
        await page.locator('[id="form.effort"]').fill('4');
        await page.locator('.nv-sc-form button[type=submit]').first().click();
        await page.waitForURL(/\/tasks\/\d+\/edit/, { timeout: 10000 });
        assert.equal(await page.locator('[id="form.title"]').inputValue(), 'Task created by the test');
        await page.goto(`${BASE}/tasks`);
        await page.locator('.nv-ta-search-field input').fill('created by the');
        await page.waitForFunction(() => document.querySelectorAll('.nv-ta-records tr.nv-ta-row').length === 1, null, { timeout: 8000 });
        assert.match(await rows.first().innerText(), /High/);
        // Custom column, create hook (author set by the server), plugin (footer through a render hook).
        assert.equal((await rows.first().locator('.app-effort-cell').innerText()).trim(), '●●●●○');
        assert.match(await rows.first().innerText(), /admin@example\.test/);
        assert.match(await page.locator('.app-footer').innerText(), /powered by Navette/);
    });
    await step('without a session, the list redirects to the login page', async () => {
        const context = await browser.newContext();
        const anonymous = await context.newPage();
        await anonymous.goto(`${BASE}/tasks`);
        assert.match(anonymous.url(), /\/login$/);
        await context.close();
    });
    // --- permissions: a read-only account
    const readerContext = await browser.newContext();
    const reader = await readerContext.newPage();
    await step('reader: sees the list, without create, edit nor restricted page in the interface', async () => {
        await reader.goto(`${BASE}/login`);
        await reader.locator('input[type=email]').fill('reader@example.test');
        await reader.locator('input[type=password]').fill(READER_PASSWORD);
        await reader.locator('button[type=submit]').click();
        await reader.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 8000 });
        await reader.goto(`${BASE}/tasks`);
        await reader.locator('.nv-ta-records tr.nv-ta-row').first().waitFor({ timeout: 10000 });
        assert.equal(await reader.locator('.nv-header-actions-ctn a').count(), 0, 'create button');
        assert.equal(await reader.locator('.nv-ta-records .nv-ac-link-action').count(), 0, 'row actions');
        assert.equal(await reader.locator('.nv-ta-record-checkbox').count(), 0, 'checkboxes');
        assert.equal(await reader.locator('.nv-sidebar-item', { hasText: 'Status' }).count(), 0, 'restricted page in the menu');
        assert.ok(await reader.locator('.nv-sidebar-item', { hasText: 'Tasks' }).count());
    });
    await step('reader: direct URLs refused (403)', async () => {
        for (const url of ['/tasks/create', '/tasks/1/edit', '/status']) assert.equal((await reader.request.get(BASE + url)).status(), 403, url);
    });
    await step('custom field: a forged out-of-range value is refused by the server', async () => {
        await page.goto(`${BASE}/tasks/1/edit`);
        await page.locator('[id="form.effort"]').waitFor({ timeout: 10000 });
        await page.evaluate(async () => { const wire = window.Livewire.all().find((c) => c.el.querySelector('.nv-sc-form')).$wire; await wire.$set('data.effort', 99); });
        await page.locator('.nv-sc-form button[type=submit]').first().click();
        await page.locator('.nv-fo-field-wrp-error-message', { hasText: 'between 1 and 5' }).waitFor({ timeout: 8000 });
    });
    await step('reader: forged actions refused, nothing is changed', async () => {
        await reader.goto(`${BASE}/tasks`);
        await reader.locator('.nv-ta-records tr.nv-ta-row').first().waitFor({ timeout: 10000 });
        const outcomes = await reader.evaluate(async () => {
            const wire = window.Livewire.all().find((c) => c.el.querySelector('.nv-ta')).$wire;
            const attempt = async (fn) => { try { await fn(); return 'accepted'; } catch { return 'refused'; } };
            return [
                await attempt(() => wire.mountAction('toggle_done', {}, { table: true, recordKey: '2' })),
                await attempt(async () => { await wire.$set('selectedTableRecords', ['1', '2', '3']); await wire.mountAction('delete', {}, { table: true, bulk: true }); await wire.callMountedAction(); }),
            ];
        });
        assert.deepEqual(outcomes, ['refused', 'refused']);
        await reader.goto(`${BASE}/tasks`);
        await reader.locator('.nv-ta-records tr.nv-ta-row').first().waitFor({ timeout: 10000 });
        assert.equal(await reader.locator('.nv-ta-records tr.nv-ta-row').count(), 4);
    });
    await readerContext.close();
    await step('internal methods cannot be called from the browser', async () => {
        await page.goto(`${BASE}/tasks/1/edit`);
        await page.locator('[id="form.title"]').waitFor({ timeout: 10000 });
        const outcomes = await page.evaluate(async () => {
            const wire = window.Livewire.all().find((c) => c.el.querySelector('.nv-sc-form')).$wire;
            const out = {};
            for (const method of ['getRecord', 'getDataAdapter', 'getHeaderActions', 'validateForm', 'hydrate', 'boot']) { try { await wire.call(method); out[method] = 'accepted'; } catch { out[method] = 'refused'; } }
            return out;
        });
        assert.deepEqual([...new Set(Object.values(outcomes))], ['refused'], JSON.stringify(outcomes));
    });
    if (errors.length) fail('JavaScript errors: ' + errors.slice(0, 3).join(' | '));
} catch (e) {
    fail(String(e?.message ?? e).split('\n').slice(0, 6).join(' | '));
} finally {
    await browser?.close();
    server.kill();
    await stopped;
}
if (/Error/.test(log)) console.log(log.split('\n').filter((l) => /Error|    at /.test(l)).slice(0, 8).join('\n'));
process.exit(exitCode());
