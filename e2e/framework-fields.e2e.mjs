// Fields and schema components rendered by a JavaScript framework (`JsField`, `JsComponent`), on the lab panel's
// "Framework fields" page: a Vue quantity stepper bound to the form state, saved with the record, with validation errors
// and a server-configured Vue gauge updated without remounting. Run by e2e/run.mjs, on a throwaway copy of the database.
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
const PRODUCT = db.prepare('select id, qty from products order by id limit 1').get();
const quantityOf = () => db.prepare('select qty from products where id = ?').get(PRODUCT.id).qty;
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };

const field = () => page.locator('[data-field-wrapper]', { has: page.locator('[x-ref="host"] input[type="number"]') });
const input = () => field().locator('[x-ref="host"] input[type="number"]');
const gauge = () => page.locator('.fi-lab-stock-gauge');
/** Clicks "Save changes" and waits for the answer (the "Saved" notification, or a validation error). */
const save = async () => {
    const answered = page.waitForResponse((response) => response.url().includes('/livewire') && response.request().method() === 'POST' && (response.request().postData() ?? '').includes('"save"'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await answered;
    await page.waitForLoadState('networkidle');
};

await login(page, BASE, user);
try {
    await step('the Vue component is mounted in the field with the record state, its label and helper text', async () => {
        await page.goto(`${BASE}/lab/framework-fields/${PRODUCT.id}/edit`);
        await input().waitFor();
        assert.equal(await input().inputValue(), String(PRODUCT.qty));
        // Filament's label targets the renderer's primary input through `props.id`.
        assert.equal(await page.getByLabel('Quantity').getAttribute('type'), 'number');
        const describedBy = await input().getAttribute('aria-describedby');
        assert.ok(describedBy?.endsWith('-helper-text'), `aria-describedby: ${describedBy}`);
        assert.match(await page.locator(`[id="${describedBy}"]`).innerText(), /Between 0 and 1000\./);
        assert.equal(await input().getAttribute('required'), '');
        await gauge().waitFor();
        assert.equal(await gauge().locator('[data-stock-quantity]').innerText(), `${PRODUCT.qty} / 1000`);
    });

    await step('editing in the Vue component updates the live state; the server-configured gauge updates without remounting', async () => {
        // Markers on the mounted DOM: a remount would replace these elements.
        await input().evaluate((element) => { element.dataset.marker = 'kept'; });
        await gauge().evaluate((element) => { element.dataset.marker = 'kept'; });
        const rendered = page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes('qty'));
        for (let i = 0; i < 3; i++) await field().getByRole('button', { name: 'Increase' }).click();
        assert.equal(await input().inputValue(), String(PRODUCT.qty + 3));
        await rendered;
        await until(async () => (await gauge().locator('[data-stock-quantity]').innerText()) === `${PRODUCT.qty + 3} / 1000`, 'the gauge configuration after the live update');
        assert.equal(await input().getAttribute('data-marker'), 'kept', 'the field renderer was not remounted');
        assert.equal(await gauge().getAttribute('data-marker'), 'kept', 'the component renderer was not remounted');
        assert.equal(quantityOf(), PRODUCT.qty, 'not saved before "Save changes"');
    });

    await step('a value that bypasses the browser checks is rejected by the server: the error reaches the Vue component (isInvalid) and nothing is saved', async () => {
        // The stepper clamps to its bounds and the browser checks `step`: turn the browser checks off, as a tampered request would.
        await page.locator('form.fi-sc-form').evaluate((form) => { form.noValidate = true; });
        await input().fill('2.5');
        await save();
        const error = field().locator('[data-validation-error]');
        await error.waitFor();
        assert.match(await error.innerText(), /must be an integer/);
        await until(async () => (await input().getAttribute('aria-invalid')) === 'true', 'aria-invalid on the Vue input');
        assert.match(await input().getAttribute('aria-describedby'), /-error\b/);
        assert.equal(quantityOf(), PRODUCT.qty);
    });

    await step('a value typed in the Vue component is saved with the form and shown again after a reload', async () => {
        await input().fill('42');
        await save();
        await until(async () => quantityOf() === 42, 'the saved quantity');
        await until(async () => (await input().getAttribute('aria-invalid')) === null, 'the cleared error');
        await page.reload();
        await input().waitFor();
        assert.equal(await input().inputValue(), '42');
        await field().getByRole('button', { name: 'Decrease' }).click();
        assert.equal(await input().inputValue(), '41');
        await save();
        await until(async () => quantityOf() === 41, 'the quantity saved after a click');
    });
} finally {
    db.close();
    await browser.close();
}
process.exit(exitCode(errors));
