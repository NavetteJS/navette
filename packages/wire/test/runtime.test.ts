import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Component, WireRuntime, type Snapshot } from '../src/index.ts';

class Counter extends Component {
    static callable = ['increment', 'quiet', 'go'];
    /** Méthode interne : jamais appelable, bien qu'elle existe. */
    internalSecret() { return this.secret; }
    count = 0;
    tags: string[] = [];
    secret = 'x';
    static locked = ['secret'];
    mount(params: Record<string, unknown>) { this.count = Number(params.start ?? 0); }
    increment(by = 1) { this.count += by; this.dispatch('counted', { count: this.count }); return this.count; }
    quiet() { this.skipRender(); }
    go() { this.redirect('/ailleurs'); }
    updatedCount(value: number) { if (value > 100) this.count = 100; }
    render() { return `<div><span>${this.count}</span></div>`; }
}
const runtime = new WireRuntime({ key: 'test-key' }).register('counter', Counter);
const snapshotOf = (html: string): Snapshot =>
    JSON.parse(/wire:snapshot="([^"]+)"/.exec(html)![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

test('mount pose wire:snapshot, wire:effects, wire:id et wire:name sur la racine', async () => {
    const html = await runtime.mount('counter', { start: 3 });
    assert.match(html, /^<div wire:snapshot="[^"]+" wire:effects="[^"]+" wire:id="[\w-]{20}" wire:name="counter"><span>3<\/span>/);
    const s = snapshotOf(html);
    assert.equal(s.data.count, 3);
    assert.deepEqual(s.data.tags, [[], { s: 'arr' }]);
    assert.equal(s.memo.name, 'counter');
    assert.equal(s.checksum.length, 64);
});

test('update : appel de méthode, retour, dispatch et nouveau HTML', async () => {
    const s = snapshotOf(await runtime.mount('counter', { start: 1 }));
    const { snapshot, effects } = await runtime.update(s, {}, [{ method: 'increment', params: [4] }]);
    assert.equal(snapshot.data.count, 5);
    assert.deepEqual(effects.returns, [5]);
    assert.deepEqual(effects.dispatches, [{ name: 'counted', params: { count: 5 } }]);
    assert.match(effects.html!, /<span>5<\/span>/);
    assert.equal(snapshot.memo.id, s.memo.id);
});

test('update : mise à jour par chemin pointé et hook updated<Prop>', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    const r = await runtime.update(s, { count: 500, 'tags.0': 'a' }, []);
    assert.equal(r.snapshot.data.count, 100);
    assert.deepEqual(r.snapshot.data.tags, [['a'], { s: 'arr' }]);
});

test('snapshot falsifié → 419 ; propriété verrouillée → 403 ; méthode de cycle de vie ou inconnue → 404', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    await assert.rejects(runtime.update({ ...s, data: { ...s.data, count: 99 } }, {}, []), { status: 419 });
    await assert.rejects(runtime.update(s, { secret: 'y' }, []), { status: 403 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'mount', params: [{}] }]), { status: 404 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'dispatch', params: ['x'] }]), { status: 404 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'nope', params: [] }]), { status: 404 });
    await assert.rejects(runtime.update(s, { inconnu: 1 }, []), { status: 404 });
});

test('skipRender et redirect suppriment effects.html', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    assert.equal((await runtime.update(s, {}, [{ method: 'quiet', params: [] }])).effects.html, undefined);
    const r = await runtime.update(s, {}, [{ method: 'go', params: [] }]);
    assert.equal(r.effects.redirect, '/ailleurs');
    assert.equal(r.effects.html, undefined);
});

test('handle : forme de la réponse HTTP', async () => {
    const s = snapshotOf(await runtime.mount('counter'));
    const res = await runtime.handle({ components: [{ snapshot: JSON.stringify(s), updates: {}, calls: [{ method: 'increment', params: [] }] }] });
    assert.equal(typeof res.components[0].snapshot, 'string');
    assert.equal(JSON.parse(res.components[0].snapshot).data.count, 1);
    assert.deepEqual(res.assets, []);
    await assert.rejects(runtime.handle({ components: [] }), { status: 404 });
});

