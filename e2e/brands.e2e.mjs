// Brands: row actions, manual row reordering, the form, and the Products and Addresses relation managers.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const one = (sql, ...params) => db.prepare(sql).get(...params);
const all = (sql, ...params) => db.prepare(sql).all(...params);
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter({ errorLines: 4 });
const rows = page.locator('.nv-ta-records tr.nv-ta-row');
const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
const wire = (selector) => `window.Livewire.all().find((c) => c.el.matches(${JSON.stringify(selector)}) || c.el.querySelector(${JSON.stringify(selector)})).$wire`;

await login(page, BASE, user);

const first = one('select * from brands order by sort, id limit 1');
await step('list sorted by rank, "Visit website" link opens in a new tab', async () => {
    await page.goto(`${BASE}/shop/brands`);
    await rows.first().locator('.nv-ta-cell-name', { hasText: first.name }).waitFor({ timeout: 10000 });
    const link = rows.first().locator('a.nv-ac-link-action', { hasText: 'Visit website' });
    assert.equal(await link.getAttribute('href'), first.website);
    assert.equal(await link.getAttribute('target'), '_blank');
});

await step('"Toggle visibility" toggles the brand visibility', async () => {
    await rows.first().locator('button.nv-ac-link-action', { hasText: 'Toggle visibility' }).click();
    await until(() => one('select is_visible v from brands where id = ?', first.id).v === (first.is_visible ? 0 : 1), 'visibility');
});

await step('reordering: every row shown with a handle, no pagination nor row actions', async () => {
    await page.locator('button[title="Reorder records"]').click();
    await page.locator('.nv-ta-reorder-indicator').waitFor({ timeout: 15000 });
    assert.equal(await rows.count(), one('select count(*) n from brands').n);
    assert.equal(await page.locator('.nv-ta-reorder-handle').count(), await rows.count());
    assert.equal(await page.locator('.nv-pagination').count(), 0);
    assert.equal(await page.locator('.nv-ta-record-checkbox').count(), 0);
});

await step('reordering: the new order is saved; unknown keys are ignored', async () => {
    const keys = all('select id from brands order by sort, id').map((r) => String(r.id));
    const order = [keys[2], keys[0], keys[1], 'unknown', '999999', ...keys.slice(3)];
    await page.evaluate(`${wire('.nv-ta')}.reorderTable(${JSON.stringify(order)}, ${JSON.stringify(keys[2])})`);
    await until(() => String(one('select id from brands order by sort, id limit 1').id) === keys[2], 'rank 1');
    assert.deepEqual(all('select id from brands order by sort, id limit 3').map((r) => String(r.id)), [keys[2], keys[0], keys[1]]);
    assert.equal(one('select count(distinct sort) n from brands').n, keys.length);
    await page.locator('button[title="Finish reordering records"]').click();
    await page.locator('.nv-pagination').waitFor({ timeout: 15000 });
    await rows.first().locator('.nv-ta-cell-name', { hasText: one('select name from brands where id = ?', keys[2]).name }).waitFor({ timeout: 5000 });
});

await step('outside reordering mode, reorderTable has no effect', async () => {
    const before = all('select id from brands order by sort, id limit 3').map((r) => r.id);
    await page.evaluate(`${wire('.nv-ta')}.reorderTable(${JSON.stringify(before.slice().reverse().map(String))})`);
    await page.waitForTimeout(700);
    assert.deepEqual(all('select id from brands order by sort, id limit 3').map((r) => r.id), before);
});

