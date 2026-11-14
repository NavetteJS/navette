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
    static async resolveRecord(data: Record<string, unknown>) { return (await Product.query().findOne({ sku: data.sku })) ?? {}; }
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

test('XLSX writer: valid archive, header row, text cells (formulas never evaluated)', async () => {
    const { buildXlsx } = await import('../src/xlsx.ts');
    const { inflateRawSync } = await import('node:zlib');
    const file = buildXlsx([['Name', 'Note'], ['Ada', '=1+1 <b>&\u0001']]);
    assert.equal(file.readUInt32LE(0), 0x04034b50);
    // Read the sheet back from the archive.
    const name = 'xl/worksheets/sheet1.xml';
    let offset = 0, sheet = '';
    while (file.readUInt32LE(offset) === 0x04034b50) {
        const size = file.readUInt32LE(offset + 18), nameLength = file.readUInt16LE(offset + 26);
        const entry = file.toString('utf8', offset + 30, offset + 30 + nameLength);
        const data = file.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
        if (entry === name) sheet = inflateRawSync(data).toString('utf8');
        offset += 30 + nameLength + size;
    }
    assert.match(sheet, /<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Name<\/t><\/is><\/c>/);
    assert.match(sheet, /<t xml:space="preserve">=1\+1 &lt;b&gt;&amp;<\/t>/);
    assert.doesNotMatch(sheet, /<f>/);
});

test('import: XLSX files (shared strings, numbers, gaps), chosen columns override the guesses', async () => {
    const { buildXlsx, readXlsx } = await import('../src/xlsx.ts');
    const { deflateRawSync } = await import('node:zlib');
    assert.deepEqual(readXlsx(buildXlsx([['a', 'b'], ['1', '<&>']])), [['a', 'b'], ['1', '<&>']]);
    // A workbook as spreadsheet software writes it: shared strings, a numeric cell, an empty cell.
    const entries: [string, string][] = [
        ['xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="Data" sheetId="1" r:id="rId7"/></sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/data.xml"/></Relationships>'],
        ['xl/sharedStrings.xml', '<sst><si><t>Name</t></si><si><t>sku</t></si><si><r><t>Ar</t></r><r><t>mchair</t></r></si><si><t>A-1</t></si><si><t>Price</t></si></sst>'],
        ['xl/worksheets/data.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>4</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>99.5</v></c><c r="C2" t="s"><v>3</v></c></row><row r="3"><c r="C3" t="inlineStr"><is><t>B-2</t></is></c></row></sheetData></worksheet>'],
    ];
    const local: Buffer[] = [], central: Buffer[] = [];
    let offset = 0;
    for (const [name, content] of entries) {
        const data = Buffer.from(content), packed = deflateRawSync(data), nameBuffer = Buffer.from(name);
        const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(8, 8); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nameBuffer.length, 26);
        const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(nameBuffer.length, 28); entry.writeUInt32LE(offset, 42);
        local.push(head, nameBuffer, packed); central.push(entry, nameBuffer); offset += 30 + nameBuffer.length + packed.length;
    }
    const size = central.reduce((total, part) => total + part.length, 0);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
    const workbook = Buffer.concat([...local, ...central, end]);
    assert.deepEqual(readXlsx(workbook), [['Name', 'Price', 'sku'], ['Armchair', '99.5', 'A-1'], ['', '', 'B-2']]);
    const dir = mkdtempSync(path.join(tmpdir(), 'navette-xlsx-'));
    const file = path.join(dir, 'products.xlsx');
    writeFileSync(file, workbook);
    await db('products').delete();
    const list = await page();
    const action = list.getTable().getHeaderActions()[1];
    // "Price" is not a guess of the price column: the user maps it.
    await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { file: { file: { path: file } }, columnMap: { name: 'Name', price: 'Price', sku: 'sku' } } }));
    assert.deepEqual((await db('products').orderBy('id')).map((row: any) => [row.name, row.price, row.sku]), [['Armchair', 99.5, 'A-1']]);
    // A column mapped to a header the file does not have is not imported.
    await db('products').delete();
    await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { file: { file: { path: file } }, columnMap: { name: 'Name', price: 'Forged', sku: 'sku' } } }));
    assert.deepEqual((await db('products').orderBy('id')).map((row: any) => [row.name, row.price]), [['Armchair', null]]);
});

test('queued export: started notice now, files and history later, completion in the database notifications', async () => {
    const { importExportSchema, knexImportExportHistory, useBackgroundRunner } = await import('../src/index.ts');
    await importExportSchema(db);
    const sent: { user: string | number; notification: any }[] = [];
    const store = { send: async (target: string | number, notification: any) => { sent.push({ user: target, notification }); }, list: async () => [], count: async () => 0, unreadCount: async () => 0, delete: async () => {}, markAsRead: async () => {}, markAllAsRead: async () => {}, deleteAll: async () => {} } as any;
    const queuedPanel = Panel.make().id('ie-queued').key('k').resources([Products]).databaseNotifications(store).importExportHistory(knexImportExportHistory((table) => db(table)));
    const tasks: (() => Promise<void>)[] = [];
    useBackgroundRunner((task) => tasks.push(task));
    try {
        await db('products').delete();
        await db('products').insert([{ name: 'Lamp', price: 12.5, sku: 'L-1', category: 'a' }]);
        const list = await page();
        list._ctx.panel = queuedPanel;
        const action = list.getTable().getHeaderActions()[0].queued();
        const { pending } = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } }));
        assert.equal(pending[0].title, 'Export started');
        assert.equal(sent.length, 0, 'nothing is done before the background task runs');
        assert.equal(tasks.length, 1);
        await tasks[0]();
        assert.equal(sent[0].user, 7);
        assert.equal(sent[0].notification.title, 'Export completed');
        assert.equal(sent[0].notification.actions.length, 2);
        const [history] = await db('exports');
        assert.equal(history.user_id, 7);
        assert.equal(history.successful_rows, 1);
        assert.ok(history.completed_at);
    } finally {
        useBackgroundRunner((task) => { setImmediate(() => { void task(); }); });
    }
});
