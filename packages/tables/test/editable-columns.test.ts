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

test('validation : règles Laravel, messages anglais, valeur vide, plusieurs erreurs', () => {
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
    // Comme Laravel : un texte non numérique est mesuré en caractères par `max`.
    assert.equal(rating.validate('abc'), 'The note field must be a number.');
    assert.equal(rating.validate('abcdefghijkl'), 'The note field must be a number. (and 1 more error)');
    assert.equal(rating.validationMessages({ numeric: 'Un nombre, svp.' }).validate('abcdefghijkl'), 'Un nombre, svp. (and 1 more error)');
    assert.equal(TextInputColumn.make('code').rules([{ name: 'even', passes: (v) => Number(v) % 2 === 0, message: (a) => `The ${a} must be even.` }]).validate('3'), 'The code must be even.');
    assert.throws(() => TextInputColumn.make('x').rules(['regex:/a/']));
    const select = SelectColumn.make('status').options({ draft: 'Draft', published: 'Published' });
    assert.equal(select.validate('archived'), 'The selected status is invalid.');
    assert.equal(select.validate(['draft']), 'The selected status is invalid.');
    assert.equal(select.validate('draft'), null);
    assert.equal(select.required().validate(''), 'The status field is required.');
});

test('valeur écrite : vide → null, booléen normalisé pour l\'interrupteur et la case à cocher', () => {
    assert.equal(ToggleColumn.make('a').castState('1'), true);
    assert.equal(CheckboxColumn.make('a').castState(0), false);
    assert.equal(CheckboxColumn.make('a').castState(null), null);
    assert.equal(TextInputColumn.make('a').castState('  '), null);
    assert.equal(TextInputColumn.make('a').castState('x'), 'x');
});

test('updateTableColumnState : colonne, enregistrement, droits et valeur revérifiés côté serveur', async () => {
    const calls: string[] = [];
    const table = new Table<Post>().columns([
        TextColumn.make('title'),
        ToggleColumn.make<Post>('is_featured').beforeStateUpdated(({ state }) => { calls.push(`before:${state}`); }).afterStateUpdated(({ state, record }) => { calls.push(`after:${state}:${record.id}`); }),
        TextInputColumn.make<Post>('rating').rules(['integer']).disabled((record) => record.id === 2).toggleable(),
        TextInputColumn.make<Post>('author.name'),
    ]);
    const unavailable = { error: t('filament-tables::table.columns.editable.unavailable') };
    // Colonne non modifiable, inconnue, masquée par l'utilisateur, ou de relation sans écriture personnalisée.
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'title', 1, 'Hacked'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'secret', 1, 'x'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host({ tableColumns: [{ type: 'column', name: 'rating', label: 'Rating', isHidden: false, isToggled: false, isToggleable: true, isToggledHiddenByDefault: false }] }), adapter, 'rating', 1, '4'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'author.name', 1, 'Ada'), unavailable);
    // Clé forgée, enregistrement désactivé pour la colonne, utilisateur non autorisé.
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'is_featured', { id: 1 }, true), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'is_featured', 99, true), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'rating', 2, '4'), unavailable);
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'is_featured', 1, true, { authorize: () => false }), unavailable);
    // Valeur invalide : rien n'est écrit.
    assert.deepEqual(await updateTableColumnState(table, host(), adapter, 'rating', 1, '4.5'), { error: 'The rating field must be an integer.' });
    assert.equal((await db('posts').where('id', 1).first()).rating, 3);
    assert.deepEqual(calls, []);
    // Valeur valide : crochets avant / après, écriture de la seule colonne déclarée.
    assert.equal(await updateTableColumnState(table, host(), adapter, 'is_featured', '1', '1', { authorize: async () => true }), true);
    assert.deepEqual(calls, ['before:true', 'after:true:1']);
    assert.equal((await db('posts').where('id', 1).first()).is_featured, 1);
    assert.equal(await updateTableColumnState(table, host(), adapter, 'rating', 1, ''), null);
    assert.equal((await db('posts').where('id', 1).first()).rating, null);
});

