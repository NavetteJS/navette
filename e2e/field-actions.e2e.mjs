// Customizable field actions in the lab panel: a repeater's delete confirmed in a modal, "Insert between" and an extra item
// action, and a checkbox list saving a many-to-many relationship. Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile);
const modal = () => page.locator('.nv-modal.nv-modal-open .nv-modal-window');
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };

const repeater = () => page.locator('.nv-fo-repeater').first();
const items = () => repeater().locator(':scope > ul > li.nv-fo-repeater-item');
/** Value of the name field of each item, in display order. */
const names = async () => {
    const values = [];
    for (const item of await items().all()) values.push(await item.locator('input[type="text"], input:not([type])').first().inputValue());
    return values;
};
const setName = async (index, value) => { await items().nth(index).locator('input[type="text"], input:not([type])').first().fill(value); };

await login(page, BASE, user);
try {
    await step('repeater: "Insert between" adds an item between two others', async () => {
        await page.goto(`${BASE}/lab/fields/create`);
        await until(async () => (await items().count()) === 1, 'the default item');
        await repeater().getByRole('button', { name: 'Add to contacts' }).click();
        await until(async () => (await items().count()) === 2, 'a second item');
        await setName(0, 'Ada');
        await setName(1, 'Grace');
        const between = repeater().locator('.nv-fo-repeater-add-between-items-ctn');
        assert.equal(await between.count(), 1, 'one "Insert between" button between two items');
        await between.getByRole('button', { name: 'Insert between' }).click();
        await until(async () => (await items().count()) === 3, 'the inserted item');
        assert.deepEqual(await names(), ['Ada', '', 'Grace']);
        assert.equal(await repeater().locator('.nv-fo-repeater-add-between-items-ctn').count(), 2);
    });

    await step('repeater: delete asks for a confirmation in a modal; cancelling keeps the item', async () => {
        await items().nth(1).getByRole('button', { name: 'Delete' }).click();
        await modal().waitFor();
        assert.match(await modal().innerText(), /Remove this contact\?/);
        await modal().getByRole('button', { name: 'Cancel' }).click();
        await modal().waitFor({ state: 'hidden' });
        assert.equal(await items().count(), 3);
        await items().nth(1).getByRole('button', { name: 'Delete' }).click();
        await modal().waitFor();
        await modal().getByRole('button', { name: 'Confirm' }).click();
        await until(async () => (await items().count()) === 2, 'the deleted item');
        assert.deepEqual(await names(), ['Ada', 'Grace']);
    });

    await step('repeater: an extra item action receives its item and validates it', async () => {
        await items().nth(1).getByRole('button', { name: 'Greet' }).click();
        await modal().waitFor();
        await modal().getByRole('button', { name: 'Confirm' }).click();
        await page.getByText('Hello Grace').waitFor({ timeout: 10000 });
    });

    await step('checkbox list: checked categories are linked to the product, unchecked ones unlinked', async () => {
        const product = db.prepare('select id from products order by id limit 1').get();
        const categories = db.prepare('select id, name from product_categories where parent_id is null order by name limit 2').all();
        db.prepare('delete from product_category_product where product_id = ?').run(product.id);
        await page.goto(`${BASE}/lab/cards/${product.id}/edit`);
        const list = page.locator('.nv-fo-checkbox-list');
        await list.waitFor();
        for (const category of categories) await list.getByLabel(category.name, { exact: true }).check();
        await page.getByRole('button', { name: 'Save changes' }).click();
        const linked = () => db.prepare('select product_category_id as id from product_category_product where product_id = ? order by product_category_id').all(product.id).map((row) => row.id);
        await until(() => linked().length === 2, 'two linked categories');
        assert.deepEqual(linked(), categories.map((category) => category.id).sort((a, b) => a - b));
        await page.reload();
        await list.waitFor();
        assert.equal(await list.getByLabel(categories[0].name, { exact: true }).isChecked(), true, 'the links are loaded with the record');
        await list.getByLabel(categories[0].name, { exact: true }).uncheck();
        await page.getByRole('button', { name: 'Save changes' }).click();
        await until(() => linked().length === 1, 'one category unlinked');
        assert.deepEqual(linked(), [categories[1].id]);
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'field-actions.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
