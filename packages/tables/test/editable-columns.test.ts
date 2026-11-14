import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { BadgeColumn, BooleanColumn, CheckboxColumn, SelectColumn, Table, TextColumn, TextInputColumn, ToggleColumn, ViewColumn, updateTableColumnState, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

class Post extends Model {
    static tableName = 'posts';
    id!: number;
    title!: string;
    is_featured!: number;
    rating!: number | null;
    status!: string;
}
let db: Knex;
const adapter = new ObjectionAdapter(Post);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'x', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, ...over });

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.boolean('is_featured'); t.integer('rating'); t.string('status'); });
    await db('posts').insert([{ title: 'Alpha', is_featured: 0, rating: 3, status: 'draft' }, { title: 'Beta', is_featured: 1, rating: null, status: 'published' }]);
});
after(() => db.destroy());

test('validation: string rules, messages, empty value, several errors', () => {
    const toggle = ToggleColumn.make('is_featured');
    assert.equal(toggle.validate(true), null);
    assert.equal(toggle.validate('1'), null);
    assert.equal(toggle.validate('yes'), 'The is featured field must be true or false.');
    assert.equal(toggle.validate(null), null);
    assert.equal(ToggleColumn.make('is_featured').required().validate(null), 'The is featured field is required.');
    const slug = TextInputColumn.make('slug').rules(['required', 'max:5']);
    assert.equal(slug.validate('   '), 'The slug field is required.');
    assert.equal(slug.validate('abcdefg'), 'The slug field must not be greater than 5 characters.');
    assert.equal(slug.validate(['abc']), 'The slug field must be a string.');
    assert.equal(slug.validate({ toString: 'x' }), 'The slug field must be a string.');
    const rating = TextInputColumn.make('rating').rules(['numeric', 'max:10']).validationAttribute('note');
    assert.equal(rating.validate('12'), 'The note field must not be greater than 10.');
    // A non-numeric string is measured in characters by `max`.
    assert.equal(rating.validate('abc'), 'The note field must be a number.');
    assert.equal(rating.validate('abcdefghijkl'), 'The note field must be a number. (and 1 more error)');
    assert.equal(rating.validationMessages({ numeric: 'A number, please.' }).validate('abcdefghijkl'), 'A number, please. (and 1 more error)');
    assert.equal(TextInputColumn.make('code').rules([{ name: 'even', passes: (v) => Number(v) % 2 === 0, message: (a) => `The ${a} must be even.` }]).validate('3'), 'The code must be even.');
    assert.throws(() => TextInputColumn.make('x').rules(['regex:/a/']));
    const select = SelectColumn.make('status').options({ draft: 'Draft', published: 'Published' });
    assert.equal(select.validate('archived'), 'The selected status is invalid.');
    assert.equal(select.validate(['draft']), 'The selected status is invalid.');
    assert.equal(select.validate('draft'), null);
    assert.equal(select.required().validate(''), 'The status field is required.');
});

test('written value: blank → null, boolean normalized for toggle and checkbox', () => {
    assert.equal(ToggleColumn.make('a').castState('1'), true);
    assert.equal(CheckboxColumn.make('a').castState(0), false);
    assert.equal(CheckboxColumn.make('a').castState(null), null);
    assert.equal(TextInputColumn.make('a').castState('  '), null);
    assert.equal(TextInputColumn.make('a').castState('x'), 'x');
});

