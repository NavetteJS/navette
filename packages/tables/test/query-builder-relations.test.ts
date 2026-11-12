import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import knexFactory from 'knex';
import { Model, sqlite, type Knex } from '@navette-js/database';
import {
    BooleanConstraint, DateConstraint, IsRelatedToOperator, NumberConstraint, QueryBuilder, RelationshipConstraint, SelectConstraint, TextConstraint,
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
