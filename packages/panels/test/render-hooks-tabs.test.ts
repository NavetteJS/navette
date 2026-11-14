// The render hooks of the list tabs, the resource (relation manager) tabs and the related records pages.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { renderHooks } from '@navette-js/support';
import { TextColumn, type Table } from '@navette-js/tables';
import { EditRecord, ManageRelatedRecords, Panel, PanelsRenderHook, ParentResourceRegistration, RelationManager, Resource, Tab, UNPLACED_RENDER_HOOKS, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel } from '../src/testing.ts';

class Album extends Model { static tableName = 'albums'; declare id: number; declare title: string; }
class Track extends Model { static tableName = 'tracks'; declare id: number; declare album_id: number; declare name: string; }
class Credit extends Model { static tableName = 'credits'; declare id: number; declare track_id: number; declare person: string; }

class TracksRelationManager extends RelationManager { static relatedResource = () => TrackResource; }
class AlbumResource extends Resource {
    static slug = 'albums';
    static modelLabel = 'album';
    static recordTitleAttribute = 'title';
    static adapter = new ObjectionAdapter(Album);
    static relations = [TracksRelationManager];
    static pages = { edit: class EditAlbum extends EditRecord { hasCombinedRelationManagerTabsWithContent(): boolean { return true; } } };
    static tabs(): Record<string, Tab> { return { '': Tab.make('All'), recent: Tab.make('Recent').query((query) => { query.where('id', '>', 1); }) }; }
    static form(schema: Schema): Schema { return schema.components([TextInput.make('title')]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('title')]); }
}
class TrackCredits extends ManageRelatedRecords { static relatedResource = () => CreditResource; }
class TrackResource extends Resource {
    static slug = 'tracks';
    static modelLabel = 'track';
    static recordTitleAttribute = 'name';
    static parentResource = AlbumResource;
    static adapter = new ObjectionAdapter(Track);
    static relatedPages = { credits: TrackCredits };
    static form(schema: Schema): Schema { return schema.components([TextInput.make('name')]); }
    static table(table: Table): Table { return table.columns([TextColumn.make('name')]); }
}
class CreditResource extends Resource {
    static slug = 'credits';
    static modelLabel = 'credit';
    static adapter = new ObjectionAdapter(Credit);
    static getParentResourceRegistration(): ParentResourceRegistration { return TrackResource.asParent().relationship('credits').inverseRelationship('track'); }
    static table(table: Table): Table { return table.columns([TextColumn.make('person')]); }
}

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('render-hooks-tabs').key('render-hooks-tabs-key').auth({ find: async () => ada } as any).resources([CreditResource, TrackResource, AlbumResource]);
let db: Knex;
const hooks = [PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABS_START, PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABS_END, PanelsRenderHook.RESOURCE_TABS_START, PanelsRenderHook.RESOURCE_TABS_END, PanelsRenderHook.RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE, PanelsRenderHook.RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_AFTER];

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('albums', (table) => { table.increments('id'); table.string('title'); });
    await db.schema.createTable('tracks', (table) => { table.increments('id'); table.integer('album_id'); table.string('name'); });
    await db.schema.createTable('credits', (table) => { table.increments('id'); table.integer('track_id'); table.string('person'); });
    await db('albums').insert([{ id: 1, title: 'Blue' }, { id: 2, title: 'Red' }]);
    await db('tracks').insert({ id: 1, album_id: 1, name: 'Intro' });
    await db('credits').insert({ track_id: 1, person: 'Grace' });
    for (const name of hooks) renderHooks.register(name, () => `<i data-hook="${name}"></i>`, AlbumResource);
    for (const name of hooks) renderHooks.register(name, () => `<i data-track-hook="${name}"></i>`, TrackResource);
    setCurrentPanel(panel);
    actingAs(ada);
});
after(async () => { renderHooks.clear(); await db.destroy(); });

test('every declared render hook location is rendered', () => {
    assert.deepEqual(UNPLACED_RENDER_HOOKS, {});
});

test('list tabs: hooks at the start and the end of the tabs, scoped to the resource', async () => {
    const list = livewire((AlbumResource.getPages() as any).index).assertOk();
    await list;
    const html = list.html();
    const tablist = html.slice(html.indexOf('class="fi-sc-tabs-tablist"'));
    assert.ok(tablist.indexOf(`data-hook="${PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABS_START}"`) < tablist.indexOf('fi-tabs-item'));
    assert.ok(tablist.indexOf(`data-hook="${PanelsRenderHook.RESOURCE_PAGES_LIST_RECORDS_TABS_END}"`) > tablist.lastIndexOf('fi-tabs-item-label'));
});

test('resource tabs (relation managers) and the related records page', async () => {
    const editPage = livewire((AlbumResource.getPages() as any).edit, { record: 1 }).assertOk();
    await editPage;
    const edit = editPage.html();
    assert.match(edit, new RegExp(`data-hook="${PanelsRenderHook.RESOURCE_TABS_START}"[\\s\\S]*fi-tabs-item[\\s\\S]*data-hook="${PanelsRenderHook.RESOURCE_TABS_END}"`));
    const creditsPage = livewire((TrackResource.getPages() as any).credits, { album: 1, record: 1 }).assertOk().assertSee('Grace');
    await creditsPage;
    const credits = creditsPage.html();
    const before = credits.indexOf(`data-track-hook="${PanelsRenderHook.RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE}"`);
    const afterTable = credits.indexOf(`data-track-hook="${PanelsRenderHook.RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_AFTER}"`);
    assert.ok(before >= 0 && afterTable > before, 'around the table');
});
