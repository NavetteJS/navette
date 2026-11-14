import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { ColorManager } from '@navette-js/support';
import { getLocale, setLocale } from '@navette-js/support/i18n';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { useColorManager as useFormsColorManager } from '@navette-js/forms';
import { useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useUiColorManager } from '@navette-js/support/ui';
import { Dashboard, Panel, panelRouter, renderPageLoadingIndicator, type AuthProvider, type User } from '../src/index.ts';

const colors = new ColorManager();
useActionsColorManager(colors); useFormsColorManager(colors); useSchemasColorManager(colors); useUiColorManager(colors);

const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
const auth: AuthProvider = { attempt: async () => null, find: async (id) => (String(id) === '1' ? ada : null) };

const page = async (panel: Panel): Promise<string> => {
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try {
        let cookie = '';
        panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
        const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}${panel.getBaseUrl()}`, { headers: { cookie } });
        assert.equal(response.status, 200);
        return await response.text();
    } finally { server.close(); }
};
const make = (id: string) => Panel.make().id(id).path(id).key(`${id}-key`).authGuard(id).auth(auth).pages([Dashboard]);

test('pageLoadingIndicator(): content area by default, screen, or none', () => {
    assert.equal(make('pl-default').getPageLoadingIndicator(), 'content');
    assert.equal(make('pl-screen').pageLoadingIndicator('screen').getPageLoadingIndicator(), 'screen');
    assert.equal(make('pl-off').pageLoadingIndicator(false).getPageLoadingIndicator(), false);
    assert.equal(make('pl-true').pageLoadingIndicator(true).getPageLoadingIndicator(), 'content');
    assert.equal(make('pl-delay').getPageLoadingDelay(), 150);
    assert.equal(make('pl-delay2').pageLoadingIndicator('content', { delay: 300 }).getPageLoadingDelay(), 300);
    assert.throws(() => make('pl-bad').pageLoadingIndicator('sidebar' as any), /Invalid page loading indicator/);
    assert.throws(() => make('pl-bad2').pageLoadingIndicator('content', { delay: -1 }), /positive number/);
});

test('the overlay markup: mode, delay, a status region with a translated label', () => {
    const html = renderPageLoadingIndicator('content', 200);
    assert.match(html, /^<div class="nv-page-loading" data-mode="content" data-delay="200">/);
    assert.match(html, /<div class="nv-page-loading-overlay" aria-hidden="true"><div class="nv-page-loading-card"><span class="nv-page-loading-spinner"><\/span><span class="nv-page-loading-text">Loading page…<\/span><\/div><\/div>/);
    assert.match(html, /<span class="nv-page-loading-status nv-sr-only" role="status" data-label="Loading page…"><\/span>/);
    assert.match(renderPageLoadingIndicator('screen'), /data-mode="screen" data-delay="150"/);
    assert.equal(renderPageLoadingIndicator(false), '');
    const locale = getLocale();
    setLocale('fr');
    try { assert.match(renderPageLoadingIndicator('content'), /data-label="Chargement de la page…"/); } finally { setLocale(locale); }
});

test('a panel page carries the overlay, its sheet and script, and no navigation progress bar', async () => {
    const html = await page(make('pl-page'));
    assert.match(html, /<body [^>]*data-no-progress-bar>/);
    assert.match(html, /<div class="nv-page-loading" data-mode="content" data-delay="150">/);
    assert.match(html, /<link rel="stylesheet" href="[^"]*navette\/page-loading\.css[^"]*" data-navigate-track \/>/);
    assert.match(html, /<script[^>]* src="[^"]*navette\/page-loading\.js[^"]*" data-navigate-once><\/script>/);
    assert.doesNotMatch(html, /nv-busy/);
    // The overlay sits outside the content region it covers.
    assert.ok(html.indexOf('class="nv-page-loading"') > html.indexOf('id="nv-main-content"'));

    const screen = await page(make('pl-page-screen').pageLoadingIndicator('screen'));
    assert.match(screen, /data-mode="screen"/);

    const none = await page(make('pl-page-off').pageLoadingIndicator(false));
    assert.doesNotMatch(none, /nv-page-loading/);
    assert.match(none, /<body [^>]*data-no-progress-bar>/, 'no progress bar either');
});
