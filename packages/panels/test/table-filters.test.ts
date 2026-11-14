import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Filter, Indicator, SelectFilter, type Table, TextColumn } from '@navette-js/tables';
import { MemorySessionStore, Panel, Resource, type User } from '../src/index.ts';

class Post extends Model { static tableName = 'posts'; }
let db: Knex;
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };
const STATUSES = { draft: 'Draft', published: 'Published' };

class Posts extends Resource {
    static slug = 'posts';
    static adapter = new ObjectionAdapter(Post);
    static table(table: Table): Table {
        return table.columns([TextColumn.make('title')]).deferFilters(false).persistFiltersInSession().persistSearchInSession().filters([
            SelectFilter.make('status').options(STATUSES),
            Filter.make('locked').query(() => {}).indicateUsing((data) => (data.isActive ? Indicator.make('Locked').removable(false) : null)),
        ]);
    }
}
const panel = Panel.make().id('filters-test').key('k').resources([Posts]);
const page = async (mailbox: string) => {
    const ListPage = Posts.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: admin, mailbox, req: { query: {} }, res: {} };
    await component.mount({});
    return component;
};

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.string('status'); });
});
after(() => db.destroy());

test('live filters: the form edits the applied state, which is sanitized on every change', async () => {
    const list = await page('browser-1');
    const form = await list.getSchema('tableFiltersForm').toHtml();
    assert.match(form, /wire:model.live="tableFilters.status.value"/);
    assert.match(form, /tableFilters.locked.isActive/);
    list.tableFilters = { status: { value: 'draft', injected: 'x' }, unknown: { value: 1 } };
    list.paginators.page = 3;
    await list.updatedTableFilters('draft', 'status.value');
    assert.deepEqual(list.tableFilters, { status: { value: 'draft' }, locked: { isActive: false } });
    assert.equal(list.paginators.page, 1);
});

test('non-removable indicators cannot be removed, even by a forged call', async () => {
    const list = await page('browser-2');
    list.tableFilters = { status: { value: 'draft' }, locked: { isActive: true } };
    list.tableSearch = 'hello';
    await list.removeTableFilter('locked');
    assert.deepEqual(list.tableFilters.locked, { isActive: true });
    await list.removeTableFilters();
    assert.deepEqual(list.tableFilters, { status: { value: null }, locked: { isActive: true } });
    assert.equal(list.tableSearch, '', '"remove all" also clears the search');
});

test('persisted filters and search: restored for the same browser and user only, sanitized', async () => {
    const first = await page('browser-3');
    first.tableFilters = { status: { value: 'published' }, locked: { isActive: false } };
    first.tableSearch = 'news';
    await first.dehydrate();
    const again = await page('browser-3');
    assert.deepEqual(again.tableFilters.status, { value: 'published' });
    assert.equal(again.tableSearch, 'news');
    const other = await page('browser-4');
    assert.deepEqual(other.tableFilters.status, { value: null });
    // A tampered store value is sanitized like browser input.
    await panel.getSessionStore().set('filters-test:1:browser-5', other.tableSessionKey('filters'), { status: { value: ['x'] }, locked: { isActive: 'yes' }, evil: { value: 1 } });
    assert.deepEqual((await page('browser-5')).tableFilters, { status: { value: null }, locked: { isActive: false } });
    const store = new MemorySessionStore({ maxValueLength: 10 });
    store.set('s', 'k', 'a'.repeat(50));
    assert.equal(store.get('s', 'k'), undefined, 'oversized values are not kept');
});

test('`filtersFormSchema()`: the filter groups go where the application puts them', async () => {
    const { Section } = await import('@navette-js/schemas');
    class Arranged extends Resource {
        static slug = 'arranged';
        static adapter = new ObjectionAdapter(Post);
        static table(table: Table): Table {
            return table.columns([TextColumn.make('title')]).filters([SelectFilter.make('status').options(STATUSES), Filter.make('locked').query(() => {})])
                .filtersFormSchema((filters) => [Section.make('Workflow').schema([filters.status]).columnSpanFull()]);
        }
    }
    Panel.make().id('filters-schema-test').key('k').resources([Arranged]);
    const ListPage = Arranged.getPages().index as any;
    const list = new ListPage();
    list._ctx = { panel: Arranged.panel, user: admin, mailbox: 'arranged', req: { query: {} }, res: {} };
    await list.mount({});
    const form = await list.getSchema('tableFiltersForm').toHtml();
    assert.match(form, /Workflow/);
    assert.match(form, /tableDeferredFilters\.status\.value/);
    assert.doesNotMatch(form, /locked/, 'a filter left out is not shown');
});

test('query builder: grouped constraints and picker width in the constraint picker', async () => {
    const { NumberConstraint, QueryBuilder, TextConstraint } = await import('@navette-js/tables');
    const { views } = await import('@navette-js/support');
    views.share({ assetUrl: (file: string) => `/${file}` });
    class Searchable extends Resource {
        static slug = 'searchable';
        static adapter = new ObjectionAdapter(Post);
        static table(table: Table): Table {
            return table.columns([TextColumn.make('title')]).filters([
                QueryBuilder.make().constraintPickerWidth('3xl').constraints({ Content: [TextConstraint.make('title')], Numbers: [NumberConstraint.make('id')] }),
            ]);
        }
    }
    Panel.make().id('qb-groups-test').key('k').resources([Searchable]);
    const ListPage = Searchable.getPages().index as any;
    const list = new ListPage();
    list._ctx = { panel: Searchable.panel, user: admin, mailbox: 'qb', req: { query: {} }, res: {} };
    await list.mount({});
    const form = await list.getSchema('tableFiltersForm').toHtml();
    assert.match(form, /class="nv-dropdown-panel nv-width-3xl"/);
    assert.match(form, /nv-fo-builder-block-picker-groups/);
    assert.match(form, /<div class="nv-fo-builder-block-picker-group" role="group" aria-label="Content"><div class="nv-fo-builder-block-picker-group-label">Content<\/div>/);
    assert.match(form, /aria-label="Numbers"/);
});
