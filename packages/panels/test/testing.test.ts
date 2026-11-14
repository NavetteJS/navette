import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { fillSchema, getSchemaState, Select, TextInput, Toggle, validateSchema } from '@navette-js/forms';
import { Actions, EmbeddedSchema, Form, Section, type Schema } from '@navette-js/schemas';
import { Average, SelectFilter, Sum, TernaryFilter, TextColumn, type Table } from '@navette-js/tables';
import { CreateAction, DeleteAction, DeleteBulkAction, ExportAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, Notification, Page, Panel, RelationManager, Resource, RowImportFailedError, Stat, StatsOverviewWidget, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel, TestAction, UploadedFile } from '../src/testing.ts';

class Comment extends Model { static tableName = 'comments'; }
/** Comments of one post: the foreign key comes from the owner, never from the form. */
class PostComments extends ObjectionAdapter<Comment> {
    private post: string;
    constructor(post: string) { super(Comment, { modify: (query) => { query.where('comments.post_id', post); } }); this.post = post; }
    create(data: Record<string, unknown>) { return super.create({ ...data, post_id: this.post }); }
}
class CommentsRelationManager extends RelationManager {
    static relationship = 'comments';
    static modelLabel = 'comment';
    static adapterFor(ownerKey: string) { return new PostComments(ownerKey); }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('body').required()]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('body')]).headerActions([CreateAction.make()]).recordActions([DeleteAction.make()]); }
}
class PostStats extends StatsOverviewWidget {
    async getStats(): Promise<Stat[]> { return [Stat.make('Posts', (await db('posts').count({ count: '*' }).first())!.count as number)]; }
}
class Post extends Model { static tableName = 'posts'; declare id: number; declare title: string; declare status: string; declare views: number; declare is_featured: number; }
let db: Knex;

class PostExporter extends Exporter {
    static getColumns(): ExportColumn[] { return [ExportColumn.make('title'), ExportColumn.make('views').formatStateUsing((state) => `${state} views`), ExportColumn.make('status').enabledByDefault(false)]; }
}
class PostImporter extends Importer {
    static getColumns(): ImportColumn[] { return [ImportColumn.make('title').requiredMapping().rules(['required', 'max:20']), ImportColumn.make('views').numeric().rules(['numeric'])]; }
    static async beforeSave(data: Record<string, unknown>): Promise<void> { if (data.title === 'Forbidden') throw new RowImportFailedError('This title is not allowed.'); data.status ??= 'draft'; }
}

class PostResource extends Resource {
    static slug = 'posts';
    static modelLabel = 'post';
    static adapter = new ObjectionAdapter(Post);
    static relations = [CommentsRelationManager];
    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required().maxLength(20),
            Select.make('status').options([['draft', 'Draft'], ['published', 'Published']]).default('draft').required(),
            Toggle.make('is_featured').live(),
            // Only shown for featured posts.
            TextInput.make('headline').visible(({ get }) => Boolean(get('is_featured'))),
            TextInput.make('slug').disabled(),
            Section.make('Meta').key('meta').schema([TextInput.make('views').numeric()])
                .headerActions([Action.make('resetViews').action(({ livewire }) => { (livewire as any).data.views = 0; })]),
        ]);
    }
    static table(table: Table<Post>): Table<Post> {
        return table
            .columns([
                TextColumn.make<Post>('title').searchable({ isIndividual: true, isGlobal: true }).sortable().description((record) => `${record.views} views`),
                TextColumn.make<Post>('status').toggleable(true, { isToggledHiddenByDefault: true }),
                TextColumn.make<Post>('views').sortable().summarize([Sum.make(), Average.make()]),
            ])
            .filters([SelectFilter.make('status').options([['draft', 'Draft'], ['published', 'Published']]), TernaryFilter.make('is_featured')])
            .headerActions([ExportAction.make().exporter(PostExporter), ImportAction.make().importer(PostImporter)])
            .recordActions([
                Action.make('publish')
                    .visible(({ record }) => (record as Post | null)?.status !== 'published')
                    .schema([TextInput.make('reason').required()])
                    .extraModalFooterActions([Action.make('preview').action(() => { Notification.make().title('Preview ready').send(); })])
                    .action(async ({ record, data, action }) => {
                        if (data.reason === 'wait') (action as Action).halt();
                        await PostResource.adapter.update(String((record as Post).id), { status: 'published' });
                        Notification.make().success().title('Published').send();
                    }),
            ])
            .groupedBulkActions([DeleteBulkAction.make()]);
    }
}

