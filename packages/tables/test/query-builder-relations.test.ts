import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import knexFactory from 'knex';
import { Model, sqlite, type Knex } from '@navette-js/database';
import {
    BooleanConstraint, DateConstraint, IsRelatedToOperator, NumberConstraint, QueryBuilder, RelationshipConstraint, SelectColumn, SelectConstraint, SelectFilter, Table, TextConstraint, getFilterIndicators, getTableRecords, updateTableColumnState,
    applyConditions, compileRules, resolveRuleDate, sanitizeRules, sqlDialectOf, type Constraint, type ConditionNode,
} from '../src/index.ts';

class Author extends Model { static tableName = 'authors'; }
class Tag extends Model { static tableName = 'tags'; }
class Post extends Model {
    static tableName = 'posts';
    static get relationMappings() {
        return {
            author: { relation: Model.BelongsToOneRelation, modelClass: Author, join: { from: 'posts.author_id', to: 'authors.id' } },
            tags: { relation: Model.ManyToManyRelation, modelClass: Tag, join: { from: 'posts.id', through: { from: 'post_tag.post_id', to: 'post_tag.tag_id' }, to: 'tags.id' } },
        };
    }
}
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('tags', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.string('status'); t.integer('author_id'); t.string('published_at'); t.boolean('is_featured'); });
    await db.schema.createTable('post_tag', (t) => { t.integer('post_id'); t.integer('tag_id'); });
    await db('authors').insert([{ name: 'Ada' }, { name: 'Linus' }]);
    await db('tags').insert([{ name: 'js' }, { name: 'php' }, { name: 'sql' }]);
    await db('posts').insert([
        { title: 'A', status: 'draft', author_id: 1, published_at: '2026-06-01 10:00:00', is_featured: 1 },
        { title: 'B', status: 'published', author_id: 2, published_at: '2026-06-01 15:30:00', is_featured: 0 },
        { title: 'C', status: '', author_id: 1, published_at: null, is_featured: 0 },
    ]);
    await db('post_tag').insert([{ post_id: 1, tag_id: 1 }, { post_id: 1, tag_id: 2 }, { post_id: 2, tag_id: 3 }]);
});
after(() => db.destroy());

const constraints = (): Constraint[] => [
    SelectConstraint.make('status').options({ draft: 'Draft', published: 'Published', archived: 'Archived' }).nullable(),
    SelectConstraint.make('statuses').attribute('status').options({ draft: 'Draft', published: 'Published' }).multiple(),
    RelationshipConstraint.make('tags').multiple().selectable(IsRelatedToOperator.make().titleAttribute('name').multiple()),
    RelationshipConstraint.make('author').emptyable(),
    TextConstraint.make('authorName').label('Author name').relationship('author', 'name'),
    DateConstraint.make('published_at').label('Published at').time().nullable(),
    BooleanConstraint.make('is_featured'),
];
const rule = (type: string, operator: unknown, settings: unknown = null) => ({ type, data: { operator, settings } });
/** Titles of the posts matched by the rules, and indicator summaries. */
async function run(rules: Record<string, unknown>, list = constraints()) {
    const { nodes, summaries } = compileRules(list, sanitizeRules(list, rules));
    const query = Post.query().orderBy('id');
    query.where((inner: any) => applyConditions(inner, nodes));
    return { titles: ((await query) as any[]).map((post) => post.title), summaries, nodes };
}

test('SelectConstraint: single or multiple value, unknown or forged values dropped, "Is filled"', async () => {
    assert.deepEqual(await run({ a: rule('status', 'is', { value: 'draft' }) }).then((r) => [r.titles, r.summaries.a]), [['A'], 'Status is Draft']);
    assert.deepEqual((await run({ a: rule('status', 'is.inverse', { value: 'draft' }) })).titles, ['B', 'C']);
    const multiple = await run({ a: rule('statuses', 'is', { values: ['published', 'nope', ['draft'], { $ne: 1 }, 'draft'] }) });
    assert.deepEqual([multiple.titles, multiple.summaries.a], [['A', 'B'], 'Statuses is Draft or Published']);
    assert.deepEqual(multiple.nodes, [{ kind: 'in', column: 'status', values: ['published', 'draft'], negate: false }]);
    // A list is not accepted for a single value; a value missing from the options filters nothing.
    assert.deepEqual((await run({ a: rule('status', 'is', { value: ['draft'] }), b: rule('status', 'is', { value: "x' or 1=1" }) })).nodes, []);
    assert.deepEqual(await run({ a: rule('status', 'isFilled') }).then((r) => [r.titles, r.summaries.a]), [['A', 'B'], 'Status is filled']);
    assert.deepEqual(await run({ a: rule('status', 'isFilled.inverse') }).then((r) => [r.titles, r.summaries.a]), [['C'], 'Status is blank']);
    // Without `nullable()`, the operator does not exist.
    assert.deepEqual((await run({ a: rule('statuses', 'isFilled') })).nodes, []);
});

