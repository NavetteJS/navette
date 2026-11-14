import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { normalizeRelationshipAggregates, loadMissingRelationships, loadRelationshipAggregates, readRecordPath } from '@navette-js/support';
import { Model, ObjectionAdapter, assertRelationshipSupport, relatedRecordFor, resolveRelationshipColumn, sqlite, updateRelatedRecord, type Knex, type ListQuery } from '../src/index.ts';

class Country extends Model { static tableName = 'countries'; id!: number; name!: string; }
class Author extends Model {
    static tableName = 'authors';
    id!: number; name!: string; country_id!: number | null; mentor_id!: number | null;
    static get relationMappings() {
        return {
            country: { relation: Model.BelongsToOneRelation, modelClass: Country, join: { from: 'authors.country_id', to: 'countries.id' } },
            mentor: { relation: Model.BelongsToOneRelation, modelClass: Author, join: { from: 'authors.mentor_id', to: 'authors.id' } },
            posts: { relation: Model.HasManyRelation, modelClass: Post, join: { from: 'authors.id', to: 'posts.author_id' } },
        };
    }
}
class Tag extends Model { static tableName = 'tags'; id!: number; name!: string; }
class Comment extends Model { static tableName = 'comments'; id!: number; body!: string; post_id!: number; rating!: number; }
class Post extends Model {
    static tableName = 'posts';
    id!: number; title!: string; author_id!: number | null; meta!: unknown;
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
const list = (query: Partial<ListQuery>) => adapter.paginate({ page: 1, perPage: 50, ...query });

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('countries', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('name'); t.integer('country_id'); t.integer('mentor_id'); });
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.integer('author_id'); t.text('meta'); });
    await db.schema.createTable('comments', (t) => { t.increments('id'); t.string('body'); t.integer('post_id'); t.integer('rating'); });
    await db.schema.createTable('tags', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('post_tag', (t) => { t.integer('post_id'); t.integer('tag_id'); });
    await db('countries').insert([{ name: 'France' }, { name: 'Belgium' }]);
    await db('authors').insert([{ name: 'Zed', country_id: 1 }, { name: 'Amy', country_id: 2, mentor_id: 1 }, { name: 'Bob 100%_', country_id: null }]);
    await db('posts').insert([
        { title: 'First', author_id: 1, meta: JSON.stringify({ lang: 'en' }) },
        { title: 'Second', author_id: 2, meta: JSON.stringify({ lang: 'fr' }) },
        { title: 'Third', author_id: 3, meta: null },
        { title: 'Orphan', author_id: null, meta: null },
    ]);
    await db('comments').insert([{ body: 'Nice', post_id: 1, rating: 4 }, { body: 'Great', post_id: 1, rating: 5 }, { body: 'Meh', post_id: 2, rating: 2 }]);
    await db('tags').insert([{ name: 'news' }, { name: 'tech' }]);
    await db('post_tag').insert([{ post_id: 1, tag_id: 1 }, { post_id: 1, tag_id: 2 }, { post_id: 2, tag_id: 2 }]);
});
after(() => db.destroy());

test('resolveRelationshipColumn: relationships first, then the attribute; plain and qualified columns are not relationship columns', () => {
    assert.deepEqual(resolveRelationshipColumn(Post, 'author.name')?.relationships, ['author']);
    assert.deepEqual(resolveRelationshipColumn(Post, 'author.country.name')?.relationships, ['author', 'country']);
    assert.equal(resolveRelationshipColumn(Post, 'author.country.name')?.attribute, 'name');
    assert.equal(resolveRelationshipColumn(Post, 'title'), null);
    assert.equal(resolveRelationshipColumn(Post, 'posts.title'), null);
    // A JSON attribute is not a relationship.
    assert.equal(resolveRelationshipColumn(Post, 'meta.lang'), null);
    // Names that are not identifiers never resolve (nor reach a query as relationships).
    assert.equal(resolveRelationshipColumn(Post, 'author.name; drop table posts'), null);
    assert.equal(resolveRelationshipColumn(Post, '__proto__.name'), null);
    assert.equal(resolveRelationshipColumn(Post, 'constructor.name'), null);
});

