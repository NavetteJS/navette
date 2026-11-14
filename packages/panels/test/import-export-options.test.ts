// Import and export options: import columns (casting, multiple values, relationships, blank
// state, sensitive data), importer hooks and options, reading options of the action, the fakes, export column formatting,
// export action options, XLSX styling, and the durable download store.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { Checkbox, TextInput, useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { TextColumn, type Table } from '@navette-js/tables';
import {
    DiskDownloadStore, DownloadStore, sendDownload, ExportAction, ExportBulkAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, ImportValidationError, Panel, readSpreadsheet,
    registerDownloader, Resource, RowImportFailedError, XlsxCell, XlsxColor, XlsxOptions, XlsxStyle, type ImportRowContext, type User,
} from '../src/index.ts';
import { downloaderOf } from '../src/downloads.ts';
import { importFileRule } from '../src/imports.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Brand extends Model { static tableName = 'brands'; }
class Tag extends Model { static tableName = 'tags'; }
class Item extends Model {
    static tableName = 'items';
    static get relationMappings() {
        return {
            brand: { relation: Model.BelongsToOneRelation, modelClass: Brand, join: { from: 'items.brand_id', to: 'brands.id' } },
            tags: { relation: Model.ManyToManyRelation, modelClass: Tag, join: { from: 'items.id', through: { from: 'item_tag.item_id', to: 'item_tag.tag_id' }, to: 'tags.id' } },
        };
    }
}
let db: Knex;
const user: User = { id: 7, name: 'U', email: 'u@x.test' };
const adapter = new ObjectionAdapter(Item);
const dir = mkdtempSync(path.join(tmpdir(), 'navette-import-export-options-'));
const csvFile = (name: string, content: string | Buffer) => { const file = path.join(dir, name); writeFileSync(file, content); return file; };

