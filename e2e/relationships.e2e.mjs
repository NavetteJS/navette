// Relationship columns (dot notation) and relationship aggregates of the lab's orders (`/lab/relations`): cells, sorting and
// searching through the relationship, an editable relationship column, the infolist, and the export.
// Run by e2e/run.mjs, on a throwaway copy of the database. The lab resource only exists when themes are on.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, skip, exitCode } = reporter({ errorLines: 3 });
const rows = page.locator('.nv-ta-records tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)');
const cell = (row, name) => row.locator(`.nv-ta-cell-${name.replace(/_/g, '-').replace(/\./g, '\\.')}`);
const text = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const firstCell = (name) => `.nv-ta-records tr.nv-ta-row .nv-ta-cell-${name.replace(/_/g, '-').replace(/\./g, '\\.')}`;
const labeled = async (label, promise) => { try { return await promise; } catch (error) { throw new Error(`[${label}] ${error.message}`); } };
const LIVE = 'o.deleted_at is null';
/** Aggregates of one order, from the database. */
const aggregatesOf = (id) => db.prepare(`select (select count(*) from order_items i where i.order_id = o.id) items, (select sum(qty) from order_items i where i.order_id = o.id) qty, exists(select 1 from payments p where p.order_id = o.id) paid, c.name customer from orders o left join customers c on c.id = o.customer_id where o.id = ?`).get(id);

