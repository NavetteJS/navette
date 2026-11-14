import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextInput, Toggle } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { CreateAction, EditAction, EditRecord, ManageRelatedRecords, Panel, ParentResourceRegistration, RelationManager, Resource, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel } from '../src/testing.ts';

class Project extends Model { static tableName = 'projects'; declare id: number; declare name: string; }
class Task extends Model { static tableName = 'tasks'; declare id: number; declare project_id: number; declare title: string; }
class Note extends Model { static tableName = 'notes'; declare id: number; declare task_id: number; declare body: string; }
class SiteSetting extends Model { static tableName = 'site_settings'; declare id: number; declare site_name: string; declare kind: string; }

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
/** May manage tasks, but may not access projects. */
const bob: User = { id: 2, name: 'Bob', email: 'bob@example.test' };
/** May only read the settings. */
const reader: User = { id: 3, name: 'Reader', email: 'reader@example.test' };

class TasksRelationManager extends RelationManager {
    // A function: TaskResource is defined below (it breaks circular imports between files the same way).
    static relatedResource = () => TaskResource;
}
class ProjectResource extends Resource {
    static slug = 'projects';
    static modelLabel = 'project';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(Project);
    static relations = [TasksRelationManager];
    // The form is the first tab: `?relation=tasks` opens the tasks tab instead.
    static pages = { edit: class EditProject extends EditRecord { hasCombinedRelationManagerTabsWithContent(): boolean { return true; } } };
    static policy = { viewAny: (user: User) => user.id !== bob.id };
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name').required()]); }
}
class TaskNotes extends ManageRelatedRecords {
    static relatedResource = () => NoteResource;
}
class TaskResource extends Resource {
    static slug = 'tasks';
    static modelLabel = 'task';
    static recordTitleAttribute = 'title';
    static parentResource = ProjectResource;
    static adapter = new ObjectionAdapter(Task);
    static relatedPages = { notes: TaskNotes };
    static form(schema: Schema): Schema { return schema.components([TextInput.make('title').required(), TextInput.make('project_id')]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('title')]).headerActions([CreateAction.make()]).recordActions([EditAction.make()]); }
}
/** Two levels deep, with custom relationship names: `/projects/{project}/tasks/{task}/notes/...`. */
class NoteResource extends Resource {
    static slug = 'notes';
    static modelLabel = 'note';
    static recordTitleAttribute = 'body';
    static adapter = new ObjectionAdapter(Note);
    static getParentResourceRegistration(): ParentResourceRegistration { return TaskResource.asParent().relationship('notes').inverseRelationship('task'); }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('body').required()]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('body')]).recordActions([EditAction.make()]); }
}
class SiteSettingsResource extends Resource {
    static slug = 'site-settings';
    static modelLabel = 'site settings';
    static navigationIcon = 'o-cog-6-tooth';
    static isSingular = true;
    static adapter = new ObjectionAdapter(SiteSetting, { modify: (query) => { query.where('kind', 'site'); } });
    static policy = { viewAny: () => true, create: (user: User) => user.id !== reader.id, update: (user: User) => user.id !== reader.id };
    static getSingularRecordAttributes() { return { kind: 'site' }; }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('site_name').required().default('My site'), Toggle.make('maintenance')]); }
}

const auth = { find: async () => ada } as any;
// The nested resources come first: the panel registers the parents before them.
const panel = Panel.make().id('nested-resources').key('nested-key').auth(auth).resources([NoteResource, TaskResource, ProjectResource, SiteSettingsResource]);
const tasks = TaskResource.getPages() as Record<string, any>;
const notes = NoteResource.getPages() as Record<string, any>;
let db: Knex;
let website: number, mobile: number, homepage: number, login: number, draft: number;

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('projects', (table) => { table.increments('id'); table.string('name'); });
    await db.schema.createTable('tasks', (table) => { table.increments('id'); table.integer('project_id'); table.string('title'); });
    await db.schema.createTable('notes', (table) => { table.increments('id'); table.integer('task_id'); table.string('body'); });
    await db.schema.createTable('site_settings', (table) => { table.increments('id'); table.string('kind'); table.string('site_name'); table.boolean('maintenance').defaultTo(false); });
    setCurrentPanel(panel);
});
after(() => db.destroy());
beforeEach(async () => {
    actingAs(ada);
    for (const name of ['notes', 'tasks', 'projects', 'site_settings']) await db(name).delete();
    [website, mobile] = await Promise.all([db('projects').insert({ name: 'Website' }).then(([id]) => id), db('projects').insert({ name: 'Mobile app' }).then(([id]) => id)]);
    [homepage] = await db('tasks').insert({ project_id: website, title: 'Homepage' });
    [login] = await db('tasks').insert({ project_id: mobile, title: 'Login screen' });
    [draft] = await db('notes').insert({ task_id: homepage, body: 'First draft' });
    // A note of another kind of settings, which the singular resource must not pick up.
    await db('site_settings').insert({ kind: 'mail', site_name: 'Mailer' });
});