const hooks: string[] = [];
/** A custom downloader of the exporter's CSV files. */
const csvDownloader = (file: any, res: any) => { res.sent = `custom:${file.name}`; };
class ItemImporter extends Importer {
    static getColumns() {
        return [
            ImportColumn.make('name').requiredMappingForNewRecordsOnly().rules(['required', 'max:20']).examples(['Lamp', 'Desk']).exampleHeader('Item name'),
            ImportColumn.make('sku').label('SKU').validationAttribute('SKU').rules(['required']).example('L-1'),
            ImportColumn.make('price').numeric(true, 2).rules(['numeric', 'min:0']).ignoreBlankState(),
            ImportColumn.make('ratings').multiple('|').integer().nestedRecursiveRules(['min:1', 'max:5']).fillRecordUsing((values, state: number[]) => { values.ratings = state.length ? state.join(',') : null; }),
            ImportColumn.make('brand').relationship(null, 'name'),
            ImportColumn.make('tags').relationship().multiple(',').helperText('Tag keys, separated by commas.'),
            ImportColumn.make('secret').sensitive().rules(['max:3']),
        ];
    }
    static async resolveRecord(data: Record<string, unknown>, ctx: ImportRowContext) {
        const existing = await Item.query().findOne({ sku: String(data.sku ?? '') });
        if (existing) return existing;
        // Only updates, when asked by the options.
        return ctx.options.updateOnly ? null : {};
    }
    static getValidationMessages() { return { 'sku.required': 'Every row needs a :attribute.' }; }
    static async beforeValidate(ctx: ImportRowContext) { hooks.push('beforeValidate'); if (ctx.data.name === 'Hooked') ctx.data.name = 'Hooked!'; }
    static async afterValidate() { hooks.push('afterValidate'); }
    static async beforeFill() { hooks.push('beforeFill'); }
    static async afterFill(ctx: ImportRowContext) { hooks.push('afterFill'); if (ctx.values.name === 'Rejected') throw new ImportValidationError({ name: 'This name is reserved.' }); }
    static async beforeSave() { hooks.push('beforeSave'); }
    static async beforeCreate() { hooks.push('beforeCreate'); }
    static async beforeUpdate() { hooks.push('beforeUpdate'); }
    static async afterSave() { hooks.push('afterSave'); }
    static async afterCreate() { hooks.push('afterCreate'); }
    static async afterUpdate() { hooks.push('afterUpdate'); }
    static getOptionsFormComponents() { return [Checkbox.make('updateOnly').label('Only update existing items')]; }
    static getCompletedNotificationTitle() { return 'Items imported'; }
    static modifyCompletedNotification(notification: any) { return notification.icon('o-shopping-bag'); }
}
class ItemExporter extends Exporter {
    static getColumns() {
        return [
            ExportColumn.make('name'),
            ExportColumn.make('sku').label('SKU'),
            ExportColumn.make('description').limit(10).enabledByDefault(false),
            ExportColumn.make('words').state((record) => record.description).words(2, '…').enabledByDefault(false),
            ExportColumn.make('domain').state((record) => record.sku?.toLowerCase()).prefix('https://').suffix('.test').enabledByDefault(false),
            ExportColumn.make('cost').state((record, ctx) => Number(record.price ?? 0) * Number(ctx.options.multiplier ?? 1)).enabledByDefault(false),
            ExportColumn.make('secret').hidden(),
        ];
    }
    static getOptionsFormComponents() { return [TextInput.make('multiplier').numeric()]; }
    static getCsvDelimiter() { return ';'; }
    static getDownloader(format: 'csv' | 'xlsx') { return format === 'csv' ? csvDownloader : sendDownload; }
    static getXlsxCellStyle() { return new XlsxStyle().setFontSize(12).setFontName('Consolas'); }
    static getXlsxHeaderCellStyle() { return new XlsxStyle().setFontBold().setFontColor(XlsxColor.rgb(255, 255, 77)).setBackgroundColor(XlsxColor.BLACK).setCellAlignment('center'); }
    static getXlsxWriterOptions() { return new XlsxOptions().setColumnWidth(30, 1).setColumnWidthForRange(12, 2, 3); }
    static makeXlsxRow(values: unknown[], style: XlsxStyle | null, columns: string[]) { return { cells: values.map((value, index) => (columns[index] === 'sku' ? XlsxCell.fromValue(value, new XlsxStyle().setFontItalic()) : value)), style }; }
}
class Items extends Resource {
    static slug = 'items';
    static adapter = adapter;
    static table(table: Table): Table {
        return table.columns([TextColumn.make('name'), TextColumn.make('sku').toggleable(true, { isToggledHiddenByDefault: true })])
            .headerActions([
                ExportAction.make().exporter(ItemExporter).enableVisibleTableColumnsByDefault().columnMappingColumns(3).options({ multiplier: 2 })
                    .modifyQueryUsing((query, { options }) => { if (options.onlyCheap) query.where('price', '<', 10); }).fileName((run) => `items-${run.totalRows}`).chunkSize(1),
                ImportAction.make().importer(ItemImporter).options({ source: 'test' }).chunkSize(2),
                ImportAction.make('importSemicolon').importer(ItemImporter).csvDelimiter(';').csvEncoding('windows-1252').headerOffset(1)
                    .fileRules([(file) => (file.name.endsWith('.txt') ? 'Text files are not accepted.' : null)]),
            ])
            .groupedBulkActions([ExportBulkAction.make('exportSelected').exporter(ItemExporter)]);
    }
}
const panel = Panel.make().id('import-export-options').key('k').downloads(new DownloadStore()).resources([Items]);
const page = async () => {
    const ListPage = Items.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user, mailbox: 'import-export-options', req: { query: {} }, res: {} };
    component._id = 'items';
    await component.mount({});
    return component;
};
const run = <T>(fn: () => Promise<T>) => runInRequest('import-export-options', fn);
const downloadOf = (url: string) => panel.getDownloads().get(decodeURIComponent(url.split('/downloads/')[1]), user.id) as any;
const callImport = async (list: any, index: number, data: Record<string, unknown>) => run(() => list.getTable().getHeaderActions()[index].call({ livewire: list, record: null, arguments: {}, data }));
/** The worksheet and the styles of an XLSX file. */
function xlsxParts(file: Buffer): Record<string, string> {
    const parts: Record<string, string> = {};
    let offset = 0;
    while (file.readUInt32LE(offset) === 0x04034b50) {
        const size = file.readUInt32LE(offset + 18), nameLength = file.readUInt16LE(offset + 26);
        const entry = file.toString('utf8', offset + 30, offset + 30 + nameLength);
        parts[entry] = inflateRawSync(file.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size)).toString('utf8');
        offset += 30 + nameLength + size;
    }
    return parts;
}

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('brands', (table) => { table.increments('id'); table.string('name'); });
    await db.schema.createTable('tags', (table) => { table.increments('id'); table.string('name'); });
    await db.schema.createTable('items', (table) => { table.increments('id'); table.string('name'); table.string('sku'); table.float('price'); table.string('ratings'); table.integer('brand_id'); table.string('secret'); table.text('description'); });
    await db.schema.createTable('item_tag', (table) => { table.integer('item_id'); table.integer('tag_id'); });
    await db('brands').insert([{ name: 'Acme' }, { name: 'Globex' }]);
    await db('tags').insert([{ name: 'red' }, { name: 'blue' }, { name: 'green' }]);
});
after(() => db.destroy());

