import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { AlpineComponent, AssetManager, Css, Dashboard, Js, NavetteAsset, Panel, panelRouter, type AuthProvider, type User } from '../src/index.ts';

const dir = mkdtempSync(join(tmpdir(), 'navette-assets-'));
const file = (name: string, content: string) => { const path = join(dir, name); writeFileSync(path, content); return path; };
const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };

type Reply = { status: number; text: string; headers: http.IncomingHttpHeaders };
const serve = async (panels: Panel[], fn: (get: (path: string, cookie?: string) => Promise<Reply>, cookie: string) => Promise<void>) => {
    const app = express();
    for (const panel of panels) app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    let cookie = '';
    panels[0].logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
    const port = (server.address() as any).port;
    const get = (path: string, withCookie = '') => new Promise<Reply>((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path, headers: { cookie: withCookie, 'sec-fetch-dest': 'document' } }, (res) => {
            let text = '';
            res.setEncoding('utf8').on('data', (chunk) => { text += chunk; }).on('end', () => resolve({ status: res.statusCode ?? 0, text, headers: res.headers }));
        }).on('error', reject);
    });
    try { await fn(get, cookie); } finally { server.close(); }
};

test('assets get public paths by package and versioned URLs that change with the file', () => {
    const manager = new AssetManager();
    const css = file('custom.css', 'body { color: red }');
    manager.register([Css.make('custom-stylesheet', css), Js.make('custom-script', file('custom.js', 'console.log(1)')), AlpineComponent.make('test-component', file('component.js', 'export default () => ({})'))]);
    manager.register([Css.make('blog', file('blog.css', 'a {}'))], 'acme/navette-blog');
    const href = manager.getStyleHref('custom-stylesheet');
    assert.match(href, /^\/css\/app\/custom-stylesheet\.css\?v=[0-9a-f]{12}$/);
    assert.match(manager.getScriptSrc('custom-script'), /^\/js\/app\/custom-script\.js\?v=[0-9a-f]{12}$/);
    assert.match(manager.getAlpineComponentSrc('test-component'), /^\/js\/app\/components\/test-component\.js\?v=[0-9a-f]{12}$/);
    assert.match(manager.getStyleHref('blog', 'acme/navette-blog'), /^\/css\/acme\/navette-blog\/blog\.css\?v=/);
    assert.throws(() => manager.getStyleHref('blog'), /Stylesheet with ID \[blog\] not found for package \[app\]/);
    // A new content: a new version.
    writeFileSync(css, 'body { color: blue; }');
    utimesSync(css, new Date(), new Date(Date.now() + 5000));
    assert.notEqual(manager.getStyleHref('custom-stylesheet'), href);
    // URLs are kept as-is, without version.
    manager.register([Css.make('cdn', 'https://cdn.example.com/x.css'), Js.make('local', '/js/local.js')]);
    assert.equal(manager.getStyleHref('cdn'), 'https://cdn.example.com/x.css');
    assert.equal(manager.getScriptSrc('local'), '/js/local.js');
    assert.equal(manager.resolve('/css/app/cdn.css'), null);
    assert.ok(manager.resolve('/css/app/custom-stylesheet.css'));
});

test('registration is checked: ids, packages, missing files, and two files on one URL', () => {
    const manager = new AssetManager();
    assert.throws(() => Css.make('../evil', 'x'), /Invalid asset id/);
    assert.throws(() => manager.register([Css.make('x', file('x.css', ''))], '../up'), /Invalid asset package/);
    assert.throws(() => manager.register([Css.make('missing', join(dir, 'nope.css'))]), /file not found/);
    manager.register([Css.make('same', file('same.css', ''))]);
    // The same file again (another panel): accepted.
    manager.register([Css.make('same', join(dir, 'same.css'))], 'app', { panel: 'other' });
    assert.throws(() => manager.register([Css.make('same', file('other.css', ''))]), /already registered with another file/);
    assert.throws(() => Js.make('x', 'x').extraAttributes({ 'onload="alert(1)"': 'x' }), /Invalid attribute name/);
});

