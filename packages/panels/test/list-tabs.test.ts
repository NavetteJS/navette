import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { BulkActionGroup, TextColumn, type Table } from '@navette-js/tables';
import { DeleteBulkAction, Notification, Panel, Resource, Tab, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel } from '../src/testing.ts';

class Member extends Model { static tableName = 'members'; declare id: number; declare name: string; declare active: number; }
let db: Knex;

/** An action that deactivates the record, then a second step (`confirm`) that needs the record again. */
const deactivate = () => Action.make('deactivate')
    .action(async ({ record }) => { await db('members').where('id', (record as Member).id).update({ active: 0 }); Notification.make().title('Deactivated').send(); });

class MemberResource extends Resource {
    static slug = 'members';
    static modelLabel = 'member';
    static adapter = new ObjectionAdapter(Member);
    static tabs(): Record<string, Tab> {
        return {
            '': Tab.make('All').extraAttributes({ 'data-cy': 'all-tab', class: 'is-default' }),
            active: Tab.make('Active').query((query) => { query.where('active', 1); }),
            current: Tab.make('Current').query((query) => { query.where('active', 1); }).excludeQueryWhenResolvingRecord(),
        };
    }
    static table(table: Table<Member>): Table<Member> {
        return table
            .columns([TextColumn.make<Member>('name')])
            .recordActions([deactivate(), Action.make('rename').action(async ({ record }) => { await db('members').where('id', (record as Member).id).update({ name: 'Renamed' }); })])
            .toolbarActions([
                BulkActionGroup.make([DeleteBulkAction.make()]),
                BulkActionGroup.make([Action.make('archive').label('Archive').action(() => { Notification.make().title('Archived').send(); })]).label('Status').icon('o-flag'),
            ]);
    }
}

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('list-tabs').key('list-tabs-key').auth({ find: async () => user } as any).resources([MemberResource]);
const pages = MemberResource.getPages() as Record<string, any>;

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('members', (table) => { table.increments('id'); table.string('name'); table.boolean('active'); });
    setCurrentPanel(panel);
    actingAs(user);
});
after(() => db.destroy());
beforeEach(async () => {
    await db('members').delete();
    await db('members').insert([{ id: 1, name: 'Alice', active: 1 }, { id: 2, name: 'Bob', active: 0 }]);
});

test('extra attributes are rendered on the tab button, its class joins the tab classes', async () => {
    await livewire(pages.index)
        .assertSeeHtml('data-cy="all-tab"')
        .assertSeeHtml('class="fi-tabs-item fi-active is-default"')
        .assertSeeHtml('<span class="fi-tabs-item-label">Active</span>');
});

test('a record that no longer matches the active tab cannot be acted upon, unless the tab excludes its query', async () => {
    // Active tab: the record is resolved through the tab's query.
    await livewire(pages.index).set('activeTab', 'active').callTableAction('deactivate', 1).assertNotified('Deactivated');
    assert.equal((await db('members').where('id', 1).first()).active, 0);
    // Alice is no longer active: on this tab, her row actions do not find her any more.
    await livewire(pages.index).set('activeTab', 'active').call('mountAction', 'rename', {}, { table: true, recordKey: '1' }).assertNotFound();
    assert.equal((await db('members').where('id', 1).first()).name, 'Alice');
    // `excludeQueryWhenResolvingRecord()`: the tab still lists active records, but resolves any record of the resource.
    await livewire(pages.index).set('activeTab', 'current').callTableAction('rename', 1);
    assert.equal((await db('members').where('id', 1).first()).name, 'Renamed');
    // Without a tab query, nothing changes.
    await livewire(pages.index).callTableAction('rename', 2);
    assert.equal((await db('members').where('id', 2).first()).name, 'Renamed');
});

test('each BulkActionGroup is its own menu, and its actions can be called', async () => {
    await livewire(pages.index)
        .assertSeeHtml('<button title="Bulk actions" type="button"')
        .assertSeeHtml('<button title="Status" type="button"')
        .assertTableBulkActionExists('delete')
        .assertTableBulkActionExists('archive')
        .callTableBulkAction('archive', [1, 2])
        .assertNotified('Archived');
});
