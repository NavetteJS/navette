import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ModalTableSelect, TableSelect, TextInput, useColorManager as useFormsColors } from '@navette-js/forms';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { Schema, useColorManager as useSchemasColors } from '@navette-js/schemas';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { TernaryFilter, TextColumn, getTableQuery, useColorManager as useTablesColors, type Table } from '@navette-js/tables';
import { WireError, WireRuntime } from '@navette-js/wire';
import { Panel, Resource, TableSelectComponent, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useSchemasColors(colors); useUiColors(colors); useTablesColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Category extends Model { static tableName = 'categories'; }
class Post extends Model {
    static tableName = 'posts';
    static get relationMappings() {
        return {
            category: { relation: Model.BelongsToOneRelation, modelClass: Category, join: { from: 'posts.category_id', to: 'categories.id' } },
            categories: { relation: Model.ManyToManyRelation, modelClass: Category, join: { from: 'posts.id', through: { from: 'category_post.post_id', to: 'category_post.category_id' }, to: 'categories.id' } },
        };
    }
}
/** Only visible categories can be shown and picked; "Locked" ones cannot be checked. */
class CategoriesTable {
    static configure(table: Table): Table {
        return table
            .columns([TextColumn.make('name').searchable().sortable()])
            .filters([TernaryFilter.make('is_visible')])
            .modifyQueryUsing((query) => { query.where('categories.is_visible', 1); })
            .checkIfRecordIsSelectableUsing((record: any) => record.name !== 'Locked')
            .defaultSort('name');
    }
}
/** Arguments narrow the table: `{ group }` keeps one group. */
class GroupedCategoriesTable {
    static configure(table: Table): Table {
        const group = table.getArguments().group;
        return table.columns([TextColumn.make('name')]).modifyQueryUsing((query) => { if (group) query.where('categories.group', group); });
    }
}
/** A configuration with its own (scoped) adapter: only the categories of tenant 1. */
class TenantCategoriesTable {
    static adapter = new ObjectionAdapter(Category, { modify: (query) => { query.where('categories.tenant', 1); } });
    static configure(table: Table): Table { return table.columns([TextColumn.make('name')]); }
}

class Posts extends Resource {
    static slug = 'posts';
    static adapter = new ObjectionAdapter(Post);
    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title'),
            ModalTableSelect.make('category_id').relationship('category', 'name').tableConfiguration(CategoriesTable).placeholder('None'),
            ModalTableSelect.make('categories').relationship('categories', 'name', (query) => { query.where('categories.group', 'a'); }).multiple().maxItems(3).tableConfiguration(CategoriesTable),
        ]);
    }
}
const panel = Panel.make().id('table-select-test').key('k').resources([Posts]);
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };
const ctx = { panel, user: admin, mailbox: 'table-select', req: { query: {}, headers: {}, get: () => undefined }, res: {} };
const runtime = new WireRuntime({ key: 'test-key' }).register('navette.table-select-test.table-select', TableSelectComponent);
let db: Knex;

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('categories', (table) => { table.increments('id'); table.string('name'); table.integer('is_visible'); table.string('group'); table.integer('tenant'); });
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.integer('category_id'); });
    await db.schema.createTable('category_post', (table) => { table.increments('id'); table.integer('post_id'); table.integer('category_id'); });
    await db('categories').insert([
        { id: 1, name: 'News', is_visible: 1, group: 'a', tenant: 1 },
        { id: 2, name: 'Sport', is_visible: 1, group: 'a', tenant: 2 },
        { id: 3, name: 'Hidden', is_visible: 0, group: 'a', tenant: 1 },
        { id: 4, name: 'Locked', is_visible: 1, group: 'a', tenant: 1 },
        { id: 5, name: 'Music', is_visible: 1, group: 'b', tenant: 1 },
        { id: 6, name: 'Art', is_visible: 1, group: 'a', tenant: 1 },
    ]);
    await db('posts').insert({ id: 1, title: 'Hello', category_id: 1 });
    await db('category_post').insert([{ post_id: 1, category_id: 1 }]);
});
after(() => db.destroy());

