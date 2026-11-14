import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { sqlite } from '@navette-js/database';
import { ColorManager } from '@navette-js/support';
import { WireRuntime, type Snapshot } from '@navette-js/wire';
import { knexNotificationStore, NavigationGroup, Notification, Notifications, Page, Panel, panelRouter, type AuthProvider, type User } from '../src/index.ts';
import { notificationActionFromArray, notificationActionsHtml, renderNotification, useNotificationsColorManager } from '../src/notifications.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };

test('Notification.fromArray(): the JSON of NavetteNotification is read, and what comes from the browser is checked', () => {
    const data = Notification.fromArray({
        id: 'greeting', title: 'Saved', body: 'Changes saved.', status: 'success', color: 'warning', icon: 'heroicon-o-document-text', iconColor: 'info', duration: 5000,
        actions: [
            { name: 'viewPost', url: '/posts/1', shouldOpenUrlInNewTab: true, view: 'navette::components.button.index', color: 'gray' },
            { name: 'undo', label: 'Undo', event: 'undoEditingPost', eventData: [5], dispatchDirection: 'to', dispatchToComponent: 'posts-table', shouldClose: true },
            { actions: [{ name: 'grouped' }] },
            'not an action',
        ],
    }).getData();
    assert.equal(data.id, 'greeting');
    assert.deepEqual([data.title, data.body, data.status, data.color, data.icon, data.iconColor, data.duration], ['Saved', 'Changes saved.', 'success', 'warning', 'o-document-text', 'info', 5000]);
    assert.deepEqual(data.actions, [
        { name: 'viewPost', label: 'View post', url: '/posts/1', openUrlInNewTab: true, close: false, dispatch: null, color: 'gray', button: true, outlined: false, markAsRead: false, markAsUnread: false },
        { name: 'undo', label: 'Undo', url: null, openUrlInNewTab: false, close: true, dispatch: { event: 'undoEditingPost', data: [5], direction: 'to', component: 'posts-table' }, color: null, button: false, outlined: false, markAsRead: false, markAsUnread: false },
        // Action groups are read too (Filament's `ActionGroup::fromArray()`).
        { group: true, actions: [{ name: 'grouped', label: 'Grouped', url: null, openUrlInNewTab: false, close: false, dispatch: null, color: null, button: false, outlined: false, markAsRead: false, markAsUnread: false }], label: null, icon: null, color: null, size: 'sm', tooltip: null, view: 'link', dropdown: true, placement: null, width: null, offset: null, maxHeight: null, extraAttributes: undefined },
    ]);

    // Forged values: unsafe ids are replaced, unknown statuses, colors, icons and event names are dropped, durations are bounded.
    const forged = Notification.fromArray({
        id: '__proto__', status: 'evil', color: 'red" onclick="x', icon: '../../secret', iconColor: '<b>', duration: 1e12,
        actions: [{ label: 'x', event: 'a" onclick="b' }, { label: 'y', event: 'ok', dispatchDirection: 'to' }],
    }).getData();
    assert.match(forged.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual([forged.status, forged.color, forged.icon, forged.iconColor, forged.duration], [null, null, null, null, 86_400_000]);
    assert.deepEqual(forged.actions?.map((action: any) => action.dispatch), [null, null], 'no event without a valid name, nor "to" without a component');
    assert.equal(Notification.fromArray({ duration: 'persistent' }).getData().duration, 'persistent');
    assert.equal(Notification.fromArray('nope').getData().title, null);

    // Custom ids, to close a notification from JavaScript.
    assert.equal(Notification.make('greeting').getId(), 'greeting');
    assert.throws(() => Notification.make("x') alert(1) ('"), /Invalid notification id/);
    assert.equal(Notification.make().seconds(3).getData().duration, 3000);
});

test('notification actions: Filament click handlers, colors from the panel, URLs checked', () => {
    useNotificationsColorManager(new ColorManager());
    const html = notificationActionsHtml(Notification.make().actions([
        { label: 'Undo', dispatch: { event: 'undo', data: { id: 5 }, self: true }, close: true, button: true },
        { label: 'Refresh', dispatch: { event: 'refresh', to: 'orders-table' }, color: 'gray', button: true, outlined: true },
        { label: 'Read', markAsRead: true },
        { label: 'Open', url: '/orders/5', close: true },
        { label: 'Evil', url: 'data:text/html,<script>alert(1)</script>' },
    ]).getData().actions, { navigate: true });
    assert.match(html, /<button type="button" x-on:click="\$wire\.\$dispatchSelf\(&#039;undo&#039;, [^"]+\); close\(\)" class="nv-ac-btn-action nv-btn nv-size-sm nv-color nv-color-primary nv-bg-color-\d+ /);
    assert.match(html, /x-on:click="Livewire\.dispatchTo\(&#039;orders-table&#039;, &#039;refresh&#039;, [^"]+\)" class="nv-ac-btn-action nv-btn nv-size-sm nv-outlined nv-color nv-color-gray/);
    assert.match(html, /<button type="button" x-on:click="markAsRead\(\)" class="nv-ac-link-action nv-link nv-size-sm nv-color nv-color-primary nv-text-color-\d+ dark:nv-text-color-\d+"><span class="nv-link-label">Read<\/span><\/button>/);
    // Closing before following a link in the same tab closes at once, like Filament.
    assert.match(html, /<a href="\/orders\/5" wire:navigate x-on:click="close\(true\)"/);
    assert.doesNotMatch(html, /data:|Evil/);
    assert.throws(() => Notification.make().actions([{ label: 'x', dispatch: { event: 'ok', to: 'a" b' } }]), /Invalid component name/);

    // Background color of the notification.
    assert.match(renderNotification(Notification.make().title('Hi').color('success').getData()), /class="nv-color nv-color-success nv-no-notification"/);
    assert.match(renderNotification(Notification.make().title('Hi').color('gray').getData()), /class="nv-no-notification"/);
});