test('eager loading: with loads the relationship part of dot-notation names, nested too', async () => {
    const page = await list({ with: ['author.country', 'comments', 'meta'], sort: { column: 'id', direction: 'asc' } });
    const first = page.records[0] as any;
    assert.equal(first.author.name, 'Zed');
    assert.equal(first.author.country.name, 'France');
    assert.deepEqual(first.comments.map((c: any) => c.body).sort(), ['Great', 'Nice']);
    assert.equal(readRecordPath(first, 'author.country.name'), 'France');
    assert.deepEqual(readRecordPath(first, 'comments.body')?.toString().split(',').sort(), ['Great', 'Nice']);
    assert.equal(readRecordPath(first, 'meta.lang'), 'en');
    assert.equal(readRecordPath(page.records[3], 'author.name'), null);
    assert.equal(readRecordPath(page.records[2], 'comments.body'), null);
});

test('sort through a belongs-to relationship, nested and self-referencing', async () => {
    const titles = async (column: string, direction: 'asc' | 'desc') => (await list({ sort: { column, direction } })).records.map((r) => r.title);
    assert.deepEqual(await titles('author.name', 'asc'), ['Orphan', 'Second', 'Third', 'First']);
    assert.deepEqual(await titles('author.name', 'desc'), ['First', 'Third', 'Second', 'Orphan']);
    assert.deepEqual((await titles('author.country.name', 'asc')).slice(2), ['Second', 'First']);
    const authors = new ObjectionAdapter(Author);
    assert.deepEqual((await authors.paginate({ page: 1, perPage: 10, sort: { column: 'mentor.name', direction: 'desc' } })).records.map((r) => r.name)[0], 'Amy');
    // Has-many relationships cannot be sorted on (like Filament).
    await assert.rejects(list({ sort: { column: 'comments.body', direction: 'asc' } }), /single-record relationships/);
});

test('global and column searches through relationships (whereHas), mixed with plain columns', async () => {
    const titles = async (query: Partial<ListQuery>) => (await list({ ...query, sort: { column: 'id', direction: 'asc' } })).records.map((r) => r.title);
    assert.deepEqual(await titles({ search: 'amy', searchColumns: ['title', 'author.name'] }), ['Second']);
    assert.deepEqual(await titles({ search: 'first', searchColumns: ['title', 'author.name'] }), ['First']);
    assert.deepEqual(await titles({ search: 'belg', searchColumns: ['author.country.name'] }), ['Second']);
    assert.deepEqual(await titles({ search: 'great', searchColumns: ['comments.body'] }), ['First']);
    assert.deepEqual(await titles({ search: 'tech', searchColumns: ['tags.name'] }), ['First', 'Second']);
    assert.deepEqual(await titles({ columnSearches: { 'author.name': 'ze' } }), ['First']);
    assert.deepEqual(await titles({ search: 'second zed', searchColumns: ['title', 'author.name'] }), []);
});

test('SQL injection attempts through relationship search and sort stay values, or are refused', async () => {
    const titles = async (query: Partial<ListQuery>) => (await list(query)).records.map((r) => r.title);
    // Search terms are bound values; LIKE wildcards are escaped.
    assert.deepEqual(await titles({ search: "' or 1=1 --", searchColumns: ['author.name'] }), []);
    assert.deepEqual(await titles({ search: "%') or ('1'='1", searchColumns: ['author.name', 'author.country.name'] }), []);
    assert.deepEqual(await titles({ search: '%', searchColumns: ['author.name'] }), ['Third']);
    assert.deepEqual(await titles({ search: '100%_', searchColumns: ['author.name'] }), ['Third']);
    assert.deepEqual(await titles({ columnSearches: { 'author.name': "x' union select name from sqlite_master --" } }), []);
    // Forged column names are never relationship columns: they are bound identifiers, so the query fails instead of running SQL.
    await assert.rejects(list({ sort: { column: 'author.name) desc; drop table posts; --', direction: 'asc' } }));
    await assert.rejects(list({ search: 'x', searchColumns: ['author.name`) or 1=1 --'] }));
    assert.equal(await db('posts').count({ count: '*' }).first().then((row: any) => Number(row.count)), 4);
    // The direction is a closed list.
    assert.equal((await list({ sort: { column: 'author.name', direction: 'desc; drop table posts' as any } })).total, 4);
});