/** Edit page of post 1, attached to the runtime so that it mounts the table child component for real. */
const editPage = async () => {
    const EditPage = Posts.getPages().edit as any;
    const page = new EditPage();
    page._id = 'edit';
    page._ctx = ctx;
    page._errors = {};
    page._runtime = runtime;
    await page.mount({ record: '1' });
    return page;
};
/** A form field bound to a plain host, outside any page. */
const field = (component: any, state: Record<string, unknown>, model: any = Post) => {
    const host: any = { id: 'host', data: state, _errors: {}, getDataAdapter: () => ({ model }) };
    Schema.make(host).key('form').statePath('data').components([component]);
    return component;
};
const snapshotOf = (html: string, name: string) => {
    const snapshots = [...html.matchAll(/wire:snapshot="([^"]*)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')));
    return snapshots.find((snapshot) => snapshot.memo.name === name);
};

test('a key outside the table query is refused: hidden, not selectable, missing, or forged in a list', async () => {
    const select = (state: unknown) => field(ModalTableSelect.make('category_id').relationship('category', 'name').tableConfiguration(CategoriesTable), { category_id: state });
    assert.deepEqual(await select('1').validate(), []);
    assert.deepEqual(await select(null).validate(), []);
    // Hidden by the table's query, refused by `checkIfRecordIsSelectableUsing()`, or missing: all forged keys.
    for (const forged of ['3', '4', '999', ['1'], { id: 1 }]) assert.deepEqual(await select(forged).validate(), ['The selected category is invalid.'], JSON.stringify(forged));
    // Filters chosen in the table only narrow what is displayed: they do not change what can be saved.
    assert.deepEqual(await select('2').validate(), []);
});

test('the relationship query, the table arguments and the configuration adapter (tenant) also restrict the keys', async () => {
    const many = (state: unknown) => field(ModalTableSelect.make('categories').relationship('categories', 'name', (query) => { query.where('categories.group', 'a'); }).multiple().tableConfiguration(CategoriesTable), { categories: state });
    assert.deepEqual(await many(['1', '2']).validate(), []);
    assert.deepEqual(await many(['1', '5']).validate(), ['The selected categories is invalid.'], 'group b is outside the relationship query');
    const grouped = (state: unknown, group: string) => field(TableSelect.make('category_id').relationship('category').tableConfiguration(GroupedCategoriesTable).tableArguments({ group }), { category_id: state });
    assert.deepEqual(await grouped('5', 'b').validate(), []);
    assert.deepEqual(await grouped('5', 'a').validate(), ['The selected category is invalid.']);
    // No relationship: the configuration's own adapter is the scope.
    const tenant = (state: unknown) => field(TableSelect.make('category').tableConfiguration(TenantCategoriesTable), { category: state });
    assert.deepEqual(await tenant('1').validate(), []);
    assert.deepEqual(await tenant('2').validate(), ['The selected category is invalid.'], 'another tenant\'s record');
});

test('multiple(): item limits, and many-to-many saving links only the allowed keys', async () => {
    const many = (state: unknown) => field(ModalTableSelect.make('categories').relationship('categories', 'name').multiple().minItems(2).maxItems(2).tableConfiguration(CategoriesTable), { categories: state });
    assert.deepEqual(await many(['1']).validate(), ['The categories field must have at least 2 items.']);
    assert.deepEqual(await many(['1', '2', '6']).validate(), ['The categories field must not have more than 2 items.']);
    const post = await Post.query().findById(1);
    const component = many(['2', '3', '6']);
    assert.equal(await component.savesRelationships(), true);
    assert.deepEqual((await component.loadStateFromRelationships(post)).state, ['1']);
    // Saved without validation (a bug elsewhere, or a forged state): the hidden category is still not linked.
    await component.saveRelationships(post);
    assert.deepEqual((await db('category_post').where('post_id', 1).orderBy('category_id')).map((row) => row.category_id), [2, 6]);
    await db('category_post').where('post_id', 1).delete();
    await db('category_post').insert({ post_id: 1, category_id: 1 });
});