test('notifications component: a notification sent from JavaScript is pushed, closed, and its position can be changed', async () => {
    const runtime = new WireRuntime({ key: 'k' }).register('navette.notifications', Notifications);
    const { snapshot } = await runtime.mountWithInstance('navette.notifications', {}, { ctx: { mailbox: 'm' } });
    // Snapshot data: `[value, { s: 'arr' }]` tuples.
    const ids = (snap: Snapshot) => Object.keys((snap.data.notifications as any)[0]);
    const dispatch = (snap: Snapshot, event: string, params: unknown) => runtime.update(JSON.parse(JSON.stringify(snap)), {}, [{ method: '__dispatch', params: [event, params] }], { mailbox: 'm' });
    // `NavetteNotification.send()` dispatches `notificationSent` with `{ notification }`.
    let next = await dispatch(snapshot, 'notificationSent', { notification: { id: 'js-1', title: '<b>Saved</b><img src=x onerror=alert(1)><script>alert(2)</script>', status: 'success', duration: 'persistent' } });
    // Title and body are sanitized HTML, as in Filament: formatting stays, scripts and event handlers go.
    assert.match(next.effects.html!, /<h3 class="nv-no-notification-title"><b>Saved<\/b>/);
    assert.doesNotMatch(next.effects.html!, /onerror|<script|alert\(2\)/);
    assert.match(next.effects.html!, /x-on:close-notification\.window="if \(\$event\.detail\.id == &#039;js-1&#039;\) close\(\)"|x-on:close-notification\.window="if \(\$event\.detail\.id == 'js-1'\) close\(\)"/);
    assert.deepEqual(ids(next.snapshot), ['js-1']);
    // Invalid data is ignored.
    next = await dispatch(next.snapshot, 'notificationSent', { notification: 'nope' });
    assert.deepEqual(ids(next.snapshot), ['js-1']);
    // Closing it in the browser (`notificationClosed`) removes it.
    next = await dispatch(next.snapshot, 'notificationClosed', { id: 'js-1' });
    assert.deepEqual(ids(next.snapshot), []);
    // At most 20 are kept, the oldest go first.
    for (let i = 0; i < 22; i++) next = await dispatch(next.snapshot, 'notificationSent', { notification: { id: `n-${i}`, title: `#${i}` } });
    assert.equal(ids(next.snapshot).length, 20);
    assert.equal(ids(next.snapshot)[0], 'n-2');

    assert.match(next.effects.html!, /class="nv-no nv-align-right nv-vertical-align-start"/);
    Notifications.alignment('start');
    Notifications.verticalAlignment('end');
    try {
        assert.match((await dispatch(next.snapshot, 'notificationClosed', { id: 'n-5' })).effects.html!, /class="nv-no nv-align-start nv-vertical-align-end"/);
        assert.throws(() => Notifications.alignment('top' as any), /Invalid notifications alignment/);
    } finally {
        Notifications.alignment('right');
        Notifications.verticalAlignment('start');
    }
});

test('database notifications: action buttons are stored in the Filament format and read back', async () => {
    const knex = sqlite(':memory:');
    try {
        await knex.schema.createTable('notifications', (table) => {
            table.uuid('id').primary(); table.string('type'); table.string('notifiable_type'); table.integer('notifiable_id'); table.text('data'); table.timestamp('read_at').nullable(); table.timestamps();
        });
        const store = knexNotificationStore(knex);
        await Notification.make().title('Invoice ready').color('info').actions([
            { label: 'Open', url: '/invoices/1', button: true },
            { label: 'Mark as read', markAsRead: true, color: 'gray' },
            { label: 'Archive', dispatch: { event: 'archiveInvoice', data: { id: 1 } }, close: true },
        ]).sendToDatabase(store, 1);
        const row = await knex('notifications').first();
        const stored = JSON.parse(row.data);
        assert.equal(stored.color, 'info');
        assert.deepEqual(stored.actions.map((action: any) => [action.label, action.view, action.url, action.event, action.shouldMarkAsRead, action.shouldClose]), [
            ['Open', 'navette::components.button.index', '/invoices/1', null, false, false],
            ['Mark as read', 'navette::components.link', null, null, true, false],
            ['Archive', 'navette::components.link', null, 'archiveInvoice', false, true],
        ]);
        const [read] = await store.list(1, 10);
        assert.equal(read.color, 'info');
        assert.deepEqual(read.actions.map((action) => [action.label, action.button, action.markAsRead, action.close, action.dispatch?.event ?? null]), [
            ['Open', true, false, false, null], ['Mark as read', false, true, false, null], ['Archive', false, false, true, 'archiveInvoice'],
        ]);
        // Rows written by Filament are read the same way; `mapUrl` rewrites their URLs.
        assert.equal(notificationActionFromArray({ name: 'view', url: 'https://old.example/posts/1' }, (url) => url.replace(/^https?:\/\/[^/]+/, ''))?.url, '/posts/1');
    } finally { await knex.destroy(); }
});

