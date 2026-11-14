// Options of specific fields, on the lab panel's "Specific fields" page: a `$money` RawJs mask whose commas are stripped
// before saving, a mask computed from another field, a phone pattern, a select relationship searched on two columns with
// labels from the record, a reorderable multiple select writing pivot data, row-ordered grids, date-time picker affixes,
// datalist and read-only picker. Run by e2e/run.mjs, on a throwaway copy of the database.
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
const PRODUCT = db.prepare('select id, name from products order by id limit 1').get();
const product = () => db.prepare('select * from products where id = ?').get(PRODUCT.id);
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const field = (id) => page.locator(`[id="form.${id}"]`);
const wrapperOf = (id) => page.locator('[data-field-wrapper]', { has: page.locator(`[id="form.${id}"]`) });
/** Clicks "Save changes" and waits for the answer. */
const save = async () => {
    const answered = page.waitForResponse((response) => response.url().includes('/livewire') && response.request().method() === 'POST' && (response.request().postData() ?? '').includes('"save"'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await answered;
    await page.waitForLoadState('networkidle');
};
const open = async () => {
    await page.goto(`${BASE}/lab/specific-fields/${PRODUCT.id}/edit`);
    await field('name').waitFor();
    await page.waitForLoadState('networkidle');
};

await login(page, BASE, user);
try {
    await step('a $money RawJs mask formats the typed amount; stripCharacters() saves it without the commas', async () => {
        await open();
        assert.equal(await field('price').getAttribute('x-mask:dynamic'), '$money($input)');
        await field('price').fill('');
        await field('price').pressSequentially('1234567.5');
        assert.equal(await field('price').inputValue(), '1,234,567.5');
        await save();
        assert.equal(Number(product().price), 1234567.5);
        await open();
        assert.equal(await field('price').inputValue(), '1,234,567.5', 'the mask formats the saved value again');
    });

    await step('a mask computed from another field changes when that field changes', async () => {
        await open();
        await page.locator('select[id="form.type"]').selectOption('deliverable');
        await until(async () => (await field('barcode').getAttribute('x-mask')) === '9999 9999 9999', 'the deliverable mask');
        await page.locator('select[id="form.type"]').selectOption('downloadable');
        await until(async () => (await field('barcode').getAttribute('x-mask')) === 'aaa-9999', 'the downloadable mask');
        await field('barcode').fill('');
        await field('barcode').pressSequentially('abc1234');
        assert.equal(await field('barcode').inputValue(), 'abc-1234');
    });

    await step('tel() validates against telRegex() on the server', async () => {
        await open();
        await field('support_phone').fill('06 12 34 56 78');
        await save();
        await wrapperOf('support_phone').locator('.fi-fo-field-wrp-error-message, [data-validation-error]').first().waitFor();
        assert.match(await wrapperOf('support_phone').innerText(), /support phone field format is invalid/);
        await field('support_phone').fill('+33612345678');
        await save();
        assert.doesNotMatch(await wrapperOf('support_phone').innerText(), /format is invalid/);
        assert.equal(await field('description').getAttribute('cols'), '40');
    });

    await step('the brand select searches the name and the website, with labels computed from the record', async () => {
        const brand = db.prepare("select id, name, website from brands where website is not null and website <> '' order by id desc limit 1").get();
        const domain = brand.website.replace(/^https?:\/\/(www\.)?/, '');
        await open();
        await wrapperOf('brand_id').locator('.fi-select-input-btn').click();
        await wrapperOf('brand_id').locator('.fi-select-input input').fill(domain.split('.')[0]);
        const option = wrapperOf('brand_id').locator('.fi-select-input-option', { hasText: `${brand.name} (${domain})` }).first();
        await option.waitFor({ timeout: 8000 });
        await option.click();
        await save();
        assert.equal(product().brand_id, brand.id);
        await open();
        assert.match(await wrapperOf('brand_id').locator('.fi-select-input-btn').innerText(), new RegExp(`${brand.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(`));
    });

    await step('a reorderable multiple select: badges can be dragged, labels do not wrap, pivot data is written', async () => {
        db.prepare('delete from product_category_product where product_id = ?').run(PRODUCT.id);
        const [first, second] = db.prepare('select id, name from product_categories order by id limit 2').all();
        await open();
        const select = wrapperOf('categories');
        assert.equal(await select.locator('.fi-select-input-ctn-reorderable').count(), 1);
        assert.equal(await select.locator('.fi-select-input-ctn-option-labels-not-wrapped').count(), 1);
        for (const category of [first, second]) {
            await select.locator('.fi-select-input-btn').click();
            await select.locator('.fi-select-input-option', { hasText: category.name }).first().click();
            await page.keyboard.press('Escape');
        }
        const badges = select.locator('.fi-select-input-value-badges-ctn [data-value]');
        await until(async () => (await badges.count()) === 2, 'two badges');
        const stateOrder = () => page.evaluate(() => window.Livewire.find(document.querySelector('[id="form.categories"]').closest('[wire\\:id]').getAttribute('wire:id')).get('data.categories'));
        assert.deepEqual(await stateOrder(), [String(first.id), String(second.id)]);
        await badges.nth(1).dragTo(badges.nth(0));
        await until(async () => JSON.stringify(await stateOrder()) === JSON.stringify([String(second.id), String(first.id)]), 'the dragged order in the state');
        await save();
        const rows = db.prepare('select product_category_id, created_at from product_category_product where product_id = ? order by product_category_id').all(PRODUCT.id);
        assert.deepEqual(rows.map((row) => row.product_category_id), [first.id, second.id]);
        assert.ok(rows.every((row) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.created_at)), JSON.stringify(rows));
    });

    await step('gridDirection("row") lays checkbox options and toggle buttons out row by row', async () => {
        await open();
        const options = page.locator('.fi-fo-checkbox-list', { hasText: 'North America' }).locator('.fi-fo-checkbox-list-options');
        assert.doesNotMatch(await options.getAttribute('class'), /fi-grid-direction-col/);
        const boxes = await options.locator('.fi-fo-checkbox-list-option-ctn').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
        // Row by row: the first three options share a line.
        assert.equal(Math.round(boxes[0]), Math.round(boxes[1]));
        assert.equal(Math.round(boxes[1]), Math.round(boxes[2]));
        assert.ok(boxes[3] > boxes[0]);
        const buttons = await page.locator('.fi-fo-toggle-buttons .fi-grid > *').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
        assert.equal(Math.round(buttons[0]), Math.round(buttons[1]));
        assert.ok(buttons[2] > buttons[0]);
    });

    await step('date-time pickers: affixes, a datalist of times, and a read-only JavaScript picker that does not open', async () => {
        await open();
        assert.equal((await wrapperOf('published_at').locator('.fi-input-wrp-prefix .fi-input-wrp-label').innerText()).trim(), 'From');
        assert.match(await field('published_at').getAttribute('class'), /fi-input-has-inline-suffix/);
        assert.equal(await field('restock_time').getAttribute('type'), 'time');
        assert.deepEqual(await page.locator('datalist[id="form.restock_time-list"] option').evaluateAll((options) => options.map((option) => option.value)), ['08:00', '12:00', '18:00']);
        await field('created_at').click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('[id="form.created_at-panel"]').isVisible(), false);
    });

    await step('no page errors', async () => { assert.deepEqual(errors, []); });
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
