// Page loading overlay (`panel.pageLoadingIndicator()`), on the `/lab-loading…` panels whose `slow` page takes 1.5 s:
// the content area only (sidebar layout, collapsed sidebar, top navigation with full-page loads, mobile), the whole screen,
// none at all; hidden again on load, after a failed request and when going back. Run by e2e/run.mjs, on a throwaway copy
// of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, reporter, specArgs } from './support.mjs';

const { base: BASE, user } = specArgs();
const browser = await chromium.launch();
const KEY = 'nv-page-loading-seen';
// The page itself records what the overlay covers when it appears (kept in sessionStorage across full-page loads):
// Playwright's own calls would wait for a pending full-page navigation.
const recorder = (key) => {
    const rect = (element) => {
        if (!element) return null;
        const { top, left, right, bottom, width, height } = element.getBoundingClientRect();
        return { top, left, right, bottom, width, height };
    };
    new MutationObserver(() => {
        const overlay = document.querySelector('.nv-page-loading-overlay[data-active]');
        if (!overlay || sessionStorage.getItem(key) !== '') return;
        const box = rect(overlay);
        const points = [[box.left + box.width / 2, box.top + 4], [box.left + 4, box.top + box.height / 2], [box.right - 4, box.bottom - 4]];
        sessionStorage.setItem(key, JSON.stringify({
            box, content: rect(document.querySelector('.nv-main-ctn')), sidebar: rect(document.querySelector('.nv-sidebar')),
            topbar: rect(document.querySelector('.nv-topbar-ctn')),
            busy: document.getElementById('nv-main-content')?.getAttribute('aria-busy') ?? null,
            label: document.querySelector('.nv-page-loading-status')?.textContent ?? null,
            topbarCovered: document.elementFromPoint(innerWidth / 2, 10)?.closest('.nv-page-loading-overlay') !== null,
            overlayOnTop: points.every(([x, y]) => document.elementFromPoint(x, y)?.closest('.nv-page-loading-overlay')),
        }));
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-active'] });
};
const newContext = async (options) => {
    const context = await browser.newContext(options);
    await context.addInitScript(recorder, KEY);
    return context;
};
const context = await newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 3 });

const near = (a, b, label) => assert.ok(Math.abs(a - b) <= 1, `${label}: ${a} vs ${b}`);
const active = (target) => target.locator('.nv-page-loading-overlay[data-active]');
const arm = (target) => target.evaluate((key) => sessionStorage.setItem(key, ''), KEY);
const seen = async (target) => {
    const value = await target.evaluate((key) => sessionStorage.getItem(key), KEY);
    return value ? JSON.parse(value) : null;
};
// Opens the slow page by clicking the link; returns what the overlay covered and checks it is gone once the page is there.
async function whileLoading(target, link) {
    await arm(target);
    await target.locator(link).first().click();
    await target.waitForURL(/\/slow$/);
    await target.waitForLoadState('networkidle');
    assert.equal(await active(target).count(), 0, 'hidden once loaded');
    assert.equal(await target.locator('#nv-main-content').getAttribute('aria-busy'), null);
    const result = await seen(target);
    assert.ok(result, 'the overlay appeared');
    return result;
}
const open = async (target, path) => {
    await target.goto(`${BASE}${path}`);
    await target.waitForLoadState('networkidle');
};