let created = null;
await step('create: automatic slug, website URL validated', async () => {
    await page.goto(`${BASE}/shop/brands/create`);
    // Accented on purpose: the slug must be transliterated.
    await page.locator('[id="form.name"]').fill('Navette Téléphériques');
    await page.locator('[id="form.name"]').blur();
    await page.waitForFunction(() => document.querySelector('[id="form.slug"]').value === 'navette-telepheriques', null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('form.nv-sc-form').noValidate = true; });
    await page.locator('[id="form.website"]').fill('javascript:alert(1)');
    await page.locator('.nv-sc-form button[type=submit]').first().click();
    await page.locator('.nv-fo-field-wrp-error-message', { hasText: 'valid URL' }).waitFor({ timeout: 8000 });
    await page.locator('[id="form.website"]').fill('https://navette.example');
    await page.locator('.nv-sc-form button[type=submit]').first().click();
    await page.waitForURL(/\/shop\/brands\/\d+\/edit/, { timeout: 10000 });
    created = one("select * from brands where slug = 'navette-telepheriques'");
    assert.equal(created.website, 'https://navette.example');
    assert.equal(created.is_visible, 1);
});

await step('edit: "Visit website" header action, empty Products tab, then a product created for the brand', async () => {
    assert.ok(created);
    assert.equal(await page.locator('.nv-header-actions-ctn a', { hasText: 'Visit website' }).getAttribute('href'), 'https://navette.example');
    const manager = page.locator('.nv-resource-relation-manager');
    await manager.locator('.nv-ta-empty-state').waitFor({ timeout: 15000 });
    await manager.locator('.nv-ta-header button', { hasText: 'New product' }).click();
    await modal.waitFor({ timeout: 10000 });
    // From a brand, the product form does not offer to pick the brand.
    assert.equal(await modal.locator('label[for$="brand_id"]').count(), 0);
    const field = (name) => modal.locator(`[id$=".${name}"]`).first();
    await field('name').fill('Panoramic cabin');
    await field('name').blur();
    await page.waitForFunction(() => [...document.querySelectorAll('.nv-modal-window input')].some((i) => i.value === 'panoramic-cabin'), null, { timeout: 8000 });
    for (const [name, value] of [['price', '1500'], ['old_price', '1800'], ['cost', '900'], ['sku', 'NAV-CAB-1'], ['barcode', '0000000000024'], ['qty', '2'], ['security_stock', '1']]) await field(name).fill(value);
    const category = one('select id, name from product_categories order by name limit 1');
    const wrapper = modal.locator('.nv-fo-field', { has: page.locator('label[for$="productCategories"]') });
    await wrapper.locator('.nv-select-input-btn').click();
    await wrapper.locator('.nv-select-input input').first().fill(category.name.slice(0, 5));
    await page.locator('.nv-select-input-option', { hasText: category.name }).first().click();
    await page.keyboard.press('Escape').catch(() => {});
    if (!(await modal.isVisible())) throw new Error('Escape closed the modal');
    await modal.locator('.nv-modal-footer button[type=submit], .nv-modal-footer-actions button', { hasText: /^\s*Create\s*$/ }).first().click();
    await until(() => !!one("select id from products where slug = 'panoramic-cabin'"), 'product created');
    assert.equal(one("select brand_id b from products where slug = 'panoramic-cabin'").b, created.id);
    await manager.locator('.nv-ta-cell-name', { hasText: 'Panoramic cabin' }).waitFor({ timeout: 10000 });
});

await step('Addresses tab: only the brand\'s addresses', async () => {
    const brand = one("select addressable_id id, count(*) n from addressables where addressable_type like '%Brand' group by 1 order by n desc limit 1");
    await page.goto(`${BASE}/shop/brands/${brand.id}/edit`);
    await page.locator('.nv-sc-tabs .nv-tabs-item', { hasText: 'Addresses' }).click();
    const manager = page.locator('.nv-resource-relation-manager');
    await manager.locator('.nv-ta-records tr.nv-ta-row').first().waitFor({ timeout: 15000 });
    assert.equal(await manager.locator('.nv-ta-records tr.nv-ta-row').count(), Math.min(brand.n, 10));
});

await browser.close();
db.close();
if (errors.length) console.log('JavaScript errors:\n' + errors.slice(0, 5).join('\n'));
process.exit(exitCode());
