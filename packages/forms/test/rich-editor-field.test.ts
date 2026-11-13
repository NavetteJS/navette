import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { LocalFileStorage, RichEditor, getSchemaState, useColorManager, type TemporaryUpload } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });
const dir = mkdtempSync(path.join(tmpdir(), 'navette-rich-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const host = (data: Record<string, unknown>, files: TemporaryUpload[] = []) => ({
    id: 'lw', _errors: {} as Record<string, string[]>, data, componentFileAttachments: {} as Record<string, unknown>, getSchema() { return null as any; }, dispatch() {},
    _runtime: { uploads: { resolve: (value: unknown) => files.find((file) => `livewire-file:${file.id}` === value) ?? null, remove() {} } },
});
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const tools = (html: string) => [...html.matchAll(/data-rich-editor-tool="([A-Za-z0-9]+)"/g)].map((match) => match[1]).filter((tool) => !/^(grid|table[A-Z])/.test(tool));
const groups = (html: string) => html.slice(html.indexOf('data-rich-editor-toolbar="main"'), html.indexOf('x-show="isUploadingFile"')).split('fi-fo-rich-editor-toolbar-group').length - 1;

test('RichEditor: toolbar buttons, disabled buttons, placeholder', async () => {
    const html = await form(host({ body: '' }), [RichEditor.make('body').toolbarButtons([['bold', 'italic', 'link'], ['undo', 'redo']]).disableToolbarButtons(['italic']).placeholder('Write something')]).toHtml();
    assert.deepEqual(tools(html), ['bold', 'link', 'undo', 'redo']);
    assert.equal(groups(html), 2);
    assert.match(html, /placeholder: 'Write something',/);
    // Without storage, the attach button is removed.
    const full = await form(host({ body: '' }), [RichEditor.make('body')]).toHtml();
    assert.equal(tools(full).includes('attachFiles'), false);
    assert.match(full, /canAttachFiles: false/);
    assert.throws(() => RichEditor.make('body').toolbarButtons([['bold', 'rainbow']]), /unknown toolbar buttons rainbow/);
});

test('RichEditor: json() stores the document', async () => {
    const livewire = host({});
    const schema = form(livewire, [RichEditor.make('body').json()]);
    const field = schema.getFlatComponents()[0] as RichEditor;
    livewire.data.body = field.hydrateState('<p>Hello <strong>world</strong><script>x()</script></p>');
    const saved = (await getSchemaState(schema)).body as any;
    assert.equal(saved.type, 'doc');
    assert.equal(JSON.stringify(saved).includes('script'), false);
    assert.equal(JSON.stringify(field.hydrateState(JSON.stringify(saved))), JSON.stringify(saved));
});

test('RichEditor: attachments are checked, stored and given a URL', async () => {
    const png = path.join(dir, 'a.tmp');
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const pdf = path.join(dir, 'b.tmp');
    writeFileSync(pdf, '%PDF-1.4');
    const files: TemporaryUpload[] = [{ id: 'img1', path: png, name: 'a.png', type: 'image/png', size: 8, extension: 'png' }, { id: 'doc1', path: pdf, name: 'b.pdf', type: 'application/pdf', size: 8, extension: 'pdf' }];
    const livewire = host({ body: '' }, files);
    livewire.componentFileAttachments = { data: { body: { up1: 'livewire-file:img1', up2: 'livewire-file:doc1' } } };
    const storage = new LocalFileStorage(path.join(dir, 'store'), '/files');
    const schema = form(livewire, [RichEditor.make('body').fileAttachmentsStorage(storage).fileAttachmentsDirectory('editor')]);
    const field = schema.getFlatComponents()[0] as RichEditor;
    assert.match(String(await field.getUploadedFileAttachmentTemporaryUrl({ attachment: 'up1' })), /^\/files\/editor\/[0-9a-f-]+\.png$/);
    assert.equal(await field.getUploadedFileAttachmentTemporaryUrl({ attachment: 'up2' }), null);
    assert.equal(await field.getUploadedFileAttachmentTemporaryUrl({ attachment: '../x' }), null);
    // Used once: the reference is consumed.
    assert.equal(await field.getUploadedFileAttachmentTemporaryUrl({ attachment: 'up1' }), null);
    assert.match(await schema.toHtml(), /canAttachFiles: true/);
});

test('MarkdownEditor: attach button only with a storage; the uploaded image is stored once', async () => {
    const { MarkdownEditor } = await import('../src/index.ts');
    const png = path.join(dir, 'm.tmp');
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const livewire = host({ notes: '' }, [{ id: 'md1', path: png, name: 'm.png', type: 'image/png', size: 8, extension: 'png' }]);
    livewire.componentFileAttachments = { data: { notes: 'livewire-file:md1' } };
    assert.match(await form(host({ notes: '' }), [MarkdownEditor.make('notes')]).toHtml(), /canAttachFiles: false/);
    const schema = form(livewire, [MarkdownEditor.make('notes').fileAttachmentsStorage(new LocalFileStorage(path.join(dir, 'md'), '/md'))]);
    assert.match(await schema.toHtml(), /canAttachFiles: true/);
    const field = schema.getFlatComponents()[0] as any;
    assert.match(String(await field.saveUploadedFileAttachmentAndGetUrl()), /^\/md\/[0-9a-f-]+\.png$/);
    assert.equal(await field.saveUploadedFileAttachmentAndGetUrl(), null);
});
