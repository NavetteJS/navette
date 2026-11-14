import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { MorphToSelect, Select, ToggleButtons, fillSchemaFromRecord, getSchemaState, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors); useActionsColorManager(colors); useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });
class Product extends Model { static tableName = 'products'; }
class BlogPost extends Model { static tableName = 'blog_posts'; static morphClass = 'post'; }
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('products', (t) => { t.increments('id'); t.string('name'); t.integer('team_id'); });
    await db.schema.createTable('blog_posts', (t) => { t.increments('id'); t.string('title'); });
    await db('products').insert([{ name: 'Phone', team_id: 1 }, { name: 'Laptop', team_id: 1 }, { name: 'Secret', team_id: 2 }, { name: '50%_off', team_id: 1 }]);
    await db('blog_posts').insert([{ title: 'Hello' }, { title: 'World' }]);
});
after(() => db.destroy());
const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record).components(components);
const types = () => [
    MorphToSelect.Type.make(Product).titleAttribute('name').modifyOptionsQueryUsing((query) => query.where('team_id', 1)),
    MorphToSelect.Type.make(BlogPost).titleAttribute('title'),
];
const fields = (schema: Schema) => schema.getFlatComponents().filter((component) => component instanceof Select || component instanceof ToggleButtons) as any[];

test('`MorphToSelect`: a fieldset with a type select and a key select, saving `<name>_type` and `<name>_id`', async () => {
    const livewire = host({});
    const schema = form(livewire, [MorphToSelect.make('commentable').types(types()).required()]);
    fillSchemaFromRecord(schema, livewire.data, { commentable_type: null, commentable_id: null });
    const [typeSelect, keySelect] = fields(schema);
    assert.equal(typeSelect.getStatePath(), 'data.commentable_type');
    assert.equal(keySelect.getStatePath(), 'data.commentable_id');
    const html = await schema.toHtml();
    assert.match(html, /<fieldset[^>]*class="fi-sc-fieldset fi-fieldset"/);
    assert.match(html, /<legend>Commentable<sup class="fi-fieldset-label-required-mark">\*<\/sup><\/legend>/);
    assert.match(html, /<option value="Product">Product<\/option>/);
    assert.match(html, /<option value="post">Blog post<\/option>/);
    assert.doesNotMatch(html, /<select id="form.commentable_id"/, 'key select hidden without a type');
    assert.deepEqual(await validateSchema(schema), { 'data.commentable_type': ['The commentable field is required.'] });
    // Choosing a type shows its records, scoped by `modifyOptionsQueryUsing()`.
    livewire.data.commentable_type = 'Product';
    const withType = await form(livewire, [MorphToSelect.make('commentable').types(types())]).toHtml();
    assert.match(withType, /<option value="2">Laptop<\/option>/);
    assert.doesNotMatch(withType, /Secret/);
    livewire.data.commentable_id = '3';
    assert.deepEqual(await validateSchema(form(livewire, [MorphToSelect.make('commentable').types(types())])), { 'data.commentable_id': ['The selected product is invalid.'] });
    livewire.data.commentable_id = '2';
    assert.deepEqual(await validateSchema(form(livewire, [MorphToSelect.make('commentable').types(types())])), {});
    assert.deepEqual(await getSchemaState(form(livewire, [MorphToSelect.make('commentable').types(types())])), { commentable_type: 'Product', commentable_id: '2' });
    // An unknown type is rejected; a cleared type clears the key.
    livewire.data.commentable_type = 'User';
    assert.ok((await validateSchema(form(livewire, [MorphToSelect.make('commentable').types(types())])))['data.commentable_type']);
    livewire.data.commentable_type = null;
    assert.deepEqual(await getSchemaState(form(livewire, [MorphToSelect.make('commentable').types(types())])), { commentable_type: null, commentable_id: null });
});

test('`MorphToSelect`: changing the type clears the key (live type select)', async () => {
    const livewire = host({ commentable_type: 'post', commentable_id: '1' });
    const schema = form(livewire, [MorphToSelect.make('commentable').types(types())]);
    await schema.callAfterStateUpdated('data.commentable_type');
    assert.equal(livewire.data.commentable_id, null);
});

test('`MorphToSelect`: edit loads the label of the saved key; searchable, preload, optionsLimit', async () => {
    const record = { commentable_type: 'post', commentable_id: 2 };
    const livewire = host({});
    const schema = form(livewire, [MorphToSelect.make('commentable').types(types()).searchable()], record);
    fillSchemaFromRecord(schema, livewire.data, record);
    const keySelect = fields(schema)[1];
    assert.equal(await keySelect.getOptionLabel(), 'World');
    const html = await schema.toHtml();
    assert.match(html, /World/);
    assert.deepEqual((await keySelect.getSearchResultsForJs('wor')).map((option: any) => option.label), ['World']);
    // `%` and `_` in the search are literal.
    livewire.data.commentable_type = 'Product';
    const products = fields(form(livewire, [MorphToSelect.make('commentable').types(types()).searchable()], record))[1];
    assert.deepEqual((await products.getSearchResultsForJs('%')).map((option: any) => option.label), ['50%_off']);
    const limited = fields(form(livewire, [MorphToSelect.make('commentable').types(types()).searchable().preload().optionsLimit(1)], record))[1];
    assert.equal((await limited.getSearchResultsForJs('o')).length, 1);
});

test('`MorphToSelect`: `getOptionLabelFromRecordUsing()`, `modifyKeySelectUsing()`, `modifyTypeSelectUsing()`, `typeSelectToggleButtons()`', async () => {
    const livewire = host({ commentable_type: 'Product', commentable_id: null });
    const seen: string[] = [];
    const component = MorphToSelect.make('commentable')
        .types([
            MorphToSelect.Type.make(Product).getOptionLabelFromRecordUsing((record) => `#${record.id} ${record.name}`).modifyKeySelectUsing((select) => { seen.push('type'); return select.placeholder('Pick a product').createOptionForm([]).createOptionUsing(() => 1); }),
            MorphToSelect.Type.make(BlogPost).titleAttribute('title').label('Article'),
        ])
        .modifyKeySelectUsing((select) => { seen.push('global'); return select; })
        .modifyTypeSelectUsing((select) => select.label('Kind of record'))
        .typeSelectToggleButtons()
        .contained(false);
    const schema = form(livewire, [component]);
    const html = await schema.toHtml();
    assert.ok(fields(schema)[0] instanceof ToggleButtons);
    assert.deepEqual(seen.slice(0, 2), ['global', 'type']);
    assert.match(html, /#2 Laptop/);
    assert.match(html, /Pick a product/);
    assert.ok(fields(schema)[1].getActions().some((action: any) => action.getName() === 'createOption'));
    assert.match(html, /Article/);
    assert.match(html, /Kind of record/);
    assert.match(html, /fi-fieldset-not-contained/);
    assert.throws(() => MorphToSelect.Type.make(Product).getTitleAttribute(), /must have a \[titleAttribute\(\)\] set/);
});
