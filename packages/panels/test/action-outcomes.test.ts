import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { TextColumn, type Table } from '@navette-js/tables';
import { CreateAction, DeleteAction, Panel, ReplicateAction, Resource, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Note extends Model { static tableName = 'notes'; }
let db: Knex;
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };

const create = CreateAction.make()
    .preserveFormDataWhenCreatingAnother(['category'])
    .before(({ data, action }) => { if (data.title === 'stop') action!.halt(); if (data.title === 'quit') action!.cancel(); })
    .successNotification((notification) => notification.title('Note saved').body('All good'))
    .successRedirectUrl(({ record }: any) => `/notes/${record.id}`);
const replicate = ReplicateAction.make()
    .beforeReplicaSaved(({ replica }) => { replica.title = `${replica.title} (copy)`; })
    .successNotification(() => null);
const remove = DeleteAction.make().successNotificationTitle('Gone').successRedirectUrl('javascript:alert(1)');

class Notes extends Resource {
    static slug = 'notes';
    static adapter = new ObjectionAdapter(Note);
    static form(schema: any) { return schema.components([TextInput.make('title'), TextInput.make('category')]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('title')]).headerActions([create]).recordActions([replicate, remove]); }
}
const panel = Panel.make().id('outcomes-test').key('k').resources([Notes]);
const page = async () => {
    const ListPage = Notes.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: admin, mailbox: 'outcomes', req: { query: {} }, res: {} };
    component._id = 'list';
    await component.mount({});
    return component;
};
const run = (fn: () => Promise<unknown>) => runInRequest('outcomes', fn);

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('notes', (table) => { table.increments('id'); table.string('title'); table.string('category'); });
});
after(() => db.destroy());

test('`halt()` keeps the modal open, `cancel()` closes it; nothing is created', async () => {
    const list = await page();
    await list.mountAction('create', {}, { table: true });
    list.mountedActions[0].data = { title: 'stop', category: 'x' };
    await run(() => list.callMountedAction());
    assert.equal(list.mountedActions.length, 1);
    list.mountedActions[0].data = { title: 'quit', category: 'x' };
    await run(() => list.callMountedAction());
    assert.equal(list.mountedActions.length, 0);
    assert.equal((await db('notes')).length, 0);
});

test('custom success notification and redirect; "create another" keeps the preserved fields', async () => {
    const list = await page();
    await list.mountAction('create', {}, { table: true });
    list.mountedActions[0].data = { title: 'First', category: 'work' };
    const { pending } = await run(() => list.callMountedAction({ another: true }));
    assert.deepEqual([pending[0].title, pending[0].body], ['Note saved', 'All good']);
    assert.deepEqual(list.mountedActions[0].data, { title: null, category: 'work' });
    const note = await db('notes').first();
    assert.match(JSON.stringify(list._effects ?? {}), new RegExp(`/notes/${note.id}`));
});

test('replica hooks, silenced notification, unsafe redirect ignored', async () => {
    await db('notes').delete();
    const [id] = await db('notes').insert({ title: 'Original', category: 'a' });
    const list = await page();
    const { pending } = await run(async () => { await list.mountAction('replicate', {}, { table: true, recordKey: String(id) }); await list.callMountedAction(); });
    assert.deepEqual((await db('notes').orderBy('id')).map((row: any) => row.title), ['Original', 'Original (copy)']);
    assert.equal(pending.length, 0, 'successNotification(() => null) sends nothing');
    const deleted = await run(async () => { await list.mountAction('delete', {}, { table: true, recordKey: String(id) }); await list.callMountedAction(); });
    assert.equal(deleted.pending[0].title, 'Gone');
    assert.doesNotMatch(JSON.stringify(list._effects ?? {}), /javascript/);
});

