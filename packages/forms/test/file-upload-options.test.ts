import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { FileUpload, LocalFileStorage, getSchemaState, safeFileUrl, useColorManager, validateSchema, type FileStorage, type TemporaryUpload } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

const dir = mkdtempSync(path.join(tmpdir(), 'navette-upload-options-'));
after(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
function upload(name = 'a.png'): TemporaryUpload {
    const id = `t${++counter}`;
    const file = path.join(dir, id);
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 10, 0, 0, 0, 10]));
    return { id, path: file, name, type: 'image/png', size: 24, extension: 'png' };
}
const host = (data: Record<string, unknown>, files: TemporaryUpload[] = []) => ({
    id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {},
    _runtime: { uploads: { resolve: (value: unknown) => files.find((file) => `livewire-file:${file.id}` === value) ?? null, remove() {} } },
});
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record as any).components(components);

test('safeFileUrl() keeps local and http(s) URLs only', () => {
    assert.equal(safeFileUrl('/storage/a b.png'), '/storage/a%20b.png');
    assert.equal(safeFileUrl('https://cdn.example.com/a.png?x=1'), 'https://cdn.example.com/a.png?x=1');
    for (const url of ['//evil.example/a', '/\\evil.example', '/\t/evil.example', 'javascript:alert(1)', 'data:text/html,x', 'https:///a', 'storage/a.png', '', null, 42]) assert.equal(safeFileUrl(url), null, String(url));
});

