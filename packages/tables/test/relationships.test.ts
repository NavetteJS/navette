import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type DataAdapter, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { Group, IconColumn, Sum, Table, TextColumn, TextInputColumn, getTableQuery, getTableRecords, renderTable, updateTableColumnState, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

class Country extends Model { static tableName = 'countries'; }
class Author extends Model {
    static tableName = 'authors';
    static get relationMappings() { return { country: { relation: Model.BelongsToOneRelation, modelClass: Country, join: { from: 'authors.country_id', to: 'countries.id' } } }; }
}
class Comment extends Model { static tableName = 'comments'; }
class Tag extends Model { static tableName = 'tags'; }
class Post extends Model {
    static tableName = 'posts';
    static get jsonAttributes() { return ['meta']; }
    static get relationMappings() {
        return {
            author: { relation: Model.BelongsToOneRelation, modelClass: Author, join: { from: 'posts.author_id', to: 'authors.id' } },
            comments: { relation: Model.HasManyRelation, modelClass: Comment, join: { from: 'posts.id', to: 'comments.post_id' } },
            tags: { relation: Model.ManyToManyRelation, modelClass: Tag, join: { from: 'posts.id', through: { from: 'post_tag.post_id', to: 'post_tag.tag_id' }, to: 'tags.id' } },
        };
    }
}
let db: Knex;
const adapter = new ObjectionAdapter(Post);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'R', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, tableGrouping: null, ...over });
const clean = (html: string) => html.replace(/\s+/g, ' ');
const table = () => new Table().columns([
    TextColumn.make('title'),
    TextColumn.make('author.name').sortable().searchable({ isIndividual: true }),
    TextColumn.make('author.country.name').label('Country').sortable(),
    TextColumn.make('tags.name').badge().distinctList().searchable(),
    TextColumn.make('comments_count').counts('comments').sortable().summarize(Sum.make()),
    IconColumn.make('comments_exists').exists('comments').boolean(),
    TextColumn.make('comments_avg_rating').avg('comments', 'rating'),
    TextColumn.make('comments_max_rating').max('comments', 'rating'),
    TextColumn.make('good_comments').counts({ 'comments as good_comments': (query) => query.where('rating', '>=', 4) }),
]);
const titles = async (tableHost: TableHost) => (await getTableRecords(table(), tableHost, adapter)).records.map((r: any) => r.title);

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('countries', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('name'); t.integer('country_id'); });
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.integer('author_id'); t.text('meta'); });
    await db.schema.createTable('comments', (t) => { t.increments('id'); t.string('body'); t.integer('post_id'); t.integer('rating'); });
    await db.schema.createTable('tags', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('post_tag', (t) => { t.integer('post_id'); t.integer('tag_id'); });
    await db('countries').insert([{ name: 'France' }, { name: 'Belgium' }]);
    await db('authors').insert([{ name: 'Zed', country_id: 1 }, { name: 'Amy', country_id: 2 }]);
    await db('posts').insert([{ title: 'First', author_id: 1, meta: JSON.stringify({ lang: 'en' }) }, { title: 'Second', author_id: 2, meta: JSON.stringify({ lang: 'fr' }) }, { title: 'Third', author_id: null, meta: null }]);
    await db('comments').insert([{ body: 'Nice', post_id: 1, rating: 4 }, { body: 'Great', post_id: 1, rating: 5 }, { body: 'Meh', post_id: 2, rating: 2 }]);
    await db('tags').insert([{ name: 'news' }, { name: 'tech' }]);
    await db('post_tag').insert([{ post_id: 1, tag_id: 1 }, { post_id: 1, tag_id: 2 }, { post_id: 2, tag_id: 2 }]);
});
after(() => db.destroy());

test('the list query eager-loads the relationships of dot-notation columns and selects the relationship aggregates', () => {
    const query = getTableQuery(table(), host());
    assert.deepEqual(query.with, ['author', 'author.country', 'tags']);
    assert.deepEqual(query.aggregates!.map((a) => a.alias), ['comments_count', 'comments_exists', 'comments_avg_rating', 'comments_max_rating', 'good_comments']);
    assert.deepEqual(query.searchColumns, ['author.name', 'tags.name']);
});

