import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { ColorManager, views } from '@navette-js/support';
import '@navette-js/support/ui';
import { t, tc } from '@navette-js/support/i18n';
import { Average, Group, Table, TextColumn, getTableGrouping, initializeTableGrouping, renderTable, useColorManager, type TableHost } from '../src/index.ts';

views.share({ t, tc, assetUrl: (file: string) => `/${file}` });
useColorManager(new ColorManager());

class Post extends Model { static tableName = 'posts'; }
let db: Knex;
const adapter = new ObjectionAdapter(Post);
const host = (over: Partial<TableHost> = {}): TableHost => ({ id: 'H', tableSearch: '', tableSort: null, tableColumnSearches: {}, tableRecordsPerPage: 5, paginators: { page: 1 }, tableGrouping: null, ...over });
const clean = (html: string) => html.replace(/>\s+</g, '><').replace(/\s+/g, ' ');
const records = (html: string) => { const start = html.indexOf('<tbody class="fi-ta-records"'); return html.slice(start, html.indexOf('</tbody>', start)); };
const columns = () => [TextColumn.make('title'), TextColumn.make('rating').summarize(Average.make()), TextColumn.make('status')];

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('posts', (t) => { t.increments('id'); t.string('title'); t.string('status'); t.float('rating'); });
    await db('posts').insert([
        { title: 'T1', status: 'draft', rating: 9.7 }, { title: 'T2', status: 'published', rating: 8 }, { title: 'T3', status: 'published', rating: 8.5 },
        { title: 'T4', status: 'reviewing', rating: 9.4 }, { title: 'T5', status: 'reviewing', rating: 7 }, { title: 'T6', status: 'reviewing', rating: 6 },
    ]);
});
after(() => db.destroy());

test('default grouping: forced outside the selector, preselected inside it; forged state is ignored', () => {
    const fixed = new Table().defaultGroup('status', 'desc');
    assert.deepEqual(getTableGrouping(fixed, host()), { group: fixed.getDefaultGroup(), direction: 'desc' });
    assert.equal(getTableGrouping(fixed, host({ tableGrouping: 'secret:asc' }))?.group.getId(), 'status');
    assert.equal(getTableGrouping(fixed, host({ isTableReordering: true })), null);

    const selectable = new Table().groups(['status', Group.make('rating')]).defaultGroup(Group.make('rating'));
    assert.equal(selectable.isDefaultGroupSelectable(), true);
    const h = host();
    assert.equal(getTableGrouping(selectable, h), null);
    initializeTableGrouping(selectable, h);
    assert.equal(h.tableGrouping, 'rating:asc');
    // The user removes the grouping: it is not forced again.
    h.tableGrouping = null;
    assert.equal(getTableGrouping(selectable, h), null);
    initializeTableGrouping(selectable, host({ tableGrouping: 'status:desc' }));
    assert.equal(getTableGrouping(selectable, host({ tableGrouping: 'status:desc' }))?.direction, 'desc');
});

