import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { fillSchema, Step, TextInput, Wizard } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { SelectColumn, SelectFilter, TernaryFilter, TextColumn, type Table } from '@navette-js/tables';
import { Notification, Page, Panel, Resource, Stat, StatsOverviewWidget, type User } from '../src/index.ts';
import { actingAs, assertNotified, assertNotNotified, clearSentNotifications, livewire, setCurrentPanel } from '../src/testing.ts';

class Article extends Model { static tableName = 'articles'; declare id: number; declare title: string; declare status: string; declare price: number; }
let db: Knex;

/** A column with extra attributes, as `extraAttributes()` gives them. */
class StatusColumn extends TextColumn<Article> {
    static make(name: string): StatusColumn { return new StatusColumn(name); }
    getExtraAttributes(record: Article): Record<string, unknown> { return { 'data-status': record.status }; }
}

class ArticleResource extends Resource {
    static slug = 'articles';
    static modelLabel = 'article';
    static adapter = new ObjectionAdapter(Article);
    static form(schema: Schema): Schema { return schema.components([TextInput.make('title')]); }
    static table(table: Table<Article>): Table<Article> {
        return table
            .columns([
                TextColumn.make<Article>('title').formatStateUsing(({ state }) => String(state).toUpperCase()),
                TextColumn.make<Article>('price').money('eur'),
                StatusColumn.make('status').toggleable(true, { isToggledHiddenByDefault: true }),
                SelectColumn.make<Article>('category').options((record) => (record.status === 'draft' ? { news: 'News', blog: 'Blog' } : { news: 'News' })),
            ])
            .filters([SelectFilter.make('status').options([['draft', 'Draft'], ['live', 'Live']]), TernaryFilter.make('archived').hidden()])
            .headerActions([Action.make('import'), Action.make('export')])
            .recordActions([Action.make('view'), ActionGroup.make([Action.make('edit'), Action.make('duplicate')]), Action.make('delete')])
            .emptyStateActions([Action.make('create')]);
    }
}

class ArticleStats extends StatsOverviewWidget {
    async getStats(): Promise<Stat[]> { return [Stat.make('Articles', 3)]; }
}

class Onboarding extends Page {
    static slug = 'onboarding';
    data: Record<string, unknown> = {};
    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    formSchema(schema: Schema): Schema {
        return schema.components([
            Wizard.make([
                Step.make('Account').schema([TextInput.make('email').required()]),
                Step.make('Profile').schema([TextInput.make('name').required()]),
                Step.make('Done').schema([TextInput.make('note')]),
            ]),
        ]);
    }
    contentSchema(schema: Schema): Schema { return schema.components([]); }
    getHeaderWidgets() { return [ArticleStats]; }
    getHeaderActions(): Action[] {
        return [Action.make('help').modalHeading('Help').modalDescription('Read <b>this</b> first.').schema([TextInput.make('question')]).action(() => {})];
    }
}

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('testing-extras').key('testing-extras-key').auth({ find: async () => user } as any).resources([ArticleResource]).pages([Onboarding]).widgets([ArticleStats]);
const pages = ArticleResource.getPages() as Record<string, any>;
const ids = async () => (await db('articles').orderBy('id')).map((row: any) => row.id);

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('articles', (table) => { table.increments('id'); table.string('title'); table.string('status'); table.integer('price'); table.string('category').nullable(); });
    setCurrentPanel(panel);
    actingAs(user);
});
after(() => db.destroy());
beforeEach(async () => {
    await db('articles').delete();
    await db('articles').insert([{ title: 'First', status: 'draft', price: 12 }, { title: 'Second', status: 'live', price: 30 }]);
    clearSentNotifications();
});

test('table columns: rendering, formatted state, extra attributes and select options', async () => {
    const [first, second] = await ids();
    await livewire(pages.index)
        .assertCanRenderTableColumn('title')
        .assertCanNotRenderTableColumn('status')
        .assertTableColumnFormattedStateSet('title', 'FIRST', first)
        .assertTableColumnFormattedStateNotSet('title', 'First', first)
        .assertTableColumnFormattedStateSet('price', '€30.00', second)
        .assertTableColumnHasExtraAttributes('status', { 'data-status': 'draft' }, first)
        .assertTableColumnDoesNotHaveExtraAttributes('status', { 'data-status': 'draft' }, second)
        .assertTableSelectColumnHasOptions('category', { news: 'News', blog: 'Blog' }, first)
        .assertTableSelectColumnHasOptions('category', [['news', 'News']], second)
        .assertTableSelectColumnDoesNotHaveOptions('category', { news: 'News' }, first)
        // The column manager shows the hidden column: it is rendered then.
        .toggleAllTableColumns()
        .assertCanRenderTableColumn('status');
    await assert.rejects(() => livewire(pages.index).assertCanRenderTableColumn('status'), /is visible/);
    await assert.rejects(() => livewire(pages.index).assertTableColumnFormattedStateSet('title', 'First', first), /formatted state of \["First"\].*it is \["FIRST"\]/);
    await assert.rejects(() => livewire(pages.index).assertTableColumnFormattedStateSet('title', 'X', 999), /record \[999\] exists/);
    await assert.rejects(() => livewire(pages.index).assertTableSelectColumnHasOptions('title', {}, first), /is a select column/);
});

