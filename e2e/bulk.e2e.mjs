// Row selection and bulk deletion.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
// Customers are soft-deleted: count the records that are not.
const count = () => db.prepare('select count(*) c from customers where deleted_at is null').get().c;
const insert = db.prepare("insert into customers (name, email, created_at, updated_at) values (?, ?, datetime('now'), datetime('now'))");
for (const i of [1, 2, 3]) insert.run(`Navette Bulk ${i}`, `navette.test.bulk${i}@example.test`);
const initial = count();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter();
const indicator = page.locator('.nv-ta-selection-indicator');
const selectAll = indicator.getByRole('button', { name: /^Select all/ });
const deselectAll = indicator.getByRole('button', { name: 'Deselect all' });
const openBulkDelete = async () => {
    await page.locator('.nv-ta-header-toolbar .nv-ta-actions .nv-dropdown-trigger button').last().click();
    await page.locator('.nv-dropdown-list-item', { hasText: 'Delete selected' }).click();
    const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    return modal;
};

await login(page, BASE, user);
await page.goto(`${BASE}/shop/customers`);

await step('no selection: selection indicator and bulk menu hidden', async () => {
    assert.equal(await indicator.isVisible(), false);
    assert.equal(await page.locator('.nv-ta-header-toolbar .nv-ta-actions > .nv-dropdown').isVisible(), false);
});
await step('selecting a row then the page updates the counter', async () => {
    await page.locator('.nv-ta-record-checkbox').first().check();
    await indicator.getByText('1 record selected').waitFor({ timeout: 3000 });
    await page.locator('thead .nv-ta-page-checkbox').last().check();
    await indicator.getByText('10 records selected').waitFor({ timeout: 3000 });
});
await step('"Select all" selects everything, "Deselect all" clears the selection', async () => {
    await selectAll.click();
    await indicator.getByText(`${initial.toLocaleString('en-US')} records selected`).waitFor({ timeout: 3000 });
    await deselectAll.click();
    await indicator.waitFor({ state: 'hidden', timeout: 3000 });
});
await step('cancelling the bulk modal deletes nothing', async () => {
    await page.locator('.nv-ta-record-checkbox').first().check();
    const modal = await openBulkDelete();
    assert.equal((await modal.locator('.nv-modal-heading').innerText()).trim(), 'Delete selected Customers');
    await modal.locator('.nv-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    assert.equal(count(), initial);
    await deselectAll.click();
    await indicator.waitFor({ state: 'hidden', timeout: 3000 });
});
await step('search "Navette Bulk", tick 2 rows, bulk delete: exactly 2 records deleted', async () => {
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill('Navette Bulk');
    await page.locator('.nv-pagination-overview', { hasText: 'Showing 1 to 3 of 3 results' }).waitFor({ timeout: 5000 });
    await page.locator('.nv-ta-record-checkbox').nth(0).check();
    await page.locator('.nv-ta-record-checkbox').nth(1).check();
    await indicator.getByText('2 records selected').waitFor({ timeout: 3000 });
    const modal = await openBulkDelete();
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    await page.locator('.nv-no-notification-title', { hasText: 'Deleted' }).waitFor({ timeout: 5000 });
    await page.locator('.nv-pagination-overview', { hasText: 'Showing 1 result' }).waitFor({ timeout: 5000 });
    await indicator.waitFor({ state: 'hidden', timeout: 3000 });
    assert.equal(count(), initial - 2);
});
await step('deleting the last filtered result touches no other record', async () => {
    await page.locator('.nv-ta-record-checkbox').first().check();
    await indicator.getByText('1 record selected').waitFor({ timeout: 3000 });
    const modal = await openBulkDelete();
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    await page.locator('.nv-ta-records tr').first().waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(count(), initial - 3);
    assert.equal(db.prepare("select count(*) c from customers where name like 'Navette Bulk%' and deleted_at is null").get().c, 0);
});
await browser.close();
db.close();
process.exit(exitCode(errors));
