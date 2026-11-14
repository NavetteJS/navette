// JavaScript widgets (Filament's `HasJsRenderer`): markup of the renderer, configuration updates, renderer URL checks,
// renderers registered as assets loaded on request, and dashboard filters passed to a renderer.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { RawJs, Select } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { Dashboard, isSafeJsWidgetRendererUrl, Js, JsWidget, jsWidgetContentHtml, NavetteAsset, PAGE_FILTERS, Panel, resolveJsWidgetRenderer, type JsWidgetRenderer, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel } from '../src/testing.ts';

const dir = mkdtempSync(path.join(tmpdir(), 'navette-js-widgets-'));
const rendererFile = path.join(dir, 'revenue-overview.js');
writeFileSync(rendererFile, 'export default function mount({ host }) { return { update() {}, destroy: () => host.replaceChildren() } }\n');
NavetteAsset.register([Js.make('revenue-overview', rendererFile).loadedOnRequest()], 'acme/reports');
after(() => { NavetteAsset.flush(); rmSync(dir, { recursive: true, force: true }); });

class RevenueOverview extends JsWidget {
    static isLazy = false;
    static callable = ['refreshRevenue'];
    refreshed = 0;
    getRenderer() { return NavetteAsset.getScriptSrc('revenue-overview', 'acme/reports'); }
    getRendererConfiguration() { return { heading: 'Revenue <overview> "q" </script>', total: 1250, refreshed: this.refreshed }; }
    refreshRevenue() { this.refreshed++; }
}
class InlineRenderer extends JsWidget {
    static isLazy = false;
    getRenderer() { return RawJs.make('window.mountInlineRevenue'); }
}
class NoRenderer extends JsWidget {
    static isLazy = false;
    getRenderer() { return null; }
}
class UnsafeRenderer extends JsWidget {
    static isLazy = false;
    getRenderer() { return 'javascript:alert(1)'; }
}
class FilteredRevenue extends JsWidget {
    static isLazy = false;
    static reactive = PAGE_FILTERS;
    pageFilters: Record<string, unknown> | null = null;
    getRenderer() { return '/js/filtered-revenue.js'; }
    getRendererConfiguration() { return { status: typeof this.pageFilters?.status === 'string' ? this.pageFilters.status : null }; }
}
class RevenueDashboard extends Dashboard {
    static slug = 'revenue';
    static persistsFiltersInSession = false;
    filtersFormSchema(schema: Schema): Schema { return schema.components([Select.make('status').options({ new: 'New', shipped: 'Shipped' }).default('shipped')]); }
    getWidgets() { return [FilteredRevenue]; }
}

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('js-widgets').key('js-widgets-key').auth({ find: async () => user } as any)
    .pages([RevenueDashboard]).widgets([RevenueOverview, InlineRenderer, NoRenderer, UnsafeRenderer, FilteredRevenue]);
setCurrentPanel(panel);
actingAs(user);

const render = async (component: any, params: Record<string, unknown> = {}): Promise<string> => { const widget = livewire(component, params); await widget.assertOk(); return widget.html(); };
const attribute = (html: string, name: string): string => {
    const match = new RegExp(`${name}="([^"]*)"`).exec(html);
    assert.ok(match, `missing ${name}`);
    return match![1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};

test('a JS widget renders Filament\'s js-widget markup in a section', async () => {
    const html = await render(RevenueOverview);
    assert.match(html, /^<div wire:snapshot="[^"]*"[^>]* class="nv-wi-widget nv-grid-col lg:nv-grid-col-span nv-wi-js"><section/);
    assert.match(html, /<section x-data="\{[\s\S]*?isCollapsed: {2}false ,[\s\S]*?\}" class="nv-section"><div class="nv-section-content-ctn"><div class="nv-section-content">/);
    assert.match(html, /\sx-load\s+x-load-src="\/js\/navette\/widgets\/components\/js-widget\.js\?v=[^"]+"/);
    const component = /x-data="(jsWidgetComponent\([^"]*)"/.exec(html)![1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
    assert.match(component, /renderer: '\\\/js\\\/acme\\\/reports\\\/revenue-overview\.js\?v=[a-f0-9]{12}',/);
    assert.match(component, /rendererConfiguration: JSON\.parse\(\s*\$el\.querySelector\('\[data-renderer-configuration\]'\)\.dataset\s*\.rendererConfiguration,\s*\)/);
    // The configuration is JSON in an escaped attribute: no markup can break out of it.
    assert.doesNotMatch(html, /<overview>|<\/script>/);
    assert.deepEqual(JSON.parse(attribute(html, 'data-renderer-configuration')), { heading: 'Revenue <overview> "q" </script>', total: 1250, refreshed: 0 });
    assert.match(html, /<div wire:ignore x-ref="host"><\/div>/);
    assert.match(html, /<p x-cloak x-show="hasError" role="alert">\s*This widget could not be loaded\. Please refresh the page to try again\.\s*<\/p>/);
});