test('table filters: visible and hidden filters', async () => {
    await livewire(pages.index)
        .assertTableFilterVisible('status')
        .assertTableFilterHidden('archived')
        .assertTableFilterExists('status');
    await assert.rejects(() => livewire(pages.index).assertTableFilterVisible('archived'), /is visible/);
    await assert.rejects(() => livewire(pages.index).assertTableFilterHidden('missing'), /exists/);
    // A hidden filter is left out of the table.
    assert.deepEqual(ArticleResource.table(new (await import('@navette-js/tables')).Table()).getFilters().map((filter) => filter.name), ['status']);
});

test('table actions in order', async () => {
    await livewire(pages.index)
        .assertTableRecordActionsExistInOrder(['view', 'edit', 'delete'])
        .assertTableActionsExistInOrder(['edit', 'duplicate'])
        .assertTableHeaderActionsExistInOrder(['import', 'export'])
        .assertTableEmptyStateActionsExistInOrder(['create']);
    await assert.rejects(() => livewire(pages.index).assertTableRecordActionsExistInOrder(['delete', 'view']), /exist in order/);
});

test('wizard steps: next validates the current step, previous goes back', async () => {
    await livewire(Onboarding)
        .assertWizardStepExists(3)
        .assertWizardCurrentStep(1)
        .goToNextWizardStep()
        .assertHasFormErrors(['email'])
        .assertWizardCurrentStep(1)
        .fillForm({ email: 'ada@example.test' })
        .goToNextWizardStep()
        .assertHasNoFormErrors()
        .assertWizardCurrentStep(2)
        .goToPreviousWizardStep()
        .assertWizardCurrentStep(1)
        .fillForm({ name: 'Ada' })
        .goToWizardStep(3)
        .assertWizardCurrentStep(3)
        .goToWizardStep(1)
        .assertWizardCurrentStep(1);
    await assert.rejects(() => livewire(Onboarding).assertWizardStepExists(4), /does not have a step \[4\]/);
    await assert.rejects(() => livewire(Onboarding).assertWizardCurrentStep(2), /current step is \[1\]/);
});

test('modal HTML, child components and the standalone notification assertions', async () => {
    await livewire(Onboarding)
        .assertSeeLivewire(ArticleStats)
        .assertDontSeeLivewire('navette.testing-extras.sidebar')
        .mountAction('help')
        .assertMountedActionModalSeeHtml('Read &lt;b&gt;this&lt;/b&gt; first.')
        .assertMountedActionModalDontSeeHtml('<b>this</b>');
    await assert.rejects(() => livewire(Onboarding).assertMountedActionModalSeeHtml('x'), /an action is mounted/);

    // Outside any tester and any request.
    assertNotNotified();
    Notification.make().title('Imported').success().send();
    assertNotified('Imported');
    assert.throws(() => assertNotified(), /none were sent/);
    Notification.make().title('Done').send();
    assert.throws(() => assertNotified(Notification.make().title('Done').success()), /expected \[Done\] but not sent/);
    // Notifications sent in a tested component are seen too.
    await livewire(pages.index).callTableAction('delete', (await ids())[0]);
    assertNotNotified('Imported');
});

test('faked repeater keys: a list equals an object keyed 0, 1…', async () => {
    const { normalizeListLikeState } = await import('../src/testing-extras.ts');
    assert.deepEqual(normalizeListLikeState({ 0: { a: 1 }, 1: { a: 2 } }, [{ a: 1 }, { a: 2 }]), [{ a: 1 }, { a: 2 }]);
    assert.deepEqual(normalizeListLikeState({ x: { 0: 'a' } }, { x: ['a'] }), { x: ['a'] });
    // UUID keys stay an object: the comparison fails, as it should.
    assert.deepEqual(normalizeListLikeState({ 'f2c1': 1 }, [1]), { f2c1: 1 });
});