test('setters accept functions of the field context', async () => {
    const livewire = host({ kind: 'many', files: { a: 'x/1.png', b: 'x/2.png', c: 'x/3.png' } });
    const field = FileUpload.make('files')
        .multiple(({ get }) => get('kind') === 'many')
        .maxFiles(({ get }) => (get('kind') === 'many' ? 2 : 1))
        .acceptedFileTypes(async () => ['image/png'])
        .panelLayout(() => 'grid')
        .imageEditorViewportWidth(() => 1920)
        .directory(({ record }) => `users/${(record as { id: number }).id}`);
    const schema = form(livewire, [field], { id: 7, files: ['x/1.png', 'x/2.png', 'x/3.png'] });
    assert.deepEqual(await validateSchema(schema), { 'data.files': ['The files field must not have more than 2 items.'] });
    const html = await schema.toHtml();
    assert.match(html, /isMultiple: true/);
    assert.match(html, /maxFiles: 2,/);
    assert.match(html, /panelLayout: &#039;grid&#039;/);
    assert.match(html, /imageEditorViewportWidth: &#039;1920&#039;/);
    assert.match(html, /acceptedFileTypes: JSON\.parse\(&#039;\[\\u0022image/);
    assert.equal(await field.getDirectory(), 'users/7');
});

test('minFiles() fails below the count, like Laravel\'s min rule on a list', async () => {
    const check = (state: Record<string, string>) => validateSchema(form(host({ files: state }), [FileUpload.make('files').multiple().minFiles(2)], { files: Object.values(state) }));
    assert.deepEqual(await check({ a: 'x/1.png' }), { 'data.files': ['The files field must have at least 2 items.'] });
    assert.deepEqual(await check({}), { 'data.files': ['The files field must have at least 2 items.'] });
    assert.deepEqual(await check({ a: 'x/1.png', b: 'x/2.png' }), {});
});

test('a forged stored key fails validation and is dropped; allowFilePathUsing approves other keys', async () => {
    const livewire = host({ doc: { a: 'other-user/secret.pdf' } });
    assert.deepEqual(await validateSchema(form(livewire, [FileUpload.make('doc')], { doc: 'mine.pdf' })), { 'data.doc': ['The doc field contains a file path that is not permitted.'] });
    const storage = new LocalFileStorage(path.join(dir, 'templates'), '/files');
    const field = () => FileUpload.make('doc').storage(storage).preventFilePathTampering(true, (file) => file === 'templates/default.pdf');
    const approved = form(host({ doc: { a: 'templates/default.pdf' } }), [field()], null);
    assert.deepEqual(await validateSchema(approved), {});
    assert.deepEqual(await getSchemaState(approved), { doc: 'templates/default.pdf' });
    const refused = form(host({ doc: { a: 'templates/../secret.pdf' } }), [field()], null);
    assert.deepEqual(await getSchemaState(refused), { doc: null });
    assert.throws(() => FileUpload.make('doc').preventFilePathTampering(false), /cannot be turned off/);
});

test('moveFiles() moves the temporary file into the storage', async () => {
    const storage = new LocalFileStorage(path.join(dir, 'moved'), '/files');
    const copied = upload(), moved = upload();
    const save = (file: TemporaryUpload, field: FileUpload) => getSchemaState(form(host({ photo: { a: `livewire-file:${file.id}` } }, [file]), [field.storage(storage)])) as Promise<{ photo: string }>;
    const kept = await save(copied, FileUpload.make('photo'));
    assert.ok(existsSync(copied.path));
    const state = await save(moved, FileUpload.make('photo').moveFiles(() => true));
    assert.ok(!existsSync(moved.path));
    assert.ok(existsSync(path.join(dir, 'moved', state.photo)));
    assert.notEqual(state.photo, kept.photo);
    // The storage is told it may move the file.
    let options: unknown;
    const spy: FileStorage = { async store(_file, _directory, _name, given) { options = given; return 'k.png'; }, async info() { return null; } };
    const third = upload();
    await getSchemaState(form(host({ photo: { a: `livewire-file:${third.id}` } }, [third]), [FileUpload.make('photo').storage(spy).moveFiles()]));
    assert.deepEqual(options, { move: true });
});

test('fetchFileInformation(false) only sends the URL; open and download URLs are customized and checked', async () => {
    let infoCalls = 0;
    const storage: FileStorage = {
        async store() { return ''; },
        async info(key) { infoCalls++; return { name: key, size: 10, type: 'application/pdf', url: `/files/${key}` }; },
        url: (key) => `/files/${key}`,
    };
    const state = { a: 'docs/a.pdf', b: 'docs/b.pdf' };
    const record = { files: ['docs/a.pdf', 'docs/b.pdf'] };
    const field = FileUpload.make('files').multiple().storage(storage).fetchFileInformation(false).openable().downloadable()
        .getOpenableFileUrlUsing((file) => (file === 'docs/a.pdf' ? `https://signed.example.com/${file}?sig=1` : 'javascript:alert(1)'))
        .getDownloadableFileUrlUsing((file, { record }) => (record ? `/download/${file}` : null));
    form(host({ files: state }), [field], record);
    const files = await field.getUploadedFiles();
    assert.equal(infoCalls, 0);
    assert.deepEqual(files.a, { name: 'a.pdf', size: 0, type: null, url: '/files/docs/a.pdf', openableUrl: 'https://signed.example.com/docs/a.pdf?sig=1', downloadableUrl: '/download/docs/a.pdf' });
    // An unsafe URL is ignored: the button uses the file's URL.
    assert.equal(files.b?.openableUrl, undefined);
    assert.equal(files.b?.downloadableUrl, '/download/docs/b.pdf');
    // Without openable(), the callback is not used.
    const plain = FileUpload.make('files').multiple().storage(storage).getOpenableFileUrlUsing(() => '/x');
    form(host({ files: state }), [plain], record);
    assert.equal((await plain.getUploadedFiles()).a?.openableUrl, undefined);
    assert.equal(infoCalls, 1 + 1);
});

test('automaticallyOpenImageEditorForAspectRatio() needs a single imageAspectRatio() and opens a crop-only editor', async () => {
    const render = (field: FileUpload) => form(host({}), [field]).toHtml();
    const html = await render(FileUpload.make('banner').image().imageAspectRatio('16:9').automaticallyOpenImageEditorForAspectRatio());
    assert.match(html, /automaticallyOpenImageEditorForAspectRatio: 1\.7777/);
    assert.match(html, /hasImageEditor: true/);
    assert.match(html, /isImageEditorExplicitlyEnabled: false/);
    assert.match(html, /fi-fo-file-upload-editor-crop-only/);
    assert.match(await render(FileUpload.make('banner').image().imageAspectRatio('16:9')), /automaticallyOpenImageEditorForAspectRatio: null/);
    await assert.rejects(render(FileUpload.make('banner').image().automaticallyOpenImageEditorForAspectRatio()), /requires \[imageAspectRatio\(\)\]/);
    await assert.rejects(render(FileUpload.make('banner').image().imageAspectRatio(['16:9', '1:1']).automaticallyOpenImageEditorForAspectRatio()), /multiple allowed aspect ratios/);
    await assert.rejects(render(FileUpload.make('banner').multiple().image().imageAspectRatio('16:9').automaticallyOpenImageEditorForAspectRatio()), /\[multiple\(\)\] is enabled/);
});
