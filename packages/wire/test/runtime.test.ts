import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Component, WireRuntime, type Snapshot } from '../src/index.ts';

class Counter extends Component {
    static callable = ['increment', 'quiet', 'go'];
    /** Internal method: exists but is never callable. */
    internalSecret() { return this.secret; }
    count = 0;
    tags: string[] = [];
    secret = 'x';
    static locked = ['secret'];
    mount(params: Record<string, unknown>) { this.count = Number(params.start ?? 0); }
    increment(by = 1) { this.count += by; this.dispatch('counted', { count: this.count }); return this.count; }
    quiet() { this.skipRender(); }
    go() { this.redirect('/elsewhere'); }
    updatedCount(value: number) { if (value > 100) this.count = 100; }
    render() { return `<div><span>${this.count}</span></div>`; }
}
const runtime = new WireRuntime({ key: 'test-key' }).register('counter', Counter);
const snapshotOf = (html: string): Snapshot =>
    JSON.parse(/wire:snapshot="([^"]+)"/.exec(html)![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

test('mount sets wire:snapshot, wire:effects, wire:id and wire:name on the root', async () => {
    const html = await runtime.mount('counter', { start: 3 });
    assert.match(html, /^<div wire:snapshot="[^"]+" wire:effects="[^"]+" wire:id="[\w-]{20}" wire:name="counter"><span>3<\/span>/);
    const s = snapshotOf(html);
    assert.equal(s.data.count, 3);
    assert.deepEqual(s.data.tags, [[], { s: 'arr' }]);
    assert.equal(s.memo.name, 'counter');
    assert.equal(s.checksum.length, 64);
});

test('update: method call, return value, dispatch and new HTML', async () => {
    const s = snapshotOf(await runtime.mount('counter', { start: 1 }));
    const { snapshot, effects } = await runtime.update(s, {}, [{ method: 'increment', params: [4] }]);
    assert.equal(snapshot.data.count, 5);
    assert.deepEqual(effects.returns, [5]);
    assert.deepEqual(effects.dispatches, [{ name: 'counted', params: { count: 5 } }]);
    assert.match(effects.html!, /<span>5<\/span>/);
    assert.equal(snapshot.memo.id, s.memo.id);
});

test('update: dotted path update and updated<Prop> hook', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    const r = await runtime.update(s, { count: 500, 'tags.0': 'a' }, []);
    assert.equal(r.snapshot.data.count, 100);
    assert.deepEqual(r.snapshot.data.tags, [['a'], { s: 'arr' }]);
});

test('tampered snapshot → 419; locked property → 403; lifecycle or unknown method → 404', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    await assert.rejects(runtime.update({ ...s, data: { ...s.data, count: 99 } }, {}, []), { status: 419 });
    await assert.rejects(runtime.update(s, { secret: 'y' }, []), { status: 403 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'mount', params: [{}] }]), { status: 404 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'dispatch', params: ['x'] }]), { status: 404 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'nope', params: [] }]), { status: 404 });
    await assert.rejects(runtime.update(s, { unknown: 1 }, []), { status: 404 });
});

test('skipRender and redirect remove effects.html', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    assert.equal((await runtime.update(s, {}, [{ method: 'quiet', params: [] }])).effects.html, undefined);
    const r = await runtime.update(s, {}, [{ method: 'go', params: [] }]);
    assert.equal(r.effects.redirect, '/elsewhere');
    assert.equal(r.effects.html, undefined);
});

test('handle: HTTP response shape', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    const res = await runtime.handle({ components: [{ snapshot: JSON.stringify(s), updates: {}, calls: [{ method: 'increment', params: [] }] }] });
    assert.equal(typeof res.components[0].snapshot, 'string');
    assert.equal(JSON.parse(res.components[0].snapshot).data.count, 1);
    assert.deepEqual(res.assets, []);
    await assert.rejects(runtime.handle({ components: [] }), { status: 404 });
});

