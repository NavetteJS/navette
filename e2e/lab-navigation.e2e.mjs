// Navigation lab panel (`/lab-nav`): a hand-built navigation (HTML group label, collapsed group, new-tab links, active icon),
// the user menu (modal action, customized logout item), breadcrumbs led by the navigation, and a strict
// Content-Security-Policy that the panel's inline scripts and styles satisfy with the request's nonce.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, reporter, specArgs } from './support.mjs';

const { base: BASE, user } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const violations = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (/Content Security Policy|Content-Security-Policy/i.test(message.text())) violations.push(message.text()); });
const { step, exitCode } = reporter({ errorLines: 3 });
const notification = (title) => page.locator('.fi-no-notification-title', { hasText: title });

let inactiveIcon = '';
await login(page, BASE, user);
try {
    // The collapsed groups are remembered per origin (as in Filament): the admin panel opened by the login wrote them first.
    await page.goto(`${BASE}/lab-nav`);
    await page.evaluate(() => localStorage.removeItem('filament:sidebar:collapsed_groups'));
    await page.waitForLoadState('networkidle');
    const productsIcon = () => page.locator('.fi-sidebar-item', { hasText: 'Products' }).locator('svg').first().innerHTML();

    await step('the page runs under a strict policy: no violation, Alpine and Livewire started', async () => {
        const response = await page.goto(`${BASE}/lab-nav`);
        await page.waitForLoadState('networkidle');
        inactiveIcon = await productsIcon();
        const policy = response.headers()['content-security-policy'] ?? '';
        assert.match(policy, /script-src 'self' 'nonce-[^']+' 'unsafe-eval'/);
        assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
        assert.ok(await page.evaluate(() => Boolean(window.Alpine && window.Livewire)));
        // Every inline script carries the nonce of this response.
        const nonce = policy.match(/'nonce-([^']+)'/)[1];
        const inline = await page.evaluate(() => [...document.querySelectorAll('script:not([src])')].map((script) => script.nonce));
        assert.ok(inline.length > 0);
        assert.deepEqual(inline.filter((value) => value !== nonce), []);
        assert.deepEqual(violations, []);
    });

    await step('the hand-built navigation: HTML group label, collapsed group, new-tab links', async () => {
        const links = page.locator('.fi-sidebar-group[data-nv-group="links"]');
        assert.equal(await links.locator('[data-nv-html-label]').count(), 1);
        assert.ok(await links.evaluate((el) => el.classList.contains('fi-collapsed')));
        assert.equal(await links.locator('.fi-sidebar-group-items').isVisible(), false);
        await links.locator('.fi-sidebar-group-btn').click();
        await links.locator('.fi-sidebar-group-items').waitFor();
        const github = links.locator('a', { hasText: 'Navette on GitHub' });
        assert.equal(await github.getAttribute('target'), '_blank');
        assert.equal(await github.getAttribute('href'), 'https://github.com/NavetteJS/navette');
    });

    await step('the active item uses its active icon; the badge has its tooltip; breadcrumbs start with the group', async () => {
        await page.goto(`${BASE}/lab-nav/products`);
        await page.locator('.fi-ta-records').waitFor();
        const item = page.locator('.fi-sidebar-item.fi-active', { hasText: 'Products' });
        assert.equal(await item.count(), 1);
        // `activeNavigationIcon`: the solid cube replaces the outlined one.
        assert.notEqual(await productsIcon(), inactiveIcon);
        assert.match(await item.locator('.fi-badge').getAttribute('x-tooltip'), /Products in stock/);
        assert.match(await page.locator('.fi-breadcrumbs').innerText(), /Catalog/);
        assert.deepEqual(violations, []);
    });

    await step('the user menu: a modal action submitted under the policy, the customized logout item', async () => {
        await page.locator('.fi-user-menu-trigger').click();
        const menu = page.locator('.fi-user-menu .fi-dropdown-panel');
        await menu.waitFor();
        assert.equal(await menu.getByText('Leave the lab').count(), 1);
        assert.equal(await menu.locator('a', { hasText: 'Documentation' }).getAttribute('target'), '_blank');
        await menu.getByText('Send feedback').click();
        const modal = page.locator('.fi-modal-window', { hasText: 'Send feedback' });
        await modal.waitFor();
        await modal.locator('input').first().fill('Nice menu');
        await modal.getByRole('button', { name: 'Send' }).click();
        await notification('Feedback sent').waitFor({ timeout: 5000 });
        assert.deepEqual(violations, []);
    });

} finally {
    await browser.close();
}
process.exit(exitCode(errors));
