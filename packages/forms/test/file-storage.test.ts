import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ColorManager, signFileUrl, temporaryFileUrlExpiry, verifyFileUrlSignature, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { FileUpload, LocalFileStorage, getSchemaState, useColorManager, type FileStorage, type TemporaryUpload } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

const KEY = 'test-application-key-0123456789';
const dir = mkdtempSync(path.join(tmpdir(), 'navette-file-storage-'));
after(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
function upload(name = 'doc.pdf'): TemporaryUpload {
    const id = `t${++counter}`;
    const file = path.join(dir, id);
    writeFileSync(file, '%PDF-1.4 test');
    return { id, path: file, name, type: 'application/pdf', size: 13, extension: 'pdf' };
}
const host = (data: Record<string, unknown>, files: TemporaryUpload[] = []) => ({
    id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {},
    _runtime: { uploads: { resolve: (value: unknown) => files.find((file) => `livewire-file:${file.id}` === value) ?? null, remove() {} } },
});
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record as any).components(components);

/** Runs an Express-like handler and collects the answer. */
async function request(handler: ReturnType<LocalFileStorage['serve']>, url: string, method = 'GET') {
    const [pathname, query = ''] = url.split('?');
    const headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    return new Promise<{ status: number; headers: Record<string, string>; body: string }>((resolve) => {
        const res: any = {
            statusCode: 0, setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
            write: (chunk: Buffer) => { chunks.push(Buffer.from(chunk)); return true; },
            end: (chunk?: Buffer) => { if (chunk) chunks.push(Buffer.from(chunk)); resolve({ status: res.statusCode, headers, body: Buffer.concat(chunks).toString() }); },
            on: () => res, once: () => res, emit: () => true, removeListener: () => res,
        };
        handler({ method, path: pathname, query: Object.fromEntries(new URLSearchParams(query)) }, res);
    });
}

test('signatures: bound to the key, the file and the expiry; expired and forged ones are refused', () => {
    const expires = new Date(Date.now() + 60_000);
    const { expires: seconds, signature } = signFileUrl(KEY, 'docs/a.pdf', expires, '/files');
    assert.equal(verifyFileUrlSignature(KEY, 'docs/a.pdf', String(seconds), signature, '/files'), true);
    // Another file, another scope, another key, a later expiry: refused.
    assert.equal(verifyFileUrlSignature(KEY, 'docs/b.pdf', String(seconds), signature, '/files'), false);
    assert.equal(verifyFileUrlSignature(KEY, 'docs/a.pdf', String(seconds), signature, '/other'), false);
    assert.equal(verifyFileUrlSignature('another-application-key-000000', 'docs/a.pdf', String(seconds), signature, '/files'), false);
    assert.equal(verifyFileUrlSignature(KEY, 'docs/a.pdf', String(seconds + 3600), signature, '/files'), false);
    // Expired.
    const past = signFileUrl(KEY, 'docs/a.pdf', Date.now() - 1000, '/files');
    assert.equal(verifyFileUrlSignature(KEY, 'docs/a.pdf', String(past.expires), past.signature, '/files'), false);
    // Malformed values.
    for (const [e, s] of [[undefined, signature], [String(seconds), undefined], ['12abc', signature], [String(seconds), 'x'], [[String(seconds)], signature]] as unknown[][]) {
        assert.equal(verifyFileUrlSignature(KEY, 'docs/a.pdf', e, s, '/files'), false);
    }
    assert.throws(() => signFileUrl('short', 'a', Date.now()), /at least 16/);
    // Filament's expiry: in 30 minutes, at the end of that hour.
    const expiry = temporaryFileUrlExpiry(30, Date.UTC(2026, 0, 1, 10, 45, 0));
    assert.equal(expiry.toISOString(), '2026-01-01T11:59:59.000Z');
});

