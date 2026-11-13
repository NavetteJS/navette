// Relation managers on a customer's edit page: lazy child components, tabs, and the Addresses manager actions.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
// A customer with payments, to check the second tab with rows.
const paying = db.prepare('select o.customer_id as id, count(*) as n from payments p join orders o on o.id = p.order_id join customers c on c.id = o.customer_id and c.deleted_at is null group by o.customer_id order by n desc limit 1').get();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter({ errorLines: 5 });
const manager = page.locator('.fi-resource-relation-manager');
const texts = async (locator) => (await locator.allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());

await login(page, BASE, user);

// Seeded customer 118 has two addresses and no payment.
await step('"Addresses" and "Payments" tabs, the first one active', async () => {
    await page.goto(`${BASE}/shop/customers/118/edit`);
    assert.deepEqual(await texts(page.locator('.fi-sc-tabs .fi-tabs-item')), ['Addresses', 'Payments']);
    assert.equal(await page.locator('.fi-sc-tabs .fi-tabs-item').first().getAttribute('aria-selected'), 'true');
});
await step('"Addresses" loads once visible: 2 addresses sorted by city', async () => {
    await manager.locator('.fi-ta-table').waitFor({ timeout: 8000 });
    assert.equal((await manager.locator('.fi-ta-header-heading').innerText()).trim(), 'Addresses');
    assert.deepEqual(await texts(manager.locator('.fi-ta-records .fi-ta-cell-city .fi-ta-text')), ['Gutmannview', 'South Dianatown']);
    assert.deepEqual(await texts(manager.locator('.fi-ta-records .fi-ta-cell-country .fi-ta-text')), ['Canada', 'Japan']);
});
await step('saving the customer form keeps the loaded relation manager', async () => {
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.locator('.fi-no-notification', { hasText: 'Saved' }).waitFor({ timeout: 5000 });
    assert.equal(await manager.locator('.fi-ta-records tr').count(), 2);
});
await step('"Payments" tab: a new component is loaded, empty state for this customer', async () => {
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Payments' }).click();
    await manager.locator('.fi-ta-header-heading', { hasText: 'Payments' }).waitFor({ timeout: 8000 });
    assert.equal((await manager.locator('.fi-ta-empty-state-heading').innerText()).trim(), 'No payments');
    assert.equal(await page.locator('.fi-resource-relation-manager').count(), 1);
});
await step('back to "Addresses"', async () => {
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Addresses' }).click();
    await manager.locator('.fi-ta-header-heading', { hasText: 'Addresses' }).waitFor({ timeout: 8000 });
    assert.equal(await manager.locator('.fi-ta-records tr').count(), 2);
});
// ---------------------------------------------------------------- actions of the "Addresses" manager
const modal = manager.locator('.fi-modal.fi-modal-open .fi-modal-window');
const TYPE = 'App\\Models\\Shop\\Customer';
const pivot = (address) => db.prepare('select count(*) as n from addressables where address_id = ? and addressable_type = ? and addressable_id = 118').get(address, TYPE).n;
const rowOf = (text) => manager.locator('.fi-ta-records tr', { hasText: text });
const confirm = async () => { await modal.waitFor({ state: 'visible', timeout: 5000 }); const heading = (await modal.locator('.fi-modal-heading').innerText()).trim(); await modal.locator('.fi-modal-footer button[type=submit]').click(); return heading; };
let created = null;
await step('manager actions: Attach / New address in the header, Edit / Detach / Delete per row', async () => {
    assert.deepEqual(await texts(manager.locator('.fi-ta-header .fi-ta-actions button')), ['Attach', 'New address']);
    assert.deepEqual(await texts(manager.locator('.fi-ta-records tr').first().locator('.fi-ac-link-action')), ['Edit', 'Detach', 'Delete']);
});
await step('"New address": created and attached to the customer', async () => {
    await manager.locator('.fi-ta-header button', { hasText: 'New address' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Create Address');
    await modal.locator('input[id$=".street"]').fill('1 Navette Street');
    await modal.locator('input[id$=".zip"]').fill('75001');
    await modal.locator('input[id$=".city"]').fill('Aaa Navetteville');
    await modal.locator('.fi-select-input-btn').click();
    await page.locator('.fi-select-input-option', { hasText: 'France' }).click();
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'Created' }).waitFor({ timeout: 5000 });
    created = db.prepare("select * from addresses where street = '1 Navette Street'").get();
    assert.equal(created.country, 'fr');
    assert.equal(pivot(created.id), 1);
    await rowOf('Aaa Navetteville').waitFor({ timeout: 5000 });
    assert.equal(await manager.locator('.fi-ta-records tr').count(), 3);
});
await step('"Edit" (click on the row): form filled in, change saved', async () => {
    await rowOf('Aaa Navetteville').locator('.fi-ta-cell-street button').click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Edit 1 Navette Street, 75001 Aaa Navetteville');
    await page.waitForFunction(() => document.querySelector('.fi-resource-relation-manager .fi-modal-window input[id$=".zip"]')?.value === '75001', null, { timeout: 5000 });
    await modal.locator('input[id$=".zip"]').fill('75002');
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    assert.equal(db.prepare('select zip from addresses where id = ?').get(created.id).zip, '75002');
});
await step('"Detach": the link goes away, the address stays', async () => {
    await rowOf('Aaa Navetteville').locator('.fi-ac-link-action', { hasText: 'Detach' }).click();
    assert.equal(await confirm(), 'Detach 1 Navette Street, 75002 Aaa Navetteville');
    await page.locator('.fi-no-notification', { hasText: 'Detached' }).waitFor({ timeout: 5000 });
    assert.equal(pivot(created.id), 0);
    assert.ok(db.prepare('select id from addresses where id = ?').get(created.id));
    await page.waitForFunction(() => document.querySelectorAll('.fi-resource-relation-manager .fi-ta-records tr').length === 2, null, { timeout: 5000 });
});
await step('"Attach": server-side search, then attached', async () => {
    await manager.locator('.fi-ta-header button', { hasText: 'Attach' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Attach Address');
    await modal.locator('.fi-select-input-btn').click();
    await modal.locator('.fi-select-input input').first().fill('Navette Street');
    const option = page.locator('.fi-select-input-option', { hasText: '1 Navette Street' });
    await option.waitFor({ timeout: 8000 });
    await option.click();
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'Attached' }).waitFor({ timeout: 5000 });
    assert.equal(pivot(created.id), 1);
    await rowOf('Aaa Navetteville').waitFor({ timeout: 5000 });
});
await step('forged attach of an address already attached or missing: refused by validation', async () => {
    await manager.locator('.fi-ta-header button', { hasText: 'Attach' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await page.evaluate(async (key) => { const c = window.Livewire.all().find((x) => x.el.classList.contains('fi-resource-relation-manager')); await c.$wire.set('mountedActions.0.data.recordId', key, false); await c.$wire.callMountedAction(); }, String(created.id));
    await modal.locator('.fi-fo-field-wrp-error-message', { hasText: 'invalid' }).waitFor({ timeout: 5000 });
    assert.equal(pivot(created.id), 1);
    await modal.locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('forged selection: "Delete selected" cannot delete another customer\'s address', async () => {
    const foreign = db.prepare('select address_id as id from addressables where addressable_type = ? and addressable_id <> 118 limit 1').get(TYPE).id;
    await page.evaluate(async (key) => {
        const c = window.Livewire.all().find((x) => x.el.classList.contains('fi-resource-relation-manager'));
        await c.$wire.set('selectedTableRecords', [key], false);
        await c.$wire.mountAction('delete', {}, { table: true, bulk: true });
        await c.$wire.callMountedAction();
    }, String(foreign));
    await page.waitForTimeout(500);
    assert.ok(db.prepare('select id from addresses where id = ?').get(foreign));
    assert.equal(db.prepare('select count(*) as n from addressables where address_id = ?').get(foreign).n >= 1, true);
});
await step('"Delete": the address and its link are deleted', async () => {
    await page.reload();
    await rowOf('Aaa Navetteville').waitFor({ timeout: 8000 });
    await rowOf('Aaa Navetteville').locator('.fi-ac-link-action', { hasText: 'Delete' }).click();
    assert.equal(await confirm(), 'Delete 1 Navette Street, 75002 Aaa Navetteville');
    await page.locator('.fi-no-notification', { hasText: 'Deleted' }).waitFor({ timeout: 5000 });
    assert.equal(db.prepare('select count(*) as n from addresses where id = ?').get(created.id).n, 0);
    assert.equal(db.prepare('select count(*) as n from addressables where address_id = ?').get(created.id).n, 0);
});
await step('"Payments" of a customer who has some: rows, amount, sort and search', async () => {
    const response = await page.goto(`${BASE}/shop/customers/${paying.id}/edit`);
    assert.equal(response.status(), 200, `customer ${paying.id}: status ${response.status()} — ${(await response.text()).slice(0, 300)}`);
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Payments' }).click();
    await manager.locator('.fi-ta-header-heading', { hasText: 'Payments' }).waitFor({ timeout: 8000 });
    assert.equal(await manager.locator('.fi-ta-records tr').count(), Math.min(paying.n, 10));
    assert.match(await manager.locator('.fi-ta-cell-amount').first().innerText(), /\$[\d,]+\.\d\d/);
    const reference = db.prepare('select p.reference from payments p join orders o on o.id = p.order_id where o.customer_id = ? limit 1').get(paying.id).reference;
    await manager.locator('.fi-ta-search-field input').fill(reference);
    await page.waitForFunction(() => document.querySelectorAll('.fi-resource-relation-manager .fi-ta-records tr').length === 1, null, { timeout: 5000 });
});
await step('the owner key cannot be changed from the browser (403)', async () => {
    const status = await page.evaluate(async () => {
        const component = window.Livewire.all().find((c) => c.el.classList.contains('fi-resource-relation-manager'));
        const response = await fetch('/livewire/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _token: document.querySelector('[data-csrf]').dataset.csrf, components: [{ snapshot: component.snapshotEncoded, updates: { ownerRecord: '1' }, calls: [] }] }) });
        return response.status;
    });
    assert.equal(status, 403);
});
await step('no JavaScript error', async () => { assert.deepEqual(errors, []); });

await browser.close();
process.exit(exitCode());
