import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import { Filter, getFilterIndicators, getTableRecords, Indicator, isTableFilterRemovable, renderTable, SelectFilter, Table, TernaryFilter, TextColumn, TrashedFilter, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());
useUiColorManager(new ColorManager());

class Post extends Model { static tableName = 'posts'; }
let db: Knex;
const adapter = new ObjectionAdapter(Post);
const host = (tableFilters: TableHost['tableFilters'] = {}): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 50, paginators: { page: 1 }, tableFilters });
const titles = async (table: Table, filters: TableHost['tableFilters']) => (await getTableRecords(table, host(filters), adapter)).records.map((record: any) => record.title).sort();

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (table) => { table.increments('id'); table.string('title'); table.string('status'); table.boolean('is_featured'); table.string('published_at').nullable(); });
    await db('posts').insert([
        { title: 'A', status: 'draft', is_featured: 1, published_at: null },
        { title: 'B', status: 'reviewing', is_featured: 0, published_at: '2026-01-02' },
        { title: 'C', status: 'published', is_featured: 1, published_at: '2026-02-03' },
    ]);
});
after(() => db.destroy());

const STATUSES = { draft: 'Draft', reviewing: 'Reviewing', published: 'Published' };

test('`SelectFilter`: `multiple()`, default values, indicator joining the labels', async () => {
    const filter = SelectFilter.make('status').options(STATUSES).multiple().default(['draft', 'published']);
    const table = new Table().columns([TextColumn.make('title')]).filters([filter]);
    assert.deepEqual(table.getDefaultFilterState(), { status: { values: ['draft', 'published'] } });
    assert.deepEqual(await titles(table, table.getDefaultFilterState()), ['A', 'C']);
    assert.deepEqual(await titles(table, { status: { values: ['nope', 'reviewing'] } }), ['B'], 'unknown values are dropped');
    assert.deepEqual(getFilterIndicators(table, host(table.getDefaultFilterState())).map((i) => i.label), ['Status: Draft & Published']);
    assert.deepEqual(filter.getResetState(), { values: [] });
    const single = new Table().filters([SelectFilter.make('status').label('State').options(STATUSES).indicator('Workflow')]);
    assert.deepEqual(getFilterIndicators(single, host({ status: { value: 'reviewing' } })).map((i) => i.label), ['Workflow: Reviewing']);
});

test('`TernaryFilter`: boolean, `nullable()`, custom labels and `queries()`', async () => {
    const featured = new Table().filters([TernaryFilter.make('is_featured').trueLabel('Featured').falseLabel('Regular')]);
    assert.deepEqual(await titles(featured, { is_featured: { value: '1' } }), ['A', 'C']);
    assert.deepEqual(await titles(featured, { is_featured: { value: '0' } }), ['B']);
    assert.deepEqual(getFilterIndicators(featured, host({ is_featured: { value: '0' } })).map((i) => i.label), ['Is featured: Regular']);
    const published = new Table().filters([TernaryFilter.make('published').attribute('published_at').nullable().default(true)]);
    assert.deepEqual(published.getDefaultFilterState(), { published: { value: '1' } });
    assert.deepEqual(await titles(published, { published: { value: '1' } }), ['B', 'C']);
    assert.deepEqual(await titles(published, { published: { value: '0' } }), ['A']);
    const custom = new Table().filters([TernaryFilter.make('recent').queries({ true: (q) => q.where('published_at', '>=', '2026-02-01'), false: (q) => q.where('published_at', '<', '2026-02-01'), blank: (q) => q.whereNotNull('published_at') })]);
    assert.deepEqual(await titles(custom, { recent: { value: null } }), ['B', 'C'], 'blank query');
    assert.deepEqual(await titles(custom, { recent: { value: '1' } }), ['C']);
    assert.deepEqual(await titles(custom, { recent: { value: 'x' } }), ['B', 'C'], 'an unknown value is blank');
});

test('`TrashedFilter` indicators; `Filter` without schema is a checkbox', async () => {
    const trashed = new Table().filters([TrashedFilter.make()]);
    assert.deepEqual(getFilterIndicators(trashed, host({ trashed: { value: '0' } })).map((i) => i.label), ['Only deleted records']);
    const featured = new Table().filters([Filter.make('featured').label('Featured only').query((q) => q.where('is_featured', 1))]);
    assert.deepEqual(featured.getDefaultFilterState(), { featured: { isActive: false } });
    assert.deepEqual(await titles(featured, { featured: { isActive: false } }), ['A', 'B', 'C']);
    assert.deepEqual(await titles(featured, { featured: { isActive: true } }), ['A', 'C']);
    assert.deepEqual(getFilterIndicators(featured, host({ featured: { isActive: true } })).map((i) => i.label), ['Featured only']);
    const form = Filter.make('featured').toggle().getFormComponents();
    assert.equal(form.length, 1);
    assert.equal((form[0] as any).constructor.name, 'Toggle');
});