test('import columns: guesses, casting, multiple values with nested rules, validation attribute, examples, helper text', async () => {
    const column = ImportColumn.make('unit_price').label('Unit price').guesses(['cost']);
    assert.ok(['unit price', 'unit_price', 'unit-price', 'cost'].every((guess) => column.getGuesses().includes(guess)));
    assert.ok(column.matches('Unit-Price') && column.matches('COST') && !column.matches('price'));
    assert.equal(ImportColumn.make('price').numeric(true, 1).castState(' $12.46 '), 12.5);
    assert.equal(ImportColumn.make('qty').integer().castState('7.9'), 7);
    assert.ok(Number.isNaN(ImportColumn.make('price').numeric().castState('twelve') as number), 'text without a number stays invalid');
    assert.equal(ImportColumn.make('ok').boolean().castState('off'), 0);
    assert.deepEqual(ImportColumn.make('tags').multiple(',').castState(' a, ,b '), ['a', 'b']);
    assert.equal(ImportColumn.make('price').numeric().castStateUsing((state, { originalState }) => `${state}/${originalState}`).castState('3'), '3/3');
    assert.equal(ImportColumn.make('full_name').getValidationAttribute(), 'full name');
    assert.equal(ImportColumn.make('name').label('Name').validationAttribute('item title').getValidationAttribute(), 'item title');
    const name = ItemImporter.getColumns()[0];
    assert.deepEqual(name.getExamples(), ['Lamp', 'Desk']);
    assert.equal(name.getExampleHeader(), 'Item name');
    assert.equal((ItemImporter.getColumns()[5].getSelect(['tags']) as any)._slots.belowContent, 'Tag keys, separated by commas.');
    assert.throws(() => ImportColumn.make('x').rules(['not_a_rule']), /Unknown validation rule/);
    // Each value of a multiple column is validated.
    const result = await ItemImporter.test({ adapter }).import({ name: 'Rated', sku: 'R-1', ratings: '3|9' });
    result.assertHasErrors({ 'ratings.1': 'max' }).assertHasNoErrors(['name']);
});

