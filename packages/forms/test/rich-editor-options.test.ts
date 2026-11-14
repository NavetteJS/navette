// Rich editor options: dropdown groups and floating toolbars, height and sticky options, link protocols, private attachments
// (temporary URLs, `data-id` tampering), plugins, and the content fakers.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { Mark } from '@tiptap/core';
import { Action } from '@navette-js/actions';
import { ColorManager, js, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { UploadStore } from '@navette-js/wire';
import {
    LocalFileStorage, MarkdownEditor, MentionProvider, RichContentCustomBlock, RichContentRenderer, RichEditor, RichEditorTool, ToolbarButtonGroup,
    getSchemaState, isAllowedLinkUrl, richDocumentToHtml, richHtmlToDocument, useColorManager, validateSchema, type RichContentPlugin, type TemporaryUpload,
} from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });
const dir = mkdtempSync(path.join(tmpdir(), 'navette-rich-options-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const host = (data: Record<string, unknown>, files: TemporaryUpload[] = []) => ({
    id: 'lw', _errors: {} as Record<string, string[]>, data, componentFileAttachments: {} as Record<string, unknown>, getSchema() { return null as any; }, dispatch() {},
    _runtime: { uploadPrefix: '/livewire', uploads: { resolve: (value: unknown) => files.find((file) => `livewire-file:${file.id}` === value) ?? null, remove() {}, temporaryUrl: (id: string, prefix: string) => `${prefix}/preview-file/${id}?signed` } },
});
const form = (livewire: any, components: any[], record: unknown = null) => Schema.make(livewire).key('form').statePath('data').record(record).components(components);
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const image = (attrs: Record<string, unknown>) => ({ type: 'paragraph', content: [{ type: 'image', attrs }] });
const pngFile = (name: string, id: string): TemporaryUpload => {
    const file = path.join(dir, `${name}.tmp`);
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    return { id, path: file, name: `${name}.png`, type: 'image/png', size: 8, extension: 'png' };
};

test('toolbar: dropdown groups (icon, textual buttons), enabled and disabled buttons', async () => {
    const editor = RichEditor.make('body').toolbarButtons([
        ['bold', 'italic'],
        [ToolbarButtonGroup.make('Heading', ['paragraph', 'h1', 'h2']).textualButtons()],
        [ToolbarButtonGroup.make('Alignment', ['alignStart', 'alignCenter', 'alignEnd']).icon('m-bars-3')],
    ]).disableToolbarButtons(['italic', 'alignCenter']).enableToolbarButtons([['undo', 'redo', 'bold']]);
    const html = await form(host({ body: '' }), [editor]).toHtml();
    const toolbar = html.slice(html.indexOf('data-rich-editor-toolbar="main"'), html.indexOf('x-show="isUploadingFile"'));
    assert.equal(toolbar.split('nv-fo-rich-editor-toolbar-group').length - 1, 4);
    assert.match(toolbar, /class="nv-dropdown nv-fo-rich-editor-dropdown-tool nv-fo-rich-editor-dropdown-tool-textual"/);
    assert.match(toolbar, /data-rich-editor-tool="Heading" aria-label="Heading"/);
    assert.match(toolbar, /role="menuitemcheckbox" aria-label="Title"/);
    assert.match(toolbar, /<span>Title<\/span>/);
    assert.match(toolbar, /x-on:keydown\.capture="handleToolbarMenuKeydown\(\$event\)"/);
    assert.match(toolbar, /aria-orientation="horizontal"/);
    // Disabled inside a group too; `bold` is already there, so not added twice.
    assert.equal(toolbar.includes('aria-label="Align center"'), false);
    assert.equal(toolbar.includes('data-rich-editor-tool="italic"'), false);
    assert.equal(toolbar.match(/data-rich-editor-tool="bold"/g)?.length, 1);
    assert.match(toolbar, /data-rich-editor-tool="undo"/);
    assert.ok(editor.hasToolbarButton(['h1', 'undo']));
    assert.equal(editor.hasToolbarButton('italic'), false);
    // The default toolbar gains `customBlocks` and `mergeTags` when they are used.
    assert.ok(RichEditor.make('body').mergeTags(['name']).getToolbarButtons().flat().includes('mergeTags'));
    assert.throws(() => RichEditor.make('body').toolbarButtons([[ToolbarButtonGroup.make('X', ['rainbow'])]]), /unknown toolbar buttons rainbow/);
});