test('custom indicators: `Indicator` objects, removable or not, with a color', async () => {
    const table = new Table().filters([
        Filter.make('locked').query(() => {}).indicateUsing((data) => (data.isActive ? Indicator.make('Locked').removable(false).color('danger') : null)),
        Filter.make('free').query(() => {}),
    ]);
    const state = { locked: { isActive: true }, free: { isActive: true } };
    assert.deepEqual(getFilterIndicators(table, host(state)), [
        { filter: 'locked', label: 'Locked', field: '', removable: false, color: 'danger' },
        { filter: 'free', label: 'Free', field: '', removable: true, color: null },
    ]);
    assert.equal(await isTableFilterRemovable(table, host(state), 'locked'), false);
    assert.equal(await isTableFilterRemovable(table, host(state), 'free'), true);
    const html = await renderTable(table.columns([TextColumn.make('title')]), host(state), adapter, { filtersForm: '<form></form>' });
    assert.equal((html.match(/nv-badge-delete-btn"/g) ?? []).length, 1, 'only the removable indicator has a remove button');
    assert.match(html, /removeTableFilters/);
    const hidden = await renderTable(table.hiddenFilterIndicators(), host(state), adapter, { filtersForm: '<form></form>' });
    assert.doesNotMatch(hidden, /nv-ta-filter-indicators/);
});

test('filters layouts, live filters and form options', async () => {
    const render = (table: Table) => renderTable(table.columns([TextColumn.make('title')]).filters([SelectFilter.make('status').options(STATUSES)]), host(), adapter, { filtersForm: '<div class="the-form"></div>' });
    const dropdown = await render(new Table().filtersFormWidth('md').filtersFormMaxHeight('400px'));
    assert.match(dropdown, /nv-dropdown-panel nv-width-md" style="max-height: 400px"/);
    assert.match(dropdown, /data-table-filter-action="apply"/);
    const live = await render(new Table().deferFilters(false));
    assert.doesNotMatch(live, /data-table-filter-action="apply"/);
    const modal = await render(new Table().filtersLayout('modal'));
    assert.match(modal, /x-on:click="\$dispatch\('open-modal', \{ id: &#39;H-table-filters&#39; \}\)"/);
    assert.match(modal, /class="nv-modal /);
    assert.match(await render(new Table().filtersLayout('below-content')), /class="nv-ta-filters nv-ta-filters-below-content"/);
    const before = await render(new Table().filtersLayout('before-content-collapsible'));
    assert.match(before, /nv-ta-filters-before-content-ctn nv-width-xs/);
    assert.match(before, /x-on:click="toggleFiltersDropdown"/);
    const above = await render(new Table().filtersLayout('above-content').filtersResetActionPosition('footer'));
    assert.match(above, /nv-ta-filters-above-content-ctn/);
    assert.doesNotMatch(above, /areFiltersOpen = ! areFiltersOpen/, 'not collapsible: no trigger');
    assert.match(above, /nv-ta-filters-actions-ctn">\s*<button[^>]*data-table-filter-action="apply"[\s\S]*data-table-filter-action="reset"/);
    assert.deepEqual(new Table().filtersLayout('below-content').getFiltersFormColumns(), { sm: 2, lg: 3, xl: 4, '2xl': 5 });
    assert.equal(new Table().filtersLayout('modal').getFiltersFormColumns(), 1);
    assert.equal(new Table().filtersFormWidth('100px; color: red').getFiltersFormWidth(), null, 'only known widths');
    assert.throws(() => new Table().filtersLayout('sideways' as any));
});

test('customized filters actions: trigger, apply and reset', async () => {
    const table = new Table().columns([TextColumn.make('title')]).filters([SelectFilter.make('status').options(STATUSES)])
        .filtersTriggerAction((action) => action.button().label('Refine'))
        .filtersApplyAction((action) => action.link().label('Save filters'))
        .filtersResetAction((action) => action.hidden());
    const html = (await renderTable(table, host(), adapter, { filtersForm: '<div></div>' })).replace(/\s+/g, ' ');
    assert.match(html, /<button type="button" wire:loading\.attr="aria-disabled" wire:loading\.class="nv-disabled" class="nv-ac-btn-action nv-btn nv-size-md"><svg[^]*?<\/svg>Refine<div class="nv-btn-badge-ctn"><span class="[^"]*nv-badge nv-size-xs">0<\/span><\/div><\/button>/);
    assert.match(html, /data-table-filter-action="apply" wire:click="applyTableFilters" class="nv-ac-link-action nv-link nv-size-md[^"]*"><span class="nv-link-label">Save filters<\/span>/);
    assert.doesNotMatch(html, /data-table-filter-action="reset"/);
    const defaults = await renderTable(new Table().columns([TextColumn.make('title')]).filters([SelectFilter.make('status').options(STATUSES)]), host(), adapter, { filtersForm: '<div></div>' });
    assert.match(defaults, /title="Filter" aria-label="Filter"/);
    assert.match(defaults, /data-table-filter-action="reset"/);
});

test('custom filter: list values of a multiple select are kept, cleaned and capped', async () => {
    const { Filter } = await import('../src/index.ts');
    const { Select } = await import('@navette-js/forms');
    const filter = Filter.make('statuses').schema([Select.make('status').multiple().options({ a: 'A', b: 'B' })]).query(() => {});
    assert.deepEqual(filter.sanitizeState({ status: ['a', 'a', 'b', '', { x: 1 }, 3] }), { status: ['a', 'b', '3'] });
    assert.deepEqual(filter.sanitizeState({ status: [] }), { status: null });
    assert.equal(filter.isActive({ status: ['a'] }), true);
    assert.equal(filter.isActive({ status: [] }), false);
});
