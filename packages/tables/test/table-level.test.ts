// Table-level features: pagination options and cursor pagination, identity, record URL, reordering, header,
// polling, lazy loading, search and sort options, persistence flags, striped rows, `pushColumns()`, `rowLoop` and the
// column manager.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, decodeCursor, encodeCursor, searchWords, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import {
    ColumnGroup, PaginationMode, Table, TextColumn, getRowLoop, getTableQuery, getTableRecords, getTableRecordsPerPage, getVisibleColumns, hasReorderedColumns,
    moveTableRecordOrder, renderTable, sanitizeColumnState, saveTableOrder, setTablePage, syncColumnManagerState, useColorManager, type TableHost,
} from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());
useUiColorManager(new ColorManager());

class Task extends Model { static tableName = 'tasks'; }
let db: Knex;
const adapter = new ObjectionAdapter(Task);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 5, paginators: { page: 1 }, ...over });
const clean = (html: string) => html.replace(/>\s+</g, '><').replace(/\s+/g, ' ');
const titles = async (table: Table, h: TableHost) => (await getTableRecords(table, h, adapter)).records.map((record: any) => record.title);

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('tasks', (t) => { t.increments('id'); t.string('title'); t.string('first_name'); t.string('last_name'); t.integer('sort'); t.integer('priority'); });
    await db('tasks').insert([
        { title: 'Write docs', first_name: 'Ada', last_name: 'Lovelace', sort: 3, priority: 2 },
        { title: 'Fix bug', first_name: 'Alan', last_name: 'Turing', sort: 1, priority: 1 },
        { title: 'Ship release', first_name: 'Grace', last_name: 'Hopper', sort: 2, priority: 2 },
        { title: 'Plan sprint', first_name: 'Ada', last_name: 'Byron', sort: 5, priority: 3 },
        { title: 'Review code', first_name: 'Linus', last_name: 'Torvalds', sort: 4, priority: 1 },
        { title: 'Write tests', first_name: 'Kent', last_name: 'Beck', sort: 6, priority: 3 },
        { title: 'Deploy app', first_name: 'Margaret', last_name: 'Hamilton', sort: 7, priority: 2 },
    ]);
});
after(() => db.destroy());

test('records per page: only declared options, the default one with enforcePaginationPageOptions()', () => {
    const table = new Table().paginationPageOptions([10, 25, 50]).defaultPaginationPageOption(25);
    assert.equal(getTableRecordsPerPage(table, { tableRecordsPerPage: 25 }), 25);
    assert.equal(getTableRecordsPerPage(table, { tableRecordsPerPage: 7 as any }), 10);
    assert.equal(getTableRecordsPerPage(table.enforcePaginationPageOptions(), { tableRecordsPerPage: 7 as any }), 25);
    assert.equal(getTableRecordsPerPage(table, { tableRecordsPerPage: 'all' }), 25);
    // Persistence flags: on by default for the records per page and the column manager.
    assert.equal(new Table().persistsRecordsPerPageInSession(), true);
    assert.equal(new Table().persistsColumnsInSession(), true);
    const all = new Table().persistInSession();
    assert.deepEqual([all.persistsFiltersInSession(), all.persistsSearchInSession(), all.persistsColumnSearchesInSession(), all.persistsSortInSession(), all.persistsGroupingInSession(), all.persistsColumnsInSession(), all.persistsRecordsPerPageInSession()], [true, true, true, true, true, true, true]);
    const none = new Table().persistInSession(false);
    assert.deepEqual([none.persistsColumnsInSession(), none.persistsRecordsPerPageInSession()], [false, false]);
});