test('labels from the title attribute or from the record, as text or badges', async () => {
    const single = field(ModalTableSelect.make('category_id').relationship('category', 'name').tableConfiguration(CategoriesTable), { category_id: '6' });
    assert.equal(await single.getOptionLabel(), 'Art');
    let html = await single.toHtml();
    assert.match(html, /class="fi-fo-modal-table-select"/);
    assert.match(html, /<div>Art<\/div>/);
    assert.match(html, /mountAction\('select', \{\}, [^"]*form\.category_id/);
    assert.match(html, /fi-ac-icon-btn-action/, 'an icon button once something is selected');
    const many = field(ModalTableSelect.make('categories').relationship('categories').multiple().getOptionLabelFromRecordUsing((record) => `#${record.id} ${record.name}`).badgeColor('success').tableConfiguration(CategoriesTable), { categories: ['6', '1'] });
    assert.deepEqual(await many.getOptionLabels(), [['6', '#6 Art'], ['1', '#1 News']]);
    html = await many.toHtml();
    assert.match(html, /fi-fo-modal-table-select-multiple/);
    assert.equal([...html.matchAll(/class="fi-badge fi-size-md[^"]*fi-color-success/g)].length, 2);
    assert.match(html, /fi-ac-link-action/);
    const empty = field(ModalTableSelect.make('category_id').relationship('category', 'name').placeholder('<None>').tableConfiguration(CategoriesTable), { category_id: null });
    assert.match(await empty.toHtml(), /fi-fo-modal-table-select-placeholder">&lt;None&gt;</);
    const escaped = field(ModalTableSelect.make('category_id').getOptionLabelUsing(() => '<b>x</b>').tableConfiguration(TenantCategoriesTable), { category_id: '1' });
    assert.match(await escaped.toHtml(), /&lt;b&gt;x&lt;\/b&gt;/);
    await assert.rejects(field(TableSelect.make('x'), { x: '1' }).validate(), /tableConfiguration\(\)/);
});

test('the "Select" action opens the table in a slide-over, and its submit copies the checked key into the field', async () => {
    const page = await editPage();
    assert.equal(page.data.category_id, '1');
    await page.mountAction('select', {}, { schemaComponent: 'form.category_id' });
    const modal = String(page._effects.partials['action-modals']);
    assert.match(modal, /fi-modal-slide-over/);
    // The child table: checkboxes bound to the modal's `selection`, with its own snapshot.
    assert.match(modal, /wire:model="\$parent\.mountedActions\.0\.data\.selection"/);
    assert.match(modal, /x-modelable="\$wire\.state"/);
    assert.match(modal, /currentSelectionLivewireProperty: 'state'/);
    assert.equal([...modal.matchAll(/class="fi-ta-record-checkbox/g)].length, 4, 'News, Sport, Art and nothing hidden; Locked has no checkbox');
    assert.deepEqual(page.mountedActions[0].data, { selection: '1' });
    // A forged selection is refused by the modal's TableSelect.
    page.mountedActions[0].data.selection = '3';
    await runInRequest('table-select', () => page.callMountedAction());
    assert.deepEqual(page._errors['mountedActions.0.data.selection'], ['The selected category is invalid.']);
    page.mountedActions[0].data.selection = '6';
    await runInRequest('table-select', () => page.callMountedAction());
    assert.equal(page.mountedActions.length, 0);
    assert.equal(page.data.category_id, '6');
    // Saving the form stores the key, after checking it again.
    page.data.categories = ['2'];
    await runInRequest('table-select', () => page.save());
    assert.deepEqual(page._errors, {});
    assert.equal((await db('posts').where('id', 1).first()).category_id, 6);
    assert.deepEqual((await db('category_post').where('post_id', 1)).map((row) => row.category_id), [2]);
    page.data.category_id = '3';
    await runInRequest('table-select', () => page.save());
    assert.deepEqual(page._errors['data.category_id'], ['The selected category is invalid.']);
    assert.equal((await db('posts').where('id', 1).first()).category_id, 6);
});

test('the table child component: locked props, search, select all within the limits, missing definition', async () => {
    const page = await editPage();
    await page.mountAction('select', {}, { schemaComponent: 'form.categories' });
    const modal = String(page._effects.partials['action-modals']);
    const snapshot = snapshotOf(modal, 'navette.table-select-test.table-select');
    assert.deepEqual(snapshot.memo.bindings, { 'mountedActions.0.data.selection': 'state' });
    assert.equal(snapshot.data.maxSelectableRecords, 3);
    // The partial render records the new child, so the next render keeps it instead of mounting another one.
    assert.ok(Object.keys(page._children).some((key) => key.endsWith('mountedActionSchema0.selection')));
    // The browser cannot change the table definition, the limit or the arguments.
    for (const locked of ['definition', 'maxSelectableRecords', 'tableArguments', 'isMultiple']) {
        await assert.rejects(runtime.update(snapshot, { [locked]: locked === 'definition' ? 'Other.0' : 99 }, [], ctx), (error: WireError) => error.status === 403, locked);
    }
    await assert.rejects(runtime.update(snapshot, { isDisabled: true }, [], ctx), (error: WireError) => error.status === 403, 'reactive');
    const searched = await runtime.update(snapshot, { tableSearch: 'spo' }, [], ctx);
    assert.match(String(searched.effects.html), />\s*Sport\s*</);
    assert.doesNotMatch(String(searched.effects.html), />\s*News\s*</);
    assert.match(String(searched.effects.html), /wire:model="\$parent\.mountedActions\.0\.data\.selection"/, 'the binding survives re-renders');
    // "Select all": visible, selectable, in the relationship's group, and no more than the limit.
    const all = await runtime.update(snapshot, {}, [{ method: 'getAllSelectableTableRecordKeys', params: [] }], ctx);
    assert.deepEqual((all.effects.returns as string[][])[0].sort(), ['1', '2', '6']);
    // Reordering is not available from this table (the call does nothing).
    assert.deepEqual((await runtime.update(snapshot, {}, [{ method: 'reorderTable', params: [['2', '1']] }], ctx)).effects.returns, [null]);
    // A definition that is not registered in this process (the server restarted): the page must be reloaded.
    const unknown = { ...snapshot, data: { ...snapshot.data, definition: 'Gone.0' } };
    unknown.checksum = runtime.checksum(unknown);
    await assert.rejects(runtime.update(unknown, {}, [], ctx), (error: WireError) => error.status === 419);
});

test('TableSelect renders the table in the form, bound to the field state', async () => {
    class Inline extends Resource {
        static slug = 'inline';
        static adapter = new ObjectionAdapter(Post);
        static form(schema: Schema): Schema { return schema.components([TableSelect.make('category_id').relationship('category').tableConfiguration(CategoriesTable)]); }
    }
    const inlinePanel = Panel.make().id('table-select-test').key('k').resources([Inline]);
    const EditPage = Inline.getPages().edit as any;
    const page = new EditPage();
    Object.assign(page, { _id: 'inline', _ctx: { ...ctx, panel: inlinePanel }, _errors: {}, _runtime: runtime });
    await page.mount({ record: '1' });
    const html = await page.getSchema('form').toHtml();
    assert.match(html, /role="group"/);
    assert.match(html, /wire:model="\$parent\.data\.category_id"/);
    const child = snapshotOf(html, 'navette.table-select-test.table-select');
    assert.equal(child.data.state, '6');
    assert.equal(child.data.maxSelectableRecords, 1);
    assert.doesNotMatch(html, /fi-ta-page-checkbox/, 'a single selection has no "select page" checkbox');
});

test('Table.modifyQueryUsing() and arguments(): applied by getTableQuery()', async () => {
    const { Table } = await import('@navette-js/tables');
    const table = new Table().arguments({ group: 'b' });
    GroupedCategoriesTable.configure(table);
    assert.deepEqual(table.getArguments(), { group: 'b' });
    const query = getTableQuery(table, { id: 'x', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 } });
    assert.equal(query.modifiers?.length, 1);
    const rows = await new ObjectionAdapter(Category).listKeys(query);
    assert.deepEqual(rows, ['5']);
});
