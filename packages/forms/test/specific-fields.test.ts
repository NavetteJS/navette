// Options of specific fields: text input masks and stripped characters, phone pattern, textarea columns, select relationship
// options (several search columns, ignored record, labels from records, pivot data, selected record), reorderable and
// wrapping JavaScript selects, option actions, and grid directions of checkbox lists and toggle buttons.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { CheckboxList, DatePicker, DateTimePicker, RawJs, Select, TimePicker, TagsInput, Textarea, TextInput, ToggleButtons, fillSchemaFromRecord, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Person extends Model {
    static tableName = 'people';
    static get relationMappings() {
        return {
            manager: { relation: Model.BelongsToOneRelation, modelClass: Person, join: { from: 'people.manager_id', to: 'people.id' } },
            skills: { relation: Model.ManyToManyRelation, modelClass: Skill, join: { from: 'people.id', through: { from: 'person_skill.person_id', to: 'person_skill.skill_id', extra: ['level'] }, to: 'skills.id' } },
        };
    }
}
class Skill extends Model { static tableName = 'skills'; }
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('people', (t) => { t.increments('id'); t.string('first_name'); t.string('last_name'); t.string('email'); t.integer('manager_id'); });
    await db.schema.createTable('skills', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('person_skill', (t) => { t.integer('person_id'); t.integer('skill_id'); t.string('level'); });
    await db('people').insert([
        { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', manager_id: null },
        { first_name: 'Linus', last_name: 'Torvalds', email: 'linus@kernel.org', manager_id: 1 },
        { first_name: 'Grace', last_name: 'Hopper', email: 'grace@navy.mil', manager_id: 1 },
    ]);
    await db('skills').insert([{ name: 'COBOL' }, { name: 'C' }, { name: 'Math' }]);
});
after(() => db.destroy());

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {}, getDataAdapter: () => new ObjectionAdapter(Person) });
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record).components(components);

test('TextInput: a RawJs mask is dynamic, a function mask is evaluated, stripCharacters() cleans the value before validation and saving', async () => {
    const livewire = host({ amount: '1,234,567', phone: '' });
    const amount = TextInput.make('amount').mask(RawJs.make('$money($input)')).stripCharacters(',').numeric();
    const schema = form(livewire, [amount, TextInput.make('phone').mask(({ get }) => (get('amount') ? '(999) 999-9999' : null))]);
    const html = await schema.toHtml();
    assert.match(html, /<input[^>]*type="text"[^>]*x-mask:dynamic="\$money\(\$input\)"/);
    assert.match(html, /x-mask="\(999\) 999-9999"/);
    // The masked value is numeric once the commas are stripped, and saved without them.
    assert.deepEqual(await validateSchema(schema), {});
    assert.deepEqual(await getSchemaState(schema), { amount: '1234567', phone: null });
    // Several characters, or a function of the context; a value from the record is stripped too.
    const field = TextInput.make('code').stripCharacters(() => ['-', ' ']);
    form(host(), [field]);
    assert.equal(field.hydrateState('AB-12 34'), 'AB1234');
    assert.deepEqual(field.getStripCharacters(), ['-', ' ']);
    // No mask: no `x-mask` attribute and the declared type.
    assert.doesNotMatch(await form(host({ x: '' }), [TextInput.make('x').mask(null).email()]).toHtml(), /x-mask/);
});

test('TextInput: tel() validates against telRegex() (a string, a RegExp or a function)', async () => {
    const livewire = host({ phone: '+33 6 12 34 56 78' });
    assert.deepEqual(await validateSchema(form(livewire, [TextInput.make('phone').tel()])), {});
    assert.deepEqual(await validateSchema(form(livewire, [TextInput.make('phone').tel().telRegex('/^\\+33\\d{9}$/')])), { 'data.phone': ['The phone field format is invalid.'] });
    livewire.data.phone = '+33612345678';
    assert.deepEqual(await validateSchema(form(livewire, [TextInput.make('phone').tel().telRegex(/^\+33\d{9}$/)])), {});
    assert.deepEqual(await validateSchema(form(livewire, [TextInput.make('phone').tel().telRegex(() => '/^0\\d{9}$/')])), { 'data.phone': ['The phone field format is invalid.'] });
    assert.match(await form(livewire, [TextInput.make('phone').tel()]).toHtml(), /type="tel"/);
    assert.doesNotMatch(await form(livewire, [TextInput.make('phone').tel(false)]).toHtml(), /type="tel"/);
});

