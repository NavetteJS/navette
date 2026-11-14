// Widget features: dashboard filters in a modal, kept in the URL and in the session; clickable stats and placeholders;
// a chart's deferred filters form; empty state actions; Chart.js plugins; the shop dashboard's filters form restored
// from the URL. Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile, { readonly: true });
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };

const ordersWith = (status = null) => db.prepare(`select count(*) as n from orders where deleted_at is null${status ? ' and status = ?' : ''}`).get(...(status ? [status] : [])).n;
const stat = (label) => page.locator('.nv-wi-stats-overview-stat').filter({ has: page.locator('.nv-wi-stats-overview-stat-label', { hasText: new RegExp(`^${label}$`) }) });
const statValue = async (label) => (await stat(label).locator('.nv-wi-stats-overview-stat-value').innerText()).trim();
const ordersChart = () => page.locator('.nv-wi-chart').filter({ hasText: 'Orders per status' });
/** Labels currently drawn by a chart widget (read from its Chart.js instance). */
const chartLabels = (widget) => widget.locator('.nv-wi-chart-canvas-ctn').evaluate((el) => [...(window.Alpine.$data(el).getChart()?.data.labels ?? [])]);
const modal = () => page.locator('.nv-modal.nv-modal-open .nv-modal-window');
const query = () => decodeURIComponent(new URL(page.url()).search);
const notification = (title) => page.locator('.nv-no-notification').filter({ hasText: title });

