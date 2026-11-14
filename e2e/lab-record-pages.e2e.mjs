// Resource record pages of the lab (`/lab/brand-pages`): a custom page bound to the record in the sub-navigation, the
// default redirect to the view page after creating, a created notification with a body, a relation manager reading its
// owner record, and the table's record title in a modal heading.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile);
const brand = db.prepare('select b.id, b.name, b.slug from brands b where exists (select 1 from products p where p.brand_id = b.id) order by b.id limit 1').get();

await login(page, BASE, user);
try {
    await step('the custom record page shows the record, its breadcrumbs and the record sub-navigation', async () => {
        await page.goto(`${BASE}/lab/brand-pages/${brand.id}/summary`);
        await page.locator('.nv-header-heading', { hasText: `Summary of ${brand.name}` }).waitFor({ timeout: 10000 });
        const crumbs = (await page.locator('.nv-breadcrumbs-item').allInnerTexts()).map((text) => text.trim()).filter(Boolean);
        assert.deepEqual(crumbs, ['Brands', brand.name, `Summary of ${brand.name}`]);
        assert.match(await page.locator('.nv-breadcrumbs-item a', { hasText: brand.name }).getAttribute('href'), new RegExp(`/lab/brand-pages/${brand.id}$`), 'the record links to its view page');
        const items = page.locator('.nv-page-sub-navigation-tabs .nv-tabs-item, .nv-page-sub-navigation-sidebar .nv-sidebar-item');
        const labels = (await items.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
        assert.ok(labels.includes('Summary'), labels.join(', '));
        await page.getByText(brand.slug, { exact: true }).first().waitFor();
    });
    await step('an unknown record answers 404', async () => {
        const response = await page.goto(`${BASE}/lab/brand-pages/999999/summary`);
        assert.equal(response.status(), 404);
    });
    await step('creating a brand opens its view page, with the notification of the page', async () => {
        await page.goto(`${BASE}/lab/brand-pages/create`);
        await page.locator('[id="form.name"]').fill('E2 Brand');
        await page.locator('[id="form.slug"]').fill('e2-brand');
        await page.locator('form#form button[type=submit]').first().click();
        await page.waitForURL((url) => /\/lab\/brand-pages\/\d+$/.test(url.pathname), { timeout: 10000 });
        const notification = page.locator('.nv-no-notification', { hasText: 'Brand created' });
        await notification.waitFor({ timeout: 8000 });
        assert.match(await notification.innerText(), /E2 Brand is ready\./);
    });
    await step('the relation manager reads its owner record; the modal heading uses the table record title', async () => {
        await page.goto(`${BASE}/lab/brand-pages/${brand.id}/edit`);
        const manager = page.locator('.nv-resource-relation-manager, [wire\\:id]').filter({ has: page.getByRole('button', { name: 'Owner' }) }).last();
        await manager.getByRole('button', { name: 'Owner' }).click();
        await page.locator('.nv-no-notification', { hasText: `Owner: ${brand.name}` }).waitFor({ timeout: 8000 });
        const row = manager.locator('.nv-ta-row').first();
        const name = (await row.locator('.nv-ta-text-item').first().innerText()).trim();
        const { sku } = db.prepare('select sku from products where brand_id = ? and name = ?').get(brand.id, name);
        await row.locator('.nv-ta-actions').getByText('View').click();
        await page.locator('.nv-modal-heading', { hasText: `View ${name} (${sku ?? 'no SKU'})` }).waitFor({ timeout: 8000 });
    });
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode());
