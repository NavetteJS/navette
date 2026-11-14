// Customers: create, notifications, edit, delete.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, reporter, specArgs } from './support.mjs';

const { base: BASE, user } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter();

await login(page, BASE, user);

const email = `navette.test.e2e${Date.now()}@example.test`;
await step('list → "New customer" (navigation without a full reload)', async () => {
    await page.goto(`${BASE}/shop/customers`);
    await page.locator('.nv-header-actions-ctn a').click();
    await page.waitForURL('**/shop/customers/create');
});
await step('create → redirected to the edit page with a "Created" notification', async () => {
    await page.locator('[id="form.name"]').fill('Navette E2E');
    await page.locator('[id="form.email"]').fill(email);
    await page.locator('[id="form.birthday"]').fill('1990-05-12');
    await page.locator('.nv-btn[type=submit]').click();
    await page.waitForURL(/\/shop\/customers\/\d+\/edit$/);
    await page.locator('.nv-no-notification-title', { hasText: 'Created' }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator('.nv-header-heading').innerText(), 'Edit Navette E2E');
    assert.equal(await page.locator('[id="form.birthday"]').inputValue(), '1990-05-12');
});
await step('edit → "Saved" notification, value kept after a reload', async () => {
    await page.locator('[id="form.phone"]').fill('0102030405');
    await page.locator('.nv-btn[type=submit]').click();
    await page.locator('.nv-no-notification-title', { hasText: 'Saved' }).waitFor({ timeout: 5000 });
    await page.reload();
    assert.equal(await page.locator('[id="form.phone"]').inputValue(), '0102030405');
});
await step('the notification closes with its button', async () => {
    await page.locator('.nv-btn[type=submit]').click();
    const notification = page.locator('.nv-no-notification').first();
    await notification.waitFor();
    await notification.locator('.nv-no-notification-close-btn').click();
    await notification.waitFor({ state: 'detached', timeout: 5000 });
});
await step('back to the list: the new customer is found by the search', async () => {
    await page.locator('.nv-breadcrumbs-item a').first().click();
    await page.waitForURL('**/shop/customers');
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill('Navette E2E');
    await page.locator('.nv-pagination-overview', { hasText: 'Showing 1 result' }).waitFor({ timeout: 5000 });
});
await step('delete: the modal opens, "Cancel" closes it without deleting anything', async () => {
    await page.locator('.nv-ta-records .nv-ta-row a.nv-ta-col').first().click();
    await page.waitForURL(/\/shop\/customers\/\d+\/edit$/);
    await page.locator('.nv-header-actions-ctn button', { hasText: 'Delete' }).click();
    const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.nv-modal-heading').innerText()).trim(), 'Delete Navette E2E');
    await modal.locator('.nv-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    assert.match(page.url(), /\/edit$/);
});
await step('delete: Escape closes the modal, then confirming → list, "Deleted" notification, customer gone', async () => {
    await page.locator('.nv-header-actions-ctn button', { hasText: 'Delete' }).click();
    const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.nv-header-actions-ctn button', { hasText: 'Delete' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    await page.waitForURL('**/shop/customers');
    await page.locator('.nv-no-notification-title', { hasText: 'Deleted' }).waitFor({ timeout: 5000 });
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill('Navette E2E');
    await page.locator('.nv-pagination-overview', { hasText: 'Showing 1 result' }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => { throw new Error('the customer is still listed'); });
});
await browser.close();
process.exit(exitCode(errors));
