import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import { BulkActionGroup, Count, Group, IconColumn, Sum, Table, TextColumn, renderTable, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

class Task extends Model { static tableName = 'tasks'; }
let db: Knex;
const adapter = new ObjectionAdapter(Task);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 10, paginators: { page: 1 }, tableGrouping: null, ...over });
const clean = (html: string) => html.replace(/>\s+</g, '><').replace(/\s+/g, ' ');
/** SQL statements run by `fn`. */
async function queries(fn: () => Promise<unknown>): Promise<string[]> {
    const seen: string[] = [];
    const listener = (query: { sql: string }) => { seen.push(query.sql); };
    db.on('query', listener);
    try { await fn(); } finally { db.removeListener('query', listener); }
    return seen;
}

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('tasks', (t) => { t.increments('id'); t.string('title'); t.string('status'); t.boolean('is_done'); t.integer('hours'); });
    await db('tasks').insert([
        { title: 'A', status: 'draft', is_done: 1, hours: 1 }, { title: 'B', status: 'draft', is_done: 0, hours: 2 }, { title: 'C', status: 'published', is_done: 1, hours: 3 },
        { title: 'D', status: 'published', is_done: 1, hours: 4 }, { title: 'E', status: 'archived', is_done: 0, hours: 5 }, { title: 'F', status: 'archived', is_done: null, hours: 6 },
    ]);
});
after(() => db.destroy());

test('Count.icons(): occurrences of each icon of an icon column, by color, without a default label', async () => {
    const table = new Table().pluralModelLabel('tasks').columns([TextColumn.make('title'), IconColumn.make('is_done').boolean().summarize(Count.make().icons())]);
    const html = clean(await renderTable(table, host(), adapter));
    const summary = html.slice(html.indexOf('fi-ta-summary-row'));
    // 3 done (success check), 2 not done (danger x); the null state has no icon. No label: Filament's default for icon counts.
    assert.match(summary, /<div class="fi-ta-icon-count-summary"><ul><li>/);
    assert.match(summary, /<li><span>3<\/span><svg[^>]*class="[^"]*fi-color fi-color-success[^"]*"/);
    assert.match(summary, /<li><span>2<\/span><svg[^>]*class="[^"]*fi-color fi-color-danger[^"]*"/);
    assert.ok(!summary.includes('fi-ta-icon-count-summary-label'));
    assert.equal([...summary.matchAll(/<li>/g)].length, 2);
    // One grouped count query for all the records, instead of loading them.
    const sql = await queries(() => renderTable(table, host(), adapter));
    assert.ok(sql.some((statement) => /group by `is_done`/.test(statement)), sql.join('\n'));
});

test('Count.icons(): custom icons and colors, a label, the page and the group rows', async () => {
    const column = IconColumn.make('status')
        .icon((_record, state) => (state === 'published' ? 'o-check-circle' : state === 'draft' ? 'o-pencil' : 'o-archive-box'))
        .color((_record, state) => (state === 'published' ? 'success' : state === 'draft' ? 'warning' : 'gray'))
        .summarize(Count.make().icons().label('Statuses'));
    const table = new Table().pluralModelLabel('tasks').columns([TextColumn.make('title'), column]).defaultGroup('status');
    const html = clean(await renderTable(table, host({ tableRecordsPerPage: 5 }), adapter));
    assert.match(html, /<div class="fi-ta-icon-count-summary"><span class="fi-ta-icon-count-summary-label">Statuses<\/span><ul>/);
    // The archived (gray) icon gets no color class, like Filament's default gray.
    const archived = html.match(/archived summary<\/th>.*?<\/tr>/)?.[0] ?? '';
    assert.match(archived, /<li><span>2<\/span><svg[^>]*class="fi-icon fi-size-lg"/);
    // "This page" (5 records: 2 archived, 2 draft, 1 published) and "All tasks" (2 of each).
    const pageRow = html.match(/This page<\/th>.*?<\/tr>/)?.[0] ?? '';
    assert.deepEqual([...pageRow.matchAll(/<span>(\d+)<\/span>/g)].map((m) => m[1]), ['2', '2', '1']);
    const allRow = html.match(/All tasks<\/th>.*?<\/tr>/)?.[0] ?? '';
    assert.deepEqual([...allRow.matchAll(/<span>(\d+)<\/span>/g)].map((m) => m[1]), ['2', '2', '2']);
});

