// Export file disks, custom export formats, XLSX writer hooks, Importer.saveRecord(), history with a polymorphic
// user, and the context handed to the background runner.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { TextColumn, type Table } from '@navette-js/tables';
import {
    DownloadStore, ExportAction, ExportColumn, Exporter, ImportAction, ImportColumn, Importer, importExportSchema, knexImportExportHistory, Panel, Resource,
    useBackgroundRunner, XlsxSheetView, XlsxStyle, XlsxWriter, type BackgroundTaskContext, type ExportFormatInterface, type ExportRun, type ImportRowContext, type User,
} from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Gadget extends Model { static tableName = 'gadgets'; }
let db: Knex;
const user: User = { id: 3, name: 'U', email: 'u@x.test' };

const JsonFormat: ExportFormatInterface = {
    getExtension: () => 'json',
    getMimeType: () => 'application/json',
    generate: ({ columns, rows }) => JSON.stringify(rows.map((row) => Object.fromEntries(columns.map((name, index) => [name, row[index]])))),
};
const MarkdownFormat: ExportFormatInterface = {
    getExtension: () => 'md',
    getMimeType: () => 'text/markdown',
    generate: ({ labels, rows }) => [labels.join(' | '), ...rows.map((row) => row.join(' | '))].join('\n'),
    getDownloadNotificationAction: (url) => ({ label: 'Open the Markdown table', url }),
};
class GadgetExporter extends Exporter {
    static getColumns() { return [ExportColumn.make('name'), ExportColumn.make('price')]; }
    static getFormats() { return ['xlsx' as const, JsonFormat]; }
    static getFileDiskName() { return 'reports'; }
    static getJobQueue() { return 'exports'; }
    static configureXlsxWriterAfterOpen(writer: XlsxWriter, run: ExportRun) { return writer.addRow({ cells: [`Gadgets (${run.totalRows})`], style: new XlsxStyle().setFontItalic() }); }
    static configureXlsxWriterBeforeClose(writer: XlsxWriter) {
        writer.addRow(['Total', 'n/a']);
        writer.getCurrentSheet().setName('Gadgets').setSheetView(new XlsxSheetView().setFreezeRow(3).setFreezeColumn('B'));
        return writer;
    }
}
const saved: string[] = [];
class GadgetImporter extends Importer {
    static getColumns() { return [ImportColumn.make('name').rules(['required']), ImportColumn.make('price').numeric()]; }
    static async resolveRecord(data: Record<string, unknown>) { return (await Gadget.query().findOne({ name: String(data.name) })) ?? {}; }
    static getJobQueue() { return 'imports'; }
    /** Saves through the adapter, then tags the row (a custom save). */
    static async saveRecord(values: Record<string, unknown>, record: any, ctx: ImportRowContext & { adapter: any; key: string | null }) {
        saved.push(`${ctx.key === null ? 'create' : 'update'}:${values.name ?? record?.name}`);
        return super.saveRecord({ ...values, ...(ctx.key === null ? { note: 'imported' } : {}) }, record, ctx);
    }
}
class Gadgets extends Resource {
    static slug = 'gadgets';
    static adapter = new ObjectionAdapter(Gadget);
    static table(table: Table): Table {
        return table.columns([TextColumn.make('name')]).headerActions([
            ExportAction.make().exporter(GadgetExporter),
            ExportAction.make('exportMarkdown').exporter(GadgetExporter).formats(['csv', MarkdownFormat]).fileDisk(null),
            ImportAction.make().importer(GadgetImporter),
        ]);
    }
}
const reports = new DownloadStore();
const panel = Panel.make().id('import-export').key('k').downloads(new DownloadStore()).downloadDisks({ reports }).resources([Gadgets]);
const page = async (targetPanel = panel) => {
    const ListPage = Gadgets.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel: targetPanel, user, mailbox: 'import-export', req: { query: {} }, res: {} };
    component._id = 'gadgets';
    await component.mount({});
    return component;
};
const run = <T>(fn: () => Promise<T>) => runInRequest('import-export', fn);
const tokenOf = (url: string) => decodeURIComponent(url.split('/downloads/')[1].split('?')[0]);
function xlsxParts(file: Buffer): Record<string, string> {
    const parts: Record<string, string> = {};
    let offset = 0;
    while (file.readUInt32LE(offset) === 0x04034b50) {
        const size = file.readUInt32LE(offset + 18), nameLength = file.readUInt16LE(offset + 26);
        parts[file.toString('utf8', offset + 30, offset + 30 + nameLength)] = inflateRawSync(file.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size)).toString('utf8');
        offset += 30 + nameLength + size;
    }
    return parts;
}

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('gadgets', (table) => { table.increments('id'); table.string('name'); table.float('price'); table.string('note'); });
    await db('gadgets').insert([{ name: 'Lamp', price: 12 }, { name: 'Desk', price: 80 }]);
});
after(() => db.destroy());

