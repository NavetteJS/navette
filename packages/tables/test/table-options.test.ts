import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, resetConfigurators, views } from '@navette-js/support';
import '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import { getTableRecords, renderTable, Table, TextColumn, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

class Note extends Model { static tableName = 'notes'; }
let db: Knex;
const adapter = new ObjectionAdapter(Note);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, ...over });
const clean = (html: string) => html.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/> /g, '>').replace(/ </g, '<');

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('notes', (table) => { table.increments('id'); table.string('title'); });
    await db('notes').insert(Array.from({ length: 30 }, (_, index) => ({ title: `Note ${index + 1}` })));
});
after(() => db.destroy());

test('`paginated(false)` and the `all` option load every record; an undeclared page size is refused', async () => {
    const paginated = new Table().columns([TextColumn.make('title')]);
    assert.equal((await getTableRecords(paginated, host(), adapter)).records.length, 10);
    assert.equal((await getTableRecords(paginated, host({ tableRecordsPerPage: 'all' }), adapter)).records.length, 5, 'all is not an option: first option');
    const withAll = new Table().paginationPageOptions([10, 'all']).columns([TextColumn.make('title')]);
    assert.equal((await getTableRecords(withAll, host({ tableRecordsPerPage: 'all' }), adapter)).records.length, 30);
    const unpaginated = new Table().paginated(false).columns([TextColumn.make('title')]);
    assert.equal((await getTableRecords(unpaginated, host({ paginators: { page: 3 } }), adapter)).records.length, 30);
    assert.doesNotMatch(clean(await renderTable(unpaginated, host(), adapter)), /fi-pagination/);
    assert.match(clean(await renderTable(paginated, host(), adapter)), /fi-pagination/);
    assert.deepEqual(new Table().paginated([25, 50]).getPageOptions(), [25, 50]);
});

test('empty state: custom heading, description, icon and actions, or custom HTML', async () => {
    const emptyQuery = (table: Table) => table.columns([TextColumn.make('title').searchable()]);
    const defaults = clean(await renderTable(emptyQuery(new Table().pluralModelLabel('notes')), host({ tableSearch: 'nothing matches' }), adapter));
    assert.match(defaults, /<h2 class="fi-ta-empty-state-heading">No notes<\/h2>/);
    assert.doesNotMatch(defaults, /fi-ta-empty-state-description/);
    const custom = clean(await renderTable(emptyQuery(new Table().emptyStateHeading('Nothing yet').emptyStateDescription(() => 'Write your first note.').emptyStateIcon('o-document')), host({ tableSearch: 'nothing matches' }), adapter, { emptyStateActions: ['<button>New note</button>'] }));
    assert.match(custom, /<h2 class="fi-ta-empty-state-heading">Nothing yet<\/h2><p class="fi-ta-empty-state-description">Write your first note\.<\/p><div class="fi-ta-actions fi-align-center fi-wrapped"><button>New note<\/button><\/div>/);
    const html = clean(await renderTable(emptyQuery(new Table().emptyState('<div class="my-empty">Empty</div>')), host({ tableSearch: 'nothing matches' }), adapter));
    assert.match(html, /<div class="my-empty">Empty<\/div>/);
    assert.doesNotMatch(html, /fi-ta-empty-state-heading/);
});

test('`Table.configureUsing()` applies to new tables, before their own options', () => {
    Table.configureUsing((table) => table.paginationPageOptions([20, 40]).emptyStateHeading('Configured'));
    try {
        assert.deepEqual(new Table().getPageOptions(), [20, 40]);
        assert.deepEqual(new Table().paginationPageOptions([5]).getPageOptions(), [5]);
        assert.equal(new Table().getEmptyStateHeading(), 'Configured');
    } finally {
        resetConfigurators();
    }
    assert.deepEqual(new Table().getPageOptions(), [5, 10, 25, 50]);
});

test('row actions position, responsive columns, selectability and selection limits', async () => {
    const actionsHtml = async () => '<button>Edit</button>';
    const columns = () => [TextColumn.make('title').visibleFrom('md').width(200).wrapHeader(), TextColumn.make('id').hiddenFrom('lg').grow()];
    const render = (table: Table) => renderTable(table.columns(columns()), host(), adapter, { bulkActions: ['<button>Delete</button>'], rowActionsHtml: actionsHtml });
    const after = clean(await render(new Table()));
    assert.match(after, /class="fi-ta-cell fi-ta-cell-id lg:fi-hidden">[\s\S]*?<\/td><td class="fi-ta-cell"><div class="fi-ta-actions"><button>Edit<\/button>/);
    assert.match(after, /class="fi-ta-header-cell fi-ta-header-cell-title fi-wrapped md:fi-visible" style="width: 200px"/);
    assert.match(after, /class="fi-ta-header-cell fi-ta-header-cell-id fi-growable lg:fi-hidden"/);
    const before = clean(await render(new Table().recordActionsPosition('before-columns')));
    assert.match(before, /fi-ta-selection-cell"><input[^>]*><\/td><td class="fi-ta-cell"><div class="fi-ta-actions fi-align-start"><button>Edit<\/button>/);
    const beforeCells = clean(await render(new Table().recordActionsPosition('before-cells')));
    assert.match(beforeCells, /<td class="fi-ta-cell"><div class="fi-ta-actions fi-align-start"><button>Edit<\/button><\/div><\/td><td class="fi-ta-cell fi-ta-selection-cell">/);
    const limited = clean(await render(new Table().maxSelectableRecords(3).checkIfRecordIsSelectableUsing((record: any) => record.title !== 'Note 1')));
    assert.match(limited, /maxSelectableRecords: 3,/);
    assert.match(limited, /x-bind:disabled="! areRecordsToggleable\(\[/);
    assert.equal((limited.match(/class="fi-ta-record-checkbox/g) ?? []).length, 9, 'Note 1 has no checkbox');
    assert.match(limited, /value="29" x-ref="allSelectableRecordsCount"/);
});