test('keys of JSON attributes (jsonAttributes) are sorted and searched like Laravel\'s meta->lang', async () => {
    const titles = async (query: Partial<ListQuery>) => (await list({ ...query })).records.map((r) => r.title);
    assert.deepEqual((await titles({ sort: { column: 'meta.lang', direction: 'desc' } })).slice(0, 2), ['Second', 'First']);
    assert.deepEqual(await titles({ search: 'fr', searchColumns: ['meta.lang'] }), ['Second']);
    assert.deepEqual(await titles({ columnSearches: { 'meta.lang': 'en' } }), ['First']);
    assert.deepEqual(await titles({ search: "') or 1=1 --", searchColumns: ['meta.lang'] }), []);
});

test('relationship aggregates: counts, exists, avg, sum, min, max, with aliases and query modifiers', async () => {
    const aggregates = [
        ...normalizeRelationshipAggregates('count', ['comments', 'tags', { 'comments as good_comments_count': (query) => query.where('rating', '>=', 4) }]),
        ...normalizeRelationshipAggregates('exists', 'comments'),
        ...normalizeRelationshipAggregates('avg', 'comments', 'rating'),
        ...normalizeRelationshipAggregates('sum', 'comments', 'rating'),
        ...normalizeRelationshipAggregates('min', 'comments', 'rating'),
        ...normalizeRelationshipAggregates('max', 'comments', 'rating'),
    ];
    assert.deepEqual(aggregates.map((a) => a.alias), ['comments_count', 'tags_count', 'good_comments_count', 'comments_exists', 'comments_avg_rating', 'comments_sum_rating', 'comments_min_rating', 'comments_max_rating']);
    const page = await list({ aggregates, sort: { column: 'id', direction: 'asc' } });
    const [first, second, third] = page.records as any[];
    assert.equal(first.title, 'First');
    assert.deepEqual([first.comments_count, first.tags_count, first.good_comments_count, first.comments_exists], [2, 2, 2, true]);
    assert.deepEqual([Number(first.comments_avg_rating), Number(first.comments_sum_rating), first.comments_min_rating, first.comments_max_rating], [4.5, 9, 4, 5]);
    assert.deepEqual([second.comments_count, second.good_comments_count, second.tags_count], [1, 0, 1]);
    assert.deepEqual([third.comments_count, third.comments_exists, third.comments_sum_rating], [0, false, null]);
    // Sorting by an aggregate alias, and summaries over it.
    const sorted = await list({ aggregates, sort: { column: 'comments_count', direction: 'desc' } });
    assert.equal(sorted.records[0].title, 'First');
    const summary = await adapter.aggregate({ aggregates }, { sum: ['comments_count'] });
    assert.equal(summary.sum.comments_count, 3);
    // Total stays exact with aggregates and eager loading.
    assert.equal((await adapter.paginate({ page: 1, perPage: 2, aggregates, with: ['comments'] })).total, 4);
});

test('summaries of relationship columns aggregate the related records of the listed records, each once', async () => {
    const all = await adapter.aggregate({}, { sum: ['comments.rating'], avg: ['comments.rating'], min: ['author.name', 'comments.rating'], max: ['author.country.name'] });
    assert.equal(all.count, 4);
    assert.equal(all.sum['comments.rating'], 11);
    assert.equal(Number(all.avg['comments.rating']).toFixed(2), '3.67');
    assert.equal(all.min['author.name'], 'Amy');
    assert.equal(all.min['comments.rating'], 2);
    assert.equal(all.max['author.country.name'], 'France');
    // Only the related records of the filtered records count.
    const filtered = await adapter.aggregate({ search: 'first', searchColumns: ['title'] }, { sum: ['comments.rating'], min: ['author.name'] });
    assert.deepEqual([filtered.count, filtered.sum['comments.rating'], filtered.min['author.name']], [1, 9, 'Zed']);
    await assert.rejects(adapter.aggregateGroups({}, { sum: ['comments.rating'] }, (q) => q.groupBy('author_id')), /relationship column/);
});

