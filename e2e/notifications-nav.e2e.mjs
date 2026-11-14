// Notifications sent and closed from JavaScript, action buttons in database notifications, and the dropdown of a navigation
// group when the sidebar is collapsed to icons (lab panel). Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile);

const flash = (text) => page.locator('.fi-no .fi-no-notification', { hasText: text });

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');

    await step('a notification sent from JavaScript is displayed, with its actions', async () => {
        await page.evaluate(() => {
            new window.FilamentNotification()
                .id('greeting')
                .title('Hello from JavaScript')
                .body('<img src=x onerror="window.injected = true">')
                .success()
                .persistent()
                .actions([
                    new window.FilamentNotificationAction('viewCustomers').button().url('/customers'),
                    new window.FilamentNotificationAction('evil').label('Evil').url('javascript:window.injected = true'),
                    new window.FilamentNotificationAction('dismiss').color('gray').close(),
                ])
                .send();
        });
        await flash('Hello from JavaScript').waitFor({ timeout: 5000 });
        const notification = flash('Hello from JavaScript');
        assert.ok(await notification.evaluate((el) => el.classList.contains('fi-status-success')));
        // The body is sanitized HTML, as in Filament: the image with an event handler is removed.
        assert.equal(await notification.locator('.fi-no-notification-body img').count(), 0);
        // The default label comes from the action name; only a local or http(s) URL becomes a link.
        const view = notification.locator('a.fi-btn', { hasText: 'View customers' });
        assert.equal(await view.getAttribute('href'), '/customers');
        assert.equal(await notification.getByText('Evil').count(), 0);
        assert.equal(await notification.locator('[href^="javascript"]').count(), 0);
        assert.equal(await page.evaluate(() => window.injected ?? false), false);
    });

    await step('the notification is closed from JavaScript with the close-notification event', async () => {
        const closed = page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes('notificationClosed'));
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('close-notification', { detail: { id: 'greeting' } })));
        await flash('Hello from JavaScript').waitFor({ state: 'hidden', timeout: 5000 });
        // The notifications component forgets it: it does not come back with the next notification.
        await closed;
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => new window.FilamentNotification().title('Second notification').send());
        await flash('Second notification').waitFor({ timeout: 5000 });
        assert.equal(await flash('Hello from JavaScript').count(), 0);
    });

    await step('an action button closes the notification', async () => {
        await page.evaluate(() => new window.FilamentNotification().title('Closable').persistent().actions([new window.FilamentNotificationAction('close').button().close()]).send());
        await flash('Closable').waitFor({ timeout: 5000 });
        await flash('Closable').getByRole('button', { name: 'Close', exact: true }).click();
        await flash('Closable').waitFor({ state: 'hidden', timeout: 5000 });
    });

    await step('a forged notification is refused or cleaned by the server', async () => {
        // Invalid data straight to the listener is ignored.
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('notificationSent', { detail: { notification: 'not an object' } })));
        await page.evaluate(() => new window.FilamentNotification().id('__proto__').title('Odd id').icon('../../etc/passwd').color('red" onclick="x').send());
        await flash('Odd id').waitFor({ timeout: 5000 });
        const html = await flash('Odd id').evaluate((el) => el.outerHTML);
        assert.doesNotMatch(html, /__proto__|onclick|passwd/);
    });

    await step('database notifications show their action buttons and change the read state', async () => {
        const id = randomUUID();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const data = {
            format: 'filament', title: 'Invoice ready', body: 'Invoice #42 can be downloaded.', status: 'info', duration: 'persistent', icon: null, iconColor: null, color: null, view: null, viewData: [],
            actions: [
                { name: 'open', label: 'Open invoice', url: '/orders', view: 'filament::components.button.index', color: 'primary', shouldOpenUrlInNewTab: false },
                { name: 'markRead', label: 'Mark read', view: 'filament::components.button.index', color: 'gray', shouldMarkAsRead: true },
                { name: 'evil', label: 'Evil link', url: 'javascript:window.injected = true', view: 'filament::components.link' },
            ],
        };
        db.prepare('insert into notifications (id, type, notifiable_type, notifiable_id, data, read_at, created_at, updated_at) values (?, ?, ?, ?, ?, null, ?, ?)')
            .run(id, 'Filament\\Notifications\\DatabaseNotification', 'App\\Models\\User', user.id, JSON.stringify(data), now, now);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.locator('.fi-no-database .fi-modal-trigger').first().click();
        const item = page.locator('.fi-no-database .fi-no-notification', { hasText: 'Invoice ready' });
        await item.waitFor({ timeout: 5000 });
        assert.equal(await item.locator('a.fi-btn', { hasText: 'Open invoice' }).getAttribute('href'), '/orders');
        assert.equal(await item.getByText('Evil link').count(), 0);
        const marked = page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes('markedNotificationAsRead'));
        await item.getByRole('button', { name: 'Mark read' }).click();
        await marked;
        assert.notEqual(db.prepare('select read_at from notifications where id = ?').get(id).read_at, null);
        db.prepare('delete from notifications where id = ?').run(id);
        await page.keyboard.press('Escape');
    });

    await step('collapsed sidebar: a group with an icon opens a dropdown of its items', async () => {
        await page.goto(`${BASE}/lab/fields`);
        await page.waitForLoadState('networkidle');
        const sidebar = page.locator('.fi-main-sidebar');
        const group = sidebar.locator('.fi-sidebar-group', { has: page.locator('.fi-sidebar-group-label', { hasText: 'Tables' }) });
        // Open: the group shows its label and items, not the dropdown trigger.
        await group.locator('.fi-sidebar-group-btn').waitFor();
        assert.equal(await group.locator('.fi-sidebar-group-dropdown-trigger-btn').isVisible(), false);
        await page.locator('.fi-topbar-close-collapse-sidebar-btn').click();
        const trigger = group.locator('.fi-sidebar-group-dropdown-trigger-btn');
        await trigger.waitFor();
        await group.locator('.fi-sidebar-group-btn').waitFor({ state: 'hidden' });
        // The items close with a short animation.
        await group.locator('.fi-sidebar-group-items').waitFor({ state: 'hidden' });
        // A group without an icon keeps its items, shown as icons.
        const forms = sidebar.locator('.fi-sidebar-group', { has: page.locator('.fi-sidebar-group-label', { hasText: 'Forms' }) });
        await forms.locator('.fi-sidebar-item-label').first().waitFor({ state: 'hidden' });
        assert.ok(await forms.locator('.fi-sidebar-item-icon').first().isVisible());

        await trigger.click();
        const panel = group.locator('.fi-dropdown-panel');
        await panel.waitFor();
        assert.equal((await panel.locator('.fi-dropdown-header').innerText()).trim(), 'Tables');
        // "Cards layout" is a child item of "Products lab": they form a list of their own, with their icons; "Orders lab" follows in another list.
        const lists = panel.locator('.fi-dropdown-list');
        assert.equal(await lists.count(), 2);
        assert.deepEqual((await lists.nth(1).locator('.fi-dropdown-list-item-label').allInnerTexts()).map((label) => label.trim()), ['Orders lab']);
        assert.deepEqual((await lists.first().locator('.fi-dropdown-list-item-label').allInnerTexts()).map((label) => label.trim()), ['Products lab', 'Cards layout']);
        assert.equal(await lists.first().locator('.fi-dropdown-list-item .fi-icon').count(), 2);
        await panel.getByRole('menuitem', { name: 'Cards layout' }).click();
        await page.waitForURL((url) => url.pathname === '/lab/cards');
        await page.waitForLoadState('networkidle');

        // On the page of one of its items, the item is active in the dropdown.
        await group.locator('.fi-sidebar-group-dropdown-trigger-btn').click();
        assert.equal(await group.locator('.fi-dropdown-list-item[aria-current="page"]').innerText().then((t) => t.trim()), 'Cards layout');
        await page.keyboard.press('Escape');

        // Expanded again: the items are back (the state is kept in the browser, so restore it for the other specs).
        await page.locator('.fi-topbar-open-collapse-sidebar-btn').click();
        await group.locator('.fi-sidebar-group-items').waitFor();
        await trigger.waitFor({ state: 'hidden' });
    });
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