test('RelationshipConstraint: related record count, empty relationship, picked records', async () => {
    assert.deepEqual(await run({ a: rule('tags', 'hasMin', { count: '2' }) }).then((r) => [r.titles, r.summaries.a]), [['A'], 'Has minimum 2 Tags']);
    assert.deepEqual((await run({ a: rule('tags', 'hasMax', { count: 1 }) })).titles, ['B', 'C']);
    assert.deepEqual((await run({ a: rule('tags', 'equals', { count: 1 }) })).titles, ['B']);
    assert.deepEqual((await run({ a: rule('tags', 'equals.inverse', { count: 1 }) })).titles, ['A', 'C']);
    assert.deepEqual(await run({ a: rule('tags', 'isEmpty') }).then((r) => [r.titles, r.summaries.a]), [['C'], 'Tags is empty']);
    assert.deepEqual((await run({ a: rule('tags', 'isRelatedTo', { values: [3, '2'] }) })).titles, ['A', 'B']);
    assert.deepEqual((await run({ a: rule('tags', 'isRelatedTo.inverse', { values: [3] }) })).titles, ['A', 'C']);
    // Single-record relationship: no count or picking, only "empty" (emptyable).
    assert.deepEqual((await run({ a: rule('author', 'isEmpty.inverse') })).titles, ['A', 'B', 'C']);
    assert.deepEqual((await run({ a: rule('author', 'hasMin', { count: 1 }) })).nodes, []);
    // Forged or out-of-range counts: no effect.
    assert.deepEqual((await run({ a: rule('tags', 'hasMin', { count: '0' }), b: rule('tags', 'hasMin', { count: '1; drop' }), c: rule('tags', 'isRelatedTo', { values: [{ id: 1 }] }) })).nodes, []);
});

test('constraint on a relationship attribute and OR block', async () => {
    const r = await run({ a: rule('authorName', 'equals', { text: 'Ada' }) });
    assert.deepEqual([r.titles, r.summaries.a], [['A', 'C'], 'Author name equals Ada']);
    assert.deepEqual(r.nodes, [{ relationship: 'author', nodes: [{ kind: 'compare', column: 'name', operator: '=', value: 'Ada' }] }]);
    const or = await run({ o: { type: 'or', data: { groups: { g1: { rules: { a: rule('tags', 'equals', { count: 1 }) } }, g2: { rules: { b: rule('authorName', 'contains', { text: 'ad' }) } } } } } });
    assert.deepEqual([or.titles, or.summaries.o], [['A', 'B', 'C'], 'Has 1 Tags OR Author name contains ad']);
});

test('related record labels: select options and indicators', async () => {
    const list = constraints();
    const filter = QueryBuilder.make().constraints(list).model(Post);
    const tags = list[2] as RelationshipConstraint;
    assert.deepEqual(await tags.loadRelatedOptions(tags.getSelectableOperator()!, null), [['1', 'js'], ['2', 'php'], ['3', 'sql']]);
    const state = { rules: { a: rule('tags', 'isRelatedTo', { values: [3, 1] }), b: { type: 'or', data: { groups: { g: { rules: { c: rule('tags', 'isRelatedTo.inverse', { values: ['2'] }) } } } } } } };
    assert.deepEqual(filter.getIndicators(state).map((i) => i.label), ['Tags contains 3 or 1', 'Tags does not contain 2']);
    await filter.loadIndicatorData(state, {} as any);
    assert.deepEqual(filter.getIndicators(state).map((i) => i.label), ['Tags contains sql or js', 'Tags does not contain php']);
    // Without a declared model or a host that provides one, the error is explicit.
    const orphan = RelationshipConstraint.make('tags').selectable(IsRelatedToOperator.make().titleAttribute('name'));
    await assert.rejects(() => orphan.loadRelatedOptions(orphan.getSelectableOperator()!, null), /model\(\)/);
});

