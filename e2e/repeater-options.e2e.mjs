// Repeater and builder options on the lab panel's "Repeater options" page: table repeater header options and compact mode,
// relationship hooks around each saved line, options disabled when picked in a sibling item, `fixIndistinctState()`, and lazy
// item schemas loaded when their collapsed item is expanded. Run by e2e/run.mjs, on a throwaway copy of the database.
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
// An order whose lines all have different products, with at least two lines.
const ORDER = db.prepare('select order_id as id from order_items group by order_id having count(*) >= 2 and count(*) = count(distinct product_id) order by order_id limit 1').get();
const lines = () => db.prepare('select id, product_id, qty, unit_price, sort from order_items where order_id = ? order by sort, id').all(ORDER.id);
const notes = () => db.prepare('select notes from orders where id = ?').get(ORDER.id).notes ?? '';
const LINES = lines();
const NOTES = notes();
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const livewireDone = () => page.waitForLoadState('networkidle');

const table = () => page.locator('.fi-fo-table-repeater');
const rows = () => table().locator('tbody > tr');
const reviewers = () => page.locator('.fi-fo-repeater').filter({ has: page.locator('.fi-fo-repeater-item-header-label', { hasText: 'Ada' }) });
const reviewer = (name) => reviewers().locator('.fi-fo-repeater-item').filter({ has: page.locator('.fi-fo-repeater-item-header-label', { hasText: name }) });
const expand = async (name) => { await reviewer(name).locator('.fi-fo-repeater-item-header').click(); await until(async () => (await reviewer(name).locator('input[type="text"]').count()) === 1, `the lazy content of ${name}`); };