test('cells: relationship values, lists of has-many values, and aggregates', async () => {
    const html = clean(await renderTable(table(), host({ tableSort: 'title:asc' }), adapter));
    assert.ok(html.includes('Zed') && html.includes('France') && html.includes('Belgium'));
    assert.ok(html.includes('news') && html.includes('tech'));
    const records = (await getTableRecords(table(), host({ tableSort: 'title:asc' }), adapter)).records as any[];
    assert.deepEqual(records.map((r) => [r.title, r.comments_count, r.comments_exists, r.good_comments]), [['First', 2, true, 2], ['Second', 1, true, 0], ['Third', 0, false, 0]]);
    const tags = table().getColumn('tags.name')!;
    assert.deepEqual(await tags.getState(records[0]), ['news', 'tech']);
    assert.equal(await tags.getState(records[2]), null);
    assert.equal(await table().getColumn('author.country.name')!.getState(records[1]), 'Belgium');
    assert.equal(Number(await table().getColumn('comments_avg_rating')!.getState(records[0])), 4.5);
    // The summary of an aggregate column sums it over every record of the query.
    assert.ok(html.includes('>3<') || /nv-ta-text-item[^>]*>\s*3\s*</.test(html));
    // Default label of a relationship column: the relationship's attribute's owner.
    assert.equal(table().getColumn('author.name')!.getLabel(), 'Author');
});

test('sorting and searching through relationships from the browser state', async () => {
    assert.deepEqual(await titles(host({ tableSort: 'author.name:asc' })), ['Third', 'Second', 'First']);
    assert.deepEqual(await titles(host({ tableSort: 'author.country.name:desc' })), ['First', 'Second', 'Third']);
    assert.deepEqual(await titles(host({ tableSort: 'comments_count:desc' })), ['First', 'Second', 'Third']);
    assert.deepEqual(await titles(host({ tableSearch: 'amy' })), ['Second']);
    assert.deepEqual(await titles(host({ tableSearch: 'news' })), ['First']);
    assert.deepEqual(await titles(host({ tableColumnSearches: { 'author.name': 'ze' } })), ['First']);
    // The browser binds `tableColumnSearches.author.name`: the state arrives nested; only text is accepted.
    assert.deepEqual(await titles(host({ tableColumnSearches: { author: { name: 'amy' } } as any })), ['Second']);
    assert.deepEqual(await titles(host({ tableColumnSearches: { author: { name: { toString: 'x' } } } as any })), ['First', 'Second', 'Third']);
});

test('SQL injection attempts through the browser state of relationship columns', async () => {
    // Sorting by an undeclared or forged column is ignored (default order); search terms are bound values.
    assert.deepEqual(await titles(host({ tableSort: 'author.name) desc; drop table posts; --:asc' })), ['First', 'Second', 'Third']);
    assert.deepEqual(await titles(host({ tableSort: 'author.password:asc' })), ['First', 'Second', 'Third']);
    assert.deepEqual(await titles(host({ tableSort: 'author.name:desc; drop table posts' })), ['Third', 'Second', 'First']);
    assert.deepEqual(await titles(host({ tableSearch: "' or 1=1 --" })), []);
    assert.deepEqual(await titles(host({ tableSearch: "%') or exists(select 1 from authors) or ('" })), []);
    assert.deepEqual(await titles(host({ tableColumnSearches: { 'author.name': "x' union select name from sqlite_master --", 'author.secret': 'x', "title') or 1=1 --": 'x' } as any })), []);
    assert.deepEqual(await titles(host({ tableColumnSearches: { 'author.secret': 'x' } as any })), ['First', 'Second', 'Third']);
    assert.equal(Number((await db('posts').count({ count: '*' }).first() as any).count), 3);
});