await login(page, BASE, user);
try {
    await step('lab dashboard: stats with extra attributes and a placeholder', async () => {
        await page.goto(`${BASE}/lab/widgets`);
        await page.getByRole('heading', { name: 'Widgets lab' }).waitFor();
        assert.equal(await statValue('Orders'), String(ordersWith()));
        const shipped = page.locator('.nv-lab-clickable-stat');
        assert.equal(await shipped.count(), 1);
        assert.equal(await shipped.getAttribute('data-status'), 'shipped');
        assert.match(await shipped.getAttribute('class'), /^nv-wi-stats-overview-stat nv-lab-clickable-stat$/);
        assert.equal((await stat('Refunded').locator('.nv-wi-stats-overview-stat-placeholder').innerText()).trim(), 'Not tracked');
    });

    await step('Chart.js plugins: the inline plugin draws, the global plugin is registered', async () => {
        const canvas = ordersChart().locator('canvas');
        await until(async () => (await canvas.getAttribute('data-lab-plugin')) === 'drawn', 'the inline plugin');
        assert.equal(await canvas.getAttribute('data-lab-global-plugin'), 'registered');
    });

    await step('clicking a stat filters the dashboard; the filters go into the URL', async () => {
        await page.locator('.nv-lab-clickable-stat').click();
        await until(async () => query().includes('filters[status]=shipped'), 'the URL');
        await until(async () => (await statValue('Orders')) === String(ordersWith('shipped')), 'the filtered stats');
        assert.match(await stat('Orders').innerText(), /Status: Shipped/);
    });

    await step('the filters survive a reload (URL) and a visit without query string (session)', async () => {
        await page.reload();
        await until(async () => (await statValue('Orders')) === String(ordersWith('shipped')), 'filtered after reload');
        await page.goto(`${BASE}/lab/widgets`);
        await until(async () => (await statValue('Orders')) === String(ordersWith('shipped')), 'filtered from the session');
    });

    await step('filters action: a slide-over, validated, applied with "Apply"; "Cancel" discards the changes', async () => {
        await page.locator('.nv-header').getByRole('button', { name: 'Filter', exact: true }).click();
        await modal().waitFor();
        assert.match(await page.locator('.nv-modal.nv-modal-open').getAttribute('class'), /nv-modal-slide-over/);
        // Filled with the applied filters.
        assert.equal(await modal().getByLabel('Status').inputValue(), 'shipped');
        await modal().getByLabel('Status').selectOption('cancelled');
        await modal().getByRole('button', { name: 'Cancel' }).click();
        await modal().waitFor({ state: 'hidden' });
        assert.equal(await statValue('Orders'), String(ordersWith('shipped')));
        // A date after today is refused (the field's `max` attribute; the server checks it too).
        await page.locator('.nv-header').getByRole('button', { name: 'Filter', exact: true }).click();
        await modal().waitFor();
        await modal().getByLabel('Status').selectOption('delivered');
        await modal().getByLabel('Created after').fill('2999-01-01');
        await modal().getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        assert.equal(await modal().getByLabel('Created after').evaluate((input) => input.validity.rangeOverflow), true);
        assert.equal(await modal().isVisible(), true, 'the modal stays open');
        assert.equal(await statValue('Orders'), String(ordersWith('shipped')));
        await modal().getByLabel('Created after').fill('');
        await modal().getByRole('button', { name: 'Apply' }).click();
        await modal().waitFor({ state: 'hidden' });
        await until(async () => (await statValue('Orders')) === String(ordersWith('delivered')), 'the applied filters');
        await until(async () => query().includes('filters[status]=delivered'), 'the URL');
    });

    await step('chart filters form: deferred until "Update chart", "Reset" restores the defaults', async () => {
        const chart = ordersChart();
        const before = await chartLabels(chart);
        assert.deepEqual(before, ['Delivered'], 'the dashboard filter applies to the chart');
        // Back to every status on the dashboard, to see the chart's own filter at work.
        await page.locator('.nv-header').getByRole('button', { name: 'Filter', exact: true }).click();
        await modal().waitFor();
        await modal().getByLabel('Status').selectOption('');
        await modal().getByRole('button', { name: 'Apply' }).click();
        await modal().waitFor({ state: 'hidden' });
        await until(async () => (await chartLabels(chart)).length > 1, 'every status');
        const all = await chartLabels(chart);
        await chart.locator('.nv-wi-chart-filter .nv-dropdown-trigger button').click();
        const content = chart.locator('.nv-wi-chart-filter-content');
        await content.waitFor();
        await content.getByLabel('Status').selectOption('cancelled');
        await page.waitForTimeout(600);
        assert.deepEqual(await chartLabels(chart), all, 'nothing applied before "Update chart"');
        await content.getByRole('button', { name: 'Update chart' }).click();
        await until(async () => JSON.stringify(await chartLabels(chart)) === JSON.stringify(['Cancelled']), 'the applied chart filter');
        if (!(await content.isVisible())) await chart.locator('.nv-wi-chart-filter .nv-dropdown-trigger button').click();
        await content.getByRole('button', { name: 'Reset' }).click();
        await until(async () => JSON.stringify(await chartLabels(chart)) === JSON.stringify(all), 'the reset filters');
        assert.equal(await content.getByLabel('Status').inputValue(), '');
    });

    await step('chart empty state: an action with a confirmation modal, and a direct action', async () => {
        const returns = page.locator('.nv-wi-chart').filter({ hasText: 'Returns' });
        await returns.getByText('No returns yet').waitFor();
        await returns.getByRole('button', { name: 'Import returns' }).click();
        await modal().waitFor();
        assert.match(await modal().innerText(), /Returns are read from the carrier\./);
        await modal().getByRole('button', { name: 'Confirm' }).click();
        await notification('No returns to import').waitFor();
        await returns.getByRole('button', { name: 'Refresh' }).click();
        await notification('Returns refreshed').waitFor();
    });

    await step('shop dashboard: the filters form is restored from the URL, then from the session', async () => {
        await page.goto(`${BASE}/shop?filters[startDate]=2025-01-01`);
        const startDate = page.locator('.nv-page input[type="date"]').first();
        await startDate.waitFor();
        assert.equal(await startDate.inputValue(), '2025-01-01');
        await page.goto(`${BASE}/shop`);
        await page.locator('.nv-page input[type="date"]').first().waitFor();
        assert.equal(await page.locator('.nv-page input[type="date"]').first().inputValue(), '2025-01-01');
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'widgets.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
