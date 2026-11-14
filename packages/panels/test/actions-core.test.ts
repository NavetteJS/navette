import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Actions, Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { WireError, lockedProperties } from '@navette-js/wire';
import { Action } from '@navette-js/actions';
import { AuthorizationResponse, MemoryActionRateLimitStore, Page, Panel, Resource, readDefaultActionQuery, useActionRateLimitStore, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Post extends Model { static tableName = 'posts'; }
let db: Knex;
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };
const calls: string[] = [];

class Posts extends Resource {
    static slug = 'posts';
    static adapter = new ObjectionAdapter(Post);
    static policy = {
        // A denial with a message: shown by `authorizationTooltip()` / `authorizationNotification()`.
        update: (_user: User, post: any) => (post?.locked ? AuthorizationResponse.deny('This post is locked.') : true),
        delete: () => false,
    };
    static form(schema: any) { return schema.components([TextInput.make('title')]); }
    static table(table: Table): Table {
        return table.columns([TextColumn.make('title')]).recordActions([
            Action.make('publish').authorize('update').authorizationNotification().requiresConfirmation().action(({ record }: any) => { calls.push(`publish:${record.id}`); }),
            Action.make('archive').authorize('update').action(({ record }: any) => { calls.push(`archive:${record.id}`); }),
            Action.make('lock').authorize('update').authorizationTooltip().action(() => { calls.push('lock'); }),
            Action.make('remove').authorize('delete').requiresConfirmation().action(() => { calls.push('remove'); }),
            Action.make('touch').rateLimit(2).action(({ record }: any) => { calls.push(`touch:${record.id}`); }),
            Action.make('view').requiresConfirmation().action(() => { calls.push('view'); }),
        ]);
    }
}

let fail: (() => void) | null = null;
class Board extends Page {
    static slug = 'board';
    getHeaderActions() {
        return [
            Action.make('invite').schema([TextInput.make('email')]).action(({ arguments: args }: any) => { calls.push(`invite:${args.source}`); }),
            Action.make('wipe').action(() => { calls.push('wipe'); }),
            Action.make('secret').authorize(() => false).requiresConfirmation().action(() => { calls.push('secret'); }),
            Action.make('write').databaseTransaction().action(async ({ arguments: args }: any) => {
                await db('posts').insert({ title: `tx-${args.mode}`, locked: 0 });
                if (args.mode === 'throw') throw new Error('boom');
                if (args.mode === 'halt') Action.make('x').halt();
                if (args.mode === 'halt-rollback') Action.make('x').halt(true);
                fail?.();
            }),
            Action.make('first').schema([TextInput.make('foo').required()]).registerModalActions([Action.make('report').action(() => { calls.push('report'); })])
                .action(({ arguments: args, data }: any) => { calls.push(`first:${data.foo}:${args.flag ?? ''}`); })
                .extraModalFooterActions((parent) => [
                    parent.makeModalSubmitAction('again', { flag: 'again' }),
                    Action.make('peek').action(({ parentAction, mountedActions }: any) => { calls.push(`peek:${parentAction.getRawData().foo}:${mountedActions.length}:${parentAction.getName()}`); }),
                    Action.make('fill').action(({ parentAction }: any) => parentAction.fillData({ foo: 'filled', unknown: 'x' })),
                    Action.make('check').action(async ({ parentAction }: any) => { calls.push(`check:${(await parentAction.getValidatedData()).foo}`); }),
                    Action.make('second').requiresConfirmation().overlayParentActions().action(() => { calls.push('second'); }).extraModalFooterActions([
                        Action.make('third').requiresConfirmation().cancelParentActions('second').action(() => { calls.push('third'); }),
                        Action.make('all').cancelParentActions().action(() => { calls.push('all'); }),
                    ]),
                ]),
            Action.make('guarded').requiresConfirmation().hidden(({ arguments: args }: any) => args?.target === 'forbidden').action(({ arguments: args }: any) => { calls.push(`guarded:${args.target}`); }),
            Action.make('readonly').schema([TextInput.make('name')]).disabledSchema().fillForm(() => ({ name: 'Ada' })).action(({ data }: any) => { calls.push(`readonly:${JSON.stringify(data)}`); }),
        ];
    }
}