class Settings extends Page {
    static slug = 'settings';
    static callable = ['save', 'goHome'];
    static locked = ['plan'];
    data: Record<string, unknown> = {};
    plan = 'free';
    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    formSchema(schema: Schema): Schema { return schema.components([TextInput.make('site_name').required().email()]); }
    contentSchema(schema: Schema): Schema {
        return schema.components([Form.make([EmbeddedSchema.make('form')]).id('form').livewireSubmitHandler('save').footer([Actions.make([Action.make('save').submit('save')])])]);
    }
    getHeaderActions(): Action[] {
        return [
            Action.make('rename').schema([TextInput.make('name').required()]).action(({ data }) => { Notification.make().title(`Renamed to ${data.name}`).send(); }),
            Action.make('ping').action(({ livewire }) => { (livewire as any).dispatch('pinged', { at: 'now' }); }),
            Action.make('secret').hidden(),
            Action.make('locked').disabled(),
            Action.make('help').label('Help').color('gray').icon('o-question-mark-circle').url('https://example.test/help').openUrlInNewTab(),
            Action.make('wizard').schema([TextInput.make('step')]).extraModalFooterActions([Action.make('suggest').action(() => { Notification.make().title('Suggested').send(); })]).action(() => {}),
        ];
    }
    async save(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        Notification.make().success().title(`Saved ${(await getSchemaState(form)).site_name}`).send();
    }
    goHome(): void { this.redirect('/home'); }
    /** Not callable: a forged call must fail. */
    deleteEverything(): void { throw new Error('must not run'); }
}
class Forbidden extends Page { static slug = 'forbidden'; static canAccess(): boolean { return false; } }

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const auth = { find: async () => user } as any;
const panel = Panel.make().id('testing-helpers').key('testing-key').auth(auth).resources([PostResource]).pages([Settings, Forbidden]).widgets([PostStats]);
const pages = PostResource.getPages() as Record<string, any>;
const ids = async () => (await db('posts').orderBy('id')).map((row: any) => row.id);

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.string('status'); table.integer('views').defaultTo(0); table.boolean('is_featured').defaultTo(false); table.string('headline').nullable(); table.string('slug').nullable(); });
    await db.schema.createTable('comments', (table) => { table.increments('id'); table.integer('post_id'); table.string('body'); });
    setCurrentPanel(panel);
    actingAs(user);
});
after(() => db.destroy());
beforeEach(async () => {
    await db('posts').delete();
    await db('comments').delete();
    await db('posts').insert([
        { title: 'Alpha', status: 'draft', views: 10, is_featured: true },
        { title: 'Bravo', status: 'published', views: 20, is_featured: false },
        { title: 'Charlie', status: 'draft', views: 30, is_featured: false },
    ]);
});

test('a list page mounts through the runtime and shows, searches, sorts and filters its records', async () => {
    const [alpha, bravo, charlie] = await ids();
    await livewire(pages.index)
        .assertOk()
        .assertCanSeeTableRecords([alpha, bravo, charlie])
        .assertCountTableRecords(3)
        .searchTable('Bra')
        .assertCanSeeTableRecords([bravo])
        .assertCanNotSeeTableRecords([alpha, charlie])
        .searchTable()
        .sortTable('title', 'desc')
        .assertCanSeeTableRecords([charlie, bravo, alpha], { inOrder: true })
        .filterTable('status', 'draft')
        .assertCanSeeTableRecords([alpha, charlie])
        .assertCanNotSeeTableRecords([bravo])
        .resetTableFilters()
        .filterTable('is_featured')
        .assertCanSeeTableRecords([alpha])
        .assertCanNotSeeTableRecords([bravo, charlie]);
    // A record object works as well as its key.
    const record = await Post.query().findById(alpha);
    await livewire(PostResource.pages.index ?? pages.index).assertCanSeeTableRecords([record]);
});

