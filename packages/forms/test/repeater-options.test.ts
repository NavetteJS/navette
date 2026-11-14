import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { Group, Schema, Section, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Checkbox, CheckboxList, ItemsProcessingLimitError, KeyValue, Radio, Repeater, Select, TableColumn, TextInput, Toggle, ToggleButtons, fillSchemaFromRecord, generateItemKey, getParentRepeaterItem, siblingDistinctRules, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, useColorManager, validateSchema } from '../src/index.ts';
import { Block, Builder } from '../src/builder.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Line extends Model { static tableName = 'lines'; }
class Invoice extends Model {
    static tableName = 'invoices';
    static get relationMappings() { return { lines: { relation: Model.HasManyRelation, modelClass: Line, join: { from: 'invoices.id', to: 'lines.invoice_id' } } }; }
}
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('invoices', (t) => { t.increments('id'); t.string('number'); });
    await db.schema.createTable('lines', (t) => { t.increments('id'); t.integer('invoice_id'); t.string('label'); t.string('grp'); t.integer('qty'); t.string('note'); t.integer('sort'); });
    await db('invoices').insert([{ number: 'INV-1' }]);
    await db('lines').insert([
        { invoice_id: 1, label: 'Start A', grp: 'start', qty: 1, sort: 1 },
        { invoice_id: 1, label: 'End A', grp: 'end', qty: 2, sort: 2 },
        { invoice_id: 1, label: 'Start B', grp: 'start', qty: 3, sort: 3 },
    ]);
});
after(() => db.destroy());

const host = (data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {}, getDataAdapter: () => new ObjectionAdapter(Invoice), ...extra });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const act = async (field: any, name: string, args: Record<string, unknown> = {}) => (field.getActions().find((action: any) => action.getName() === name) as any).call({ livewire: field.livewire, record: null, arguments: args, data: {} });

test('Repeater relationship: modifyRecordsUsing, mutate hooks and after hooks', async () => {
    const events: string[] = [];
    const livewire = host({});
    const start = Repeater.make('startLines')
        .relationship('lines', null, { modifyRecordsUsing: (records) => records.filter((record) => record.grp === 'start') })
        .orderColumn('sort')
        .schema([TextInput.make('label'), TextInput.make('qty')])
        .mutateRelationshipDataBeforeFillUsing(({ data }) => ({ ...data, label: String(data.label).toUpperCase() }))
        .mutateRelationshipDataBeforeCreateUsing(({ data }) => (data.label === 'skip' ? null : { ...data, grp: 'start', note: 'created' }))
        .mutateRelationshipDataBeforeSaveUsing(({ data, record }) => ({ ...data, note: `was ${record.label}` }))
        .afterCreate(({ data, record }) => { events.push(`created ${data.label} #${record.id}`); })
        .afterUpdate(({ record }) => { events.push(`updated #${record.id} ${record.note}`); })
        .afterDelete(({ record }) => { events.push(`deleted ${record.label}`); });
    const schema = form(livewire, [TextInput.make('number'), start]);
    const invoice = await Invoice.query().findById(1);
    fillSchemaFromRecord(schema, livewire.data, { ...invoice });
    await loadSchemaRelationships(schema, livewire.data, invoice);
    // Only the "start" lines, in order, filled through the hook.
    assert.deepEqual(livewire.data.startLines, { 'record-1': { label: 'START A', qty: 1 }, 'record-3': { label: 'START B', qty: 3 } });
    // Keep line 1, remove line 3 (an "end" line is out of reach), add two (one skipped by the create hook).
    livewire.data.startLines = { 'record-1': { label: 'Start A2', qty: 5 }, n1: { label: 'New', qty: 7 }, n2: { label: 'skip', qty: 0 }, 'record-2': { label: 'hijack', qty: 9 } };
    await saveSchemaRelationships(schema, invoice);
    const rows = await db('lines').orderBy('id');
    assert.deepEqual(rows.map((row: any) => [row.id, row.label, row.grp, row.qty, row.note, row.sort]), [
        [1, 'Start A2', 'start', 5, 'was Start A', 1],
        [2, 'End A', 'end', 2, null, 2],
        [4, 'New', 'start', 7, 'created', 2],
        [5, 'hijack', 'start', 9, 'created', 4],
    ]);
    assert.deepEqual(events, ['deleted Start B', 'updated #1 was Start A', 'created New #4', 'created hijack #5']);
    // Returning `null` from the save hook leaves the record as is.
    start.mutateRelationshipDataBeforeSaveUsing(() => null);
    livewire.data.startLines = { 'record-1': { label: 'ignored', qty: 0 }, 'record-4': { label: 'New', qty: 7 }, 'record-5': { label: 'hijack', qty: 9 } };
    await saveSchemaRelationships(schema, invoice);
    assert.equal((await db('lines').where('id', 1).first()).label, 'Start A2');
});

