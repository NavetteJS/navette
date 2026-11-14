// Table hosts and table-level features: records per page and column manager in the session, the page in the
// URL under the table's page name, cursor pages, lazy loading and reordering through the list page.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { type Table, TextColumn, useColorManager as useTablesColors } from '@navette-js/tables';
import { useColorManager as useActionsColors } from '@navette-js/actions';
import { useColorManager as useFormsColors } from '@navette-js/forms';
import { ColorManager, views } from '@navette-js/support';
import { useColorManager as useUiColors } from '@navette-js/support/ui';
import { Panel, RelationManager, Resource, type User } from '../src/index.ts';

const colors = new ColorManager();
useActionsColors(colors); useFormsColors(colors); useUiColors(colors); useTablesColors(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

class Task extends Model { static tableName = 'tasks'; }
let db: Knex;
const admin: User = { id: 1, name: 'A', email: 'a@x.test' };
const calls: string[] = [];

class Tasks extends Resource {
    static slug = 'tasks';
    static adapter = new ObjectionAdapter(Task);
    static table(table: Table): Table {
        return table.columns([TextColumn.make('title').toggleable(), TextColumn.make('priority')]).reorderableColumns()
            .paginationPageOptions([2, 5]).enforcePaginationPageOptions()
            .reorderable('sort').afterReordering((order) => { calls.push(order.join(',')); });
    }
}
class LazyTasks extends Resource {
    static slug = 'lazy-tasks';
    static adapter = new ObjectionAdapter(Task);
    static table(table: Table): Table { return table.columns([TextColumn.make('title')]).lazyLoaded().identifier('lazy').persistColumnsInSession(false).persistRecordsPerPageInSession(false); }
}
class CommentsRelationManager extends RelationManager {
    static relationship = 'comments';
    static adapterFor(): any { return new ObjectionAdapter(Task); }
    static table(table: Table): Table { return table.columns([TextColumn.make('title')]); }
}
const panel = Panel.make().id('table-level-test').key('k').resources([Tasks, LazyTasks]);
const page = async (resource: typeof Resource, mailbox: string, query: Record<string, unknown> = {}) => {
    const ListPage = resource.getPages().index as any;
    const component = new ListPage();
    component._ctx = { panel, user: admin, mailbox, req: { query }, res: {} };
    await component.mount({});
    return component;
};

before(async () => {
    db = sqlite(':memory:');
    await db.schema.createTable('tasks', (table) => { table.increments('id'); table.string('title'); table.integer('sort'); table.integer('priority'); });
    await db('tasks').insert(Array.from({ length: 7 }, (_, index) => ({ title: `Task ${index + 1}`, sort: index + 1, priority: index % 3 })));
});
after(() => db.destroy());

test('records per page: enforced options, kept in the session', async () => {
    const list = await page(Tasks, 'browser-1');
    assert.equal(list.tableRecordsPerPage, 2);
    list.tableRecordsPerPage = 1000;
    list.updatedTableRecordsPerPage();
    assert.equal(list.tableRecordsPerPage, 2, 'an undeclared value becomes the default option');
    list.tableRecordsPerPage = 5;
    list.updatedTableRecordsPerPage();
    await list.dehydrate();
    assert.equal((await page(Tasks, 'browser-1')).tableRecordsPerPage, 5);
    assert.equal((await page(Tasks, 'browser-2')).tableRecordsPerPage, 2);
    // A tampered session value is ignored.
    await panel.getSessionStore().set('table-level-test:1:browser-3', list.tableSessionKey('per_page'), 999);
    assert.equal((await page(Tasks, 'browser-3')).tableRecordsPerPage, 2);
});

test('column manager: reordered columns kept in the session, sanitized, and the visible order follows them', async () => {
    const list = await page(Tasks, 'browser-4');
    list.applyTableColumnManager([{ type: 'column', name: 'priority', isToggled: true }, { type: 'column', name: 'title', isToggled: false }, { type: 'column', name: 'evil', isToggled: true }], true);
    assert.deepEqual(list.tableColumns.map((column: any) => [column.name, column.isToggled]), [['priority', true], ['title', false]]);
    await list.dehydrate();
    const again = await page(Tasks, 'browser-4');
    assert.deepEqual(again.tableColumns.map((column: any) => [column.name, column.isToggled]), [['priority', true], ['title', false]]);
    const html = await again.renderTable();
    assert.doesNotMatch(html, /nv-ta-header-cell-title/);
    again.applyTableColumnManager([{ type: 'column', name: 'priority', isToggled: true }, { type: 'column', name: 'title', isToggled: true }], true);
    assert.ok((await again.renderTable()).indexOf('nv-ta-header-cell-priority') < (await again.renderTable()).indexOf('nv-ta-header-cell-title'));
    again.resetTableColumnManager();
    assert.deepEqual(again.tableColumns.map((column: any) => column.name), ['title', 'priority']);
});

test('page in the URL: read on mount under the page name, tracked by a URL effect', async () => {
    const list = await page(Tasks, 'browser-5', { page: '3' });
    assert.equal(list.paginators.page, 3);
    assert.deepEqual(list._effects.url['paginators.page'], { as: 'page', use: 'push', alwaysShow: false, except: null });
    const forged = await page(Tasks, 'browser-5', { page: '-4' });
    assert.equal(forged.paginators.page, 1);
    // A relation manager prefixes its parameters with its class name.
    const manager = new CommentsRelationManager();
    assert.equal(manager.getTable().getPaginationPageName(), 'commentsRelationManagerPage');
});

test('lazy loading: no records until loadTable(); identifier() in the session keys', async () => {
    const list = await page(LazyTasks, 'browser-6');
    assert.equal(list.isTableLoaded, false);
    assert.match(await list.renderTable(), /wire:init="loadTable"/);
    list.loadTable();
    assert.match(await list.renderTable(), /Task 1/);
    assert.match(list.tableSessionKey('filters'), /:lazy:filters$/);
});

test('reordering through the page: setPage(), moveTableRecord() and afterReordering()', async () => {
    const list = await page(Tasks, 'browser-7');
    await list.toggleTableReordering();
    assert.equal(list.isTableReordering, true);
    await list.moveTableRecord('1', 'down');
    assert.deepEqual((await db('tasks').orderBy('sort').limit(2).select('id')).map((row) => row.id), [2, 1]);
    assert.equal(calls.at(-1)?.startsWith('2,1'), true);
    await list.reorderTable(['3', '2', '1']);
    assert.deepEqual((await db('tasks').orderBy('sort').limit(3).select('id')).map((row) => row.id), [3, 2, 1]);
    list.setPage('2');
    assert.equal(list.paginators.page, 2);
    list.setPage({ evil: true });
    assert.equal(list.paginators.page, 1);
});