test('extreme pagination links and the page name of queryStringIdentifier()', async () => {
    const table = new Table().columns([TextColumn.make('title')]).extremePaginationLinks().paginationPageOptions([2]);
    const html = clean(await renderTable(table, host({ tableRecordsPerPage: 2, paginators: { page: 2 } }), adapter));
    assert.match(html, /rel="first"[^>]*wire:key="H\.pagination\.first"/);
    assert.match(html, /wire:click="gotoPage\(4, &#39;page&#39;\)"/);
    assert.equal(new Table().getPaginationPageName(), 'page');
    assert.equal(new Table().identifier('orders').getPaginationPageName(), 'ordersPage');
    assert.equal(new Table().identifier('orders').queryStringIdentifier('o').getPaginationPageName(), 'oPage');
    const named = clean(await renderTable(table.queryStringIdentifier('tasks'), host({ tableRecordsPerPage: 2, paginators: { page: 2 } }), adapter));
    assert.match(named, /wire:click="nextPage\(&#39;tasksPage&#39;\)"/);
    assert.equal(new Table().identifier('x').getIdentifier(), 'x');
    assert.equal(new Table().getQueryStringIdentifier(), null);
});

test('cursor pagination: previous / next cursors, forged cursors give the first page', async () => {
    const table = new Table().columns([TextColumn.make('title').sortable()]).paginationMode(PaginationMode.Cursor).paginationPageOptions([3]);
    const h = host({ tableRecordsPerPage: 3, tableSort: 'title:asc' });
    const first = await getTableRecords(table, h, adapter);
    assert.deepEqual(first.records.map((r: any) => r.title), ['Deploy app', 'Fix bug', 'Plan sprint']);
    assert.equal(first.cursor?.previous, null);
    assert.ok(first.cursor?.next);
    setTablePage(table, h, first.cursor!.next);
    const second = await getTableRecords(table, h, adapter);
    assert.deepEqual(second.records.map((r: any) => r.title), ['Review code', 'Ship release', 'Write docs']);
    assert.ok(second.cursor?.previous && second.cursor.next);
    setTablePage(table, h, second.cursor!.next);
    const third = await getTableRecords(table, h, adapter);
    assert.deepEqual(third.records.map((r: any) => r.title), ['Write tests']);
    assert.equal(third.cursor?.next, null);
    setTablePage(table, h, third.cursor!.previous);
    assert.deepEqual((await getTableRecords(table, h, adapter)).records.map((r: any) => r.title), ['Review code', 'Ship release', 'Write docs']);
    // A forged cursor (other columns, an object value, garbage) is ignored.
    for (const forged of ['garbage!', Buffer.from(JSON.stringify({ secret: 1, _pointsToNextItems: true })).toString('base64url'), Buffer.from(JSON.stringify({ title: { $gt: '' }, id: 1, _pointsToNextItems: true })).toString('base64url')]) {
        setTablePage(table, h, forged);
        assert.deepEqual((await getTableRecords(table, h, adapter)).records.map((r: any) => r.title), ['Deploy app', 'Fix bug', 'Plan sprint']);
    }
    assert.equal(decodeCursor(encodeCursor({ title: 'a', id: 2 }, [{ column: 'title', direction: 'asc' }, { column: 'id', direction: 'asc' }], true), [{ column: 'title', direction: 'asc' }])?.values, undefined);
    // The pagination shows previous / next buttons calling `setPage()` with the cursors.
    setTablePage(table, h, first.cursor!.next);
    const html = clean(await renderTable(table, h, adapter));
    assert.match(html, /nv-pagination nv-simple/);
    assert.match(html, /rel="prev" wire:click="setPage\(&#39;[A-Za-z0-9_-]+&#39;, &#39;page&#39;\)"/);
    assert.doesNotMatch(html, /nv-pagination-overview/);
});