test('importer: hooks in order, options, custom messages, validation errors from hooks, required mapping for new records', async () => {
    hooks.length = 0;
    const created = await ItemImporter.test({ adapter }).import({ name: 'Hooked', sku: 'H-1', price: '4.999', brand: 'Globex', tags: '1,3,1' });
    created.assertImported().assertHasNoRowFailure();
    assert.deepEqual(hooks, ['beforeValidate', 'afterValidate', 'beforeFill', 'afterFill', 'beforeSave', 'beforeCreate', 'afterSave', 'afterCreate']);
    const record = created.getRecord();
    assert.equal(record.name, 'Hooked!', 'beforeValidate changed the data');
    assert.equal(record.price, 5);
    assert.equal(record.brand_id, 2, 'the brand was found by its name');
    assert.deepEqual((await db('item_tag').where('item_id', record.id).orderBy('tag_id')).map((row: any) => row.tag_id), [1, 3], 'tags linked once each');
    hooks.length = 0;
    // An existing record is updated; a blank price keeps the stored one (ignoreBlankState).
    const updated = await ItemImporter.test({ adapter }).import({ name: 'Hooked v2', sku: 'H-1', price: '' });
    updated.assertImported();
    assert.ok(hooks.includes('beforeUpdate') && hooks.includes('afterUpdate') && !hooks.includes('beforeCreate'));
    assert.equal((await Item.query().findOne({ sku: 'H-1' }) as any).price, 5);
    // Relationships that match nothing fail validation.
    (await ItemImporter.test({ adapter }).import({ name: 'Lost', sku: 'Z-1', brand: 'Nope', tags: '1,99' })).assertHasErrors({ brand: 'exists', tags: 'exists' });
    // Custom message, and validation errors thrown by a hook.
    const missingSku = await ItemImporter.test({ adapter }).import({ name: 'No SKU', sku: '' });
    assert.equal(missingSku.errors().sku, 'Every row needs a SKU.');
    (await ItemImporter.test({ adapter }).import({ name: 'Rejected', sku: 'J-1' })).assertHasErrors({ name: 'This name is reserved.' });
    // `name` is only required when creating: an existing record may be updated without it.
    const columnMap = { sku: 'sku', price: 'price' };
    (await ItemImporter.test({ adapter, columnMap }).import({ sku: 'N-1', price: '1' })).assertHasErrors({ name: 'required' });
    (await ItemImporter.test({ adapter, columnMap }).import({ sku: 'H-1', price: '6' })).assertImported();
    // Nothing to write (a blank, ignored price): the record is kept as is.
    const unchanged = await ItemImporter.test({ adapter, columnMap: { sku: 'sku', price: 'price' } }).import({ sku: 'H-1', price: '' });
    assert.equal(unchanged.assertImported().getRecord().price, 6);
    // Options reach resolveRecord(): an unknown SKU is skipped, not created.
    const skipped = await ItemImporter.test({ adapter, options: { updateOnly: true } }).import({ name: 'Ghost', sku: 'G-1' });
    skipped.assertSkipped();
    assert.equal(skipped.getRecord(), null);
    assert.equal(await Item.query().findOne({ sku: 'G-1' }), undefined);
    assert.throws(() => skipped.assertImported(), /skipped/);
    assert.throws(() => created.assertSkipped(), /was imported/);
});

test('resolveRecord() returning null skips the row in the action too (counted as successful)', async () => {
    const list = await page();
    const file = csvFile('only-updates.csv', 'name,sku\nKnown,H-1\nUnknown,U-404\n');
    const { pending } = await callImport(list, 1, { file: { file: { path: file, name: 'only-updates.csv' } }, updateOnly: true });
    assert.equal(pending[0].title, 'Items imported', 'getCompletedNotificationTitle()');
    assert.equal(pending[0].icon, 'o-shopping-bag', 'modifyCompletedNotification()');
    assert.match(String(pending[0].body), /2 rows imported\./);
    assert.equal(await Item.query().findOne({ sku: 'U-404' }), undefined, 'the unknown row was not created');
    assert.equal((await Item.query().findOne({ sku: 'H-1' }) as any).name, 'Known');
});

