import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { Cluster, NavigationItem, Page, Panel, Resource, panelRouter, type AuthProvider, type DataAdapter, type User } from '../src/index.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };
const adapter = { getKey: (record: any) => String(record.id), paginate: async () => ({ records: [], total: 0, page: 1, perPage: 10, lastPage: 1, from: null, to: null }) } as unknown as DataAdapter;

test('nested navigation: an item with a parent item is shown below it, which stays open while one of them is active', () => {
    class Orders extends Page { static slug = 'orders'; static navigationGroup = 'Shop'; static navigationIcon = 'o-shopping-bag'; }
    class Refunds extends Page { static slug = 'refunds'; static navigationGroup = 'Shop'; static navigationParentItem = 'Orders'; static navigationSort = 1; }
    class Disputes extends Page { static slug = 'disputes'; static navigationGroup = 'Shop'; static navigationParentItem = 'Orders'; static navigationSort = 2; }
    const panel = Panel.make().id('nested').pages([Orders, Refunds, Disputes])
        .navigationItems([NavigationItem.make('Reports').group('Shop').childItems([NavigationItem.make('Sales').url('/reports/sales')])]);
    const [shop] = panel.getNavigation('/refunds');
    assert.deepEqual(shop.items.map((item) => item.label), ['Orders', 'Reports']);
    const orders = shop.items[0];
    assert.deepEqual(orders.childItems.map((item) => item.label), ['Refunds', 'Disputes']);
    assert.equal(orders.activeChildItems, true);
    assert.equal(orders.isActive, false, 'the parent is not active itself');
    assert.equal(orders.childItems[0].isActive, true);
    assert.equal(shop.isActive, true);
    assert.deepEqual(shop.items[1].childItems.map((item) => item.url), ['/reports/sales']);
});

test('clusters: their pages and resources are served under their URL, in their sub-navigation, with their breadcrumb', async () => {
    class SettingsCluster extends Cluster { static navigationIcon = 'o-cog-6-tooth'; }
    class Profile extends Page { static slug = 'profile'; static title = 'Profile'; static cluster = SettingsCluster; static navigationSort = 2; }
    class Secret extends Page { static slug = 'secret'; static cluster = SettingsCluster; static canAccess() { return false; } }
    class Users extends Resource { static slug = 'users'; static adapter = adapter; static cluster = SettingsCluster; static navigationSort = 1; static modelLabel = 'user'; static navigationGroup = 'People'; }
    const panel = Panel.make().id('clusters').spa().key('clusters-key').authGuard('clusters').auth(auth).pages([Profile, Secret]).resources([Users]);
    assert.equal(SettingsCluster.getSlug(), 'settings');
    assert.equal(Profile.slug, 'settings/profile');
    assert.equal(Users.getUrl(), '/settings/users');
    assert.deepEqual(panel.getClusteredComponents(SettingsCluster).map((page) => page.slug), ['settings/profile', 'settings/secret', 'settings/users']);
    // The menu shows the cluster only, active on its pages.
    const items = panel.getNavigation('/settings/users').flatMap((group) => group.items);
    assert.deepEqual(items.map((item) => item.label), ['Settings']);
    assert.equal(items[0].isActive, true);
    // Its sub-navigation lists what the user can open, sorted, with their groups.
    const profile = Object.assign(new Profile(), { _ctx: { panel, user: ada } });
    const sub = await panel.getClusterSubNavigation(SettingsCluster, profile, ada);
    assert.deepEqual(sub.map((item) => [item.label, item.url, item.active, item.group]), [['Users', '/settings/users', false, 'People'], ['Profile', '/settings/profile', true, null]]);
    // A cluster without any accessible page is hidden.
    class EmptyCluster extends Cluster {}
    class Hidden extends Page { static slug = 'hidden'; static cluster = EmptyCluster; static canAccess() { return false; } }
    panel.pages([Hidden]);
    assert.equal(await panel.canAccessPage(EmptyCluster, ada), false);
    assert.ok((await panel.resolveInaccessiblePages(ada)).has('empty'));

    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try {
        let cookie = '';
        panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
        const get = (path: string) => fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, { headers: { cookie }, redirect: 'manual' });
        // Opening the cluster goes to its first page.
        const response = await get('/settings');
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/settings/users');
        const html = await (await get('/settings/profile')).text();
        assert.match(html, /<a href="\/settings" wire:navigate class="nv-breadcrumbs-item-label">\s*Settings\s*<\/a>/);
        assert.match(html, /nv-page-has-sub-navigation/);
        // The sub-navigation is a column before the content by default, with a group per navigation group.
        assert.match(html, /data-group-label="sub_navigation_People"/, 'grouped items under their label');
        assert.match(html, /<a href="\/settings\/profile" wire:navigate aria-current="page"/);
        // As tabs, a group is a dropdown.
        SettingsCluster.subNavigationPosition = 'top';
        const tabs = await (await get('/settings/profile')).text();
        assert.match(tabs, /<button type="button" class="nv-tabs-item"><span class="nv-tabs-item-label">People<\/span><\/button>/);
        assert.match(tabs, /<a href="\/settings\/profile" wire:navigate class="nv-tabs-item nv-active" aria-current="page">/);
        assert.doesNotMatch(html, /settings\/secret/);
    } finally { server.close(); }
});