test('a private LocalFileStorage serves files only behind valid temporary URLs', async () => {
    assert.throws(() => new LocalFileStorage(path.join(dir, 'p0'), '/p', { visibility: 'private' }), /key/);
    const storage = new LocalFileStorage(path.join(dir, 'private'), '/private-files', { visibility: 'private', key: KEY });
    const key = await storage.store(upload('Contract.pdf'), 'contracts');
    assert.equal(storage.visibility, 'private');
    assert.equal(storage.exists(key), true);
    const url = storage.temporaryUrl(key, new Date(Date.now() + 60_000))!;
    assert.match(url, /^\/private-files\/contracts\/[0-9a-f-]+\.pdf\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/);
    // info() and url() give temporary URLs.
    assert.match((await storage.info(key))!.url, /\?expires=\d+&signature=/);
    const handler = storage.serve();
    const relative = url.slice('/private-files'.length);
    const ok = await request(handler, relative);
    assert.equal(ok.status, 200);
    assert.equal(ok.body, '%PDF-1.4 test');
    assert.equal(ok.headers['content-type'], 'application/pdf');
    assert.equal(ok.headers['x-content-type-options'], 'nosniff');
    assert.match(ok.headers['content-security-policy'], /sandbox/);
    assert.match(ok.headers['content-disposition'], /filename="Contract.pdf"/);
    // No signature, a forged one, one for another file, an expired one: 403.
    assert.equal((await request(handler, relative.split('?')[0])).status, 403);
    assert.equal((await request(handler, relative.replace(/signature=[^&]+/, `signature=${'A'.repeat(43)}`))).status, 403);
    const other = await storage.store(upload('Other.pdf'), 'contracts');
    const forOther = storage.temporaryUrl(other, new Date(Date.now() + 60_000))!.split('?')[1];
    assert.equal((await request(handler, `${relative.split('?')[0]}?${forOther}`)).status, 403);
    const expired = storage.temporaryUrl(key, new Date(Date.now() - 1000))!.slice('/private-files'.length);
    assert.equal((await request(handler, expired)).status, 403);
    // A URL signed by another storage key is refused.
    const foreign = new LocalFileStorage(path.join(dir, 'private'), '/private-files', { visibility: 'private', key: 'another-application-key-000000' });
    assert.equal((await request(handler, foreign.temporaryUrl(key, new Date(Date.now() + 60_000))!.slice('/private-files'.length))).status, 403);
    // Path traversal and metadata files: refused before anything is read.
    for (const bad of ['/../secret.txt', '/contracts/..%2F..%2Fsecret.txt', '/%2e%2e/secret.txt', `/${key}.meta.json`, '/contracts/./x.pdf', '/C:%5Cwindows%5Cwin.ini']) {
        assert.ok([403, 404].includes((await request(handler, bad)).status), bad);
    }
    assert.equal(storage.temporaryUrl('../secret.txt'), null);
    assert.equal(storage.url('../secret.txt'), null);
    // HEAD: headers only. Other methods go to the next handler.
    const head = await request(handler, relative, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
});

test('a public LocalFileStorage keeps permanent URLs and can serve its folder', async () => {
    const storage = new LocalFileStorage(path.join(dir, 'public'), '/storage/');
    const key = await storage.store(upload(), 'docs');
    assert.equal(storage.visibility, 'public');
    assert.equal(storage.url(key), `/storage/${key}`);
    assert.throws(() => storage.temporaryUrl(key), /need a key/);
    const served = await request(storage.serve(), `/${key}`);
    assert.equal(served.status, 200);
    assert.equal((await request(storage.serve(), '/docs/missing.pdf')).status, 404);
});

test('delete(): removes the file and its metadata, never outside the storage folder', async () => {
    const root = path.join(dir, 'deletable');
    const storage = new LocalFileStorage(root, '/d');
    const key = await storage.store(upload(), 'docs');
    assert.ok(existsSync(path.join(root, ...key.split('/'))));
    storage.delete(key);
    assert.equal(existsSync(path.join(root, ...key.split('/'))), false);
    assert.equal(existsSync(path.join(root, ...key.split('/')) + '.meta.json'), false);
    // Traversal attempts leave the outside file alone.
    const outside = path.join(dir, 'outside.txt');
    writeFileSync(outside, 'keep me');
    for (const bad of ['../outside.txt', 'docs/../../outside.txt', '/etc/passwd', 'docs/..', '.', '', 'docs\\..\\..\\outside.txt', outside]) storage.delete(bad);
    assert.equal(existsSync(outside), true);
    // A folder is never removed.
    mkdirSync(path.join(root, 'folder'), { recursive: true });
    storage.delete('folder');
    assert.equal(existsSync(path.join(root, 'folder')), true);
    // A symbolic link to an outside folder is not followed (where the system allows creating one).
    try { symlinkSync(dir, path.join(root, 'link'), 'junction'); } catch { return; }
    storage.delete('link/outside.txt');
    assert.equal(existsSync(outside), true);
    assert.equal(storage.exists('link/outside.txt'), false);
});

test('FileUpload.visibility(): private files are shown through temporary URLs', async () => {
    const calls: string[] = [];
    const storage: FileStorage = {
        visibility: 'public',
        async store() { return ''; },
        async info(key) { return { name: key, size: 1, type: 'application/pdf', url: `/files/${key}` }; },
        temporaryUrl(key, expiresAt) { calls.push(key); return `/files/${key}?expires=${Math.floor(expiresAt.getTime() / 1000)}&signature=s`; },
    };
    const record = { file: 'docs/a.pdf' };
    const publicField = FileUpload.make('file').storage(storage);
    form(host({ file: { a: 'docs/a.pdf' } }), [publicField], record);
    assert.equal((await publicField.getUploadedFiles()).a?.url, '/files/docs/a.pdf');
    assert.equal(await publicField.getVisibility(), 'public');
    const privateField = FileUpload.make('file').storage(storage).visibility('private');
    form(host({ file: { a: 'docs/a.pdf' } }), [privateField], record);
    assert.match((await privateField.getUploadedFiles()).a!.url, /^\/files\/docs\/a\.pdf\?expires=\d+&signature=s$/);
    assert.deepEqual(calls, ['docs/a.pdf']);
    // The storage's own visibility is the default.
    const privateStorage = new LocalFileStorage(path.join(dir, 'pv'), '/pv', { visibility: 'private', key: KEY });
    const inherited = FileUpload.make('x').storage(privateStorage);
    form(host({}), [inherited]);
    assert.equal(await inherited.getVisibility(), 'private');
    // The visibility is passed to the storage when storing.
    let options: unknown;
    const spy: FileStorage = { async store(_f, _d, _n, given) { options = given; return 'k.pdf'; }, async info() { return null; } };
    const file = upload();
    await getSchemaState(form(host({ file: { a: `livewire-file:${file.id}` } }, [file]), [FileUpload.make('file').storage(spy).visibility('private')]));
    assert.deepEqual(options, { move: false, visibility: 'private' });
});

test('deleteUploadedFileUsing(): only for files the record holds, enabled and deletable fields', async () => {
    const deleted: string[] = [];
    const storage: FileStorage = { async store() { return ''; }, async info() { return null; }, delete(key) { deleted.push(key); } };
    const make = () => FileUpload.make('files').multiple().storage(storage).deleteUploadedFileUsing(({ file, storage }) => storage?.delete?.(file));
    const record = { files: ['docs/a.pdf', 'docs/b.pdf'] };
    const field = make();
    const livewire = host({ files: { a: 'docs/a.pdf', b: 'docs/b.pdf', forged: '../../etc/passwd', other: 'docs/someone-else.pdf' } });
    form(livewire, [field], record);
    await field.deleteUploadedFile('a');
    assert.deepEqual(deleted, ['docs/a.pdf']);
    assert.deepEqual(Object.keys(livewire.data.files as object), ['b', 'forged', 'other']);
    // Paths the browser made up are removed from the state but never reach the callback.
    await field.deleteUploadedFile('forged');
    await field.deleteUploadedFile('other');
    await field.deleteUploadedFile('missing');
    assert.deepEqual(deleted, ['docs/a.pdf']);
    // deletable(false) and disabled(): nothing is removed or deleted.
    const kept = make().deletable(false);
    const keptHost = host({ files: { b: 'docs/b.pdf' } });
    form(keptHost, [kept], record);
    await kept.deleteUploadedFile('b');
    const disabled = make().disabled();
    const disabledHost = host({ files: { b: 'docs/b.pdf' } });
    form(disabledHost, [disabled], record);
    await disabled.deleteUploadedFile('b');
    assert.deepEqual(deleted, ['docs/a.pdf']);
    assert.deepEqual(Object.keys(keptHost.data.files as object), ['b']);
    assert.deepEqual(Object.keys(disabledHost.data.files as object), ['b']);
    // removeUploadedFile() alone never deletes.
    const plain = make();
    const plainHost = host({ files: { b: 'docs/b.pdf' } });
    form(plainHost, [plain], record);
    await plain.removeUploadedFile('b');
    assert.deepEqual(deleted, ['docs/a.pdf']);
});