test('updateTableColumnState: column, record, permission and value checked again on the server', async () => {
    const calls: string[] = [];
    const table = new Table<Post>().columns([
        TextColumn.make('title'),
        ToggleColumn.make<Post>('is_featured').beforeStateUpdated(({ state }) => { calls.push(`before:${state}`); }).afterStateUpdated(({ state, record }) => { calls.push(`after:${state}:${record.id}`); }),
        TextInputColumn.make<Post>('rating').rules(['integer']).disabled((record) => record.id === 2).toggleable(),
        TextInputColumn.make<Post>('author.name'),
    ]);
    const unavailable = { error: t('navette-tables::table.columns.editable.unavailable') };
    // Non-editable, unknown, user-hidden column, or relationship column without a custom write.
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'title', 1, 'Hacked'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'secret', 1, 'x'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host({ tableColumns: [{ type: 'column', name: 'rating', label: 'Rating', isHidden: false, isToggled: false, isToggleable: true, isToggledHiddenByDefault: false }] }), adapter, 'rating', 1, '4'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'author.name', 1, 'Ada'), unavailable);
    // Forged key, record disabled for the column, unauthorized user.
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'is_featured', { id: 1 }, true), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'is_featured', 99, true), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'rating', 2, '4'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'is_featured', 1, true, { authorize: () => false }), unavailable);
    // Invalid value: nothing is written.
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'rating', 1, '4.5'), { error: 'The rating field must be an integer.' });
    assert.equal((await db('posts').where('id', 1).first()).rating, 3);
    assert.deepEqual(calls, []);
    // Valid value: before / after hooks run, only the declared column is written.
    assert.equal(await updateTableColumnState(table, host(), adapter, 'is_featured', '1', '1', { authorize: async () => true }), true);
    assert.deepEqual(calls, ['before:true', 'after:true:1']);
    assert.equal((await db('posts').where('id', 1).first()).is_featured, 1);
    assert.equal(await updateTableColumnState(table, host(), adapter, 'rating', 1, ''), null);
    assert.equal((await db('posts').where('id', 1).first()).rating, null);
});

test('updateStateUsing replaces the write; afterStateUpdated runs even on error', async () => {
    const seen: unknown[] = [];
    const column = TextInputColumn.make<Post>('author.name').updateStateUsing(({ state, record }) => { seen.push([state, record.id]); return 'ok'; }).afterStateUpdated(() => { seen.push('after'); });
    const table = new Table<Post>().columns([column]);
    assert.equal(await updateTableColumnState(table, host(), adapter, 'author.name', 2, 'Ada'), 'ok');
    assert.deepEqual(seen, [['Ada', 2], 'after']);
    const failing = TextInputColumn.make<Post>('title').updateStateUsing(() => { throw new Error('boom'); }).afterStateUpdated(() => { seen.push('after-failure'); });
    await assert.rejects(() => updateTableColumnState(new Table<Post>().columns([failing]), host(), adapter, 'title', 2, 'x'), /boom/);
    assert.equal(seen.at(-1), 'after-failure');
});