test('import action: chunks, failed rows (sensitive values left out, formula injection), delimiter, encoding, header offset, file rules', async () => {
    const list = await page();
    const file = csvFile('items.csv', 'name,sku,secret\nChunk A,CA-1,ok\n=CMD(),CB-1,toolong\nChunk C,,abc\n');
    const { pending } = await callImport(list, 1, { file: { file: { path: file, name: 'items.csv' } } });
    assert.match(String(pending[0].body), /1 row imported\. 2 rows failed/);
    const failed = downloadOf(pending[0].actions[0].url).content.toString('utf8');
    assert.match(failed, /name,sku,secret,error/);
    assert.match(failed, /'=CMD\(\),CB-1,,The secret field must not be greater than 3 characters\./, 'the sensitive value is left out, the formula is neutralized');
    assert.match(failed, /Chunk C,,,Every row needs a SKU\./);
    ItemImporter.preventFormulaInjection(false);
    try {
        const again = await callImport(list, 1, { file: { file: { path: csvFile('items2.csv', 'name,sku\n=CMD(),\n'), name: 'items2.csv' } } });
        assert.match(downloadOf(again.pending[0].actions[0].url).content.toString('utf8'), /\r\n=CMD\(\),,/);
    } finally { ItemImporter.preventFormulaInjection(true); }
    // Windows-1252, semicolons, a title row before the header.
    // A `__proto__` header is only a header.
    await callImport(list, 1, { file: { file: { path: csvFile('proto.csv', '__proto__,name,sku\nx,Proto,P-1\n'), name: 'proto.csv' } } });
    assert.equal((await Item.query().findOne({ sku: 'P-1' }) as any)?.name, 'Proto');
    assert.equal(({} as any).x, undefined);
    const latin = Buffer.concat([Buffer.from('Inventory of the shop\nname;sku\n', 'latin1'), Buffer.from([0x43, 0x61, 0x66, 0xe9]), Buffer.from(';CF-1\n', 'latin1')]);
    await callImport(list, 2, { file: { file: { path: csvFile('latin.csv', latin), name: 'latin.csv' } } });
    assert.equal((await Item.query().findOne({ sku: 'CF-1' }) as any)?.name, 'Café');
    assert.deepEqual(readSpreadsheet(csvFile('guess.csv', 'a|b|c\n1|2|3\n'), 10), [['a', 'b', 'c'], ['1', '2', '3']], 'the delimiter is guessed');
    // A file rule is a rule of the upload field, checked against the temporary file.
    const textRule = importFileRule((file) => (file.name.endsWith('.txt') ? 'Text files are not accepted.' : null), () => list);
    assert.equal(await textRule.passes({ file: { path: file, name: 'notes.txt' } }, null as any), false);
    assert.equal(textRule.message('file'), 'Text files are not accepted.');
    assert.equal(await importFileRule('extensions:csv,txt', () => list).passes({ file: { path: file, name: 'items.xlsx' } }, null as any), false);
    assert.equal(await importFileRule('max:1', () => list).passes({ file: { path: file, name: 'a.csv', size: 4096 } }, null as any), false);
    assert.throws(() => ImportAction.make().fileRules('dimensions:min_width=1'), /unsupported file rule/);
    assert.throws(() => ImportAction.make().csvDelimiter(';;'), /single character/);
});

test('import action: options form, example file with several rows, duplicate headers refused', async () => {
    const list = await page();
    await run(() => list.mountAction('import', {}, { table: true }));
    const example = list.getTable().getHeaderActions()[1].getExtraModalFooterActions()[0];
    let redirected = '';
    await run(() => example.call({ livewire: { ...list, _ctx: list._ctx, redirect: (url: string) => { redirected = url; } }, record: null, arguments: {}, data: {} }));
    const csv = downloadOf(redirected);
    assert.equal(csv.name, 'item-importer-example.csv');
    assert.equal(csv.content.toString('utf8'), '﻿Item name,sku,price,ratings,brand,tags,secret\r\nLamp,L-1,,,,,\r\nDesk,,,,,,\r\n');
});

test('ImportAction.fake(): requests are recorded with the column map and the merged options, rows are not processed', async () => {
    const imports = ImportAction.fake();
    try {
        const list = await page();
        imports.assertNothingDispatched();
        await callImport(list, 1, { file: { file: { path: csvFile('fake.csv', 'Item name,SKU\nFaked,F-1\n'), name: 'fake.csv' } }, columnMap: { name: 'Item name', sku: 'SKU', price: 'evil' }, updateOnly: true });
        assert.equal(await Item.query().findOne({ sku: 'F-1' }), undefined, 'nothing imported');
        imports.assertDispatched(ItemImporter)
            .assertDispatched(ItemImporter, (run, columnMap, options) => run.userId === 7 && run.totalRows === 1 && columnMap.sku === 'SKU' && columnMap.price === null && options.updateOnly === true && options.source === 'test')
            .assertDispatchedTimes(ItemImporter)
            .assertNotDispatched('OtherImporter')
            .assertNotDispatched(ItemImporter, (run) => run.userId === 8);
        assert.throws(() => imports.assertNothingDispatched(), /Imports were dispatched/);
        assert.throws(() => imports.assertDispatchedTimes(ItemImporter, 2), /2 time/);
        assert.throws(() => imports.assertDispatched(ItemImporter, () => false), /with matching data/);
    } finally { imports.restore(); }
});

test('export columns: limit, words, prefix and suffix, lists, hidden columns, formula injection; Exporter.test() with options', () => {
    const record = { name: 'Oak desk', sku: 'DESK', price: 4, description: 'A solid oak desk with drawers', tags: ['a', '=b'] };
    const exporter = ItemExporter.test({ description: 'Description', words: 'Words', domain: 'Domain', cost: 'Cost' }, { options: { multiplier: 3 } });
    assert.deepEqual(exporter.export(record), ['A solid oa...', 'A solid…', 'https://desk.test', 12]);
    assert.deepEqual(ItemExporter.test().labels, ['Name', 'SKU'], 'hidden and disabled columns are left out');
    assert.deepEqual(ItemExporter.test({ secret: 'Secret' }).labels, ['Secret'], 'an explicit map includes hidden columns');
    assert.equal(ExportColumn.make('tags').getFormattedState(record), 'a, =b');
    assert.equal(ExportColumn.make('tags').listAsJson().getFormattedState(record), '["a","=b"]');
    assert.equal(ExportColumn.make('tags').formatStateUsing((tag) => tag.toUpperCase()).getFormattedState(record), 'A, =B');
    assert.equal(ExportColumn.make('formula').state(() => '=1+1').preventFormulaInjection().getFormattedState({}), "'=1+1");
    assert.equal(ExportColumn.make('negative').state(() => '-5').preventFormulaInjection().getFormattedState({}), '-5');
    assert.equal(ExportColumn.make('cost').hidden(({ options }) => !options.admin).isHidden({ options: { admin: true } }), false);
});

test('export action: visible table columns, options, query modifier, file name, CSV delimiter, chunks, XLSX styles', async () => {
    await db('items').insert([{ name: 'Cheap pen', sku: '=PEN', price: 2, description: 'x' }]);
    const list = await page();
    await run(() => list.mountAction('export', {}, { table: true }));
    assert.deepEqual(list.mountedActions[0].data.columns, ['name'], 'the SKU column is hidden in the table');
    list.mountedActions[0].data.columns = ['name', 'sku', 'cost'];
    list.mountedActions[0].data.multiplier = 5;
    // `onlyCheap` is not a component of the form: it never reaches the options.
    list.mountedActions[0].data.onlyCheap = true;
    const { pending } = await run(() => list.callMountedAction());
    const total = await db('items').count({ count: '*' }).first();
    const [csvLink, xlsxLink] = pending[0].actions;
    const csv = downloadOf(csvLink.url);
    assert.equal(csv.downloader, 'export:ItemExporter:csv');
    assert.equal(downloaderOf(csv), csvDownloader, 'getDownloader(): the CSV file is sent by the downloader of the exporter');
    assert.equal(downloaderOf(downloadOf(xlsxLink.url)), sendDownload);
    assert.equal(csv.name, `items-${(total as any).count}.csv`, 'fileName()');
    const lines = csv.content.toString('utf8').replace(/^﻿/, '').split('\r\n');
    assert.equal(lines[0], 'Name;SKU;Cost');
    assert.equal(lines.length - 2, Number((total as any).count), 'the injected onlyCheap option was ignored: every record is exported');
    assert.ok(lines.includes("Cheap pen;'=PEN;10"), 'options form value overrides the static option; formulas neutralized');
    const parts = xlsxParts(downloadOf(xlsxLink.url).content);
    const sheet = parts['xl/worksheets/sheet1.xml'], styles = parts['xl/styles.xml'];
    assert.match(sheet, /<cols><col min="1" max="1" width="30" customWidth="1"\/><col min="2" max="3" width="12" customWidth="1"\/><\/cols>/);
    assert.match(styles, /<font><b\/><sz val="11"\/><color rgb="FFFFFF4D"\/><name val="Calibri"\/><\/font>/, 'header font');
    assert.match(styles, /<patternFill patternType="solid"><fgColor rgb="FF000000"\/>/, 'header background');
    assert.match(styles, /<alignment horizontal="center"\/>/);
    assert.match(styles, /<font><sz val="12"\/><name val="Consolas"\/><\/font>/, 'cell font');
    assert.match(styles, /<font><i\/><sz val="12"\/><name val="Consolas"\/><\/font>/, 'the SKU cells are italic on top of the cell style');
    // The query modifier receives the options.
    const action = list.getTable().getHeaderActions()[0].options({ multiplier: 2, onlyCheap: true });
    const cheap = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } }));
    const cheapNames = (await db('items').where('price', '<', 10).orderBy('id')).map((row: any) => row.name);
    assert.ok(cheapNames.includes('Cheap pen') && cheapNames.length < Number((total as any).count));
    assert.equal(downloadOf(cheap.pending[0].actions[0].url).content.toString('utf8').replace(/^﻿/, ''), `Name\r\n${cheapNames.join('\r\n')}\r\n`);
});