test('in-order assertions fail on the wrong order, with an AssertionError', async () => {
    const [alpha, bravo] = await ids();
    await assert.rejects(() => livewire(pages.index).sortTable('title', 'asc').assertCanSeeTableRecords([bravo, alpha], { inOrder: true }), assert.AssertionError);
    await assert.rejects(() => livewire(pages.index).assertCanNotSeeTableRecords([alpha]), /does not show the record/);
});

test('columns, filters and summaries', async () => {
    await livewire(pages.index)
        .assertTableColumnExists('title')
        .assertTableColumnExists('views', (column) => column.isSortable())
        .assertTableColumnDoesNotExist('body')
        .assertTableColumnHidden('status')
        .assertTableColumnStateSet('title', 'Alpha', (await ids())[0])
        .assertTableFilterExists('status')
        .assertTableColumnSummarySet('views', 'sum', 60)
        .assertTableColumnSummarySet('views', 'average', 20)
        .filterTable('status', 'draft')
        .assertTableColumnSummarySet('views', 'sum', 40)
        .assertTableColumnSummaryNotSet('views', 'sum', 60);
    await assert.rejects(() => livewire(pages.index).assertTableFilterExists('missing'), /table filter with name \[missing\] exists/);
});

test('row actions: a modal form, validation, `halt()`, a nested footer action, and visibility per record', async () => {
    const [alpha, bravo] = await ids();
    await livewire(pages.index)
        .assertTableActionVisible('publish', alpha)
        .assertTableActionHidden('publish', bravo)
        .assertActionVisible(TestAction.make('publish').table(alpha))
        .callTableAction('publish', alpha, { reason: '' })
        .assertHasFormErrors({ reason: 'required' })
        .assertActionMounted(TestAction.make('publish').table(alpha))
        .fillForm({ reason: 'wait' })
        .callMountedAction()
        .assertHasNoFormErrors()
        .assertActionHalted('publish')
        // The footer action of the open modal.
        .callAction('preview')
        .assertNotified('Preview ready')
        .unmountAction()
        .assertActionNotMounted()
        .callAction(TestAction.make('publish').table(alpha), { reason: 'Ready' })
        .assertHasNoFormErrors()
        .assertNotified('Published')
        .assertActionNotMounted();
    assert.equal((await db('posts').where('id', alpha).first()).status, 'published');
    // Nested actions given at once: the parent's modal opens, then its footer action runs.
    await livewire(pages.index).callAction([TestAction.make('publish').table((await ids())[2]), 'preview']).assertNotified('Preview ready');
});

test('a hidden row action cannot be called, even by a forged mount', async () => {
    const bravo = (await ids())[1];
    await assert.rejects(() => livewire(pages.index).callTableAction('publish', bravo, { reason: 'x' }), /is visible/);
    // Bypassing the helpers, the server still refuses it.
    await livewire(pages.index).call('mountAction', 'publish', {}, { table: true, recordKey: String(bravo) }).assertForbidden();
    assert.equal((await db('posts').where('id', bravo).first()).status, 'published');
});

test('bulk actions act on the selected records', async () => {
    const [alpha, bravo, charlie] = await ids();
    await livewire(pages.index)
        .assertTableBulkActionExists('delete')
        .callTableBulkAction('delete', [alpha, bravo])
        .assertNotified()
        .assertCanSeeTableRecords([charlie])
        .assertCanNotSeeTableRecords([alpha, bravo]);
    assert.deepEqual(await ids(), [charlie]);
});

test('create page: fill the form, validation rules, notification and redirect', async () => {
    await livewire(pages.create)
        .assertOk()
        .assertSchemaStateSet({ status: 'draft' })
        .fillForm({ title: '' })
        .call('create')
        .assertHasFormErrors({ title: 'required' })
        .assertHasErrors(['data.title'])
        .assertNotNotified()
        .assertNoRedirect()
        .fillForm({ title: 'A title that is far too long' })
        .call('create')
        .assertHasFormErrors({ title: 'max' })
        .fillForm({ title: 'Delta', status: 'published' })
        .call('create')
        .assertHasNoFormErrors()
        .assertNotified('Created')
        .assertRedirect();
    const created = await db('posts').where('title', 'Delta').first();
    assert.equal(created.status, 'published');
    await assert.rejects(() => livewire(pages.create).fillForm({ title: '' }).call('create').assertHasNoFormErrors(), /Component has errors: \[data.title\] The title field is required/);
    await assert.rejects(() => livewire(pages.create).fillForm({ title: 'Ok' }).call('create').assertHasFormErrors({ title: 'required' }), /Component missing error: \[data.title\]/);
});