test('Textarea: cols() sets the width in characters; Textarea and TagsInput strip characters', async () => {
    const livewire = host({ notes: 'a*b', tags: ['#js', 'p#hp'] });
    const schema = form(livewire, [Textarea.make('notes').rows(4).cols(30).stripCharacters('*'), TagsInput.make('tags').stripCharacters('#')]);
    const html = await schema.toHtml();
    assert.match(html, /<textarea[^>]* cols="30"/);
    assert.deepEqual(await getSchemaState(schema), { notes: 'ab', tags: ['js', 'php'] });
    assert.match(await form(host({ notes: '' }), [Textarea.make('notes').cols(({ operation }) => (operation === null ? 12 : null))]).toHtml(), /cols="12"/);
    assert.doesNotMatch(await form(host({ notes: '' }), [Textarea.make('notes')]).toHtml(), /cols=/);
});

test('Select: searchable([...]) searches several columns of the relationship; labels from the whole record', async () => {
    const field = Select.make('manager_id').relationship('manager', 'first_name').searchable(['first_name', 'email']).getOptionLabelFromRecordUsing((record) => `${record.first_name} ${record.last_name}`);
    form(host({ manager_id: '3' }), [field]);
    assert.deepEqual(field.getSearchColumns(), ['first_name', 'email']);
    assert.deepEqual((await field.getSearchResultsForJs('kernel')).map((option: any) => option.label), ['Linus Torvalds']);
    assert.deepEqual((await field.getSearchResultsForJs('Grace')).map((option: any) => option.label), ['Grace Hopper']);
    assert.equal(await field.getOptionLabel(), 'Grace Hopper');
    // A column name that is not a plain identifier is never put in the query.
    const odd = Select.make('manager_id').relationship('manager', 'first_name').searchable(['first_name', 'email; drop table people']);
    form(host(), [odd]);
    assert.deepEqual((await odd.getSearchResultsForJs('ada')).map((option: any) => option.label), ['Ada']);
    // The title column is searched by default.
    const plain = Select.make('manager_id').relationship('manager', 'first_name').searchable();
    form(host(), [plain]);
    assert.deepEqual(plain.getSearchColumns(), ['first_name']);
    assert.deepEqual((await plain.getSearchResultsForJs('kernel')), []);
});

test('Select: relationship(…, { ignoreRecord: true }) leaves out the record being edited; getSelectedRecord()', async () => {
    const ada = await Person.query().findById(1);
    const livewire = host({ manager_id: '1' });
    const field = Select.make('manager_id').relationship('manager', 'first_name', null, { ignoreRecord: true });
    const schema = form(livewire, [field], ada);
    assert.deepEqual(await field.resolveOptions(), [['3', 'Grace'], ['2', 'Linus']]);
    // A person cannot be their own manager, even through a forged request.
    assert.deepEqual(await validateSchema(schema), { 'data.manager_id': ['The selected manager id is invalid.'] });
    livewire.data.manager_id = '2';
    assert.deepEqual(await validateSchema(schema), {});
    assert.equal((await field.getSelectedRecord()).last_name, 'Torvalds');
    // Without the option, the record is offered.
    const all = Select.make('manager_id').relationship('manager', 'first_name');
    form(host(), [all], ada);
    assert.equal((await all.resolveOptions()).length, 3);
    // A custom resolver, and no record for an empty state.
    const custom = Select.make('manager_id').options({ a: 'A' }).getSelectedRecordUsing(({ state }) => ({ key: state }));
    form(host({ manager_id: 'a' }), [custom]);
    assert.deepEqual(await custom.getSelectedRecord(), { key: 'a' });
    const empty = Select.make('manager_id').relationship('manager', 'first_name');
    form(host({ manager_id: null }), [empty]);
    assert.equal(await empty.getSelectedRecord(), null);
});