test('ExportAction.fake() and ExportBulkAction.fake(): the query, column map, options, formats and selected records', async () => {
    const exports = ExportBulkAction.fake();
    try {
        const list = await page();
        await run(() => list.mountAction('export', {}, { table: true }));
        list.mountedActions[0].data.columns = ['name', 'sku'];
        list.mountedActions[0].data.multiplier = 4;
        await run(() => list.callMountedAction());
        await exports.assertDispatched(ItemExporter, async (run, query, columnMap, options, formats, records) => {
            assert.deepEqual(columnMap, { name: 'Name', sku: 'SKU' });
            assert.equal(options.multiplier, 4, 'the form value overrides the static option');
            assert.deepEqual(formats, ['csv', 'xlsx']);
            assert.equal(records, null);
            assert.equal(run.totalRows, await query.count());
            return true;
        });
        const keys = (await Item.query().orderBy('id')).map((item: any) => String(item.id));
        list.selectedTableRecords = [keys[1]];
        const bulk = list.getBulkActions().find((action: any) => action.getName() === 'exportSelected');
        await run(() => bulk.call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } }));
        await exports.assertDispatched(ItemExporter, async (run, query, _columnMap, _options, _formats, records) => {
            if (records === null) return false;
            assert.deepEqual(records, [keys[1]]);
            assert.equal(run.totalRows, 1);
            assert.ok((await query.getKeys()).length > 1, 'the query is not restricted to the selection');
            return true;
        });
        exports.assertDispatchedTimes(ItemExporter, 2);
        await exports.assertNotDispatched('OtherExporter');
        await assert.rejects(exports.assertNotDispatched(ItemExporter), /unexpected \[ItemExporter\] export/);
        assert.throws(() => exports.assertNothingDispatched(), /Unexpected exports/);
        assert.equal(ExportAction.fake() !== exports, true);
        ExportAction.fake().assertNothingDispatched();
    } finally { ExportAction.fake().restore(); }
});