test('modal options, `modalHidden()`, `mountUsing()` and a footer action working on the parent data', async () => {
    const { Action } = await import('@navette-js/actions');
    const seen: unknown[] = [];
    const fill = Action.make('fill').label('Use defaults').action(({ parentData }) => { parentData!.title = 'Filled by the footer'; });
    const compose = Action.make('compose')
        .schema([TextInput.make('title')])
        .closeModalByClickingAway(false).closeModalByEscaping(false).modalCloseButton(false).stickyModalFooter().modalFooterActionsAlignment('end')
        .mountUsing(({ data }) => { data.title = 'Draft'; })
        .extraModalFooterActions([fill])
        .action(({ data }) => { seen.push(data.title); });
    const quick = Action.make('quick').requiresConfirmation().modalHidden(true).action(() => { seen.push('quick'); });
    class Composer extends Resource {
        static slug = 'composer';
        static adapter = new ObjectionAdapter(Note);
        static table(table: Table): Table { return table.columns([TextColumn.make('title')]).headerActions([compose, quick]); }
    }
    Panel.make().id('modal-options-test').key('k').resources([Composer]);
    const ListPage = Composer.getPages().index as any;
    const list = new ListPage();
    list._ctx = { panel: Composer.panel, user: admin, mailbox: 'modal', req: { query: {} }, res: {} };
    list._id = 'composer';
    await list.mount({});
    await run(() => list.mountAction('quick', {}, { table: true }));
    assert.deepEqual(seen, ['quick'], 'modalHidden: run at once');
    await run(() => list.mountAction('compose', {}, { table: true }));
    assert.equal(list.mountedActions[0].data.title, 'Draft', 'mountUsing');
    const html = await list.renderActionModals();
    assert.doesNotMatch(html, /x-on:click\.self/);
    assert.doesNotMatch(html, /keydown\.window\.escape/);
    assert.doesNotMatch(html, /fi-modal-close-btn/);
    assert.match(html, /fi-modal-has-sticky-footer/);
    assert.match(html, /fi-modal-footer fi-align-end/);
    assert.ok(html.includes(`wire:click="mountAction('fill', {}, JSON.parse(`) && html.includes('parentAction'), 'the footer action mounts on top of its parent');
    await run(() => list.mountAction('fill', {}, { parentAction: 0 }));
    assert.equal(list.mountedActions[0].data.title, 'Filled by the footer');
    await assert.rejects(() => list.mountAction('fill', {}, { parentAction: 5 }), /Action not found/);
    await run(() => list.callMountedAction());
    assert.deepEqual(seen, ['quick', 'Filled by the footer']);
});

test('modal wizard: `steps()` renders a wizard without footer, the last step submits', async () => {
    const { Action } = await import('@navette-js/actions');
    const { Step } = await import('@navette-js/forms');
    const received: unknown[] = [];
    const onboard = Action.make('onboard').modalSubmitActionLabel('Finish')
        .steps([Step.make('Account').schema([TextInput.make('email').required()]), Step.make('Profile').schema([TextInput.make('name')])])
        .action(({ data }) => { received.push(data); });
    class Wizardly extends Resource {
        static slug = 'wizardly';
        static adapter = new ObjectionAdapter(Note);
        static table(table: Table): Table { return table.columns([TextColumn.make('title')]).headerActions([onboard]); }
    }
    Panel.make().id('wizard-test').key('k').resources([Wizardly]);
    const ListPage = Wizardly.getPages().index as any;
    const list = new ListPage();
    list._ctx = { panel: Wizardly.panel, user: admin, mailbox: 'wizard', req: { query: {} }, res: {} };
    list._id = 'wizardly';
    await list.mount({});
    await run(() => list.mountAction('onboard', {}, { table: true }));
    const html = await list.renderActionModals();
    assert.match(html, /fi-sc-wizard/);
    assert.doesNotMatch(html, /fi-modal-footer/);
    assert.match(html, /Finish/);
    await run(() => list.callMountedAction());
    assert.deepEqual(received, [], 'a required field of a step blocks the submission');
    list.mountedActions[0].data = { email: 'a@b.test', name: 'Ada' };
    await run(() => list.callMountedAction());
    assert.deepEqual(received, [{ email: 'a@b.test', name: 'Ada' }]);
});

test('notification actions: links with safe URLs, buttons that dispatch an event and close the notification', async () => {
    const { Notification, renderNotification } = await import('../src/notifications.ts');
    const html = renderNotification(Notification.make().title('Deleted').actions([
        { label: 'Undo', dispatch: { event: 'undoDelete', data: { id: 5 } }, close: true, button: true },
        { label: 'View', url: '/posts/5' },
        { label: 'Evil', url: 'javascript:alert(1)' },
    ]).getData());
    assert.match(html, /<button type="button" x-on:click="Livewire\.dispatch\(&#039;undoDelete&#039;, [^"]+\); close\(\)" class="fi-ac-btn-action fi-btn fi-size-sm">Undo<\/button>/);
    assert.match(html, /<a href="\/posts\/5"/);
    assert.doesNotMatch(html, /javascript:|Evil/);
    assert.throws(() => Notification.make().actions([{ label: 'x', dispatch: { event: 'a" onclick="b' } }]), /Invalid notification event name/);
});
