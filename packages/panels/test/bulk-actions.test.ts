import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextColumn, TrashedFilter, type Table } from '@navette-js/tables';
import { DeleteBulkAction, Panel, Resource, type Policy, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

class Post extends Model { static tableName = 'posts'; }
let db: Knex;
const editor: User = { id: 1, name: 'E', email: 'e@x.test' };

class Posts extends Resource {
    static slug = 'posts';
    static adapter = new ObjectionAdapter(Post);
    static policy: Policy<{ status: string }> = { delete: (_user, record) => record?.status !== 'locked' };
    static table(table: Table): Table {
        return table.columns([TextColumn.make('title')]).filters([TrashedFilter.make()])
            .checkIfRecordIsSelectableUsing((record: any) => record.status !== 'archived')
            .maxSelectableRecords(4)
            .groupedBulkActions([DeleteBulkAction.make().authorizeIndividualRecords('delete')]);
    }
}
const panel = Panel.make().id('bulk-test').key('k').resources([Posts]);
const page = async () => {
    const ListPage = Posts.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: editor, mailbox: 'bulk', req: { query: {} }, res: {} };
    await component.mount({});
    return component;
};
const titles = async () => (await db('posts').orderBy('id')).map((row: any) => row.title);

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.string('status'); });
});
after(() => db.destroy());

test('selected keys: unselectable records and keys beyond `maxSelectableRecords()` are dropped', async () => {
    await db('posts').delete();
    await db('posts').insert(['A', 'B', 'C', 'D', 'E', 'F'].map((title, index) => ({ title, status: index === 1 ? 'archived' : 'draft' })));
    const ids = (await db('posts').orderBy('id')).map((row: any) => String(row.id));
    const list = await page();
    list.selectedTableRecords = [...ids, '9999'];
    assert.deepEqual(await list.getSelectedRecordKeys(), [ids[0], ids[2], ids[3], ids[4]]);
    list.selectedTableRecords = [];
    list.isTrackingDeselectedTableRecords = true;
    list.deselectedTableRecords = [ids[0]];
    assert.deepEqual(await list.getSelectedRecordKeys(), [ids[2], ids[3], ids[4], ids[5]]);
});

test('`authorizeIndividualRecords()`: unauthorized records are skipped and reported in a warning notification', async () => {
    await db('posts').delete();
    await db('posts').insert([{ title: 'Keep', status: 'locked' }, { title: 'Gone 1', status: 'draft' }, { title: 'Gone 2', status: 'draft' }]);
    const ids = (await db('posts').orderBy('id')).map((row: any) => String(row.id));
    const list = await page();
    list.selectedTableRecords = ids;
    const action = list.getBulkActions()[0] as Action;
    const { pending } = await runInRequest('bulk', async () => action.call({ livewire: list, record: null, arguments: {}, data: {} }));
    assert.deepEqual(await titles(), ['Keep']);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].status, 'warning');
    assert.equal(pending[0].title, 'Deleted 2 of 3');
    assert.match(String(pending[0].body), /permission to delete 1/);
    assert.deepEqual(list.selectedTableRecords, [], 'selection cleared');
});

test('`processSelectedRecords()`: failures, success notification, chunks', async () => {
    await db('posts').delete();
    await db('posts').insert([{ title: 'X', status: 'draft' }, { title: 'Y', status: 'draft' }, { title: 'Z', status: 'draft' }]);
    const list = await page();
    list.selectedTableRecords = (await db('posts')).map((row: any) => String(row.id));
    const seen: string[] = [];
    const action = Action.make('touch').chunkSelectedRecords(2).successNotificationTitle('Done').failureNotificationTitle((success, total) => `${success}/${total}`).missingBulkProcessingFailureNotificationMessage((count) => `${count} failed`);
    const first = await runInRequest('bulk', () => list.processSelectedRecords(action, (record: any) => { seen.push(record.title); return record.title !== 'Y'; }));
    assert.deepEqual(first.result, { total: 3, success: 2, unauthorized: 0, failed: 1 });
    assert.deepEqual(seen, ['X', 'Y', 'Z']);
    assert.deepEqual([first.pending[0].title, first.pending[0].body, first.pending[0].status], ['2/3', '1 failed', 'warning']);
    const second = await runInRequest('bulk', () => list.processSelectedRecords(action, () => true));
    assert.deepEqual([second.pending[0].title, second.pending[0].status], ['Done', 'success']);
});

test('`DeleteBulkAction` is hidden when only deleted records are shown', async () => {
    const list = await page();
    const action = list.getBulkActions()[0] as Action;
    const ctx = { livewire: list, component: null, operation: null, record: null, get: () => undefined, state: undefined } as any;
    assert.equal(await action.isVisible(ctx), true);
    list.tableFilters = { trashed: { value: '0' } };
    assert.equal(await action.isVisible(ctx), false);
});
