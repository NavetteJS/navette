import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Model, sqlite, type Knex } from '@navette-js/database';
import { Panel, type User } from '@navette-js/panels';
import { actingAs, livewire, setCurrentPanel } from '@navette-js/panels/testing';
import { generateResource } from '../src/generators.ts';
import { applyGeneratorOverrides } from '../src/overrides.ts';
import { generateCluster, generatePanel, generateRelationManager, generateResourcePage, generateResourceWidget, generateTheme, relativeImport, type GeneratedFiles } from '../src/panel-generators.ts';

// Generated files are written inside the repository, so that they resolve the @navette-js packages like a project would.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), `.tmp-${randomBytes(4).toString('hex')}`);
const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');
const writeFiles = (files: GeneratedFiles, base = root) => {
    for (const [file, content] of Object.entries(files)) {
        const target = path.join(base, ...file.split('/'));
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
    }
};
const load = async (file: string) => import(pathToFileURL(path.join(root, ...file.split('/'))).href);
const ada: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
let db: Knex;

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('categories', (table) => { table.increments('id'); table.string('name'); table.timestamp('deleted_at').nullable(); });
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.integer('category_id').nullable(); table.string('title'); table.timestamp('deleted_at').nullable(); });
    await db.schema.createTable('tags', (table) => { table.increments('id'); table.string('label'); });
    await db.schema.createTable('category_tag', (table) => { table.integer('category_id'); table.integer('tag_id'); });
    await db('categories').insert([{ id: 1, name: 'News' }, { id: 2, name: 'Guides' }]);
    await db('posts').insert([{ id: 1, category_id: 1, title: 'Hello' }, { id: 2, category_id: 1, title: 'World' }, { id: 3, category_id: 2, title: 'Elsewhere' }, { id: 4, category_id: null, title: 'Orphan' }]);
    await db('tags').insert([{ id: 1, label: 'red' }, { id: 2, label: 'blue' }]);
    await db('category_tag').insert([{ category_id: 1, tag_id: 1 }]);
});
after(async () => { rmSync(root, { recursive: true, force: true }); await db.destroy(); });

test('relative imports between project files', () => {
    assert.equal(relativeImport('src/admin/resources/Category/RelationManagers/PostsRelationManager.ts', 'src/models/Post.ts'), '../../../../models/Post.ts');
    assert.equal(relativeImport('src/admin/resources/PostResource.ts', 'src/admin/resources/CourseResource.ts'), './CourseResource.ts');
});

test('make:resource options: simple, view (with an infolist), soft deletes and nested resources', async () => {
    const columns = [{ name: 'id', type: 'integer', nullable: false }, { name: 'name', type: 'varchar', nullable: false }, { name: 'deleted_at', type: 'datetime', nullable: true }];
    const simple = generateResource('Category', 'categories', columns, { simple: true }).resource;
    assert.match(simple, /static isSimple = true;/);
    const view = generateResource('Category', 'categories', columns, { view: true, softDeletes: true });
    assert.match(view.resource, /static hasViewPage = true;/);
    assert.match(view.resource, /static infolist\(schema: Schema\): Schema/);
    assert.match(view.resource, /softDeletes: 'deleted_at'/);
    assert.match(view.resource, /TrashedFilter\.make\(\)/);
    writeFiles({ 'src/models/Category.ts': view.model, 'src/admin/resources/CategoryResource.ts': view.resource });
    const nested = generateResource('Post', 'posts', [{ name: 'id', type: 'integer', nullable: false }, { name: 'title', type: 'varchar', nullable: false }], { nested: 'CategoryResource' });
    assert.match(nested.resource, /static parentResource = \(\) => CategoryResource;/);
    writeFiles({ 'src/models/Post.ts': nested.model, 'src/admin/resources/PostResource.ts': nested.resource });
    const { CategoryResource } = await load('src/admin/resources/CategoryResource.ts');
    const { PostResource } = await load('src/admin/resources/PostResource.ts');
    assert.equal(CategoryResource.hasViewPage, true);
    assert.deepEqual(Object.keys(CategoryResource.getPages()).sort(), ['create', 'edit', 'index', 'view']);
    assert.equal(PostResource.parentResource(), CategoryResource);
});

