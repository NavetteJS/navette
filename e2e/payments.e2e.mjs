// A customer's "Payments" relation manager: column groups, column URL, toggle buttons, create / edit / delete.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
// A seeded customer with a few payments, all on one page.
const CUSTOMER = 30;
const payments = () => db.prepare('select p.* from payments p join orders o on o.id = p.order_id where o.customer_id = ? order by p.created_at desc, p.id').all(CUSTOMER);
const order = db.prepare('select id, number from orders where customer_id = ? and deleted_at is null order by number limit 1').get(CUSTOMER);
const foreignOrder = db.prepare('select id from orders where customer_id <> ? limit 1').get(CUSTOMER);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter({ errorLines: 5 });
const manager = page.locator('.fi-resource-relation-manager');
const modal = manager.locator('.fi-modal.fi-modal-open .fi-modal-window');
const texts = async (locator) => (await locator.allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
const wire = (fn, arg) => page.evaluate(fn, arg);

await login(page, BASE, user);

const initial = payments().length;
await step('"Payments": column groups, rows, link to the order', async () => {
    await page.goto(`${BASE}/shop/customers/${CUSTOMER}/edit`);
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Payments' }).click();
    await manager.locator('.fi-ta-header-heading', { hasText: 'Payments' }).waitFor({ timeout: 8000 });
    assert.deepEqual(await texts(manager.locator('.fi-ta-header-group-cell')), ['Details', 'Context']);
    assert.deepEqual((await texts(manager.locator('.fi-ta-header-cell'))).filter(Boolean), ['Order', 'Reference', 'Amount', 'Provider', 'Method']);
    assert.equal(await manager.locator('.fi-ta-records tr').count(), initial);
    const first = payments()[0];
    assert.equal(await manager.locator('.fi-ta-records tr').first().locator('a.fi-ta-col-has-column-url').getAttribute('href'), `/shop/orders/${first.order_id}/edit`);
});
await step('"New payment": toggle button form, record created', async () => {
    await manager.locator('.fi-ta-header button', { hasText: 'New payment' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Create Payment');
    assert.deepEqual(await texts(modal.locator('.fi-fo-toggle-buttons label')), ['Stripe', 'PayPal', 'Credit Card', 'Bank Transfer', 'PayPal', 'Apple Pay', 'Google Pay']);
    await modal.locator('.fi-select-input-btn').first().click();
    await modal.locator('.fi-select-input input').first().fill(order.number.slice(0, 5));
    const option = page.locator('.fi-select-input-option', { hasText: order.number });
    await option.waitFor({ timeout: 8000 });
    await option.click();
    await modal.locator('input[id$=".reference"]').fill('NAVETTE-TEST-1');
    await modal.locator('input[id$=".amount"]').fill('123.45');
    await modal.locator('.fi-select-input-btn').nth(1).click();
    await page.locator('.fi-select-input-option', { hasText: 'Euro' }).click();
    await modal.locator('label', { hasText: 'Stripe' }).click();
    await modal.locator('label', { hasText: 'Apple Pay' }).click();
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    const row = db.prepare("select * from payments where reference = 'NAVETTE-TEST-1'").get();
    assert.deepEqual([row.order_id, row.amount, row.currency, row.provider, row.method], [order.id, 123.45, 'eur', 'stripe', 'apple_pay']);
    await manager.locator('.fi-ta-records tr', { hasText: 'NAVETTE-TEST-1' }).waitFor({ timeout: 5000 });
    assert.match(await manager.locator('.fi-ta-records tr', { hasText: 'NAVETTE-TEST-1' }).locator('.fi-ta-cell-amount').innerText(), /€123\.45/);
});
await step('server validation: malformed amount and another customer\'s order refused', async () => {
    const before = payments().length;
    await manager.locator('.fi-ta-header button', { hasText: 'New payment' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await wire(async (foreign) => {
        const c = window.Livewire.all().find((x) => x.el.classList.contains('fi-resource-relation-manager'));
        await c.$wire.set('mountedActions.0.data', { order_id: foreign, reference: 'NAVETTE-FORGED', amount: '12.345', currency: 'eur', provider: 'stripe', method: 'magic-transfer' }, false);
        await c.$wire.callMountedAction();
    }, String(foreignOrder.id));
    await modal.locator('.fi-fo-field-wrp-error-message').first().waitFor({ timeout: 5000 });
    const messages = (await texts(modal.locator('.fi-fo-field-wrp-error-message'))).join(' | ');
    assert.match(messages, /selected order is invalid/);
    assert.match(messages, /amount field format is invalid/);
    assert.match(messages, /selected method is invalid/);
    assert.equal(payments().length, before);
    assert.equal(db.prepare("select count(*) as n from payments where reference = 'NAVETTE-FORGED'").get().n, 0);
    await modal.locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('"Edit": the order is no longer offered, the reference is changed', async () => {
    await manager.locator('.fi-ta-records tr', { hasText: 'NAVETTE-TEST-1' }).locator('.fi-ac-link-action', { hasText: 'Edit' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Edit NAVETTE-TEST-1');
    assert.equal(await modal.locator('.fi-select-input-btn').count(), 1);
    await page.waitForFunction(() => document.querySelector('.fi-resource-relation-manager .fi-modal-window input[id$=".reference"]')?.value === 'NAVETTE-TEST-1', null, { timeout: 5000 });
    assert.equal(await modal.locator('input[type=radio][value=apple_pay]').isChecked(), true);
    await modal.locator('input[id$=".reference"]').fill('NAVETTE-TEST-2');
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    const row = db.prepare("select * from payments where reference = 'NAVETTE-TEST-2'").get();
    assert.deepEqual([row.order_id, row.method], [order.id, 'apple_pay']);
});
await step('"Delete": the payment is deleted', async () => {
    await manager.locator('.fi-ta-records tr', { hasText: 'NAVETTE-TEST-2' }).locator('.fi-ac-link-action', { hasText: 'Delete' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Delete NAVETTE-TEST-2');
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    assert.equal(db.prepare("select count(*) as n from payments where reference like 'NAVETTE-TEST%'").get().n, 0);
    assert.equal(payments().length, initial);
});
await step('no JavaScript error', async () => { assert.deepEqual(errors, []); });

await browser.close();
process.exit(exitCode());