test('edit page: the record is loaded, fields are inspected, schema component actions run', async () => {
    const alpha = (await ids())[0];
    await livewire(pages.edit, { record: alpha })
        .assertOk()
        .assertSchemaStateSet({ title: 'Alpha', views: 10 })
        .assertFormFieldExists('title')
        .assertFormFieldExists('title', (field) => field.getName() === 'title')
        .assertFormFieldDoesNotExist('body')
        .assertFormFieldVisible('headline')
        .assertFormFieldEnabled('title')
        .assertFormFieldDisabled('slug')
        .assertSchemaComponentExists('meta')
        .assertSchemaComponentVisible('meta')
        .fillForm({ is_featured: false })
        .assertFormFieldHidden('headline')
        .assertActionExists(TestAction.make('resetViews').schemaComponent('meta'))
        .callAction(TestAction.make('resetViews').schemaComponent('meta'))
        .assertSchemaStateSet({ views: 0 })
        .fillForm({ title: 'Alpha 2' })
        .call('save')
        .assertHasNoFormErrors()
        .assertNotified();
    assert.equal((await db('posts').where('id', alpha).first()).title, 'Alpha 2');
    await livewire(pages.edit, { record: 9999 }).assertNotFound();
});

test('custom page: header actions, dispatches, redirects, and validation', async () => {
    await livewire(Settings)
        .assertOk()
        .assertActionExists('rename')
        .assertActionVisible('rename')
        .assertActionHidden('secret')
        .assertActionEnabled('rename')
        .assertActionDisabled('locked')
        .assertActionDoesNotExist('missing')
        .mountAction('rename')
        .assertActionMounted('rename')
        .assertMountedActionModalSee('Name')
        .setActionData({ name: '' })
        .callMountedAction()
        .assertHasActionErrors({ name: 'required' })
        .setActionData({ name: 'Navette' })
        .callMountedAction()
        .assertNotified('Renamed to Navette')
        .callAction('ping')
        .assertDispatched('pinged', { at: 'now' })
        .assertNotDispatched('ponged')
        .fillForm({ site_name: 'not an email' })
        .call('save')
        .assertHasFormErrors({ site_name: 'email' })
        .fillForm({ site_name: 'site@example.test' })
        .call('save')
        .assertNotified(Notification.make().success().title('Saved site@example.test'))
        .call('goHome')
        .assertRedirect('/home');
    await assert.rejects(() => livewire(Settings).callAction('secret'), /is visible/);
});

test('notifications are consumed by assertNotified() and assertNotNotified()', async () => {
    await livewire(Settings).callAction('rename', { name: 'One' }).assertNotified('Renamed to One').assertNotNotified();
    await assert.rejects(() => livewire(Settings).callAction('rename', { name: 'Two' }).assertNotified('Something else'), /\[Something else\] but not sent \(sent: \[Renamed to Two\]\)/);
});

test('security: locked properties, forged snapshots and non-callable methods are refused through the tester', async () => {
    const page = livewire(Settings);
    await page.set('plan', 'enterprise').assertForbidden().assertSet('plan', 'free');
    await page.call('deleteEverything').assertNotFound();
    await page.call('constructor').assertNotFound();
    // A refused request must be acknowledged: other assertions would pass for the wrong reason.
    await assert.rejects(() => livewire(Settings).set('plan', 'enterprise').assertSet('plan', 'free'), /failed with status 403 \(Locked property: plan\)/);
    // The record of an edit page is locked too.
    const [alpha, bravo] = await ids();
    await livewire(pages.edit, { record: alpha }).set('recordKey', String(bravo)).assertForbidden().assertSet('recordKey', String(alpha));
    // A tampered snapshot is rejected by its checksum.
    const tampered = livewire(Settings);
    await tampered;
    (tampered as any).snapshot.data.plan = 'enterprise';
    await tampered.call('save').assertStatus(419);
});