test('a nested resource is served under its parent record, without a list nor a menu item', () => {
    assert.deepEqual(Object.keys(tasks).sort(), ['create', 'edit', 'notes']);
    assert.equal(tasks.create.slug, 'projects/{project}/tasks/create');
    assert.equal(tasks.edit.slug, 'projects/{project}/tasks/{record}/edit');
    assert.equal(tasks.notes.slug, 'projects/{project}/tasks/{record}/notes');
    assert.equal(notes.edit.slug, 'projects/{project}/tasks/{task}/notes/{record}/edit');
    assert.ok(Object.values(tasks).every((page) => page.shouldRegisterNavigation === false));
    assert.equal(TaskResource.canGloballySearch(), false);
    const registration = TaskResource.getParentResourceRegistration()!;
    assert.equal(registration.getRelationshipName(), 'tasks');
    assert.equal(registration.getInverseRelationshipName(), 'project');
    assert.equal(registration.getForeignKey(), 'project_id');
    assert.equal(registration.getParentRouteParameterName(), 'project');
});

test('getUrl() takes the parent record (or its key); the index URL is the parent page with the relation manager open', async () => {
    const project = await Project.query().findById(website);
    assert.equal(TaskResource.getUrl('create', { project }), '/projects/1/tasks/create'.replace('1', String(website)));
    assert.equal(TaskResource.getUrl('edit', { project: website, record: homepage }), `/projects/${website}/tasks/${homepage}/edit`);
    assert.equal(TaskResource.getUrl('edit', homepage, { project: website }), `/projects/${website}/tasks/${homepage}/edit`);
    assert.equal(TaskResource.getUrl('index', { project: website }), `/projects/${website}/edit?relation=tasks`);
    assert.equal(NoteResource.getUrl('edit', { project: website, task: homepage, record: draft }), `/projects/${website}/tasks/${homepage}/notes/${draft}/edit`);
    // Without a related page named after the relationship, the index of the notes is the task's notes page.
    assert.equal(NoteResource.getUrl('index', { project: website, task: homepage }), `/projects/${website}/tasks/${homepage}/notes`);
    assert.throws(() => TaskResource.getUrl('create'), /the "project" parameter/);
    // Other parameters go to the query string.
    assert.equal(ProjectResource.getUrl('edit', { record: website, relation: 'tasks' }), `/projects/${website}/edit?relation=tasks`);
});

test('creating a nested record attaches it to the parent, whatever the form says, and redirects to its nested edit page', async () => {
    await livewire(tasks.create, { project: website })
        .assertOk()
        .assertSee('Create Task')
        .fillForm({ title: 'Contact form', project_id: String(mobile) })
        .call('create')
        .assertHasNoFormErrors();
    const created = await db('tasks').where('title', 'Contact form').first();
    assert.equal(created.project_id, website, 'the parent key comes from the URL');
    const page = livewire(tasks.create, { project: website }).fillForm({ title: 'Footer' }).call('create');
    await page;
    const footer = await db('tasks').where('title', 'Footer').first();
    await page.assertRedirect(`/projects/${website}/tasks/${footer.id}/edit`);
});

test('the edit page shows the parent breadcrumbs and saves within the parent', async () => {
    const page = livewire(tasks.edit, { project: website, record: homepage });
    await page.assertOk();
    const crumbs = page.instance().getBreadcrumbs();
    assert.deepEqual(crumbs.map((crumb: any) => crumb.label), ['Projects', 'Website', 'Tasks', 'Homepage', 'Edit']);
    assert.deepEqual(crumbs.map((crumb: any) => crumb.url), ['/projects', `/projects/${website}/edit`, `/projects/${website}/edit?relation=tasks`, `/projects/${website}/tasks/${homepage}/edit`, null]);
    await page.fillForm({ title: 'Home page', project_id: String(mobile) }).call('save').assertHasNoFormErrors().assertNotified();
    const saved = await db('tasks').where('id', homepage).first();
    assert.deepEqual([saved.title, saved.project_id], ['Home page', website], 'the record cannot be moved to another parent through the form');
});

test('a forged URL with a record of another parent, or an unknown parent, is refused', async () => {
    // The login screen task belongs to the mobile app project.
    await livewire(tasks.edit, { project: website, record: login }).assertNotFound();
    await livewire(tasks.edit, { project: 9999, record: homepage }).assertNotFound();
    await livewire(tasks.create, { project: 9999 }).assertNotFound();
    await livewire(notes.edit, { project: mobile, task: homepage, record: draft }).assertNotFound();
    await livewire(notes.edit, { project: website, task: login, record: draft }).assertNotFound();
    await livewire(tasks.notes, { project: mobile, record: homepage }).assertNotFound();
    // The right parents work.
    await livewire(notes.edit, { project: website, task: homepage, record: draft }).assertOk().assertSee('First draft');
    await livewire(tasks.notes, { project: website, record: homepage }).assertOk().assertSee('First draft');
});

