import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { Component, UploadStore, WireError, WireRuntime } from '../src/index.ts';

const dir = mkdtempSync(path.join(tmpdir(), 'navette-uploads-'));
const store = new UploadStore(dir, 'test-key', { maxFileSize: 1024 });

/** Requête multipart minimale, comme l'envoie le navigateur. */
function multipart(files: { name: string; content: Buffer }[]): any {
    const boundary = '----navette';
    const body = Buffer.concat([...files.flatMap((file) => [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files[]"; filename="${file.name}"\r\nContent-Type: image/jpeg\r\n\r\n`), file.content, Buffer.from('\r\n')]), Buffer.from(`--${boundary}--\r\n`)]);
    return Object.assign(Readable.from([body]), { headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) } });
}
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

test('adresse signée : acceptée, puis refusée si modifiée ou expirée', () => {
    const url = new URL(store.signedUrl(), 'http://x');
    assert.ok(store.verifySignature(url.searchParams.get('expires'), url.searchParams.get('signature')));
    assert.equal(store.verifySignature(Number(url.searchParams.get('expires')) + 1, url.searchParams.get('signature')), false);
    assert.equal(store.verifySignature(Date.now() - 1000, url.searchParams.get('signature')), false);
    assert.equal(store.verifySignature('abc', 'def'), false);
});

test('réception : le type vient du contenu, pas du nom ni du type annoncé', async () => {
    const [real, fake] = await store.receive(multipart([{ name: 'photo.jpg', content: JPEG }, { name: 'faux.jpg', content: Buffer.from('<script>alert(1)</script>') }]));
    assert.equal(store.resolve(real)?.type, 'image/jpeg');
    assert.equal(store.resolve(real)?.name, 'photo.jpg');
    assert.equal(store.resolve(fake)?.type, 'application/octet-stream');
    assert.equal(store.resolve(fake)?.extension, 'bin');
    assert.equal(store.resolve(`livewire-file:${real}`)?.id, real);
});

test('réception : fichier trop volumineux refusé et effacé', async () => {
    await assert.rejects(store.receive(multipart([{ name: 'gros.jpg', content: Buffer.concat([JPEG, Buffer.alloc(4096)]) }])), /volumineux/);
});

test('resolve : identifiants forgés et traversée de dossier refusés', () => {
    writeFileSync(path.join(dir, '..', 'secret'), 'x');
    for (const forged of ['../secret', 'livewire-file:../secret', 'livewire-file:' + 'z'.repeat(32), '', null, { id: 'x' }, 'a'.repeat(32)]) assert.equal(store.resolve(forged), null);
});

class Form extends Component {
    data: Record<string, unknown> = { photo: null };
    render() { return '<div></div>'; }
}
const runtime = new WireRuntime({ key: 'test-key', uploads: store }).register('form', Form);
const snapshotOf = (html: string) => JSON.parse(/wire:snapshot="([^"]*)"/.exec(html)![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

test('_startUpload puis _finishUpload : la propriété reçoit la référence du fichier reçu', async () => {
    const snapshot = snapshotOf(await runtime.mount('form'));
    const started = await runtime.update(snapshot, {}, [{ method: '_startUpload', params: ['data.photo', [{ name: 'a.jpg', size: 12, type: 'image/jpeg' }], false] }]);
    assert.match((started.effects.dispatches as any)[0].params.url, /^\/livewire\/upload-file\?expires=\d+&signature=[a-f0-9]{64}$/);
    const [id] = await store.receive(multipart([{ name: 'a.jpg', content: JPEG }]));
    const finished = await runtime.update(started.snapshot, {}, [{ method: '_finishUpload', params: ['data.photo', [id], false] }]);
    assert.deepEqual((finished.snapshot.data.data as any)[0].photo, `livewire-file:${id}`);
    // Le navigateur peut renvoyer cette référence (état entrelacé), mais pas une référence inventée.
    await runtime.update(finished.snapshot, { 'data.photo': `livewire-file:${id}` }, []);
    await assert.rejects(runtime.update(finished.snapshot, { 'data.photo': `livewire-file:${'0'.repeat(32)}` }, []), (error: WireError) => error.status === 403);
    await assert.rejects(runtime.update(finished.snapshot, { data: { nested: { photo: 'livewire-files:["x"]' } } }, []), (error: WireError) => error.status === 403);
    await assert.rejects(runtime.update(finished.snapshot, {}, [{ method: '_finishUpload', params: ['data.photo', ['0'.repeat(32)], false] }]), (error: WireError) => error.status === 404);
    await assert.rejects(runtime.update(finished.snapshot, {}, [{ method: '_finishUpload', params: ['__proto__.polluted', [id], false] }]), WireError);
});

class Child extends Component {
    static reactive = ['search'];
    search = '';
    other = 'x';
    render() { return `<div>${this.search}</div>`; }
}
class Parent extends Component {
    search = '';
    async render() { return `<div>${await this.mountChild('child', { search: this.search }, 'child-key')}</div>`; }
}
const nested = new WireRuntime({ key: 'test-key' }).register('child', Child).register('parent', Parent);

test('propriétés réactives : fixées par le parent dans la même requête, jamais par le navigateur', async () => {
    const html = await nested.mount('parent');
    const snapshots = [...html.matchAll(/wire:snapshot="([^"]*)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    const parent = snapshots.find((s) => JSON.parse(s).memo.name === 'parent')!, child = snapshots.find((s) => JSON.parse(s).memo.name === 'child')!;
    assert.deepEqual(JSON.parse(child).memo.props, ['search']);
    const response = await nested.handle({ components: [{ snapshot: parent, updates: { search: 'alpine' }, calls: [] }, { snapshot: child, updates: {}, calls: [] }] });
    assert.equal(JSON.parse(response.components[1].snapshot).data.search, 'alpine');
    assert.match(String(response.components[1].effects.html), />alpine</);
    await assert.rejects(nested.handle({ components: [{ snapshot: child, updates: { search: 'forgé' }, calls: [] }] }), (error: WireError) => error.status === 403);
    // Une propriété ordinaire de l'enfant reste modifiable.
    await nested.handle({ components: [{ snapshot: child, updates: { other: 'y' }, calls: [] }] });
});
