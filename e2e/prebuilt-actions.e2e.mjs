// Relationship actions of the lab panel (apps/demo/lab-prebuilt-actions.ts): attach with a preloaded multiple select scoped
// by `recordSelectOptionsQuery()`, attach from a table (`tableSelect()`), detach in one query, associate several products
// searched by SKU, the customized "create another" button; forged keys outside the options query are refused.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const manager = page.locator('.fi-resource-relation-manager');
const modal = page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const texts = async (locator) => (await locator.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
const notified = (title) => page.locator('.fi-no-notification', { hasText: title }).last().waitFor({ timeout: 8000 });
const component = () => "window.Livewire.all().find((c) => c.el.classList.contains('fi-resource-relation-manager'))";

// A product with categories, and visible categories it does not have yet.
const PRODUCT = db.prepare('select product_id as id from product_category_product group by product_id order by count(*) desc, product_id limit 1').get().id;
const categoriesOf = () => db.prepare('select product_category_id as id from product_category_product where product_id = ? order by product_category_id').all(PRODUCT).map((row) => row.id);
const free = () => db.prepare('select id, name from product_categories where is_visible = 1 and id not in (select product_category_id from product_category_product where product_id = ?) order by name').all(PRODUCT);
const hidden = db.prepare('select id, name from product_categories where is_visible = 0 and id not in (select product_category_id from product_category_product where product_id = ?) order by name limit 1').get(PRODUCT);

await login(page, BASE, user);
try {
    await step('the product categories manager offers "Attach" and "Attach from table"', async () => {
        await page.goto(`${BASE}/lab/relation-products/${PRODUCT}/edit`);
        await manager.locator('.fi-ta-table').waitFor({ timeout: 10000 });
        assert.deepEqual(await texts(manager.locator('.fi-ta-header .fi-ta-actions button')), ['Attach', 'Attach from table']);
    });

    await step('"Attach": preloaded options of visible, not yet attached categories; no "attach another"; several attached at once', async () => {
        const before = categoriesOf();
        const [first, second] = free();
        await manager.locator('.fi-ta-header button', { hasText: /^\s*Attach\s*$/ }).click();
        await modal.waitFor({ timeout: 8000 });
        assert.equal(await modal.getByRole('button', { name: 'Attach & attach another' }).count(), 0);
        await modal.locator('.fi-select-input-btn').click();
        // Preloaded: the options are listed before anything is typed.
        await page.locator('.fi-select-input-option', { hasText: first.name }).first().waitFor({ timeout: 8000 });
        const offered = await texts(page.locator('.fi-select-input-option'));
        if (hidden) assert.ok(!offered.includes(hidden.name), 'a hidden category is not offered');
        await page.locator('.fi-select-input-option', { hasText: first.name }).first().click();
        // Multiple selection: the list stays open for the next option.
        if (!(await page.locator('.fi-select-input-option', { hasText: second.name }).first().isVisible())) await modal.locator('.fi-select-input-btn').click();
        await page.locator('.fi-select-input-option', { hasText: second.name }).first().click();
        await modal.locator('.fi-modal-heading').click();
        await modal.locator('.fi-modal-footer button[type=submit]').first().click();
        await notified('Attached');
        assert.deepEqual(categoriesOf(), [...before, first.id, second.id].sort((a, b) => a - b));
    });

    await step('forged attach of a hidden category (outside the options query): refused by the server', async () => {
        assert.ok(hidden, 'the seed has a hidden category');
        await page.reload();
        await manager.locator('.fi-ta-table').waitFor({ timeout: 10000 });
        await manager.locator('.fi-ta-header button', { hasText: /^\s*Attach\s*$/ }).click();
        await modal.waitFor({ timeout: 8000 });
        await page.evaluate(`(async () => { const c = ${component()}; await c.$wire.set('mountedActions.0.data.recordId', [${JSON.stringify(String(hidden.id))}], false); await c.$wire.callMountedAction(); })()`);
        await modal.locator('.fi-fo-field-wrp-error-message', { hasText: 'invalid' }).waitFor({ timeout: 8000 });
        assert.ok(!categoriesOf().includes(hidden.id));
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await modal.waitFor({ state: 'detached', timeout: 8000 });
    });

    await step('"Attach from table": the table lists visible categories not yet attached, a checked row is attached', async () => {
        const before = categoriesOf();
        const [target] = free();
        await manager.locator('.fi-ta-header button', { hasText: 'Attach from table' }).click();
        await modal.locator('.fi-ta-table').waitFor({ timeout: 10000 });
        await modal.locator('.fi-ta-search-field input').fill(target.name);
        const row = modal.locator('.fi-ta-row', { has: page.getByText(target.name, { exact: true }) });
        await row.waitFor({ timeout: 8000 });
        if (hidden) {
            await modal.locator('.fi-ta-search-field input').fill(hidden.name);
            await modal.locator('.fi-ta-empty-state').waitFor({ timeout: 8000 });
            await modal.locator('.fi-ta-search-field input').fill(target.name);
            await row.waitFor({ timeout: 8000 });
        }
        await row.locator('.fi-ta-record-checkbox').check();
        await modal.locator('.fi-modal-footer button[type=submit]').first().click();
        await notified('Attached');
        assert.deepEqual(categoriesOf(), [...before, target.id].sort((a, b) => a - b));
    });

    await step('"Detach selected" (fetchSelectedRecords(false)): the selected links go away, the categories stay', async () => {
        await page.reload();
        await manager.locator('.fi-ta-table').waitFor({ timeout: 10000 });
        const before = categoriesOf();
        const checkboxes = manager.locator('.fi-ta-records .fi-ta-record-checkbox');
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await manager.locator('.fi-ta-header-toolbar .fi-ta-actions .fi-dropdown-trigger button').last().click();
        await page.locator('.fi-dropdown-list-item', { hasText: 'Detach selected' }).click();
        await modal.locator('.fi-modal-footer button[type=submit]').click();
        await notified('Detached');
        assert.equal(categoriesOf().length, before.length - 2);
        assert.equal(db.prepare('select count(*) as n from product_categories').get().n, 84);
    });

    // ---------------------------------------------------------------- one-to-many: a brand's products
    const BRAND = db.prepare('select id from brands where id in (select brand_id from products) order by id limit 1').get().id;
    const productsOf = () => db.prepare('select id from products where brand_id = ? order by id').all(BRAND).map((row) => row.id);
    const candidate = db.prepare('select id, name, sku from products where is_visible = 1 and (brand_id is null or brand_id <> ?) and sku is not null order by id limit 1').get(BRAND);
    const invisible = db.prepare('select id from products where is_visible = 0 and (brand_id is null or brand_id <> ?) order by id limit 1').get(BRAND);

    await step('"Associate": a visible product of another brand, found by its SKU, moves to this brand', async () => {
        await page.goto(`${BASE}/lab/relation-brands/${BRAND}/edit`);
        await manager.locator('.fi-ta-table').waitFor({ timeout: 10000 });
        const before = productsOf();
        await manager.locator('.fi-ta-header button', { hasText: 'Associate' }).click();
        await modal.waitFor({ timeout: 8000 });
        await modal.locator('.fi-select-input-btn').click();
        await modal.locator('.fi-select-input input').first().fill(candidate.sku);
        await page.locator('.fi-select-input-option', { hasText: candidate.name }).first().click();
        await modal.locator('.fi-modal-heading').click();
        await modal.locator('.fi-modal-footer button[type=submit]').first().click();
        await notified('Associated');
        assert.deepEqual(productsOf(), [...before, candidate.id].sort((a, b) => a - b));
    });

    await step('forged associate of an invisible product: refused by the server', async () => {
        if (!invisible) return;
        await page.reload();
        await manager.locator('.fi-ta-table').waitFor({ timeout: 10000 });
        await manager.locator('.fi-ta-header button', { hasText: 'Associate' }).click();
        await modal.waitFor({ timeout: 8000 });
        await page.evaluate(`(async () => { const c = ${component()}; await c.$wire.set('mountedActions.0.data.recordId', [${JSON.stringify(String(invisible.id))}], false); await c.$wire.callMountedAction(); })()`);
        await modal.locator('.fi-fo-field-wrp-error-message', { hasText: 'invalid' }).waitFor({ timeout: 8000 });
        assert.ok(!productsOf().includes(invisible.id));
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await modal.waitFor({ state: 'detached', timeout: 8000 });
    });

    await step('"New product": the "create another" button has its custom label', async () => {
        await manager.locator('.fi-ta-header button', { hasText: 'New product' }).click();
        await modal.waitFor({ timeout: 8000 });
        assert.equal(await modal.getByRole('button', { name: 'Create & add another product' }).count(), 1);
        assert.equal(await modal.getByRole('button', { name: 'Create & create another' }).count(), 0);
        await modal.locator('input[id$=".name"]').fill('Navette lab product');
        await modal.getByRole('button', { name: 'Create & add another product' }).click();
        await notified('Created');
        // The modal stays open with an empty form.
        await page.waitForFunction(() => document.querySelector('.fi-modal.fi-modal-open .fi-modal-window input[id$=".name"]')?.value === '');
        assert.equal(db.prepare("select brand_id from products where name = 'Navette lab product'").get().brand_id, BRAND);
    });

    await step('no JavaScript error', async () => { assert.deepEqual(errors, []); });
} finally {
    await browser.close();
}
process.exit(exitCode());