test('floating toolbars: default table and grid ones, your own per node, none when disabled', async () => {
    const html = await form(host({ body: '' }), [RichEditor.make('body')]).toHtml();
    assert.match(html, /x-ref="floatingToolbar::grid"/);
    assert.match(html, /x-ref="floatingToolbar::table"/);
    assert.ok(html.includes(`floatingToolbars: ${js({ grid: ['gridAddColumnBefore', 'gridAddColumnAfter', 'gridDeleteColumn', 'gridDelete'] }).slice(0, 40)}`));
    const custom = await form(host({ body: '' }), [RichEditor.make('body').floatingToolbars({ paragraph: ['bold', 'italic'], heading: [ToolbarButtonGroup.make('Heading', ['h1', 'h2'])] })]).toHtml();
    const content = custom.slice(custom.indexOf('nv-fo-rich-editor-content'), custom.indexOf('x-show="isPanelActive()"'));
    assert.match(content, /x-ref="floatingToolbar::paragraph" class="nv-fo-rich-editor-floating-toolbar nv-not-prose" data-rich-editor-toolbar role="toolbar" aria-label="Editor toolbar"><button data-rich-editor-tool="bold"/);
    assert.match(content, /x-ref="floatingToolbar::heading"[^>]*><div x-data="[^"]*navetteDropdown/);
    assert.equal(content.includes('floatingToolbar::table'), false);
    assert.ok(custom.includes(`floatingToolbars: ${js({ paragraph: ['bold', 'italic'], heading: ['h1', 'h2'] })},`));
    const disabled = await form(host({ body: '' }), [RichEditor.make('body').disabled()]).toHtml();
    assert.equal(disabled.includes('floatingToolbar::'), false);
    assert.ok(disabled.includes(`floatingToolbars: ${js([])},`));
});

test('height, sticky panels and sticky offset', async () => {
    const plain = await form(host({ body: '' }), [RichEditor.make('body')]).toHtml();
    assert.match(plain, /style="--min-height: 10rem;" class="nv-fo-rich-editor/);
    assert.match(plain, /class="nv-fo-rich-editor-panels "/);
    const html = await form(host({ body: '' }), [RichEditor.make('body').minHeight('12rem').maxHeight(() => '24rem').stickyToolbar().stickyPanels().stickyOffset('5rem').uploadingFileMessage('Sending…')]).toHtml();
    assert.match(html, /style="--min-height: 12rem; --max-height: 24rem; --rich-editor-sticky-offset: 5rem;"/);
    assert.match(html, /class="nv-fo-rich-editor-panels nv-fo-rich-editor-sticky-panels"/);
    assert.match(html, /uploadingFileMessage: 'Sending…',/);
    assert.match(html, /<span>Sending…<\/span>/);
    const none = await form(host({ body: '' }), [RichEditor.make('body').minHeight(null)]).toHtml();
    assert.equal(/<div x-cloak="x-cloak" style=/.test(none), false);
});

test('link protocols: sent to the editor, enforced on the server and in the link modal', async () => {
    const editor = RichEditor.make('body').linkProtocols(['https', 'mailto', 'notion']);
    const livewire = host({});
    const schema = form(livewire, [editor]);
    assert.ok((await schema.toHtml()).includes(`linkProtocols: ${js(['https', 'mailto', 'notion'])},`));
    const link = (href: string) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href } }] }] });
    livewire.data.body = doc(link('https://example.com'), link('notion://page/1'), link('tel:+33100000000'), link('javascript:alert(1)'), link('/local'));
    const saved = String((await getSchemaState(schema)).body);
    assert.match(saved, /href="https:\/\/example\.com"/);
    assert.match(saved, /href="notion:\/\/page\/1"/);
    assert.match(saved, /href="\/local"/);
    assert.equal(saved.includes('tel:'), false);
    assert.equal(saved.includes('javascript'), false);
    // Default protocols: `tel:` links are kept.
    assert.match(richDocumentToHtml(doc(link('tel:+33100000000')))!, /href="tel:/);
    assert.ok(isAllowedLinkUrl('#top', ['https']));
    assert.equal(isAllowedLinkUrl(' java\tscript:x', ['https']), false);
    const rule = (editor.getActions().find((action) => action.getName() === 'link') as any);
    assert.ok(rule);
});