test('dates with time: fixed date-time, time presets, sub-day units', async () => {
    const after = await run({ a: rule('published_at', 'isAfter', { mode: 'absolute', date: '2026-06-01T12:00' }) });
    assert.deepEqual([after.titles, after.summaries.a], [['B'], 'Published at is after Mon, Jun 1, 2026 12:00:00']);
    assert.deepEqual(after.nodes, [{ kind: 'compare', column: 'published_at', operator: '>=', value: '2026-06-01 12:00:00' }]);
    assert.deepEqual((await run({ a: rule('published_at', 'isBefore.inverse', { mode: 'absolute', date: '2026-06-01 10:00:00' }) })).titles, ['B']);
    assert.deepEqual((await run({ a: rule('published_at', 'isDate', { date: '2026-06-01' }) })).titles, ['A', 'B']);
    assert.deepEqual((await run({ a: rule('published_at', 'isAfter', { mode: 'absolute', date: '2026-06-01T25:00' }) })).nodes, []);
    assert.deepEqual((await run({ a: rule('published_at', 'isFilled.inverse') })).titles, ['C']);
    const now = new Date('2026-11-12T10:34:56Z');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'past_hour' }, now, true), '2026-11-12 09:34:56');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'this_hour' }, now, true), '2026-11-12 10:00:00');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'custom', tense: 'future', relative_value: 90, relative_unit: 'minute' }, now, true), '2026-11-12 12:04:56');
    // Without `time()`, time presets and units are unknown: they fall back to today and days.
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'past_hour' }, now), '2026-11-12');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'custom', relative_value: 2, relative_unit: 'hour' }, now), '2026-11-10');
    assert.equal(resolveRuleDate({ mode: 'absolute', date: '2026-06-01T08:15' }, now, true), '2026-06-01 08:15:00');
});

test('portable SQL: dialect read from the knex client', () => {
    const nodes: ConditionNode[] = [
        { kind: 'like', column: 'title', pattern: '%Ab\\%%', negate: false }, { kind: 'date', column: 'published_at', operator: '>=', value: '2026-01-01' },
        { kind: 'month', column: 'published_at', operator: '=', value: 6 }, { kind: 'year', column: 'published_at', operator: '!=', value: 2025 },
        { kind: 'boolean', column: 'is_featured', value: true }, { kind: 'filled', column: 'status', negate: false },
    ];
    const sql = (client: string) => { const query = knexFactory({ client, useNullAsDefault: true })('posts'); applyConditions(query, nodes); return [sqlDialectOf(query), query.toSQL().sql]; };
    assert.deepEqual(sql('better-sqlite3'), ['sqlite', "select * from `posts` where `title` like ? escape '\\' and date(`published_at`) >= ? and cast(strftime('%m', `published_at`) as integer) = ? and cast(strftime('%Y', `published_at`) as integer) != ? and `is_featured` = ? and (`status` is not null and not (`status` = ?))"]);
    assert.deepEqual(sql('mysql2'), ['mysql', 'select * from `posts` where `title` like ? and date(`published_at`) >= ? and month(`published_at`) = ? and year(`published_at`) != ? and `is_featured` = ? and (`status` is not null and not (`status` = ?))']);
    assert.deepEqual(sql('pg'), ['pg', `select * from "posts" where lower(cast("title" as text)) like ? escape '\\' and cast("published_at" as date) >= ? and extract(month from "published_at") = ? and extract(year from "published_at") != ? and "is_featured" = ? and ("status" is not null and not (cast("status" as text) = ?))`]);
    assert.equal(sqlDialectOf(Post.query()), 'sqlite');
    // PostgreSQL: lowercase pattern and a real boolean.
    const pg = knexFactory({ client: 'pg' })('posts');
    applyConditions(pg, nodes);
    assert.deepEqual(pg.toSQL().bindings, ['%ab\\%%', '2026-01-01', 6, 2025, true, '']);
});