test('magic actions ($commit, $refresh, $set, $sync): no server effect, the component still renders', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    const r = await runtime.update(s, { count: 7 }, [{ method: '$commit', params: [], metadata: { type: 'model.live' } }, { method: '$refresh', params: [] }]);
    assert.deepEqual(r.effects.returns, [null, null]);
    assert.match(r.effects.html!, /<span>7<\/span>/);
});

class Listener extends Component {
    seen: string[] = [];
    static listeners = { ping: 'onPing' };
    onPing(id: string) { this.seen.push(id); }
    render() { return `<div>${this.seen.join(',')}</div>`; }
}
runtime.register('listener', Listener);

test('listeners: announced in wire:effects, called through __dispatch; the memo is not marked lazy', async () => {
    const html = await runtime.mount('listener');
    assert.match(html, /wire:effects="\{&quot;listeners&quot;:\[&quot;ping&quot;\]\}"/);
    const s = snapshotOf(html);
    // The mere presence of `lazyLoaded` in the memo makes livewire.js ignore events.
    assert.equal('lazyLoaded' in s.memo, false);
    const r = await runtime.update(s, {}, [{ method: '__dispatch', params: ['ping', { id: 'a' }] }]);
    assert.deepEqual(r.snapshot.data.seen, [['a'], { s: 'arr' }]);
    await assert.rejects(runtime.update(s, {}, [{ method: '__dispatch', params: ['unknown', {}] }]), { status: 404 });
    // A listener is only callable through its event: its method is not in `static callable`.
    await assert.rejects(runtime.update(s, {}, [{ method: 'onPing', params: ['b'] }]), { status: 404 });
    // An internal method exists but is never callable, and its return value does not leak.
    await assert.rejects(runtime.update(snapshotOf(await runtime.mount('counter')), {}, [{ method: 'internalSecret', params: [] }]), { status: 404 });
});

class Mounter extends Component {
    static callable = ['mountAction'];
    opened: string[] = [];
    mountAction(name: string) { this.opened.push(name); this.renderPartial('modals', '<div wire:partial="modals">' + name + '</div>'); }
    updatedOpened() {}
    render() { return '<div><div wire:partial="modals"></div></div>'; }
}
runtime.register('mounter', Mounter);

test('partial render: effects.partials without effects.html; mountAction is callable, updated<Prop> is not', async () => {
    const s = snapshotOf(await runtime.mount('mounter'));
    const r = await runtime.update(s, {}, [{ method: 'mountAction', params: ['delete'] }]);
    assert.deepEqual(r.effects.partials, { modals: '<div wire:partial="modals">delete</div>' });
    assert.equal(r.effects.html, undefined);
    assert.deepEqual((await runtime.update(s, {}, [{ method: '$refresh', params: [] }])).effects.partials, {});
    await assert.rejects(runtime.update(s, {}, [{ method: 'updatedOpened', params: [] }]), { status: 404 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'renderPartial', params: ['x', 'y'] }]), { status: 404 });
});

// ---------------------------------------------------------------- nested components and lazy loading
class Child extends Component {
    owner = '';
    loaded = false;
    mount(params: Record<string, unknown>) { this.loaded = true; this.owner = String(params.owner ?? ''); }
    hello() { return 'hello'; }
    placeholder() { return '<div class="waiting"></div>'; }
    render() { return `<div class="child">${this.owner}</div>`; }
}
class Parent extends Component {
    tab = 'a';
    lazy = false;
    async render() { return `<section>${await this.mountChild('child', { owner: this.tab }, `child.${this.tab}`, { lazy: this.lazy })}</section>`; }
}
const nested = new WireRuntime({ key: 'test-key' }).register('child', Child).register('parent', Parent);
const snapshots = (html: string): Snapshot[] => [...html.matchAll(/wire:snapshot="([^"]+)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')));