test('the parent keys are locked and re-checked on every request', async () => {
    const page = livewire(tasks.edit, { project: website, record: homepage });
    await page.set('parentRecordKeys', { project: String(mobile) }).assertForbidden();
    await page.set('parentRecordKeys.project', String(mobile)).assertForbidden();
    // The task is moved to another project after the page was displayed: the next request no longer finds it.
    const moved = livewire(tasks.edit, { project: website, record: homepage });
    await moved.assertOk();
    await db('tasks').where('id', homepage).update({ project_id: mobile });
    await moved.call('save').assertNotFound();
});

test('every parent resource must be accessible to the user', async () => {
    actingAs(bob);
    await livewire(tasks.edit, { project: website, record: homepage }).assertForbidden();
    await livewire(tasks.create, { project: website }).assertForbidden();
    await livewire(notes.edit, { project: website, task: homepage, record: draft }).assertForbidden();
});

test('a relation manager with a related resource links to the nested pages, scoped to its owner', async () => {
    const manager = livewire(TasksRelationManager, { ownerRecord: String(website) });
    await manager.assertOk().assertSee('Homepage').assertDontSee('Login screen');
    const html = manager.html();
    assert.ok(html.includes(`/projects/${website}/tasks/create`), 'the create action links to the create page');
    assert.ok(html.includes(`/projects/${website}/tasks/${homepage}/edit`), 'rows and the edit action link to the edit page');
    assert.equal(TasksRelationManager.getTitle(), 'Tasks');
    // The related page of the nested resource lists the task's notes and links to their nested pages.
    const related = livewire(tasks.notes, { project: website, record: homepage });
    await related.assertOk();
    assert.ok(related.html().includes(`/projects/${website}/tasks/${homepage}/notes/${draft}/edit`));
    assert.deepEqual(related.instance().getBreadcrumbs().map((crumb: any) => crumb.label), ['Projects', 'Website', 'Tasks', 'Homepage', 'Notes']);
});

test('?relation= opens that relation manager tab on the parent page', async () => {
    const page = livewire((ProjectResource.getPages() as any).edit, { record: website }, { query: { relation: 'tasks' } });
    await page.assertOk().assertSet('activeRelationManager', '0');
});

test('the scoped adapter refuses writes outside its scope', async () => {
    const scoped = TaskResource.adapter.scopedTo!('project_id', String(website));
    assert.equal(await scoped.find(login), null);
    assert.equal(await scoped.update(login, { title: 'Hacked' }), null);
    assert.equal(await scoped.delete(login), false);
    assert.equal((await db('tasks').where('id', login).first()).title, 'Login screen');
    assert.deepEqual(await scoped.keysInScope([homepage, login]), [String(homepage)]);
});

test('a singular resource is served at its URL by its edit page, which creates the record on the first save', async () => {
    const pages = SiteSettingsResource.getPages() as Record<string, any>;
    assert.deepEqual(Object.keys(pages), ['edit']);
    assert.equal(pages.edit.slug, 'site-settings');
    assert.equal(pages.edit.shouldRegisterNavigation, true);
    assert.equal(SiteSettingsResource.getUrl(), '/site-settings');
    assert.equal(SiteSettingsResource.getUrl('edit'), '/site-settings');
    const page = livewire(pages.edit);
    await page.assertOk().assertSee('Site Settings').assertSet('data.site_name', 'My site');
    assert.deepEqual(page.instance().getBreadcrumbs(), []);
    await page.fillForm({ site_name: 'Navette' }).call('save').assertHasNoFormErrors().assertNotified();
    let rows = await db('site_settings').where('kind', 'site');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].site_name, 'Navette');
    // Saving again updates the same record; a new page loads it.
    await page.fillForm({ site_name: 'Navette 2' }).call('save').assertHasNoFormErrors();
    await livewire(pages.edit).assertSet('data.site_name', 'Navette 2');
    rows = await db('site_settings').where('kind', 'site');
    assert.equal(rows.length, 1);
    assert.equal((await db('site_settings').where('kind', 'mail').first()).site_name, 'Mailer', 'records outside the resource scope are left alone');
});

test('a singular resource checks create, then update, and viewAny for the menu', async () => {
    const pages = SiteSettingsResource.getPages() as Record<string, any>;
    actingAs(reader);
    await livewire(pages.edit).assertForbidden();
    await db('site_settings').insert({ kind: 'site', site_name: 'Existing' });
    await livewire(pages.edit).assertForbidden();
    actingAs(ada);
    await livewire(pages.edit).assertOk().assertSet('data.site_name', 'Existing');
    assert.equal(await panel.canAccessPage(pages.edit, reader), true);
});