test('access: forbidden pages, guests and panel access', async () => {
    await livewire(Forbidden).assertForbidden();
    await livewire(Settings, {}, { user: null }).assertUnauthorized();
    const closed = Panel.make().id('testing-closed').key('testing-key').auth(auth).pages([Settings]).canAccess(() => false);
    await livewire(Settings, {}, { panel: closed }).assertForbidden();
    await assert.rejects(() => livewire(Forbidden).assertSee('anything'), /failed with status 403/);
});

test('rendered HTML: assertSee and assertDontSee', async () => {
    await livewire(pages.index).assertSee('Alpha').assertSeeText('Charlie').assertDontSee('Zulu').assertSeeHtml('fi-ta-table');
});

test('exports: the file of an export action, and Exporter.test()', async () => {
    const tester = livewire(pages.index);
    await tester.filterTable('status', 'draft').callAction(TestAction.make('export').table(), { columns: ['title', 'views'] }).assertNotified('Export completed');
    const csv = tester.getDownloads().find((file) => file.name.endsWith('.csv'))!;
    assert.equal(csv.content.toString('utf8').replace(/^﻿/, ''), 'Title,Views\r\nAlpha,10 views\r\nCharlie,30 views\r\n');
    const record = { title: 'Echo', views: 5, status: 'draft' };
    assert.deepEqual(PostExporter.test().export(record), ['Echo', '5 views']);
    assert.deepEqual(PostExporter.test({ status: 'State', title: 'Name' }).export(record), ['draft', 'Echo']);
    assert.deepEqual(PostExporter.test({ status: 'State' }).labels, ['State']);
});

test('imports: an uploaded CSV through the import action, and Importer.test()', async () => {
    await livewire(pages.index)
        .mountAction(TestAction.make('import').table())
        .fillForm({ file: UploadedFile.fake().createWithContent('posts.csv', 'Post title,Views\nEcho,5\nForbidden,1\n,3\n') })
        .fillForm({ columnMap: { title: 'Post title', views: 'Views' } })
        .assertSchemaStateSet({ columnMap: { title: 'Post title', views: 'Views' } })
        .callMountedAction()
        .assertHasNoFormErrors()
        .assertNotified('Import completed');
    assert.ok(await db('posts').where('title', 'Echo').first());
    assert.equal(await db('posts').where('title', 'Forbidden').first(), undefined);

    // A file with duplicate headers is refused by the upload field.
    await livewire(pages.index)
        .mountAction(TestAction.make('import').table())
        .fillForm({ file: UploadedFile.fake().createWithContent('dupes.csv', 'Views,Views\n1,2\n') })
        .callMountedAction()
        .assertHasFormErrors(['file']);

    const adapter = PostResource.adapter;
    const imported = await PostImporter.test({ adapter }).import({ title: 'Foxtrot', views: '7' });
    imported.assertImported().assertHasNoErrors();
    assert.equal(imported.getRecord().title, 'Foxtrot');
    (await PostImporter.test({ adapter }).import({ title: '', views: 'many' })).assertHasErrors({ title: 'required', views: 'numeric' });
    (await PostImporter.test({ adapter }).import({ title: 'A title longer than twenty' })).assertHasErrors(['title']).assertHasNoErrors(['views']);
    (await PostImporter.test({ adapter }).import({ title: 'Forbidden' })).assertHasRowFailure('This title is not allowed.');
    (await PostImporter.test({ adapter, columnMap: { title: 'Name' } }).import({ Name: 'Golf' })).assertImported();
    assert.throws(() => (PostImporter.test({ adapter }) as any).assertImported(), /Call import\(\) before asserting/);
});

test('relation managers and widgets are tested like pages', async () => {
    const [alpha, bravo] = await ids();
    const [mine] = await db('comments').insert({ post_id: alpha, body: 'First!' });
    const [theirs] = await db('comments').insert({ post_id: bravo, body: 'Other post' });
    await livewire(CommentsRelationManager, { ownerRecord: alpha })
        .assertOk()
        .assertCanSeeTableRecords([mine])
        .assertCanNotSeeTableRecords([theirs])
        .callAction(TestAction.make('create').table(), { body: 'Second' })
        .assertHasNoFormErrors()
        .assertNotified()
        // A comment of another post is not found through this manager.
        .call('mountAction', 'delete', {}, { table: true, recordKey: String(theirs) })
        .assertNotFound()
        .set('ownerRecord', String(bravo))
        .assertForbidden();
    assert.deepEqual((await db('comments').where('post_id', alpha).orderBy('id')).map((row: any) => row.body), ['First!', 'Second']);
    await livewire(PostStats).assertOk().assertSeeText('Posts').assertSeeText('3');
});