test('nested components: the child renders inside the parent, which lists it in memo.children', async () => {
    const html = await nested.mount('parent');
    const [parent, child] = snapshots(html);
    assert.match(html, /<section[^>]*><div wire:key="child\.a" wire:snapshot=/);
    assert.equal(child.memo.name, 'child');
    assert.equal(child.data.owner, 'a');
    assert.deepEqual(parent.memo.children, { 'child.a': ['div', child.memo.id] });
});

test('nested components: on re-render, an existing child becomes a stub and a new child is mounted', async () => {
    const [parent, child] = snapshots(await nested.mount('parent'));
    const same = await nested.update(parent, {}, [{ method: '$refresh', params: [] }]);
    assert.equal(same.effects.html!.includes(`<div wire:id="${child.memo.id}" wire:name="child" wire:key="child.a"></div>`), true);
    assert.equal(same.effects.html!.includes('wire:snapshot'), false);
    const other = await nested.update(same.snapshot, { tab: 'b' }, []);
    assert.match(other.effects.html!, /wire:key="child\.b" wire:snapshot=/);
    assert.deepEqual(Object.keys(other.snapshot.memo.children), ['child.b']);
});

test('nested components: a forged memo.children entry cannot inject HTML', async () => {
    const [parent] = snapshots(await nested.mount('parent'));
    parent.memo.children = { 'child.a': ['div onload=alert(1)', 'x"><script>'] };
    const { effects } = await nested.update(parent, {}, [{ method: '$refresh', params: [] }]);
    assert.equal(effects.html!.includes('<script'), false);
    assert.equal(effects.html!.includes('onload'), false);
    assert.match(effects.html!, /wire:key="child\.a" wire:snapshot=/);
});

test('lazy loading: placeholder first, then __lazyLoad mounts and renders the component', async () => {
    const [parent] = snapshots(await nested.mount('parent'));
    const { effects } = await nested.update(parent, { lazy: true, tab: 'z' }, []);
    const html = effects.html!;
    assert.match(html, /class="waiting"/);
    const [child] = snapshots(html);
    assert.equal(child.memo.lazyLoaded, false);
    assert.equal(child.data.loaded, false);
    const payload = /__lazyLoad\(&#039;([^&]+)&#039;\)/.exec(html)![1];
    await assert.rejects(nested.update(child, {}, [{ method: 'hello', params: [] }]), /not loaded/);
    const loaded = await nested.update(child, {}, [{ method: '__lazyLoad', params: [payload] }]);
    assert.equal(loaded.effects.html!.includes('class="child">z</div>'), true);
    assert.equal(loaded.snapshot.memo.lazyLoaded, true);
    assert.equal(loaded.snapshot.data.loaded, true);
    await assert.rejects(nested.update(loaded.snapshot, {}, [{ method: '__lazyLoad', params: [payload] }]), /not waiting/);
});

test('lazy loading: tampered mount params are rejected', async () => {
    const [parent] = snapshots(await nested.mount('parent'));
    const html = (await nested.update(parent, { lazy: true, tab: 'y' }, [])).effects.html!;
    const [child] = snapshots(html);
    const payload = /__lazyLoad\(&#039;([^&]+)&#039;\)/.exec(html)![1];
    const container = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    container.data.forMount[0].owner = 'pirate';
    const forged = Buffer.from(JSON.stringify(container)).toString('base64');
    await assert.rejects(nested.update(child, {}, [{ method: '__lazyLoad', params: [forged] }]), /checksum/);
    await assert.rejects(nested.update(child, {}, [{ method: '__lazyLoad', params: ['not-base64-json'] }]));
});

test('update: a state path cannot target the object prototype', async () => {
    const s = snapshotOf(await runtime.mount('counter', {}));
    for (const path of ['tags.__proto__.polluted', 'tags.constructor.prototype.polluted', 'tags.prototype.x']) await assert.rejects(runtime.update(s, { [path]: 1 }, []), /State path rejected/);
    assert.equal(({} as any).polluted, undefined);
});
