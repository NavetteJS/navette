import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import { Table, TextColumn, renderTable, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

class Row extends Model { static tableName = 'rows'; }
let db: Knex;
const adapter = new ObjectionAdapter(Row);
const host = (): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, tableGrouping: null, tableFilters: {}, selectedTableRecords: [], deselectedTableRecords: [], isTrackingDeselectedTableRecords: false, isTableLoaded: true } as unknown as TableHost);
const clean = (html: string) => html.replace(/>\s+</g, '><').replace(/\s+/g, ' ');

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('rows', (table) => { table.increments('id'); table.string('title'); table.string('status'); });
    const rows = [
        ...Array.from({ length: 3 }, (_, index) => ({ title: `Small ${index}`, status: 'a-small' })),
        ...Array.from({ length: 5100 }, (_, index) => ({ title: `Huge ${index}`, status: 'b-huge' })),
    ];
    for (let index = 0; index < rows.length; index += 400) await db('rows').insert(rows.slice(index, index + 400));
});
after(() => db.destroy());

test('select all above the selectability limit is announced as approximate', async () => {
    const table = new Table().columns([TextColumn.make('title')]).selectable().checkIfRecordIsSelectableUsing((record: any) => record.id % 2 === 0);
    const html = clean(await renderTable(table, host(), adapter));
    assert.match(html.replace(/\s+/g, " "), /Select all \(up to 5,?103\)/);
});

test('group checkboxes: a group above the key limit gets none, a small group keeps its keys', async () => {
    const table = new Table().columns([TextColumn.make('title')]).selectable().defaultGroup('status');
    const html = clean(await renderTable(table, host(), adapter, { bulkActions: ['<b>x</b>'] }));
    const checkboxes = [...html.matchAll(/data-group-selectable-record-keys="([^"]*)"/g)].map((match) => JSON.parse(match[1].replace(/&#34;|&quot;/g, '"')));
    assert.equal(checkboxes.length, 1, 'only the small group has a checkbox');
    assert.equal(checkboxes[0].length, 3);
});