test('export: the exporter\'s disk, a custom format, XLSX rows above the header and below the data, sheet name, frozen panes', async () => {
    const list = await page();
    const { pending } = await run(() => list.getTable().getHeaderActions()[0].call({ livewire: list, record: null, arguments: {}, data: { columns: ['name', 'price'] } }));
    const [xlsxLink, jsonLink] = pending[0].actions;
    assert.match(xlsxLink.url, /\?disk=reports$/, 'the download URL names the disk');
    assert.equal(panel.getDownloads().get(tokenOf(xlsxLink.url), user.id), null, 'not in the default store');
    const json = reports.get(tokenOf(jsonLink.url), user.id)!;
    assert.equal(jsonLink.label, 'Download .json');
    assert.equal(json.type, 'application/json');
    assert.ok(json.name.endsWith('.json'));
    assert.deepEqual(JSON.parse(json.content.toString('utf8')), [{ name: 'Lamp', price: 12 }, { name: 'Desk', price: 80 }]);
    const parts = xlsxParts(reports.get(tokenOf(xlsxLink.url), user.id)!.content);
    const sheet = parts['xl/worksheets/sheet1.xml'];
    assert.match(parts['xl/workbook.xml'], /<sheet name="Gadgets"/);
    assert.match(sheet, /<sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"\/>/);
    const rows = [...sheet.matchAll(/<row r="(\d+)">(.*?)<\/row>/g)].map((match) => [...match[2].matchAll(/<t xml:space="preserve">(.*?)<\/t>/g)].map((cell) => cell[1]));
    assert.deepEqual(rows, [['Gadgets (2)'], ['Name', 'Price'], ['Lamp', '12'], ['Desk', '80'], ['Total', 'n/a']]);
    // The header (row 2) keeps its bold default format; the title row has its own style.
    assert.match(sheet, /<c r="A2" t="inlineStr" s="1">/);
    assert.doesNotMatch(sheet, /<c r="A1" t="inlineStr" s="1">/);
});

test('export: formats() with a custom format and its own download action; fileDisk(null) is the exporter\'s disk', async () => {
    const list = await page();
    const action = list.getTable().getHeaderActions()[1];
    assert.equal(action.getFileDisk(), null);
    const { pending } = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } }));
    const [csvLink, mdLink] = pending[0].actions;
    assert.equal(mdLink.label, 'Open the Markdown table');
    assert.match(csvLink.url, /\?disk=reports$/);
    assert.equal(reports.get(tokenOf(mdLink.url), user.id)!.content.toString('utf8'), 'Name\nLamp\nDesk');
    action.fileDisk('missing');
    await assert.rejects(() => run(() => action.call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } })), /Download disk \[missing\] is not registered/);
    assert.throws(() => action.formats(['pdf' as any]), /Unknown export format/);
    assert.throws(() => action.formats([{ getExtension: () => '../x', getMimeType: () => 'x', generate: () => '' }]), /Invalid export format extension/);
});

test('panel download disks: the URL names the disk, only registered names resolve', () => {
    assert.equal(panel.getDownloadUrl('abc', 'reports'), `${panel.getBaseUrl('downloads/abc')}?disk=reports`);
    assert.equal(panel.hasDownloadDisk('reports'), true);
    assert.equal(panel.hasDownloadDisk('__proto__'), false, 'only registered names');
    assert.equal(panel.getDownloadDisk(null), panel.getDownloads());
});