test('operators offered by each constraint, in order', () => {
    // "Is filled" is only offered with nullable().
    assert.deepEqual(TextConstraint.make('a').getOperatorOptions().map(([value]) => value), ['contains', 'contains.inverse', 'startsWith', 'startsWith.inverse', 'endsWith', 'endsWith.inverse', 'equals', 'equals.inverse']);
    assert.deepEqual(NumberConstraint.make('a').nullable().getOperators().map((o) => o.name), ['isMin', 'isMax', 'equals', 'isFilled']);
    assert.deepEqual(DateConstraint.make('a').getOperators().map((o) => o.name), ['isAfter', 'isBefore', 'isDate', 'isMonth', 'isYear']);
    assert.deepEqual(RelationshipConstraint.make('tags').multiple().selectable(IsRelatedToOperator.make()).getOperators().map((o) => o.name), ['isRelatedTo', 'hasMin', 'hasMax', 'equals', 'isEmpty']);
    assert.deepEqual(SelectConstraint.make('s').multiple().getListSettingNames(), ['values']);
});

test('relationship select filter: options, related records, "None" option, labels', async () => {
    const { ObjectionAdapter } = await import("@navette-js/database");
    const adapter = new ObjectionAdapter(Post);
    const host = (tableFilters: any) => ({ id: 'R', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, tableFilters, getDataAdapterForTable: () => adapter });
    const author = SelectFilter.make('author').relationship('author', 'name', null, true);
    const tags = SelectFilter.make('tags').multiple().relationship('tags', 'name', (query: any) => query.whereNot('name', 'sql'));
    const table = new Table().filters([author, tags]);
    assert.deepEqual(await author.getFormOptions(host({})), [['__empty', 'None'], ['1', 'Ada'], ['2', 'Linus']]);
    assert.deepEqual(await tags.getFormOptions(host({})), [['1', 'js'], ['2', 'php']], 'modified query');
    const titles = async (filters: any) => (await getTableRecords(table, host(filters) as any, adapter)).records.map((record: any) => record.title).sort();
    assert.deepEqual(await titles({ author: { value: '2' } }), ['B']);
    assert.deepEqual(await titles({ tags: { values: ['1', '3'] } }), ['A'], 'tag 3 is out of the modified query');
    await db('posts').insert({ title: 'D', status: 'draft', author_id: null });
    try {
        assert.deepEqual(await titles({ author: { value: '__empty' } }), ['D']);
        assert.deepEqual(await titles({ author: { value: '999' } }), [], 'an unknown key matches nothing');
        const filters = { author: { value: '1' }, tags: { values: ['2'] } };
        for (const filter of table.getFilters()) await filter.loadIndicatorData!(filters[filter.name as 'author'], host(filters) as any);
        assert.deepEqual(getFilterIndicators(table, host(filters) as any).map((indicator) => indicator.label), ['Author: Ada', 'Tags: php']);
    } finally {
        await db('posts').where('title', 'D').delete();
    }
});

test('select column `optionsRelationship()`: options from the related model, keys checked on save', async () => {
    const { ObjectionAdapter } = await import('@navette-js/database');
    const adapter = new ObjectionAdapter(Post);
    const column = SelectColumn.make('author_id').optionsRelationship('author', 'name');
    const table = new Table().columns([column]);
    const host = { id: 'R', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 } };
    const post = await Post.query().findById(1);
    assert.deepEqual(await column.getOptionsFor(post as any), [['1', 'Ada'], ['2', 'Linus']]);
    assert.deepEqual(await updateTableColumnState(table, host as any, adapter, 'author_id', 1, '99'), { error: 'The selected author id is invalid.' });
    assert.equal(await updateTableColumnState(table, host as any, adapter, 'author_id', 1, '2'), '2');
    await db('posts').where('id', 1).update({ author_id: 1 });
});

