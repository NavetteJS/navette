// Customers: empty table state, restore and force delete.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const insert = db.prepare("insert into customers (name, email, created_at, updated_at, deleted_at) values (?, ?, datetime('now', '-3 days'), datetime('now', '-2 hours'), ?)");
const trashed = insert.run('Navette Binned', 'navette.test.binned@example.test', '2026-01-01 00:00:00').lastInsertRowid;
const alive = insert.run('Navette Alive', 'navette.test.alive@example.test', null).lastInsertRowid;
const row = (id) => db.prepare('select id, deleted_at from customers where id = ?').get(id);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter();
const headerActions = () => page.locator('.nv-header-actions-ctn button').allInnerTexts().then((l) => l.map((x) => x.trim()));
const confirm = async (label) => {
    await page.locator('.nv-header-actions-ctn button', { hasText: label }).click();
    const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    const heading = (await modal.locator('.nv-modal-heading').innerText()).trim();
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    return heading;
};

await login(page, BASE, user);

await step('search without results: "No customers" empty state, no pagination nor checkboxes', async () => {
    await page.goto(`${BASE}/shop/customers`);
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill('zzzzzzzz-no-result');
    const empty = page.locator('.nv-ta-empty-state');
    await empty.waitFor({ timeout: 5000 });
    assert.equal((await empty.locator('.nv-ta-empty-state-heading').innerText()).trim(), 'No customers');
    assert.equal(await page.locator('.nv-pagination').count(), 0);
    assert.equal(await page.locator('.nv-ta-page-checkbox:visible').count(), 0);
    assert.equal(await page.locator('.nv-ta-individual-search-row input').count(), 2);
});
await step('clearing the search brings the table back', async () => {
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill('');
    await page.locator('.nv-pagination-overview').waitFor({ timeout: 5000 });
    assert.equal(await page.locator('.nv-ta-records tr').count(), 10);
});
await step('editing a live customer: "Created at / Last modified at" section, only the "Delete" action', async () => {
    await page.goto(`${BASE}/shop/customers/${alive}/edit`);
    const entries = await page.locator('.nv-in-entry').allInnerTexts();
    assert.deepEqual(entries.map((x) => x.replace(/\s+/g, ' ').trim()), ['Created at 3 days ago', 'Last modified at 2 hours ago']);
    assert.deepEqual(await headerActions(), ['Send email', 'Delete']);
});
await step('editing a deleted customer: "Restore" and "Force delete" actions, no "Delete"', async () => {
    await page.goto(`${BASE}/shop/customers/${trashed}/edit`);
    assert.deepEqual(await headerActions(), ['Send email', 'Restore', 'Force delete']);
});
await step('a forged call cannot force-delete a live customer (403)', async () => {
    await page.goto(`${BASE}/shop/customers/${alive}/edit`);
    const status = await page.evaluate(async () => {
        const component = Livewire.all().find((c) => c.name.includes('edit'));
        const response = await fetch('/livewire/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _token: document.querySelector('[data-csrf]').dataset.csrf, components: [{ snapshot: component.snapshotEncoded, updates: {}, calls: [{ method: 'mountAction', params: ['forceDelete', {}, {}], metadata: {} }] }] }) });
        return response.status;
    });
    assert.equal(status, 403);
    assert.ok(row(alive), 'the live customer must still exist');
});
await step('"Restore": confirmation, "Restored" notification, the "Delete" action comes back', async () => {
    await page.goto(`${BASE}/shop/customers/${trashed}/edit`);
    assert.equal(await confirm('Restore'), 'Restore Navette Binned');
    await page.locator('.nv-no-notification-title', { hasText: 'Restored' }).waitFor({ timeout: 5000 });
    await page.locator('.nv-header-actions-ctn button', { hasText: 'Delete' }).waitFor({ timeout: 5000 });
    assert.deepEqual(await headerActions(), ['Send email', 'Delete']);
    assert.equal(row(trashed).deleted_at, null);
});
await step('"Delete" then "Force delete": the record is gone from the database', async () => {
    assert.equal(await confirm('Delete'), 'Delete Navette Binned');
    await page.waitForURL('**/shop/customers');
    assert.ok(row(trashed).deleted_at, 'soft delete expected');
    await page.goto(`${BASE}/shop/customers/${trashed}/edit`);
    assert.equal(await confirm('Force delete'), 'Force delete Navette Binned');
    await page.waitForURL('**/shop/customers');
    await page.locator('.nv-no-notification-title', { hasText: 'Deleted' }).waitFor({ timeout: 5000 });
    assert.equal(row(trashed), undefined);
});
const rowTrashed = insert.run('Navette Row Binned', 'navette.test.rowbinned@example.test', '2026-01-02 00:00:00').lastInsertRowid;
const filters = page.locator('.nv-ta-filters');
const showDeleted = async () => {
    await page.goto(`${BASE}/shop/customers`);
    await page.waitForTimeout(500);
    if (!(await filters.isVisible())) await page.locator('.nv-ta-filters-dropdown .nv-dropdown-trigger button').click();
    await filters.waitFor({ state: 'visible', timeout: 3000 });
    await filters.locator('select').selectOption({ label: 'Only deleted records' });
    await page.waitForTimeout(200);
    await filters.locator('button', { hasText: 'Apply filters' }).click();
    await page.locator('tr', { hasText: 'Navette Row Binned' }).waitFor({ timeout: 10000 });
};
const rowAction = async (label) => {
    await page.locator('tr', { hasText: 'Navette Row Binned' }).locator('.nv-ac-link-action', { hasText: label }).click();
    const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    const heading = (await modal.locator('.nv-modal-heading').innerText()).trim();
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    return heading;
};
await step('table row: "Restore" and "Force delete" only on deleted customers', async () => {
    await page.goto(`${BASE}/shop/customers`);
    assert.equal(await page.locator('.nv-ta-row .nv-ac-link-action', { hasText: 'Restore' }).count(), 0);
    await showDeleted();
    const actions = await page.locator('tr', { hasText: 'Navette Row Binned' }).locator('.nv-ac-link-action').allInnerTexts();
    assert.ok(actions.map((a) => a.trim()).includes('Restore') && actions.map((a) => a.trim()).includes('Force delete'), actions.join(', '));
});
await step('table row "Restore": confirmation, notification, the customer is back', async () => {
    assert.equal(await rowAction('Restore'), 'Restore Navette Row Binned');
    await page.locator('.nv-no-notification-title', { hasText: 'Restored' }).waitFor({ timeout: 5000 });
    assert.equal(row(rowTrashed).deleted_at, null);
});
await step('a forged row call cannot restore or force-delete a live customer', async () => {
    await page.goto(`${BASE}/shop/customers`);
    const status = await page.evaluate(async (key) => {
        const component = Livewire.all().find((c) => c.name.includes('customers') || c.el.querySelector('.nv-ta'));
        const response = await fetch('/livewire/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _token: document.querySelector('[data-csrf]').dataset.csrf, components: [{ snapshot: component.snapshotEncoded, updates: {}, calls: [{ method: 'mountAction', params: ['forceDelete', {}, { table: true, recordKey: String(key) }], metadata: {} }] }] }) });
        return response.status;
    }, rowTrashed);
    assert.equal(status, 403);
    assert.ok(row(rowTrashed), 'the live customer must still exist');
});
await step('table row "Force delete": the deleted customer is gone from the database', async () => {
    db.prepare("update customers set deleted_at = '2026-01-03 00:00:00' where id = ?").run(rowTrashed);
    await showDeleted();
    assert.equal(await rowAction('Force delete'), 'Force delete Navette Row Binned');
    await page.locator('.nv-no-notification-title', { hasText: 'Deleted' }).waitFor({ timeout: 5000 });
    assert.equal(row(rowTrashed), undefined);
});
await browser.close();
db.close();
process.exit(exitCode(errors));