const panel = Panel.make().id('actions-core-test').key('k').resources([Posts]).pages([Board]).unsavedChangesAlerts();
const request = (url = '/') => ({ query: {}, originalUrl: url, url, ip: '10.0.0.1' });
const listPage = async (url = '/admin/posts') => {
    const ListPage = Posts.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: admin, mailbox: 'actions-core', req: request(url), res: {} };
    component._id = 'list';
    await component.mount({});
    return component;
};
const board = async (url = '/admin/board') => {
    const component: any = new Board();
    component._ctx = { panel, user: admin, mailbox: 'actions-core', req: request(url), res: {} };
    component._id = 'board';
    await component.mount({});
    return component;
};
const run = <T>(fn: () => Promise<T>) => runInRequest('actions-core', fn);
const scripts = (component: any) => Object.values((component._effects.scripts ?? {}) as Record<string, string>).join('\n');

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.boolean('locked'); });
    await db('posts').insert([{ id: 1, title: 'Open', locked: 0 }, { id: 2, title: 'Locked', locked: 1 }]);
});
after(() => db.destroy());

test("authorize('update'): the resource policy decides, with its message; forged mounts are refused", async () => {
    calls.length = 0;
    const list = await listPage();
    // Allowed record: the confirmation opens and the action runs.
    await list.mountAction('publish', {}, { table: true, recordKey: '1' });
    await run(() => list.callMountedAction());
    assert.deepEqual(calls, ['publish:1']);
    // `authorizationNotification()`: the click only sends the denial message, nothing is mounted or run.
    const { pending } = await run(() => list.mountAction('publish', {}, { table: true, recordKey: '2' }));
    assert.equal(list.mountedActions.length, 0);
    assert.deepEqual(pending.map((n: any) => [n.title, n.status, n.duration]), [['This post is locked.', 'danger', 'persistent']]);
    // Without it, the unauthorized action is hidden and refused.
    await assert.rejects(list.mountAction('archive', {}, { table: true, recordKey: '2' }), (error: any) => error instanceof WireError && error.status === 403);
    // `authorizationTooltip()`: disabled, refused too.
    await assert.rejects(list.mountAction('lock', {}, { table: true, recordKey: '2' }), (error: any) => error instanceof WireError && error.status === 403);
    await assert.rejects(list.mountAction('remove', {}, { table: true, recordKey: '1' }), (error: any) => error instanceof WireError && error.status === 403);
    assert.deepEqual(calls, ['publish:1']);
    // The record changes between mount and submit: the call is refused again on the server.
    await list.mountAction('publish', {}, { table: true, recordKey: '1' });
    list.mountedActions[0].context.recordKey = '2';
    calls.length = 0;
    await run(() => list.callMountedAction());
    assert.deepEqual(calls, []);
});

test('the panel hook may answer with a message too', async () => {
    const hooked = Panel.make().id('actions-core-hook').key('k').resources([Posts]).authorizeUsing(({ ability }) => (ability === 'update' ? AuthorizationResponse.deny('Read-only panel.') : undefined));
    const response = await hooked.inspect(admin, 'update', { resource: Posts, record: { id: 1 } });
    assert.equal(response.message(), 'Read-only panel.');
    assert.equal(await hooked.authorize(admin, 'update', { resource: Posts, record: { id: 1 } }), false);
});

test('URL-opened actions: arguments and context, mounted after load with the usual checks; forged links are refused', async () => {
    calls.length = 0;
    // Allowed action with a modal: opened, with its arguments.
    let page = await board('/admin/board?action=invite&actionArguments[source]=email&actionArguments[__proto__][x]=1');
    let html = await page.renderActionModals();
    assert.match(html, /<div wire:init="mountDefaultActions"><\/div>/);
    assert.deepEqual(page.defaultActionArguments, { source: 'email' });
    await page.mountDefaultActions();
    assert.deepEqual(page.mountedActions.map((m: any) => [m.name, m.arguments]), [['invite', { source: 'email' }]]);
    assert.equal(page.shouldMountDefaultActions(), false, 'opened once');
    // Closing it removes the parameters from the URL.
    await page.unmountAction(false);
    assert.equal(page.defaultAction, null);
    assert.match(scripts(page), /searchParams\.delete\(key\)/);

    // A hidden (unauthorized) action from a forged link: nothing opens.
    page = await board('/admin/board?action=secret');
    await page.renderActionModals();
    await page.mountDefaultActions();
    assert.equal(page.mountedActions.length, 0);
    // An action without a modal is never run from a link.
    page = await board('/admin/board?action=wipe');
    await page.renderActionModals();
    await page.mountDefaultActions();
    assert.deepEqual(calls, []);
    // An unknown action, or a context of the wrong shape, is ignored.
    page = await board('/admin/board?action=nope');
    await page.renderActionModals();
    await page.mountDefaultActions();
    assert.equal(page.mountedActions.length, 0);
    // A link for another component is not consumed by the page.
    page = await board('/admin/board?action=invite&actionComponent=departments');
    assert.doesNotMatch(await page.renderActionModals(), /wire:init/);
    // The browser cannot set the default action afterwards.
    assert.ok(lockedProperties(page).has('defaultAction') && lockedProperties(page).has('hasDefaultActionMounted'));
    // Without the URL, nothing to open.
    page = await board('/admin/board');
    assert.doesNotMatch(await page.renderActionModals(), /wire:init/);
    // The page's own `defaultAction` uses the same mechanism.
    page = await board('/admin/board');
    page.defaultAction = 'invite';
    page.defaultActionArguments = { source: 'page' };
    assert.match(await page.renderActionModals(), /wire:init/);
    await page.mountDefaultActions();
    assert.deepEqual(page.mountedActions.map((m: any) => m.name), ['invite']);
});