test('downloads: kept on the disk across restarts, for their owner, until they expire; custom downloaders', async () => {
    const directory = path.join(dir, 'downloads');
    const store = new DiskDownloadStore({ directory, ttl: 60_000 });
    const token = store.put(7, 'export.csv', 'text/csv', 'a,b\r\n');
    // A new store on the same directory (another process, or after a restart) finds the file.
    const restarted = new DiskDownloadStore({ directory });
    assert.equal(restarted.get(token, 7)?.content.toString('utf8'), 'a,b\r\n');
    assert.equal(restarted.get(token, 8), null, 'another user cannot read it');
    assert.equal(restarted.get('../../etc/passwd', 7), null, 'a forged token is refused');
    const short = store.put(7, 'old.csv', 'text/csv', 'x', { ttl: -1 });
    assert.equal(restarted.get(short, 7), null, 'an expired file is refused');
    store.put(7, 'old2.csv', 'text/csv', 'y', { ttl: -1 });
    assert.equal(restarted.prune(), 1, 'prune() removes the expired files');
    assert.equal(readdirSync(directory).filter((entry) => entry.endsWith('.json')).length, 1);
    const capped = new DiskDownloadStore({ directory: path.join(dir, 'capped'), maxFiles: 2 });
    const first = capped.put(1, 'a', 't', 'a', { ttl: 60_000 }); capped.put(1, 'b', 't', 'b', { ttl: 120_000 }); capped.put(1, 'c', 't', 'c', { ttl: 180_000 });
    capped.prune();
    assert.equal(capped.get(first, 1), null, 'over the limit, the file closest to expiry goes first');
    // A downloader stored with the file sends it.
    let sent = '';
    registerDownloader('test:redirect', (file, res) => { sent = `${file.name}:${res}`; });
    const custom = store.put(7, 'remote.csv', 'text/csv', 'z', { downloader: 'test:redirect' });
    await downloaderOf(store.get(custom, 7)!)(store.get(custom, 7)!, 'res');
    assert.equal(sent, 'remote.csv:res');
    // The panel stores downloads on the disk by default.
    assert.ok(Panel.make().id('default-downloads').getDownloads() instanceof DiskDownloadStore);
    void RowImportFailedError;
});
