// Enums in the lab panel (`/lab/orders`): an enum cast on the model, shown by columns and entries (labels, badge colors,
// icons), used for toggle buttons, radio descriptions, a select filter and table groups; values outside the enum are
// refused. Run by e2e/run.mjs, on a throwaway copy of the database.
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
const one = (sql, ...params) => db.prepare(sql).get(...params);
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const rows = page.locator('.nv-ta-records tr.nv-ta-row');
const LABELS = { new: 'New', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const COLORS = { new: 'info', processing: 'warning', shipped: 'success', delivered: 'success', cancelled: 'danger' };
const editWire = "window.Livewire.all().find((c) => c.el.querySelector('[wire\\\\:model=\"data.status\"]')).$wire";

await login(page, BASE, user);
try {
    await step('list: the status column shows the label of each value, in a badge of its color, with its icon', async () => {
        await page.goto(`${BASE}/lab/orders`);
        await rows.first().waitFor({ timeout: 15000 });
        const latest = one('select id, number, status from orders order by id desc limit 1');
        const row = rows.first();
        assert.match(await row.innerText(), new RegExp(latest.number));
        const badge = row.locator('.nv-ta-cell-status .nv-badge').first();
        assert.equal((await badge.innerText()).trim(), LABELS[latest.status]);
        assert.match(await badge.getAttribute('class'), new RegExp(`nv-color-${COLORS[latest.status]}`));
        assert.equal(await badge.locator('svg.nv-icon').count(), 1);
        // The icon column: an icon per row, its label for screen readers.
        assert.equal((await row.locator('.nv-ta-icon .nv-sr-only').innerText()).trim(), LABELS[latest.status]);
        const raw = await page.locator('.nv-ta-cell-status .nv-badge').allInnerTexts();
        assert.ok(raw.length > 0 && raw.every((text) => Object.values(LABELS).includes(text.trim())), `labels only: ${raw.slice(0, 5).join(', ')}`);
    });

    await step('filter: the select filter lists the enum labels and filters by value', async () => {
        const filters = page.locator('.nv-ta-filters');
        await page.waitForTimeout(500);
        if (!(await filters.isVisible())) await page.locator('.nv-ta-filters-dropdown .nv-dropdown-trigger button').click();
        await filters.waitFor({ state: 'visible', timeout: 3000 });
        const options = (await filters.locator('select option').allInnerTexts()).map((text) => text.trim());
        assert.deepEqual(options, ['All', ...Object.values(LABELS)]);
        await filters.locator('select').selectOption({ label: 'Cancelled' });
        await page.waitForTimeout(200);
        await filters.locator('button', { hasText: 'Apply filters' }).click();
        const expected = one("select count(*) n from orders where status = 'cancelled'").n;
        await until(async () => (await page.locator('.nv-pagination-overview').innerText()).includes(`of ${expected} results`), 'filtered results');
        const statuses = (await page.locator('.nv-ta-cell-status .nv-badge').allInnerTexts()).map((text) => text.trim());
        assert.ok(statuses.length > 0 && statuses.every((text) => text === 'Cancelled'), statuses.join(', '));
    });

    const order = one("select id, number, status from orders where status = 'new' order by id limit 1");
    await step('edit: toggle buttons with the enum colors and icons, radio with its descriptions; saving keeps the value', async () => {
        await page.goto(`${BASE}/lab/orders/${order.id}/edit`);
        const buttons = page.locator('.nv-fo-toggle-buttons');
        await buttons.waitFor({ timeout: 15000 });
        const shipped = buttons.locator('label', { hasText: 'Shipped' });
        assert.match(await shipped.getAttribute('class'), /nv-color-success/);
        assert.equal(await shipped.locator('svg.nv-icon').count(), 1);
        assert.match(await page.locator('.nv-fo-radio').innerText(), /Handed over to the carrier\./);
        await shipped.click();
        await page.getByRole('button', { name: 'Save changes' }).click();
        await until(() => one('select status from orders where id = ?', order.id).status === 'shipped', 'saved status');
    });

    await step('edit: a value outside the enum is refused by the server', async () => {
        await page.goto(`${BASE}/lab/orders/${order.id}/edit`);
        await page.locator('.nv-fo-toggle-buttons').waitFor({ timeout: 15000 });
        // The browser would refuse to submit the form (no button checked): the request is sent as a forged one would be.
        await page.evaluate(`(async () => { const wire = ${editWire}; await wire.set('data.status', 'lost', false); await wire.save(); })()`);
        await page.locator('.nv-fo-field-wrp-error-message', { hasText: 'The selected status is invalid.' }).waitFor({ timeout: 15000 });
        assert.equal(one('select status from orders where id = ?', order.id).status, 'shipped');
    });

    await step('view: text and icon entries read the enum', async () => {
        await page.goto(`${BASE}/lab/orders/${order.id}`);
        const badge = page.locator('.nv-in-text .nv-badge').first();
        await badge.waitFor({ timeout: 15000 });
        assert.equal((await badge.innerText()).trim(), 'Shipped');
        assert.match(await badge.getAttribute('class'), /nv-color-success/);
        assert.equal((await page.locator('.nv-in-icon .nv-sr-only').innerText()).trim(), 'Shipped');
    });

    await step('groups: grouping by status titles each group with its label', async () => {
        await page.goto(`${BASE}/lab/orders`);
        await rows.first().waitFor({ timeout: 15000 });
        await page.evaluate("window.Livewire.all().find((c) => c.el.querySelector('.nv-ta')).$wire.set('tableGrouping', 'status:asc')");
        await page.locator('.nv-ta-group-header').first().waitFor({ timeout: 15000 });
        const titles = (await page.locator('.nv-ta-group-heading').allInnerTexts()).map((text) => text.trim());
        assert.ok(titles.length > 0, 'group headers');
        assert.ok(titles.every((title) => Object.values(LABELS).some((label) => title.endsWith(label))), titles.join(', '));
    });
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
