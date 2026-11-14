import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Component, WireRuntime } from '@navette-js/wire';
import { Livewire, Schema } from '../src/index.ts';

class SalesChart extends Component {
    static callable = ['increment'];
    static locked = ['productName'];
    productName: string | null = null;
    count = 0;
    mounted: Record<string, unknown> = {};
    mount(params: Record<string, unknown>) { this.count = Number(params.start ?? 0); this.mounted = { hasRecord: params.record !== undefined, recordName: (params.record as { name?: string } | null)?.name ?? null }; }
    increment() { this.count++; }
    placeholder() { return '<div class="loading">Loading…</div>'; }
    render() { return `<div class="chart">${this.productName} ${this.count} ${JSON.stringify(this.mounted)}</div>`; }
}
class Other extends Component { render() { return '<div>other</div>'; } }

/** A page rendering a schema with nested Livewire components. */
class ProductPage extends Component {
    lazy = false;
    getSchema() {
        return Schema.make(this as any).key('content').record({ id: 7, name: 'Lamp' }).components([
            Livewire.make(SalesChart, ({ record }) => ({ productName: (record as { name: string }).name, start: 2 })).key('sales'),
            Livewire.make(SalesChart, { productName: 'Lazy' }).key('lazy-sales').lazyLoaded(() => true),
            Livewire.make('registered-other').extraAttributes({ id: 'other' }),
        ]);
    }
    _errors = {};
    async render() { return `<div>${await this.getSchema().toHtml()}</div>`; }
}
const runtime = new WireRuntime({ key: 'test-key' }).register('product-page', ProductPage).register('registered-other', Other);
const snapshots = (html: string) => [...html.matchAll(/wire:snapshot="([^"]*)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));

test('Livewire.make() mounts a nested component with the record and its data', async () => {
    const html = await runtime.mount('product-page');
    assert.ok(runtime.has('livewire.sales-chart'), 'the class is registered on first use');
    assert.match(html, /class="chart">Lamp 2 \{"hasRecord":true,"recordName":"Lamp"\}<\/div>/);
    const all = snapshots(html);
    const chart = all.find((s) => s.memo.name === 'livewire.sales-chart' && s.data.productName === 'Lamp');
    assert.ok(chart, 'child snapshot');
    assert.equal(chart.data.count, 2);
    assert.deepEqual(chart.data.mounted[0], { hasRecord: true, recordName: 'Lamp' });
    // The parent lists its children under their keys.
    const page = all.find((s) => s.memo.name === 'product-page');
    assert.ok(Object.keys(page.memo.children).includes('content.sales') || Object.keys(page.memo.children).some((key) => key.endsWith('.content.sales')));
    // A lazy component shows its placeholder, without the record in its mount parameters.
    assert.match(html, /x-intersect="\$wire\.__lazyLoad\(&#039;[A-Za-z0-9+\/=]+&#039;\)" class="loading">Loading…<\/div>/);
    const encoded = /__lazyLoad\(&#039;([A-Za-z0-9+\/=]+)&#039;\)/.exec(html)![1];
    const params = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')).data.forMount;
    assert.equal(JSON.stringify(params).includes('Lamp'), false, 'the record is not written in the page');
    // A name registered beforehand, wrapped by extra attributes.
    assert.match(html, /<div id="other"><div wire:key="[^"]+\.registered-other"[^>]*>other<\/div><\/div>/);
    // The child handles its own requests.
    const response = await runtime.handle({ components: [{ snapshot: JSON.stringify(chart), updates: {}, calls: [{ method: 'increment', params: [] }] }] });
    assert.equal(JSON.parse(response.components[0].snapshot).data.count, 3);
});

test('Livewire.make() refuses a name taken by another class', async () => {
    class Clash extends Component { render() { return '<div></div>'; } }
    Object.defineProperty(Clash, 'name', { value: 'SalesChart' });
    class ClashPage extends Component {
        _errors = {};
        getSchema() { return Schema.make(this as any).key('content').components([Livewire.make(SalesChart).key('a'), Livewire.make(Clash).key('b')]); }
        async render() { return `<div>${await this.getSchema().toHtml()}</div>`; }
    }
    const local = new WireRuntime({ key: 'test-key' }).register('clash-page', ClashPage);
    await assert.rejects(local.mount('clash-page'), /another component is registered as \[livewire\.sales-chart\]/);
});
