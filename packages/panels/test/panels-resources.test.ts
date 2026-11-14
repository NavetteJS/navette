// Pages, resources, relation managers and users: the D10 options (Filament's pages, resources and relation manager options).
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { HtmlString } from '@navette-js/support';
import { Schema as SchemaBuilder, Tab, type Schema } from '@navette-js/schemas';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { WireRuntime } from '@navette-js/wire';
import {
    ContentTabPosition, CreateAction, Dashboard, EditProfile, EditRecord, InteractsWithPageTable, ListRecords, Login, MultiFactorChallenge, Page, Panel, panelRouter, Register,
    RelationGroup, RelationManager, Resource, Stat, StatsOverviewWidget, ViewRecord, Widget, WidgetConfiguration, type User,
} from '../src/index.ts';
import { runWithPanel } from '../src/plugins.ts';
import { actingAs, livewire, setCurrentPanel } from '../src/testing.ts';

class Author extends Model { static tableName = 'authors'; declare id: number; declare name: string; declare status: string; declare secret: string | null; }
class Book extends Model { static tableName = 'books'; declare id: number; declare author_id: number; declare title: string; declare deleted_at: string | null; }

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const auth = { attempt: async () => null, find: async (id: unknown) => (String(id) === '1' ? ada : null) } as any;
let db: Knex;

class BooksRelationManager extends RelationManager {
    static relationship = 'books';
    static modelLabel = 'book';
    static recordTitleAttribute = 'title';
    static badge = 'B';
    static locked = ['ownerRecord', 'pageClass', 'genre'];
    /** Given by `make({ genre })`. */
    genre = '';
    static adapterFor(ownerKey: string) { return new ObjectionAdapter(Book).scopedTo('author_id', ownerKey); }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('title'), TextInput.make('author_id').hiddenOn(BooksRelationManager)]); }
    static table(table: Table<Book>): Table<Book> {
        return table.columns([TextColumn.make('title'), TextColumn.make('author_id').hiddenOn(BooksRelationManager)])
            .filters([SelectFilter.make('author_id').options({ 1: 'Ada' }).hiddenOn(BooksRelationManager)])
            .headerActions([CreateAction.make()]);
    }
}
class EagerBooksRelationManager extends BooksRelationManager { static relationship = 'eagerBooks'; static isLazyLoaded = false; static isBadgeLazyLoaded = true; static async getBadge() { return 'lazy-badge-42'; } }

class AuthorResource extends Resource {
    static slug = 'authors';
    static modelLabel = 'eBook author';
    static hasTitleCaseModelLabel = false;
    static recordTitleAttribute = 'name';
    static hasViewPage = true;
    static adapter = new ObjectionAdapter(Author);
    static relations = { books: BooksRelationManager.make({ genre: 'novel' }), more: EagerBooksRelationManager };
    static policy = { viewAny: () => true, view: () => true, update: () => true, create: () => true, delete: () => true };
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name'), TextInput.make('status'), TextInput.make('secret')]); }
    static table(table: Table<Author>): Table<Author> { return table.columns([TextColumn.make('name').searchable(), TextColumn.make('author_id').hiddenOn(BooksRelationManager)]); }
}
const fills: string[] = [];
class ViewAuthor extends ViewRecord {
    protected beforeFill() { fills.push('before'); }
    protected mutateFormDataBeforeFill(data: Record<string, unknown>) { fills.push('mutate'); const { secret: _secret, ...rest } = data; return rest; }
    protected afterFill() { fills.push('after'); }
}
class EditAuthor extends EditRecord {
    getHeaderActions(): Action[] { return [this.getSaveFormAction().formId('form'), ...super.getHeaderActions()]; }
    getFormActions(): Action[] { return []; }
    hasCombinedRelationManagerTabsWithContent() { return true; }
    getContentTabPosition() { return ContentTabPosition.After; }
    getTabComponents() { return { overview: Tab.make('Overview').schema([]), ...super.getTabComponents() }; }
}
AuthorResource.pages = { view: ViewAuthor, edit: EditAuthor };

