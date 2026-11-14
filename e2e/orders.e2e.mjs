// Orders: tabs with counts, summaries, sorting and searching on the customer, status actions, the form and its order items repeater.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const count = (status) => db.prepare(`select count(*) as n from orders where deleted_at is null ${status ? 'and status = ?' : ''}`).get(...(status ? [status] : [])).n;
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const statusOf = (id) => db.prepare('select status from orders where id = ?').get(id).status;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter({ errorLines: 5 });
const texts = async (locator) => (await locator.allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
const rows = page.locator('.nv-ta-records tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)');
const menuOf = async (row) => { await row.locator('.nv-dropdown-trigger button').click(); const panel = page.locator('.nv-dropdown-panel:visible'); await panel.waitFor({ timeout: 5000 }); return panel; };
const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');

await login(page, BASE, user);

await step('list: columns, status badge, date, most recent orders first', async () => {
    await page.goto(`${BASE}/shop/orders`);
    assert.deepEqual((await texts(page.locator('thead .nv-ta-header-cell'))).filter(Boolean), ['Number', 'Customer', 'Status', 'Total price', 'Shipping cost', 'Order date']);
    const latest = db.prepare('select number, status, created_at from orders where deleted_at is null order by created_at desc, id asc limit 1').get();
    assert.equal((await rows.first().locator('.nv-ta-cell-number').innerText()).trim(), latest.number);
    assert.equal(await rows.first().locator('.nv-ta-cell-status .nv-badge').count(), 1);
    assert.match(await rows.first().locator('.nv-ta-cell-created-at').innerText(), /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/m);
});
await step('summaries: "This page" and "All orders" match the database', async () => {
    const all = db.prepare('select sum(total_price) as t, sum(shipping_price) as s from orders where deleted_at is null').get();
    const summary = await texts(page.locator('.nv-ta-summary-row'));
    assert.equal(summary.length, 2);
    assert.match(summary[0], /^This page/);
    assert.equal(summary[1], `All orders Sum ${money(all.t)} Sum ${money(all.s)}`);
});
await step('tabs: counts loaded afterwards, equal to the database', async () => {
    await page.locator('.nv-tabs-item .nv-badge-label').first().waitFor({ timeout: 8000 });
    assert.deepEqual(await texts(page.locator('.nv-tabs-item')), [`All ${count()}`, `New ${count('new')}`, `Processing ${count('processing')}`, `Shipped ${count('shipped')}`, `Delivered ${count('delivered')}`, `Cancelled ${count('cancelled')}`]);
});
await step('"Processing" tab: table and summaries restricted', async () => {
    await page.locator('.nv-tabs-item', { hasText: 'Processing' }).click();
    await page.waitForFunction((n) => document.querySelector('.nv-pagination-overview')?.innerText.includes(`of ${n} `), count('processing').toLocaleString('en-US'), { timeout: 8000 });
    assert.deepEqual([...new Set(await texts(rows.locator('.nv-ta-cell-status')))], ['Processing']);
    const sum = db.prepare("select sum(total_price) as t from orders where deleted_at is null and status = 'processing'").get().t;
    assert.ok((await texts(page.locator('.nv-ta-summary-row'))).at(-1).includes(money(sum)));
});
await step('forged unknown tab: treated as the default tab', async () => {
    await page.evaluate(async () => { const c = window.Livewire.all().find((x) => x.el.querySelector('.nv-ta')); await c.$wire.set('activeTab', "x' or 1=1 --"); });
    await page.waitForFunction((n) => document.querySelector('.nv-pagination-overview')?.innerText.includes(`of ${n} `), count().toLocaleString('en-US'), { timeout: 8000 });
});
await step('sort and search on the customer name', async () => {
    await page.goto(`${BASE}/shop/orders`);
    // Descending sort (two clicks): ascending, SQLite puts orders without a customer first.
    const sort = page.locator('.nv-ta-header-cell-sort-btn', { hasText: 'Customer' });
    await sort.click();
    await page.locator('th.nv-ta-header-cell-customer\\.name[aria-sort="ascending"]').waitFor({ timeout: 8000 });
    await sort.click();
    const last = db.prepare('select c.name from orders o join customers c on c.id = o.customer_id where o.deleted_at is null order by c.name desc limit 1').get().name;
    await page.waitForFunction((name) => document.querySelector('.nv-ta-records tr .nv-ta-cell-customer\\.name')?.innerText.trim() === name, last, { timeout: 8000 });
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill(last);
    const words = last.toLowerCase().split(/\s+/);
    const n = db.prepare(`select count(*) as n from orders o join customers c on c.id = o.customer_id where o.deleted_at is null and ${words.map(() => 'lower(c.name) like ?').join(' and ')}`).get(...words.map((w) => `%${w}%`)).n;
    await page.waitForFunction((k) => document.querySelector('.nv-pagination-overview')?.innerText.includes(`of ${k} `) || document.querySelectorAll('.nv-ta-records tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)').length === k, n, { timeout: 8000 });
    assert.deepEqual([...new Set(await texts(rows.locator('.nv-ta-cell-customer\\.name')))], [last]);
});
await step('"Process", then "Ship" (form), then "Deliver" (confirmation): the status follows in the database', async () => {
    const order = db.prepare("select id, number from orders where deleted_at is null and status = 'new' order by id limit 1").get();
    await page.goto(`${BASE}/shop/orders`);
    await page.locator('.nv-ta-header-toolbar .nv-ta-search-field input').fill(order.number);
    await page.waitForFunction(() => document.querySelectorAll('.nv-ta-records tr.nv-ta-row:not(.nv-ta-summary-row):not(.nv-ta-summary-header-row)').length === 1, null, { timeout: 8000 });
    let panel = await menuOf(rows.first());
    assert.deepEqual(await texts(panel.locator('.nv-dropdown-list-item-label')), ['Process', 'Edit', 'Cancel', 'Delete']);
    await panel.locator('.nv-dropdown-list-item', { hasText: 'Process' }).click();
    await rows.first().locator('.nv-ta-cell-status', { hasText: 'Processing' }).waitFor({ timeout: 5000 });
    assert.equal(statusOf(order.id), 'processing');
    panel = await menuOf(rows.first());
    await panel.locator('.nv-dropdown-list-item', { hasText: 'Ship' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('textarea').fill('Test parcel');
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    await rows.first().locator('.nv-ta-cell-status', { hasText: 'Shipped' }).waitFor({ timeout: 5000 });
    assert.deepEqual(Object.values(db.prepare('select status, notes from orders where id = ?').get(order.id)), ['shipped', 'Test parcel']);
    panel = await menuOf(rows.first());
    assert.equal(await panel.locator('.nv-dropdown-list-item', { hasText: 'Cancel' }).getAttribute('aria-disabled'), 'true');
    await panel.locator('.nv-dropdown-list-item', { hasText: 'Deliver' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    await rows.first().locator('.nv-ta-cell-status', { hasText: 'Delivered' }).waitFor({ timeout: 5000 });
    assert.equal(statusOf(order.id), 'delivered');
});
await step('forged actions: cancelling a shipped (disabled) or delivered (hidden) order is refused', async () => {
    const shipped = db.prepare("select id from orders where deleted_at is null and status = 'shipped' order by id limit 1").get().id;
    const delivered = db.prepare("select id from orders where deleted_at is null and status = 'delivered' order by id limit 1").get().id;
    const statuses = await page.evaluate(async (keys) => {
        const component = window.Livewire.all().find((c) => c.el.querySelector('.nv-ta'));
        const out = [];
        for (const key of keys) {
            const response = await fetch('/livewire/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _token: document.querySelector('[data-csrf]').dataset.csrf, components: [{ snapshot: component.snapshotEncoded, updates: {}, calls: [{ method: 'mountAction', params: ['cancel', {}, { table: true, recordKey: key }], metadata: {} }] }] }) });
            out.push(response.status);
        }
        return out;
    }, [String(shipped), String(delivered)]);
    assert.deepEqual(statuses, [403, 403]);
    assert.deepEqual([statusOf(shipped), statusOf(delivered)], ['shipped', 'delivered']);
});
const address = (id) => db.prepare("select country, street, city, state, zip from order_addresses where addressable_id = ? and addressable_type like '%Order'").get(id);
const target = db.prepare("select o.id, o.number, o.customer_id from orders o where o.deleted_at is null and o.status = 'new' and o.customer_id is not null and exists (select 1 from order_addresses a where a.addressable_id = o.id) order by o.id desc limit 1").get();
await step('edit page: sections, locked number, customer, status and address filled in', async () => {
    const response = await page.goto(`${BASE}/shop/orders/${target.id}/edit`);
    assert.equal(response.status(), 200);
    assert.equal((await page.locator('.nv-header-heading').innerText()).trim(), `Edit ${target.number}`);
    assert.equal(await page.locator('input[id="form.number"]').isDisabled(), true);
    assert.equal(await page.locator('input[id="form.number"]').inputValue(), target.number);
    const customer = db.prepare('select name from customers where id = ?').get(target.customer_id).name;
    await page.locator('.nv-fo-select .nv-select-input-btn', { hasText: customer }).waitFor({ timeout: 8000 });
    assert.equal(await page.locator('input[id="form.status-new"]').isChecked(), true);
    assert.equal(await page.locator('input[id="form.address.city"]').inputValue(), address(target.id).city ?? '');
    assert.equal((await page.locator('.nv-section-header-heading').innerText()).trim(), 'Order items');
});
await step('edit: status and address saved, the number does not change', async () => {
    await page.locator('label[for="form.status-processing"]').click();
    await page.locator('input[id="form.address.city"]').fill('Navetteville');
    await page.locator('input[id="form.address.zip"]').fill('69001');
    await page.locator('.nv-sc-form button[type=submit]').first().click();
    await page.locator('.nv-no-notification', { hasText: 'Saved' }).waitFor({ timeout: 5000 });
    const row = db.prepare('select number, status, customer_id from orders where id = ?').get(target.id);
    assert.deepEqual([row.number, row.status, row.customer_id], [target.number, 'processing', target.customer_id]);
    assert.deepEqual([address(target.id).city, address(target.id).zip], ['Navetteville', '69001']);
    assert.equal(db.prepare("select count(*) as n from order_addresses where addressable_id = ? and addressable_type like '%Order'").get(target.id).n, 1);
});
await step('forged edit: another order\'s number and an unknown status are refused', async () => {
    const other = db.prepare('select number from orders where id <> ? order by id limit 1').get(target.id).number;
    await page.evaluate(async (number) => { const c = window.Livewire.all().find((x) => x.el.querySelector('.nv-sc-form')); await c.$wire.set('data.number', number, false); await c.$wire.set('data.status', 'free', false); await c.$wire.save(); }, other);
    await page.locator('.nv-fo-field-wrp-error-message').first().waitFor({ timeout: 5000 });
    const messages = (await texts(page.locator('.nv-fo-field-wrp-error-message'))).join(' | ');
    assert.match(messages, /number has already been taken/);
    assert.match(messages, /selected status is invalid/);
    assert.equal(db.prepare('select number from orders where id = ?').get(target.id).number, target.number);
});
await step('create: suggested number, order, address and item created', async () => {
    await page.goto(`${BASE}/shop/orders/create`);
    const number = await page.locator('input[id="form.number"]').inputValue();
    assert.match(number, /^OR-\d{6}$/);
    const customer = db.prepare('select id, name from customers where deleted_at is null order by name limit 1').get();
    await page.locator('.nv-fo-select .nv-select-input-btn').first().click();
    await page.locator('.nv-select-input input').first().fill(customer.name.slice(0, 6));
    const option = page.locator('.nv-select-input-option', { hasText: customer.name }).first();
    await option.waitFor({ timeout: 8000 });
    await option.click();
    await page.locator('label[for="form.status-new"]').click();
    await page.locator('input[id="form.address.street"]').fill('2 Navette Quay');
    // The create page is a two-step wizard: details, then order items.
    await page.locator('.nv-sc-wizard button', { hasText: /^\s*Next\s*$/ }).click();
    await page.locator('.nv-fo-table-repeater tbody tr').first().locator('.nv-select-input-btn').waitFor({ state: 'visible', timeout: 8000 });
    // An order needs at least one item: the row offered by default gets a product.
    assert.equal(await page.locator('.nv-fo-table-repeater tbody tr').count(), 1);
    const product = db.prepare('select id, name, price from products order by id limit 1').get();
    await page.locator('.nv-fo-table-repeater tbody tr').first().locator('.nv-select-input-btn').click();
    await page.locator('.nv-select-input-option', { hasText: product.name }).last().click();
    await page.waitForFunction((price) => Number(document.querySelector('.nv-fo-table-repeater tbody tr input[id$=".unit_price"]')?.value) === price, product.price, { timeout: 8000 });
    await page.locator('.nv-sc-wizard button', { hasText: /^\s*Create\s*$/ }).click();
    await page.waitForURL((u) => /\/shop\/orders\/\d+\/edit$/.test(u.pathname), { timeout: 8000 });
    const row = db.prepare('select id, customer_id, status from orders where number = ?').get(number);
    assert.deepEqual([row.customer_id, row.status], [customer.id, 'new']);
    assert.equal(address(row.id).street, '2 Navette Quay');
    assert.deepEqual(db.prepare('select product_id, qty, unit_price from order_items where order_id = ?').all(row.id).map((i) => Object.values(i)), [[product.id, 1, product.price]]);
});
// ---------------------------------------------------------------- order items (Repeater)
const itemsOf = (id) => db.prepare('select id, product_id, qty, unit_price, sort from order_items where order_id = ? order by sort, id').all(id);
const withItems = db.prepare('select o.id from orders o where o.deleted_at is null and o.customer_id is not null and (select count(*) from order_items i where i.order_id = o.id) = 3 order by o.id limit 1').get().id;
const before = itemsOf(withItems);
const repeaterRows = page.locator('.nv-fo-table-repeater tbody tr');
const saveForm = async () => { await page.locator('.nv-sc-form button[type=submit]').first().click(); };
await step('order items: one row per item, product, quantity and price filled in', async () => {
    await page.goto(`${BASE}/shop/orders/${withItems}/edit`);
    await repeaterRows.nth(2).waitFor({ timeout: 8000 });
    assert.equal(await repeaterRows.count(), 3);
    assert.deepEqual(await texts(page.locator('.nv-fo-table-repeater thead th')), ['Reorder', 'Product', 'Quantity', 'Unit Price', 'Actions']);
    assert.equal(Number(await repeaterRows.first().locator('input[id$=".qty"]').inputValue()), before[0].qty);
    assert.equal(Number(await repeaterRows.first().locator('input[id$=".unit_price"]').inputValue()), before[0].unit_price);
    assert.equal(await repeaterRows.first().locator('a[aria-label="Open product"]').getAttribute('href'), `/shop/products/${before[0].product_id}/edit`);
});
await step('adding a row: the unit price follows the chosen product, a product already used is disabled', async () => {
    await page.locator('.nv-fo-table-repeater-add button').click();
    await repeaterRows.nth(3).waitFor({ timeout: 5000 });
    const used = new Set(before.map((i) => i.product_id));
    const product = db.prepare('select id, name, price from products order by id').all().find((p) => !used.has(p.id));
    const taken = db.prepare('select name from products where id = ?').get(before[0].product_id).name;
    await repeaterRows.nth(3).locator('.nv-select-input-btn').click();
    assert.equal(await page.locator('.nv-select-input-option', { hasText: taken }).last().getAttribute('aria-disabled'), 'true');
    await page.locator('.nv-select-input-option', { hasText: product.name }).last().click();
    await page.waitForFunction((price) => Number(document.querySelectorAll('.nv-fo-table-repeater tbody tr')[3]?.querySelector('input[id$=".unit_price"]')?.value) === price, product.price, { timeout: 8000 });
    await repeaterRows.nth(3).locator('input[id$=".qty"]').fill('4');
    await saveForm();
    await page.locator('.nv-no-notification', { hasText: 'Saved' }).waitFor({ timeout: 5000 });
    const after = itemsOf(withItems);
    assert.equal(after.length, 4);
    assert.deepEqual([after[3].product_id, after[3].qty, after[3].unit_price], [product.id, 4, product.price]);
    assert.deepEqual(after.slice(0, 3).map((i) => i.id), before.map((i) => i.id));
});
await step('moving and deleting rows: order and content follow in the database', async () => {
    await repeaterRows.nth(1).locator('button[data-reorder-direction="up"]').dispatchEvent('click');
    await page.waitForFunction((id) => document.querySelector('.nv-fo-table-repeater tbody tr')?.getAttribute('x-sortable-item') === `record-${id}`, before[1].id, { timeout: 5000 });
    await repeaterRows.nth(2).locator('button[title="Delete"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.nv-fo-table-repeater tbody tr').length === 3, null, { timeout: 5000 });
    await saveForm();
    await page.waitForTimeout(800);
    const after = itemsOf(withItems);
    assert.equal(after.length, 3);
    assert.deepEqual(after.slice(0, 2).map((i) => i.id), [before[1].id, before[0].id]);
    assert.equal(after.some((i) => i.id === before[2].id), false);
});
await step('forged data: duplicate product refused; a key targeting another order\'s item does not change it', async () => {
    const foreign = db.prepare('select id, order_id, qty from order_items where order_id <> ? order by id limit 1').get(withItems);
    const current = itemsOf(withItems);
    await page.evaluate(async ([foreignId, productId]) => {
        const c = window.Livewire.all().find((x) => x.el.querySelector('.nv-sc-form'));
        await c.$wire.set(`data.items.record-${foreignId}`, { product_id: String(productId), qty: 99, unit_price: 1 }, false);
        await c.$wire.save();
    }, [foreign.id, current[0].product_id]);
    await page.locator('.nv-fo-field-wrp-error-message', { hasText: 'duplicate value' }).first().waitFor({ timeout: 5000 });
    assert.equal(db.prepare('select qty from order_items where id = ?').get(foreign.id).qty, foreign.qty);
    assert.equal(itemsOf(withItems).length, current.length);
    // Same forged key, this time with an unused product: the item is created for THIS order, the other order's item is untouched.
    const free = db.prepare('select id from products order by id desc').all().find((p) => !current.some((i) => i.product_id === p.id)).id;
    await page.evaluate(async ([foreignId, productId]) => {
        const c = window.Livewire.all().find((x) => x.el.querySelector('.nv-sc-form'));
        await c.$wire.set(`data.items.record-${foreignId}.product_id`, String(productId), false);
        await c.$wire.save();
    }, [foreign.id, free]);
    await page.waitForFunction(() => document.querySelectorAll('.nv-fo-table-repeater tbody tr').length === 4, null, { timeout: 8000 });
    assert.deepEqual(Object.values(db.prepare('select order_id, qty from order_items where id = ?').get(foreign.id)), [foreign.order_id, foreign.qty]);
    assert.equal(itemsOf(withItems).length, current.length + 1);
});
await step('"Reset": confirmation, rows cleared, saving refused while there is no row', async () => {
    const count = itemsOf(withItems).length;
    await page.locator('.nv-section-header button', { hasText: 'Reset' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.nv-modal-heading').innerText()).trim(), 'Are you sure?');
    await modal.locator('.nv-modal-footer button[type=submit]').click();
    await page.waitForFunction(() => document.querySelectorAll('.nv-fo-table-repeater tbody tr').length === 0, null, { timeout: 5000 });
    await saveForm();
    await page.locator('.nv-fo-field-wrp-error-message', { hasText: 'order items field is required' }).waitFor({ timeout: 5000 });
    assert.equal(itemsOf(withItems).length, count);
});
await step('no JavaScript error', async () => { assert.deepEqual(errors, []); });

await browser.close();
process.exit(exitCode());