await login(page, BASE, user);
try {
    const response = await page.goto(`${BASE}/lab/relations`);
    if (response?.status() === 404) {
        skip('relations lab', 'the demo runs without themes (NAVETTE_NO_THEMES)');
    } else {
        await rows.first().waitFor({ timeout: 8000 });

        await step('cells: the customer through the relationship, and the item count, quantity and payment existence aggregates', async () => {
            const first = db.prepare(`select o.id from orders o where ${LIVE} order by o.number asc, o.id asc limit 1`).get();
            const expected = aggregatesOf(first.id);
            const row = rows.first();
            assert.equal(await text(cell(row, 'customer.name')), expected.customer ?? '');
            assert.equal(await text(cell(row, 'items_count')), String(expected.items));
            assert.equal(await text(cell(row, 'items_sum_qty')), String(expected.qty ?? ''));
            assert.equal(await cell(row, 'payments_exists').locator(expected.paid ? '.nv-color-success' : '.nv-color-danger').count(), 1);
            // The summary sums the item counts of every order.
            const total = db.prepare(`select count(*) n from order_items i join orders o on o.id = i.order_id where ${LIVE}`).get().n;
            assert.ok((await text(page.locator('.nv-ta-summary-row').last())).includes(total.toLocaleString('en-US')));
        });

        await step('sorting by the customer name (a subquery of the relationship), then by the item count', async () => {
            const sort = page.locator('.nv-ta-header-cell-sort-btn', { hasText: 'Customer' }).first();
            await sort.click();
            await page.locator('th.nv-ta-header-cell-customer\\.name[aria-sort="ascending"]').waitFor({ timeout: 8000 });
            await sort.click();
            await page.locator('th.nv-ta-header-cell-customer\\.name[aria-sort="descending"]').waitFor({ timeout: 8000 });
            const last = db.prepare(`select c.name from orders o join customers c on c.id = o.customer_id where ${LIVE} order by c.name desc limit 1`).get().name;
            await page.waitForFunction(([selector, name]) => document.querySelector(selector)?.innerText.trim() === name, [firstCell('customer.name'), last], { timeout: 8000 });
            const items = page.locator('.nv-ta-header-cell-sort-btn', { hasText: 'Items' }).first();
            await items.click();
            await items.click();
            await page.locator('th.nv-ta-header-cell-items-count[aria-sort="descending"]').waitFor({ timeout: 8000 });
            const most = db.prepare(`select max(n) n from (select count(i.id) n from orders o left join order_items i on i.order_id = o.id where ${LIVE} group by o.id)`).get().n;
            await page.waitForFunction(([selector, n]) => document.querySelector(selector)?.innerText.trim() === String(n), [firstCell('items_count'), most], { timeout: 8000 });
        });

        await step('global and individual searches through the customer relationship; injection attempts stay text', async () => {
            const customer = db.prepare(`select c.name from orders o join customers c on c.id = o.customer_id where ${LIVE} group by c.id order by count(*) desc, c.name limit 1`).get().name;
            const words = customer.toLowerCase().split(/\s+/);
            // Each word must match the order number or the customer's name.
            const n = db.prepare(`select count(*) n from orders o where ${LIVE} and ${words.map(() => '(exists(select 1 from customers c where c.id = o.customer_id and lower(c.name) like ?) or lower(o.number) like ?)').join(' and ')}`).get(...words.flatMap((w) => [`%${w}%`, `%${w}%`])).n;
            await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill(customer);
            await labeled(1, page.waitForFunction((k) => document.querySelector('.nv-pagination-overview')?.innerText.includes(`of ${k} `) || document.querySelectorAll('.nv-ta-records tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)').length === k, n, { timeout: 8000 }));
            assert.deepEqual([...new Set(await rows.locator('.nv-ta-cell-customer\\.name').allInnerTexts())].map((name) => name.trim()), [customer]);
            await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill("zz' or 'zz'='zz");
            await labeled('empty', page.locator('.nv-ta-empty-state').waitFor({ timeout: 8000 }));
            await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill('');
            await labeled('rows', rows.first().waitFor({ timeout: 8000 }));
            const individual = page.locator('.nv-ta-individual-search-row input').first();
            await individual.fill(customer);
            await labeled(2, page.waitForFunction((name) => { const cells = [...document.querySelectorAll('.nv-ta-records tr.nv-ta-row .nv-ta-cell-customer\\.name')]; return cells.length > 0 && cells.every((c) => c.innerText.trim() === name); }, customer, { timeout: 8000 }));
            await individual.fill('');
            await labeled(3, page.waitForFunction(() => document.querySelector('.nv-pagination-overview') !== null, null, { timeout: 8000 }));
        });

        await step('an editable relationship column saves the phone of the order\'s customer', async () => {
            await page.goto(`${BASE}/lab/relations`);
            await rows.first().waitFor({ timeout: 8000 });
            const order = db.prepare(`select o.id, o.number, o.customer_id from orders o where ${LIVE} and o.customer_id is not null order by o.id limit 1`).get();
            await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill(order.number);
            await page.waitForFunction(() => document.querySelectorAll('.nv-ta-records tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)').length === 1, null, { timeout: 8000 });
            const input = cell(rows.first(), 'customer.phone').locator('input.nv-input');
            const saved = page.waitForResponse((r) => r.url().includes('/livewire') && (r.request().postData() ?? '').includes('updateTableColumnState'));
            await input.fill('+33 1 23 45 67 89');
            await input.blur();
            await saved;
            assert.equal(db.prepare('select phone from customers where id = ?').get(order.customer_id).phone, '+33 1 23 45 67 89');
        });

        await step('view page: relationship entries loaded on demand, and the aggregate entries', async () => {
            const order = db.prepare(`select o.id from orders o where ${LIVE} and o.customer_id is not null and exists(select 1 from payments p where p.order_id = o.id) order by o.id limit 1`).get();
            await page.goto(`${BASE}/lab/relations/${order.id}`);
            const entries = page.locator('.nv-in-entry');
            await entries.first().waitFor({ timeout: 8000 });
            const entry = async (label) => text(entries.filter({ has: page.locator('.nv-in-entry-label', { hasText: new RegExp(`^${label}$`) }) }).first().locator('.nv-in-entry-content-col'));
            const expected = aggregatesOf(order.id);
            assert.equal(await entry('Customer'), expected.customer);
            assert.equal(await entry('Items'), String(expected.items));
            assert.equal(await entry('Quantity'), String(expected.qty));
            const products = db.prepare('select distinct p.name from order_items i join products p on p.id = i.product_id where i.order_id = ?').all(order.id).map((row) => row.name);
            const shown = await entry('Products');
            for (const name of products) assert.ok(shown.includes(name), `${name} in ${shown}`);
        });

        await step('export: the customer column and the aggregates are written to the file', async () => {
            await page.goto(`${BASE}/lab/relations`);
            await rows.first().waitFor({ timeout: 8000 });
            const first = db.prepare(`select o.id, o.number from orders o where ${LIVE} order by o.number asc, o.id asc limit 1`).get();
            await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill(first.number);
            await page.waitForFunction((number) => [...document.querySelectorAll('.nv-ta-records tr.nv-ta-row .nv-ta-cell-number')].every((c) => c.innerText.includes(number)), first.number, { timeout: 8000 });
            await page.locator('.nv-ta-header .nv-ac-btn-action', { hasText: /Export/ }).first().click();
            const modal = page.locator('.nv-modal-window:visible');
            await modal.waitFor({ timeout: 5000 });
            await modal.locator('.nv-modal-footer button', { hasText: 'Export' }).click();
            const link = page.locator('.nv-no-notification a', { hasText: /\.csv/i }).first();
            await link.waitFor({ timeout: 8000 });
            const csv = (await (await page.request.get(new URL(await link.getAttribute('href'), BASE).toString())).text()).replace(/^﻿/, '');
            const lines = csv.trim().split(/\r?\n/);
            assert.equal(lines[0], 'Number,Customer,Items,Quantity,Paid');
            const expected = aggregatesOf(first.id);
            const line = lines.find((l) => l.startsWith(`${first.number},`));
            assert.ok(line, csv);
            assert.ok(line.includes(`,${expected.items},${expected.qty ?? ''},`), line);
        });
    }
    if (errors.length) throw new Error(errors.join('\n'));
} finally {
    await browser.close();
    db.close?.();
}
process.exit(exitCode());
