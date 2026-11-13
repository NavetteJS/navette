import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '../src/index.ts';

class Person extends Model {
    static tableName = 'people';
    id!: number;
    name!: string;
    email!: string;
}
let db: Knex;
const adapter = new ObjectionAdapter(Person);

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('people', (t) => { t.increments('id'); t.string('name'); t.string('email'); });
    await db('people').insert(Array.from({ length: 23 }, (_, i) => ({ name: `Person ${String(i + 1).padStart(2, '0')}`, email: `p${i + 1}@example.test` })));
    await db('people').insert({ name: 'Zoé 100%_Spécial', email: 'ZOE@Example.TEST' });
});
after(() => db.destroy());

test('pagination: total, bounds, last page', async () => {
    const p = await adapter.paginate({ page: 2, perPage: 10, sort: { column: 'name', direction: 'asc' } });
    assert.equal(p.total, 24);
    assert.equal(p.lastPage, 3);
    assert.deepEqual([p.from, p.to], [11, 20]);
    assert.equal(p.records[0].name, 'Person 11');
    assert.equal((await adapter.paginate({ page: 99, perPage: 10 })).page, 3);
});

test('descending sort', async () => {
    const p = await adapter.paginate({ page: 1, perPage: 2, sort: { column: 'name', direction: 'desc' } });
    assert.deepEqual(p.records.map((r) => r.name), ['Zoé 100%_Spécial', 'Person 23']);
});

test('search: case-insensitive, each word in at least one column, wildcards escaped', async () => {
    const cols = ['name', 'email'];
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: 'zoe@example', searchColumns: cols })).total, 1);
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: 'person p7@', searchColumns: cols })).total, 1);
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: '100%_', searchColumns: cols })).total, 1);
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: '%', searchColumns: cols })).total, 1);
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: 'introuvable', searchColumns: cols })).total, 0);
    assert.deepEqual((await adapter.paginate({ page: 1, perPage: 50, search: 'introuvable', searchColumns: cols })).from, null);
});

test('read and write', async () => {
    const created = await adapter.create({ name: 'New', email: 'n@example.test' });
    assert.equal((await adapter.find(adapter.getKey(created)))!.name, 'New');
    assert.equal((await adapter.update(created.id, { name: 'Renamed' }))!.name, 'Renamed');
    assert.equal(await adapter.delete(created.id), true);
    assert.equal(await adapter.find(created.id), null);
    assert.equal(await adapter.count(), 24);
});

test('scope: a forged selection can only target records within the adapter scope', async () => {
    const scoped = new ObjectionAdapter(Person, { modify: (q) => { q.where('people.id', '<=', 5); } });
    assert.deepEqual(await scoped.keysInScope(['3', '9', 'x']), ['3']);
    assert.equal(await scoped.deleteMany([3, 9]), 1);
    assert.equal(await adapter.find(3), null);
    assert.notEqual(await adapter.find(9), null);
});

test('sum: computed over the filtered query, including computed columns and search', async () => {
    const aliased = new ObjectionAdapter(Person, { modify: (q) => { q.select('people.*', db.raw('upper(name) as shout')); } });
    const total = await aliased.sum({ search: 'PERSON 1', searchColumns: ['shout'] }, ['id']);
    const expected = (await db('people').whereRaw("upper(name) like '%PERSON%' and name like '%1%'").sum({ s: 'id' }).first())!.s;
    assert.equal(total.id, Number(expected));
    assert.ok(total.id > 0);
});

test('search: splitSearchTerms(false) matches the term as a whole', async () => {
    const cols = ['name', 'email'];
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: 'person p7@', searchColumns: cols, splitSearchTerms: false })).total, 0);
    assert.equal((await adapter.paginate({ page: 1, perPage: 50, search: 'p7@', searchColumns: cols, splitSearchTerms: false })).total, 1);
});