test('number constraint on a relationship: sum, average, minimum and maximum of the related records', async () => {
    class Comment extends Model { static tableName = 'comments'; }
    class Article extends Model {
        static tableName = 'posts';
        static get relationMappings() { return { comments: { relation: Model.HasManyRelation, modelClass: Comment, join: { from: 'posts.id', to: 'comments.post_id' } } }; }
    }
    await db.schema.createTable('comments', (t) => { t.increments('id'); t.integer('post_id'); t.integer('score'); });
    try {
        await db('comments').insert([{ post_id: 1, score: 5 }, { post_id: 1, score: 7 }, { post_id: 2, score: 9 }]);
        const constraints = [NumberConstraint.make('commentScore').label('Comment score').relationship('comments', 'score')];
        const run = async (rules: unknown) => {
            const { nodes, summaries } = compileRules(constraints, sanitizeRules(constraints, rules));
            const rows = await Article.query().where((query: any) => applyConditions(query, nodes)).orderBy('id');
            return { titles: rows.map((row: any) => row.title), summaries: Object.values(summaries) };
        };
        const rule = (operator: string, settings: Record<string, unknown>) => ({ r: { type: 'commentScore', data: { operator, settings } } });
        assert.deepEqual(await run(rule('isMin', { number: 10, aggregate: 'sum' })), { titles: ['A'], summaries: ['Sum of Comment score is minimum 10'] });
        assert.deepEqual((await run(rule('isMin', { number: 8, aggregate: 'avg' }))).titles, ['B']);
        assert.deepEqual((await run(rule('isMax', { number: 5, aggregate: 'min' }))).titles, ['A']);
        assert.deepEqual((await run(rule('equals', { number: 9, aggregate: 'max' }))).titles, ['B']);
        assert.deepEqual((await run(rule('isMin', { number: 9, aggregate: null }))).titles, ['B'], 'no aggregate: any related record');
        assert.deepEqual((await run(rule('isMin', { number: 9, aggregate: 'count; drop table posts' }))).titles, ['B'], 'an unknown aggregate is ignored');
    } finally {
        await db.schema.dropTable('comments');
    }
});

test('dot syntax: `creator.name` filters an attribute of related records, through nested relationships too', async () => {
    const dotted = TextConstraint.make('author.name');
    assert.deepEqual([dotted.getRelationshipName(), dotted.getColumn(), dotted.getLabel()], ['author', 'name', 'Author']);
    const r = await run({ a: rule('author.name', 'equals', { text: 'Linus' }) }, [dotted]);
    assert.deepEqual([r.titles, r.summaries.a, r.nodes], [['B'], 'Author equals Linus', [{ relationship: 'author', nodes: [{ kind: 'compare', column: 'name', operator: '=', value: 'Linus' }] }]]);
    assert.throws(() => TextConstraint.make('author..name'), /Invalid constraint name/);
    assert.throws(() => TextConstraint.make('author.__proto__'), /Invalid constraint name/);

    class Country extends Model { static tableName = 'countries'; }
    class Writer extends Model {
        static tableName = 'authors';
        static get relationMappings() { return { country: { relation: Model.BelongsToOneRelation, modelClass: Country, join: { from: 'authors.country_id', to: 'countries.id' } } }; }
    }
    class Article extends Model {
        static tableName = 'posts';
        static get relationMappings() { return { author: { relation: Model.BelongsToOneRelation, modelClass: Writer, join: { from: 'posts.author_id', to: 'authors.id' } } }; }
    }
    await db.schema.createTable('countries', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.alterTable('authors', (t) => { t.integer('country_id'); });
    try {
        await db('countries').insert([{ name: 'France' }, { name: 'Finland' }]);
        await db('authors').where('id', 1).update({ country_id: 1 });
        await db('authors').where('id', 2).update({ country_id: 2 });
        const nested = [NumberConstraint.make('author.country.id'), TextConstraint.make('author.country.name').label('Country')];
        const titles = async (rules: unknown) => {
            const { nodes } = compileRules(nested, sanitizeRules(nested, rules));
            return (await Article.query().where((query: any) => applyConditions(query, nodes)).orderBy('id')).map((row: any) => row.title);
        };
        assert.deepEqual(await titles({ a: rule('author.country.name', 'startsWith', { text: 'Fin' }) }), ['B']);
        assert.deepEqual(await titles({ a: rule('author.country.name', 'equals.inverse', { text: 'Finland' }) }), ['A', 'C']);
        assert.deepEqual(await titles({ a: rule('author.country.id', 'equals', { number: 1 }) }), ['A', 'C']);
        const { nodes: aggregate } = compileRules(nested, sanitizeRules(nested, { a: rule('author.country.id', 'equals', { number: 1, aggregate: 'sum' }) }));
        assert.throws(() => applyConditions(Article.query(), aggregate), /nested relationship author.country/);
    } finally {
        await db.schema.dropTable('countries');
        await db.schema.alterTable('authors', (t) => { t.dropColumn('country_id'); });
    }
});
