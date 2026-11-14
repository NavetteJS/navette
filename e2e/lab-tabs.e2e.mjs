// Tabs: lazy-loaded tab badges fetched after the page has rendered, tabs bound to a Livewire property (with and
// without content panels). Run by e2e/run.mjs on the `/lab` "Tabs lab" page (not registered with NAVETTE_NO_THEMES).
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

const tabsNamed = (label) => page.locator('.nv-sc-tabs').filter({ has: page.locator(`[aria-label="${label}"]`) });
const tabButton = (label, name) => tabsNamed(label).locator('.nv-tabs-item').filter({ has: page.locator('.nv-tabs-item-label', { hasText: new RegExp(`^${name}$`) }) });

await login(page, BASE, user);
try {
    await step('lazy-loaded badges: a loading indicator, then the badge fetched by a second request', async () => {
        const badgeRequests = [];
        page.on('request', (request) => { if (request.method() === 'POST' && (request.postData() ?? '').includes('getLazyLoadedTabBadges')) badgeRequests.push(request); });
        await page.goto(`${BASE}/lab/tabs`);
        await page.getByRole('heading', { name: 'Tabs lab' }).waitFor();
        const unread = tabButton('Inbox', 'Unread');
        await until(async () => (await unread.locator('.nv-badge-label').count()) === 1, 'the lazy badge');
        assert.equal((await unread.locator('.nv-badge-label').innerText()).trim(), '7');
        assert.match(await unread.locator('.nv-badge').getAttribute('class'), /nv-badge nv-size-sm nv-color nv-color-danger/);
        assert.equal(await unread.locator('.nv-badge svg').count(), 1, 'the badge icon');
        assert.equal(await unread.locator('.nv-tabs-item-badge-placeholder').isVisible(), false);
        assert.equal(badgeRequests.length, 1);
        // A lazy badge whose value is null shows nothing; the regular badge was in the page from the start.
        assert.equal(await tabButton('Inbox', 'Spam').locator('.nv-badge').count(), 0);
        assert.equal((await tabButton('Inbox', 'All').locator('.nv-badge-label').innerText()).trim(), '12');
    });

    await step('Livewire property tabs: a click sets the property and renders only the active tab', async () => {
        const status = tabsNamed('Status');
        assert.equal(await tabButton('Status', 'All').getAttribute('aria-selected'), 'true');
        assert.match(await status.locator('[role="tabpanel"].nv-active').innerText(), /Showing: All posts\./);
        await tabButton('Status', 'Published').click();
        await until(async () => /Showing: Published posts\./.test(await status.locator('[role="tabpanel"].nv-active').innerText()), 'the published tab content');
        assert.equal(await tabButton('Status', 'Published').getAttribute('aria-selected'), 'true');
        assert.equal(await tabButton('Status', 'All').getAttribute('aria-selected'), 'false');
        // Inactive tabs are not rendered on the server.
        assert.equal(await status.locator('[role="tabpanel"]').filter({ hasText: 'Showing:' }).count(), 1);
    });

    await step('tabs without panels: a group of pressed buttons changing a property', async () => {
        const period = tabsNamed('Period');
        assert.equal(await period.locator('[role="group"]').count(), 1);
        assert.equal(await period.locator('[role="tab"], [role="tabpanel"]').count(), 0);
        assert.equal(await tabButton('Period', 'This week').getAttribute('aria-pressed'), 'true');
        await tabButton('Period', 'This month').click();
        await until(async () => (await page.getByText('Selected period: month.').count()) === 1, 'the selected period');
        assert.equal(await tabButton('Period', 'This month').getAttribute('aria-pressed'), 'true');
        assert.equal(await tabButton('Period', 'This week').getAttribute('aria-pressed'), 'false');
        // The other tabs keep their state: the status tab chosen before is still active.
        assert.equal(await tabButton('Status', 'Published').getAttribute('aria-selected'), 'true');
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'lab-tabs.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
