// Notification actions (D11): real Actions with icons, tooltips, a disabled state and a group whose items dispatch events and
// close the notification; sanitized HTML body; text entry suffix actions; images of a private storage behind temporary signed
// URLs. Run by e2e/run.mjs on the `/lab` "UI lab" page (not registered with NAVETTE_NO_THEMES).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { login, reporter, specArgs } from './support.mjs';

const { base: BASE, user, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const flash = (text) => page.locator('.nv-no .nv-no-notification', { hasText: text });

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/lab/ui`);
    await page.getByRole('heading', { name: 'UI lab' }).waitFor();
    await page.waitForLoadState('networkidle');

    await step('a notification with safe HTML, styled actions and a disabled action', async () => {
        await page.getByRole('button', { name: 'Send a notification' }).click();
        const notification = flash('New comment');
        await notification.waitFor({ timeout: 5000 });
        // Markdown became HTML; the image with an event handler was removed.
        assert.equal(await notification.locator('.nv-no-notification-title strong').innerText(), 'comment');
        assert.equal(await notification.locator('.nv-no-notification-body em').innerText(), '"Great release!"');
        assert.equal(await notification.locator('img').count(), 0);
        assert.equal(await page.evaluate(() => window.injected ?? false), false);
        // A button with its icon, a disabled link without href, an icon button keeping only harmless attributes.
        const view = notification.locator('a.nv-btn', { hasText: 'View' });
        assert.equal(await view.getAttribute('href'), '/lab');
        assert.equal(await view.locator('svg').count(), 1);
        const locked = notification.locator('.nv-link', { hasText: 'Locked' });
        assert.equal(await locked.getAttribute('href'), null);
        assert.equal(await locked.getAttribute('aria-disabled'), 'true');
        // Its tooltip is plain text, and the tooltip directive is set up on it.
        assert.match(await locked.getAttribute('x-tooltip'), /content: 'You may not do this', theme: \$store\.theme, allowHTML: false/);
        assert.ok(await locked.evaluate((el) => Boolean(el._tippy)));
        const flag = notification.locator('[data-test="flag"]');
        assert.equal(await flag.getAttribute('aria-label'), 'Flag');
        assert.equal(await flag.getAttribute('onclick'), null);
        await flag.click();
        assert.equal(await page.evaluate(() => window.injected ?? false), false);
    });

    await step('an action group: its item dispatches a Livewire event, another one closes the notification', async () => {
        const notification = flash('New comment');
        await notification.locator('.nv-ac-link-group', { hasText: 'More' }).click();
        const approve = page.getByRole('menuitem', { name: 'Approve' });
        await approve.waitFor({ timeout: 3000 });
        await approve.click();
        await until(async () => (await page.getByText('Approvals: 1').count()) === 1, 'the page listener');
        // The notification is still there; "Dismiss" closes it (the notification's close, not the dropdown's).
        await notification.locator('.nv-ac-link-group', { hasText: 'More' }).click();
        await page.getByRole('menuitem', { name: 'Dismiss' }).click();
        await flash('New comment').waitFor({ state: 'hidden', timeout: 5000 });
    });

    await step('a text entry suffix action: a small icon button running its action', async () => {
        const entry = page.locator('.nv-in-text-affixed', { hasText: '€12' });
        const button = entry.locator('.nv-in-text-affix button.nv-icon-btn.nv-size-sm');
        assert.equal(await button.getAttribute('aria-label'), 'Copy cost to price');
        await button.click();
        await flash('Cost copied to the price').waitFor({ timeout: 5000 });
        // The character limit cuts the description.
        assert.ok((await page.getByText('A long description t...').count()) === 1);
    });

    await step('a private image is shown through a temporary signed URL; forged and unsigned URLs are refused', async () => {
        const image = page.locator('.nv-in-image img').first();
        const src = await image.getAttribute('src');
        assert.match(src, /^\/lab-private-files\/scans\/receipt\.png\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/);
        await until(async () => image.evaluate((img) => img.complete && img.naturalWidth === 2), 'the image to load');
        const status = async (url) => (await page.request.get(`${BASE}${url}`)).status();
        assert.equal(await status(src), 200);
        assert.equal(await status(src.split('?')[0]), 403);
        assert.equal(await status(src.replace(/signature=[^&]+/, `signature=${'A'.repeat(43)}`)), 403);
        assert.equal(await status(src.replace(/expires=\d+/, (m) => `expires=${Number(m.slice(8)) + 3600}`)), 403);
        assert.equal(await status(src.replace('receipt.png', 'receipt.png.meta.json')), 404);
        assert.ok([403, 404].includes(await status(`/lab-private-files/..%2F..%2Fe2e.sqlite?${src.split('?')[1]}`)));
        // A missing private file shows the default image.
        assert.match(await page.locator('.nv-in-image img').nth(1).getAttribute('src'), /navette-icon\.svg$/);
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'd11-ui.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
