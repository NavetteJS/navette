import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { views } from '@navette-js/support';
import { JsComponent, Schema, debounceMilliseconds, phpJsonEncode } from '../src/index.ts';

views.share({ assetUrl: (file: string) => `/${file}` });

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; } });
const render = (components: any[], livewire: any = host()) => Schema.make(livewire).key('form').statePath('data').components(components).toHtml();
const md5 = (value: string) => createHash('md5').update(value).digest('hex');
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('JsComponent: Filament markup, renderer URL, configuration and id', async () => {
    const html = await render([JsComponent.make().key('chart').renderer('/js/components/chart.js').rendererConfiguration({ points: [1, 2, 3] })]);
    assert.ok(html.includes('x-data="filamentSchemaComponent('));
    assert.ok(html.includes(`wire:key="lw.form.chart.${md5('{"id":"form.chart"}/js/components/chart.js')}"`));
    assert.ok(html.includes('x-load-src="/js/filament/schemas/components/js-component.js"'));
    assert.ok(html.includes('x-data="jsSchemaComponent({'));
    assert.ok(html.includes('renderer: &#039;\\/js\\/components\\/chart.js&#039;,'));
    assert.ok(html.includes("rendererConfiguration: JSON.parse($el.querySelector('[data-renderer-configuration]').dataset.rendererConfiguration),"));
    assert.ok(html.includes("componentConfiguration: JSON.parse('{\\u0022id\\u0022:\\u0022form.chart\\u0022}'),"));
    assert.ok(html.includes(`wire:key="lw.form.chart.renderer-configuration.${md5('{"points":[1,2,3]}')}"`));
    assert.ok(html.includes('data-renderer-configuration="{&quot;points&quot;:[1,2,3]}"'));
    assert.ok(html.includes('x-init="updateRendererConfiguration(JSON.parse($el.dataset.rendererConfiguration))"'));
    assert.ok(html.includes('<div wire:ignore x-ref="host"></div>'));
    assert.match(html, /<p x-cloak x-show="hasError" role="alert">\s*This component could not be loaded\. Please reload the page to try again\.\s*<\/p>/);
});

test('JsComponent: custom id, RawJs-like renderer, configuration function, extra attributes, visibility', async () => {
    const livewire = host({ period: 'week' });
    const html = await render([
        JsComponent.make().id('sales-chart').renderer({ js: 'window.mountChart' }).rendererConfiguration(({ get }) => ({ period: get('period') })).extraAttributes({ class: 'my-chart' }),
        JsComponent.make().key('hidden').renderer('/x.js').hidden(),
    ], livewire);
    assert.ok(html.includes('renderer: window.mountChart,'));
    assert.ok(html.includes("componentConfiguration: JSON.parse('{\\u0022id\\u0022:\\u0022sales-chart\\u0022}'),"));
    // Without a key, the Livewire key is only the hash, as in Filament.
    assert.ok(html.includes(`wire:key=".${md5('{"id":"sales-chart"}window.mountChart')}"`));
    assert.ok(html.includes(' class="my-chart"'));
    assert.equal(decode(html.match(/data-renderer-configuration="([^"]*)"/)![1]), '{"period":"week"}');
    assert.ok(!html.includes('\\/x.js'));
    // No key and no id: `props.id` is null.
    assert.ok((await render([JsComponent.make().renderer('/x.js')])).includes("componentConfiguration: JSON.parse('{\\u0022id\\u0022:null}'),"));
});

test('phpJsonEncode and debounceMilliseconds follow PHP', () => {
    assert.equal(phpJsonEncode({}), '[]');
    assert.equal(phpJsonEncode({ a: {}, b: [], c: undefined }), '{"a":[],"b":[]}');
    assert.equal(phpJsonEncode({ url: '/a/b', city: 'Zürich', emoji: '😀' }), '{"url":"\\/a\\/b","city":"Z\\u00fcrich","emoji":"\\ud83d\\ude00"}');
    assert.equal(debounceMilliseconds(null), null);
    assert.equal(debounceMilliseconds(300), 300);
    assert.equal(debounceMilliseconds('1s'), 1000);
    assert.equal(debounceMilliseconds('750ms'), 750);
    assert.equal(debounceMilliseconds('750'), 750);
});