test('attachments: an upload is shown through a temporary URL, then stored on save with its data-id', async () => {
    const files = [pngFile('a', 'img1')];
    const livewire = host({}, files);
    livewire.componentFileAttachments = { data: { body: { up1: 'livewire-file:img1' } } };
    const storage = new LocalFileStorage(path.join(dir, 'public'), '/files');
    const schema = form(livewire, [RichEditor.make('body').fileAttachmentsStorage(storage).fileAttachmentsDirectory('attachments')]);
    const field = schema.getFlatComponents()[0] as RichEditor;
    assert.equal(await field.getUploadedFileAttachmentTemporaryUrl({ attachment: 'up1' }), '/livewire/preview-file/img1?signed');
    livewire.data.body = doc(image({ id: 'up1', src: '/livewire/preview-file/img1?signed', alt: 'A' }));
    assert.deepEqual(await validateSchema(schema), {});
    const saved = String((await getSchemaState(schema)).body);
    const key = /data-id="([^"]+)"/.exec(saved)![1];
    assert.match(key, /^attachments\/[0-9a-f-]+\.png$/);
    assert.match(saved, new RegExp(`<img src="/files/${key}"`));
    assert.deepEqual(livewire.componentFileAttachments, { data: { body: {} } }, 'the upload reference is consumed');
});

test('attachments: data-id tampering is rejected unless the record holds the id or allowFilePathUsing approves it', async () => {
    const record = { body: '<p><img src="/files/mine.png" data-id="mine.png"></p>' };
    const livewire = host({});
    const editor = RichEditor.make('body').fileAttachmentsStorage(new LocalFileStorage(path.join(dir, 'public'), '/files')).validationMessages({ tampered: 'Not your image.' });
    const schema = form(livewire, [editor], record);
    livewire.data.body = editor.hydrateState(record.body);
    assert.deepEqual(await validateSchema(schema), {});
    livewire.data.body = doc(image({ id: 'someone-else.png', src: '/files/someone-else.png' }));
    assert.deepEqual(await validateSchema(schema), { 'data.body': ['Not your image.'] });
    const allowed = RichEditor.make('body').preventFileAttachmentPathTampering(true, (file) => file === 'templates/logo.png');
    const allowedSchema = form(livewire, [allowed], record);
    livewire.data.body = doc(image({ id: 'templates/logo.png', src: '/x.png' }));
    assert.deepEqual(await validateSchema(allowedSchema), {});
    livewire.data.body = doc(image({ id: 'templates/other.png', src: '/x.png' }));
    assert.match((await validateSchema(allowedSchema))['data.body'][0], /not permitted/);
    // Turned off explicitly: any id passes.
    assert.deepEqual(await validateSchema(form(livewire, [RichEditor.make('body').preventFileAttachmentPathTampering(false)], record)), {});
});

/** A storage signing temporary URLs (any `FileStorage` with a `temporaryUrl()` method). */
class SigningStorage extends LocalFileStorage {
    calls: { key: string; expiresAt: Date }[] = [];
    temporaryUrl(key: string, expiresAt: Date): string | null {
        this.calls.push({ key, expiresAt });
        const url = this.url(key);
        return url ? `${url}?expires=${expiresAt.getTime()}&signature=${createHmac('sha256', 'secret').update(`${key}:${expiresAt.getTime()}`).digest('hex')}` : null;
    }
}

