// ModalTableSelect on the lab panel's product form: records picked in a table shown in a slide-over (search, pagination,
// single and multiple selection), saved with the form; a forged key is refused. Run by e2e/run.mjs, on a throwaway copy
// of the database.
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

const PRODUCT = db.prepare('select id from products order by id limit 1').get().id;
const brandField = () => page.locator('.fi-fo-modal-table-select').nth(0);
const categoriesField = () => page.locator('.fi-fo-modal-table-select').nth(1);
const modal = () => page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const row = (name) => modal().locator('.fi-ta-row', { has: page.getByText(name, { exact: true }) });
const categoriesOf = () => db.prepare('select product_category_id as id from product_category_product where product_id = ? order by product_category_id').all(PRODUCT).map((r) => r.id);
/** Clicks "Save changes" and waits for the answer (the "Saved" notification, or a validation error). */
const save = async () => {
    const answered = page.waitForResponse((response) => response.url().includes('/livewire') && response.request().method() === 'POST' && (response.request().postData() ?? '').includes('"save"'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await answered;
    await page.waitForLoadState('networkidle');
};
/** Types in the table's search field and waits for the table to answer (the search is debounced). */
const search = async (text) => {
    const answered = page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes('tableSearch'));
    await modal().locator('.fi-ta-search-field input').fill(text);
    await answered;
    await page.waitForLoadState('networkidle');
};

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/lab/products/${PRODUCT}/edit`);
    const brand = db.prepare('select b.name from products p join brands b on b.id = p.brand_id where p.id = ?').get(PRODUCT);
    const target = db.prepare("select id, name from brands where name like 'Abshire%' order by name limit 1").get();

    await step('the field shows the label of the current record', async () => {
        assert.match(await brandField().innerText(), new RegExp(brand.name));
    });

    await step('single selection: the modal table is searched, one row is checked, and its label replaces the old one', async () => {
        await brandField().getByRole('button', { name: 'Select' }).click();
        await modal().waitFor();
        // The current brand is checked when the table opens on its page; search for another one.
        await search('Abshire');
        await row(target.name).waitFor();
        assert.ok(await modal().locator('.fi-ta-record-checkbox').count() <= 10);
        await row(target.name).locator('.fi-ta-record-checkbox').check();
        // A single selection: checking a row unchecks the others, and no "select page" checkbox is offered.
        assert.equal(await modal().locator('.fi-ta-page-checkbox').count(), 0);
        await modal().getByRole('button', { name: 'Select', exact: true }).last().click();
        await modal().waitFor({ state: 'detached' });
        await page.waitForFunction((name) => document.querySelectorAll('.fi-fo-modal-table-select')[0]?.textContent.includes(name), target.name);
    });

    const initial = categoriesOf();
    const extra = db.prepare(`select id, name from product_categories where id not in (${initial.map(() => '?').join(',') || 'null'}) order by name limit 2`).all(...initial);
    await step('multiple selection: rows checked on different pages are kept, and shown as badges', async () => {
        await categoriesField().getByRole('button', { name: 'Select' }).click();
        await modal().waitFor();
        // The categories already linked are checked when the table opens.
        await search(extra[0].name);
        await row(extra[0].name).locator('.fi-ta-record-checkbox').check();
        await search(extra[1].name);
        await row(extra[1].name).locator('.fi-ta-record-checkbox').check();
        // The selection survives the searches.
        await search('');
        await modal().getByRole('button', { name: 'Select', exact: true }).last().click();
        await modal().waitFor({ state: 'detached' });
        await page.waitForFunction(() => document.querySelectorAll('.fi-fo-modal-table-select')[1]?.querySelectorAll('.fi-badge').length > 0);
        const badges = await categoriesField().locator('.fi-badge').allInnerTexts();
        for (const category of extra) assert.ok(badges.map((b) => b.trim()).includes(category.name), `${category.name} in ${badges}`);
        assert.equal(badges.length, initial.length + 2);
    });

    await step('saving stores the foreign key and the many-to-many links', async () => {
        await save();
        assert.equal(db.prepare('select brand_id from products where id = ?').get(PRODUCT).brand_id, target.id);
        assert.deepEqual(categoriesOf(), [...initial, ...extra.map((c) => c.id)].sort((a, b) => a - b));
    });

    await step('a key forged in the browser, outside the table, is refused', async () => {
        await page.evaluate(() => {
            const root = document.querySelector('.fi-fo-modal-table-select').closest('[wire\\:id]');
            window.Livewire.find(root.getAttribute('wire:id')).$set('data.brand_id', '999999', false);
        });
        await save();
        await page.getByText('The selected brand is invalid.').waitFor();
        assert.equal(db.prepare('select brand_id from products where id = ?').get(PRODUCT).brand_id, target.id);
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
