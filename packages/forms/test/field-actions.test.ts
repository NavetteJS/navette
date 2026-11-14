import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, HtmlString, e, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { CheckboxList, KeyValue, Repeater, TableColumn, TextInput, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, useColorManager } from '../src/index.ts';
import { Block, Builder } from '../src/builder.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Tag extends Model { static tableName = 'tags'; }
class Post extends Model {
    static tableName = 'posts';
    static get relationMappings() { return { tags: { relation: Model.ManyToManyRelation, modelClass: Tag, join: { from: 'posts.id', through: { from: 'post_tag.post_id', to: 'post_tag.tag_id' }, to: 'tags.id' } } }; }
}
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); });
    await db.schema.createTable('tags', (t) => { t.increments('id'); t.string('name'); t.boolean('archived').defaultTo(false); });
    await db.schema.createTable('post_tag', (t) => { t.integer('post_id'); t.integer('tag_id'); });
    await db('posts').insert([{ title: 'A' }]);
    await db('tags').insert([{ name: '<b>Node</b>', archived: 0 }, { name: 'PHP', archived: 0 }, { name: 'Old', archived: 1 }]);
    await db('post_tag').insert([{ post_id: 1, tag_id: 2 }]);
});
after(() => db.destroy());

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, panel: { colors }, getSchema() { return null as any; }, dispatch() {}, getDataAdapter: () => new ObjectionAdapter(Post) });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const render = async (livewire: any, components: any[]) => (await form(livewire, components).toHtml()).replaceAll('&#039;', "'");
const action = (field: { getActions(): Action[] }, name: string) => field.getActions().find((candidate) => candidate.getName() === name)!;
const call = (field: any, name: string, args: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => action(field, name).call({ livewire: field.livewire, record: null, arguments: args, data });

test('Repeater: customized item actions keep their behavior; a confirmation gives the delete action a modal', async () => {
    const livewire = host({ items: { a: { name: 'A' }, b: { name: 'B' } } });
    const field = Repeater.make('items').schema([TextInput.make('name')]).cloneable()
        .deleteAction((a) => a.requiresConfirmation().label('Remove'))
        .cloneAction((a) => { a.icon('m-document-duplicate').color('primary'); })
        .addAction((a) => a.label('New item').icon('m-plus'));
    const html = await render(livewire, [field]);
    assert.match(html, /<button title="Remove"[^>]*wire:click="mountAction\('delete', JSON\.parse\('\{\\u0022item\\u0022:\\u0022a\\u0022\}'\)/);
    assert.match(html, /<button title="Clone"[^>]*class="fi-ac-icon-btn-action fi-icon-btn fi-size-sm fi-color fi-color-primary/);
    assert.match(html, /<div class="fi-fo-repeater-add"><button type="button"[^>]*>.*New item<\/button>/s);
    assert.equal(action(field, 'delete').hasModal(), true);
    assert.equal(action(field, 'clone').hasModal(), false);
    await call(field, 'delete', { item: 'a' });
    assert.deepEqual(Object.keys(livewire.data.items as object), ['b']);
});

test('Repeater: "Insert between" is hidden by default and inserts after the given item', async () => {
    const livewire = host({ items: { a: { name: 'A' }, b: { name: 'B' } } });
    const plain = Repeater.make('items').schema([TextInput.make('name')]);
    assert.doesNotMatch(await form(livewire, [plain]).toHtml(), /fi-fo-repeater-add-between-items/);
    const field = Repeater.make('items').schema([TextInput.make('name')]).addBetweenAction((a) => a.visible()).addBetweenActionLabel('Insert here');
    const html = await render(livewire, [field]);
    assert.equal(html.match(/fi-fo-repeater-add-between-items-ctn/g)?.length, 1, 'one button between two items');
    assert.match(html, /mountAction\('addBetween', JSON\.parse\('\{\\u0022afterItem\\u0022:\\u0022a\\u0022\}'\)[^"]*"[^>]*>.*Insert here/s);
    assert.equal(field.authorizeActionArguments('addBetween', { afterItem: 'zzz' }), false);
    assert.equal(field.authorizeActionArguments('addBetween', { afterItem: 'a' }), true);
    await call(field, 'addBetween', { afterItem: 'a' });
    const keys = Object.keys(livewire.data.items as object);
    assert.equal(keys.length, 3);
    assert.deepEqual([keys[0], keys[2]], ['a', 'b']);
    assert.deepEqual((livewire.data.items as any)[keys[1]], { name: null });
    // Unknown key: nothing happens, even if the handler is called directly.
    await call(field, 'addBetween', { afterItem: '__proto__' });
    assert.equal(Object.keys(livewire.data.items as object).length, 3);
});

test('Repeater: extra item actions receive the item key, which is checked; getItemState() validates the item', async () => {
    const livewire = host({ items: { a: { email: 'ada@example.com' }, b: { email: 'nope' } } });
    const sent: unknown[] = [];
    let field: Repeater;
    const send = Action.make('send').icon('m-envelope').requiresConfirmation().action(async ({ arguments: args }) => { sent.push((await field.getItemState(args.item)).email); });
    field = Repeater.make('items').schema([TextInput.make('email').email()]).extraItemActions([send]);
    const html = await render(livewire, [field]);
    assert.match(html, /<li x-on:click\.stop><button title="Send" aria-label="Send"[^>]*wire:click="mountAction\('send', JSON\.parse\('\{\\u0022item\\u0022:\\u0022a\\u0022\}'\), JSON\.parse\('\{\\u0022schemaComponent\\u0022:\\u0022form\.items\\u0022\}'\)\)"/);
    assert.equal(field.authorizeActionArguments('send', { item: 'zzz' }), false);
    assert.equal(field.authorizeActionArguments('send', { item: 'b' }), true);
    await call(field, 'send', { item: 'a' });
    assert.deepEqual(sent, ['ada@example.com']);
    await assert.rejects(() => call(field, 'send', { item: 'b' }), /cancelled/i);
    assert.deepEqual(livewire._errors, { 'data.items.b.email': ['The email field must be a valid email address.'] });
    assert.deepEqual(await field.getItemStateSnapshot('b'), { email: 'nope' });
    assert.equal(field.getRawItemState('zzz'), null);
});

test('Repeater: table layout renders extra item actions; a custom reorder action is announced to the browser', async () => {
    const livewire = host({ rows: { a: { name: 'x' }, b: { name: 'y' } } });
    const field = Repeater.make('rows').table([TableColumn.make('Name')]).schema([TextInput.make('name')])
        .extraItemActions([Action.make('flag').icon('m-flag').action(() => {})]).reorderAction((a) => a.requiresConfirmation());
    const html = await render(livewire, [field]);
    assert.match(html, /fi-fo-table-repeater-actions"><div x-on:click\.stop><button title="Flag"/);
    assert.match(html, /hasCustomReorderAction\\u0022:true|hasCustomReorderAction&quot;:true|"hasCustomReorderAction":true/);
});

test('Repeater: collapse and "collapse all" actions take their labels from the actions', async () => {
    const livewire = host({ items: { a: { name: 'A' }, b: { name: 'B' } } });
    const field = Repeater.make('items').schema([TextInput.make('name')]).collapsible()
        .collapseAllAction((a) => a.label('Fold everything')).expandAction((a) => a.label('Open')).expandAllAction((a) => a.hidden());
    const html = await render(livewire, [field]);
    assert.match(html, /Fold everything/);
    assert.match(html, /title="Open"/);
    assert.doesNotMatch(html, /Expand all/);
});

test('Builder: item labels from content, block previews with an edit modal, extra actions and search prompt', async () => {
    const livewire = host({ content: { a: { type: 'heading', data: { text: '<i>Hello</i>' } }, b: { type: 'paragraph', data: { body: 'Text' } } } });
    const heading = Block.make('heading').schema(() => [TextInput.make('text').required()])
        .label(({ state }) => (state === null ? 'Heading' : String(state.text ?? 'Untitled heading')))
        .preview((data) => new HtmlString(`<h1>${e(data.text)}</h1>`));
    const paragraph = Block.make('paragraph').schema(() => [TextInput.make('body')]).preview((data) => `<p>${String(data.body)}</p>`);
    const field = Builder.make('content').blocks([heading, paragraph]).blockPreviews().searchable().searchPrompt(new HtmlString('Find <b>a</b> block &amp; more')).noSearchResultsMessage('Nothing.').searchDebounce(300)
        .extraItemActions([Action.make('copy').icon('m-clipboard').action(() => {})]);
    const html = await render(livewire, [field]);
    assert.match(html, /fi-fo-builder-item-header-label fi-truncated">&lt;i&gt;Hello&lt;\/i&gt; 1</);
    assert.match(html, /<span class="fi-dropdown-list-item-label">Heading<\/span>/);
    assert.match(html, /class="fi-fo-builder-item-content fi-fo-builder-item-content-has-preview"><div class="fi-fo-builder-item-preview"><h1>&lt;i&gt;Hello&lt;\/i&gt;<\/h1><\/div><div class="fi-fo-builder-item-preview-edit-overlay" role="button" x-on:click\.stop="editItem\(/);
    assert.match(html, /<div class="fi-fo-builder-item-preview">&lt;p&gt;Text&lt;\/p&gt;<\/div>/, 'a plain string preview is escaped');
    assert.doesNotMatch(html, /name="data\.content\.a\.data\.text"|wire:model="data\.content\.a\.data\.text"/, 'no form with previews');
    assert.match(html, /placeholder="Find a block &amp; more"/);
    assert.match(html, /x-model\.debounce\.300="search"/);
    assert.match(html, /Nothing\./);
    assert.match(html, /<li x-on:click\.stop><button title="Copy"[^>]*mountAction\('copy'/);
    assert.match(html, /<button title="Edit"[^>]*mountAction\(&#039;edit&#039;|<button title="Edit"[^>]*mountAction\('edit'/);
    // Edit modal: the block's form, filled with the item, saved back into the item.
    const edit = action(field, 'edit');
    assert.equal(edit.hasModal(), true);
    const modal = edit.applySchema(Schema.make(livewire as any).key('mountedActionSchema0').statePath('mountedActions.0.data'), { item: 'a' });
    assert.deepEqual(modal.getComponents().map((c: any) => c.getName()), ['text']);
    assert.deepEqual(await edit.getFormFill({ livewire, record: null, arguments: { item: 'a' }, data: {} }), { text: '<i>Hello</i>' });
    await call(field, 'edit', { item: 'a' }, { text: 'Changed' });
    assert.deepEqual((livewire.data.content as any).a, { type: 'heading', data: { text: 'Changed' } });
    assert.equal(field.authorizeActionArguments('edit', { item: 'nope' }), false);
    // Adding with previews: the new block's form comes first, and its data becomes the item.
    const add = action(field, 'add');
    assert.equal(add.hasModal(), true);
    assert.deepEqual(add.applySchema(Schema.make(livewire as any), { block: 'heading' }).getComponents().map((c: any) => c.getName()), ['text']);
    assert.deepEqual(add.applySchema(Schema.make(livewire as any), { block: 'unknown' }).getComponents(), []);
    await call(field, 'add', { block: 'heading' }, { text: 'New' });
    assert.deepEqual(Object.values(livewire.data.content as object).at(-1), { type: 'heading', data: { text: 'New' } });
});

test('Builder: addBetweenAction(false) and custom item actions; interactive previews have no overlay', async () => {
    const livewire = host({ content: { a: { type: 'note', data: { body: 'x' } }, b: { type: 'note', data: { body: 'y' } } } });
    const note = Block.make('note').schema(() => [TextInput.make('body')]).preview(() => 'note');
    const between = Builder.make('content').blocks([note]).addBetweenAction((a) => a.label('Put a block here')).deleteAction((a) => a.requiresConfirmation()).blockPreviews(true, true);
    let html = await form(livewire, [between]).toHtml();
    assert.match(html, /Put a block here/);
    assert.match(html, /fi-fo-builder-item-preview fi-interactive/);
    assert.doesNotMatch(html, /fi-fo-builder-item-preview-edit-overlay/);
    assert.equal(action(between, 'delete').hasModal(), true);
    html = await form(livewire, [Builder.make('content').blocks([note]).addBetweenAction(false)]).toHtml();
    assert.doesNotMatch(html, /fi-fo-builder-add-between-items/);
    assert.match(html, /wire:model[^ ]*="data\.content\.a\.data\.body"/, 'without previews, the form is rendered');
});

test('KeyValue: add, delete and reorder actions are customizable', async () => {
    const livewire = host({ meta: [{ key: 'a', value: 'b' }] });
    const field = KeyValue.make('meta').reorderable().addAction((a) => a.label('New pair').icon('m-plus')).deleteAction((a) => a.label('Drop').icon('m-x-mark')).reorderAction((a) => a.label('Drag'));
    const html = await render(livewire, [field]);
    assert.match(html, /<span class="fi-link-label">New pair<\/span>/);
    assert.match(html, /title="Drop" aria-label="Drop"/);
    assert.match(html, /title="Drag" aria-label="Drag"/);
    const hidden = await form(livewire, [KeyValue.make('meta').deleteAction((a) => a.hidden()).addAction((a) => a.visible(false))]).toHtml();
    assert.doesNotMatch(hidden, /deleteRow|addRow/);
});

test('CheckboxList: many-to-many relationship options, loading and saving, limited to the query', async () => {
    const livewire = host({ tags: [] });
    const field = CheckboxList.make('tags').relationship('tags', 'name', (query) => query.where('archived', 0)).allowHtml().bulkToggleable()
        .selectAllAction((a) => a.label('Everything')).deselectAllAction((a) => a.label('Nothing').color('danger')).searchable().searchDebounce(250);
    const schema = form(livewire, [field]);
    const post = await Post.query().findById(1);
    await loadSchemaRelationships(schema, livewire.data, post);
    assert.deepEqual(livewire.data.tags, ['2']);
    const html = await schema.toHtml();
    assert.match(html, /<span class="fi-fo-checkbox-list-option-label"><b>Node<\/b><\/span>/);
    assert.match(html, /<span class="fi-fo-checkbox-list-option-label">PHP<\/span>/);
    assert.doesNotMatch(html, />Old</, 'the query excludes archived tags');
    assert.match(html, /Everything/);
    assert.match(html, /fi-ac-link-action fi-link fi-size-sm fi-color fi-color-danger[^"]*"><span class="fi-link-label">Nothing/);
    assert.match(html, /x-model\.debounce\.250="search"/);
    // Relationship fields are saved after the record, not in its data.
    assert.deepEqual(await getSchemaState(schema), {});
    livewire.data.tags = ['1', '3', '999'];
    await saveSchemaRelationships(schema, post);
    assert.deepEqual((await db('post_tag').where('post_id', 1).orderBy('tag_id')).map((row: any) => row.tag_id), [1], 'only tags of the query are linked');
});

test('CheckboxList: allowHtml() sanitizes labels; without it labels are escaped', async () => {
    const livewire = host({ tags: [] });
    const options = { a: '<img src=x onerror=alert(1)><b>Bold</b>' };
    const safe = await form(livewire, [CheckboxList.make('tags').options(options).allowHtml()]).toHtml();
    assert.doesNotMatch(safe, /onerror/);
    assert.match(safe, /<b>Bold<\/b>/);
    const escaped = await form(livewire, [CheckboxList.make('tags').options(options)]).toHtml();
    assert.match(escaped, /&lt;b&gt;Bold&lt;\/b&gt;/);
});

test('icon aliases replace the default icons of the field actions; an icon set on the action wins', async (t) => {
    const { icons, HtmlString } = await import('@navette-js/support');
    t.after(() => icons.alias({ 'forms::components.repeater.actions.delete': null, 'forms::components.builder.actions.edit': null, 'forms::components.key-value.actions.reorder': null }));
    icons.alias({
        'forms::components.repeater.actions.delete': new HtmlString('<svg data-alias="repeater-delete"></svg>'),
        'forms::components.builder.actions.edit': new HtmlString('<svg data-alias="builder-edit"></svg>'),
        'forms::components.key-value.actions.reorder': new HtmlString('<svg data-alias="kv-reorder"></svg>'),
    });
    const livewire = host({ items: { a: { name: 'A' } }, content: { a: { type: 'note', data: {} } }, meta: [] });
    const html = await render(livewire, [
        Repeater.make('items').schema([TextInput.make('name')]),
        Builder.make('content').blocks([Block.make('note').schema(() => [TextInput.make('body')]).preview(() => 'n')]).blockPreviews(),
        KeyValue.make('meta').reorderable(),
    ]);
    assert.match(html, /data-alias="repeater-delete"/);
    assert.match(html, /data-alias="builder-edit"/);
    assert.match(html, /data-alias="kv-reorder"/);
    const custom = await render(livewire, [Repeater.make('items').schema([TextInput.make('name')]).deleteAction((a) => a.icon('m-x-mark'))]);
    assert.doesNotMatch(custom, /data-alias="repeater-delete"/);
});