test('TableColumn header options and compact table repeaters', async () => {
    const livewire = host({ rows: { a: { name: 'x', role: 'y' } } });
    const field = Repeater.make('rows').compact().table([
        TableColumn.make('Name').markAsRequired().wrapHeader().alignment('center').width(200).verticalAlignment('start'),
        TableColumn.make('Role').hiddenHeaderLabel(),
    ]).schema([TextInput.make('name'), TextInput.make('role')]);
    const html = await form(livewire, [field]).toHtml();
    assert.match(html, /class="fi-fo-table-repeater fi-compact"/);
    assert.match(html, /<th scope="col" class="fi-wrapped fi-align-center" style="width: 200px;">Name<sup class="fi-fo-table-repeater-header-required-mark">\*<\/sup><\/th>/);
    assert.match(html, /<th scope="col"><span class="fi-sr-only">Role<\/span><\/th>/);
    assert.match(html, /<td class="fi-vertical-align-start">/);
    const plain = await form(host({ rows: { a: { name: 'x' } } }), [Repeater.make('rows').table([TableColumn.make('Name')]).schema([TextInput.make('name')])]).toHtml();
    assert.match(plain, /class="fi-fo-table-repeater"/);
    assert.match(plain, /<th scope="col">Name<\/th>/);
});

test('generateUuidUsing() and fake(): numeric keys for Repeater and Builder, restored afterwards', async () => {
    assert.equal(generateItemKey(false, ['0', '1', 'x']), '2');
    assert.equal(generateItemKey(() => null, []), '0');
    assert.equal(generateItemKey(() => 'custom', []), 'custom');
    assert.match(generateItemKey(null, []), /^[0-9a-f-]{36}$/);
    const undo = Repeater.fake();
    const undoBuilder = Builder.fake();
    assert.equal(Repeater.isFake(), true);
    assert.equal(Builder.isFake(), true);
    try {
        const livewire = host({});
        const repeater = Repeater.make('quotes').schema([TextInput.make('content')]).defaultItems(2);
        const builder = Builder.make('content').blocks([Block.make('heading').schema([TextInput.make('text')])]);
        form(livewire, [repeater, builder]);
        assert.deepEqual(Object.keys(repeater.getDefaultState() as object), ['0', '1']);
        assert.deepEqual(Object.keys(repeater.hydrateState([{ content: 'a' }, { content: 'b' }]) as object), ['0', '1']);
        livewire.data.quotes = repeater.hydrateState([{ content: 'a' }, { content: 'b' }]);
        await act(repeater, 'add');
        assert.deepEqual(Object.keys(livewire.data.quotes as object), ['0', '1', '2']);
        livewire.data.content = builder.hydrateState([{ type: 'heading', data: { text: 'Hi' } }]);
        assert.deepEqual(livewire.data.content, { 0: { type: 'heading', data: { text: 'Hi' } } });
        await act(builder, 'add', { block: 'heading' });
        assert.deepEqual(Object.keys(livewire.data.content as object), ['0', '1']);
    } finally { undo(); undoBuilder(); }
    // Undoing twice is harmless.
    undo();
    assert.equal(Repeater.isFake(), false);
    assert.equal(Builder.isFake(), false);
    const restored = Repeater.make('x').defaultItems(1);
    form(host({}), [restored]);
    assert.match(Object.keys(restored.getDefaultState() as object)[0], /^[0-9a-f-]{36}$/);
    // A key generator function, on both.
    let next = 0;
    const repeater = Repeater.make('rows').schema([TextInput.make('name')]).generateUuidUsing(() => `row${++next}`);
    assert.deepEqual(Object.keys(repeater.hydrateState([{ name: 'a' }, { name: 'b' }]) as object), ['row1', 'row2']);
});

