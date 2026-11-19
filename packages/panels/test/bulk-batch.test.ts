import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextColumn, type Table } from '@navette-js/tables';
import { DeleteBulkAction, Panel, Resource, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

class Item extends Model { static tableName = 'items'; }
let db: Knex;
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };
class Items extends Resource {
    static slug = 'items';
    static adapter = new ObjectionAdapter(Item);
    static table(table: Table): Table { return table.columns([TextColumn.make('title')]).groupedBulkActions([DeleteBulkAction.make()]); }
}
const panel = Panel.make().id('bulk-batch').key('k').resources([Items]);
const open = async () => {
    const ListPage = Items.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: admin, mailbox: 'batch', req: { query: {} }, res: {} };
    await component.mount({});
    return component;
};
before(async () => { db = sqlite(':memory:'); await db.schema.createTable('items', (table) => { table.increments('id'); table.string('title'); }); });
after(() => db.destroy());

test('deleting a large selection runs one DELETE per chunk of keys, not one per record', async () => {
    await db('items').insert(Array.from({ length: 250 }, (_, index) => ({ title: `Item ${index}` })));
    const list = await open();
    list.selectedTableRecords = (await db('items')).map((row: any) => String(row.id));
    const statements: string[] = [];
    db.on('query', (query: { sql: string }) => statements.push(query.sql));
    const { pending } = await runInRequest('batch', async () => (list.getBulkActions()[0] as Action).call({ livewire: list, record: null, arguments: {}, data: {} }));
    db.removeAllListeners('query');
    assert.equal((await db('items')).length, 0);
    assert.equal(statements.filter((sql) => /^delete/i.test(sql)).length, 1);
    assert.equal(pending[0].status, 'success');
});

test('a small selection is still processed record by record', async () => {
    await db('items').insert(Array.from({ length: 5 }, (_, index) => ({ title: `Small ${index}` })));
    const list = await open();
    list.selectedTableRecords = (await db('items')).map((row: any) => String(row.id));
    const statements: string[] = [];
    db.on('query', (query: { sql: string }) => statements.push(query.sql));
    await runInRequest('batch', async () => (list.getBulkActions()[0] as Action).call({ livewire: list, record: null, arguments: {}, data: {} }));
    db.removeAllListeners('query');
    assert.equal(statements.filter((sql) => /^delete/i.test(sql)).length, 5);
});
