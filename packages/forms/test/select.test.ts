import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Select, useColorManager, fillSchemaFromRecord, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

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
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('name'); t.boolean('active'); });
    await db.schema.createTable('tags', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.integer('author_id'); });
    await db.schema.createTable('post_tag', (t) => { t.integer('post_id'); t.integer('tag_id'); });
    await db('authors').insert([{ name: 'Linus', active: 1 }, { name: 'Ada', active: 1 }, { name: 'Ghost', active: 0 }]);
    await db('tags').insert([{ name: 'js' }, { name: 'php' }, { name: 'sql' }]);
    await db('posts').insert([{ title: 'A', author_id: 1 }]);
    await db('post_tag').insert([{ post_id: 1, tag_id: 1 }, { post_id: 1, tag_id: 2 }]);
});
after(() => db.destroy());

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {}, getDataAdapter: () => new ObjectionAdapter(Post) });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);

test('Select: grouped options, boolean, disabled options and native optgroups', async () => {
    const livewire = host({ status: 'draft' });
    const schema = form(livewire, [Select.make('status').options({ 'In process': { draft: 'Draft', reviewing: 'Reviewing' }, Reviewed: { published: 'Published' } }).disableOptionWhen((value) => value === 'reviewing')]);
    const html = await schema.toHtml();
    assert.match(html, /<optgroup label="In process"><option value="draft">Draft<\/option><option value="reviewing" disabled>Reviewing<\/option><\/optgroup><optgroup label="Reviewed">/);
    livewire.data.status = 'nope';
    assert.deepEqual(await validateSchema(schema), { 'data.status': ['The selected status is invalid.'] });
    livewire.data.status = 'published';
    assert.deepEqual(await validateSchema(schema), {});
    const yesNo = await form(host({ active: '1' }), [Select.make('active').boolean()]).toHtml();
    assert.match(yesNo, /<option value="1">Yes<\/option><option value="0">No<\/option>/);
    const js = await form(host(), [Select.make('status').native(false).options({ Group: { a: 'A' }, b: 'B' })]).toHtml();
    assert.match(js, /Group.{1,40}options.{1,60}label.{1,30}A.{1,40}value.{1,30}a/);
    assert.match(js, /isSearchable: false/);
});

test('Select: allowHtml() sanitizes labels, maxItems() is enforced, affixes render', async () => {
    const livewire = host({ tags: ['a', 'b', 'c'] });
    const schema = form(livewire, [Select.make('tags').multiple().maxItems(2).allowHtml().options({ a: '<b>A</b><script>x()</script>', b: 'B', c: 'C' }).prefix('#').suffixIcon('m-tag')]);
    const html = await schema.toHtml();
    assert.doesNotMatch(html, /<script>x\(\)/);
    assert.match(html, /isHtmlAllowed: true/);
    assert.match(html, /maxItems: 2,/);
    assert.match(html, /nv-input-wrp-prefix[^>]*><span class="nv-input-wrp-label">#<\/span>/);
    assert.deepEqual(await validateSchema(schema), { 'data.tags': ['The tags field must not have more than 2 items.'] });
    livewire.data.tags = ['a', 'b'];
    assert.deepEqual(await validateSchema(schema), {});
});

test('Select: belongs-to relationship, scoped by the query', async () => {
    const livewire = host({ author_id: '2' });
    const field = Select.make('author_id').relationship('author', 'name', (query) => query.where('active', 1));
    const schema = form(livewire, [field]);
    assert.deepEqual(await field.resolveOptions(), [['2', 'Ada'], ['1', 'Linus']]);
    assert.deepEqual(await validateSchema(schema), {});
    livewire.data.author_id = '3';
    assert.deepEqual(await validateSchema(schema), { 'data.author_id': ['The selected author id is invalid.'] });
    assert.deepEqual(await getSchemaState(schema), { author_id: '3' });
    // Searchable: no preloaded options, the server searches.
    const searchable = Select.make('author_id').relationship('author', 'name').searchable();
    form(host({ author_id: '1' }), [searchable]);
    assert.deepEqual(await searchable.resolveOptions(), []);
    assert.deepEqual((await searchable.getSearchResultsForJs('ad')).map((o: any) => o.label), ['Ada']);
    assert.equal(await searchable.getOptionLabel(), 'Linus');
});

test('Select: many-to-many relationship is loaded and synced after save', async () => {
    const livewire = host({});
    const schema = form(livewire, [Select.make('title').options({}), Select.make('tags').multiple().relationship('tags', 'name')]);
    const post = await Post.query().findById(1);
    fillSchemaFromRecord(schema, livewire.data, { ...post });
    await loadSchemaRelationships(schema, livewire.data, post);
    assert.deepEqual(livewire.data.tags, ['1', '2']);
    // The relationship is not in the saved data.
    assert.equal('tags' in (await getSchemaState(schema)), false);
    livewire.data.tags = ['2', '3', '99'];
    assert.deepEqual(await validateSchema(form(livewire, [Select.make('tags').multiple().relationship('tags', 'name')])), { 'data.tags': ['The selected tags is invalid.'] });
    livewire.data.tags = ['2', '3'];
    await saveSchemaRelationships(schema, post);
    assert.deepEqual((await db('post_tag').where('post_id', 1).orderBy('tag_id')).map((row: any) => row.tag_id), [2, 3]);
});
