// Plugins on the lab panel: the example panel plugin (examples/clock-widget: configured clock pages with their widget), the
// example standalone component (examples/headings) and a configurable resource registered twice (`/lab/stock/all`,
// `/lab/low-stock`). Run by e2e/run.mjs, on a throwaway copy of the database.
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
const lowStock = db.prepare('select id, name from products where qty < 10 order by qty, id limit 1').get();
const wellStocked = db.prepare('select id, name from products where qty >= 10 order by qty desc, id limit 1').get();
const rowNames = () => page.locator('.fi-ta-row').allInnerTexts();

await login(page, BASE, user);
try {
    await step('the plugin adds its clock pages to the navigation, in its group', async () => {
        await page.goto(`${BASE}/lab/clock/tokyo`);
        const group = page.locator('.fi-sidebar-group', { has: page.getByText('Plugins', { exact: true }) });
        await group.waitFor();
        const labels = (await group.locator('.fi-sidebar-item-label').allInnerTexts()).map((label) => label.trim());
        assert.deepEqual(labels.slice(0, 4), ['Tokyo', 'New York', 'Stock', 'Low stock']);
        assert.equal(await group.locator('.fi-sidebar-item.fi-active .fi-sidebar-item-label').innerText(), 'Tokyo');
    });

    await step('each clock page shows the time of its own time zone, updated by the browser', async () => {
        const clock = page.locator('.clock-widget-time');
        assert.equal(await clock.getAttribute('data-timezone'), 'Asia/Tokyo');
        await page.getByText('Current time in Asia/Tokyo').waitFor();
        const first = await clock.innerText();
        assert.match(first, /^\d\d:\d\d:\d\d$/);
        await page.waitForFunction((initial) => document.querySelector('.clock-widget-time').textContent !== initial, first, { timeout: 5000 });
        const expected = await page.evaluate(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', hour12: false }).format(new Date()));
        assert.equal((await clock.innerText()).slice(0, 2), expected.slice(0, 2));

        await page.locator('.fi-sidebar-item a', { hasText: 'New York' }).click();
        await page.waitForURL(`${BASE}/lab/new-york-time`);
        await page.getByText('Current time in America/New_York').waitFor();
        assert.equal(await page.locator('h1.fi-header-heading').innerText(), 'New York');
    });

    await step('each registration of the configurable resource lists its own records', async () => {
        await page.goto(`${BASE}/lab/stock/all`);
        await page.locator('.fi-ta-row').first().waitFor();
        const all = await rowNames();
        assert.ok(all.some((text) => text.includes(lowStock.name)), 'low stock product listed in "Stock"');
        await page.locator('.fi-sidebar-item a', { hasText: 'Low stock' }).click();
        await page.waitForURL(`${BASE}/lab/low-stock`);
        await page.locator('.fi-ta-row').first().waitFor();
        const low = await rowNames();
        assert.ok(low.some((text) => text.includes(lowStock.name)));
        assert.ok(!low.some((text) => text.includes(wellStocked.name)), 'only products with less than 10 items');
        // Each list shows a page of its own records (other specs may have added low stock products: compare with the database).
        const count = (sql) => db.prepare(sql).get().total;
        const perPage = 10;
        assert.equal(all.length, Math.min(count('select count(*) as total from products'), perPage));
        assert.equal(low.length, Math.min(count('select count(*) as total from products where qty < 10'), perPage));
        // Only the registration being shown is active in the navigation.
        const active = page.locator('.fi-sidebar-item.fi-active .fi-sidebar-item-label');
        assert.deepEqual((await active.allInnerTexts()).map((label) => label.trim()), ['Low stock']);
    });

    await step('a registration keeps its own URLs: search, then open and save a record', async () => {
        await page.locator('.fi-ta-search-field input').fill(lowStock.name);
        await page.waitForResponse((response) => response.url().includes('/livewire') && response.request().method() === 'POST');
        await page.locator('.fi-ta-row', { hasText: lowStock.name }).first().click();
        await page.waitForURL(`${BASE}/lab/low-stock/${lowStock.id}/edit`);
        // The standalone heading component, colored by the registration's configuration.
        const heading = page.locator('h3.headings-component');
        assert.equal(await heading.innerText(), 'Low stock product');
        assert.match(await heading.getAttribute('style'), /--headings-color: var\(--warning-600\)/);
        assert.equal(await page.locator('style[data-navette-headings]').count(), 1, 'stylesheet added by a render hook');
        assert.equal(await page.locator('.fi-breadcrumbs a', { hasText: 'Stock Items' }).getAttribute('href'), '/lab/low-stock');
        await page.locator('[id="form.qty"]').fill('7');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => document.body.innerText.includes('Saved'));
        assert.equal(db.prepare('select qty from products where id = ?').get(lowStock.id).qty, 7);
        await page.goto(`${BASE}/lab/stock/all/${wellStocked.id}/edit`);
        assert.equal(await page.locator('h3.headings-component').innerText(), 'Product');
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
