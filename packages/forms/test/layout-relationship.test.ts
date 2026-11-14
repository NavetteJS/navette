import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { Fieldset, Group, Schema, Section, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { TextInput, fillSchemaFromRecord, getSchemaState, loadSchemaRelationships, saveSchemaRelationships, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Author extends Model { static tableName = 'authors'; }
class Profile extends Model { static tableName = 'profiles'; }
class Post extends Model {
    static tableName = 'posts';
    static get relationMappings() {
        return {
            author: { relation: Model.BelongsToOneRelation, modelClass: Author, join: { from: 'posts.author_id', to: 'authors.id' } },
            profile: { relation: Model.HasOneRelation, modelClass: Profile, join: { from: 'posts.id', to: 'profiles.post_id' } },
        };
    }
}
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('name'); });
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.integer('author_id'); });
    await db.schema.createTable('profiles', (t) => { t.increments('id'); t.integer('post_id'); t.string('summary'); });
    await db('authors').insert([{ name: 'Ada' }]);
    await db('posts').insert([{ title: 'A', author_id: 1 }, { title: 'B', author_id: null }]);
    await db('profiles').insert([{ post_id: 1, summary: 'First' }]);
});
after(() => db.destroy());

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {}, getDataAdapter: () => new ObjectionAdapter(Post) });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const fill = async (schema: Schema, livewire: any, record: any) => { fillSchemaFromRecord(schema, livewire.data, record); await loadSchemaRelationships(schema, livewire.data, record); };

test('relationship() on a layout: fields are read from and saved to a has-one or belongs-to record', async () => {
    const livewire = host();
    const schema = form(livewire, [
        TextInput.make('title'),
        Section.make('Profile').relationship('profile').schema([TextInput.make('summary')]),
        Group.make().relationship('author').schema([TextInput.make('name')]),
    ]);
    const post = await Post.query().findById(1);
    await fill(schema, livewire, post);
    assert.equal((livewire.data as any).profile.summary, 'First');
    assert.equal((livewire.data as any).author.name, 'Ada');
    // The related fields are not part of the record's own data.
    assert.deepEqual(await getSchemaState(schema), { title: 'A' });
    (livewire.data as any).profile.summary = 'Updated';
    (livewire.data as any).author.name = 'Ada L.';
    await saveSchemaRelationships(schema, post);
    assert.equal((await db('profiles').where({ post_id: 1 }).first()).summary, 'Updated');
    assert.equal((await db('authors').where({ id: 1 }).first()).name, 'Ada L.');
});

test('relationship() creates the missing record; its condition deletes it; saveRelationshipsWhenHidden()', async () => {
    const livewire = host();
    const fields = (condition: any) => [Fieldset.make('Profile').relationship('profile', condition).schema([TextInput.make('summary')])];
    const post = await Post.query().findById(2);
    const schema = form(livewire, fields(({ state }: any) => Boolean(state?.summary)));
    await fill(schema, livewire, post);
    (livewire.data as any).profile = { summary: 'Created' };
    await saveSchemaRelationships(schema, post);
    assert.equal((await db('profiles').where({ post_id: 2 }).first()).summary, 'Created');
    (livewire.data as any).profile = { summary: '' };
    await saveSchemaRelationships(form(livewire, fields(({ state }: any) => Boolean(state?.summary))), post);
    assert.equal(await db('profiles').where({ post_id: 2 }).first(), undefined);
    // A hidden relationship layout is not saved, unless saveRelationshipsWhenHidden().
    (livewire.data as any).profile = { summary: 'Hidden' };
    await saveSchemaRelationships(form(livewire, [Group.make().hidden().relationship('profile').schema([TextInput.make('summary')])]), post);
    assert.equal(await db('profiles').where({ post_id: 2 }).first(), undefined);
    await saveSchemaRelationships(form(livewire, [Group.make().hidden().saveRelationshipsWhenHidden().relationship('profile').schema([TextInput.make('summary')])]), post);
    assert.equal((await db('profiles').where({ post_id: 2 }).first()).summary, 'Hidden');
});
