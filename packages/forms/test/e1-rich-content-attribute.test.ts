import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { t as translate, tc } from '@navette-js/support/i18n';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';
import { TextColumn, useColorManager as useTablesColorManager } from '@navette-js/tables';
import {
    InteractsWithRichContent, LocalFileStorage, RichContentCustomBlock, RichContentRenderer, RichEditor, StorageFileAttachmentProvider,
    getRichContentAttribute, getSchemaState, saveSchemaRelationships, useColorManager, type FileAttachmentProvider, type TemporaryUpload,
} from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors); useActionsColorManager(colors); useSchemasColorManager(colors); useTablesColorManager(colors);
views.share({ t: translate, tc, assetUrl: (file: string) => `/${file}` });
const dir = mkdtempSync(path.join(tmpdir(), 'navette-rich-attribute-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const png = path.join(dir, 'a.tmp');
writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const host = (data: Record<string, unknown>, files: TemporaryUpload[] = []) => ({
    id: 'lw', _errors: {} as Record<string, string[]>, data, componentFileAttachments: {} as Record<string, unknown>, getSchema() { return null as any; }, dispatch() {},
    _runtime: { uploadPrefix: '/livewire', uploads: { resolve: (value: unknown) => files.find((file) => `livewire-file:${file.id}` === value) ?? null, remove() {}, temporaryUrl: (id: string, prefix: string) => `${prefix}/preview-file/${id}` } },
});
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record).components(components);

class Banner extends RichContentCustomBlock {
    static getId() { return 'banner'; }
    static getLabel() { return 'Banner'; }
    static toHtml(config: Record<string, unknown>) { return `<p class="banner">${String(config.text ?? '')}</p>`; }
}
class Base { id = 1; content: unknown = null; }
class Post extends InteractsWithRichContent(Base) {
    author = 'Ada';
    setUpRichContent(): void {
        this.registerRichContent('content')
            .customBlocks([Banner])
            .mergeTags({ author: () => this.author })
            .mergeTagLabels({ author: 'Author' })
            .linkProtocols(['https']);
    }
}
const CONTENT = '<p>By <span data-type="mergeTag" data-id="author"></span></p><div data-type="customBlock" data-id="banner" data-config="{&quot;text&quot;:&quot;Hello&quot;}"></div>';

test('`InteractsWithRichContent`: registered attributes, `renderRichContent()`, nothing stored on the record', async () => {
    const post = Object.assign(new Post(), { content: CONTENT });
    assert.equal(post.hasRichContentAttribute('content'), true);
    assert.equal(post.hasRichContentAttribute('title'), false);
    assert.equal(getRichContentAttribute(post, 'content'), post.getRichContentAttribute('content'));
    assert.equal(getRichContentAttribute({ content: 'x' }, 'content'), null);
    assert.deepEqual(Object.keys(post).sort(), ['author', 'content', 'id']);
    const html = await post.renderRichContent('content');
    assert.match(html, /By Ada/);
    assert.match(html, /<p class="banner">Hello<\/p>/);
    assert.equal(await Object.assign(new Post(), { content: '<p></p>' }).renderRichContent('content'), '');
    assert.equal(await post.getRichContentAttribute('content')!.toText(), 'By Ada\n\nHello');
});

test('`TextEntry` and `TextColumn` render a registered rich content attribute', async () => {
    const post = Object.assign(new Post(), { content: CONTENT });
    const entry = await Schema.make(host({})).key('infolist').record(post).components([TextEntry.make('content')]).toHtml();
    assert.match(entry, /class="nv-in-text-item nv-prose[^"]*">\s*<p>By Ada<\/p>/);
    // Sanitized like any HTML state (as Filament's `Str::sanitizeHtml()`): the block's markup keeps its content.
    assert.match(entry, /<p>By Ada<\/p><p>Hello<\/p>/);
    const cell = await TextColumn.make('content').toHtml(post);
    assert.match(cell, /By Ada/);
    assert.match(cell, /<p>Hello<\/p>/);
    assert.doesNotMatch(cell, /&lt;p&gt;/);
    // An explicit state() wins; an empty attribute shows the placeholder.
    assert.match(await TextColumn.make('content').state(() => 'plain').toHtml(post), />plain</);
    assert.match(await TextColumn.make('content').placeholder('None').toHtml(Object.assign(new Post(), { content: '' })), /None/);
});

test('`RichEditor`: unset options default to the record\'s registered attribute', async () => {
    const post = Object.assign(new Post(), { content: CONTENT });
    const editor = RichEditor.make('content');
    form(host({}), [editor], post);
    assert.deepEqual(editor.getMergeTags(), { author: 'Author' });
    assert.deepEqual(editor.getCustomBlocks(), [Banner]);
    assert.deepEqual(editor.getLinkProtocols(), ['https']);
    const own = RichEditor.make('content').mergeTags(['other']);
    form(host({}), [own], post);
    assert.deepEqual(own.getMergeTags(), { other: 'other' });
    const unregistered = RichEditor.make('content');
    form(host({}), [unregistered], { content: '' });
    assert.deepEqual(unregistered.getCustomBlocks(), []);
});

test('`StorageFileAttachmentProvider`: stores per record, serves only its ids, cleans up removed files', async () => {
    const storage = new LocalFileStorage(path.join(dir, 'store'), '/files');
    const provider = StorageFileAttachmentProvider.make(storage).directory((record: any) => `posts/${record.id}`);
    const record = { id: 7, body: '' };
    const livewire = host({ body: '' }, [{ id: 'img1', path: png, name: 'a.png', type: 'image/png', size: 8, extension: 'png' }]);
    livewire.componentFileAttachments = { data: { body: { up1: 'livewire-file:img1' } } };
    const schema = form(livewire, [RichEditor.make('body').fileAttachmentProvider(provider)], record);
    const field = schema.getFlatComponents()[0] as RichEditor;
    assert.match(await schema.toHtml(), /canAttachFiles: true/);
    livewire.data.body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { id: 'up1', src: '/livewire/preview-file/img1' } }] }] };
    const saved = String((await getSchemaState(schema)).body);
    const key = /data-id="(posts\/7\/[^"]+\.png)"/.exec(saved)?.[1];
    assert.ok(key, saved);
    assert.match(saved, new RegExp(`src="/files/${key}"`));
    assert.equal(storage.exists(key!), true);
    assert.equal(await field.getFileAttachmentUrl(key!), `/files/${key}`);
    // Another record's file, or a path escaping the directory, has no URL.
    assert.equal(await field.getFileAttachmentUrl(key!.replace('posts/7/', 'posts/8/')), null);
    assert.equal(await field.getFileAttachmentUrl('posts/7/../8/x.png'), null);
    // The renderer serves the record's ids through the provider.
    const rendered = await RichContentRenderer.make(saved.replace(/ src="[^"]*"/, '')).fileAttachmentProvider(provider, record, 'body').toHtml();
    assert.match(rendered, new RegExp(`src="/files/${key}"`));
    // Saved again without the image: the file is deleted.
    record.body = saved;
    const edit = host({ body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'No image' }] }] } });
    await getSchemaState(form(edit, [RichEditor.make('body').fileAttachmentProvider(provider)], record));
    assert.equal(storage.exists(key!), false);
});

test('a provider requiring the record: the content is saved after the record is created', async () => {
    const storage = new LocalFileStorage(path.join(dir, 'create'), '/files');
    const provider: FileAttachmentProvider = StorageFileAttachmentProvider.make(storage);
    const livewire = host({ body: '' }, [{ id: 'img2', path: png, name: 'b.png', type: 'image/png', size: 8, extension: 'png' }]);
    livewire.componentFileAttachments = { data: { body: { up2: 'livewire-file:img2' } } };
    livewire.data.body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }, { type: 'image', attrs: { id: 'up2', src: '/livewire/preview-file/img2' } }] }] };
    const schema = form(livewire, [RichEditor.make('body').fileAttachmentProvider(provider)]);
    const field = schema.getFlatComponents()[0] as RichEditor;
    assert.equal(await field.saveUploadedFileAttachmentAndGetUrl({ attachment: 'up2' }), null, 'no record yet');
    assert.deepEqual(await getSchemaState(schema), {});
    const created: Record<string, unknown> = { id: 9, body: null };
    await saveSchemaRelationships(schema, created);
    assert.match(String(created.body), /<p>Hi<\/p><img[^>]*data-id="rich-content\/body\/9\/[^"]+\.png"/);
});
