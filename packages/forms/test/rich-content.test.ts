import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, HtmlString, e, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { MentionProvider, RichContentCustomBlock, RichContentRenderer, RichEditor, RichEditorTool, TextColor, TextInput, richDocumentToHtml, richHtmlToDocument, sanitizeCssColor, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });
const host = (data: Record<string, unknown>) => ({ id: 'lw', _errors: {}, data, componentFileAttachments: {}, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);
const roundTrip = (html: string) => richDocumentToHtml(richHtmlToDocument(html));

class HeroBlock extends RichContentCustomBlock {
    static getId() { return 'hero'; }
    static getLabel() { return 'Hero'; }
    static getIcon() { return 'o-star'; }
    static configureEditorAction(action: Action) { return action.schema([TextInput.make('heading').required()]); }
    static getPreviewLabel(config: Record<string, unknown>) { return `Hero: ${String(config.heading ?? '')}`; }
    static toPreviewHtml(config: Record<string, unknown>) { return `<h2>${e(config.heading)}</h2>`; }
    static toHtml(config: Record<string, unknown>, data: Record<string, unknown>) { return `<section class="hero"><h2>${e(config.heading)}</h2><p>${e(data.tagline)}</p></section>`; }
}

test('the server schema keeps colors, merge tags, mentions, blocks, columns and image sizes', () => {
    const html = roundTrip('<p><span class="color" data-color="red">red</span> <span class="color" data-color="#0ea5e9">hex</span> <span data-type="mergeTag" data-id="name"></span> <span data-type="mention" data-id="7" data-label="Ada" data-char="@">@Ada</span> <small>fine print</small></p><div data-type="customBlock" data-id="hero" data-config="{&quot;heading&quot;:&quot;Hi&quot;}"></div><div class="lead"><p>Intro</p></div><div class="grid-layout" data-cols="2"><div class="grid-layout-col"><p>A</p></div><div class="grid-layout-col"><p>B</p></div></div><p><img src="/a.png" width="320" style="width: 320px"></p>')!;
    assert.match(html, /<span class="color" data-color="red" style="--color: oklch[^"]+">red<\/span>/);
    assert.match(html, /data-color="#0ea5e9" style="--color: #0ea5e9; --dark-color: #0ea5e9;?"/);
    assert.match(html, /<span data-type="mergeTag" data-id="name"><\/span>/);
    assert.match(html, /<span data-type="mention" data-id="7" data-label="Ada" data-char="@">@Ada<\/span>/);
    assert.match(html, /<small>fine print<\/small>/);
    assert.match(html, /<div data-type="customBlock" data-id="hero" data-config="\{&quot;heading&quot;:&quot;Hi&quot;\}"><\/div>/);
    assert.match(html, /<div class="lead"><p>Intro<\/p><\/div>/);
    assert.match(html, /<div class="grid-layout" style="--cols: repeat\(2, minmax\(0, 1fr\)\);?" data-cols="2"/);
    assert.match(html, /<img src="\/a.png" width="320" style="width: 320px;?">/);
});

test('unsafe values are dropped: CSS injection in a color, bad image sizes', () => {
    assert.equal(sanitizeCssColor('red; background: url(https://evil)'), null);
    assert.equal(sanitizeCssColor('rgb(1 2 3)'), 'rgb(1 2 3)');
    assert.equal(sanitizeCssColor('rgb(var(--x))'), null);
    const html = roundTrip('<p><span class="color" data-color="red;background:url(x)">x</span><img src="/a.png" width="100;height:9999px"></p>')!;
    assert.doesNotMatch(html, /url\(|9999/);
    assert.doesNotMatch(roundTrip('<p><span data-type="mention" data-id="1" data-char="@@@@@@">x</span><script>alert(1)</script></p>')!, /@@@@|script/);
});

test('rendering: merge tag values, mention labels and links, custom blocks, sanitized output', async () => {
    const stored = roundTrip('<p>Hello <span data-type="mergeTag" data-id="name"></span>, <span data-type="mergeTag" data-id="badge"></span> <span data-type="mergeTag" data-id="unknown"></span> <span data-type="mention" data-id="7" data-label="Old name" data-char="@">@Old name</span></p><div data-type="customBlock" data-id="hero" data-config="{&quot;heading&quot;:&quot;<Welcome>&quot;}"></div><div data-type="customBlock" data-id="missing" data-config="{}"></div>')!;
    const html = await RichContentRenderer.make(stored)
        .mergeTags({ name: '<Ada & co>', badge: () => new HtmlString('<strong>VIP</strong>') })
        .mentions([MentionProvider.make('@').items({ 7: 'Ada Lovelace' }).url((id) => `/users/${id}`)])
        .customBlocks({ hero: { block: HeroBlock, data: { tagline: 'Ship it' } } })
        .toHtml();
    assert.match(html, /Hello &lt;Ada &amp; co&gt;, <strong>VIP<\/strong> \{\{ unknown \}\}/);
    assert.match(html, /<a data-type="mention" data-id="7" data-label="Ada Lovelace" data-char="@" href="\/users\/7">@Ada Lovelace<\/a>/);
    assert.match(html, /<section class="hero"><h2>&lt;Welcome&gt;<\/h2><p>Ship it<\/p><\/section>/);
    assert.doesNotMatch(html, /missing/);
    assert.equal(await RichContentRenderer.make('<p><script>alert(1)</script>ok</p>').toHtml(), '<p>ok</p>');
});

test('RichEditor: tools from definitions and your own, colors, merge tags, mentions and blocks in the page', async () => {
    const editor = RichEditor.make('body')
        .tools([RichEditorTool.make('shout').label('Shout').icon('m-megaphone').jsHandler("$getEditor()?.chain().focus().insertContent('!').run()")])
        .toolbarButtons([['bold', 'textColor', 'h1', 'lead', 'small', 'grid'], ['customBlocks', 'mergeTags', 'shout']])
        .textColors({ brand: TextColor.make('Brand', '#0ea5e9', '#38bdf8') }).customTextColors()
        .mergeTags({ name: 'Customer name', today: 'Today' })
        .mentions([MentionProvider.make('@').items({ 1: 'Ada', 2: 'Grace' }), MentionProvider.make('#').getSearchResultsUsing((search) => ({ [search]: `#${search}` }))])
        .customBlocks({ Marketing: [HeroBlock] }).searchableCustomBlocks().resizableImages().stickyToolbar().extensions(['/js/my-extension.js']);
    const html = await form(host({ body: '' }), [editor]).toHtml();
    for (const tool of ['bold', 'textColor', 'h1', 'lead', 'small', 'grid', 'customBlocks', 'mergeTags', 'shout']) assert.match(html, new RegExp(`data-rich-editor-tool="${tool}"`), tool);
    assert.match(html, /x-on:click="mountToolAction\(&#39;textColor&#39;|x-on:click="mountToolAction\('textColor'/);
    assert.match(html, /textColors: JSON\.parse\('\{\\u0022brand\\u0022:\{\\u0022color\\u0022:\\u0022#0ea5e9\\u0022/);
    assert.match(html, /mergeTags: JSON\.parse\('\{\\u0022name\\u0022:\\u0022Customer name\\u0022/);
    assert.match(html, /triggerCharacter\\u0022:\\u0022#\\u0022/);
    assert.match(html, /hasResizableImages: true,/);
    assert.match(html, /hasStickyToolbar: true,/);
    assert.match(html, /extensions: JSON\.parse\(.*my-extension\.js/);
    assert.match(html, /nv-fo-rich-editor-custom-blocks-group-header">Marketing<\/h4>/);
    assert.match(html, /data-block-id="hero"/);
    assert.match(html, /nv-fo-rich-editor-custom-blocks-search-input/);
    assert.match(html, /<span data-type="mergeTag" data-id="today">Today<\/span>/);
    assert.deepEqual(await editor.getMentionSearchResultsForJs('gr', '@'), [{ id: '2', label: 'Grace' }]);
    assert.deepEqual(await editor.getMentionSearchResultsForJs('nav', '#'), [{ id: 'nav', label: '#nav' }]);
    assert.deepEqual(await editor.getMentionLabelsForJs([{ id: 1, triggerCharacter: '@' }]), { '@': { 1: 'Ada' } });
    const [preview] = editor.getCustomBlockPreviewsForJs([{ id: 'hero', key: 3, config: { heading: '<b>' } }, { id: 'nope', key: 4 }]);
    assert.deepEqual({ ...preview, preview: Buffer.from(preview.preview, 'base64').toString() }, { key: 3, label: 'Hero: <b>', preview: '<h2>&lt;b&gt;</h2>', shouldApplyProseStylingToPreview: false });
    assert.deepEqual(editor.getActions().map((action) => action.getName()), ['link', 'textColor', 'customBlock']);
});

test('custom block action: modal from the block class, commands sent to the editor', async () => {
    const dispatched: any[] = [];
    const editor = RichEditor.make('body').customBlocks([HeroBlock]);
    const livewire = { ...host({ body: '' }), dispatch: (name: string, payload: any) => dispatched.push([name, payload]), mountedActions: [{ name: 'customBlock', arguments: { id: 'hero', mode: 'insert' } }] };
    form(livewire, [editor]);
    const action = editor.getActions().find((candidate) => candidate.getName() === 'customBlock')!;
    const ctx = { livewire, record: null, arguments: { id: 'hero', mode: 'insert', editorSelection: { type: 'text', anchor: 3, head: 3 } }, data: { heading: 'Hi' } } as any;
    assert.equal(await action.isModalHidden(ctx), false);
    const schema = action.applySchema(Schema.make(livewire as any).statePath('mountedActions.0.data'));
    assert.deepEqual(schema.getComponents().map((component: any) => component.getName()), ['heading']);
    await action.call(ctx);
    const [name, payload] = dispatched[0];
    assert.equal(name, 'run-rich-editor-commands');
    assert.equal(payload.commands[0].name, 'insertContent');
    assert.deepEqual(payload.commands[0].arguments[0].attrs.config, { heading: 'Hi' });
    assert.equal(payload.commands[0].arguments[0].attrs.label, 'Hero: Hi');
    // A block without fields is inserted without a modal.
    class Divider extends RichContentCustomBlock { static getId() { return 'divider'; } }
    const plain = RichEditor.make('body').customBlocks([Divider]).getActions().find((candidate) => candidate.getName() === 'customBlock')!;
    assert.equal(await plain.isModalHidden({ ...ctx, arguments: { id: 'divider', mode: 'insert' } }), true);
});