test('URL-opened table actions: the record is resolved by the table, unauthorized records are refused', async () => {
    calls.length = 0;
    let list = await listPage('/admin/posts?tableAction=view&tableActionRecord=1');
    await list.renderActionModals();
    await list.mountDefaultActions();
    assert.deepEqual(list.mountedActions.map((m: any) => [m.name, m.context.recordKey]), [['view', '1']]);
    // Closing a table action keeps the table parameters.
    await list.unmountAction(false);
    assert.equal(list.defaultTableAction, 'view');
    // Forged: a record the user may not act on, a missing record, an action of another location.
    for (const url of ['/admin/posts?tableAction=remove&tableActionRecord=1', '/admin/posts?tableAction=view&tableActionRecord=999', '/admin/posts?tableAction=invite&tableActionRecord=1', '/admin/posts?tableAction=touch&tableActionRecord=1']) {
        list = await listPage(url);
        await list.renderActionModals();
        await list.mountDefaultActions();
        assert.equal(list.mountedActions.length, 0, url);
    }
    assert.deepEqual(calls, [], 'the modal-less "touch" action did not run');
});

test('readDefaultActionQuery(): bounded, nested bracket parameters; unsafe keys dropped', () => {
    const query = readDefaultActionQuery('/x?action=a&actionArguments[a][b]=1&actionArguments[constructor]=x&actionContext[recordKey]=5&actionArguments[x]y=bad#h');
    assert.deepEqual(query, { action: 'a', actionArguments: { a: { b: '1' } }, actionContext: { recordKey: '5' } });
    assert.deepEqual(readDefaultActionQuery('/x', { actionArguments: { a: '1', __proto__: { polluted: true } } }), { actionArguments: { a: '1' } });
    assert.equal(({} as any).polluted, undefined);
});

test('rateLimit(): enforced on the server, per record, with the throttled notification', async () => {
    useActionRateLimitStore(new MemoryActionRateLimitStore());
    calls.length = 0;
    const list = await listPage();
    for (let i = 0; i < 3; i++) await run(() => list.mountAction('touch', {}, { table: true, recordKey: '1' }));
    const { pending } = await run(() => list.mountAction('touch', {}, { table: true, recordKey: '1' }));
    assert.deepEqual(calls, ['touch:1', 'touch:1']);
    assert.equal(pending[0].title, 'Too many attempts');
    assert.match(String(pending[0].body), /Please try again in \d+ seconds\./);
    // Another record has its own limit.
    await run(() => list.mountAction('touch', {}, { table: true, recordKey: '2' }));
    assert.deepEqual(calls, ['touch:1', 'touch:1', 'touch:2']);
    // The window passes.
    const store = new MemoryActionRateLimitStore();
    assert.equal(store.attempt('k', 1, 60, 0), 0);
    assert.ok(store.attempt('k', 1, 60, 1000) > 0);
    assert.equal(store.attempt('k', 1, 60, 61_000), 0);
});

test('databaseTransaction(): rolled back when the action throws or halts with a rollback, committed otherwise', async () => {
    const page = await board();
    const titles = async () => (await db('posts').where('title', 'like', 'tx-%')).map((row: any) => row.title).sort();
    await page.mountAction('write', { mode: 'ok' });
    await assert.rejects(page.mountAction('write', { mode: 'throw' }), /boom/);
    await page.mountAction('write', { mode: 'halt' });
    await page.mountAction('write', { mode: 'halt-rollback' });
    assert.deepEqual(await titles(), ['tx-halt', 'tx-ok']);
});