test('make:relation-manager: one-to-many with associate, many-to-many with attach, and soft deletes', async () => {
    const posts = generateRelationManager('CategoryResource', 'posts', 'title', { panel: 'admin', associate: true, softDeletes: true, view: true });
    assert.equal(posts.file, 'src/admin/resources/Category/RelationManagers/PostsRelationManager.ts');
    writeFiles(posts.files);
    const tags = generateRelationManager('CategoryResource', 'tags', 'label', { panel: 'admin', attach: true });
    writeFiles({ ...tags.files, 'src/models/Tag.ts': generateResource('Tag', 'tags', null).model });
    const related = generateRelationManager('CategoryResource', 'posts', 'title', { panel: 'admin', relatedResource: 'PostResource' });
    assert.match(related.files[related.file], /static relatedResource = \(\) => PostResource;/);
    const { PostsRelationManager } = await load(posts.file);
    const { TagsRelationManager } = await load(tags.file);
    // The related records of the owner only.
    assert.deepEqual((await PostsRelationManager.adapterFor('1').paginate({ page: 1, perPage: 10 })).records.map((post: any) => post.title).sort(), ['Hello', 'World']);
    // Associable: posts of no category or of another one.
    assert.deepEqual((await PostsRelationManager.searchAssociable('1', '')).map(([, label]: [string, string]) => label).sort(), ['Elsewhere', 'Orphan']);
    await PostsRelationManager.associate('1', '4');
    assert.equal((await db('posts').where('id', 4).first()).category_id, 1);
    await PostsRelationManager.dissociate('1', ['4']);
    assert.equal((await db('posts').where('id', 4).first()).category_id, null);
    assert.equal(await PostsRelationManager.associableLabel('1', '1'), null, 'a post of the owner is not associable');
    // Attach: through the pivot table, only records not attached yet.
    assert.deepEqual((await TagsRelationManager.adapterFor('1').paginate({ page: 1, perPage: 10 })).records.map((tag: any) => tag.label), ['red']);
    assert.deepEqual(await TagsRelationManager.searchAttachable('1', 'bl'), [['2', 'blue']]);
    await TagsRelationManager.attach('1', '2');
    assert.equal((await db('category_tag').where({ category_id: 1 })).length, 2);
    await TagsRelationManager.detach('1', ['2']);
    assert.equal((await db('category_tag').where({ category_id: 1 })).length, 1);
});

test('make:page --resource and make:widget --resource generate classes working on the resource', async () => {
    const page = generateResourcePage('ManageCategoryPosts', 'CategoryResource', 'ManageRelatedRecords', { panel: 'admin', relationship: 'posts' });
    assert.match(page.register, /relatedPages = \{ 'posts': ManageCategoryPosts \}/);
    writeFiles(page.files);
    const edit = generateResourcePage('EditCategory', 'CategoryResource', 'EditRecord', { panel: 'admin' });
    writeFiles(edit.files);
    const widget = generateResourceWidget('CategoryStats', 'CategoryResource', 'stats', { panel: 'admin' });
    writeFiles(widget.files);
    for (const type of ['chart', 'table'] as const) writeFiles(generateResourceWidget(`Category${type}`, 'CategoryResource', type, { panel: 'admin' }).files);
    const { ManageCategoryPosts } = await load(page.file);
    const { EditCategory } = await load(edit.file);
    const { CategoryStats } = await load(widget.file);
    await load('src/admin/resources/Category/Widgets/Categorychart.ts');
    await load('src/admin/resources/Category/Widgets/Categorytable.ts');
    assert.deepEqual((await ManageCategoryPosts.adapterFor('2').paginate({ page: 1, perPage: 10 })).records.map((post: any) => post.title), ['Elsewhere']);
    const { CategoryResource } = await load('src/admin/resources/CategoryResource.ts');
    CategoryResource.pages = { edit: EditCategory };
    CategoryResource.widgets = [CategoryStats];
    CategoryResource.headerWidgets = [CategoryStats];
    const panel = Panel.make().id('generated-cli').key('k').auth({ find: async () => ada } as any).resources([CategoryResource]);
    setCurrentPanel(panel);
    actingAs(ada);
    const stats = livewire(CategoryStats, { tableSearch: 'News' });
    await stats.assertOk();
    assert.match(stats.html(), />1</, 'the stats follow the table search');
    assert.ok(EditCategory.prototype instanceof (await import('@navette-js/panels')).EditRecord);
});