test('editable relationship columns save the related record; JSON keys update the attribute', async () => {
    const editable = new Table().columns([TextInputColumn.make('author.name'), TextInputColumn.make('meta.lang'), TextInputColumn.make('tags.name')]);
    const seen: unknown[] = [];
    (editable.getColumn('author.name') as TextInputColumn).afterStateUpdated(({ relatedRecord }) => { seen.push((relatedRecord as any)?.name); });
    assert.equal(await updateTableColumnState(editable, host(), adapter, 'author.name', '2', 'Amy Pond'), 'Amy Pond');
    assert.equal((await db('authors').where('id', 2).first()).name, 'Amy Pond');
    assert.deepEqual(seen, ['Amy Pond']);
    assert.equal(await updateTableColumnState(editable, host(), adapter, 'meta.lang', '2', 'de'), 'de');
    assert.deepEqual(JSON.parse((await db('posts').where('id', 2).first()).meta), { lang: 'de' });
    // No related record, or several: unavailable, nothing written.
    assert.deepEqual(await updateTableColumnState(editable, host(), adapter, 'author.name', '3', 'Ghost'), { error: t('navette-tables::table.columns.editable.unavailable') });
    assert.deepEqual(await updateTableColumnState(editable, host(), adapter, 'tags.name', '1', 'x'), { error: t('navette-tables::table.columns.editable.unavailable') });
    assert.deepEqual((await db('tags').select('name')).map((r: any) => r.name), ['news', 'tech']);
    await db('authors').where('id', 2).update({ name: 'Amy' });
    await db('posts').where('id', 2).update({ meta: JSON.stringify({ lang: 'fr' }) });
});

test('grouping by a relationship column', async () => {
    const grouped = new Table().columns([TextColumn.make('title')]).groups([Group.make('author.name')]);
    const html = clean(await renderTable(grouped, host({ tableGrouping: 'author.name:asc' }), adapter));
    assert.ok(/Author: Amy/.test(html) && /Author: Zed/.test(html), 'groups titled with the related value');
    assert.ok(html.indexOf('Second') < html.indexOf('First'), 'ordered by the related value');
    const query: any = Post.query();
    Group.make('author.name').scope(query, 'Zed');
    assert.deepEqual((await query).map((r: any) => r.title), ['First']);
    const empty: any = Post.query();
    Group.make('author.name').scope(empty, null);
    assert.deepEqual((await empty).map((r: any) => r.title), ['Third']);
});

test('a custom adapter without relationship support: dot-notation reads nested objects, aggregates fail clearly', async () => {
    const rows = [{ id: 1, title: 'Plain', author: { name: 'Nested' } }];
    const custom: DataAdapter = {
        getKey: (record) => String(record.id), keysInScope: async (keys) => keys.map(String), sum: async () => ({}), aggregate: async () => ({ count: 1, sum: {}, avg: {}, min: {}, max: {} }),
        getLabel: () => 'plain items', count: async () => rows.length,
        paginate: async (query) => ({ records: rows, total: rows.length, page: 1, perPage: query.perPage, lastPage: 1, from: 1, to: 1 }),
        find: async () => rows[0], create: async () => rows[0], update: async () => rows[0], delete: async () => true,
        supportsSoftDeletes: () => false, isTrashed: () => false, restore: async () => false, forceDelete: async () => false,
        listKeys: async () => ['1'], deleteMany: async () => 0, exists: async () => false,
    };
    const html = clean(await renderTable(new Table().columns([TextColumn.make('title'), TextColumn.make('author.name')]), host(), custom));
    assert.ok(html.includes('Nested'));
    await assert.rejects(renderTable(new Table().columns([TextColumn.make('posts_count').counts('posts')]), host(), custom), /"posts_count" column aggregates the "posts" relationship \(counts\(\)\), but the data adapter of "plain items" does not support relationships/);
});

test('aggregate declarations are checked: names must be identifiers', () => {
    assert.throws(() => TextColumn.make('x').counts('posts; drop table posts'), /Column x: invalid relationship/);
    assert.throws(() => TextColumn.make('x').sum('orders', 'total) --'), /Column x: invalid column/);
    assert.deepEqual(TextColumn.make('x').counts(null).getRelationshipAggregates(), []);
});
