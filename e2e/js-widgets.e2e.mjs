// JavaScript widgets (`/lab/js-widgets`): the renderer module is imported on request (it is not in the layout), receives the
// widget's configuration, is updated in place when the dashboard filters change, and calls a server method through `$wire`.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const rendererRequests = [];
page.on('request', (request) => { if (/\/js\/navette\/lab\/orders-overview\.js\?v=/.test(request.url())) rendererRequests.push(request.url()); });
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile, { readonly: true });
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const ordersWith = (status = null) => db.prepare(`select count(*) as n from orders where deleted_at is null${status ? ' and status = ?' : ''}`).get(...(status ? [status] : [])).n;

const widget = () => page.locator('.nv-wi-js');
const host = () => widget().locator('[x-ref="host"]');
const text = async (selector) => (await widget().locator(selector).innerText()).trim();

await login(page, BASE, user);
try {
    await step('the renderer mounts with the configuration, imported on request', async () => {
        await page.goto(`${BASE}/lab/js-widgets`);
        await page.getByRole('heading', { name: 'JavaScript widgets' }).waitFor();
        await widget().locator('.nv-lab-js-widget-heading').waitFor();
        // Text from the configuration is set as text: the markup in it is not parsed.
        assert.equal(await text('.nv-lab-js-widget-heading'), 'Orders <overview>');
        assert.equal(await text('.nv-lab-js-widget-status'), 'All statuses');
        assert.equal(await text('.nv-lab-js-widget-orders'), `${ordersWith()} orders`);
        assert.equal(await host().getAttribute('data-mounts'), '1');
        assert.equal(rendererRequests.length, 1);
        assert.equal(await page.locator('script[src*="orders-overview"]').count(), 0);
        assert.equal(await widget().locator('[role="alert"]').isVisible(), false);
    });

    await step('a dashboard filter updates the renderer in place, without remounting it', async () => {
        await page.locator('.nv-page label').filter({ hasText: /^Shipped$/ }).click();
        await until(async () => (await text('.nv-lab-js-widget-status')) === 'Shipped', 'the filtered configuration');
        assert.equal(await text('.nv-lab-js-widget-orders'), `${ordersWith('shipped')} orders`);
        assert.equal(await host().getAttribute('data-mounts'), '1');
        assert.ok(Number(await host().getAttribute('data-updates')) >= 1);
        await page.locator('.nv-page label').filter({ hasText: /^Cancelled$/ }).click();
        await until(async () => (await text('.nv-lab-js-widget-orders')) === `${ordersWith('cancelled')} orders`, 'the second filter');
        assert.equal(await host().getAttribute('data-mounts'), '1');
    });

    await step('the renderer calls a widget method through $wire', async () => {
        assert.equal(await text('.nv-lab-js-widget-refreshes'), 'Refreshed 0 times');
        await widget().locator('.nv-lab-js-widget-refresh').click();
        await until(async () => (await text('.nv-lab-js-widget-refreshes')) === 'Refreshed 1 times', 'the refresh');
        await widget().locator('.nv-lab-js-widget-refresh').click();
        await until(async () => (await text('.nv-lab-js-widget-refreshes')) === 'Refreshed 2 times', 'the second refresh');
        assert.equal(await host().getAttribute('data-mounts'), '1');
        // The filter is kept.
        assert.equal(await text('.nv-lab-js-widget-status'), 'Cancelled');
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'js-widgets.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
