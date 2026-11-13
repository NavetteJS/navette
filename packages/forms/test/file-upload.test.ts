import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { FileUpload, LocalFileStorage, getSchemaState, readImageSize, safeStorageName, useColorManager, validateSchema, type TemporaryUpload } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });

const dir = mkdtempSync(path.join(tmpdir(), 'navette-upload-'));
after(() => rmSync(dir, { recursive: true, force: true }));
/** PNG header with the given size, padded to `bytes`. */
function png(name: string, width: number, height: number, bytes = 100): TemporaryUpload {
    const buffer = Buffer.alloc(Math.max(bytes, 33));
    buffer.writeUInt32BE(0x89504e47, 0); buffer.writeUInt32BE(0x0d0a1a0a, 4); buffer.writeUInt32BE(13, 8); buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16); buffer.writeUInt32BE(height, 20);
    const file = path.join(dir, `${name}-${width}x${height}.tmp`);
    writeFileSync(file, buffer);
    return { id: `${name}${width}${height}`, path: file, name, type: 'image/png', size: buffer.length, extension: 'png' };
}
const host = (data: Record<string, unknown>, files: TemporaryUpload[]) => ({
    id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {},
    _runtime: { uploads: { resolve: (value: unknown) => files.find((file) => `livewire-file:${file.id}` === value) ?? null, remove() {} } },
});
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record as any).components(components);

test('readImageSize() reads PNG, GIF and JPEG headers', () => {
    assert.deepEqual(readImageSize(png('a', 800, 600).path), { width: 800, height: 600 });
    const gif = path.join(dir, 'x.gif');
    writeFileSync(gif, Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x10, 0x00, 0, 0]));
    assert.deepEqual(readImageSize(gif), { width: 32, height: 16 });
    const jpeg = path.join(dir, 'x.jpg');
    writeFileSync(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03, 0, 0, 0, 0]));
    assert.deepEqual(readImageSize(jpeg), { width: 400, height: 300 });
    writeFileSync(path.join(dir, 'x.txt'), 'hello');
    assert.equal(readImageSize(path.join(dir, 'x.txt')), null);
});

test('image dimensions, aspect ratio and minimum size are checked on new uploads', async () => {
    const small = png('small', 400, 300, 50), wide = png('wide', 1600, 900, 4000);
    const check = async (field: FileUpload, file: TemporaryUpload) => validateSchema(form(host({ photo: { k: `livewire-file:${file.id}` } }, [small, wide]), [field]));
    assert.deepEqual(await check(FileUpload.make('photo').image().imageDimensions({ minWidth: 800 }), small), { 'data.photo': ['The photo field has invalid image dimensions.'] });
    assert.deepEqual(await check(FileUpload.make('photo').image().imageDimensions({ minWidth: 800, maxRatio: 2 }), wide), {});
    assert.deepEqual(await check(FileUpload.make('photo').image().imageAspectRatio(['1:1', '16:9']), wide), {});
    assert.deepEqual(await check(FileUpload.make('photo').image().imageAspectRatio('16:9'), small), { 'data.photo': ['The photo field has invalid image dimensions.'] });
    assert.deepEqual(await check(FileUpload.make('photo').minSize(1), small), { 'data.photo': ['The photo field must be at least 1 kilobytes.'] });
});

test('file names: preserved and sanitized, never overwritten, original names stored apart', async () => {
    assert.equal(safeStorageName('../../evil.php', 'png'), 'evil.png');
    assert.equal(safeStorageName('my report.final.pdf', 'pdf'), 'my-report-final.pdf');
    const storage = new LocalFileStorage(path.join(dir, 'store'), '/files');
    const first = png('Holiday photo.png', 10, 10), second = png('Holiday photo.png', 20, 20);
    const livewire = host({ photos: { a: `livewire-file:${first.id}`, b: `livewire-file:${second.id}` } }, [first, second]);
    const schema = form(livewire, [FileUpload.make('photos').multiple().storage(storage).preserveFilenames().storeFileNamesIn('photo_names')]);
    const state = await getSchemaState(schema) as { photos: string[]; photo_names: Record<string, string> };
    assert.equal(state.photos[0], 'Holiday-photo.png');
    assert.match(state.photos[1], /^Holiday-photo-[0-9a-f]{8}\.png$/);
    assert.deepEqual(state.photo_names, { [state.photos[0]]: 'Holiday photo.png', [state.photos[1]]: 'Holiday photo.png' });
    assert.equal(readdirSync(path.join(dir, 'store')).filter((file) => file.endsWith('.png')).length, 2);
});

test('deletable(false) keeps saved files; editor and avatar options reach the browser', async () => {
    const livewire = host({ doc: { k: 'docs/a.pdf' } }, []);
    const field = FileUpload.make('doc').deletable(false);
    form(livewire, [field], { doc: 'docs/a.pdf' });
    field.removeUploadedFile('k');
    assert.deepEqual(livewire.data.doc, { k: 'docs/a.pdf' });
    const html = await form(host({}, []), [FileUpload.make('avatar').avatar().imageEditor().imageEditorAspectRatioOptions(['16:9', '1:1', null]).circleCropper().downloadable().openable()]).toHtml();
    assert.match(html, /isAvatar: true/);
    assert.match(html, /hasImageEditor: true/);
    assert.match(html, /isDownloadable: true/);
    assert.match(html, /fi-fo-file-upload-avatar fi-align-center/);
    assert.match(html, /class="fi-fo-file-upload-editor fi-fo-file-upload-editor-circle-cropper"/);
    assert.match(html, />16:9<\/button>/);
});

test('deletable(false) keeps a saved file the browser dropped from the state', async () => {
    const livewire = host({ doc: {} }, []);
    const schema = form(livewire, [FileUpload.make('doc').deletable(false).storage(new LocalFileStorage(path.join(dir, 'kept'), '/files'))], { doc: 'docs/a.pdf' });
    assert.deepEqual(await getSchemaState(schema), { doc: 'docs/a.pdf' });
});
