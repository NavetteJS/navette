import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Model, sqlite, type Knex } from '@navette-js/database';
import { Livewire } from '@navette-js/panels/livewire';
import { livewire } from '@navette-js/panels/testing';
import { generateLivewireForm, generateLivewireTable, generateResource, kebab } from '../src/generators.ts';

// Generated files are written inside the repository, so that they resolve the @navette-js packages like a project would.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), `.tmp-${randomBytes(4).toString('hex')}`);
const write = (file: string, content: string) => { const target = path.join(root, ...file.split('/')); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, content); return pathToFileURL(target).href; };
const columns = [
    { name: 'id', type: 'integer', nullable: false },
    { name: 'title', type: 'varchar', nullable: false },
    { name: 'body', type: 'text', nullable: true },
    { name: 'is_published', type: 'boolean', nullable: false },
    { name: 'created_at', type: 'datetime', nullable: true },
];
let db: Knex;
before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.text('body'); table.boolean('is_published').defaultTo(false); table.datetime('created_at'); table.datetime('updated_at'); });
    write('models/Post.ts', generateResource('Post', 'posts', columns).model);
});
after(async () => { rmSync(root, { recursive: true, force: true }); await db.destroy(); });

test('kebab-case component names', () => {
    assert.equal(kebab('CreatePost'), 'create-post');
    assert.equal(kebab('ListHTMLPages'), 'list-html-pages');
});

test('make:livewire-form generates a component that creates a record, and one that edits it (--edit --generate)', async () => {
    const create = generateLivewireForm('CreatePost', 'Post', columns);
    assert.match(create.component, /TextInput\.make\('title'\)\.required\(\)/);
    assert.match(create.component, /Toggle\.make\('is_published'\)/);
    assert.match(create.view, /<%- await schema\('form'\) %>/);
    assert.match(create.view, /<%- await modals\(\) %>/);
    write('livewire/create-post.ejs', create.view);
    const { CreatePost } = await import(write('livewire/CreatePost.ts', create.component));
    const edit = generateLivewireForm('EditPost', 'Post', columns, { edit: true });
    assert.match(edit.component, /static locked = \['record'\]/);
    write('livewire/edit-post.ejs', edit.view);
    const { EditPost } = await import(write('livewire/EditPost.ts', edit.component));

    const components = new Livewire({ key: 'make-livewire-test-key-0123456789abcdef' }).components([CreatePost, EditPost]);
    await livewire(CreatePost, {}, { panel: components.panel, user: null })
        .assertSeeHtml('wire:submit="create"')
        .fillForm({ title: '' })
        .call('create')
        .assertHasFormErrors({ title: 'required' })
        .fillForm({ title: 'Hello', body: 'World' })
        .call('create')
        .assertHasNoFormErrors()
        .assertNotified('Created');
    const [row] = await db('posts');
    assert.equal(row.title, 'Hello');
    await livewire(EditPost, { record: row.id }, { panel: components.panel, user: null })
        .assertFormSet({ title: 'Hello' })
        .fillForm({ title: 'Changed' })
        .call('save')
        .assertNotified('Saved');
    assert.equal((await db('posts').first()).title, 'Changed');
    await livewire(EditPost, { record: 999 }, { panel: components.panel, user: null }).assertNotFound();
    // Without a model: the validated data is only shown.
    assert.match(generateLivewireForm('Contact', null, null).component, /Notification\.make\(\)\.success\(\)\.title\('Submitted'\)/);
});

test('make:livewire-table generates a component listing the records (--generate), or a placeholder model', async () => {
    const generated = generateLivewireTable('ListPosts', 'Post', columns).component;
    assert.match(generated, /TextColumn\.make\('title'\)\.searchable\(\)\.sortable\(\)/);
    assert.match(generated, /IconColumn\.make\('is_published'\)\.boolean\(\)/);
    assert.match(generateLivewireTable('ListItems', null, null).component, /class Item extends Model \{ static tableName = 'items'; \}/);
    const { ListPosts } = await import(write('livewire/ListPosts.ts', generated));
    const components = new Livewire({ key: 'make-livewire-test-key-0123456789abcdef' }).components([ListPosts]);
    const [row] = await db('posts');
    await livewire(ListPosts, {}, { panel: components.panel, user: null })
        .assertCanSeeTableRecords([row.id])
        .assertCanRenderTableColumn('title');
});