test('parent actions: raw, validated and filled data; makeModalSubmitAction() arguments; registered modal actions', async () => {
    calls.length = 0;
    const page = await board();
    await page.mountAction('first');
    page.mountedActions[0].data.foo = 'typed';
    await page.mountAction('peek', {}, { parentAction: 0 });
    assert.deepEqual(calls, ['peek:typed:1:first']);
    await page.mountAction('fill', {}, { parentAction: 0 });
    assert.equal(page.mountedActions[0].data.foo, 'filled');
    assert.equal(page.mountedActions[0].data.unknown, undefined, 'only fields of the form are filled');
    await page.mountAction('check', {}, { parentAction: 0 });
    assert.deepEqual(calls.slice(-1), ['check:filled']);
    // Invalid parent data: the errors show in the parent's modal, the child stops.
    page.mountedActions[0].data.foo = null;
    await page.mountAction('check', {}, { parentAction: 0 });
    assert.ok(page._errors['mountedActions.0.data.foo']);
    assert.equal(calls.length, 2);
    // A registered modal action is mounted on top of its parent.
    await page.mountAction('report', {}, { parentAction: 0 });
    assert.deepEqual(calls.slice(-1), ['report']);
    // Submitting with the arguments of `makeModalSubmitAction()`.
    page.mountedActions[0].data.foo = 'sent';
    page._errors = {};
    await run(() => page.callMountedAction({ flag: 'again' }));
    assert.deepEqual(calls.slice(-1), ['first:sent:again']);
    assert.equal(page.mountedActions.length, 0);
});

test('cancelParentActions(), unmountAction(true | name), overlayParentActions() and the unsaved changes alert', async () => {
    calls.length = 0;
    const page = await board();
    await page.mountAction('first');
    assert.equal(page.mountedActions[0].hasUnsavedChangesAlert, true);
    assert.match(scripts(page), /setUpNavetteUnsavedActionChangesAlert/);
    await page.mountAction('second', {}, { parentAction: 0 });
    const sync = (page._effects.dispatches as any[]).filter((d) => d.name === 'sync-action-modals').pop();
    assert.equal(sync.params.shouldOverlayParentActions, true);
    await page.mountAction('third', {}, { parentAction: 1 });
    assert.deepEqual(page.mountedActions.map((m: any) => m.name), ['first', 'second', 'third']);
    await page.callMountedAction();
    assert.deepEqual(page.mountedActions.map((m: any) => m.name), ['first'], '"third" cancelled its parents up to "second"');
    await page.mountAction('second', {}, { parentAction: 0 });
    await page.mountAction('all', {}, { parentAction: 1 });
    assert.equal(page.mountedActions.length, 0, '"all" (no modal) cancelled every parent');
    await page.mountAction('first');
    await page.mountAction('second', {}, { parentAction: 0 });
    await page.unmountAction('first');
    assert.equal(page.mountedActions.length, 0);
    await page.mountAction('first');
    await page.mountAction('second', {}, { parentAction: 0 });
    await page.unmountAction(true);
    assert.equal(page.mountedActions.length, 0);
    // A read-only modal: fields disabled and not submitted, no unsaved changes alert.
    await page.mountAction('readonly');
    assert.equal(page.mountedActions[0].hasUnsavedChangesAlert, false);
    assert.match(await page.renderActionModals(), /disabled/);
    await page.callMountedAction();
    assert.deepEqual(calls.slice(-1), ['readonly:{}']);
});

test('submit arguments are checked like mount arguments', async () => {
    calls.length = 0;
    const page = await board();
    await page.mountAction('guarded', { target: 'ok' });
    await assert.rejects(page.callMountedAction({ target: 'forbidden' }), (error: any) => error instanceof WireError && error.status === 403);
    await page.callMountedAction({ extra: 1 });
    assert.deepEqual(calls, ['guarded:ok']);
});

test('Actions schema component: verticalAlignment()', async () => {
    const host: any = { id: 'h', getActionMountContext: () => ({}) };
    const html = await Schema.make(host).components([Actions.make([Action.make('star').action(() => {})]).verticalAlignment('end')]).toHtml();
    assert.match(html, /class="nv-sc-actions nv-vertical-align-end"/);
});