test('private attachments: no URL saved, a temporary signed URL from the storage when loaded and rendered', async () => {
    const root = path.join(dir, 'private');
    const storage = new SigningStorage(root, '/private-files');
    const files = [pngFile('p', 'img2')];
    const livewire = host({}, files);
    livewire.componentFileAttachments = { data: { body: { up2: 'livewire-file:img2' } } };
    const editor = RichEditor.make('body').fileAttachmentsStorage(storage).fileAttachmentsVisibility('private');
    const schema = form(livewire, [editor]);
    livewire.data.body = doc(image({ id: 'up2', src: '/livewire/preview-file/img2?signed' }));
    const saved = String((await getSchemaState(schema)).body);
    assert.match(saved, /<img data-id="[0-9a-f-]+\.png">/);
    assert.equal(saved.includes('src='), false);
    const key = /data-id="([^"]+)"/.exec(saved)![1];
    // Loaded again from the record: the image gets a temporary URL (only for an id the record holds).
    const reloaded = host({});
    const recordSchema = form(reloaded, [RichEditor.make('body').fileAttachmentsStorage(storage).fileAttachmentsVisibility('private')], { body: saved });
    reloaded.data.body = (recordSchema.getFlatComponents()[0] as RichEditor).hydrateState(saved);
    await recordSchema.toHtml();
    const src = (reloaded.data.body as any).content.find((node: any) => node.type === 'image').attrs.src as string;
    assert.match(src, new RegExp(`^/private-files/${key.replace('.', '\\.')}\\?expires=\\d+&signature=[0-9a-f]{64}$`));
    // Valid until the end of the hour following the next 30 minutes.
    const { expiresAt } = storage.calls.at(-1)!;
    assert.equal(expiresAt.getMinutes(), 59);
    assert.ok(expiresAt.getTime() - Date.now() >= 30 * 60 * 1000);
    // The renderer signs it too; a forged id the record does not hold gets no URL.
    const rendered = await RichContentRenderer.make(saved).fileAttachmentsStorage(storage).fileAttachmentsVisibility('private').toHtml();
    assert.match(rendered, /src="\/private-files\/[^"?]+\?expires=\d+&amp;signature=[0-9a-f]{64}"/);
    const forged = host({});
    const forgedSchema = form(forged, [RichEditor.make('body').fileAttachmentsStorage(storage).fileAttachmentsVisibility('private')], { body: '' });
    forged.data.body = doc(image({ id: key }));
    await forgedSchema.toHtml();
    assert.equal((forged.data.body as any).content[0].content[0].attrs.src, undefined);
    // A storage that cannot sign temporary URLs (a public LocalFileStorage without a key) gives its usual URL.
    assert.equal(await (form(host({}), [RichEditor.make('body').fileAttachmentsStorage(new LocalFileStorage(root, '/p')).fileAttachmentsVisibility('private')]).getFlatComponents()[0] as RichEditor).getFileAttachmentUrl(key), `/p/${key}`);
});

