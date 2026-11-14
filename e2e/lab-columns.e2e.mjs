// Column, filter and selection options of the lab's "Columns lab" table (`apps/demo/lab-columns.ts`): column URL in a new tab,
// header tooltip, column group, extra cell attributes, French number and money formats, a select column searched on the server,
// filter labels from records, the remove-all filters action, `excludeWhenResolvingRecord()`, `selectable()` with an action using
// `accessSelectedRecords()`, and the selection kept while searching.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 3 });
const rows = () => page.locator('.nv-ta-records > tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)');
const notification = (title) => page.locator('.nv-no-notification', { has: page.locator('.nv-no-notification-title', { hasText: title }) });
const answer = (text) => page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes(text));
const firstKey = async () => rows().first().locator('.nv-ta-record-checkbox').getAttribute('value');

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/lab/columns-lab`);
    await page.locator('.nv-ta-records').waitFor();

    await step('column options: URL in a new tab, header tooltip, column group, extra cell attributes and alignments', async () => {
        const first = db.prepare('select slug from products order by id limit 1').get();
        const link = rows().first().locator('td.nv-ta-cell-name a.nv-ta-col-has-column-url');
        assert.equal(await link.getAttribute('target'), '_blank');
        assert.equal(await link.getAttribute('href'), `https://example.com/products/${encodeURIComponent(first.slug)}`);
        const tooltip = page.locator('th.nv-ta-header-cell-name .nv-ta-header-cell-tooltip');
        await tooltip.hover();
        await page.locator('.tippy-box', { hasText: 'Name shown in the shop' }).waitFor();
        const group = page.locator('th[data-cy="stock-group"]');
        assert.equal((await group.innerText()).trim(), 'Stock');
        assert.equal(await group.getAttribute('colspan'), '2');
        assert.match(await group.getAttribute('class'), /nv-ta-header-group-cell nv-wrapped nv-align-center/);
        const sku = rows().first().locator('td[data-cy="sku-cell"]');
        assert.match(await sku.getAttribute('class'), /nv-ta-cell-sku[^"]*nv-vertical-align-start/);
        assert.match(await rows().first().locator('td.nv-ta-cell-qty').getAttribute('class'), /nv-align-end/);
        assert.ok(await rows().first().locator('[data-cy="description"]').count());
    });

    await step('French money and number formats, ISO date tooltip, text limit with its own ending', async () => {
        const product = db.prepare('select price, description, published_at from products order by id limit 1').get();
        const price = new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR' }).format(product.price);
        assert.equal((await rows().first().locator('td.nv-ta-cell-price').innerText()).trim(), price);
        const description = (await rows().first().locator('td.nv-ta-cell-description').innerText()).trim();
        if (product.description && [...product.description].length > 24) assert.match(description, / \[…\]$/);
        await rows().first().locator('td.nv-ta-cell-published-at .nv-ta-text-item span').hover();
        await page.locator('.tippy-box').filter({ hasText: /^[A-Z][a-z]+ \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M$/ }).first().waitFor();
        // The page and table sums, formatted in French.
        const sum = page.locator('.nv-ta-summary-row').last().locator('.nv-ta-text-summary span').last();
        assert.match((await sum.innerText()).trim(), /^[\d\s  ]+,\d\d\s€$/);
    });

    await step('select column: brands searched on the server, the picked brand is saved', async () => {
        const key = await firstKey();
        const target = db.prepare("select id, name from brands where name like '%' || ? || '%' order by name limit 1").get('Inc');
        const cell = rows().first().locator('td.nv-ta-cell-brand-id');
        await cell.locator('.nv-select-input-btn').click();
        const search = cell.locator('input[type="search"], .nv-select-input-search-ctn input').first();
        await search.waitFor();
        const searched = answer('getOptionsSearchResultsForJs');
        await search.fill(target.name.slice(0, 6));
        await searched;
        const option = cell.locator('.nv-select-input-option', { hasText: target.name }).first();
        await option.waitFor();
        const saved = answer('updateTableColumnState');
        await option.click();
        await saved;
        await page.waitForLoadState('networkidle');
        assert.equal(db.prepare('select brand_id from products where id = ?').get(key).brand_id, target.id);
    });

    await step('filters: brand labels computed from the record, "Clear filters" removes them', async () => {
        const brand = db.prepare('select b.id, b.name from brands b join products p on p.brand_id = b.id order by p.id limit 1').get();
        await page.locator('.nv-ta-filters-dropdown .nv-dropdown-trigger button').click();
        const select = page.locator('.nv-ta-filters select').first();
        await select.waitFor();
        await select.selectOption({ label: `${brand.name} (#${brand.id})` });
        const applied = answer('applyTableFilters');
        await page.locator('[data-table-filter-action="apply"]').click();
        await applied;
        const indicator = page.locator('.nv-ta-filter-indicators .nv-badge-label');
        await indicator.first().waitFor();
        assert.equal((await indicator.first().innerText()).trim(), `Brand: ${brand.name} (#${brand.id})`);
        const clear = page.locator('.nv-ta-filter-indicators button', { hasText: 'Clear filters' });
        assert.match(await clear.getAttribute('class'), /nv-btn nv-size-sm/);
        const removed = answer('removeTableFilters');
        await clear.click();
        await removed;
        await page.locator('.nv-ta-filter-indicators').waitFor({ state: 'detached' });
    });

    await step('`excludeWhenResolvingRecord()`: a row action still finds a record that no longer matches the "In stock" filter', async () => {
        await page.locator('.nv-ta-filters-dropdown .nv-dropdown-trigger button').click();
        await page.locator('.nv-ta-filters').getByLabel('In stock').check();
        const applied = answer('applyTableFilters');
        await page.locator('[data-table-filter-action="apply"]').click();
        await applied;
        await page.locator('.nv-ta-filter-indicators').waitFor();
        await page.waitForLoadState('networkidle');
        const key = await firstKey();
        const name = (await rows().first().locator('td.nv-ta-cell-name').innerText()).trim();
        db.prepare('update products set qty = 0 where id = ?').run(key);
        // Record actions are icon buttons (`modifyUngroupedRecordActionsUsing()`).
        const restock = rows().first().locator('.nv-ta-actions button[aria-label="Restock"]');
        assert.match(await restock.getAttribute('class'), /nv-icon-btn/);
        await restock.click();
        await notification(`${name} restocked`).waitFor();
        assert.equal(db.prepare('select qty from products where id = ?').get(key).qty, 10);
        await page.locator('.nv-ta-filter-indicators button', { hasText: 'Clear filters' }).click();
        await page.locator('.nv-ta-filter-indicators').waitFor({ state: 'detached' });
    });

    await step('`selectable()` without bulk actions: "Check stock" reads the selection; it survives a search', async () => {
        await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('.nv-ta-header-toolbar .nv-dropdown .nv-btn', { hasText: 'Bulk actions' }).count(), 0, 'no bulk actions');
        const checkboxes = page.locator('.nv-ta-record-checkbox');
        const keys = [await checkboxes.nth(0).getAttribute('value'), await checkboxes.nth(1).getAttribute('value')];
        db.prepare('update products set qty = 5 where id = ?').run(keys[0]);
        db.prepare('update products set qty = 0 where id = ?').run(keys[1]);
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        await page.locator('.nv-ta-selection-indicator').getByText('2 records selected').waitFor();
        await page.locator('.nv-ta-header-toolbar button', { hasText: 'Check stock' }).click();
        const failure = notification('1 of 2 products in stock');
        await failure.waitFor();
        assert.match(await failure.innerText(), /1 product is out of stock\./);
        // `deselectAllRecordsWhenFiltered(false)`: searching keeps the selection.
        const searched = answer('tableSearch');
        await page.locator('.nv-ta-search-field input').fill('a');
        await searched;
        await page.waitForLoadState('networkidle');
        await page.locator('.nv-ta-selection-indicator').getByText('2 records selected').waitFor();
        db.prepare('update products set qty = 3 where id = ?').run(keys[1]);
        await page.locator('.nv-ta-header-toolbar button', { hasText: 'Check stock' }).click();
        await notification('Every selected product is in stock').waitFor();
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode());