test('import: Importer.saveRecord() replaces the adapter writes; queued runs hand their context to the background runner', async () => {
    const list = await page();
    const file = { file: { path: '' } };
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const csv = path.join(mkdtempSync(path.join(tmpdir(), 'navette-import-export-')), 'gadgets.csv');
    writeFileSync(csv, 'name,price\nLamp,15\nChair,40\n');
    file.file.path = csv;
    await run(() => list.getTable().getHeaderActions()[2].call({ livewire: list, record: null, arguments: {}, data: { file, columnMap: { name: 'name', price: 'price' } } }));
    assert.deepEqual(saved, ['update:Lamp', 'create:Chair']);
    assert.deepEqual((await db('gadgets').orderBy('id')).map((row: any) => [row.name, row.price, row.note]), [['Lamp', 15, null], ['Desk', 80, null], ['Chair', 40, 'imported']]);

    // Queued: the runner receives the importer / exporter, the run and the queue name.
    const store = { send: async () => {}, list: async () => [], count: async () => 0, unreadCount: async () => 0, delete: async () => {}, markAsRead: async () => {}, markAllAsRead: async () => {} } as any;
    const queuedPanel = Panel.make().id('queued').key('k').downloads(new DownloadStore()).downloadDisks({ reports }).resources([Gadgets]).databaseNotifications(store);
    const contexts: BackgroundTaskContext[] = [];
    const tasks: (() => Promise<void>)[] = [];
    useBackgroundRunner((task, context) => { tasks.push(task); contexts.push(context!); });
    try {
        const queued = await page(queuedPanel);
        await run(() => queued.getTable().getHeaderActions()[0].queued().call({ livewire: queued, record: null, arguments: {}, data: { columns: ['name'] } }));
        await run(() => queued.getTable().getHeaderActions()[2].queued().call({ livewire: queued, record: null, arguments: {}, data: { file, columnMap: { name: 'name', price: 'price' } } }));
        assert.deepEqual(contexts.map((context) => [context.type, (context.exporter ?? context.importer)?.name, context.queue, context.connection, context.panel, context.userId]), [
            ['export', 'GadgetExporter', 'exports', null, 'queued', 3],
            ['import', 'GadgetImporter', 'imports', null, 'queued', 3],
        ]);
        assert.ok(contexts[0].run.fileName);
        for (const task of tasks) await task();
    } finally {
        useBackgroundRunner((task) => { setImmediate(() => { void task(); }); });
    }
});

test('history with a polymorphic user: user_type is the panel id', async () => {
    await importExportSchema(db, { polymorphicUser: true });
    assert.ok(await db.schema.hasColumn('exports', 'user_type'));
    const historyPanel = Panel.make().id('history').key('k').downloads(new DownloadStore()).downloadDisks({ reports }).resources([Gadgets])
        .importExportHistory(knexImportExportHistory((table) => db(table), { polymorphicUser: true }));
    const list = await page(historyPanel);
    await run(() => list.getTable().getHeaderActions()[0].call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } }));
    const [row] = await db('exports');
    assert.deepEqual([row.user_id, row.user_type], [3, 'history']);
    // Without the option, the column is left alone.
    const plain = knexImportExportHistory((table) => db(table));
    const id = await plain.startExport({ userId: 4, userType: 'other', exporter: 'X', fileName: 'x', totalRows: 0 });
    assert.equal((await db('exports').where('id', id).first()).user_type, null);
});

test('ExportAction / ImportAction configureUsing(); modifyCompletedNotification() keeps the links with getActions()', async () => {
    ExportAction.configureUsing((action) => action.fileDisk('reports'));
    ImportAction.configureUsing((action) => action.chunkSize(7));
    try {
        assert.equal(ExportAction.make().getFileDisk(), 'reports');
        assert.equal(ImportAction.make().getName(), 'import');
    } finally { ExportAction.resetConfiguration(); ImportAction.resetConfiguration(); }
    assert.equal(ExportAction.make().getFileDisk(), null);
    class LinkedExporter extends GadgetExporter {
        static getFormats() { return ['csv' as const]; }
        static modifyCompletedNotification(notification: any) { return notification.actions([...notification.getActions(), { label: 'All gadgets', url: '/admin/gadgets' }]); }
    }
    const list = await page();
    const action = ExportAction.make('linked').exporter(LinkedExporter);
    const { pending } = await run(() => action.call({ livewire: list, record: null, arguments: {}, data: { columns: ['name'] } }));
    assert.deepEqual(pending[0].actions.map((item: any) => item.label), ['Download .csv', 'All gadgets']);
});