test('UploadStore: signed previews of temporary images only', async () => {
    const store = new UploadStore(path.join(dir, 'uploads'), 'key');
    const image = await store.storeContent('a.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]));
    const text = await store.storeContent('a.txt', 'hello');
    const url = store.temporaryUrl(image)!;
    const parsed = new URL(url, 'http://localhost');
    assert.match(parsed.pathname, new RegExp(`^/livewire/preview-file/${image}$`));
    assert.equal(store.resolvePreview(image, parsed.searchParams.get('expires'), parsed.searchParams.get('signature'))?.type, 'image/png');
    assert.equal(store.resolvePreview(text, parsed.searchParams.get('expires'), parsed.searchParams.get('signature')), null, 'the signature binds the file');
    assert.equal(store.temporaryUrl(text), null, 'only images are previewable');
    assert.equal(store.resolvePreview(image, Date.now() - 1, parsed.searchParams.get('signature')), null);
});

test('plugins: server extensions, browser extensions, tools, actions and toolbar buttons', async () => {
    const Shout = Mark.create({ name: 'shout', parseHTML() { return [{ tag: 'span[data-shout]' }]; }, renderHTML() { return ['span', { 'data-shout': '' }, 0]; } });
    class ShoutPlugin implements RichContentPlugin {
        getTipTapServerExtensions() { return [Shout]; }
        getTipTapJsExtensions() { return ['/js/shout.js']; }
        getEditorTools() { return [RichEditorTool.make('shout').label('Shout').icon('m-megaphone').jsHandler('$getEditor()?.chain().focus().toggleMark(\'shout\').run()')]; }
        getEditorActions() { return [Action.make('shoutAction')]; }
        getEnabledToolbarButtons() { return ['shout']; }
        getDisabledToolbarButtons() { return ['strike']; }
    }
    const editor = RichEditor.make('body').plugins([new ShoutPlugin()]);
    const livewire = host({});
    const schema = form(livewire, [editor]);
    const html = await schema.toHtml();
    assert.ok(html.includes(`extensions: ${js(['/js/shout.js'])},`));
    assert.match(html, /data-rich-editor-tool="shout"/);
    assert.equal(html.includes('data-rich-editor-tool="strike"'), false);
    assert.ok(editor.getActions().some((action) => action.getName() === 'shoutAction'));
    livewire.data.body = editor.hydrateState('<p>Hey <span data-shout>you</span></p>');
    assert.match(String((await getSchemaState(schema)).body), /<span data-shout="">you<\/span>/);
    // Without the plugin, the mark is dropped; the renderer keeps it with the plugin.
    assert.equal(richDocumentToHtml(richHtmlToDocument('<p>Hey <span data-shout>you</span></p>'))!.includes('data-shout'), false);
    assert.match(await RichContentRenderer.make('<p><span data-shout>x</span></p>').plugins([new ShoutPlugin()]).toHtml(), /data-shout/);
});

test('details: the tool exists and its content survives saving', () => {
    const html = richDocumentToHtml(doc({ type: 'details', content: [{ type: 'detailsSummary', content: [{ type: 'text', text: 'More' }] }, { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden' }] }] }] }));
    assert.equal(html, '<details><summary>More</summary><div data-type="detailsContent"><p>Hidden</p></div></details>');
    assert.ok(RichEditor.make('body').toolbarButtons([['details']]));
});

class CallToAction extends RichContentCustomBlock {
    static getId() { return 'cta'; }
    static generateFakeConfiguration(faker: any) { return { heading: faker.sentence(), url: '/register' }; }
    static toHtml(config: Record<string, unknown>) { return `<a href="${config.url}">${config.heading}</a>`; }
}

test('RichEditor.fake(): blocks, marks, articles; reproducible with a seed', async () => {
    const make = () => RichEditor.fake({ seed: 42 }).heading().paragraphs(2, { bold: true, links: true }).bulletList(2).orderedList().blockquote().codeBlock('js', 'let a = 1;').horizontalRule().table(2, 3).details().grid([1, 2]).image('https://example.com/a.png', 10, 20, 'Alt').fileAttachment('attachments/a.png').textAlignment('center').hardBreak();
    const html = await make().toHtml();
    assert.equal(await make().toHtml(), html, 'same seed, same content');
    for (const tag of ['<h2', '<strong>', '<a ', '<ul>', '<ol>', '<blockquote>', '<pre><code class="language-js">let a = 1;', '<hr>', '<table', '<th', '<details>', 'class="grid-layout"', 'src="https://example.com/a.png"', 'data-id="attachments/a.png"', 'text-align: center', '<br>']) assert.ok(html.includes(tag), `${tag} in ${html}`);
    const article = await RichEditor.fake({ seed: 1 }).article(2).toArray();
    assert.equal(article.content[0].type, 'lead');
    assert.ok(article.content.some((node) => node.type === 'heading' && node.attrs?.level === 3));
    assert.throws(() => RichEditor.fake().article(6), /between 1 and 5/);
    assert.throws(() => RichEditor.fake().heading(7), /between 1 and 6/);
    assert.deepEqual(await RichEditor.fake().toArray(), { type: 'doc', content: [{ type: 'paragraph' }] });
});

test('RichEditor.fake({ editor }): merge tags, mentions, custom blocks, text colors, JSON mode, rendering', async () => {
    const editor = RichEditor.make('body').mergeTags({ name: 'Name' }).mentions([MentionProvider.make('@').items({ 1: 'Ada', 2: 'Grace' })]).customBlocks([CallToAction]).json();
    const faker = RichEditor.fake({ editor, seed: 7 }).paragraphs(2).mergeTag().mention().mention(2).customBlock().textColor();
    const value = await faker.toValue() as any;
    assert.equal(value.type, 'doc');
    const json = JSON.stringify(value);
    assert.match(json, /"type":"mergeTag","attrs":\{"id":"name"/);
    assert.match(json, /"type":"mention","attrs":\{"id":"(1|2)","label":"(Ada|Grace)","char":"@"/);
    assert.match(json, /"label":"Grace"/);
    const block = value.content.find((node: any) => node.type === 'customBlock');
    assert.equal(block.attrs.id, 'cta');
    assert.equal(block.attrs.config.url, '/register');
    assert.equal(typeof block.attrs.config.heading, 'string');
    assert.match(json, /"type":"textColor"/);
    const rendered = await faker.toRenderedHtml();
    assert.match(rendered, /<a href="\/register">/);
    assert.ok((await faker.toText()).length > 20);
    await assert.rejects(RichEditor.fake().mergeTag().toHtml(), /No merge tags/);
    await assert.rejects(RichEditor.fake().customBlock().toHtml(), /No registered custom blocks/);
    const links = await RichEditor.fake({ editor: RichEditor.make('body').linkProtocols(['mailto']), seed: 3 }).paragraphs(3, { links: true }).toHtml();
    assert.match(links, /href="mailto:/);
});

test('MarkdownEditor.fake(): Markdown blocks, escaped image text', () => {
    const markdown = MarkdownEditor.fake({ seed: 5 }).heading(3).paragraphs(1, { bold: true, italic: true, strike: true, code: true, links: true }).bulletList(2).orderedList(1).blockquote(2).codeBlock(null, 'a ``` b').horizontalRule().table(2, 2).image('https://example.com/a b.png', 10, 10, 'A [weird] alt').hardBreak().toString();
    assert.equal(markdown, MarkdownEditor.fake({ seed: 5 }).heading(3).paragraphs(1, { bold: true, italic: true, strike: true, code: true, links: true }).bulletList(2).orderedList(1).blockquote(2).codeBlock(null, 'a ``` b').horizontalRule().table(2, 2).image('https://example.com/a b.png', 10, 10, 'A [weird] alt').hardBreak().toString());
    assert.match(markdown, /^### /);
    assert.match(markdown, /\*\*[a-z ]+\*\* \*[a-z ]+\* ~~[a-z ]+~~ `[a-z ]+` \[[a-z ]+\]\(https:\/\//);
    assert.match(markdown, /\n- [A-Z]/);
    assert.match(markdown, /\n1\. [A-Z]/);
    assert.match(markdown, /````\na ``` b\n````/);
    assert.match(markdown, /\| --- \| --- \|/);
    assert.match(markdown, /!\[A \\\[weird\\\] alt\]\(<https:\/\/example\.com\/a b\.png>\)/);
    assert.match(markdown, / {2}\n[A-Z]/);
    assert.match(MarkdownEditor.fake({ seed: 2 }).article().toString(), /\n## /);
});