test('collapsed sidebar: a navigation group with an icon has a dropdown of its items, like Filament', async () => {
    class Orders extends Page { static slug = 'orders'; static navigationGroup = 'Shop'; static navigationIcon = 'o-shopping-bag'; }
    class Refunds extends Page { static slug = 'refunds'; static navigationGroup = 'Shop'; static navigationParentItem = 'Orders'; static navigationIcon = 'o-receipt-refund'; }
    class Products extends Page { static slug = 'products'; static navigationGroup = 'Shop'; static navigationIcon = 'o-cube'; static navigationSort = 1; }
    class Settings extends Page { static slug = 'settings'; static navigationGroup = 'Admin'; static navigationIcon = 'o-cog-6-tooth'; }
    const panel = Panel.make().id('collapsed').path('collapsed').key('collapsed-key').authGuard('collapsed').auth(auth).pages([Orders, Refunds, Products, Settings])
        .navigationGroups([NavigationGroup.make('Shop').icon('o-shopping-cart'), 'Admin']);
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try {
        let cookie = '';
        panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
        const get = async (path: string) => (await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, { headers: { cookie } })).text();
        // Without a sidebar collapsible on desktop, no dropdown.
        assert.doesNotMatch(await get('/collapsed/refunds'), /nv-sidebar-group-dropdown-trigger-btn/);

        panel.sidebarCollapsibleOnDesktop();
        const html = await get('/collapsed/refunds');
        const shop = html.slice(html.indexOf('data-group-label="Shop"'), html.indexOf('data-group-label="Admin"'));
        assert.match(shop, /<div x-data="navetteDropdown\(\{ isMenu: true \}\)" x-show="! \$store\.sidebar\.isOpen" class="nv-dropdown">/);
        assert.match(shop, /<button aria-label="Shop" x-data="navetteSidebarTooltip" x-tooltip="getTooltip\(\{ content: &#39;Shop&#39;, allowHTML: false, \}\)" class="nv-sidebar-group-dropdown-trigger-btn">/);
        assert.match(shop, /x-float\.placement\.right-start\.flip\.offset=/);
        assert.match(shop, /<div class="nv-dropdown-header">\s*<span>\s*Shop\s*<\/span>/);
        // An item with child items forms a list with them; the dropdown keeps the items' icons; the current page is highlighted.
        const lists = [...shop.matchAll(/<div class="nv-dropdown-list">([\s\S]*?)<\/div>\s*(?=<div class="nv-dropdown-list">|<\/div>)/g)].map((match) => [...match[1].matchAll(/nv-dropdown-list-item-label">([^<]+)</g)].map((label) => label[1]));
        assert.deepEqual(lists, [['Orders', 'Refunds'], ['Products']]);
        assert.match(shop, /<a href="\/collapsed\/refunds" aria-current="page" class="nv-dropdown-list-item nv-color nv-color-primary[^"]*" role="menuitem" tabindex="-1"><svg[^>]*class="nv-color nv-color-primary nv-icon nv-size-md"/);
        // Collapsed, the group's button and items are hidden: the dropdown replaces them.
        assert.match(shop, /class="nv-sidebar-group-btn"/);
        assert.match(shop, /x-show="\$store\.sidebar\.isOpen" x-transition:enter="nv-transition-enter"[^>]*class="nv-sidebar-group-btn"/);
        assert.match(shop, /x-show="\$store\.sidebar\.isOpen \? ! \$store\.sidebar\.groupIsCollapsed\(label\) : ! true"/);
        // The items of a group without an icon stay, as icons with a tooltip.
        const admin = html.slice(html.indexOf('data-group-label="Admin"'));
        assert.doesNotMatch(admin.slice(0, admin.indexOf('</li>')), /nv-sidebar-group-dropdown-trigger-btn/);
        assert.match(admin, /x-show="\$store\.sidebar\.isOpen \? ! \$store\.sidebar\.groupIsCollapsed\(label\) : ! false"/);
        assert.match(admin, /x-bind:aria-label="\$store\.sidebar\.isOpen \? null : &#39;Settings&#39;" x-data="navetteSidebarTooltip" x-tooltip="getTooltip\(\{ content: &#39;Settings&#39;, allowHTML: false, \}\)" class="nv-sidebar-item-btn"/);
        assert.match(admin, /<span x-show="\$store\.sidebar\.isOpen" x-transition:enter="nv-transition-enter"[^>]*class="nv-sidebar-item-label">/);
    } finally { server.close(); }
});