test('render: group headers, summary of each group, and of the last one only when it is complete on the page', async () => {
    const table = new Table().pluralModelLabel('posts').columns(columns()).defaultGroup('status');
    const page1 = records(clean(await renderTable(table, host(), adapter)));
    assert.deepEqual([...page1.matchAll(/<h3 class="fi-ta-group-heading">([^<]+)<\/h3>/g)].map((m) => m[1]), ['Status: draft', 'Status: published', 'Status: reviewing']);
    assert.deepEqual([...page1.matchAll(/heading-cell ">([^<]+)<\/th>/g)].map((m) => m[1]), ['draft summary', 'published summary', 'This page', 'All posts']);
    assert.match(page1, /draft summary<\/th><td class="fi-ta-cell fi-align-start "><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Average<\/span><span>9\.7<\/span><\/div><\/td><td class="fi-ta-cell fi-align-start "><\/td><\/tr>/);
    // The "reviewing" group continues on page 2: its summary (over the whole group) only appears at its end.
    const page2 = records(clean(await renderTable(table, host({ paginators: { page: 2 } }), adapter)));
    assert.match(page2, /reviewing summary<\/th><td class="fi-ta-cell fi-align-start "><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Average<\/span><span>7\.467<\/span>/);
    // Single page: one striped "Summary" row, without a summary header.
    const single = records(clean(await renderTable(table, host({ tableRecordsPerPage: 10 }), adapter)));
    assert.ok(!single.includes('fi-ta-summary-header-row'));
    assert.match(single, /<tr class="fi-ta-row fi-ta-summary-row fi-striped"><th scope="row" class="fi-ta-cell fi-align-start fi-ta-summary-row-heading-cell ">Summary<\/th>/);
});

test('groups only: no rows or pagination, one summary row per group without the grouped column', async () => {
    const table = new Table().pluralModelLabel('posts').columns(columns()).defaultGroup('status').groupsOnly();
    const html = clean(await renderTable(table, host(), adapter));
    const body = records(html);
    assert.ok(!body.includes('fi-ta-group-header-row') && !body.includes('table.records.'));
    assert.ok(!html.includes('fi-pagination'));
    assert.equal(body, '<tbody class="fi-ta-records"><tr class="fi-ta-row fi-ta-summary-row"><th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">draft</th><td class="fi-ta-cell fi-align-start "></td><td class="fi-ta-cell fi-align-start "><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Average</span><span>9.7</span></div></td></tr>'
        + '<tr class="fi-ta-row fi-ta-summary-row"><th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">published</th><td class="fi-ta-cell fi-align-start "></td><td class="fi-ta-cell fi-align-start "><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Average</span><span>8.25</span></div></td></tr>'
        + '<tr class="fi-ta-row fi-ta-summary-row"><th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">reviewing</th><td class="fi-ta-cell fi-align-start "></td><td class="fi-ta-cell fi-align-start "><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Average</span><span>7.467</span></div></td></tr>'
        + '<tr class="fi-ta-row fi-ta-summary-row fi-striped"><th scope="row" class="fi-ta-cell fi-ta-summary-row-heading-cell fi-align-start">Summary</th><td class="fi-ta-cell fi-align-start "></td><td class="fi-ta-cell fi-align-start "><div class="fi-ta-text-summary"><span class="fi-ta-text-summary-label">Average</span><span>8.1</span></div></td></tr>');
});

test('grouping selector: hidden, without direction, in a dropdown on desktop; groups collapsed by default', async () => {
    const base = () => new Table().pluralModelLabel('posts').columns(columns()).groups(['status']);
    const plain = clean(await renderTable(base(), host(), adapter));
    assert.equal((plain.match(/x-model="direction"/g) ?? []).length, 2);
    assert.match(plain, /class="fi-dropdown sm:fi-hidden" wire:key="H\.table\.grouping"/);
    assert.match(plain, /areGroupsCollapsedByDefault: false,/);
    assert.ok(!clean(await renderTable(base().groupingSettingsHidden(), host(), adapter)).includes('fi-ta-grouping-settings'));
    assert.ok(!clean(await renderTable(base().groupingDirectionSettingHidden(), host(), adapter)).includes('x-model="direction"'));
    const dropdown = clean(await renderTable(base().groupingSettingsInDropdownOnDesktop(), host(), adapter));
    assert.match(dropdown, /class="fi-dropdown" wire:key="H\.table\.grouping"/);
    assert.equal((dropdown.match(/x-model="group"/g) ?? []).length, 1);
    const collapsed = clean(await renderTable(new Table().columns(columns()).defaultGroup(Group.make('status').collapsible()).collapsedGroupsByDefault(), host(), adapter));
    assert.match(collapsed, /areGroupsCollapsedByDefault: true,/);
    assert.match(collapsed, /x-on:click="toggleCollapseGroup\(&#39;draft&#39;\)"/);
    // Group without title or label: header hidden from assistive technologies.
    const silent = clean(await renderTable(new Table().columns(columns()).defaultGroup(Group.make('status').titlePrefixedWithLabel(false).getTitleFromRecordUsing((r: any) => (r.status === 'draft' ? 'Brouillons' : ''))), host(), adapter));
    assert.match(silent, /<tr aria-hidden="true" class="fi-ta-row fi-ta-group-header-row">/);
});

test('custom group key, scope and order', async () => {
    const group = Group.make('status')
        .getKeyFromRecordUsing((record: any) => (record.status === 'published' ? 'live' : 'not-live'))
        .getTitleFromRecordUsing((record: any) => (record.status === 'published' ? 'Live' : 'Not live'))
        .scopeQueryByKeyUsing((query, key) => (key === 'live' ? query.where('status', 'published') : query.whereNot('status', 'published')))
        .orderQueryUsing((query, direction) => query.orderByRaw(`case status when 'reviewing' then 0 when 'draft' then 1 else 2 end ${direction}`));
    const table = new Table().columns(columns()).groups([group]);
    const html = clean(await renderTable(table, host({ tableGrouping: 'status:asc', tableRecordsPerPage: 10 } as any), adapter));
    const titles = [...records(html).matchAll(/<div class="fi-ta-text fi-ta-text-item fi-size-sm">(T\d)<\/div>/g)].map((match) => match[1]);
    assert.deepEqual(titles, ['T4', 'T5', 'T6', 'T1', 'T2', 'T3'], 'custom order: reviewing, draft, published');
    assert.equal((html.match(/class="fi-ta-group-heading"/g) ?? []).length, 2, 'two groups: not live, live');
    assert.match(html, /Not live summary/);
});
