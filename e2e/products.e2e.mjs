// Products: stats bound to the table, row and bulk actions, the form, uploaded images.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
// The seeded product images are not in the repository: the step that reads one is skipped unless NAVETTE_STORAGE points to them.
import { chromium } from 'playwright';
import path from 'node:path';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const db = openDatabase(dbFile);
const one = (sql, ...params) => db.prepare(sql).get(...params);
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, skip, exitCode } = reporter({ errorLines: 4 });
const rows = page.locator('.fi-ta-records tr.fi-ta-row');
const stats = async () => (await page.locator('.fi-wi-stats-overview-stat-value').allInnerTexts()).map((x) => x.trim());
const menuOf = async (row) => { await row.locator('.fi-dropdown-trigger button').click(); const panel = page.locator('.fi-dropdown-panel:visible'); await panel.waitFor({ timeout: 5000 }); return panel; };
const modal = page.locator('.fi-modal.fi-modal-open .fi-modal-window');

await login(page, BASE, user);
// A real JPEG to upload: a screenshot of the page.
const jpeg = path.join(tmpDir, 'upload.jpg');
await page.screenshot({ type: 'jpeg', path: jpeg, clip: { x: 0, y: 0, width: 320, height: 240 } });

await step('stats: product count, stock and average price', async () => {
    await page.goto(`${BASE}/shop/products`);
    await page.locator('.fi-wi-stats-overview-stat-value').first().waitFor({ timeout: 10000 });
    const all = one('select count(*) n, sum(qty) q, avg(price) p from products');
    assert.deepEqual(await stats(), [String(all.n), String(all.q), money(all.p)]);
});

await step('the search updates the stats (reactive properties)', async () => {
    await page.locator('.fi-ta-search-field input').fill('alpine');
    const found = one("select count(*) n, sum(qty) q, avg(price) p from products left join brands on brands.id = products.brand_id where lower(products.name) like '%alpine%' or lower(brands.name) like '%alpine%' or products.sku like '%alpine%' or cast(products.price as text) like '%alpine%' or cast(products.qty as text) like '%alpine%' or cast(products.security_stock as text) like '%alpine%'");
    await page.waitForFunction((n) => document.querySelector('.fi-wi-stats-overview-stat-value')?.textContent.trim() === n, String(found.n), { timeout: 10000 });
    assert.deepEqual(await stats(), [String(found.n), String(found.q), money(found.p)]);
    assert.equal(await rows.count(), found.n);
    await page.locator('.fi-ta-search-field input').fill('');
    await page.waitForFunction(() => document.querySelectorAll('.fi-ta-records tr.fi-ta-row').length === 10);
});

if (!process.env.NAVETTE_STORAGE) skip('the first row\'s image is served', 'NAVETTE_STORAGE is not set (seeded product images)');
else await step('the first row\'s image is served', async () => {
    const src = await rows.first().locator('.fi-ta-image img').getAttribute('src');
    const res = await page.request.get(new URL(src, BASE).href);
    assert.equal(res.status(), 200);
    assert.match(res.headers()['content-type'], /image\/jpeg/);
});

const first = one('select id, name, is_visible, price, qty from products order by name limit 1');
await step('"Hide / Show" action toggles the visibility', async () => {
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: first.is_visible ? 'Hide' : 'Show' }).click();
    await assert.doesNotReject(page.waitForFunction(() => !document.querySelector('.fi-dropdown-panel:not([style*="display: none"]) .fi-dropdown-list-item[wire\\:loading\\.attr]:disabled'), null, { timeout: 5000 }));
    await page.waitForTimeout(600);
    assert.equal(one('select is_visible v from products where id = ?', first.id).v, first.is_visible ? 0 : 1);
});