test('maxItemsForProcessing(): too many items are refused with HTTP 413, before building the item schemas', async () => {
    const make = () => Repeater.make('members').schema([TextInput.make('name')]).maxItems(5).maxItemsForProcessing(3);
    const ok = make();
    form(host({ members: { a: {}, b: {}, c: {} } }), [ok]);
    assert.equal(ok.getChildSchemas().length, 3);
    const tooMany = make();
    form(host({ members: { a: {}, b: {}, c: {}, d: {} } }), [tooMany]);
    assert.throws(() => tooMany.getChildSchemas(), (error: any) => error instanceof ItemsProcessingLimitError && error.status === 413);
    assert.throws(() => make().hydrateState([{}, {}, {}, {}]), ItemsProcessingLimitError);
    const builder = Builder.make('content').blocks([Block.make('p').schema([TextInput.make('body')])]).maxItemsForProcessing(1);
    form(host({ content: { a: { type: 'p', data: {} }, b: { type: 'p', data: {} } } }), [builder]);
    assert.throws(() => builder.getItems(), ItemsProcessingLimitError);
    assert.equal(Repeater.make('x').getMaxItemsForProcessing(), null);
});

test('lazyLoaded(): repeater and builder item schemas render a loading indicator until loaded, one per item', async () => {
    const loaded = new Set<string>();
    const livewire = host({ members: { a: { name: 'Ada' }, b: { name: 'Bob' } }, content: { x: { type: 'p', data: { body: 'Hello' } } } }, { isDeferredSchemaLoaded: async (schema: Schema) => loaded.has(schema.getLazyKey()) });
    // On the component, or on the Schema given to schema() / Block.schema() (Filament's way).
    const viaComponent = Repeater.make('members').schema([TextInput.make('name')]).lazyLoaded();
    const builder = Builder.make('content').blocks([Block.make('p').schema(Schema.make().components([TextInput.make('body')]).lazyLoaded())]);
    const schema = form(livewire, [viaComponent, builder]);
    const html = await schema.toHtml();
    assert.match(html, /wire:partial="schema\.form\.members\.a"[^>]*isLoadingDeferred: true/);
    assert.match(html, /wire:partial="schema\.form\.members\.b"/);
    assert.match(html, /wire:partial="schema\.form\.content\.x\.data"/);
    assert.doesNotMatch(html, /value="Ada"|wire:model="data\.members\.a\.name"/);
    // The items stay part of the form: validated and saved while not rendered.
    assert.deepEqual(await getSchemaState(schema), { members: [{ name: 'Ada' }, { name: 'Bob' }].reduce((items, item, index) => ({ ...items, [['a', 'b'][index]]: item }), {}), content: [{ type: 'p', data: { body: 'Hello' } }] });
    loaded.add('form.members.a');
    const after = await schema.toHtml();
    assert.match(after, /wire:model="data\.members\.a\.name"/);
    assert.doesNotMatch(after, /wire:model="data\.members\.b\.name"/);
    // Through a Schema template on the repeater too; table repeaters render their cells directly (no lazy loading).
    const template = Repeater.make('members').schema(Schema.make(livewire as any).components([TextInput.make('name')]).lazyLoaded());
    form(livewire, [template]);
    assert.ok(await template.getChildSchemas()[0].isLazyLoaded());
    const table = Repeater.make('members').table([TableColumn.make('Name')]).schema([TextInput.make('name')]).lazyLoaded();
    form(livewire, [table]);
    assert.equal(await table.getChildSchemas()[0].isLazyLoaded(), false);
});