test('updateStateUsing remplace l\'écriture ; afterStateUpdated est appelé même en cas d\'erreur', async () => {
    const seen: unknown[] = [];
    const column = TextInputColumn.make<Post>('author.name').updateStateUsing(({ state, record }) => { seen.push([state, record.id]); return 'ok'; }).afterStateUpdated(() => { seen.push('after'); });
    const table = new Table<Post>().columns([column]);
    assert.equal(await updateTableColumnState(table, host(), adapter, 'author.name', 2, 'Ada'), 'ok');
    assert.deepEqual(seen, [['Ada', 2], 'after']);
    const failing = TextInputColumn.make<Post>('title').updateStateUsing(() => { throw new Error('boom'); }).afterStateUpdated(() => { seen.push('after-failure'); });
    await assert.rejects(() => updateTableColumnState(new Table<Post>().columns([failing]), host(), adapter, 'title', 2, 'x'), /boom/);
    assert.equal(seen.at(-1), 'after-failure');
});

test('rendu : balisage des composants Alpine de Filament, valeurs échappées', async () => {
    const toggle = await ToggleColumn.make('is_featured').onIcon('m-check').toHtml({ is_featured: 1 }, 7);
    assert.match(toggle, /^<div wire:ignore\.self x-load="x-load" x-load-src="\/js\/filament\/tables\/components\/columns\/toggle\.js" x-data="toggleTableColumn\(\{/);
    assert.match(toggle, /recordKey: '7',\n\s+state: true,/);
    assert.match(toggle, /<input type="hidden" value="1" x-ref="serverState" \/><div aria-checked="true"/);
    assert.match(toggle, / x-cloak role="switch" aria-disabled="true" aria-label="Is featured" wire:loading\.attr="disabled"/);
    assert.match(toggle, /x-bind:class="state \? 'fi-toggle-on fi-color fi-color-primary [^"]*' : 'fi-toggle-off'"/);
    assert.match(toggle, /<div x-cloak="inline-flex" wire:ignore class="fi-toggle fi-toggle-on fi-hidden fi-color fi-color-primary/);
    assert.equal((toggle.match(/fi-size-xs/g) ?? []).length, 2);
    const off = await ToggleColumn.make('is_featured').disabled().toHtml({ is_featured: 0 }, 7);
    assert.ok(!off.includes('x-cloak role') && !off.includes('inline-flex') && off.includes(' disabled="disabled"'));

    const checkbox = await CheckboxColumn.make('is_featured').alignCenter().tooltip('Mise en avant').toHtml({ is_featured: 0 }, 3);
    assert.match(checkbox, /^<div x-on:click\.stop wire:ignore\.self x-load="x-load"/);
    assert.match(checkbox, /class="fi-ta-checkbox fi-align-center"><input type="hidden" value="0" x-ref="serverState" \/><input type="checkbox"/);
    assert.match(checkbox, /x-tooltip="error === undefined \? \{\n\s+content: 'Mise en avant',/);

    const evil = '"><script>alert(1)</script>';
    const input = await TextInputColumn.make('slug').prefix('/').suffixIcon('m-check-circle').suffixIconColor('success').placeholder(evil).toHtml({ slug: evil }, 1);
    assert.ok(!input.includes('<script>'));
    assert.match(input, /<input type="hidden" value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;" x-ref="serverState" \/>/);
    assert.match(input, /<div class="fi-input-wrp-prefix fi-input-wrp-prefix-has-content  fi-input-wrp-prefix-has-label"><span class="fi-input-wrp-label">\/<\/span><\/div>/);
    assert.match(input, /<div class="fi-input-wrp-suffix  "><svg class="fi-color fi-color-success fi-icon fi-size-md"/);
    assert.match(input, /x-on:input="clearError\(\)" placeholder="[^"]*" type="text" x-tooltip=/);
    assert.match(input, /class="fi-input fi-align-start" \/><\/div>/);
    assert.match(await TextInputColumn.make('code').mask('99-99').type('number').toHtml({ code: 12 }, 1), /state: 12,[\s\S]*type="text" x-mask="99-99"/);
});

test('ViewColumn et alias dépréciés', async () => {
    const view = ViewColumn.make<{ name: string }>('name').view(({ state }) => `<b>${String(state).toUpperCase()}</b>`);
    assert.equal(await view.toHtml({ name: 'ada' }), '<b>ADA</b>');
    await assert.rejects(() => ViewColumn.make('x').toHtml({}), /aucune vue/);
    assert.equal(await BadgeColumn.make('status').toHtml({ status: 'draft' }), await TextColumn.make('status').badge().toHtml({ status: 'draft' }));
    assert.match(await BooleanColumn.make('ok').toHtml({ ok: 1 }), /fi-ta-icon/);
});