test('render: Alpine component markup, escaped values', async () => {
    const toggle = await ToggleColumn.make('is_featured').onIcon('m-check').toHtml({ is_featured: 1 }, 7);
    assert.match(toggle, /^<div wire:ignore\.self x-load="x-load" x-load-src="\/js\/navette\/tables\/components\/columns\/toggle\.js" x-data="toggleTableColumn\(\{/);
    assert.match(toggle, /recordKey: '7',\n\s+state: true,/);
    assert.match(toggle, /<input type="hidden" value="1" x-ref="serverState" \/><div aria-checked="true"/);
    assert.match(toggle, / x-cloak role="switch" aria-disabled="true" aria-label="Is featured" wire:loading\.attr="disabled"/);
    assert.match(toggle, /x-bind:class="state \? 'nv-toggle-on nv-color nv-color-primary [^"]*' : 'nv-toggle-off'"/);
    assert.match(toggle, /<div x-cloak="inline-flex" wire:ignore class="nv-toggle nv-toggle-on nv-hidden nv-color nv-color-primary/);
    assert.equal((toggle.match(/nv-size-xs/g) ?? []).length, 2);
    const off = await ToggleColumn.make('is_featured').disabled().toHtml({ is_featured: 0 }, 7);
    assert.ok(!off.includes('x-cloak role') && !off.includes('inline-flex') && off.includes(' disabled="disabled"'));

    const checkbox = await CheckboxColumn.make('is_featured').alignCenter().tooltip('Featured').toHtml({ is_featured: 0 }, 3);
    assert.match(checkbox, /^<div x-on:click\.stop wire:ignore\.self x-load="x-load"/);
    assert.match(checkbox, /class="nv-ta-checkbox nv-align-center"><input type="hidden" value="0" x-ref="serverState" \/><input type="checkbox"/);
    assert.match(checkbox, /x-tooltip="error === undefined \? \{\n\s+content: 'Featured',/);

    const evil = '"><script>alert(1)</script>';
    const input = await TextInputColumn.make('slug').prefix('/').suffixIcon('m-check-circle').suffixIconColor('success').placeholder(evil).toHtml({ slug: evil }, 1);
    assert.ok(!input.includes('<script>'));
    assert.match(input, /<input type="hidden" value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;" x-ref="serverState" \/>/);
    assert.match(input, /<div class="nv-input-wrp-prefix nv-input-wrp-prefix-has-content  nv-input-wrp-prefix-has-label"><span class="nv-input-wrp-label">\/<\/span><\/div>/);
    assert.match(input, /<div class="nv-input-wrp-suffix  "><svg class="nv-color nv-color-success nv-icon nv-size-md"/);
    assert.match(input, /x-on:input="clearError\(\)" placeholder="[^"]*" type="text" x-tooltip=/);
    assert.match(input, /class="nv-input nv-align-start" \/><\/div>/);
    assert.match(await TextInputColumn.make('code').mask('99-99').type('number').toHtml({ code: 12 }, 1), /state: 12,[\s\S]*type="text" x-mask="99-99"/);
});

test('ViewColumn and deprecated aliases', async () => {
    const view = ViewColumn.make<{ name: string }>('name').view(({ state }) => `<b>${String(state).toUpperCase()}</b>`);
    assert.equal(await view.toHtml({ name: 'ada' }), '<b>ADA</b>');
    await assert.rejects(() => ViewColumn.make('x').toHtml({}), /no view declared/);
    assert.equal(await BadgeColumn.make('status').toHtml({ status: 'draft' }), await TextColumn.make('status').badge().toHtml({ status: 'draft' }));
    assert.match(await BooleanColumn.make('ok').toHtml({ ok: 1 }), /nv-ta-icon/);
});

test('SelectColumn: options per record, disabled options refused on the server, JavaScript select', async () => {
    const column = SelectColumn.make<Post>('status')
        .options((record) => (record.title === 'Alpha' ? { draft: 'Draft', reviewing: 'Reviewing' } : { draft: 'Draft', published: 'Published' }))
        .disableOptionWhen((value, _label, record) => value === 'reviewing' && record.title === 'Alpha');
    const table = new Table<Post>().columns([column]);
    const [alpha, beta] = await db('posts').orderBy('id');
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'status', alpha.id, 'published'), { error: 'The selected status is invalid.' });
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'status', alpha.id, 'reviewing'), { error: 'The selected status is invalid.' });
    assert.equal(await updateTableColumnState(table, host(), adapter, 'status', beta.id, 'published'), 'published');
    assert.equal(await updateTableColumnState(table, host(), adapter, 'status', alpha.id, 'draft'), 'draft');
    const native = await column.toHtml(await Post.query().findById(alpha.id) as Post, alpha.id);
    assert.match(native, /<option disabled value="reviewing">Reviewing<\/option>/);
    const searchable = await SelectColumn.make<Post>('status').options({ draft: 'Draft', reviewing: 'Rev <i>' }).searchableOptions().placeholder('Pick one').disableOptionWhen((value) => value === 'reviewing').toHtml(await Post.query().findById(alpha.id) as Post, alpha.id);
    assert.doesNotMatch(searchable, /<select/);
    assert.match(searchable, /<div x-ref="select"><\/div>/);
    assert.match(searchable, /isNative: false/);
    assert.match(searchable, /isSearchable: true/);
    assert.match(searchable, /placeholder: (&#039;|')Pick one/);
    assert.ok(searchable.includes(String.raw`\u0022isDisabled\u0022:true`), 'disabled option sent to the JavaScript select');
    assert.doesNotMatch(searchable, /<i>/, 'option labels are escaped');
});