class StrictResource extends Resource {
    static slug = 'strict';
    static adapter = new ObjectionAdapter(Author);
    static policy = { viewAny: () => false, delete: () => false };
    static shouldSkipAuthorization = true;
}
class SearchedResource extends Resource { static slug = 'searched'; static recordTitleAttribute = 'name'; static adapter = new ObjectionAdapter(Author); static isGloballySearchable = true; }
class NotOptedInResource extends Resource { static slug = 'not-opted-in'; static recordTitleAttribute = 'name'; static adapter = new ObjectionAdapter(Author); }

class Greeting extends Widget {
    static isLazy = false;
    static locked = ['who'];
    who = 'nobody';
    render() { return this.wrap(`<p class="greeting">Hello ${this.who}</p>`); }
}
class ReportPage extends Page {
    static slug = 'report';
    static subheading = 'Monthly <figures>';
    static headerActionsAlignment = 'end';
    static maxContentWidth = 'full';
    static extraBodyAttributes = { class: 'report-body', 'data-report': 'yes' };
    getHeaderActions(): Action[] { return [Action.make('export').action(() => {})]; }
    getHeaderWidgets() { return [Greeting.make({ who: 'Grace' }), Greeting]; }
    getHeaderWidgetsColumns() { return { md: 2, xl: 4 }; }
    getFooter() { return new HtmlString('<footer class="report-footer">Footer</footer>'); }
}
class CustomHeaderPage extends Page { static slug = 'custom-header'; getHeader() { return '<div class="my-header">Custom</div>'; } }

const adminPanel = Panel.make().id('d10-admin').path('admin').key('d10').authGuard('d10').auth(auth)
    .resources([AuthorResource, StrictResource, SearchedResource, NotOptedInResource]).pages([Dashboard, ReportPage, CustomHeaderPage]).widgets([Greeting]).globalSearchResourceOptIn();
// The same resource in a second panel, which forbids deleting.
const staffPanel = Panel.make().id('d10-staff').path('staff').key('d10').authGuard('d10').auth(auth).resources([AuthorResource]).pages([ReportPage])
    .authorizeUsing(({ ability }) => (ability === 'delete' ? false : undefined));

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('authors', (table) => { table.increments('id'); table.string('name'); table.string('status'); table.string('secret').nullable(); });
    await db.schema.createTable('books', (table) => { table.increments('id'); table.integer('author_id'); table.string('title'); table.timestamp('deleted_at').nullable(); });
    await db('authors').insert([{ id: 1, name: 'Ada', status: 'draft', secret: 'hush' }, { id: 2, name: 'Grace', status: 'live', secret: null }]);
    await db('books').insert([{ author_id: 1, title: 'Notes' }, { author_id: 2, title: 'Compilers' }]);
    setCurrentPanel(adminPanel);
    actingAs(ada);
});
after(async () => { await db.destroy(); setCurrentPanel(null); });

test('one resource in two panels: URLs and authorization follow the panel of the request, getUrl({ panel }) targets another', async () => {
    assert.deepEqual(AuthorResource.getPanels().map((panel) => panel.getId()), ['d10-admin', 'd10-staff']);
    assert.equal(runWithPanel(adminPanel, () => AuthorResource.getUrl('edit', 1)), '/admin/authors/1/edit');
    assert.equal(runWithPanel(staffPanel, () => AuthorResource.getUrl('edit', 1)), '/staff/authors/1/edit');
    assert.equal(runWithPanel(adminPanel, () => AuthorResource.getUrl('index', undefined, {}, { panel: 'd10-staff' })), '/staff/authors');
    assert.equal(AuthorResource.getUrl('view', 2, {}, { panel: staffPanel }), '/staff/authors/2');
    assert.throws(() => StrictResource.getUrl('index', undefined, {}, { panel: 'd10-staff' }), /not registered/);
    assert.equal(await runWithPanel(adminPanel, () => AuthorResource.can('delete', ada)), true);
    assert.equal(await runWithPanel(staffPanel, () => AuthorResource.can('delete', ada)), false);
    // A page class in both panels.
    assert.equal(runWithPanel(staffPanel, () => ReportPage.getUrl()), '/staff/report');
    assert.equal(ReportPage.getUrl({}, { panel: 'd10-admin' }), '/admin/report');
    // Each panel's list page links its rows to its own edit pages.
    const inStaff = livewire(AuthorResource.getPages().index, {}, { panel: staffPanel });
    await inStaff.assertOk().assertSeeHtml('/staff/authors/1').assertDontSeeHtml('/admin/authors/1');
    await livewire(AuthorResource.getPages().index).assertOk().assertSeeHtml('/admin/authors/1');
});