test('getParentRepeaterItem(): the repeater, item key and path, through layout components', () => {
    const livewire = host({ members: { a: { address: { city: 'Paris' } } } });
    const repeater = Repeater.make('members').schema([Section.make('Address').schema([Group.make([TextInput.make('city')]).statePath('address')])]);
    form(livewire, [repeater]);
    const [item] = repeater.getChildSchemas();
    const city = item.getFlatComponents().find((component) => component instanceof TextInput)!;
    const found = getParentRepeaterItem(city);
    assert.equal(found?.repeater, repeater);
    assert.equal(found?.itemKey, 'a');
    assert.equal(found?.itemPath, 'address.city');
    const alone = form(livewire, [TextInput.make('alone')]).getComponents()[0];
    assert.equal(getParentRepeaterItem(alone), null);
});

test('distinct across items, fixIndistinctState() for booleans and options', async () => {
    const livewire = host({ answers: { a: { correct: true, tags: ['x', 'y'], role: 'admin' }, b: { correct: true, tags: ['y'], role: 'admin' }, c: { correct: false, tags: [], role: null } } });
    const repeater = Repeater.make('answers').schema([
        Checkbox.make('correct').fixIndistinctState(),
        CheckboxList.make('tags').options({ x: 'X', y: 'Y', z: 'Z' }).fixIndistinctState(),
        Select.make('role').options({ admin: 'Admin', member: 'Member' }).fixIndistinctState(),
    ]);
    const schema = form(livewire, [repeater]);
    const errors = await validateSchema(schema);
    assert.deepEqual(errors['data.answers.a.correct'], ['Only one correct field must be selected.']);
    assert.deepEqual(errors['data.answers.a.tags'], ['The tags field has a duplicate value.']);
    assert.deepEqual(errors['data.answers.b.role'], ['The role field has a duplicate value.']);
    assert.equal(errors['data.answers.c.correct'], undefined);
    // The fields are live, and fixing runs after their state changes, on the item that changed.
    const field = (key: string, name: string) => repeater.getChildSchemas()[['a', 'b', 'c'].indexOf(key)].getComponents().find((component: any) => component.getName() === name) as any;
    assert.ok(field('a', 'correct').isLive());
    assert.ok(field('a', 'correct').hasAfterStateUpdated());
    (livewire.data.answers as any).c.correct = true;
    await field('c', 'correct').callAfterStateUpdated(() => {});
    assert.deepEqual(Object.values(livewire.data.answers as any).map((item: any) => item.correct), [false, false, true]);
    await field('a', 'tags').callAfterStateUpdated(() => {});
    assert.deepEqual((livewire.data.answers as any).b.tags, []);
    await field('a', 'role').callAfterStateUpdated(() => {});
    assert.equal((livewire.data.answers as any).b.role, null);
    assert.deepEqual(await validateSchema(schema), {});
    // A required boolean must be on in one item.
    const required = host({ answers: { a: { correct: false }, b: { correct: false } } });
    const requiredSchema = form(required, [Repeater.make('answers').schema([Toggle.make('correct').required().fixIndistinctState()])]);
    // Navette's `required()` already refuses `false`; the distinct rule gives Filament's message when it is reached.
    assert.ok((await validateSchema(requiredSchema))['data.answers.a.correct']);
    const [, , mustBeSelected] = siblingDistinctRules();
    const requiredToggle = requiredSchema.getComponents()[0] as Repeater;
    const toggle = requiredToggle.getChildSchemas()[0].getComponents()[0] as any;
    assert.equal(await mustBeSelected.passes(false, toggle.context()), false);
    assert.equal(mustBeSelected.message('correct'), 'At least one correct field must be selected.');
    (required.data.answers as any).b.correct = true;
    assert.equal(await mustBeSelected.passes(false, toggle.context()), true);
    // The field's own afterStateUpdated() still runs, and fixIndistinctState(false) does nothing.
    let called = 0;
    const own = Checkbox.make('flag').afterStateUpdated(() => { called++; }).fixIndistinctState();
    const ownLivewire = host({ rows: { a: { flag: true }, b: { flag: true } } });
    const ownRepeater = Repeater.make('rows').schema([own]);
    form(ownLivewire, [ownRepeater]);
    await (ownRepeater.getChildSchemas()[0].getComponents()[0] as any).callAfterStateUpdated(() => {});
    assert.equal(called, 1);
    assert.equal((ownLivewire.data.rows as any).b.flag, false);
    assert.equal(Checkbox.make('flag').fixIndistinctState(false).hasAfterStateUpdated(), false);
});

