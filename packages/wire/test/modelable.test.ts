import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Component, WireError, WireRuntime } from '../src/index.ts';

class Picker extends Component {
    state: string | null = null;
    render() { return `<div>${this.state ?? ''}</div>`; }
}
class Form extends Component {
    data: Record<string, unknown> = { picked: 'a' };
    showPicker = true;
    async render() {
        const picker = this.showPicker ? await this.mountChild('picker', { state: this.data.picked }, 'picker-key', { model: { property: 'state', outer: 'data.picked', directive: 'wire:model.live' } }) : '';
        return `<div>${picker}</div>`;
    }
}
class Forged extends Component {
    async render() { return `<div>${await this.mountChild('picker', {}, 'k', { model: { property: 'state', outer: 'data" onclick="x' } })}</div>`; }
}
const runtime = new WireRuntime({ key: 'test-key' }).register('picker', Picker).register('form', Form).register('forged', Forged);
const snapshots = (html: string) => [...html.matchAll(/wire:snapshot="([^"]*)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));

test('a modelable child: bound to a parent property in the browser, seeded by the parent on the server', async () => {
    const html = await runtime.mount('form');
    // The client binds the child's property to the parent's (Livewire's `wire:model` on a child with `#[Modelable]`).
    assert.match(html, /wire:model\.live="\$parent\.data\.picked" x-modelable="\$wire\.state"/);
    const [parent, child] = [snapshots(html).find((s) => s.memo.name === 'form'), snapshots(html).find((s) => s.memo.name === 'picker')];
    assert.deepEqual(child.memo.bindings, { 'data.picked': 'state' });
    assert.equal(child.data.state, 'a');
    // The parent changes the value and renders the child's stub: the child takes the new value in the same request.
    parent.memo.children = { 'picker-key': ['div', child.memo.id] };
    parent.checksum = runtime.checksum(parent);
    const response = await runtime.handle({ components: [{ snapshot: JSON.stringify(parent), updates: { 'data.picked': 'b' }, calls: [] }, { snapshot: JSON.stringify(child), updates: {}, calls: [] }] });
    assert.match(String(response.components[0].effects.html), /<div wire:id="[^"]+" wire:name="picker" wire:key="picker-key"><\/div>/);
    assert.equal(JSON.parse(response.components[1].snapshot).data.state, 'b');
    assert.match(String(response.components[1].effects.html), /x-modelable="\$wire\.state"/);
    // The browser may set the child's property itself (it is the bound value), not choose the binding.
    const own = await runtime.handle({ components: [{ snapshot: JSON.stringify(child), updates: { state: 'c' }, calls: [] }] });
    assert.equal(JSON.parse(own.components[0].snapshot).data.state, 'c');
    const tampered = { ...child, memo: { ...child.memo, bindings: { 'data.other': 'state' } } };
    await assert.rejects(runtime.handle({ components: [{ snapshot: JSON.stringify(tampered), updates: {}, calls: [] }] }), (error: WireError) => error.status === 419);
});

test('a modelable binding must be a plain property path', async () => {
    await assert.rejects(runtime.mount('forged'), /invalid model binding/);
});
