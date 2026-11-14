import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Table, TextColumn, getTableRecords, paginationElements, sortTable, type TableHost } from '../src/index.ts';

const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'x', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, ...over });

test('pagination elements: page windows over 107 pages', () => {
    assert.deepEqual(paginationElements(1, 107), [1, 2, 3, 4, '...', 106, 107]);
    assert.deepEqual(paginationElements(4, 107), [1, 2, 3, 4, '...', 106, 107]);
    assert.deepEqual(paginationElements(50, 107), [1, 2, '...', 50, '...', 106, 107]);
    assert.deepEqual(paginationElements(107, 107), [1, 2, '...', 104, 105, 106, 107]);
    assert.deepEqual(paginationElements(2, 5), [1, 2, 3, 4, 5]);
});

test('sortTable: none → asc → desc → none, and back to page 1', () => {
    const h = host({ paginators: { page: 4 } });
    sortTable(h, 'name');
    assert.deepEqual([h.tableSort, h.paginators.page], ['name:asc', 1]);
    sortTable(h, 'name');
    assert.equal(h.tableSort, 'name:desc');
    sortTable(h, 'name');
    assert.equal(h.tableSort, null);
    sortTable(h, 'email');
    sortTable(h, 'name');
    assert.equal(h.tableSort, 'name:asc');
});

test('getTableRecords only accepts what the table declares (sort, search, page size)', async () => {
    const table = new Table().columns([TextColumn.make('name').sortable().searchable(), TextColumn.make('email').searchable({ isIndividual: true, isGlobal: false }), TextColumn.make('secret')]).defaultSort('name');
    let seen: any;
    const adapter: any = { paginate: async (q: any) => { seen = q; return { records: [], total: 0, page: 1, perPage: q.perPage, lastPage: 1, from: null, to: null }; } };
    await getTableRecords(table, host({ tableSort: 'secret:desc', tableSearch: 'a', tableColumnSearches: { email: 'x', secret: 'y' }, tableRecordsPerPage: 100000 }), adapter);
    assert.deepEqual(seen.sort, { column: 'name', direction: 'asc' });
    assert.deepEqual(seen.searchColumns, ['name']);
    assert.deepEqual(seen.columnSearches, { email: 'x' });
    assert.equal(seen.perPage, 5);
    await getTableRecords(table, host({ tableSort: 'name:desc', tableRecordsPerPage: 25 }), adapter);
    assert.deepEqual(seen.sort, { column: 'name', direction: 'desc' });
    assert.equal(seen.perPage, 25);
});

test('TextColumn: short and full markup', async () => {
    assert.equal(await TextColumn.make('phone').toHtml({ phone: '<b>1</b>' }), '<div class="nv-ta-text nv-ta-text-item nv-size-sm">&lt;b&gt;1&lt;/b&gt;</div>');
    assert.equal(await TextColumn.make('name').weight('medium').toHtml({ name: 'Abby' }), '<div class="nv-ta-text-item nv-size-sm nv-font-medium nv-ta-text">Abby</div>');
});