test('Count.icons(): a computed state is counted from the records; on another column it is an error', async () => {
    const computed = IconColumn.make('late').getStateUsing(({ record }) => (record as any).hours > 3).boolean().summarize(Count.make().icons());
    const html = clean(await renderTable(new Table().columns([TextColumn.make('title'), computed]), host(), adapter));
    assert.deepEqual([...html.slice(html.indexOf('fi-ta-icon-count-summary')).matchAll(/<li><span>(\d+)<\/span>/g)].map((m) => m[1]), ['3', '3']);
    const wrong = new Table().columns([TextColumn.make('title'), TextColumn.make('status').summarize(Count.make().icons())]);
    await assert.rejects(() => renderTable(wrong, host(), adapter), /The \[status\] column must be an IconColumn to show an icon count summary\./);
});

test('group summaries: one grouped aggregate query by default, or the one of groupQueryUsing()', async () => {
    const hours = () => TextColumn.make('hours').summarize(Sum.make());
    const byStatus = new Table().pluralModelLabel('tasks').columns([TextColumn.make('title'), hours()]).defaultGroup('status').groupsOnly();
    let html = '';
    const sql = await queries(async () => { html = clean(await renderTable(byStatus, host(), adapter)); });
    assert.deepEqual([...html.matchAll(/fi-ta-summary-row-heading-cell fi-align-start">([^<]+)<\/th>(?:<td[^>]*><\/td>)*<td[^>]*><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Sum<\/span><span>([^<]+)</g)].map((m) => `${m[1]}=${m[2]}`), ['archived=11', 'draft=3', 'published=7', 'Summary=21']);
    assert.equal(sql.filter((statement) => /sum\(/.test(statement) && /group by/.test(statement)).length, 1, sql.join('\n'));
    assert.equal(sql.filter((statement) => /sum\(/.test(statement)).length, 2, 'the groups, then the whole table');

    // A custom key: the summary query must be grouped the same way.
    const custom = Group.make('status')
        .getKeyFromRecordUsing((record: any) => (record.status === 'published' ? 'live' : 'hidden'))
        .getTitleFromRecordUsing((record: any) => (record.status === 'published' ? 'Live' : 'Hidden'))
        .scopeQueryByKeyUsing((query, key) => (key === 'live' ? query.where('status', 'published') : query.whereNot('status', 'published')))
        .orderQueryUsing((query, direction) => query.orderByRaw(`case when status = 'published' then 1 else 0 end ${direction}`))
        .groupQueryUsing((query) => query.groupByRaw("case when status = 'published' then 'live' else 'hidden' end"));
    const grouped = new Table().pluralModelLabel('tasks').columns([TextColumn.make('title'), hours()]).defaultGroup(custom).groupsOnly();
    const customSql = await queries(async () => { html = clean(await renderTable(grouped, host(), adapter)); });
    assert.deepEqual([...html.matchAll(/fi-ta-summary-row-heading-cell fi-align-start">([^<]+)<\/th>(?:<td[^>]*><\/td>)*<td[^>]*><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Sum<\/span><span>([^<]+)</g)].map((m) => `${m[1]}=${m[2]}`), ['Hidden=14', 'Live=7', 'Summary=21']);
    assert.equal(customSql.filter((statement) => /sum\(/.test(statement)).length, 2, customSql.join('\n'));

    // Without groupQueryUsing(), a custom key is aggregated group by group (same values).
    const scoped = new Table().pluralModelLabel('tasks').columns([TextColumn.make('title'), hours()]).defaultGroup(Group.make('status')
        .getKeyFromRecordUsing((record: any) => (record.status === 'published' ? 'live' : 'hidden'))
        .getTitleFromRecordUsing((record: any) => (record.status === 'published' ? 'Live' : 'Hidden'))
        .scopeQueryByKeyUsing((query, key) => (key === 'live' ? query.where('status', 'published') : query.whereNot('status', 'published')))
        .orderQueryUsing((query, direction) => query.orderByRaw(`case when status = 'published' then 1 else 0 end ${direction}`))).groupsOnly();
    const scopedSql = await queries(async () => { html = clean(await renderTable(scoped, host(), adapter)); });
    assert.deepEqual([...html.matchAll(/<span>(\d+)<\/span>/g)].map((m) => m[1]), ['14', '7', '21']);
    assert.equal(scopedSql.filter((statement) => /sum\(/.test(statement)).length, 3);
});

test('aggregateGroups(): the first grouping expression is the key, plain or raw', async () => {
    const rows = await adapter.aggregateGroups({}, { sum: ['hours'] }, (query) => { query.groupBy('status'); });
    assert.deepEqual(rows.map((row) => [row.key, row.count, row.sum.hours]), [['archived', 2, 11], ['draft', 2, 3], ['published', 2, 7]]);
    const raw = await adapter.aggregateGroups({ modifiers: [(query) => { query.where('hours', '>', 1); }] }, {}, (query) => { query.groupByRaw('hours % ?', [2]); });
    assert.deepEqual(raw.map((row) => [row.key, row.count]), [[0, 3], [1, 2]]);
    await assert.rejects(() => adapter.aggregateGroups({}, {}, () => {}), /must group the records/);
});

test('groupRecordsTriggerAction(): the grouping settings trigger becomes a labeled button', async () => {
    const plain = clean(await renderTable(new Table().columns([TextColumn.make('title')]).groups(['status']), host(), adapter));
    assert.match(plain, /<button title="Group" aria-label="Group" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-force-enabled fi-ac-icon-btn-action fi-icon-btn fi-size-md">/);
    const table = new Table().columns([TextColumn.make('title')]).groups(['status']).groupRecordsTriggerAction((action) => action.button().label('Group records').icon('o-squares-2x2'));
    const html = clean(await renderTable(table, host(), adapter));
    const trigger = html.match(/<div x-on:mousedown="if \(\$event\.button === 0\) toggle\(\$event\)" class="fi-dropdown-trigger">(.*?)<\/div>/)?.[1] ?? '';
    assert.match(trigger, /^<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-force-enabled fi-ac-btn-action fi-btn fi-size-md"><svg[^>]*>.*<\/svg>Group records<\/button>$/);
    assert.equal(new Table().groupRecordsTriggerAction((action) => action.iconButton().color('primary')).getGroupRecordsTriggerActionView().color, 'primary');
});

test('several BulkActionGroups: one menu each, with its own label, icon and color', async () => {
    const first = { name: 'a' }, second = { name: 'b' }, third = { name: 'c' };
    const table = new Table().columns([TextColumn.make('title')]).toolbarActions([
        BulkActionGroup.make([first, second]),
        BulkActionGroup.make([third]).label('Status').icon('o-flag').color('danger').dropdownPlacement('bottom-end').tooltip('Change the status'),
    ]);
    assert.deepEqual(table.getBulkActions(), [first, second, third]);
    const groups = table.getBulkActionGroups()!;
    assert.equal(groups.length, 2);
    assert.equal(groups[1].getLabel(), 'Status');
    assert.equal(groups[0].getLabel(), 'Bulk actions');
    // groupedBulkActions() comes first, as the default menu.
    assert.deepEqual(new Table().groupedBulkActions([first]).toolbarActions([BulkActionGroup.make([third])]).getBulkActionGroups()!.map((group) => group.getActions()), [[first], [third]]);
    assert.equal(new Table().getBulkActionGroups(), null);

    const html = clean(await renderTable(table, host(), adapter, { bulkActionGroups: [groups[0].toMenu(['<button>A</button>', '<button>B</button>']), groups[1].toMenu(['<button>C</button>']), BulkActionGroup.make([]).label('Empty').toMenu([])] }));
    const menus = [...html.matchAll(/<div x-data="filamentDropdown" x-cloak="x-cloak" x-show="getSelectedRecordsCount\(\)" class="fi-dropdown">(.*?)<\/div><\/div><\/div>/g)].map((m) => m[1]);
    assert.equal(menus.length, 2, 'a menu without visible actions is left out');
    assert.match(menus[0], /<button title="Bulk actions" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-btn-group fi-icon-btn fi-size-md">/);
    assert.match(menus[0], /x-float.placement.bottom-start.flip/);
    assert.match(menus[0], /<button>A<\/button><button>B<\/button>/);
    assert.match(menus[1], /<button title="Status" x-tooltip="\{ content: &#39;Change the status&#39;|<button title="Status" x-tooltip="/);
    assert.match(menus[1], /class="fi-ac-btn-group fi-btn fi-size-md fi-labeled-from-sm fi-color fi-color-danger[^"]*"><svg[^>]*>.*?<\/svg> ?Status ?<\/button>/);
    assert.match(menus[1], /x-float.placement.bottom-end.flip/);
    assert.match(menus[1], /<button>C<\/button>/);
    // The rows get selection checkboxes.
    assert.match(html, /fi-ta-record-checkbox/);
    // The single-menu option still works as before.
    const single = clean(await renderTable(new Table().columns([TextColumn.make('title')]), host(), adapter, { bulkActions: ['<button>X</button>'] }));
    assert.match(single, /<button title="Bulk actions" type="button"[^>]*class="fi-ac-btn-group fi-icon-btn fi-size-md"><svg[^>]*>.*?<\/svg><\/button><button type="button"[^>]*class="fi-ac-btn-group fi-btn fi-size-md fi-labeled-from-sm"><svg[^>]*>.*?<\/svg> ?Bulk actions ?<\/button>/);
});
