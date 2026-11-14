import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import express from 'express';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { fillSchema, getSchemaState, TextInput, validateSchema } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';
import { Notification, Stat, StatsOverviewWidget } from '../src/index.ts';
import { componentNameOf, Livewire, LivewireComponent, TableComponent } from '../src/livewire.ts';
import { livewire as test$, assertNotified } from '../src/testing.ts';

class Product extends Model { static tableName = 'lw_products'; declare id: number; declare name: string; declare price: number; }
let db: Knex;
const created: Record<string, unknown>[] = [];
const dir = mkdtempSync(path.join(tmpdir(), 'navette-livewire-'));
const view = (name: string, source: string) => { const file = path.join(dir, `${name}.ejs`); writeFileSync(file, source); return pathToFileURL(file); };

class ProductStats extends StatsOverviewWidget {
    static isLazy = false;
    async getStats(): Promise<Stat[]> { return [Stat.make('Products', 2)]; }
}
class CreatePost extends LivewireComponent {
    static callable = ['create'];
    static view = view('create-post', `<div>
    <form wire:submit="create">
        <%- await schema('form') %>
        <x-button type="submit">Submit</x-button>
    </form>
    <%- await schema('summary') %>
    <%- await action('reset') %>
    <%- await action('delete', { post: 7 }) %>
    <%- await livewire(ProductStats) %>
    <%- await modals() %>
</div>`);
    data: Record<string, unknown> = {};
    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    formSchema(schema: Schema): Schema { return schema.components([TextInput.make('title').required().maxLength(50)]); }
    summarySchema(schema: Schema): Schema { return schema.record({ status: 'Draft' }).components([TextEntry.make('status')]); }
    resetAction(): Action { return Action.make('reset').color('gray').action(({ livewire }) => { (livewire as any).data.title = ''; }); }
    deleteAction(): Action { return Action.make('delete').color('danger').requiresConfirmation().action(({ arguments: args }) => { Notification.make().title(`Deleted ${args.post}`).send(); }); }
    async create(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        created.push(await getSchemaState(form));
        Notification.make().success().title('Post created').send();
    }
    getViewData() { return { ProductStats }; }
}
class ListProducts extends TableComponent {
    table(table: Table): Table {
        return table.columns([TextColumn.make('name').searchable().sortable(), TextColumn.make('price').money('usd')])
            .recordActions([Action.make('discount').action(async ({ record }) => { await db('lw_products').where('id', (record as Product).id).update({ price: 1 }); Notification.make().title('Discounted').send(); })]);
    }
    getDataAdapterForTable() { return new ObjectionAdapter(Product); }
}
class Secret extends LivewireComponent { static canAccess(): boolean { return false; } }

const components = new Livewire({ key: 'a-test-key-of-at-least-thirty-two-characters' });
components.components([CreatePost, ListProducts, ProductStats, Secret]);
const app = express();
app.use(components.router());
app.get('/posts/create', components.page(CreatePost, { title: 'New post' }));
app.get('/products', components.page(ListProducts));
app.get('/secret', components.page(Secret));
app.get('/embedded', async (req, res) => {
    res.send(`<!DOCTYPE html><html><head>${components.styles(req, res)}</head><body><h1>Shop</h1>${await components.mount('list-products', {}, req, res)}${await components.notifications(req, res)}${components.scripts(req, res)}</body></html>`);
});
let server: ReturnType<typeof app.listen>;
const url = (p: string) => `http://127.0.0.1:${(server.address() as any).port}${p}`;
const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const snapshotOf = (html: string, name: string) => [...html.matchAll(/wire:snapshot="([^"]+)"/g)].map((match) => unescape(match[1])).find((value) => JSON.parse(value).memo.name === name)!;

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('lw_products', (table) => { table.increments('id'); table.string('name'); table.integer('price'); });
    await db('lw_products').insert([{ name: 'Lamp', price: 30 }, { name: 'Desk', price: 200 }]);
    server = app.listen(0);
});
after(() => { server.close(); return db.destroy(); });

test('component names follow Livewire: CreatePost → create-post', () => {
    assert.equal(componentNameOf(CreatePost), 'create-post');
    assert.equal(componentNameOf(class HTMLEditor {}), 'html-editor');
    assert.throws(() => new Livewire({ key: 'short' }), /32 characters/);
    assert.throws(() => components.component('navette.sidebar', CreatePost), /Invalid component name/);
});