test('Select: pivotData() is written to the pivot table of a many-to-many relationship', async () => {
    const livewire = host({});
    const field = Select.make('skills').multiple().relationship('skills', 'name').pivotData(({ get }) => ({ level: get('level') ?? 'junior' }));
    const schema = form(livewire, [TextInput.make('level'), field]);
    const grace = await Person.query().findById(3);
    fillSchemaFromRecord(schema, livewire.data, { ...grace });
    await loadSchemaRelationships(schema, livewire.data, grace);
    livewire.data.skills = ['1', '3'];
    livewire.data.level = 'senior';
    await saveSchemaRelationships(schema, grace);
    assert.deepEqual(await db('person_skill').where('person_id', 3).orderBy('skill_id').select('skill_id', 'level'), [{ skill_id: 1, level: 'senior' }, { skill_id: 3, level: 'senior' }]);
});

test('Select: reorderable() and wrapOptionLabels() configure the JavaScript select; manageOptionActions() changes both option actions', async () => {
    const livewire = host({ tags: ['b', 'a'], one: 'a' });
    const html = await form(livewire, [Select.make('tags').multiple().reorderable().wrapOptionLabels(false).options({ a: 'A', b: 'B' })]).toHtml();
    assert.match(html, /isReorderable: true/);
    assert.match(html, /canOptionLabelsWrap: false/);
    const initial = /initialState: (.*)/.exec(html)![1];
    assert.ok(initial.indexOf('u0022b') < initial.indexOf('u0022a') || initial.indexOf('"b') < initial.indexOf('"a'), initial);
    const plain = await form(livewire, [Select.make('one').native(false).reorderable().options({ a: 'A' })]).toHtml();
    assert.match(plain, /isReorderable: false/);
    assert.match(plain, /canOptionLabelsWrap: true/);
    const seen: string[] = [];
    const field = Select.make('one').options({ a: 'A' }).manageOptionForm([TextInput.make('name')]).createOptionUsing(() => 'a').updateOptionUsing(() => {})
        .manageOptionActions((action) => { seen.push(action.getName()!); return action.modalWidth('lg'); })
        .createOptionAction((action) => action.label('New'));
    form(livewire, [field]);
    const actions = field.getActions();
    assert.deepEqual(seen, ['createOption', 'editOption']);
    assert.equal(await (actions.find((action) => action.getName() === 'createOption') as any).getLabel({}), 'New');
});

test('CheckboxList and ToggleButtons: gridDirection("row") fills the grid row by row', async () => {
    const livewire = host({ tags: [], kind: null });
    const column = await form(livewire, [CheckboxList.make('tags').options({ a: 'A', b: 'B', c: 'C' }).columns(2)]).toHtml();
    assert.match(column, /class="fi-grid fi-grid-direction-col lg:fi-grid-cols fi-fo-checkbox-list-options" style="--cols-lg: 2; --cols-default: 1;"/);
    const row = await form(livewire, [CheckboxList.make('tags').options({ a: 'A', b: 'B', c: 'C' }).columns(2).gridDirection('row')]).toHtml();
    assert.match(row, /class="fi-grid lg:fi-grid-cols fi-fo-checkbox-list-options" style="--cols-lg: repeat\(2, minmax\(0, 1fr\)\); --cols-default: repeat\(1, minmax\(0, 1fr\)\);"/);
    const single = await form(livewire, [CheckboxList.make('tags').options({ a: 'A' }).gridDirection(() => 'row')]).toHtml();
    assert.match(single, /class="fi-grid fi-fo-checkbox-list-options" style="--cols-default: repeat\(1, minmax\(0, 1fr\)\);"/);
    const buttons = await form(livewire, [ToggleButtons.make('kind').options({ a: 'A', b: 'B', c: 'C' }).columns(3).gridDirection('row')]).toHtml();
    assert.match(buttons, /class="fi-grid lg:fi-grid-cols" style="--cols-lg: repeat\(3, minmax\(0, 1fr\)\); --cols-default: repeat\(1, minmax\(0, 1fr\)\);"/);
    const columnButtons = await form(livewire, [ToggleButtons.make('kind').options({ a: 'A', b: 'B', c: 'C' }).columns(3)]).toHtml();
    assert.match(columnButtons, /class="fi-grid fi-grid-direction-col lg:fi-grid-cols" style="--cols-lg: 3; --cols-default: 1;"/);
});

