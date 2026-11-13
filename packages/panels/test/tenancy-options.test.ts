import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { Dashboard, Panel, panelRouter, type AuthProvider, type TenantProvider, type User } from '../src/index.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };
type Team = { id: number; name: string };
const teamsOf = (count: number): Team[] => Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `Team ${index + 1}` }));
const tenantsProvider = (teams: Team[], defaultTeam: number | null = null): TenantProvider<Team> => ({
    getTenants: () => teams,
    find: (key) => teams.find((team) => String(team.id) === key) ?? null,
    canAccess: () => true,
    getKey: (team) => String(team.id),
    getName: (team) => team.name,
    getDefaultTenant: () => teams.find((team) => team.id === defaultTeam) ?? null,
});
type Reply = { status: number; location: string | undefined; text: string };
const serve = async (panel: Panel, fn: (get: (path: string, host?: string) => Promise<Reply>) => Promise<void>) => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    let cookie = '';
    panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
    const port = (server.address() as any).port;
    // `fetch()` ignores the Host header: plain HTTP requests.
    const get = (path: string, host?: string) => new Promise<Reply>((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path, headers: { cookie, ...(host ? { host } : {}) } }, (res) => {
            let text = '';
            res.setEncoding('utf8').on('data', (chunk) => { text += chunk; }).on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, text }));
        }).on('error', reject);
    });
    try { await fn(get); } finally { server.close(); }
};

test('a tenant route prefix goes before the tenant key; the default tenant is where users land', async () => {
    const panel = Panel.make().id('prefixed').path('app').key('prefixed-key').authGuard('prefixed').auth(auth).pages([Dashboard])
        .tenant(tenantsProvider(teamsOf(3), 2)).tenantRoutePrefix('team');
    assert.equal(panel.getUrl('projects', { id: 3, name: 'Team 3' }), '/app/team/3/projects');
    assert.throws(() => Panel.make().tenantRoutePrefix('Bad prefix'), /Invalid tenant route prefix/);
    await serve(panel, async (get) => {
        assert.equal((await get('/app')).location, '/app/team/2', 'the default tenant');
        assert.equal((await get('/app/team/1')).status, 200);
        assert.equal((await get('/app/1')).status, 404, 'no tenant without its prefix');
    });
});

test('tenant domains: the host designates the tenant, links to other tenants go to their host', async () => {
    const panel = Panel.make().id('domains').path('app').key('domains-key').authGuard('domains').auth(auth).pages([Dashboard])
        .tenant(tenantsProvider(teamsOf(2))).tenantDomain('{tenant}.example.test:8080').sessionCookieDomain('.example.test');
    assert.equal(panel.getUrl('projects', { id: 2, name: 'Team 2' }), '//2.example.test:8080/app/projects');
    assert.equal(panel.withTenant({ id: 2, name: 'Team 2' }, () => panel.getUrl('projects')), '/app/projects', 'same tenant: a path');
    assert.equal(panel.getTenantKeyFromRequest('/app', '1.example.test'), '1');
    assert.equal(panel.getTenantKeyFromRequest('/app', 'evil.test'), null);
    assert.throws(() => Panel.make().tenantDomain('example.test'), /\{tenant\}/);
    let cookie = '';
    panel.logIn({ cookie: (_name: string, _value: string, options: any) => { cookie = options.domain; }, req: {} } as any, ada, false);
    assert.equal(cookie, '.example.test');
    await serve(panel, async (get) => {
        // A host outside the pattern (`www` would be a tenant key, as in Filament) leads to the user's first tenant.
        assert.equal((await get('/app', 'example.test')).location, '//1.example.test:8080/app');
        const page = await get('/app', '1.example.test');
        assert.equal(page.status, 200);
        assert.match(page.text, /href="\/\/2\.example\.test:8080\/app"/, 'switching tenant goes to the other host');
        assert.equal((await get('/app', '9.example.test')).status, 404);
    });
});

test('billing: the tenant menu links to the billing page; without a subscription, pages go there', async () => {
    const subscribed = new Set([2]);
    const panel = Panel.make().id('billing').path('app').key('billing-key').authGuard('billing').auth(auth).pages([Dashboard]).tenant(tenantsProvider(teamsOf(2)))
        .tenantBillingProvider({ handle: (_req, res, team: Team) => void res.send(`Billing of ${team.name}`), isSubscribed: (team: Team) => subscribed.has(team.id) })
        .requiresTenantSubscription();
    await serve(panel, async (get) => {
        assert.equal((await get('/app/1')).location, '/app/1/billing');
        assert.equal((await get('/app/1/billing')).text, 'Billing of Team 1');
        const page = await get('/app/2');
        assert.equal(page.status, 200);
        assert.match(page.text, /href="\/app\/2\/billing"[^>]*>[\s\S]*?Manage subscription/);
    });
    assert.throws(() => panelRouter(Panel.make().id('billing-invalid').tenant(tenantsProvider(teamsOf(1))).tenantBillingProvider({ handle: () => {} }).requiresTenantSubscription(), new WireRuntime({ key: 'k' })), /isSubscribed/);
});

test('the tenant menu has a search field from ten tenants, or when asked', async () => {
    const make = (id: string, count: number) => Panel.make().id(id).path(id).key(`${id}-key`).authGuard(id).auth(auth).pages([Dashboard]).tenant(tenantsProvider(teamsOf(count)));
    await serve(make('few', 3), async (get) => assert.doesNotMatch((await get('/few/1')).text, /x-model="search"/));
    await serve(make('many', 11), async (get) => {
        const html = (await get('/many/1')).text;
        assert.match(html, /x-model="search"/);
        assert.match(html, /filamentDropdown\(\{ isMenu: false \}\)" class="fi-dropdown fi-tenant-menu"/);
    });
    await serve(make('asked', 2).searchableTenantMenu(), async (get) => assert.match((await get('/asked/1')).text, /x-model="search"/));
});