test('openRecordUrlInNewTab(): row links get target="_blank" instead of SPA navigation', async () => {
    const table = new Table().columns([TextColumn.make('title')]).recordUrl((record: any) => `/tasks/${record.id}`, true);
    const html = clean(await renderTable(table, host(), adapter));
    assert.match(html, /<a href="\/tasks\/1" target="_blank" class="nv-ta-col">/);
    const perRecord = new Table().columns([TextColumn.make('title')]).recordUrl((record: any) => `/tasks/${record.id}`).openRecordUrlInNewTab((record: any) => record.id === 2);
    const mixed = clean(await renderTable(perRecord, host(), adapter));
    assert.match(mixed, /<a href="\/tasks\/2" target="_blank"/);
    assert.match(mixed, /<a href="\/tasks\/1" x-on:click="if/);
});

test('reordering: column, condition, direction, paginated while reordering, callbacks, keyboard moves', async () => {
    assert.equal(new Table().reorderable('sort', false).getReorderColumn(), null);
    assert.equal(new Table().reorderable('sort', () => true).isReorderable(), true);
    assert.equal(new Table().reorderable('sort').authorizeReorder(false).isReorderable(), false);
    const calls: string[] = [];
    const table = new Table().columns([TextColumn.make('title')]).reorderable('sort')
        .beforeReordering((order) => { calls.push(`before:${order.join(',')}`); })
        .afterReordering((order) => { calls.push(`after:${order.join(',')}`); });
    const h = host({ isTableReordering: true });
    await saveTableOrder(table, h, adapter, ['3', '1', '999', '3', { evil: 1 }]);
    assert.deepEqual(calls, ['before:3,1', 'after:3,1']);
    assert.deepEqual((await db('tasks').whereIn('id', [1, 3]).orderBy('id').select('sort')).map((row) => row.sort), [2, 1]);
    // Keyboard reordering: the record moves one place among the shown rows.
    const before = (await db('tasks').orderBy('sort').select('id')).map((row) => String(row.id));
    await moveTableRecordOrder(table, h, adapter, before[0], 'down');
    const afterMove = (await db('tasks').orderBy('sort').select('id')).map((row) => String(row.id));
    assert.deepEqual(afterMove.slice(0, 2), [before[1], before[0]]);
    assert.equal(await moveTableRecordOrder(table, h, adapter, before[0], 'sideways'), null);
    // Descending: the first row gets the highest position.
    const desc = new Table().columns([TextColumn.make('title')]).reorderable('sort', null, 'desc');
    await saveTableOrder(desc, h, adapter, ['1', '2']);
    assert.deepEqual((await db('tasks').whereIn('id', [1, 2]).orderBy('id').select('sort')).map((row) => row.sort), [2, 1]);
    // Paginated while reordering: page 2 positions start after page 1.
    const paged = new Table().columns([TextColumn.make('title')]).reorderable('sort').paginatedWhileReordering().paginationPageOptions([3]);
    const ph = host({ isTableReordering: true, tableRecordsPerPage: 3, paginators: { page: 2 } });
    const html = clean(await renderTable(paged, ph, adapter));
    assert.match(html, /nv-pagination/);
    assert.equal((html.match(/x-sortable-item=/g) ?? []).length, 3);
    await saveTableOrder(paged, ph, adapter, ['7', '6', '5']);
    assert.deepEqual((await db('tasks').whereIn('id', [5, 6, 7]).orderBy('id').select('sort')).map((row) => row.sort), [6, 5, 4]);
    // The trigger can be customized.
    const custom = new Table().columns([TextColumn.make('title')]).reorderable('sort').reorderRecordsTriggerAction((action, isReordering) => action.button().label(isReordering ? 'Done' : 'Reorder tasks'));
    assert.match(clean(await renderTable(custom, host(), adapter)), /wire:click="toggleTableReordering" class="nv-force-enabled nv-ac-btn-action nv-btn nv-size-md"><svg[^]*?<\/svg>Reorder tasks</);
    assert.match(clean(await renderTable(custom, host({ isTableReordering: true }), adapter)), />Done</);
});

test('header: description, custom header HTML, polling, lazy loading and loading skeleton', async () => {
    const table = new Table().columns([TextColumn.make('title')]).heading('Tasks').description('Everything to do <soon>');
    const html = clean(await renderTable(table, host(), adapter));
    assert.match(html, /<h2 class="nv-ta-header-heading"> Tasks <\/h2><p class="nv-ta-header-description"> Everything to do &lt;soon&gt; <\/p>/);
    const custom = clean(await renderTable(new Table().columns([TextColumn.make('title')]).heading('Hidden').header('<div class="my-header">Mine</div>'), host(), adapter));
    assert.match(custom, /<div class="my-header">Mine<\/div>/);
    assert.doesNotMatch(custom, /nv-ta-header-heading/);
    assert.match(clean(await renderTable(new Table().columns([TextColumn.make('title')]).poll('5s'), host(), adapter)), /<div wire:poll\.5s wire:loading\.attr="aria-busy"/);
    assert.equal(new Table().poll().getPollingInterval(), '10s');
    assert.equal(new Table().poll('1s; alert(1)').getPollingInterval(), null);
    assert.doesNotMatch(clean(await renderTable(new Table().columns([TextColumn.make('title')]).poll('5s').reorderable('sort'), host({ isTableReordering: true }), adapter)), /wire:poll/);
    const lazy = new Table().columns([TextColumn.make('title')]).lazyLoaded();
    const waiting = clean(await renderTable(lazy, host({ isTableLoaded: false }), adapter));
    assert.match(waiting, /wire:init="loadTable" class="nv-ta nv-loading"/);
    assert.match(waiting, /nv-ta-table-loading-ctn/);
    assert.doesNotMatch(waiting, /nv-ta-records|nv-ta-empty-state|nv-pagination/);
    const loaded = clean(await renderTable(lazy, host({ isTableLoaded: true }), adapter));
    assert.doesNotMatch(loaded, /wire:init/);
    assert.match(loaded, /Write docs/);
    assert.equal(new Table().deferLoading().isLazyLoaded(), true);
    const skeleton = clean(await renderTable(new Table().columns([TextColumn.make('title')]).loadingSkeleton(), host(), adapter));
    assert.match(skeleton, /wire:loading\.class\.delay\.default="nv-ta-content-loading"/);
    assert.match(skeleton, /<tbody wire:loading\.attr\.delay\.default="inert"/);
});

test('search: searchUsing(), table searchable() with extra columns, column lists and queries, split terms, field options', async () => {
    const base = () => new Table().columns([TextColumn.make('title').searchable()]).paginationPageOptions([10]);
    assert.deepEqual(await titles(base(), host({ tableSearch: 'write', tableRecordsPerPage: 10 })), ['Write docs', 'Write tests']);
    // Words are matched separately unless splitSearchTerms(false); double quotes keep a phrase together.
    assert.deepEqual(await titles(base(), host({ tableSearch: 'docs write', tableRecordsPerPage: 10 })), ['Write docs']);
    assert.deepEqual(await titles(base().splitSearchTerms(false), host({ tableSearch: 'docs write', tableRecordsPerPage: 10 })), []);
    assert.deepEqual(searchWords('"write docs" fix'), ['write docs', 'fix']);
    // searchUsing() replaces the search.
    const using = base().searchUsing((query, search) => query.where('first_name', search));
    assert.deepEqual(await titles(using, host({ tableSearch: 'Ada', tableRecordsPerPage: 10 })), ['Write docs', 'Plan sprint']);
    // Extra searchable columns, also without searchable columns; a function receives the query.
    const extra = new Table().columns([TextColumn.make('title')]).searchable(['last_name', (query, search) => query.where('first_name', search)]).paginationPageOptions([10]);
    assert.equal(extra.isSearchable(), true);
    assert.deepEqual(await titles(extra, host({ tableSearch: 'hopper', tableRecordsPerPage: 10 })), ['Ship release']);
    assert.deepEqual(await titles(extra, host({ tableSearch: 'Kent', tableRecordsPerPage: 10 })), ['Write tests']);
    // searchable(false): no search field, and a forged search is ignored.
    const off = base().searchable(false);
    assert.equal(off.isSearchable(), false);
    assert.equal((await titles(off, host({ tableSearch: 'write', tableRecordsPerPage: 10 }))).length, 7);
    // A column searching several database columns, or with its own query.
    const name = new Table().columns([TextColumn.make('name').state((record: any) => `${record.first_name} ${record.last_name}`).searchable(['first_name', 'last_name'])]).paginationPageOptions([10]);
    assert.deepEqual(await titles(name, host({ tableSearch: 'ada byron', tableRecordsPerPage: 10 })), ['Plan sprint']);
    const queried = new Table().columns([TextColumn.make('priority').searchable({ query: (query, search) => query.where('priority', Number(search)) })]).paginationPageOptions([10]);
    assert.deepEqual(await titles(queried, host({ tableSearch: '3', tableRecordsPerPage: 10 })), ['Plan sprint', 'Write tests']);
    // Individual search: split by default, as a whole with splitIndividualSearchTerms(false).
    const individual = (split: boolean | null) => new Table().columns([TextColumn.make('title').searchable({ isIndividual: true, isGlobal: false }).splitIndividualSearchTerms(split)]).paginationPageOptions([10]);
    assert.deepEqual(await titles(individual(null), host({ tableColumnSearches: { title: 'docs write' }, tableRecordsPerPage: 10 })), ['Write docs']);
    assert.deepEqual(await titles(individual(false), host({ tableColumnSearches: { title: 'docs write' }, tableRecordsPerPage: 10 })), []);
    assert.deepEqual(await titles(individual(false), host({ tableColumnSearches: { title: 'write d' }, tableRecordsPerPage: 10 })), ['Write docs']);
    // Field options.
    const field = clean(await renderTable(base().searchPlaceholder('Find a task').searchDebounce('750ms'), host(), adapter));
    assert.match(field, /placeholder="Find a task" type="search" wire:key="H\.table\.tableSearch\.field\.input" wire:model\.live\.debounce\.750ms="tableSearch"/);
    assert.match(clean(await renderTable(base().searchOnBlur(), host(), adapter)), /wire:model\.live\.blur="tableSearch"/);
    assert.equal(new Table().searchDebounce('1s;x').getSearchDebounce(), '500ms');
    // A table with only extra search columns shows the search field.
    assert.match(clean(await renderTable(extra, host(), adapter)), /nv-ta-search-field/);
});

test('sort: column lists and queries, default sort callback, default sort after the user sort, defaultKeySort(false), option label', async () => {
    const h = (sort: string | null) => host({ tableSort: sort, tableRecordsPerPage: 10 });
    const table = new Table().columns([TextColumn.make('name').sortable(['last_name', 'first_name']), TextColumn.make('priority').sortable(true, (query, direction) => query.orderBy('priority', direction).orderBy('title', 'desc')), TextColumn.make('title')]).paginationPageOptions([10]);
    assert.deepEqual((await titles(table, h('name:asc'))).slice(0, 2), ['Write tests', 'Plan sprint']);
    assert.deepEqual((await titles(table, h('priority:asc'))).slice(0, 3), ['Review code', 'Fix bug', 'Write docs']);
    assert.deepEqual(getTableQuery(table, h('name:desc')).sort, { column: 'last_name', columns: ['last_name', 'first_name'], direction: 'desc' });
    // Default sort: a function of the query and direction, or a column; it applies after the user's sort.
    const byCallback = new Table().columns([TextColumn.make('title')]).defaultSort((query, direction) => query.orderBy('first_name', direction), 'desc').paginationPageOptions([10]);
    assert.equal((await titles(byCallback, h(null)))[0], 'Deploy app');
    const secondary = new Table().columns([TextColumn.make('priority').sortable(), TextColumn.make('title')]).defaultSort('title', 'desc').paginationPageOptions([10]);
    assert.deepEqual((await titles(secondary, h('priority:asc'))).slice(0, 2), ['Review code', 'Fix bug']);
    assert.deepEqual(getTableQuery(secondary, h('priority:asc')).thenSort, [{ column: 'title', direction: 'desc' }]);
    // A toggled hidden column does not sort.
    const toggleable = new Table().columns([TextColumn.make('priority').sortable().toggleable(), TextColumn.make('title')]);
    assert.equal(getTableQuery(toggleable, host({ tableSort: 'priority:asc', tableColumns: [{ type: 'column', name: 'priority', isToggled: false } as any] })).sort, null);
    assert.equal(getTableQuery(new Table().defaultKeySort(false), h(null)).keySort, false);
    assert.equal(new Table().getDefaultSortOptionLabel(), '-');
    const stacked = clean(await renderTable(new Table().columns([TextColumn.make('title').sortable()]).stackedOnMobile().defaultSortOptionLabel('No sort'), host(), adapter));
    assert.match(stacked, /<select class="nv-select-input" x-model="column"><option value="">No sort<\/option>/);
});

test('striped rows, pushColumns() and rowLoop', async () => {
    const table = new Table().columns([TextColumn.make('title')]).pushColumns([TextColumn.make('index').state((_record, { rowLoop }) => `#${rowLoop?.iteration}/${rowLoop?.count}`)]).striped().paginationPageOptions([3]);
    assert.deepEqual(table.getColumns().map((column) => column.name), ['title', 'index']);
    const html = clean(await renderTable(table, host({ tableRecordsPerPage: 3 }), adapter));
    assert.match(html, />#1\/3</);
    assert.match(html, />#3\/3</);
    const rows = html.match(/<tr wire:key="H\.table\.records\.[^"]+"[^>]*class="([^"]*)"/g) ?? [];
    assert.deepEqual(rows.map((row) => row.includes('nv-striped')), [false, true, false]);
    assert.equal(getRowLoop(), null);
});

test('column manager: groups in the state, sanitized order and toggles, reorderable visible order', () => {
    const table = new Table().columns([TextColumn.make('title'), ColumnGroup.make('Person').columns([TextColumn.make('first_name').toggleable(), TextColumn.make('last_name')]), TextColumn.make('priority').toggleable(true, { isToggledHiddenByDefault: true })]).reorderableColumns();
    const declared = table.getDefaultColumnState();
    assert.deepEqual(declared.map((item) => [item.type, item.name]), [['column', 'title'], ['group', 'Person'], ['column', 'priority']]);
    assert.deepEqual(declared[1].columns!.map((column) => column.name), ['first_name', 'last_name']);
    assert.equal(declared[2].isToggled, false);
    // Forged state: unknown and duplicated items are dropped, non-toggleable columns stay visible, attributes come from the declaration.
    const forged = [
        { type: 'column', name: 'priority', isToggled: true, isToggledHiddenByDefault: true, label: '<img onerror=alert(1)>', isToggleable: false },
        { type: 'column', name: 'secret', isToggled: true },
        { type: 'column', name: 'title', isToggled: false },
        { type: 'group', name: 'Person', columns: [{ type: 'column', name: 'last_name', isToggled: false }, { type: 'column', name: 'first_name', isToggled: false }, { type: 'column', name: 'title' }] },
        { type: 'column', name: 'title', isToggled: false },
    ];
    const state = sanitizeColumnState(table, forged, true);
    assert.deepEqual(state.map((item) => item.name), ['priority', 'title', 'Person']);
    assert.equal(state[0].label, 'Priority');
    assert.equal(state[0].isToggled, true);
    assert.equal(state[1].isToggled, true);
    assert.deepEqual(state[2].columns!.map((column) => [column.name, column.isToggled]), [['last_name', true], ['first_name', false]]);
    assert.equal(hasReorderedColumns(declared, state), true);
    const h = host({ tableColumns: state });
    assert.deepEqual(getVisibleColumns(table, h).map((column) => column.name), ['priority', 'title', 'last_name']);
    // Without reorderable columns, the declared order is kept whatever the state says.
    const fixed = new Table().columns([TextColumn.make('title'), TextColumn.make('priority')]);
    assert.deepEqual(sanitizeColumnState(fixed, [{ type: 'column', name: 'priority' }, { type: 'column', name: 'title' }], true).map((item) => item.name), ['title', 'priority']);
    assert.deepEqual(getVisibleColumns(fixed, host({ tableColumns: [{ type: 'column', name: 'priority' }, { type: 'column', name: 'title' }] as any })).map((column) => column.name), ['title', 'priority']);
    // New declared columns are appended to a saved order.
    assert.deepEqual(syncColumnManagerState(declared, [{ type: 'column', name: 'priority' }], true).map((item) => item.name), ['priority', 'title', 'Person']);
    // Labels are escaped (the column manager renders them as HTML).
    assert.equal(new Table().columns([TextColumn.make('a').label('<b>A</b>')]).getDefaultColumnState()[0].label, '&lt;b&gt;A&lt;/b&gt;');
    assert.equal(table.hasColumnManager(), true);
    assert.equal(new Table().columns([TextColumn.make('title')]).hasColumnManager(), false);
    assert.equal(new Table().columns([TextColumn.make('title').toggleable()]).columnManager(false).hasColumnManager(), false);
});

test('column manager markup: reorderable, live, modal layout, trigger action, reset position, columns', async () => {
    const columns = () => [TextColumn.make('title').toggleable(), TextColumn.make('priority')];
    const dropdown = clean(await renderTable(new Table().columns(columns()), host(), adapter));
    assert.match(dropdown, /nv-ta-col-manager-dropdown/);
    assert.match(dropdown, /isLive: false/);
    assert.match(dropdown, /nv-ta-col-manager-actions-ctn/);
    assert.doesNotMatch(dropdown, /x-sortable-handle aria-hidden="true" tabindex="-1" x-on:click\.stop class="nv-ta-col-manager-reorder-handle/);
    const reorderable = clean(await renderTable(new Table().columns(columns()).reorderableColumns().deferColumnManager(false).columnManagerColumns(2), host(), adapter));
    assert.match(reorderable, /isLive: true/);
    assert.match(reorderable, /x-on:end\.stop="reorderColumns\(\$event\.target\.sortable\.toArray\(\)\)"/);
    assert.match(reorderable, /nv-ta-col-manager-reorder-handle/);
    assert.match(reorderable, /x-bind:data-testid="'column-manager-' \+ column\.name \+ '-move-up'"/);
    assert.match(reorderable, /--cols-lg: 2;/);
    assert.match(reorderable, /nv-dropdown-panel nv-width-2xl/);
    assert.doesNotMatch(reorderable, /nv-ta-col-manager-actions-ctn/);
    // Reorderable columns alone show the column manager, without checkboxes.
    const noToggles = clean(await renderTable(new Table().columns([TextColumn.make('title'), TextColumn.make('priority')]).reorderableColumns(), host(), adapter));
    assert.match(noToggles, /nv-ta-col-manager/);
    assert.doesNotMatch(noToggles, /nv-ta-col-manager-column-checkbox', column\.name\)"\s*\/?>/);
    const modal = clean(await renderTable(new Table().columns(columns()).columnManagerLayout('modal').columnManagerResetActionPosition('footer').columnManagerTriggerAction((action) => action.button().label('Columns')), host(), adapter));
    assert.match(modal, /nv-ta-col-manager-modal/);
    assert.match(modal, /x-on:apply-table-column-manager\.window="applyTableColumnManager\(\)"/);
    assert.match(modal, /data-nv-modal-id="H-table-column-manager"/);
    assert.match(modal, /x-on:click="\$dispatch\('open-modal', \{ id: &#039;H-table-column-manager&#039; \}\)" class="nv-force-enabled nv-ac-btn-action nv-btn nv-size-md"><svg[^]*?<\/svg>Columns</);
    const slideOver = clean(await renderTable(new Table().columns(columns()).columnManagerTriggerAction((action) => action.slideOver().modalHeading('Pick columns')), host(), adapter));
    assert.match(slideOver, /nv-modal-slide-over/);
    assert.match(slideOver, />Pick columns</);
    const footer = clean(await renderTable(new Table().columns(columns()).columnManagerResetActionPosition('footer').columnManagerMaxHeight('20rem').columnManagerWidth('md'), host(), adapter));
    assert.match(footer, /nv-dropdown-panel nv-width-md nv-scrollable" style="max-height: 20rem;"/);
    assert.match(footer, /nv-ta-col-manager-actions-ctn">\s*<button[^>]*>\s*Apply columns<\/button>\s*<button[^>]*wire:click="resetTableColumnManager" x-on:click="resetDeferredColumns">Reset</);
    assert.equal(new Table().columnManagerColumns(3).getColumnManagerWidth(), '4xl');
});
