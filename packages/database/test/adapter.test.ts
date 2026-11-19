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

test('findMany(): one query, in the order of the keys, null for missing ones', async () => {
    const queries: string[] = [];
    db.on('query', (query: { sql: string }) => queries.push(query.sql));
    const [first, second] = (await db('people').orderBy('id').limit(2)).map((row: any) => row.id);
    queries.length = 0;
    const found = await adapter.findMany([String(second), '999999', String(first)]);
    db.removeAllListeners('query');
    assert.deepEqual(found.map((record) => record?.id ?? null), [second, null, first]);
    assert.equal(queries.length, 1);
    assert.deepEqual(await adapter.findMany([]), []);
});

test('paginate(): a known total skips the COUNT query', async () => {
    const queries: string[] = [];
    db.on('query', (query: { sql: string }) => queries.push(query.sql));
    const counted = await adapter.paginate({ page: 1, perPage: 5 });
    const withCount = queries.filter((sql) => /count\(/i.test(sql)).length;
    queries.length = 0;
    const skipped = await adapter.paginate({ page: 2, perPage: 5, knownTotal: counted.total });
    db.removeAllListeners('query');
    assert.ok(withCount >= 1);
    assert.equal(queries.filter((sql) => /count\(/i.test(sql)).length, 0);
    assert.equal(skipped.total, counted.total);
    assert.equal(skipped.records.length, 5);
});

test('listKeys(): `limit` reads only the first keys; exists() stays correct', async () => {
    const all = await adapter.listKeys({});
    const limited = await adapter.listKeys({ limit: 3 });
    assert.deepEqual(limited, all.slice(0, 3));
    assert.equal((await adapter.listKeys({ limit: 0 })).length, 0);
    assert.equal(await adapter.exists('email', 'p1@example.test'), true);
    assert.equal(await adapter.exists('email', 'nobody@example.test'), false);
});

test('delete(), restore() and forceDelete() refuse records hidden by `modify`, like update()', async () => {
    const [{ id: visible }, { id: hidden }] = await db('people').orderBy('id').limit(2);
    const scoped = new ObjectionAdapter(Person, { modify: (query) => { query.whereNot('people.id', hidden); } });
    assert.equal(await scoped.delete(hidden), false);
    assert.equal(await scoped.forceDelete(hidden), false);
    assert.ok(await db('people').where('id', hidden).first());
    assert.equal(await scoped.update(hidden, { name: 'Changed' }), null);
    assert.notEqual((await db('people').where('id', visible).first()).name, 'Changed');
});

test('`verified: true` skips the scope lookup for a record just read through the adapter', async () => {
    const [{ id }] = await db('people').orderBy('id').limit(1);
    const scoped = new ObjectionAdapter(Person, { modify: (query) => { query.whereNot('people.id', -1); } });
    const queries: string[] = [];
    db.on('query', (query: { sql: string }) => queries.push(query.sql));
    await scoped.forceDelete(id, { verified: true });
    db.removeAllListeners('query');
    assert.equal(queries.filter((sql) => /^select/i.test(sql)).length, 0);
    assert.equal(await db('people').where('id', id).first(), undefined);
});
