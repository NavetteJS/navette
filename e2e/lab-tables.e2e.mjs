// Table features of the lab panel's products: icon count summary, group summaries through the "Group records" trigger,
// several bulk action menus, tab attributes and a tab that does not restrict record resolution.
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
const { step, exitCode } = reporter({ errorLines: 3 });
const toolbar = () => page.locator('.fi-ta-header-toolbar');
const notification = (title) => page.locator('.fi-no-notification-title', { hasText: title });
/** Waits for the next Livewire answer whose request mentions `text`. */
const answer = (text) => page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes(text));
const numbers = async (locator) => (await locator.allInnerTexts()).map((text) => Number(text.trim()));

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/lab/products`);
    await page.locator('.fi-ta-records').waitFor();

    await step('the "Low stock" tab has its extra attribute', async () => {
        const tab = page.locator('[data-cy="low-stock-tab"]');
        assert.equal(await tab.count(), 1);
        assert.match(await tab.getAttribute('class'), /fi-tabs-item/);
        assert.match(await tab.innerText(), /Low stock/);
    });

    await step('icon count summary: one icon per featured state, with the number of products', async () => {
        const expected = db.prepare('select featured, count(*) c from products group by featured').all().filter((row) => row.featured !== null).map((row) => row.c).sort((a, b) => a - b);
        // Several pages: the "All products" row covers every record.
        const all = page.locator('.fi-ta-summary-row', { hasText: 'All products' }).locator('.fi-ta-icon-count-summary');
        await all.waitFor();
        assert.deepEqual((await numbers(all.locator('li > span'))).sort((a, b) => a - b), expected);
        assert.equal(await all.locator('li svg.fi-icon').count(), expected.length);
        // The page row counts the displayed records only.
        const onPage = await numbers(page.locator('.fi-ta-summary-row', { hasText: 'This page' }).locator('.fi-ta-icon-count-summary li > span'));
        assert.equal(onPage.reduce((total, n) => total + n, 0), await page.locator('.fi-ta-records > tr.fi-ta-row:not(.fi-ta-summary-row):not(.fi-ta-summary-header-row)').count());
    });

    await step('two bulk menus: "Bulk actions" and "Visibility", whose "Hide" action hides the selected products', async () => {
        const menus = toolbar().locator('.fi-ta-actions > .fi-dropdown');
        assert.equal(await menus.first().isVisible(), false, 'hidden without a selection');
        const checkboxes = page.locator('.fi-ta-record-checkbox');
        const keys = [await checkboxes.nth(0).getAttribute('value'), await checkboxes.nth(1).getAttribute('value')];
        db.prepare(`update products set is_visible = 1 where id in (?, ?)`).run(...keys);
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await page.locator('.fi-ta-selection-indicator').getByText('2 records selected').waitFor();
        const labels = await menus.locator('.fi-dropdown-trigger .fi-btn').allInnerTexts();
        assert.deepEqual(labels.map((label) => label.trim()), ['Bulk actions', 'Visibility']);
        // The default menu keeps its actions.
        await menus.nth(0).locator('.fi-dropdown-trigger .fi-btn').click();
        await menus.nth(0).locator('.fi-dropdown-list-item', { hasText: 'Delete selected' }).waitFor();
        await page.keyboard.press('Escape');
        await menus.nth(1).locator('.fi-dropdown-trigger .fi-btn').click();
        const items = await menus.nth(1).locator('.fi-dropdown-list-item').allInnerTexts();
        assert.deepEqual(items.map((item) => item.trim()), ['Show', 'Hide']);
        await menus.nth(1).locator('.fi-dropdown-list-item', { hasText: 'Hide' }).click();
        await notification('2 product(s) hidden').waitFor();
        assert.deepEqual(db.prepare('select is_visible from products where id in (?, ?)').all(...keys).map((row) => row.is_visible), [0, 0]);
    });

    await step('a tab that excludes its query from record resolution: a product restocked meanwhile is restocked again', async () => {
        const tab = page.locator('[data-cy="low-stock-tab"]');
        const switched = answer('activeTab');
        await tab.click();
        await switched;
        await page.waitForLoadState('networkidle');
        const firstRow = page.locator('.fi-ta-records > tr.fi-ta-row').first();
        const key = await firstRow.getAttribute('wire:key').then((value) => value.split('.').pop());
        assert.ok(db.prepare('select qty from products where id = ?').get(key).qty < 10);
        await firstRow.getByRole('button', { name: 'More' }).click();
        await page.locator('.fi-dropdown-list-item', { hasText: 'Restock' }).first().click();
        const modal = page.locator('.fi-modal.fi-modal-open .fi-modal-window');
        await modal.waitFor();
        // Meanwhile, the product leaves the "Low stock" tab.
        db.prepare('update products set qty = 20 where id = ?').run(key);
        await modal.getByRole('button', { name: 'Confirm' }).click();
        await notification('Restocked (+10)').waitFor();
        assert.equal(db.prepare('select qty from products where id = ?').get(key).qty, 30);
    });

    await step('"Group records" opens the grouping settings; group summaries match the database', async () => {
        // The trigger is the grouping dropdown, shown below the `sm` breakpoint.
        await page.setViewportSize({ width: 600, height: 1000 });
        await page.goto(`${BASE}/lab/products`);
        const trigger = toolbar().getByRole('button', { name: 'Group records' });
        await trigger.waitFor();
        assert.match(await trigger.getAttribute('class'), /fi-btn/);
        await trigger.click();
        const grouped = answer('tableGrouping');
        await page.locator('.fi-ta-grouping-settings .fi-dropdown-panel select').first().selectOption('brand_id');
        await grouped;
        await page.waitForLoadState('networkidle');
        await page.locator('.fi-ta-group-heading').first().waitFor();
        // Groups complete on the page get their summary row, computed by one grouped query: compare their totals.
        const rows = page.locator('.fi-ta-summary-row', { hasText: /Brand #\d+ summary/ });
        assert.ok(await rows.count() > 0);
        const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        for (const text of await rows.allInnerTexts()) {
            const brand = Number(text.match(/Brand #(\d+) summary/)[1]);
            const total = db.prepare('select sum(price) s from products where brand_id = ?').get(brand).s ?? 0;
            assert.ok(text.includes(money.format(total)), `${text} should include ${money.format(total)}`);
        }
    });
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