test('one resource in two panels over HTTP: each panel serves the resource with its own links', async () => {
    const app = express();
    app.use(panelRouter(adminPanel, new WireRuntime({ key: 'k' })));
    app.use(panelRouter(staffPanel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try {
        const port = (server.address() as any).port;
        let cookie = '';
        adminPanel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
        const get = (path: string) => new Promise<string>((resolve, reject) => http.get({ host: '127.0.0.1', port, path, headers: { cookie } }, (res) => { let body = ''; res.setEncoding('utf8').on('data', (chunk) => { body += chunk; }).on('end', () => resolve(body)); }).on('error', reject));
        const staff = await get('/staff/authors');
        assert.match(staff, /href="\/staff\/authors\/1"/);
        assert.doesNotMatch(staff, /\/admin\/authors\/1/);
        assert.match(await get('/admin/authors'), /href="\/admin\/authors\/1"/);
        // Page options: body attributes and content width of the page, subheading, alignment, footer, widget properties and columns.
        const report = await get('/admin/report');
        assert.match(report, /<body data-report="yes" class="fi-body fi-panel-d10-admin [^"]*report-body">/);
        assert.match(report, /fi-main fi-width-full/);
        assert.match(report, /<p class="fi-header-subheading">\s*Monthly &lt;figures&gt;\s*<\/p>/);
        assert.match(report, /fi-ac fi-align-end/);
        assert.match(report, /<footer class="report-footer">Footer<\/footer>/);
        assert.match(report, /Hello Grace/);
        assert.match(report, /Hello nobody/);
        assert.match(report, /--cols-md: repeat\(2, minmax\(0, 1fr\)\)/);
        assert.match(report, /--cols-xl: repeat\(4, minmax\(0, 1fr\)\)/);
        const custom = await get('/admin/custom-header');
        assert.match(custom, /<div class="my-header">Custom<\/div>/);
        assert.doesNotMatch(custom, /class="fi-header-heading"/);
        // Without options: the panel's width.
        assert.match(await get('/admin'), /fi-main fi-width-7xl/);
    } finally { server.close(); }
});

test('Widget.make() carries properties; skipping authorization; title case labels; global search opt-in', async () => {
    const configuration = Greeting.make({ who: 'Ada' });
    assert.ok(configuration instanceof WidgetConfiguration);
    assert.deepEqual(configuration.getProperties(), { who: 'Ada' });
    assert.equal(await StrictResource.can('viewAny', ada), true);
    assert.equal(await StrictResource.can('delete', ada), true);
    assert.equal(await StrictResource.can('delete', null), false, 'still needs a user');
    assert.equal(AuthorResource.getTitleCasePluralModelLabel(), 'eBook authors');
    assert.equal(AuthorResource.getTitleCaseModelLabel(), 'eBook author');
    await livewire(AuthorResource.getPages().create).assertOk().assertSee('Create eBook author');
    runWithPanel(adminPanel, () => {
        assert.equal(SearchedResource.canGloballySearch(), true);
        assert.equal(NotOptedInResource.canGloballySearch(), false);
    });
    const plain = Panel.make().id('d10-search').key('k').authGuard('d10-search').auth(auth).resources([NotOptedInResource]);
    assert.equal(runWithPanel(plain, () => NotOptedInResource.canGloballySearch()), true, 'only with globalSearchResourceOptIn()');
});

test('edit page: save action in the header with formId(), refreshFormData(), tab components in their order', async () => {
    const page = livewire(EditAuthor, { record: 1 });
    await page.assertOk();
    // The save button submits the form from the header.
    assert.match(page.html(), /<header[\s\S]*type="submit" form="form"[\s\S]*<\/header>/);
    await page.fillForm({ name: 'Ada L.', status: 'typed' }).call('save').assertHasNoFormErrors();
    assert.equal((await db('authors').where('id', 1).first()).name, 'Ada L.');
    await db('authors').where('id', 1).update({ status: 'published', name: 'Changed elsewhere' });
    await page.fillForm({ name: 'Unsaved' });
    await (page as any).enqueue(() => page.instance().refreshFormData(['status']));
    await page.assertFormSet({ status: 'published', name: 'Unsaved' });
    // Combined tabs: the custom tab first, the relation managers, then the content (ContentTabPosition.After).
    const keys = [...page.html().matchAll(/data-tab-key="([^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(keys, ['overview', 'books', 'more', '']);
    assert.equal(page.instance().activeRelationManager, 'overview');
    // `?relation=more` opens that tab, and the URL keeps following the tab.
    const more = livewire(EditAuthor, { record: 1 }, { query: { relation: 'more' } });
    await more.assertOk().assertSet('activeRelationManager', 'more');
    assert.deepEqual((more as any).effects.url.activeRelationManager, { as: 'relation', use: 'replace', alwaysShow: false, except: 'overview' });
    // The eager manager (isLazyLoaded = false) is rendered at once; its lazy badge is not.
    await more.assertSee('Notes').assertDontSee('lazy-badge-42');
    await db('authors').where('id', 1).update({ name: 'Ada', status: 'draft' });
});

test('view page: the disabled form when there is no infolist, with the fill hooks', async () => {
    fills.length = 0;
    await db('authors').where('id', 1).update({ name: 'Ada', status: 'draft' });
    const page = livewire(ViewAuthor, { record: 1 });
    await page.assertOk().assertFormSet({ name: 'Ada', status: 'draft' }).assertFormFieldDisabled('name');
    assert.deepEqual(fills, ['before', 'mutate', 'after']);
    assert.equal(page.instance().data.secret ?? null, null, 'removed before reaching the browser');
    // With an infolist, no form.
    class InfolistAuthorResource extends AuthorResource { static slug = 'infolist-authors'; static infolist(schema: Schema) { return schema.components([TextEntry.make('name')]); } }
    InfolistAuthorResource.pages = {};
    const panel = Panel.make().id('d10-infolist').key('k').authGuard('d10-infolist').auth(auth).resources([InfolistAuthorResource]);
    const view = livewire(InfolistAuthorResource.getPages().view, { record: 1 }, { panel });
    await view.assertOk();
    assert.deepEqual(view.instance().data, {});
});

test('relation managers: read-only on view pages, properties of make(), hiddenOn(), lazy loading, lazy badges', async () => {
    const view = livewire(ViewAuthor, { record: 1 });
    await view.assertOk();
    const viewName = (view.instance() as any)._runtime.nameOf(AuthorResource.getPages().view);
    const editName = (view.instance() as any)._runtime.nameOf(AuthorResource.getPages().edit);
    assert.ok(viewName && editName);
    const onView = livewire(BooksRelationManager, { ownerRecord: '1', pageClass: viewName });
    await onView.assertOk();
    assert.equal(onView.instance().isReadOnly(), true);
    assert.equal(await onView.instance().resource.can('create', ada), false);
    await onView.assertDontSee('New book');
    const onEdit = livewire(BooksRelationManager, { ownerRecord: '1', pageClass: editName });
    await onEdit.assertOk().assertSee('New book').assertSee('Notes').assertDontSee('Compilers');
    assert.equal(onEdit.instance().isReadOnly(), false);
    // The column, filter and field hidden in this manager.
    assert.doesNotMatch(onEdit.html(), /fi-ta-header-cell-author-id/);
    assert.deepEqual(onEdit.instance().getTable().getFilters().map((filter: any) => filter.name), []);
    await livewire(AuthorResource.getPages().index).assertOk().assertSeeHtml('fi-ta-header-cell-author-id');
    // The panel may keep relation managers editable on view pages.
    const editable = Panel.make().id('d10-editable').key('k').authGuard('d10-editable').auth(auth).resources([AuthorResource]).readOnlyRelationManagersOnResourceViewPagesByDefault(false);
    const viewInEditable = livewire(ViewAuthor, { record: 1 }, { panel: editable });
    await viewInEditable.assertOk();
    const managerInEditable = livewire(BooksRelationManager, { ownerRecord: '1', pageClass: (viewInEditable.instance() as any)._runtime.nameOf(AuthorResource.getPages().view) }, { panel: editable });
    await managerInEditable.assertOk();
    assert.equal(managerInEditable.instance().isReadOnly(), false);
    // RelationManager.make(): properties given to the mounted manager.
    const configured = AuthorResource.relations.books as any;
    assert.deepEqual(configured.getProperties(), { genre: 'novel' });
    assert.equal(EagerBooksRelationManager.isLazy(), false);
    assert.equal(BooksRelationManager.isLazy(), true);
    // The lazy badge is loaded by the browser.
    const edit = livewire(EditAuthor, { record: 1 });
    await edit.assertOk();
    const tabs = (await edit.instance().getSchema('content').getFlatComponents()).find((component: any) => component.getKey?.() === 'content.relationManagerTabs') as any;
    const badges = await runWithPanel(adminPanel, () => tabs.getLazyLoadedTabBadges());
    assert.equal(badges.more.badge, 'lazy-badge-42');
    assert.equal(badges.books, undefined);
});

test('relation groups lazy badges, getRelationManagerTabComponent(), and InteractsWithPageTable for any widget', async () => {
    const group = RelationGroup.make('Writing', [BooksRelationManager]).badge(() => 3).lazyLoadedBadge();
    assert.equal(group.isBadgeLazyLoaded(), true);
    const page = livewire(EditAuthor, { record: 1 });
    await page.assertOk();
    assert.equal(page.instance().getRelationManagerTabComponent('unknown'), null);
    assert.equal(page.instance().getRelationManagerTabComponent('books')?.getLabel(), 'Books');
    assert.deepEqual(Object.keys(page.instance().getRelationManagerTabComponents(['books'])), ['more']);
    class AuthorStats extends InteractsWithPageTable(StatsOverviewWidget) {
        getTablePage() { return AuthorResource.getPages().index as typeof ListRecords; }
        async getStats() { return [Stat.make('Authors', (await this.getPageTableRecords()).length)]; }
    }
    const widget = livewire(AuthorStats, { tableSearch: 'Grace' });
    await widget.assertOk().assertSeeText('1');
    assert.deepEqual((await widget.instance().getPageTableRecords()).map((author: any) => author.name), ['Grace']);
    assert.equal(widget.instance().getPageTableQuery().search, 'Grace');
});

test('registration and profile forms reuse their components; revealablePasswords(false); scopedUnique()', async () => {
    class CompanyRegister extends Register {
        formSchema(schema: Schema): Schema { return schema.components([this.getNameFormComponent(), this.getEmailFormComponent(), TextInput.make('company'), this.getPasswordFormComponent(), this.getPasswordConfirmationFormComponent()]); }
    }
    const panel = Panel.make().id('d10-auth').key('k').authGuard('d10-auth').auth({ ...auth, findByEmail: async () => null, create: async () => ada }).login().registration(CompanyRegister).revealablePasswords(false);
    assert.equal(panel.arePasswordsRevealable(), false);
    const register = livewire(CompanyRegister, {}, { panel, user: null });
    await register.assertOk().assertFormFieldExists('company').assertFormFieldExists('passwordConfirmation');
    assert.doesNotMatch(register.html(), /fi-revealable/);
    const login = livewire(Login, {}, { panel, user: null });
    await login.assertOk();
    assert.doesNotMatch(login.html(), /fi-revealable/);
    class NoPasswordProfile extends EditProfile {
        protected getFormComponents() { return [this.getNameFormComponent(), this.getEmailFormComponent(), this.getCurrentPasswordFormComponent()]; }
    }
    const profile = livewire(NoPasswordProfile, {}, { panel: Panel.make().id('d10-profile').key('k').authGuard('d10-profile').auth({ ...auth, update: async () => ada }).profile(NoPasswordProfile) });
    await profile.assertOk().assertFormFieldExists('name').assertFormFieldDoesNotExist('password');
    // scopedUnique(): among the adapter's records only (soft-deleted ones are left out), unlike unique().
    await db('books').insert({ author_id: 1, title: 'Deleted', deleted_at: '2026-01-01 00:00:00' });
    const adapter = new ObjectionAdapter(Book, { softDeletes: 'deleted_at' });
    assert.equal(await adapter.exists('title', 'Deleted'), true);
    assert.equal(await adapter.existsInScope('title', 'Deleted'), false);
    assert.equal(await adapter.scopedTo('author_id', 2).existsInScope('title', 'Notes'), false, 'column scopes apply');
    assert.equal(await adapter.existsInScope('title', 'Notes'), true);
    const field = TextInput.make('title').scopedUnique({ adapter }).scopedExists({ adapter, column: 'title' });
    SchemaBuilder.make({ data: {} } as any).statePath('data').components([field]);
    const rules = (await field.getValidationRules()).filter((rule: any) => rule.name === 'unique' || rule.name === 'exists');
    assert.equal(await rules[0].passes('Deleted', { livewire: {} } as any), true);
    assert.equal(await rules[0].passes('Notes', { livewire: {} } as any), false);
    assert.equal(await rules[1].passes('Notes', { livewire: {} } as any), true);
    assert.equal(await rules[1].passes('Deleted', { livewire: {} } as any), false);
});

test('MultiFactorChallenge outside the login page: enabled providers, form components and rate limiting', async () => {
    const provider = { getId: () => 'code', getLoginFormLabel: () => 'Code', isEnabled: async () => true, getChallengeFormComponents: () => [TextInput.make('code')], getManagementSchemaComponents: () => [] } as any;
    const panel = Panel.make().id('d10-mfa').key('k').authGuard('d10-mfa').auth(auth).multiFactorAuthentication([provider]);
    const challenge = MultiFactorChallenge.make(panel);
    assert.equal(await challenge.hasEnabledProviders(ada), true);
    assert.equal((await challenge.getFirstEnabledProvider(ada))?.getId(), 'code');
    const enabled = await challenge.getEnabledProviders(ada);
    assert.equal(challenge.getProviderPickerFormComponent(ada, enabled), null, 'no picker for one provider');
    assert.equal(challenge.getChallengeFormComponents(ada, enabled).length, 1);
    const grace: User = { id: 99, name: 'Grace', email: 'grace@example.test' };
    challenge.clearRateLimiter(grace);
    for (let attempt = 0; attempt < challenge.getMaxRateLimiterAttempts(); attempt++) { assert.equal(challenge.isRateLimited(grace), false); challenge.hitRateLimiter(grace); }
    assert.equal(challenge.isRateLimited(grace), true);
    assert.ok(challenge.getRateLimiterAvailableInSeconds(grace) > 0);
    challenge.clearRateLimiter(grace);
    assert.equal(challenge.isRateLimited(grace), false);
});

test('combined tabs with a list of relations: the content tab comes first and is active (integer-like keys keep their order)', async () => {
    class ListEditAuthor extends EditRecord {
        static relationManagers = [BooksRelationManager, EagerBooksRelationManager];
        hasCombinedRelationManagerTabsWithContent() { return true; }
    }
    class ListAuthorResource extends AuthorResource { static slug = 'list-authors'; }
    ListAuthorResource.pages = { edit: ListEditAuthor };
    const panel = Panel.make().id('d10-list').key('k').authGuard('d10-list').auth(auth).resources([ListAuthorResource]);
    const page = livewire(ListEditAuthor, { record: 1 }, { panel });
    await page.assertOk().assertSet('activeRelationManager', '');
    assert.deepEqual([...page.html().matchAll(/data-tab-key="([^"]*)"/g)].map((match) => match[1]), ['', '0', '1']);
    class AfterEditAuthor extends ListEditAuthor { getContentTabPosition() { return ContentTabPosition.After; } }
    class AfterAuthorResource extends AuthorResource { static slug = 'after-authors'; }
    AfterAuthorResource.pages = { edit: AfterEditAuthor };
    const afterPanel = Panel.make().id('d10-after').key('k').authGuard('d10-after').auth(auth).resources([AfterAuthorResource]);
    const after = livewire(AfterEditAuthor, { record: 1 }, { panel: afterPanel });
    await after.assertOk().assertSet('activeRelationManager', '0');
    assert.deepEqual([...after.html().matchAll(/data-tab-key="([^"]*)"/g)].map((match) => match[1]), ['0', '1', '']);
});