await login(page, BASE, user);
try {
    await step('the table repeater shows its header options: required mark, wrapped and aligned header, hidden label, compact cells', async () => {
        await page.goto(`${BASE}/lab/repeater-options/${ORDER.id}/edit`);
        await table().waitFor();
        assert.match(await table().getAttribute('class'), /\bfi-compact\b/);
        const headers = table().locator('thead th');
        const product = headers.filter({ hasText: 'Product' });
        assert.equal(await product.locator('sup.fi-fo-table-repeater-header-required-mark').innerText(), '*');
        const quantity = headers.filter({ hasText: 'Quantity of this product' });
        assert.match(await quantity.getAttribute('class'), /fi-wrapped fi-align-end/);
        assert.equal(await quantity.getAttribute('style'), 'width: 140px;');
        const price = headers.filter({ hasText: 'Unit price' });
        assert.equal(await price.locator('span.fi-sr-only').innerText(), 'Unit price');
        assert.equal(await rows().count(), LINES.length);
        // The fill hook formats the price.
        assert.equal(await rows().first().locator('input[type="number"]').last().inputValue(), Number(LINES[0].unit_price).toFixed(2));
    });

    await step('a product picked on one line is disabled on the others, and enabled again once it is changed', async () => {
        const second = rows().nth(1).locator('select');
        assert.equal(await second.locator(`option[value="${LINES[0].product_id}"]`).isDisabled(), true);
        assert.equal(await second.locator(`option[value="${LINES[1].product_id}"]`).isDisabled(), false);
        const free = db.prepare(`select id from products where id not in (${LINES.map(() => '?').join(',')}) order by id limit 1`).get(...LINES.map((line) => line.product_id)).id;
        await rows().first().locator('select').selectOption(String(free));
        await until(async () => !(await second.locator(`option[value="${LINES[0].product_id}"]`).isDisabled()), 'the old product enabled again');
        assert.equal(await second.locator(`option[value="${free}"]`).isDisabled(), true);
        LINES[0].newProduct = free;
    });

    await step('saving runs the relationship hooks: create (price from the product), update (rounded price), delete', async () => {
        await rows().first().locator('input[type="number"]').first().fill('4');
        await rows().first().locator('input[type="number"]').last().fill('12.345');
        await livewireDone();
        // Delete the last line, then add a line without a price.
        await rows().last().getByRole('button', { name: 'Delete' }).click();
        await livewireDone();
        await until(async () => (await rows().count()) === LINES.length - 1, 'the line removed');
        await table().getByRole('button', { name: /^Add/ }).click();
        await livewireDone();
        await until(async () => (await rows().count()) === LINES.length, 'the line added');
        const used = new Set([String(LINES[0].newProduct), ...LINES.slice(1, -1).map((line) => String(line.product_id))]);
        const added = rows().last().locator('select');
        const options = await added.locator('option:not([disabled])').evaluateAll((elements) => elements.map((element) => element.value).filter(Boolean));
        const pick = options.find((value) => !used.has(value));
        assert.ok(pick, 'a free product');
        await added.selectOption(pick);
        await livewireDone();
        await rows().last().locator('input[type="number"]').first().fill('2');
        await livewireDone();
        await page.getByRole('button', { name: 'Save changes' }).click();
        await until(() => lines().length === LINES.length && lines().some((line) => String(line.product_id) === pick), 'the saved lines');
        const saved = lines();
        const first = saved.find((line) => line.id === LINES[0].id);
        assert.equal(first.qty, 4);
        assert.equal(Number(first.unit_price), 12.35);
        assert.equal(first.product_id, LINES[0].newProduct);
        assert.ok(!saved.some((line) => line.id === LINES.at(-1).id), 'the deleted line is gone');
        const created = saved.find((line) => String(line.product_id) === pick);
        const product = db.prepare('select price from products where id = ?').get(Number(pick));
        assert.equal(Number(created.unit_price), Number(product.price ?? 0));
        assert.deepEqual(saved.map((line) => line.sort), saved.map((_, index) => index + 1));
        const log = notes().slice(NOTES.length);
        assert.match(log, new RegExp(`line deleted: ${LINES.at(-1).id}`));
        assert.match(log, new RegExp(`line updated: ${LINES[0].id} x4`));
        assert.match(log, new RegExp(`line created: product ${pick}`));
        assert.ok(log.indexOf('line deleted') < log.indexOf('line created'), 'deletions run first');
    });

    await step('collapsed lazy items show a loading indicator, then load their content when expanded', async () => {
        await page.reload();
        await reviewers().waitFor();
        // Alpine binds the item headers once the page has settled: a click before that would be lost.
        await livewireDone();
        assert.equal(await reviewer('Bob').locator('input[type="text"]').count(), 0);
        assert.equal(await reviewer('Bob').locator('.fi-sc-loading').count(), 1);
        await expand('Ada');
        assert.equal(await reviewer('Ada').locator('input[type="text"]').inputValue(), 'Ada');
        assert.equal(await reviewer('Bob').locator('input[type="text"]').count(), 0, 'the other items are not loaded yet');
        // The lazy builder block loads when it enters the viewport.
        const block = page.locator('.fi-fo-builder-item');
        await block.scrollIntoViewIfNeeded();
        await until(async () => (await block.locator('input[type="text"]').count()) === 1, 'the lazy builder block');
        assert.equal(await block.locator('input[type="text"]').inputValue(), 'Lazy block');
    });

    await step('a role picked by a reviewer is disabled for the others; turning on a lead turns the other lead off', async () => {
        await expand('Bob');
        await expand('Cy');
        const radio = (name, value) => reviewer(name).locator(`input[type="radio"][value="${value}"]`);
        assert.equal(await radio('Bob', 'author').isDisabled(), true);
        assert.equal(await radio('Cy', 'author').isDisabled(), true);
        assert.equal(await radio('Cy', 'editor').isDisabled(), true);
        assert.equal(await radio('Cy', 'proofreader').isDisabled(), false);
        await radio('Cy', 'proofreader').check();
        await until(async () => radio('Bob', 'proofreader').isDisabled(), 'proofreader disabled for Bob');
        const lead = (name) => reviewer(name).getByRole('switch');
        assert.equal(await lead('Ada').getAttribute('aria-checked'), 'true');
        await lead('Bob').click();
        await until(async () => (await lead('Ada').getAttribute('aria-checked')) === 'false', 'the first lead turned off');
        assert.equal(await lead('Bob').getAttribute('aria-checked'), 'true');
    });

} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
