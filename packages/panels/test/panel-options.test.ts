import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import http from 'node:http';
import express from 'express';
import { Component, WireRuntime } from '@navette-js/wire';
import { ColorManager } from '@navette-js/support';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { TextInput, useColorManager as useFormsColorManager } from '@navette-js/forms';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { CreateRecord, Dashboard, EditRecord, Panel, Resource, panelRouter, type AuthProvider, type DataAdapter, type User } from '../src/index.ts';
import { runInRequest } from '../src/notifications.ts';

const colors = new ColorManager();
useActionsColorManager(colors); useFormsColorManager(colors); useSchemasColorManager(colors); useUiColorManager(colors);

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };
type Reply = { status: number; text: () => Promise<string> };
// `fetch()` ignores the Host header: plain HTTP requests instead.
const request = (port: number, path: string, headers: Record<string, string>): Promise<Reply> => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
        let body = '';
        res.setEncoding('utf8').on('data', (chunk) => { body += chunk; }).on('end', () => resolve({ status: res.statusCode ?? 0, text: async () => body }));
    }).on('error', reject);
});
const serve = async (panel: Panel, fn: (get: (path: string, host?: string) => Promise<Reply>, cookie: string) => Promise<void>) => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    app.use((_req, res) => void res.status(404).send('Application'));
    const server = app.listen(0);
    try {
        const port = (server.address() as any).port;
        let cookie = '';
        panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
        await fn((path, host) => request(port, path, { cookie, ...(host ? { host } : {}) }), cookie);
    } finally { server.close(); }
};

test('a panel on its own domain leaves the other hosts to the next routes; boot hooks run on its requests', async () => {
    const booted: string[] = [];
    const panel = Panel.make().id('domain').path('admin').key('domain-key').authGuard('domain').auth(auth).pages([Dashboard]).domain('admin.example.test')
        .bootUsing((_panel, req) => { booted.push(req.path); });
    await serve(panel, async (get) => {
        assert.equal(await (await get('/admin', 'www.example.test')).text(), 'Application');
        assert.equal(booted.length, 0);
        assert.equal((await get('/admin', 'admin.example.test')).status, 200);
        assert.deepEqual(booted, ['/admin']);
        await get('/elsewhere', 'admin.example.test');
        assert.deepEqual(booted, ['/admin'], 'only the panel\'s own paths');
    });
});

test('SPA prefetching turns the panel links into hover-prefetched links', async () => {
    const panel = Panel.make().id('prefetch').path('prefetch').key('prefetch-key').authGuard('prefetch').auth(auth).pages([Dashboard]).spa(true, { prefetch: true });
    assert.equal(panel.hasSpaPrefetching(), true);
    await serve(panel, async (get) => {
        const html = await (await get('/prefetch')).text();
        assert.match(html, / wire:navigate\.hover[\s>]/);
        assert.doesNotMatch(html, / wire:navigate[\s>]/);
    });
    assert.equal(Panel.make().spa(false, { prefetch: true }).hasSpaPrefetching(), false);
});

test('strict authorization: an ability without a policy rule throws instead of being allowed', async () => {
    class Notes extends Resource { static slug = 'notes'; static policy = { viewAny: () => true }; }
    const panel = Panel.make().id('strict').resources([Notes]);
    assert.equal(await Notes.can('delete', ada), true, 'allowed by default');
    panel.strictAuthorization();
    assert.equal(await Notes.can('viewAny', ada), true);
    await assert.rejects(Notes.can('delete', ada), /Strict authorization mode is enabled, but Notes has no "delete" rule/);
    // The panel's authorization hook may still decide.
    panel.authorizeUsing(({ ability }) => (ability === 'delete' ? false : null));
    assert.equal(await Notes.can('delete', ada), false);
});

test('database transactions wrap the creation, from beforeCreate() to afterCreate(); the saved data hash follows the form', async () => {
    const log: string[] = [];
    const rows: Record<string, unknown>[] = [];
    const adapter = {
        getKey: (record: any) => String(record.id),
        create: async (data: Record<string, unknown>) => { log.push('create'); const record = { id: rows.length + 1, ...data }; rows.push(record); return record; },
        transaction: async (fn: () => Promise<unknown>) => { log.push('begin'); try { const result = await fn(); log.push('commit'); return result; } catch (error) { log.push('rollback'); throw error; } },
    } as unknown as DataAdapter;
    class CreateNote extends CreateRecord {
        protected afterCreate(record: any): void { log.push('afterCreate'); if (record.title === 'boom') throw new Error('boom'); }
        protected getRedirectUrl(): string { return '/notes'; }
    }
    class Notes extends Resource {
        static slug = 'notes'; static adapter = adapter; static pages = { create: CreateNote };
        static form(schema: Schema): Schema { return schema.components([TextInput.make('title').required()]); }
    }
    const panel = Panel.make().id('transactions').resources([Notes]).databaseTransactions().unsavedChangesAlerts();
    const page = new (Notes.getPages() as any).create() as any;
    page._id = 'create';
    page._ctx = { panel, user: ada, req: { headers: {}, get: () => undefined }, res: {} };
    page._errors = {};
    await page.mount({});
    const hash = (data: unknown) => createHash('md5').update(JSON.stringify(data).replace(/\\/g, '')).digest('hex');
    assert.equal(page.savedDataHash, hash(page.data));
    page.data = { title: 'Hello / "world"' };
    await runInRequest('t', () => page.create());
    assert.deepEqual(log, ['begin', 'create', 'afterCreate', 'commit']);
    assert.equal(page.savedDataHash, hash(page.data), 'remembered after creation');
    log.length = 0;
    page.data = { title: 'boom' };
    await assert.rejects(runInRequest('t', () => page.create()), /boom/);
    assert.deepEqual(log, ['begin', 'create', 'afterCreate', 'rollback']);
    // Opting out on the page.
    log.length = 0;
    (CreateNote as any).hasDatabaseTransactions = false;
    page.data = { title: 'Plain' };
    await runInRequest('t', () => page.create());
    assert.deepEqual(log, ['create', 'afterCreate']);
    // The alert's script is sent with the page.
    page._effects = {};
    await page.render();
    assert.match(page._effects.scripts['unsaved-data-changes-alert'], /^<script>setUpNavetteUnsavedDataChangesAlert\(\{ \$wire \}\)<\/script>$/);
});

test('locked properties of parent classes stay locked in subclasses; scripts are sent until the browser has run them', async () => {
    class Base extends Component { static locked = ['owner']; owner = 'ada'; note = ''; async render() { this.addScript('hello', 'console.log($wire.note)'); return '<div></div>'; } }
    class Child extends Base { static locked = ['other']; other = ''; static callable = ['touch']; touch() {} }
    const runtime = new WireRuntime({ key: 'k' });
    runtime.register('child', Child);
    const html = await runtime.mount('child');
    const snapshot = JSON.parse(html.match(/wire:snapshot="([^"]+)"/)![1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    const effects = JSON.parse(html.match(/wire:effects="([^"]+)"/)![1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    assert.deepEqual(effects.scripts, { hello: '<script>console.log($wire.note)</script>' });
    assert.deepEqual(snapshot.memo.scripts, ['hello']);
    await assert.rejects(runtime.update(snapshot, { owner: 'mallory' }, [], null), /Locked property: owner/);
    const { effects: next } = await runtime.update(snapshot, { note: 'x' }, [{ method: 'touch', params: [] }], null);
    assert.equal(next.scripts, undefined, 'already run');
});
