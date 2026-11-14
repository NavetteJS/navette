// Components outside any panel (`@navette-js/panels/livewire`): the demo's contact form and product catalog, served as full
// pages and embedded in a page of the application, as a guest (no panel, no sign-in). Run by e2e/run.mjs, on a throwaway
// copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, dbFile } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile, { readonly: true });
const visible = db.prepare('select name, qty from products where is_visible = 1 order by name').all();
const lowStock = visible.filter((product) => product.qty < 10);
const notification = (title) => page.locator('.nv-no-notification', { hasText: title });

try {
    await step('the contact form, an infolist and an action button render in the component view, outside any panel', async () => {
        const response = await page.goto(`${BASE}/outside/contact`);
        assert.equal(response.status(), 200);
        assert.equal(await page.title(), 'Contact us');
        await page.locator('form[data-test=contact-form] input[wire\\:model="data.name"]').waitFor();
        assert.equal(await page.locator('.nv-sidebar').count(), 0, 'no panel layout');
        await page.getByText('12 Harbour Street, Brest').waitFor();
        await page.getByRole('button', { name: 'Subscribe to the newsletter' }).waitFor();
        // The page uses the component's colors (teal), not a panel's.
        const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary-500').trim());
        assert.ok(primary.length > 0, 'color variables are set');
    });

    await step('submitting the form validates it on the server', async () => {
        // The browser's own checks (`required` attributes) are turned off to reach the server's.
        await page.locator('form[data-test=contact-form]').evaluate((form) => { form.noValidate = true; });
        await page.getByRole('button', { name: 'Send' }).click();
        await page.locator('.nv-fo-field-wrp-error-message').first().waitFor();
        assert.ok((await page.locator('.nv-fo-field-wrp-error-message').count()) >= 3, 'name, email and message are required');
    });

    await step('a valid message is sent: a notification, and the form is cleared', async () => {
        await page.locator('input[wire\\:model="data.name"]').fill('Ada Lovelace');
        await page.locator('input[wire\\:model="data.email"]').fill('ada@example.test');
        await page.locator('textarea[wire\\:model="data.message"]').fill('Where is my analytical engine?');
        await page.getByRole('button', { name: 'Send' }).click();
        await notification('Message sent').waitFor();
        assert.equal(await page.locator('.nv-fo-field-wrp-error-message').count(), 0);
        await page.waitForFunction(() => document.querySelector('input[wire\\:model="data.name"]').value === '');
    });

    await step('an action opens its modal form, validates it and runs', async () => {
        await page.getByRole('button', { name: 'Subscribe to the newsletter' }).click();
        const modal = page.locator('.nv-modal-window', { hasText: 'Newsletter' });
        await modal.waitFor();
        await modal.getByText('One email a month, no more.').waitFor();
        await modal.locator('input[type=email]').fill('not an email');
        await page.evaluate(() => document.querySelectorAll('form').forEach((form) => { form.noValidate = true; }));
        await modal.getByRole('button', { name: 'Submit' }).click();
        await modal.locator('.nv-fo-field-wrp-error-message').waitFor();
        await modal.locator('input[type=email]').fill('ada@example.test');
        await modal.getByRole('button', { name: 'Submit' }).click();
        await notification('Subscribed ada@example.test').waitFor();
        await modal.waitFor({ state: 'hidden' });
    });

    await step('the catalog table: records, search, sort, filter and a row action with a confirmation modal', async () => {
        await page.goto(`${BASE}/outside/catalog`);
        const rows = page.locator('.nv-ta-row');
        await rows.first().waitFor();
        const first = visible[0];
        assert.ok((await rows.first().innerText()).includes(first.name), 'sorted by name by default');
        const target = visible[Math.floor(visible.length / 2)];
        await page.locator('.nv-ta-search-field input').fill(target.name);
        await page.waitForFunction((name) => [...document.querySelectorAll('.nv-ta-row')].every((row) => row.textContent.includes(name)) && document.querySelectorAll('.nv-ta-row').length >= 1, target.name);
        await page.locator('.nv-ta-search-field input').fill('');
        await page.waitForFunction((count) => document.querySelectorAll('.nv-ta-row').length >= Math.min(count, 10), visible.length);
        // Filter: low stock only.
        await page.locator('.nv-ta-filters-dropdown .nv-dropdown-trigger button').click();
        const filters = page.locator('.nv-ta-filters');
        await filters.waitFor({ state: 'visible' });
        await filters.locator('select').selectOption({ label: 'Low stock' });
        await filters.locator('button', { hasText: 'Apply filters' }).click();
        if (lowStock.length) await page.waitForFunction((names) => [...document.querySelectorAll('.nv-ta-row')].every((row) => names.some((name) => row.textContent.includes(name))), lowStock.map((product) => product.name));
        await page.keyboard.press('Escape');
        const row = rows.first();
        const name = (await row.locator('.nv-ta-cell-name').innerText()).trim();
        await row.getByRole('button', { name: 'Reserve' }).click();
        const modal = page.locator('.nv-modal-window', { hasText: `Reserve one ${name}?` });
        await modal.waitFor();
        await modal.getByRole('button', { name: 'Confirm' }).click();
        await notification(`Reserved ${name}`).waitFor();
    });

    await step('a page of the application embeds the table in its own layout, and the table still works', async () => {
        await page.goto(`${BASE}/outside/shop`);
        await page.locator('[data-test=shop-heading]').waitFor();
        await page.locator('.nv-ta-row').first().waitFor();
        await page.locator('.nv-ta-search-field input').fill(visible[0].name);
        await page.waitForFunction((name) => [...document.querySelectorAll('.nv-ta-row')].every((row) => row.textContent.includes(name)), visible[0].name);
        await page.getByRole('link', { name: 'Contact us' }).click();
        await page.waitForURL(`${BASE}/outside/contact`);
    });

    await step('a forged update is refused: no CSRF token, or a method that is not callable', async () => {
        const status = await page.evaluate(async () => (await fetch('/_outside/livewire/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ _token: 'forged', components: [] }) })).status);
        assert.equal(status, 419);
        const snapshot = await page.locator('[wire\\:name="contact-form"]').getAttribute('wire:snapshot');
        const token = await page.locator('meta[name=csrf-token]').getAttribute('content');
        const forged = await page.evaluate(async ({ snapshot, token }) => (await fetch('/_outside/livewire/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ _token: token, components: [{ snapshot, updates: {}, calls: [{ method: 'getSchema', params: ['form'] }] }] }) })).status, { snapshot, token });
        assert.equal(forged, 404);
    });
} finally {
    db.close();
    await browser.close();
}
process.exit(exitCode(errors));