test('aggregate names are checked at declaration', () => {
    assert.throws(() => normalizeRelationshipAggregates('count', 'comments; drop table posts'), /invalid relationship/);
    assert.throws(() => normalizeRelationshipAggregates('sum', 'comments', 'rating) from x --'), /invalid column/);
    assert.throws(() => normalizeRelationshipAggregates('sum', 'comments', null), /needs the column/);
    assert.throws(() => normalizeRelationshipAggregates('count', 'comments as bad-alias'), /invalid relationship/);
    assert.deepEqual(normalizeRelationshipAggregates('count', 'blogPosts').map((a) => a.alias), ['blog_posts_count']);
});

test('an unknown relationship in an aggregate fails clearly', async () => {
    await assert.rejects(list({ aggregates: normalizeRelationshipAggregates('count', 'nothing') }), /not a relationship of model Post/);
});

test('assertRelationshipSupport: custom adapters without relationship support get a clear error for aggregates only', () => {
    const custom = { getLabel: () => 'items' };
    assert.doesNotThrow(() => assertRelationshipSupport(custom, { aggregates: [] }));
    assert.throws(() => assertRelationshipSupport(custom, { aggregates: normalizeRelationshipAggregates('count', 'comments') }), /"comments_count" column aggregates the "comments" relationship \(counts\(\)\), but the data adapter of "items" does not support relationships/);
    assert.doesNotThrow(() => assertRelationshipSupport(adapter, { aggregates: normalizeRelationshipAggregates('count', 'comments') }));
});

test('single records: missing relationships and aggregates are loaded on demand (infolists)', async () => {
    const post = (await adapter.find(1)) as any;
    assert.equal(post.author, undefined);
    await loadMissingRelationships(post, ['author.country.name', 'comments.body', 'title', 'meta.lang']);
    assert.equal(post.author.country.name, 'France');
    assert.equal(post.comments.length, 2);
    await loadRelationshipAggregates(post, [...normalizeRelationshipAggregates('count', 'comments'), ...normalizeRelationshipAggregates('avg', 'comments', 'rating'), ...normalizeRelationshipAggregates('exists', 'tags')]);
    assert.equal(post.comments_count, 2);
    assert.equal(Number(post.comments_avg_rating), 4.5);
    assert.equal(post.tags_exists, true);
    await assert.rejects(loadRelationshipAggregates({ id: 1 }, normalizeRelationshipAggregates('count', 'comments')), /need an Objection model record/);
    // A plain record that already has the aggregate is left as is.
    const plain = { comments_count: 7 };
    await loadRelationshipAggregates(plain, normalizeRelationshipAggregates('count', 'comments'));
    assert.equal(plain.comments_count, 7);
});

test('saving an attribute of a related record (editable relationship columns)', async () => {
    const post = (await adapter.find(2)) as any;
    assert.equal((await relatedRecordFor(post, 'author.name'))?.related.name, 'Amy');
    assert.equal(await updateRelatedRecord(post, 'author.name', 'Amy Pond'), true);
    assert.equal((await Author.query().findById(2))!.name, 'Amy Pond');
    assert.equal(await updateRelatedRecord(post, 'author.country.name', 'Belgique'), true);
    assert.equal((await Country.query().findById(2))!.name, 'Belgique');
    // Has-many relationships hold several records: nothing is saved.
    assert.equal(await updateRelatedRecord(post, 'comments.body', 'x'), false);
    assert.equal(await updateRelatedRecord(await adapter.find(4), 'author.name', 'x'), false);
    assert.equal(await updateRelatedRecord(post, 'title', 'x'), false);
});