test('a form, an infolist, actions and a widget in a component view, served as a page outside any panel', async () => {
    const response = await fetch(url('/posts/create'));
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<title>New post<\/title>/);
    assert.match(html, /wire:model="data\.title"/);
    assert.match(html, /Draft/);
    assert.match(html, /wire:click="mountAction\('reset'\)"/);
    assert.match(html, /mountAction\('delete', JSON\.parse\('\{.u0022post.u0022:7\}'\)/);
    assert.match(html, /wire:name="product-stats"/);
    assert.match(html, /wire:partial="action-modals"/);
    assert.match(html, /css\/filament\/filament\/app\.css/);
    assert.match(html, /\/_navette\/livewire\/livewire\.js/);
    assert.match(html, /x-data="notificationsComponent\(\)"/);

    // Browser updates: CSRF token, signed snapshot, `static callable`.
    const token = html.match(/<meta name="csrf-token" content="([^"]+)"/)![1];
    const cookies = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const snapshot = snapshotOf(html, 'create-post');
    const post = (body: unknown, cookie = cookies) => fetch(url('/_navette/livewire/update'), { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const invalid = await (await post({ _token: token, components: [{ snapshot, updates: {}, calls: [{ method: 'create', params: [] }] }] })).json();
    assert.ok(JSON.parse(invalid.components[0].snapshot).memo.errors['data.title']);
    const saved = await post({ _token: token, components: [{ snapshot, updates: { 'data.title': 'Hello' }, calls: [{ method: 'create', params: [] }] }] });
    assert.equal(saved.status, 200);
    assert.ok(saved.headers.get('x-filament-notifications'), 'the notification is announced to the browser');
    assert.deepEqual(created.at(-1), { title: 'Hello' });
    // Refused: no CSRF token, a forged snapshot, a method that is not callable.
    assert.equal((await post({ _token: 'nope', components: [{ snapshot, updates: {}, calls: [] }] })).status, 419);
    assert.equal((await post({ _token: token, components: [{ snapshot: snapshot.replace('"data":{', '"data":{"x":1,'), updates: {}, calls: [] }] })).status, 419);
    assert.equal((await post({ _token: token, components: [{ snapshot, updates: {}, calls: [{ method: 'mount', params: [] }] }] })).status, 404);
    // An action method mounts its modal; a framework method is not an action.
    const mounted = await (await post({ _token: token, components: [{ snapshot, updates: {}, calls: [{ method: 'mountAction', params: ['delete', { post: 7 }] }] }] })).json();
    assert.match(JSON.stringify(mounted.components[0].effects.partials), /fi-modal/);
    assert.equal((await post({ _token: token, components: [{ snapshot, updates: {}, calls: [{ method: 'mountAction', params: ['callMounted', {}] }] }] })).status, 404);
});

test('a table component: as a page and embedded in a page of the application', async () => {
    const html = await (await fetch(url('/products'))).text();
    assert.match(html, /fi-ta-table/);
    assert.match(html, /Lamp/);
    assert.match(html, /\$30\.00/);
    const embedded = await (await fetch(url('/embedded'))).text();
    assert.match(embedded, /<h1>Shop<\/h1>/);
    assert.match(embedded, /wire:name="list-products"/);
    assert.match(embedded, /Desk/);
});

test('access: static canAccess() is checked; an unknown component throws', async () => {
    assert.equal((await fetch(url('/secret'))).status, 403);
    await assert.rejects(() => components.mount('missing', {}, {} as any, {} as any), /not registered/);
});

test('the testing helpers work with components outside a panel', async () => {
    await test$(CreatePost, {}, { panel: components.panel, user: null })
        .assertOk()
        .assertSeeLivewire(ProductStats)
        .fillForm({ title: '' })
        .call('create')
        .assertHasFormErrors({ title: 'required' })
        .fillForm({ title: 'From a test' })
        .call('create')
        .assertHasNoFormErrors()
        .assertNotified('Post created')
        .callAction('delete', {}, { post: 3 })
        .assertNotified('Deleted 3');
    const [lamp] = (await db('lw_products').orderBy('id')).map((row: any) => row.id);
    await test$(ListProducts, {}, { panel: components.panel, user: null })
        .assertCanSeeTableRecords([lamp])
        .assertCanRenderTableColumn('name')
        .searchTable('Desk')
        .assertCanNotSeeTableRecords([lamp])
        .callTableAction('discount', lamp)
        .assertNotified('Discounted');
    assertNotified('Discounted');
});