test('disableOptionsWhenSelectedInSiblingRepeaterItems() on Select, Radio, ToggleButtons, CheckboxList', async () => {
    const livewire = host({ members: { a: { role: 'owner', perms: ['read'], tier: 'gold', kind: 'x' }, b: { role: null, perms: ['write'], tier: null, kind: null } } });
    const repeater = Repeater.make('members').schema([
        Select.make('role').options({ owner: 'Owner', member: 'Member' }).disableOptionsWhenSelectedInSiblingRepeaterItems(),
        CheckboxList.make('perms').options({ read: 'Read', write: 'Write' }).disableOptionsWhenSelectedInSiblingRepeaterItems(),
        Radio.make('tier').options({ gold: 'Gold', silver: 'Silver' }).disableOptionsWhenSelectedInSiblingRepeaterItems(),
        ToggleButtons.make('kind').options({ x: 'X', y: 'Y' }).disableOptionsWhenSelectedInSiblingRepeaterItems(),
    ]);
    const schema = form(livewire, [repeater]);
    const [first, second] = repeater.getChildSchemas().map((item) => item.getComponents() as any[]);
    // An option picked in the other item is disabled; the item's own picks stay enabled.
    assert.match(await schema.toHtml(), /wire:model.live="data.members.b.role"/);
    assert.equal(first[1].isOptionDisabled('read', 'Read'), false);
    assert.equal(first[1].isOptionDisabled('write', 'Write'), true);
    assert.equal(second[2].isOptionDisabled('gold', 'Gold'), true);
    assert.equal(second[2].isOptionDisabled('silver', 'Silver'), false);
    assert.equal(second[3].isOptionDisabled('x', 'X'), true);
    const html = await schema.toHtml();
    assert.match(html, /<option value="owner" disabled>Owner<\/option>/);
    assert.match(html, /<option value="owner">Owner<\/option>/);
    // A forged duplicate is refused on the server.
    (livewire.data.members as any).b.role = 'owner';
    assert.deepEqual((await validateSchema(schema))['data.members.b.role'], ['The role field has a duplicate value.']);
    // Outside a repeater nothing is disabled.
    const alone = Select.make('role').options({ owner: 'Owner' }).disableOptionsWhenSelectedInSiblingRepeaterItems();
    form(host({ role: null }), [alone]);
    assert.deepEqual(await alone.getOptionsForJs(), [{ label: 'Owner', value: 'owner', isDisabled: false }]);
});

test('KeyValue.reorderActionLabel() labels the reorder handle', async () => {
    const html = await form(host({ meta: { a: '1', b: '2' } }), [KeyValue.make('meta').reorderable().reorderActionLabel('Drag row')]).toHtml();
    assert.match(html, /Drag row/);
});