test('make:panel, make:cluster and make:theme', async () => {
    const files = generatePanel('staff');
    assert.deepEqual(Object.keys(files).sort(), ['src/panels/staff.ts', 'src/staff/pages/Dashboard.ts', 'src/staff/resources/.gitkeep', 'src/staff/widgets/.gitkeep']);
    writeFiles({
        ...files,
        'src/database.ts': "import { sqlite } from '@navette-js/database';\nexport const db = sqlite(':memory:');\n",
        'src/users.ts': "import { knexAuthProvider } from '@navette-js/panels';\nimport { db } from './database.ts';\nexport const users = knexAuthProvider((table) => db(table));\n",
    });
    process.env.APP_KEY ??= 'test-key';
    const panel = (await load('src/panels/staff.ts')).default as Panel;
    assert.equal(panel.getId(), 'staff');
    assert.deepEqual(panel.getPages().map((page) => page.slug), ['']);
    const cluster = generateCluster('Settings', 'admin');
    writeFiles(cluster);
    const { SettingsCluster } = await load('src/admin/clusters/SettingsCluster.ts');
    assert.equal(SettingsCluster.getSlug(), 'settings');
    const theme = generateTheme('staff');
    assert.match(theme.files['resources/css/staff/theme.css'], /@import '@navette-js\/panels\/theme.css';/);
    assert.equal(theme.script.command, 'tailwindcss -i resources/css/staff/theme.css -o storage/public/css/staff/theme.css --minify');
});

test('navette.generators.ts changes the generated files; a path outside the project is refused', async () => {
    const project = path.join(root, 'project-overrides');
    mkdirSync(project, { recursive: true });
    writeFileSync(path.join(project, 'navette.generators.ts'), `export default {
    cluster(files, { name }) { return Object.fromEntries(Object.entries(files).map(([file, content]) => [file, content.replace("'o-squares-2x2'", "'o-cog-6-tooth'") + '// ' + name + '\\n'])); },
    theme() { return { '../escape.css': '' }; },
};
`);
    const files = await applyGeneratorOverrides(project, 'cluster', generateCluster('Settings', 'admin'), { name: 'Settings' });
    assert.match(files['src/admin/clusters/SettingsCluster.ts'], /'o-cog-6-tooth'/);
    assert.match(files['src/admin/clusters/SettingsCluster.ts'], /\/\/ Settings\n$/);
    await assert.rejects(applyGeneratorOverrides(project, 'theme', generateTheme('admin').files), /outside the project/);
    // Without an override, the files are unchanged.
    assert.deepEqual(await applyGeneratorOverrides(project, 'panel', generatePanel('x')), generatePanel('x'));
});

test('the CLI writes the files of the new commands, never overwriting without --force', () => {
    const project = path.join(root, 'project-cli');
    mkdirSync(project, { recursive: true });
    writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'demo', scripts: {} }));
    const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    run('make:panel', 'staff');
    assert.ok(existsSync(path.join(project, 'src', 'panels', 'staff.ts')));
    assert.match(readFileSync(path.join(project, 'src', 'panels', 'staff.ts'), 'utf8'), /knexAuthProvider\(\(table\) => db\(table\)\)/, 'without src/users.ts, the panel has its own provider');
    run('make:cluster', 'Settings', '--panel=staff');
    assert.ok(existsSync(path.join(project, 'src', 'staff', 'clusters', 'SettingsCluster.ts')));
    run('make:relation-manager', 'CategoryResource', 'posts', 'title', '--attach');
    assert.match(readFileSync(path.join(project, 'src', 'admin', 'resources', 'Category', 'RelationManagers', 'PostsRelationManager.ts'), 'utf8'), /category_post/);
    run('make:page', 'ManageCategoryPosts', '--resource=CategoryResource', '--type=ManageRelatedRecords');
    run('make:widget', 'CategoryStats', '--resource=CategoryResource');
    run('make:theme', '--panel=staff');
    assert.equal(JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8')).scripts['build:theme:staff'], 'tailwindcss -i resources/css/staff/theme.css -o storage/public/css/staff/theme.css --minify');
    assert.throws(() => run('make:cluster', 'Settings', '--panel=staff'), /already exists/);
    run('make:cluster', 'Settings', '--panel=staff', '--force');
    assert.throws(() => run('make:page', 'X', '--resource=CategoryResource', '--type=Unknown'), /--type must be one of/);
});