await login(page, BASE, user);
try {
    await step('content: the overlay covers the content area, not the sidebar nor the topbar', async () => {
        await open(page, '/lab-loading');
        assert.equal(await page.locator('.nv-page-loading[data-mode="content"]').count(), 1);
        assert.equal(await page.locator('.nv-page-loading-overlay').isVisible(), false);
        const { box, content, sidebar, topbar, busy, label, topbarCovered } = await whileLoading(page, '.nv-sidebar a[href$="/lab-loading/slow"]');
        near(box.left, content.left, 'left edge = content area');
        assert.ok(box.left >= sidebar.right - 1, 'beside the sidebar');
        near(box.top, topbar.bottom, 'below the topbar');
        near(box.right, 1440, 'up to the right edge');
        near(box.bottom, 900, 'down to the bottom of the viewport');
        assert.equal(topbarCovered, false);
        assert.equal(busy, 'true');
        assert.equal(label, 'Loading page…');
        // Loaded: nothing left to announce; no progress bar either.
        assert.equal(await page.locator('.nv-page-loading-status').textContent(), '');
        assert.equal(await page.locator('#nprogress').count(), 0);
    });

    await step('content: a fast page shows no overlay (it waits 150 ms)', async () => {
        await arm(page);
        await page.locator('.nv-sidebar a[href$="/lab-loading/fast"]').click();
        await page.waitForURL(/\/fast$/);
        await page.waitForLoadState('networkidle');
        assert.equal(await seen(page), null);
    });

    await step('content: with the sidebar collapsed, the overlay follows the wider content area', async () => {
        await page.locator('.nv-topbar-close-collapse-sidebar-btn').click();
        await page.waitForTimeout(400);
        const { box, content } = await whileLoading(page, '.nv-sidebar a[href$="/lab-loading/slow"]');
        near(box.left, content.left, 'left edge = content area');
        assert.ok(box.left < 200, `collapsed sidebar: ${box.left}`);
        await page.locator('.nv-topbar-open-collapse-sidebar-btn').click();
    });

    await step('content: a failed request hides the overlay', async () => {
        await open(page, '/lab-loading');
        await page.route('**/lab-loading/slow', async (route) => { await new Promise((resolve) => setTimeout(resolve, 600)); await route.abort('failed').catch(() => {}); });
        await page.locator('.nv-sidebar a[href$="/lab-loading/slow"]').click();
        await active(page).waitFor({ state: 'attached', timeout: 1200 });
        await active(page).waitFor({ state: 'detached', timeout: 3000 });
        assert.equal(await page.locator('#nv-main-content').getAttribute('aria-busy'), null);
        await page.unroute('**/lab-loading/slow');
    });

    await step('content, top navigation and full-page loads: below the topbar, gone once the page is shown or restored', async () => {
        await open(page, '/lab-loading-top');
        assert.equal(await page.locator('.nv-topbar a[wire\\:navigate]').count(), 0, 'no SPA in this panel');
        const { box, topbar } = await whileLoading(page, '.nv-topbar a[href$="/lab-loading-top/slow"]');
        near(box.top, topbar.bottom, 'below the topbar');
        near(box.left, 0, 'full width');
        near(box.width, 1440, 'full width');
        await page.goBack();
        await page.waitForLoadState('networkidle');
        assert.equal(await active(page).count(), 0);
    });

    await step('content on a phone: full width, below the topbar', async () => {
        const phone = await newContext({ viewport: { width: 390, height: 800 }, storageState: await context.storageState() });
        const mobile = await phone.newPage();
        try {
            await open(mobile, '/lab-loading/fast');
            await mobile.locator('.nv-topbar-open-sidebar-btn').click();
            await mobile.locator('.nv-sidebar a[href$="/lab-loading/slow"]').waitFor();
            const { box, topbar } = await whileLoading(mobile, '.nv-sidebar a[href$="/lab-loading/slow"]');
            near(box.left, 0, 'left'); near(box.width, 390, 'width'); near(box.top, topbar.bottom, 'top');
        } finally { await phone.close(); }
    });

    await step('screen: the overlay covers the whole viewport, topbar and sidebar included', async () => {
        await open(page, '/lab-loading-screen');
        assert.equal(await page.locator('.nv-page-loading[data-mode="screen"]').count(), 1);
        const { box, overlayOnTop, topbarCovered } = await whileLoading(page, '.nv-sidebar a[href$="/lab-loading-screen/slow"]');
        assert.deepEqual([box.top, box.left, box.width, box.height].map(Math.round), [0, 0, 1440, 900]);
        assert.ok(overlayOnTop && topbarCovered, 'above the topbar, the sidebar and the content');
    });

    await step('false: no overlay and no progress bar', async () => {
        await open(page, '/lab-loading-off');
        assert.equal(await page.locator('.nv-page-loading').count(), 0);
        await page.locator('.nv-sidebar a[href$="/lab-loading-off/slow"]').click();
        await page.waitForTimeout(700);
        assert.equal(await page.locator('.nv-page-loading, #nprogress').count(), 0);
        assert.equal(await page.locator('#nv-main-content').getAttribute('aria-busy'), null);
        await page.waitForURL(/\/slow$/);
    });

    await step('reduced motion: the overlay appears without a fade', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await open(page, '/lab-loading');
        // At most the 0.01 ms some reduced-motion resets use.
        const durations = await page.locator('.nv-page-loading-overlay').evaluate((element) => getComputedStyle(element).transitionDuration);
        assert.ok(durations.split(',').every((duration) => parseFloat(duration) <= 0.00001), durations);
        await page.emulateMedia({ reducedMotion: null });
    });
} finally {
    await browser.close();
}
process.exit(exitCode(errors));
