import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { csvCell, ExportAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, Panel, parseCsv, Resource, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Product extends Model { static tableName = 'products'; }
let db: Knex;
const user: User = { id: 7, name: 'U', email: 'u@x.test' };

class ProductExporter extends Exporter {
    static getColumns() {
        return [ExportColumn.make('name'), ExportColumn.make('price').label('Price (USD)').formatStateUsing((state) => Number(state).toFixed(2)), ExportColumn.make('sku').enabledByDefault(false)];
    }
}
class ProductImporter extends Importer {
    static getColumns() {
        return [
            ImportColumn.make('name').requiredMapping().rules(['required', 'max:20']),
            ImportColumn.make('price').guess(['cost']).numeric().rules(['numeric']),
            ImportColumn.make('sku').rules(['required']).example('ABC-1'),
        ];
    }
    static async resolveRecord(data: Record<string, unknown>) { return (await Product.query().findOne({ sku: data.sku })) ?? null; }
}
class Products extends Resource {
    static slug = 'products';
    static adapter = new ObjectionAdapter(Product);
    static table(table: Table): Table {
        return table.columns([TextColumn.make('name')]).filters([SelectFilter.make('category').options({ a: 'A', b: 'B' })])
            .headerActions([ExportAction.make().exporter(ProductExporter), ImportAction.make().importer(ProductImporter)]);
    }
}
const panel = Panel.make().id('ie-test').key('k').resources([Products]);
const page = async () => {
    const ListPage = Products.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user, mailbox: 'ie', req: { query: {} }, res: {} };
    component._id = 'products';
    await component.mount({});
    return component;
};
const run = (fn: () => Promise<unknown>) => runInRequest('ie', fn);
const downloadOf = (url: string) => panel.getDownloads().get(decodeURIComponent(url.split('/downloads/')[1]), user.id)!;

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('products', (table) => { table.increments('id'); table.string('name'); table.float('price'); table.string('sku'); table.string('category'); });
    await db('products').insert([{ name: 'Lamp', price: 12.5, sku: 'L-1', category: 'a' }, { name: '=HYPERLINK("x")', price: 3, sku: 'X-1', category: 'b' }]);
});
after(() => db.destroy());

test('CSV helpers: formula injection is neutralized, quoted cells are parsed', () => {
    assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
    assert.equal(csvCell('-12.5'), '-12.5', 'a negative number stays a number');
    assert.equal(csvCell('a,"b"'), '"a,""b"""');
    assert.deepEqual(parseCsv('﻿name,note\r\n"Lamp","big, ""bright""\nlamp"\r\n\r\nDesk,\n'), [['name', 'note'], ['Lamp', 'big, "bright"\nlamp'], ['Desk', '']]);
});

test('export: the table query (filters) and the chosen columns, downloadable by its owner only', async () => {
    const list = await page();
    list.tableFilters = { category: { value: 'a' } };
    await run(() => list.mountAction('export', {}, { table: true }));
    assert.deepEqual(list.mountedActions[0].data.columns, ['name', 'price'], 'enabled by default');
    list.mountedActions[0].data.columns = ['name', 'price', 'evil'];
    await run(() => list.callMountedAction());
    assert.ok(Object.keys(list._errors).length, 'an unknown column is refused by the form');
    list.mountedActions[0].data.columns = ['name', 'price'];
    const { pending } = await run(() => list.callMountedAction());
    assert.equal(pending[0].title, 'Export completed');
    assert.match(String(pending[0].body), /1 row exported/);
    const url = pending[0].actions![0].url!;
    assert.match(url, /^\/downloads\/[A-Za-z0-9_-]+$/);
    assert.equal(downloadOf(url).content.toString('utf8'), '﻿Name,Price (USD)\r\nLamp,12.50\r\n');
    assert.equal(panel.getDownloads().get(decodeURIComponent(url.split('/downloads/')[1]), 999), null, 'another user cannot download it');
    list.tableFilters = { category: { value: 'b' } };
    await run(() => list.mountAction('export', {}, { table: true }));
    const second = await run(() => list.callMountedAction());
    assert.match(downloadOf(second.pending[0].actions![0].url!).content.toString('utf8'), /'=HYPERLINK\(""x""\)/, 'formulas are neutralized');
});

test('import: mapping by name or guess, validation, update of existing records, failed rows file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'navette-import-'));
    const file = path.join(dir, 'products.csv');
    writeFileSync(file, 'Name,cost,sku\nChair,40,C-1\nLamp v2,15,L-1\n,9,Z-1\nTable,abc,T-1\n');
    const list = await page();
    const action = list.getTable().getHeaderActions()[1];
    const { pending } = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { file: { file: { path: file } } } }));
    const rows = await db('products').orderBy('id');
    assert.deepEqual(rows.map((row: any) => [row.name, row.sku]), [['Lamp v2', 'L-1'], ['=HYPERLINK("x")', 'X-1'], ['Chair', 'C-1']]);
    assert.equal(pending[0].status, 'warning');
    assert.match(String(pending[0].body), /2 rows imported\. 2 rows failed/);
    const failed = downloadOf(pending[0].actions![0].url!).content.toString('utf8');
    assert.match(failed, /Name,cost,sku,error/);
    assert.match(failed, /,9,Z-1,The name field is required\./);
    assert.match(failed, /Table,abc,T-1,The price field must be a number\./);
    writeFileSync(file, 'cost,sku\n1,A\n');
    const missing = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { file: { file: { path: file } } } }));
    assert.equal(missing.pending[0].status, 'danger', 'a required column is missing');
    const forged = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { file: '/etc/passwd' } }));
    assert.equal(forged.pending.length, 0, 'a path sent by the browser is ignored');
});