await step('"Adjust price" action: modal filled in, validation, saved', async () => {
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Adjust price' }).click();
    await modal.waitFor({ timeout: 8000 });
    const input = modal.locator('input[id$="price"]').first();
    assert.equal(Number(await input.inputValue()), Number(first.price));
    await input.fill('123.45');
    await modal.locator('button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 8000 });
    assert.equal(one('select price p from products where id = ?', first.id).p, 123.45);
    await rows.first().locator('.fi-ta-cell-price', { hasText: '$123.45' }).waitFor({ timeout: 5000 });
});

await step('"Adjust stock" action', async () => {
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Adjust stock' }).click();
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('input').first().fill('77');
    await modal.locator('button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 8000 });
    assert.equal(one('select qty q from products where id = ?', first.id).q, 77);
});

await step('delete: replaced by a notification, as in the demo', async () => {
    const before = one('select count(*) n from products').n;
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Delete' }).click();
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'cheeky' }).first().waitFor({ timeout: 8000 });
    assert.equal(one('select count(*) n from products').n, before);
});

await step('"Toggle visibility" bulk action on two rows', async () => {
    await page.goto(`${BASE}/shop/products`);
    const ids = db.prepare('select id from products order by name limit 2').all().map((r) => r.id);
    await page.locator('.fi-wi-stats-overview-stat-value').first().waitFor({ timeout: 10000 });
    await rows.nth(0).locator('.fi-ta-record-checkbox').click();
    await rows.nth(1).locator('.fi-ta-record-checkbox').click();
    await page.locator('.fi-ta-selection-indicator', { hasText: '2 records selected' }).waitFor({ timeout: 8000 });
    await page.locator('.fi-dropdown', { has: page.locator('.fi-dropdown-list-item', { hasText: 'Toggle visibility' }) }).locator('.fi-dropdown-trigger button:visible').first().click();
    await page.locator('.fi-dropdown-list-item', { hasText: 'Toggle visibility' }).click();
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('label', { hasText: 'Hidden' }).click();
    await modal.locator('button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 8000 });
    assert.deepEqual(db.prepare(`select is_visible v from products where id in (${ids.join(',')})`).all().map((r) => r.v), [0, 0]);
});

let created = null;
await step('create: automatic slug, validation, categories, uploaded image', async () => {
    await page.goto(`${BASE}/shop/products/create`);
    await page.locator('[id="form.name"]').fill('Navette Cable Car');
    await page.locator('[id="form.name"]').blur();
    await page.waitForFunction(() => document.querySelector('[id="form.slug"]').value === 'navette-cable-car', null, { timeout: 8000 });
    // Saving without the required fields: errors.
    await page.evaluate(() => { document.querySelector('form.fi-sc-form').noValidate = true; });
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.locator('.fi-fo-field-wrp-error-message').first().waitFor({ timeout: 8000 });
    assert.ok((await page.locator('.fi-fo-field-wrp-error-message').count()) >= 5);
    for (const [id, value] of [['price', '99.5'], ['old_price', '120'], ['cost', '40'], ['sku', 'NAV-0001'], ['barcode', '0000000000017'], ['qty', '12'], ['security_stock', '3']]) await page.locator(`[id="form.${id}"]`).fill(value);
    const category = one('select id, name from product_categories order by name limit 1');
    const wrapper = page.locator('.fi-fo-field', { has: page.locator('label[for="form.productCategories"]') });
    await wrapper.locator('.fi-select-input-btn').click();
    await wrapper.locator('.fi-select-input input').first().fill(category.name.slice(0, 5));
    await page.locator('.fi-select-input-option', { hasText: category.name }).first().click();
    await page.keyboard.press('Escape');
    await page.locator('.fi-fo-file-upload input[type=file]').setInputFiles(jpeg);
    await page.locator('.filepond--item[data-filepond-item-state="processing-complete"]').waitFor({ timeout: 15000 });
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.waitForURL(/\/shop\/products\/\d+\/edit/, { timeout: 10000 });
    created = one("select * from products where slug = 'navette-cable-car'");
    assert.ok(created, 'product created');
    assert.equal(created.price, 99.5);
    assert.deepEqual(db.prepare('select product_category_id c from product_category_product where product_id = ?').all(created.id).map((r) => r.c), [category.id]);
    const media = db.prepare("select * from media where model_id = ? and model_type like '%Product'").all(created.id);
    assert.equal(media.length, 1);
    assert.equal(media[0].mime_type, 'image/jpeg');
    const res = await page.request.get(`${BASE}/storage/${media[0].id}/${media[0].file_name}`);
    assert.equal(res.status(), 200);
});

await step('edit: the saved image is shown, then removed', async () => {
    assert.ok(created);
    await page.goto(`${BASE}/shop/products/${created.id}/edit`);
    await page.locator('.filepond--item').first().waitFor({ timeout: 15000 });
    await page.locator('.filepond--item .filepond--action-remove-item').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.filepond--item').length === 0, null, { timeout: 8000 });
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    // The "Created" notification of the previous step may still be shown: wait for the effect in the database instead.
    for (let i = 0; i < 40 && one("select count(*) n from media where model_id = ? and model_type like '%Product'", created.id).n > 0; i++) await page.waitForTimeout(250);
    assert.equal(one("select count(*) n from media where model_id = ? and model_type like '%Product'", created.id).n, 0);
});

await step('the list shows the new product, without an image', async () => {
    await page.goto(`${BASE}/shop/products`);
    await page.locator('.fi-ta-search-field input').fill('Navette Cable');
    await page.waitForFunction(() => document.querySelectorAll('.fi-ta-records tr.fi-ta-row').length === 1, null, { timeout: 8000 });
    assert.equal(await rows.first().locator('.fi-ta-image img').count(), 0);
});

await step('security: a non-JPEG file is refused on save, a forged temporary file reference is refused', async () => {
    assert.ok(created);
    await page.goto(`${BASE}/shop/products/${created.id}/edit`);
    await page.locator('.fi-fo-file-upload .filepond--root').waitFor({ timeout: 15000 });
    // Sent directly with $wire.upload, without the browser's file type filter.
    const outcome = await page.evaluate(async () => {
        const wire = window.Livewire.all().find((c) => c.el.querySelector('.fi-sc-form')).$wire;
        const file = new File(['<script>alert(1)</script>'], 'fake.jpg', { type: 'image/jpeg' });
        await new Promise((resolve, reject) => wire.upload('data.media.11111111-1111-4111-8111-111111111111', file, resolve, reject));
        return 'sent';
    });
    assert.equal(outcome, 'sent');
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.locator('.fi-fo-field-wrp-error-message', { hasText: 'must be a file of type' }).first().waitFor({ timeout: 8000 });
    assert.equal(one("select count(*) n from media where model_id = ? and model_type like '%Product'", created.id).n, 0);
    // A forged reference to a temporary file that does not exist, and the media key of another product.
    const other = one("select uuid from media where model_type like '%Product' and model_id <> ? limit 1", created.id).uuid;
    const status = await page.evaluate(async (uuid) => {
        const wire = window.Livewire.all().find((c) => c.el.querySelector('.fi-sc-form')).$wire;
        try { await wire.$set('data.media', { a: 'livewire-file:' + '0'.repeat(32) }); return 'accepted'; } catch { /* refusal expected */ }
        try { await wire.$set('data.media', { b: uuid }); return 'key set'; } catch { return 'refused'; }
    }, other);
    assert.notEqual(status, 'accepted');
    await page.goto(`${BASE}/shop/products/${created.id}/edit`);
    assert.equal(one("select count(*) n from media where model_id = ? and model_type like '%Product'", created.id).n, 0);
});

await browser.close();
db.close();
if (errors.length) console.log('JavaScript errors:\n' + errors.slice(0, 5).join('\n'));
process.exit(exitCode());