test('rendering: on-request assets stay out of the page; script data and CSS variables cannot break out of their element', () => {
    const manager = new AssetManager();
    manager.register([
        Css.make('always', file('always.css', 'a {}')), Css.make('lazy', file('lazy.css', 'b {}')).loadedOnRequest(),
        Js.make('first', file('first.js', '')).defer(), Js.make('module', file('module.js', '')).module().extraAttributes({ 'data-label': '"><script>' }), Js.make('lazy-js', file('lazy.js', '')).loadedOnRequest(),
        Js.make('core', file('core.js', '')).core(), AlpineComponent.make('chart', file('chart.js', '')),
    ]);
    const styles = manager.renderStyles();
    assert.match(styles, /<link href="\/css\/app\/always\.css\?v=[0-9a-f]+" rel="stylesheet" data-navigate-track \/>/);
    assert.doesNotMatch(styles, /lazy/);
    assert.equal(new AssetManager().renderStyles(), '');
    const scripts = manager.renderScripts(null, { withCore: true });
    assert.match(scripts, /<script src="\/js\/app\/first\.js\?v=[0-9a-f]+" defer data-navigate-once data-navigate-track><\/script>/);
    assert.match(scripts, /type="module" data-label="&quot;&gt;&lt;script&gt;"/);
    assert.doesNotMatch(scripts, /lazy|chart/);
    // Core scripts come last; without `withCore`, they are left out.
    assert.ok(scripts.indexOf('core.js') > scripts.indexOf('module.js'));
    assert.doesNotMatch(manager.renderScripts(), /core\.js/);
    assert.doesNotMatch(manager.renderScripts(null, { spa: false }), /data-navigate/);
    manager.registerScriptData({ user: { name: '</script><script>alert(1)</script>' } });
    const data = manager.renderScriptData();
    assert.match(data, /^window\.navetteData = \{"user":\{"name":"\\u003c\/script\\u003e/);
    assert.doesNotMatch(data, /<\/script>/);
    assert.equal(new AssetManager().renderScriptData(), 'window.navetteData = []');
    manager.registerCssVariables({ 'background-image': 'url(/bg.jpg)', 'bad name': 'x', evil: 'red;}</style><script>' });
    const css = manager.renderStyles();
    assert.match(css, /<style>:root\{--background-image:url\(\/bg\.jpg\);--evil:red\/stylescript;\}<\/style>/);
});

test('the panel router serves registered files with long caching at their current version, and renders them per panel', async () => {
    const css = file('served.css', '.served { color: red }');
    NavetteAsset.register([Css.make('served', css), Js.make('served', file('served.js', 'window.served = 1')), AlpineComponent.make('widget', file('widget.js', 'export default () => ({})'))]);
    NavetteAsset.registerScriptData({ locale: 'fr' });
    const admin = Panel.make().id('admin').path('admin').key('k').auth(auth).pages([Dashboard]).assets([Css.make('admin-only', file('admin.css', '.admin {}'))]);
    const other = Panel.make().id('other').path('other').key('k').auth(auth).pages([Dashboard]);
    await serve([admin, other], async (get, cookie) => {
        const href = NavetteAsset.getStyleHref('served');
        const fresh = await get(href);
        assert.equal(fresh.status, 200);
        assert.equal(fresh.text, '.served { color: red }');
        assert.match(String(fresh.headers['content-type']), /text\/css/);
        assert.equal(fresh.headers['cache-control'], 'public, max-age=31536000, immutable');
        assert.equal(fresh.headers['x-content-type-options'], 'nosniff');
        const stale = await get('/css/app/served.css?v=old');
        assert.equal(stale.headers['cache-control'], 'no-cache');
        const script = await get(NavetteAsset.getAlpineComponentSrc('widget'));
        assert.match(String(script.headers['content-type']), /javascript/);
        // Nothing else is served from the asset folders.
        assert.equal((await get('/css/app/unknown.css')).status, 404);
        assert.equal((await get('/css/app/..%2F..%2Fpackage.json')).status, 404);

        const adminPage = await get('/admin', cookie);
        assert.equal(adminPage.status, 200);
        assert.match(adminPage.text, /<link href="\/css\/app\/served\.css\?v=[0-9a-f]+" rel="stylesheet"/);
        assert.match(adminPage.text, /\/css\/app\/admin-only\.css\?v=/);
        assert.match(adminPage.text, /<script src="\/js\/app\/served\.js\?v=[0-9a-f]+"><\/script>/);
        assert.match(adminPage.text, /window\.navetteData = \{"locale":"fr"\}/);
        // Registered scripts come before the panel's own scripts.
        assert.ok(adminPage.text.indexOf('/js/app/served.js') < adminPage.text.indexOf('js/navette/actions/actions.js'));
        const otherPage = await get('/other', cookie);
        assert.equal(otherPage.status, 200);
        assert.match(otherPage.text, /\/css\/app\/served\.css/);
        assert.doesNotMatch(otherPage.text, /admin-only/);
        // A panel's own asset is still a public file.
        assert.equal((await get('/css/app/admin-only.css')).status, 200);
    });
});
