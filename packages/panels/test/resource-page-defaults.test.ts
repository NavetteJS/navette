import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WireError } from '@navette-js/wire';
import { ColorManager, Platform } from '@navette-js/support';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { TextInput, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { Table } from '@navette-js/tables';
import { CreateRecord, EditRecord, InteractsWithRecord, ManageRelatedRecords, Notification, Page, Panel, RelationManager, Resource, type DataAdapter, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';
import { searchRelatedRecords } from '../src/record-actions.ts';

const colors = new ColorManager();
useActionsColorManager(colors); useFormsColorManager(colors); useSchemasColorManager(colors); useUiColorManager(colors);

const ada: User = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' };
const rows: Record<string, any> = { 1: { id: 1, title: 'First', locked: false } };
let finds = 0;
const adapter = {
    getKey: (record: any) => String(record.id),
    find: async (key: string) => { finds++; return rows[key] ?? null; },
    create: async (data: Record<string, unknown>) => { const id = Object.keys(rows).length + 1; rows[id] = { id, ...data }; return rows[id]; },
    update: async (key: string, data: Record<string, unknown>) => Object.assign(rows[key], data),
} as unknown as DataAdapter;

const mount = async (PageClass: any, panel: Panel, params: Record<string, unknown> = {}, user: User | null = ada) => {
    const page = new PageClass();
    page._id = 'p';
    page._ctx = { panel, user, req: { headers: {}, get: () => undefined }, res: {} };
    page._errors = {};
    page._effects = {};
    await page.mount(params);
    return page;
};

test('resource create and edit pages: default redirects, the panel-wide redirects, and the policy', async () => {
    const policy = { update: (_user: User, record: any) => !record?.locked && record?.title !== 'Read only' };
    class Posts extends Resource {
        static slug = 'posts'; static adapter = adapter; static hasViewPage = true; static policy = policy;
        static form(schema: Schema): Schema { return schema.components([TextInput.make('title')]); }
    }
    class Notes extends Resource {
        static slug = 'notes'; static adapter = adapter;
        static form(schema: Schema): Schema { return schema.components([TextInput.make('title')]); }
    }
    const panel = Panel.make().id('redirects').resources([Posts, Notes]);
    const pages = Posts.getPages() as any;
    const create = async (resource: typeof Resource, title: string) => {
        const page = await mount((resource.getPages() as any).create, panel);
        page.data = { title };
        await runInRequest('r', () => page.create());
        return page._effects.redirect;
    };
    // Filament's default: the view page when there is one, else the edit page.
    assert.match(await create(Posts, 'A'), /^\/posts\/\d+$/);
    assert.match(await create(Notes, 'B'), /^\/notes\/\d+\/edit$/);
    panel.resourceCreatePageRedirect('index');
    assert.equal(await create(Posts, 'C'), '/posts');
    panel.resourceCreatePageRedirect(() => 'edit');
    assert.equal(panel.getResourceCreatePageRedirect(), 'edit');
    assert.match(await create(Posts, 'D'), /^\/posts\/\d+\/edit$/);
    // A page the user may not open is skipped: the view page instead.
    assert.match(await create(Posts, 'Read only'), /^\/posts\/\d+$/);
    panel.resourceCreatePageRedirect('view');
    assert.equal(await create(Notes, 'F').then((url: string) => /^\/notes\/\d+\/edit$/.test(url)), true, 'no view page: the edit page');
    panel.resourceCreatePageRedirect(null);

    // Edit: the user stays by default; the panel can send them to the list or the view page.
    const save = async () => {
        const page = await mount(pages.edit, panel, { record: '1' });
        page._effects = {};
        await runInRequest('r', () => page.save());
        return page._effects.redirect ?? null;
    };
    assert.equal(await save(), null);
    panel.resourceEditPageRedirect('view');
    assert.equal(await save(), '/posts/1');
    panel.resourceEditPageRedirect('index');
    assert.equal(await save(), '/posts');
    panel.resourceEditPageRedirect(null);
    // Saved into a state the user may no longer edit: they go to the view page.
    const page = await mount(pages.edit, panel, { record: '1' });
    page.data = { title: 'First', locked: true };
    (page as any).handleRecordUpdate = async (record: any) => Object.assign(record, { locked: true });
    page._effects = {};
    await runInRequest('r', () => page.save());
    assert.equal(page._effects.redirect, '/posts/1');
    rows[1].locked = false;
});

test('getCreatedNotification() and getSavedNotification() return the whole notification, or null', async () => {
    class CreateTask extends CreateRecord {
        protected getCreatedNotification(record: any) { return Notification.make().success().title('Task created').body(`"${record.title}" is ready.`).icon('o-check').duration(2000); }
    }
    class EditTask extends EditRecord {
        protected getSavedNotification() { return null; }
    }
    class Tasks extends Resource {
        static slug = 'tasks'; static adapter = adapter; static pages = { create: CreateTask, edit: EditTask };
        static form(schema: Schema): Schema { return schema.components([TextInput.make('title')]); }
    }
    const panel = Panel.make().id('notifications').resources([Tasks]);
    const create = await mount((Tasks.getPages() as any).create, panel);
    create.data = { title: 'Write docs' };
    const { pending } = await runInRequest('n', () => create.create());
    assert.equal(pending.length, 1);
    assert.equal(pending[0].title, 'Task created');
    assert.equal(pending[0].body, '"Write docs" is ready.');
    assert.equal(pending[0].icon, 'o-check');
    assert.equal(pending[0].duration, 2000);
    const edit = await mount((Tasks.getPages() as any).edit, panel, { record: '1' });
    assert.equal((await runInRequest('n', () => edit.save())).pending.length, 0, 'null sends nothing');
    // The default stays the title from getSavedNotificationTitle().
    class Plain extends Resource { static slug = 'plain'; static adapter = adapter; static form(schema: Schema): Schema { return schema.components([TextInput.make('title')]); } }
    Panel.make().id('notifications-plain').resources([Plain]);
    const plain = await mount((Plain.getPages() as any).edit, panel, { record: '1' });
    assert.equal((await runInRequest('n', () => plain.save())).pending[0].title, 'Saved');
});

test('relation managers: getOwnerRecord() through the owner resource (once per request), record titles from the table', async () => {
    const members = [{ id: 'm1', first: 'Grace', last: 'Hopper' }, { id: 'm2', first: 'Alan', last: 'Turing' }];
    const membersAdapter = {
        getKey: (record: any) => record.id,
        paginate: async () => ({ records: members, lastPage: 1 }),
        keysInScope: async () => [],
    } as unknown as DataAdapter;
    class Members extends RelationManager {
        static relationship = 'members'; static modelLabel = 'member';
        static adapterFor() { return membersAdapter; }
        static relatedAdapter() { return membersAdapter; }
        static table(table: Table): Table { return table.recordTitle((record: any) => `${record.first} ${record.last}`); }
    }
    class EditTeam extends EditRecord {}
    class Teams extends Resource { static slug = 'teams'; static adapter = adapter; static relations = [Members]; static pages = { edit: EditTeam }; }
    const panel = Panel.make().id('owners').resources([Teams]);
    const manager = new Members() as any;
    manager._ctx = { panel, user: ada, req: { headers: {}, get: () => undefined }, res: {} };
    manager._runtime = { classOf: () => (Teams.getPages() as any).edit };
    manager.ownerRecord = '1';
    manager.pageClass = 'edit';
    finds = 0;
    assert.equal(manager.getOwnerResource(), Teams);
    assert.equal((await manager.getOwnerRecord()).title, rows[1].title);
    await manager.getOwnerRecord();
    assert.equal(finds, 1, 'loaded once per request');
    assert.equal(manager.resource.getRecordTitle(members[0]), 'Grace Hopper', 'modal headings use the table title');
    const options = { modifyQuery: null, searchColumns: ['first'], limit: 50, allowsDuplicates: false, recordTitle: manager.getRelatableRecordTitleResolver() };
    assert.deepEqual(await searchRelatedRecords(Members as any, '1', '', options), [['m1', 'Grace Hopper'], ['m2', 'Alan Turing']]);
    // An overridden getRecordTitle() wins everywhere.
    class Staff extends Members { getRecordTitle(record: any) { return record.last.toUpperCase(); } }
    const staff = Object.assign(new Staff() as any, { _ctx: manager._ctx, _runtime: manager._runtime, ownerRecord: '1', pageClass: 'edit' });
    assert.equal(staff.resource.getRecordTitle(members[1]), 'TURING');
    assert.deepEqual((await searchRelatedRecords(Staff as any, '1', '', { ...options, recordTitle: staff.getRelatableRecordTitleResolver() }))[0], ['m1', 'HOPPER']);
    // Without a title: the attribute (or the key), as before.
    class Plain extends RelationManager { static relationship = 'plain'; static adapterFor() { return membersAdapter; } static relatedAdapter() { return membersAdapter; } }
    const plain = Object.assign(new Plain() as any, { _ctx: manager._ctx, ownerRecord: '1' });
    assert.equal(plain.getRelatableRecordTitleResolver(), null);
    assert.equal(await plain.getOwnerRecord(), null, 'mounted on its own: no owner');
    // A related records page: the owner it loaded.
    class ManageMembers extends ManageRelatedRecords { static relationship = 'members'; static adapterFor() { return membersAdapter; } }
    class Clubs extends Resource { static slug = 'clubs'; static adapter = adapter; static relatedPages = { members: ManageMembers }; }
    Panel.make().id('owners-pages').resources([Clubs]);
    const related = await mount((Clubs.getPages() as any).members, panel, { record: '1' });
    assert.equal(await related.getOwnerRecord(), rows[1]);
    assert.equal(related.getOwnerResource(), Clubs);
});

test('InteractsWithRecord(Page): a custom resource page bound to a record', async () => {
    const policy = { view: (_user: User, record: any) => record.title !== 'Secret', update: () => false };
    class OrderReceipt extends InteractsWithRecord(Page) {
        static title = 'Receipt';
        static navigationIcon = 'o-receipt-percent';
        getTitle(): string { return `Receipt for ${this.getRecord().title}`; }
    }
    class Orders extends Resource {
        static slug = 'orders'; static adapter = adapter; static recordTitleAttribute = 'title'; static hasViewPage = true; static policy = policy;
        static relatedPages = { receipt: OrderReceipt };
        static recordSubNavigation = ['view', 'receipt'];
    }
    const panel = Panel.make().id('record-page').resources([Orders]);
    const Receipt = (Orders.getPages() as any).receipt;
    assert.equal(Receipt.slug, 'orders/{record}/receipt');
    assert.equal(Receipt.resource, Orders);
    assert.equal(Orders.getUrl('receipt', '1'), '/orders/1/receipt');
    const page = await mount(Receipt, panel, { record: '1' });
    assert.equal(page.getRecord(), rows[1]);
    assert.equal(page.getRecordTitle(), 'First');
    assert.equal(page.getTitle(), 'Receipt for First');
    assert.deepEqual(page.getBreadcrumbs(), [{ label: 'Records', url: '/orders' }, { label: 'First', url: '/orders/1' }, { label: 'Receipt for First', url: null }]);
    const tabs = page.getSubNavigation();
    assert.deepEqual(tabs.map((tab: any) => [tab.label, tab.url, tab.active]), [['View', '/orders/1', false], ['Receipt', '/orders/1/receipt', true]]);
    assert.equal(tabs[1].icon, 'o-receipt-percent');
    assert.deepEqual(page.getActionMountContext(), { recordKey: '1' });
    assert.ok(page.getPageClasses().includes('fi-resource-record-1'));
    // Unknown and forbidden records.
    await assert.rejects(mount(Receipt, panel, { record: '404' }), (error: unknown) => error instanceof WireError && error.status === 404);
    rows[9] = { id: 9, title: 'Secret' };
    await assert.rejects(mount(Receipt, panel, { record: '9' }), (error: unknown) => error instanceof WireError && error.status === 403);
    delete rows[9];
    // The record is locked against the browser.
    assert.ok(Receipt.locked.includes('recordKey'));
});

test('avatars: the user\'s own, the default provider with the display name, tenants', () => {
    const panel = Panel.make().id('avatars').auth({ attempt: async () => null, find: async () => null, getAvatarUrl: (user) => (user.id === 2 ? '/avatars/2.png' : null) });
    assert.match(panel.getUserAvatarUrl(ada), /^https:\/\/ui-avatars\.com\/api\/\?name=A\+L/);
    assert.equal(panel.getUserAvatarUrl({ id: 2, name: 'Bo', email: 'b@x.test' }), '/avatars/2.png');
    const seen: unknown[] = [];
    panel.defaultAvatarProvider((record, name, type) => { seen.push([name, type]); return `/initials/${encodeURIComponent(name)}.svg`; });
    assert.equal(panel.getUserAvatarUrl(ada), '/initials/Ada%20Lovelace.svg');
    assert.equal(panel.getNameForDefaultAvatar(ada), 'Ada Lovelace');
    panel.defaultAvatarProvider({ get: (_record, name) => `/gravatar/${name.length}` });
    assert.equal(panel.getUserAvatarUrl(ada), '/gravatar/12');
    panel.tenant({ getName: (tenant: any) => tenant.name, getTenants: async () => [], find: async () => null, canAccess: async () => true } as any);
    assert.equal(panel.getTenantAvatarUrl({ name: 'Acme' }), '/gravatar/4');
    assert.deepEqual(seen, [['Ada Lovelace', 'user']]);
});

test('globalSearchFieldSuffix() takes a function of the user agent; Platform.detect()', () => {
    assert.equal(Platform.detect('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), Platform.Windows);
    assert.equal(Platform.detect('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), Platform.Mac);
    assert.equal(Platform.detect('Mozilla/5.0 (X11; Linux x86_64)'), Platform.Linux);
    assert.equal(Platform.detect(''), Platform.Other);
    const panel = Panel.make().id('suffix').globalSearchFieldSuffix((userAgent) => {
        const platform = Platform.detect(userAgent);
        return platform === Platform.Mac ? '⌘K' : platform === Platform.Other ? null : 'CTRL+K';
    });
    assert.equal(panel.getGlobalSearchFieldSuffix('Macintosh'), '⌘K');
    assert.equal(panel.getGlobalSearchFieldSuffix('Windows'), 'CTRL+K');
    assert.equal(panel.getGlobalSearchFieldSuffix('curl/8'), null);
});

test('getUserScopedAuthIdentifier(): per panel, and the key of the multi-factor rate limiter', () => {
    const admin = Panel.make().id('admin');
    const app = Panel.make().id('app');
    assert.match(admin.getUserScopedAuthIdentifier(ada), /^admin:[\w-]{22}$/);
    assert.notEqual(admin.getUserScopedAuthIdentifier(ada), app.getUserScopedAuthIdentifier(ada));
    assert.equal(admin.getMultiFactorChallenge().getRateLimiterKey(ada), admin.getUserScopedAuthIdentifier(ada));
});