test('more helpers: column searches, toggled columns, descriptions, links, dotted nested actions, fake images', async () => {
    const [alpha, bravo] = await ids();
    await livewire(pages.index)
        .assertTableColumnHidden('status')
        .toggleAllTableColumns()
        .assertTableColumnVisible('status')
        .toggleAllTableColumns(false)
        .assertTableColumnHidden('status')
        .searchTableColumns({ title: 'Alp' })
        .assertCanSeeTableRecords([alpha])
        .assertCanNotSeeTableRecords([bravo])
        .assertTableColumnHasDescription('title', '10 views', alpha)
        .assertTableColumnDoesNotHaveDescription('title', '20 views', alpha)
        .filterTable('status', 'published')
        .removeTableFilter('status')
        .assertCountTableRecords(1);
    const page = livewire(Settings);
    await page
        .assertActionHasLabel('help', 'Help')
        .assertActionDoesNotHaveLabel('help', 'Aide')
        .assertActionHasColor('help', 'gray')
        .assertActionHasIcon('help', 'o-question-mark-circle')
        .assertActionHasUrl('help', 'https://example.test/help')
        .assertActionShouldOpenUrlInNewTab('help')
        .assertActionShouldNotOpenUrlInNewTab('rename')
        .callAction('wizard.suggest')
        .assertNotified('Suggested')
        .assertActionMounted('wizard')
        .refresh()
        .assertOk();
    assert.deepEqual(page.getNotifications().map((notification) => notification.title), ['Suggested']);
    assert.equal(page.get('plan'), 'free');
    const image = UploadedFile.fake().image('cover.png', 4, 3);
    assert.equal(image.content.subarray(1, 4).toString('latin1'), 'PNG');
    assert.equal(UploadedFile.fake().create('big.pdf', 2).content.length, 2048);
});

test('ImportAction.fake() and ExportAction.fake() through the page: requests recorded, nothing processed', async () => {
    const imports = ImportAction.fake();
    const exports = ExportAction.fake();
    try {
        const before = (await db('posts').count({ count: '*' }).first())!.count;
        await livewire(pages.index)
            .mountAction(TestAction.make('import').table())
            .fillForm({ file: UploadedFile.fake().createWithContent('posts.csv', 'Post title,Views\nHotel,5\n') })
            .fillForm({ columnMap: { title: 'Post title', views: 'Views' } })
            .callMountedAction()
            .assertHasNoFormErrors();
        imports.assertDispatched(PostImporter, (run, columnMap) => run.totalRows === 1 && run.fileName === 'posts.csv' && columnMap.title === 'Post title').assertDispatchedTimes(PostImporter);
        assert.equal((await db('posts').count({ count: '*' }).first())!.count, before, 'no row was imported');
        // A required column left unmapped: a form error, nothing requested.
        const rejected = ImportAction.fake();
        await livewire(pages.index)
            .mountAction(TestAction.make('import').table())
            .fillForm({ file: UploadedFile.fake().createWithContent('posts.csv', 'Post title,Views\nHotel,5\n') })
            .fillForm({ columnMap: { title: null, views: 'Views' } })
            .callMountedAction()
            .assertHasFormErrors(['columnMap.title']);
        rejected.assertNothingDispatched();

        const tester = livewire(pages.index);
        await tester.filterTable('status', 'draft').callAction(TestAction.make('export').table(), { columns: ['title'] }).assertHasNoFormErrors();
        assert.deepEqual(tester.getDownloads(), [], 'no file was built');
        await exports.assertDispatched(PostExporter, async (run, query, columnMap) => {
            const titles = (await query.getRecords()).map((post: any) => post.title);
            return run.totalRows === titles.length && titles.length > 0 && columnMap.title === 'Title' && Object.keys(columnMap).length === 1;
        });
        exports.assertDispatchedTimes(PostExporter);
    } finally {
        ImportAction.fake().restore();
        exports.restore();
    }
});