test('DateTimePicker: affixes, readOnly(), datalist() and date(false) / time(false)', async () => {
    const livewire = host({ starts_at: '2026-05-01 10:00:00', opens: '09:00', day: '2026-05-01' });
    const native = await form(livewire, [DateTimePicker.make('starts_at').prefix('Starts').suffixIcon('m-calendar', true).suffixIconColor('success')]).toHtml();
    assert.match(native, /class="fi-fo-date-time-picker fi-input-wrp"><div x-on:click="[^"]*" class="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-input-wrp-prefix-has-label"><span class="fi-input-wrp-label">Starts<\/span><\/div><div class="fi-input-wrp-content-ctn"><input[^>]*class="fi-input fi-input-has-inline-suffix"/);
    assert.match(native, /<div x-on:click="[^"]*" class="fi-input-wrp-suffix fi-inline"><svg[^>]*fi-color fi-color-success/);
    const time = await form(livewire, [DateTimePicker.make('opens').date(false).seconds(false).datalist(['09:00', '12:00']).readOnly(false)]).toHtml();
    assert.match(time, /<input[^>]*list="form\.opens-list"[^>]*type="time"/);
    assert.match(time, /<datalist id="form\.opens-list"><option value="09:00" \/><option value="12:00" \/><\/datalist>/);
    // Read-only: `readonly`, no datalist, not required in the browser; the JavaScript picker does not open.
    const readOnly = await form(livewire, [DateTimePicker.make('opens').date(false).required().datalist(['09:00']).readOnly()]).toHtml();
    assert.match(readOnly, /<input[^>]* readonly="readonly"/);
    assert.doesNotMatch(readOnly, /datalist|required="required"/);
    const js = await form(livewire, [DateTimePicker.make('starts_at').native(false).readOnly().prefixIcon('m-clock')]).toHtml();
    assert.doesNotMatch(js, /x-on:click="togglePanelVisibility\(\)"/);
    assert.match(js, /fi-input-wrp-prefix[^>]*><svg/);
    // time(false): a date picker, saved as a date.
    const dateOnly = DateTimePicker.make('day').time(false);
    const schema = form(livewire, [dateOnly]);
    assert.match(await schema.toHtml(), /type="date"/);
    assert.deepEqual(await getSchemaState(schema), { day: '2026-05-01' });
    assert.match(await form(livewire, [DatePicker.make('day').time()]).toHtml(), /type="datetime-local"/);
    assert.match(await form(livewire, [TimePicker.make('opens').date()]).toHtml(), /type="datetime-local"/);
});

test('Select: with a relationship, the edit option modal is filled from and saves the selected record', async () => {
    const livewire = host({ manager_id: '2' });
    const field = Select.make('manager_id').relationship('manager', 'first_name', (query) => query.whereNot('id', 3)).editOptionForm([TextInput.make('first_name').required()]);
    form(livewire, [field]);
    const edit = field.getActions().find((action) => action.getName() === 'editOption')!;
    const fill = await edit.getFormFill({ livewire, record: null, arguments: {}, data: {} } as any);
    assert.equal(fill.first_name, 'Linus');
    await edit.call({ livewire, record: null, arguments: {}, data: { first_name: 'Linux' } } as any);
    assert.equal((await db('people').where('id', 2).first()).first_name, 'Linux');
    // A state outside the relationship's query (forged) updates nothing.
    livewire.data.manager_id = '3';
    await assert.rejects(edit.call({ livewire, record: null, arguments: {}, data: { first_name: 'Hacked' } } as any));
    assert.equal((await db('people').where('id', 3).first()).first_name, 'Grace');
    await db('people').where('id', 2).update({ first_name: 'Linus' });
});
