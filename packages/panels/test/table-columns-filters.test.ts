import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Filter, SelectColumn, SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { Panel, Resource, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

class Post extends Model { static tableName = 'posts'; }
let db: Knex;
const editor: User = { id: 1, name: 'E', email: 'e@x.test' };
let deselectWhenFiltered = true;

class Posts extends Resource {
    static slug = 'posts';
    static adapter = new ObjectionAdapter(Post);
    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('title'), SelectColumn.make('status').options({ draft: 'Draft', published: 'Published' }).native(false)])
            .filters([
                SelectFilter.make('status').options({ draft: 'Draft', published: 'Published' }),
                Filter.make('cheap').query((query: any) => query.where('price', '<', 50)).excludeWhenResolvingRecord(),
            ])
            .deselectAllRecordsWhenFiltered(deselectWhenFiltered)
            .recordActions([Action.make('touch').action(() => undefined)])
            .toolbarActions([Action.make('archive').accessSelectedRecords().successNotificationTitle('Archived').failureNotificationTitle((success, total) => `Archived ${success} of ${total}`).action(async ({ action }) => {
                for (const record of await action!.getSelectedRecords()) if (record.status === 'published') action!.reportBulkProcessingFailure('published', (count) => `${count} published post could not be archived.`);
            })]);
    }
}
const panel = Panel.make().id('columns-filters-test').key('k').resources([Posts]);
const page = async () => {
    const ListPage = Posts.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: editor, mailbox: 'cf', req: { query: {} }, res: {} };
    await component.mount({});
    return component;
};

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.string('status'); table.integer('price'); });
    await db('posts').insert([{ title: 'Cheap draft', status: 'draft', price: 10 }, { title: 'Dear draft', status: 'draft', price: 90 }, { title: 'Published', status: 'published', price: 20 }]);
});
after(() => db.destroy());

test('row actions resolve their record only when it matches the filters, except `excludeWhenResolvingRecord()` ones', async () => {
    const list = await page();
    list.tableFilters = { status: { value: 'draft' }, cheap: { isActive: true } };
    const resolve = (key: string) => (list as any).resolveActionRecord({ table: true, recordKey: key });
    assert.equal(((await resolve('1')) as any)?.title, 'Cheap draft');
    // Not cheap, but that filter is excluded when resolving a record.
    assert.equal(((await resolve('2')) as any)?.title, 'Dear draft');
    assert.equal(await resolve('3'), null, 'not a draft');
    await assert.rejects(list.mountAction('touch', {}, { table: true, recordKey: '3' }), /Record not found/);
});

test('callTableColumnMethod(): select options for the JavaScript select, without re-rendering', async () => {
    const list = await page();
    assert.deepEqual(await list.callTableColumnMethod('status', '1', 'getOptionsForJs'), [{ label: 'Draft', value: 'draft', isDisabled: false }, { label: 'Published', value: 'published', isDisabled: false }]);
    assert.equal(list._skipRender, true);
    assert.equal(await list.callTableColumnMethod('status', '1', 'validateFor', ['x']), null);
    assert.equal(await list.callTableColumnMethod('title', '1', 'getOptionsForJs'), null);
    assert.deepEqual(await list.updateTableColumnState('status', '1', 'deleted'), { error: 'The selected status is invalid.' });
});

test('`accessSelectedRecords()`: selected records restricted to the filters, failure notification with the reported messages', async () => {
    const list = await page();
    list.selectedTableRecords = ['1', '2', '3'];
    const action = list.getTable().getToolbarActions()[0] as Action;
    const all = await runInRequest('cf', () => action.call({ livewire: list, record: null, arguments: {}, data: {} }));
    assert.deepEqual([all.pending[0].title, all.pending[0].status, all.pending[0].body], ['Archived 2 of 3', 'warning', '1 published post could not be archived.']);
    // Filtered on drafts: the published record is no longer selected (the selection is cleared when filtering, by default).
    list.tableFilters = { status: { value: 'draft' }, cheap: { isActive: false } };
    assert.deepEqual(await list.getSelectedRecordKeys(), ['1', '2']);
    const drafts = await runInRequest('cf', () => action.call({ livewire: list, record: null, arguments: {}, data: {} }));
    assert.deepEqual([drafts.pending[0].title, drafts.pending[0].status], ['Archived', 'success']);
    assert.deepEqual((await list.getSelectedTableRecords(false)), ['1', '2']);
    assert.deepEqual((await list.useSelectedTableRecordsQuery((query: any) => query.select('title'))).map((row: any) => row.title), ['Cheap draft', 'Dear draft']);
    // Filtering clears the selection in the browser.
    list._effects = {};
    list.applyTableFilters();
    assert.ok(JSON.stringify(list._effects).includes('deselectAllTableRecords'));
});

test('`deselectAllRecordsWhenFiltered(false)`: the selection survives filtering and is not narrowed', async () => {
    deselectWhenFiltered = false;
    try {
        const list = await page();
        list.selectedTableRecords = ['1', '3'];
        list.tableFilters = { status: { value: 'draft' }, cheap: { isActive: false } };
        assert.deepEqual(await list.getSelectedRecordKeys(), ['1', '3']);
        list._effects = {};
        list.applyTableFilters();
        list.updatedTableSearch();
        assert.ok(!JSON.stringify(list._effects).includes('deselectAllTableRecords'));
        assert.equal(list.getTable().shouldDeselectAllRecordsWhenFiltered(), false);
    } finally { deselectWhenFiltered = true; }
});
