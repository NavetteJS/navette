// Customers list: the "trashed" filter, soft deletion and the column manager.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const live = () => db.prepare('select count(*) c from customers where deleted_at is null').get().c;
const insert = db.prepare("insert into customers (name, email, created_at, updated_at, deleted_at) values (?, ?, datetime('now'), datetime('now'), ?)");
insert.run('Navette Trashed', 'navette.test.trashed@example.test', '2026-01-01 00:00:00');
const kept = insert.run('Navette Kept', 'navette.test.kept@example.test', null).lastInsertRowid;
const liveCount = live();
// Other specs may have left deleted customers in the test database: expectations are computed from its actual state.
const trashedCount = db.prepare('select count(*) c from customers where deleted_at is not null').get().c;
const shown = (n) => (n === 1 ? 'Showing 1 result' : `of ${n.toLocaleString('en-US')} results`);
const fmt = (n) => n.toLocaleString('en-US');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter();
const overview = page.locator('.fi-pagination-overview');
const filters = page.locator('.fi-ta-filters');
const badge = page.locator('.fi-ta-filters-dropdown .fi-icon-btn-badge-ctn');
// The pause lets the dropdown transition and the re-render finish.
const openFilters = async () => { await page.waitForTimeout(500); if (!(await filters.isVisible())) await page.locator('.fi-ta-filters-dropdown .fi-dropdown-trigger button').click(); await filters.waitFor({ state: 'visible', timeout: 3000 }); };
const applyTrashed = async (label) => { await openFilters(); await filters.locator('select').selectOption({ label }); await page.waitForTimeout(200); await filters.locator('button', { hasText: 'Apply filters' }).click(); };

await login(page, BASE, user);
await page.goto(`${BASE}/shop/customers`);

await step('by default: deleted customers are not listed, filter badge at 0', async () => {
    await overview.getByText(`of ${fmt(liveCount)} results`).waitFor({ timeout: 10000 });
    assert.equal((await badge.innerText()).trim(), '0');
});
await step('choosing a filter without applying it leaves the list unchanged (deferred filters)', async () => {
    await openFilters();
    await filters.locator('select').selectOption({ label: 'Only deleted records' });
    await page.waitForTimeout(800);
    assert.match(await overview.innerText(), new RegExp(`of ${fmt(liveCount)} results`));
});
await step('"Only deleted records" applied: only deleted customers, badge at 1', async () => {
    await applyTrashed('Only deleted records');
    await overview.getByText(shown(trashedCount)).waitFor({ timeout: 10000 });
    assert.ok((await page.locator('.fi-ta-cell-name .fi-ta-text').allInnerTexts()).map((x) => x.trim()).includes('Navette Trashed'));
    assert.equal((await badge.innerText()).trim(), '1');
});
await step('"With deleted records": the default list plus deleted customers', async () => {
    await applyTrashed('With deleted records');
    await overview.getByText(`of ${fmt(liveCount + trashedCount)} results`).waitFor({ timeout: 10000 });
});
await step('"Reset": back to the default list, badge at 0', async () => {
    await openFilters();
    await filters.locator('button', { hasText: 'Reset' }).click();
    await overview.getByText(`of ${fmt(liveCount)} results`).waitFor({ timeout: 10000 });
    assert.equal((await badge.innerText()).trim(), '0');
    await page.keyboard.press('Escape');
});
await step('column manager: hide "Phone" then "Apply columns"', async () => {
    await page.locator('.fi-ta-col-manager-dropdown .fi-dropdown-trigger button').click();
    const manager = page.locator('.fi-ta-col-manager');
    await manager.waitFor({ state: 'visible', timeout: 3000 });
    assert.equal(await manager.locator('label', { hasText: 'Name' }).locator('input').isDisabled(), true);
    await manager.locator('label', { hasText: 'Phone' }).locator('input').uncheck();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('th.fi-ta-header-cell-phone').count(), 1);
    await manager.locator('button', { hasText: 'Apply columns' }).click();
    await page.locator('th.fi-ta-header-cell-phone').waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await page.locator('th.fi-ta-header-cell-country').count(), 1);
    assert.equal(await page.locator('td.fi-ta-cell-phone').count(), 0);
});
await step('column manager: "Reset" brings the column back', async () => {
    const manager = page.locator('.fi-ta-col-manager');
    // "Apply columns" re-renders the table: let the dropdown settle before checking whether it is open.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    if (!(await manager.isVisible())) {
        await page.locator('.fi-ta-col-manager-dropdown .fi-dropdown-trigger button').click();
        await manager.waitFor({ state: 'visible', timeout: 3000 });
    }
    await manager.locator('button', { hasText: 'Reset' }).click();
    await page.locator('th.fi-ta-header-cell-phone').waitFor({ state: 'attached', timeout: 5000 });
});
await step('deleting from the edit page is a soft delete (the record stays in the database, timestamped)', async () => {
    await page.goto(`${BASE}/shop/customers/${kept}/edit`);
    await page.locator('.fi-header-actions-ctn button', { hasText: 'Delete' }).click();
    await page.locator('.fi-modal-window .fi-modal-footer button[type=submit]').click();
    await page.waitForURL('**/shop/customers');
    const row = db.prepare('select deleted_at from customers where id = ?').get(kept);
    assert.ok(row && row.deleted_at, 'deleted_at must be set');
    assert.equal(live(), liveCount - 1);
});
await browser.close();
db.close();
process.exit(exitCode(errors));
