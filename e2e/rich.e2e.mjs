// Rich editor: the customers' "Send email" action and an order's notes.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter({ errorLines: 5 });
const modals = page.locator('.fi-modal-window:visible');
const editor = (scope) => scope.locator('.tiptap[contenteditable="true"]');

await login(page, BASE, user);

const customer = db.prepare('select id, name, email from customers where deleted_at is null order by name limit 1').get();
await step('"Send email" from the list: recipient filled in, rich editor loaded', async () => {
    await page.goto(`${BASE}/shop/customers`);
    await page.locator('.fi-ta-records tr').first().locator('.fi-ac-link-action', { hasText: 'Send email' }).click();
    await modals.first().waitFor({ state: 'visible', timeout: 8000 });
    assert.equal((await modals.first().locator('.fi-modal-heading').innerText()).trim(), 'Send email');
    await page.waitForFunction((email) => document.querySelector('.fi-modal-window input[id$=".to"]')?.value === email, customer.email, { timeout: 5000 });
    assert.equal(await modals.first().locator('input[id$=".to"]').isDisabled(), true);
    await editor(modals.first()).waitFor({ timeout: 10000 });
    assert.ok(await modals.first().locator('.fi-fo-rich-editor-toolbar button').count() >= 20);
});
await step('empty body: refused by the server', async () => {
    await modals.first().locator('input[id$=".subject"]').fill('Hello');
    await modals.first().locator('.fi-modal-footer button[type=submit]').click();
    await modals.first().locator('.fi-fo-field-wrp-error-message', { hasText: 'body field is required' }).waitFor({ timeout: 5000 });
});
await step('typing with bold, then a link through the nested modal', async () => {
    const area = editor(modals.first());
    await area.click();
    await page.keyboard.type('See our website');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');
    assert.equal(await area.locator('strong').count(), 1);
    await modals.first().locator('.fi-fo-rich-editor-toolbar button[x-on\\:click^="mountToolAction(\'link\'"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.fi-modal-window').length >= 2 && [...document.querySelectorAll('.fi-modal-heading')].some((h) => h.innerText.trim() === 'Link'), null, { timeout: 8000 });
    const link = page.locator('.fi-modal-window', { has: page.locator('.fi-modal-heading', { hasText: /^\s*Link\s*$/ }) });
    await link.locator('input[id$=".url"]').fill('javascript:alert(1)');
    await link.locator('.fi-modal-footer button[type=submit]').click();
    await link.locator('.fi-fo-field-wrp-error-message', { hasText: 'valid URL' }).waitFor({ timeout: 5000 });
    await link.locator('input[id$=".url"]').fill('https://example.test/navette');
    await link.locator('.fi-modal-footer button[type=submit]').click();
    await area.locator('a[href="https://example.test/navette"]').waitFor({ timeout: 8000 });
});
await step('send: notification, modal closed', async () => {
    await modals.first().locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: `Email sent to ${customer.name}` }).waitFor({ timeout: 8000 });
});
await step('"Send email" is also on the customer\'s edit page', async () => {
    await page.goto(`${BASE}/shop/customers/${customer.id}/edit`);
    assert.deepEqual((await page.locator('.fi-header-actions-ctn button').allInnerTexts()).map((x) => x.trim()), ['Send email', 'Delete']);
    await page.locator('.fi-header-actions-ctn button', { hasText: 'Send email' }).click();
    await modals.first().waitFor({ state: 'visible', timeout: 8000 });
    await editor(modals.first()).waitFor({ timeout: 10000 });
    await modals.first().locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
});

const order = db.prepare('select id, notes from orders where deleted_at is null and customer_id is not null and (select count(*) from order_items i where i.order_id = orders.id) > 0 and (select count(*) from order_items i where i.order_id = orders.id) = (select count(distinct product_id) from order_items i where i.order_id = orders.id) order by id limit 1').get();
await step('an order\'s notes: the stored HTML shows in the editor, what is typed is saved as HTML', async () => {
    await page.goto(`${BASE}/shop/orders/${order.id}/edit`);
    const area = editor(page.locator('.fi-sc-form'));
    await area.waitFor({ timeout: 10000 });
    if (order.notes) assert.ok((await area.innerText()).trim().length > 0);
    await area.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Deliver before noon');
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.locator('.fi-no-notification', { hasText: 'Saved' }).waitFor({ timeout: 8000 }).catch(async () => { throw new Error('no "Saved" notification — errors shown: ' + JSON.stringify(await page.locator('.fi-fo-field-wrp-error-message').allInnerTexts())); });
    assert.equal(db.prepare('select notes from orders where id = ?').get(order.id).notes, '<p>Deliver before noon</p>');
});
await step('forged document: no executable link nor script reaches the database', async () => {
    await page.evaluate(async () => {
        const c = window.Livewire.all().find((x) => x.el.querySelector('.fi-sc-form'));
        await c.$wire.set('data.notes', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'trap', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }, { type: 'unknownScript', content: [] }] }, false);
        await c.$wire.save();
    });
    await page.waitForTimeout(1200);
    const notes = db.prepare('select notes from orders where id = ?').get(order.id).notes ?? '';
    assert.equal(/javascript:|<script/i.test(notes), false, notes);
});
await step('no JavaScript error', async () => { assert.deepEqual(errors, []); });

await browser.close();
process.exit(exitCode());