test('a configuration change only replaces the keyed configuration; another renderer remounts', async () => {
    const widget = livewire(RevenueOverview);
    await widget.assertOk();
    const before = widget.html();
    await widget.call('refreshRevenue').assertSet('refreshed', 1);
    const after = widget.html();
    const keys = (html: string) => [...html.matchAll(/wire:key="([^"]+)"/g)].map((match) => match[1]);
    const [outerBefore, spanBefore] = keys(before), [outerAfter, spanAfter] = keys(after);
    assert.equal(outerBefore, outerAfter);
    assert.match(outerBefore, /\.renderer\.[a-f0-9]{32}$/);
    assert.notEqual(spanBefore, spanAfter);
    assert.match(spanAfter, /\.renderer-configuration\.[a-f0-9]{32}$/);
    assert.equal(JSON.parse(attribute(after, 'data-renderer-configuration')).refreshed, 1);
    const id = outerBefore.split('.renderer.')[0];
    const other = jsWidgetContentHtml({ widgetId: id, assetUrl: '/x.js', renderer: '/js/other.js', rendererConfiguration: {} });
    assert.notEqual(keys(other)[0], outerBefore);
});

test('a RawJs renderer is inserted as code, null renders no renderer, an empty configuration is []', async () => {
    const inline = await render(InlineRenderer);
    assert.match(inline, /renderer: window\.mountInlineRevenue,/);
    assert.equal(attribute(inline, 'data-renderer-configuration'), '[]');
    assert.match(await render(NoRenderer), /renderer: null,/);
});

test('renderer URLs: only site paths and http(s) URLs; the configuration must be an object', () => {
    for (const url of ['/js/widget.js', '/js/acme/reports/revenue-overview.js?v=abc', 'https://cdn.example.com/w.js', 'http://localhost:3000/w.js']) assert.ok(isSafeJsWidgetRendererUrl(url), url);
    for (const url of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/javascript,alert(1)', '//evil.example/w.js', '/\\evil.example/w.js', 'w.js', './w.js', '/js/a b.js', '/js/"onload=x.js', 'blob:https://x/1']) {
        assert.equal(isSafeJsWidgetRendererUrl(url), false, url);
        assert.throws(() => resolveJsWidgetRenderer(url), /Invalid JavaScript widget renderer URL/);
    }
    assert.equal(resolveJsWidgetRenderer(''), null);
    assert.throws(() => resolveJsWidgetRenderer(42), /getRenderer\(\) must return/);
    assert.throws(() => jsWidgetContentHtml({ widgetId: 'w', assetUrl: '/x.js', renderer: null, rendererConfiguration: ['a'] }), /must be an object/);
});

test('an unsafe renderer URL fails the render instead of reaching the page', async () => {
    const widget = livewire(UnsafeRenderer);
    await assert.rejects(async () => { await widget.assertOk(); }, /Invalid JavaScript widget renderer URL/);
});

test('a renderer registered as an asset loaded on request is not in the layout, only imported by the widget', () => {
    assert.doesNotMatch(NavetteAsset.renderScripts(['acme/reports']), /revenue-overview/);
    assert.match(NavetteAsset.getScriptSrc('revenue-overview', 'acme/reports'), /^\/js\/acme\/reports\/revenue-overview\.js\?v=[a-f0-9]{12}$/);
});

test('dashboard filters reach the renderer configuration', async () => {
    const config = async (pageFilters: Record<string, unknown> | null) => JSON.parse(attribute(await render(FilteredRevenue, { pageFilters }), 'data-renderer-configuration'));
    assert.deepEqual(await config({ status: 'shipped' }), { status: 'shipped' });
    assert.deepEqual(await config({ status: { forged: true } }), { status: null });
    assert.deepEqual(await config(null), { status: null });
    // The dashboard passes its filters to the widget it renders.
    const dashboard = livewire(RevenueDashboard);
    await dashboard.assertOk().assertSet('filters.status', 'shipped');
    assert.match(dashboard.html(), /data-renderer-configuration="\{&quot;status&quot;:&quot;shipped&quot;\}"/);
});

test('renderer types are exported for TypeScript renderer modules', () => {
    const mount: JsWidgetRenderer<{ heading: string }, { refreshRevenue(): Promise<void> }> = ({ host, props }) => {
        void host; void props.configuration.heading;
        return { update() {}, destroy() {} };
    };
    assert.equal(typeof mount, 'function');
});