test('actions magiques ($commit, $refresh, $set, $sync) : sans effet serveur, le rendu a lieu', async () => {
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

test('écouteurs : annoncés dans wire:effects, appelés par __dispatch ; le mémo ne se dit pas « lazy »', async () => {
    const html = await runtime.mount('listener');
    assert.match(html, /wire:effects="\{&quot;listeners&quot;:\[&quot;ping&quot;\]\}"/);
    const s = snapshotOf(html);
    // La seule présence de `lazyLoaded` dans le mémo fait ignorer les événements au client livewire.js.
    assert.equal('lazyLoaded' in s.memo, false);
    const r = await runtime.update(s, {}, [{ method: '__dispatch', params: ['ping', { id: 'a' }] }]);
    assert.deepEqual(r.snapshot.data.seen, [['a'], { s: 'arr' }]);
    await assert.rejects(runtime.update(s, {}, [{ method: '__dispatch', params: ['inconnu', {}] }]), { status: 404 });
    // Un écouteur n'est appelable que par son événement : sa méthode n'est pas dans `static callable`.
    await assert.rejects(runtime.update(s, {}, [{ method: 'onPing', params: ['b'] }]), { status: 404 });
    // Une méthode interne existe mais n'est jamais appelable, et sa valeur de retour ne fuit pas.
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

test('rendu partiel : effects.partials sans effects.html ; mountAction est appelable, updated<Prop> n est pas appelable', async () => {
    const s = snapshotOf(await runtime.mount('mounter'));
    const r = await runtime.update(s, {}, [{ method: 'mountAction', params: ['delete'] }]);
    assert.deepEqual(r.effects.partials, { modals: '<div wire:partial="modals">delete</div>' });
    assert.equal(r.effects.html, undefined);
    assert.deepEqual((await runtime.update(s, {}, [{ method: '$refresh', params: [] }])).effects.partials, {});
    await assert.rejects(runtime.update(s, {}, [{ method: 'updatedOpened', params: [] }]), { status: 404 });
    await assert.rejects(runtime.update(s, {}, [{ method: 'renderPartial', params: ['x', 'y'] }]), { status: 404 });
});

// ---------------------------------------------------------------- composants imbriqués et chargement différé
class Child extends Component {
    owner = '';
    loaded = false;
    mount(params: Record<string, unknown>) { this.loaded = true; this.owner = String(params.owner ?? ''); }
    hello() { return 'bonjour'; }
    placeholder() { return '<div class="attente"></div>'; }
    render() { return `<div class="enfant">${this.owner}</div>`; }
}
class Parent extends Component {
    tab = 'a';
    lazy = false;
    async render() { return `<section>${await this.mountChild('child', { owner: this.tab }, `enfant.${this.tab}`, { lazy: this.lazy })}</section>`; }
}
const nested = new WireRuntime({ key: 'test-key' }).register('child', Child).register('parent', Parent);
const snapshots = (html: string): Snapshot[] => [...html.matchAll(/wire:snapshot="([^"]+)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')));

test('composants imbriqués : l\'enfant est rendu dans le parent, qui le déclare dans memo.children', async () => {
    const html = await nested.mount('parent');
    const [parent, child] = snapshots(html);
    assert.match(html, /<section[^>]*><div wire:key="enfant\.a" wire:snapshot=/);
    assert.equal(child.memo.name, 'child');
    assert.equal(child.data.owner, 'a');
    assert.deepEqual(parent.memo.children, { 'enfant.a': ['div', child.memo.id] });
});

test('composants imbriqués : au re-rendu, un enfant déjà présent devient une souche, un nouvel enfant est monté', async () => {
    const [parent, child] = snapshots(await nested.mount('parent'));
    const same = await nested.update(parent, {}, [{ method: '$refresh', params: [] }]);
    assert.equal(same.effects.html!.includes(`<div wire:id="${child.memo.id}" wire:name="child" wire:key="enfant.a"></div>`), true);
    assert.equal(same.effects.html!.includes('wire:snapshot'), false);
    const other = await nested.update(same.snapshot, { tab: 'b' }, []);
    assert.match(other.effects.html!, /wire:key="enfant\.b" wire:snapshot=/);
    assert.deepEqual(Object.keys(other.snapshot.memo.children), ['enfant.b']);
});

test('composants imbriqués : une entrée memo.children forgée ne peut pas injecter de HTML', async () => {
    const [parent] = snapshots(await nested.mount('parent'));
    parent.memo.children = { 'enfant.a': ['div onload=alert(1)', 'x"><script>'] };
    const { effects } = await nested.update(parent, {}, [{ method: '$refresh', params: [] }]);
    assert.equal(effects.html!.includes('<script'), false);
    assert.equal(effects.html!.includes('onload'), false);
    assert.match(effects.html!, /wire:key="enfant\.a" wire:snapshot=/);
});

test('chargement différé : placeholder d\'abord, puis __lazyLoad monte et rend le composant', async () => {
    const [parent] = snapshots(await nested.mount('parent'));
    const { effects } = await nested.update(parent, { lazy: true, tab: 'z' }, []);
    const html = effects.html!;
    assert.match(html, /class="attente"/);
    const [child] = snapshots(html);
    assert.equal(child.memo.lazyLoaded, false);
    assert.equal(child.data.loaded, false);
    const payload = /__lazyLoad\(&#039;([^&]+)&#039;\)/.exec(html)![1];
    await assert.rejects(nested.update(child, {}, [{ method: 'hello', params: [] }]), /non chargé/);
    const loaded = await nested.update(child, {}, [{ method: '__lazyLoad', params: [payload] }]);
    assert.equal(loaded.effects.html!.includes('class="enfant">z</div>'), true);
    assert.equal(loaded.snapshot.memo.lazyLoaded, true);
    assert.equal(loaded.snapshot.data.loaded, true);
    await assert.rejects(nested.update(loaded.snapshot, {}, [{ method: '__lazyLoad', params: [payload] }]), /n'attend pas/);
});

test('chargement différé : des paramètres de montage modifiés ou destinés à un autre composant sont refusés', async () => {
    const [parent] = snapshots(await nested.mount('parent'));
    const html = (await nested.update(parent, { lazy: true, tab: 'y' }, [])).effects.html!;
    const [child] = snapshots(html);
    const payload = /__lazyLoad\(&#039;([^&]+)&#039;\)/.exec(html)![1];
    const container = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    container.data.forMount[0].owner = 'pirate';
    const forged = Buffer.from(JSON.stringify(container)).toString('base64');
    await assert.rejects(nested.update(child, {}, [{ method: '__lazyLoad', params: [forged] }]), /Somme de contrôle/);
    await assert.rejects(nested.update(child, {}, [{ method: '__lazyLoad', params: ['pas-du-base64-json'] }]));
});

test('update : un chemin d\'état ne peut pas viser le prototype des objets', async () => {
    const s = snapshotOf(await runtime.mount('counter', {}));
    for (const path of ['tags.__proto__.pollue', 'tags.constructor.prototype.pollue', 'tags.prototype.x']) await assert.rejects(runtime.update(s, { [path]: 1 }, []), /Chemin d'état refusé/);
    assert.equal(({} as any).pollue, undefined);
});
