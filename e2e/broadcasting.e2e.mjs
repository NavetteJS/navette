// Broadcasting: notifications sent on the server appear live in the user's other open pages, and the bell refreshes
// without polling. Also checks registered assets and that the stream refuses guests.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import { login, reporter, specArgs } from './support.mjs';

const { base, user } = specArgs();
const { step, check, fail, exitCode } = reporter();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors = [];
const sender = await context.newPage();
const watcher = await context.newPage();
for (const page of [sender, watcher]) page.on('pageerror', (error) => errors.push(error.message));
const connected = (page) => page.waitForFunction(() => window.navetteBroadcasting?.isConnected() === true, null, { timeout: 10000 });
const toast = (page, title) => page.locator('.fi-no-notification', { hasText: title });
const unread = (page) => page.locator('.fi-sidebar-database-notifications-btn-badge-ctn .fi-badge-label').first().textContent({ timeout: 2000 }).then((text) => Number(text?.trim() || 0), () => 0);
try {
    await login(sender, base, user);
    await sender.goto(`${base}/live-notifications`);
    await watcher.goto(`${base}/shop/customers`);

    await step('both pages open the broadcast stream', async () => {
        await Promise.all([connected(sender), connected(watcher)]);
    });

    await step('a notification broadcast by the server appears live in another open page', async () => {
        await sender.getByRole('button', { name: 'Broadcast a notification' }).click();
        await toast(watcher, 'Live notification').waitFor({ timeout: 5000 });
        await toast(sender, 'Live notification').waitFor({ timeout: 5000 });
    });

    await step('a notification sent after the request has ended (background job) still arrives', async () => {
        await sender.getByRole('button', { name: 'Broadcast in 2 seconds' }).click();
        await toast(sender, 'Job started').waitFor({ timeout: 5000 });
        check((await toast(watcher, 'Background job finished').count()) === 0, 'the background notification is not there before the job ends');
        await toast(watcher, 'Background job finished').waitFor({ timeout: 8000 });
    });

    await step('after SPA navigation, the stream is still open and delivers', async () => {
        await watcher.locator('.fi-sidebar a[href$="/shop/orders"]').first().click();
        await watcher.waitForURL(/\/shop\/orders$/);
        await connected(watcher);
        await sender.getByRole('button', { name: 'Broadcast a notification' }).click();
        await watcher.locator('.fi-no-notification', { hasText: 'Live notification' }).first().waitFor({ timeout: 5000 });
    });

    await step('the bell does not poll with broadcasting, and refreshes when a database notification is sent', async () => {
        check((await watcher.locator('.fi-no-database [wire\\:poll], .fi-no-database[wire\\:poll], [wire\\:poll\\.30s]').count()) === 0, 'no wire:poll on the database notifications');
        const before = await unread(watcher);
        await sender.getByRole('button', { name: 'Add to my notifications' }).click();
        await watcher.waitForFunction((count) => Number(document.querySelector('.fi-sidebar-database-notifications-btn-badge-ctn .fi-badge-label')?.textContent?.trim() || 0) === count + 1, before, { timeout: 8000 });
    });

    await step('a registered Alpine component is loaded on request (x-load) from its versioned URL', async () => {
        const clock = sender.locator('[data-live-clock]');
        check(/^\/js\/app\/components\/live-clock\.js\?v=[0-9a-f]{12}$/.test((await clock.getAttribute('x-load-src')) ?? ''), 'versioned component URL');
        await sender.waitForFunction(() => /^\d{2}:\d{2}:\d{2}$/.test(document.querySelector('[data-live-clock]')?.textContent?.trim() ?? ''), null, { timeout: 5000 });
    });

    await step('the stream refuses a request without the session', async () => {
        const response = await fetch(`${base}/livewire/broadcasting`, { headers: { accept: 'text/event-stream' } });
        check(response.status === 401, 'guest request answered 401', String(response.status));
        await response.body?.cancel();
    });

    await step('the stream script is served and versioned with the panel assets', async () => {
        const src = await watcher.locator('script[src*="navette/broadcasting.js"]').getAttribute('src');
        const response = await fetch(base + src);
        check(response.ok && (await response.text()).includes('navetteBroadcasting'), 'broadcasting.js is served', src ?? '');
    });
} catch (error) {
    fail(`spec stopped: ${String(error?.message ?? error).split('\n')[0]}`);
} finally {
    await browser.close();
}
process.exit(exitCode(errors));
