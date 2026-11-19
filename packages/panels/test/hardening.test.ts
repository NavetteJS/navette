import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { Dashboard, Panel, panelRouter, type AuthProvider } from '../src/index.ts';

const auth: AuthProvider = { attempt: async () => null, find: async () => null };

const request = async (panel: Panel, path = '/hardening/login') => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try { return await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, { redirect: 'manual' }); } finally { server.close(); }
};

test('panel responses refuse framing and sniffing, unless framing is allowed', async () => {
    const make = () => Panel.make().id('hardening').path('hardening').key('hardening-secret-key').authGuard('hardening').auth(auth).login().pages([Dashboard]);
    const strict = await request(make());
    assert.equal(strict.headers.get('x-frame-options'), 'DENY');
    assert.equal(strict.headers.get('x-content-type-options'), 'nosniff');
    const framed = await request(make().allowFraming());
    assert.equal(framed.headers.get('x-frame-options'), null);
});

test('in production, a panel on the development key or a short one refuses to boot', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        let count = 0;
        const make = () => Panel.make().id(`prod${++count}`).path(`prod${count}`).authGuard(`prod${count}`).auth(auth).pages([Dashboard]);
        assert.throws(() => panelRouter(make(), new WireRuntime({ key: 'k' })), /secret key/);
        assert.throws(() => panelRouter(make().key('short'), new WireRuntime({ key: 'k' })), /secret key/);
        assert.doesNotThrow(() => panelRouter(make().key('a-secret-of-sufficient-length'), new WireRuntime({ key: 'k' })));
    } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('a component update mixing snapshots of two tenants is refused', async () => {
    const teams = [{ id: 1, name: 'Red' }, { id: 2, name: 'Blue' }];
    const ada = { id: 1, name: 'Ada', email: 'ada@example.com' };
    const panel = Panel.make().id('mixed').path('app').key('mixed-secret-key-0123').authGuard('mixed').auth({ attempt: async () => null, find: async () => ada }).pages([Dashboard])
        .tenant({ getTenants: () => teams, find: (key: string) => teams.find((team) => String(team.id) === key) ?? null, canAccess: () => true, getKey: (team: any) => String(team.id), getName: (team: any) => team.name } as any);
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    let cookie = '';
    panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
    const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    try {
        const pages = await Promise.all(['/app/1', '/app/2'].map((path) => fetch(base + path, { headers: { cookie } })));
        const [first, second] = await Promise.all(pages.map((page) => page.text()));
        const pick = (html: string) => unescape([...html.matchAll(/wire:snapshot="([^"]+)"/g)][0][1]);
        const token = first.match(/<meta name="csrf-token" content="([^"]+)"/)![1];
        const jar = [cookie, ...pages[0].headers.getSetCookie().map((value) => value.split(';')[0])].join('; ');
        const post = (snapshots: string[]) => fetch(`${base}/app/livewire/update`, { method: 'POST', headers: { cookie: jar, 'content-type': 'application/json' }, body: JSON.stringify({ _token: token, components: snapshots.map((snapshot) => ({ snapshot, updates: {}, calls: [] })) }) });
        assert.equal((await post([pick(first), pick(second)])).status, 403);
        assert.equal((await post([pick(first)])).status, 200);
    } finally { server.close(); }
});
