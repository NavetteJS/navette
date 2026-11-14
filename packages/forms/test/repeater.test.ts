import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Repeater, TableColumn, TextInput, fillSchemaFromRecord, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Comment extends Model { static tableName = 'comments'; }
class Post extends Model {
    static tableName = 'posts';
    static get relationMappings() { return { comments: { relation: Model.HasManyRelation, modelClass: Comment, join: { from: 'posts.id', to: 'comments.post_id' } } }; }
}
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); });
    await db.schema.createTable('comments', (t) => { t.increments('id'); t.integer('post_id'); t.string('body'); t.integer('sort'); });
    await db('posts').insert([{ title: 'A' }, { title: 'B' }]);
    await db('comments').insert([{ post_id: 1, body: 'first', sort: 2 }, { post_id: 1, body: 'second', sort: 1 }, { post_id: 2, body: 'other post', sort: 1 }]);
});
after(() => db.destroy());

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {}, getDataAdapter: () => new ObjectionAdapter(Post) });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const act = async (field: Repeater, name: string, args: Record<string, unknown> = {}) => (field.getActions().find((action) => action.getName() === name) as any).call({ livewire: field.livewire, record: null, arguments: args, data: {} });

test('Repeater: stacked cards with labels, numbers, collapse, clone and grid', async () => {
    const livewire = host({ members: { a: { name: 'Ada', role: 'dev' }, b: { name: '<b>Bob</b>', role: 'ops' } } });
    const field = Repeater.make('members').schema([TextInput.make('name'), TextInput.make('role')])
        .itemLabel(({ state }) => (state.name as string) ?? null).itemNumbers().collapsed().cloneable().grid(2);
    const html = await form(livewire, [field]).toHtml();
    assert.match(html, /class="nv-fo-repeater nv-collapsible"/);
    assert.match(html, /nv-fo-repeater-item-header-label nv-truncated">Ada 1<\/h4>/);
    assert.match(html, /&lt;b&gt;Bob&lt;\/b&gt; 2/);
    assert.match(html, /isCollapsed.{1,12}true/);
    assert.match(html, /nv-grid-cols/);
    assert.match(html, /Collapse all/);
    await act(field, 'clone', { item: 'a' });
    assert.equal(Object.keys(livewire.data.members as object).length, 3);
    assert.deepEqual(Object.values(livewire.data.members as object)[1], { name: 'Ada', role: 'dev' });
});

test('Repeater: addable(false), deletable(false), minItems() are enforced on the server', async () => {
    const livewire = host({ items: { a: { name: 'x' } } });
    const field = Repeater.make('items').schema([TextInput.make('name')]).addable(false).deletable(false).minItems(2);
    const schema = form(livewire, [field]);
    await act(field, 'add');
    await act(field, 'delete', { item: 'a' });
    assert.deepEqual(Object.keys(livewire.data.items as object), ['a']);
    assert.deepEqual(await validateSchema(schema), { 'data.items': ['The items field must have at least 2 items.'] });
    const html = await schema.toHtml();
    assert.doesNotMatch(html, /nv-fo-repeater-add/);
    assert.doesNotMatch(html, /m-trash|Delete/);
});

test('Repeater: simple() saves a list of values', async () => {
    const livewire = host({});
    const field = Repeater.make('emails').simple(TextInput.make('email').email().required());
    const schema = form(livewire, [field]);
    fillSchemaFromRecord(schema, livewire.data, { emails: ['a@example.com', 'b@example.com'] });
    assert.equal(Object.keys(livewire.data.emails as object).length, 2);
    assert.deepEqual(await getSchemaState(schema), { emails: ['a@example.com', 'b@example.com'] });
    const html = await schema.toHtml();
    assert.match(html, /class="nv-fo-simple-repeater"/);
    (Object.values(livewire.data.emails as object)[0] as any).email = 'nope';
    assert.deepEqual(Object.values(await validateSchema(schema)), [['The email field must be a valid email address.']]);
});

test('Repeater: table() layout is unchanged', async () => {
    const html = await form(host({ rows: { a: { name: 'x' } } }), [Repeater.make('rows').table([TableColumn.make('Name')]).schema([TextInput.make('name')])]).toHtml();
    assert.match(html, /class="nv-fo-table-repeater"/);
});

test('Repeater: has-many relationship is loaded in order and synced after save', async () => {
    const livewire = host({});
    const schema = form(livewire, [TextInput.make('title'), Repeater.make('comments').relationship().orderColumn('sort').schema([TextInput.make('body').required()])]);
    const post = await Post.query().findById(1);
    fillSchemaFromRecord(schema, livewire.data, { ...post });
    await loadSchemaRelationships(schema, livewire.data, post);
    assert.deepEqual(Object.values(livewire.data.comments as object).map((item: any) => item.body), ['second', 'first']);
    // The relationship and its items are not in the saved data.
    assert.deepEqual(await getSchemaState(schema), { title: 'A' });
    // Edit the first, drop the second, add one; a forged key of another post's comment is treated as new.
    const keys = Object.keys(livewire.data.comments as object);
    livewire.data.comments = { [keys[0]]: { body: 'second (edited)' }, new1: { body: 'third' }, 'record-3': { body: 'hijack' } };
    await saveSchemaRelationships(schema, post);
    assert.deepEqual((await db('comments').where('post_id', 1).orderBy('sort')).map((row: any) => [row.body, row.sort]), [['second (edited)', 1], ['third', 2], ['hijack', 3]]);
    assert.equal((await db('comments').where('id', 3).first()).body, 'other post');
});

test('Builder: block maxItems(), searchable picker, collapsible, addable/deletable', async () => {
    const { Block, Builder } = await import('../src/builder.ts');
    const livewire = host({ content: { a: { type: 'heading', data: { text: 'Hi' } } } });
    const field = Builder.make('content').blocks([Block.make('heading').maxItems(1).schema(() => [TextInput.make('text')]), Block.make('paragraph').schema(() => [TextInput.make('body')])])
        .searchable().collapsible().deletable(false).minItems(2);
    const schema = form(livewire, [field]);
    const html = await schema.toHtml();
    assert.match(html, /x-data="blockPicker\(\)"/);
    assert.match(html, /data-block-label="paragraph"/);
    assert.doesNotMatch(html, /data-block-label="heading"/);
    assert.match(html, /nv-fo-builder-item-header-collapse-action/);
    assert.doesNotMatch(html, /m-trash|>Delete</);
    assert.deepEqual(await validateSchema(schema), { 'data.content': ['The content field must have at least 2 items.'] });
    const call = (name: string, args: Record<string, unknown>) => (field.getActions().find((action) => action.getName() === name) as any).call({ livewire, record: null, arguments: args, data: {} });
    await call('add', { block: 'heading' });
    await call('delete', { item: 'a' });
    assert.deepEqual(Object.values(livewire.data.content as object).map((item: any) => item.type), ['heading']);
    await call('add', { block: 'paragraph' });
    assert.deepEqual(Object.values(livewire.data.content as object).map((item: any) => item.type), ['heading', 'paragraph']);
});

test('Repeater: reorderable(false) stops all reordering; unsafe item links are dropped in the table layout', async () => {
    const livewire = host({ rows: { a: { name: 'x' }, b: { name: 'y' } } });
    const field = Repeater.make('rows').schema([TextInput.make('name')]).reorderable(false).reorderableWithButtons();
    form(livewire, [field]);
    await act(field, 'moveDown', { item: 'a' });
    await act(field, 'reorder', { items: ['b', 'a'] });
    assert.deepEqual(Object.keys(livewire.data.rows as object), ['a', 'b']);
    const dragOnly = Repeater.make('rows').schema([TextInput.make('name')]).reorderableWithDragAndDrop(false).reorderableWithButtons();
    form(livewire, [dragOnly]);
    await act(dragOnly, 'reorder', { items: ['b', 'a'] });
    assert.deepEqual(Object.keys(livewire.data.rows as object), ['a', 'b']);
    await act(dragOnly, 'moveDown', { item: 'a' });
    assert.deepEqual(Object.keys(livewire.data.rows as object), ['b', 'a']);
    const table = await form(host({ rows: { a: { name: 'javascript:alert(1)' } } }), [Repeater.make('rows').table([TableColumn.make('Name')]).schema([TextInput.make('name')]).extraItemLink(({ item }) => ({ label: 'Open', icon: 'm-link', url: String(item.name) }))]).toHtml();
    assert.doesNotMatch(table, /href="javascript:/);
});
