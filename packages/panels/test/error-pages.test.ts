import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { setLocale } from '@navette-js/support/i18n';
import { Dashboard, Page, Panel, panelNotFound, panelRouter, renderErrorPage, type AuthProvider, type User } from '../src/index.ts';
import { errorIllustration, errorPageScene } from '../src/error-pages.ts';

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };

class Broken extends Page {
    static slug = 'broken';
    async mount(): Promise<void> { throw new Error('Database unreachable'); }
}
class Secret extends Page {
    static slug = 'secret';
    static canAccess(): boolean { return false; }
}

const serve = async (panel: Panel, fn: (get: (path: string, accept?: string) => Promise<Response>) => Promise<void>, mount: (app: express.Express) => void = () => {}) => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    mount(app);
    const server = app.listen(0);
    let cookie = '';
    panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
    try {
        await fn((path, accept = 'text/html') => fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, { headers: { cookie, accept }, redirect: 'manual' }));
    } finally { server.close(); }
};

test('every status has an illustrated scene, the cable car with the code painted on it', () => {
    assert.equal(errorPageScene(404), 404);
    assert.equal(errorPageScene(410), 404, 'other client errors: lost');
    assert.equal(errorPageScene(502), 500, 'other server errors: snapped cable');
    for (const status of [401, 403, 404, 419, 500, 503]) assert.match(errorIllustration(status, 'Error'), new RegExp(`class="fi-error-cabin-code">${status}<`));
    assert.match(errorIllustration(429, 'Error'), />4<[\s\S]*>2<[\s\S]*>9</, 'one cabin per digit');
    assert.match(errorIllustration(404, 'Error <404>'), /aria-label="Error &#60;404&#62;"/);
});

test('the panel answers its errors with its error pages: unknown URLs, forbidden pages, failures', async () => {
    const panel = Panel.make().id('errors').path('admin').key('errors-key').authGuard('errors').auth(auth).brandName('Navette Demo').pages([Dashboard, Broken, Secret]);
    const logged = console.error;
    console.error = () => {};
    try {
        await serve(panel, async (get) => {
            const missing = await get('/admin/nowhere');
            assert.equal(missing.status, 404);
            const html = await missing.text();
            assert.match(html, /<title>\s*Lost in the clouds\s*-\s*Navette Demo\s*<\/title>/);
            assert.match(html, /class="fi-error-cabin-code">404</);
            assert.match(html, /<a href="\/admin"[^>]*fi-btn/, 'back to the panel');

            const forbidden = await get('/admin/secret');
            assert.equal(forbidden.status, 403);
            assert.match(await forbidden.text(), /This line is closed to you/);

            const broken = await get('/admin/broken');
            assert.equal(broken.status, 500);
            const failure = await broken.text();
            assert.match(failure, /The cable snapped/);
            assert.doesNotMatch(failure, /Database unreachable/, 'the error stays private outside development');

            const plain = await get('/admin/nowhere', 'application/json');
            assert.equal(plain.status, 404);
            assert.equal(await plain.text(), '404');

            setLocale('fr');
            assert.match(await (await get('/admin/nowhere')).text(), /Perdu dans les nuages/);
            setLocale('en');
        });
        const environment = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        await serve(panel, async (get) => assert.match(await (await get('/admin/broken')).text(), /<details class="fi-error-details">[\s\S]*Database unreachable/));
        process.env.NODE_ENV = environment;
    } finally { console.error = logged; setLocale('en'); }
});

test('a panel at the root leaves unknown URLs to the application, which may answer with panelNotFound()', async () => {
    const panel = Panel.make().id('root').key('root-key').authGuard('root').auth(auth).pages([Dashboard]);
    await serve(panel, async (get) => {
        assert.equal(await (await get('/api/ping')).text(), 'pong');
        const missing = await get('/nowhere');
        assert.equal(missing.status, 404);
        assert.match(await missing.text(), /Lost in the clouds/);
    }, (app) => {
        app.get('/api/ping', (_req, res) => void res.send('pong'));
        app.use(panelNotFound(panel));
    });
    // Your own middleware can answer with any status: a maintenance mode, for example.
    const app = express();
    app.use((req, res) => renderErrorPage(panel, req, res, 503));
    const server = app.listen(0);
    try {
        const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/`, { headers: { accept: 'text/html' } });
        assert.equal(response.status, 503);
        assert.match(await response.text(), /Line under maintenance/);
    } finally { server.close(); }
});
