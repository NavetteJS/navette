// Rich content beyond the starter kit: text colors, merge tags, mentions, custom blocks and resizable images, on the server
// (sanitizing what the editor sends, and rendering stored content), with the matching editor configuration objects.
import { randomBytes } from 'node:crypto';
import { Mark, Node, mergeAttributes, type Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Color, HtmlString } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import type { Action } from '@navette-js/actions';

type MaybePromise<T> = T | Promise<T>;

// ------------------------------------------------------------------ colors
/** CSS color written by a user: hexadecimal, rgb()/hsl()/oklch() with plain numbers, or a CSS color name. `null` otherwise. */
export function sanitizeCssColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const color = value.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
    if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(\s*[-0-9.%\s,/a-z]{1,80}\)$/i.test(color) && !/(url|expression|var|attr)\s*\(/i.test(color.slice(color.indexOf('(') + 1))) return color;
    if (/^[a-z]{3,20}$/i.test(color)) return color.toLowerCase();
    return null;
}

/** A text color of the editor: its label, its color in light mode, and in dark mode. */
export class TextColor {
    readonly label: string | null;
    readonly color: string | null;
    readonly darkColor: string | null;
    constructor(label: string | null = null, color: string | null = null, darkColor: string | null = null) { this.label = label; this.color = color; this.darkColor = darkColor; }
    static make(label: string | null = null, color: string | null = null, darkColor: string | null = null): TextColor { return new this(label, color, darkColor); }
    getLabel(): string | null { return this.label; }
    getColor(): string | null { return this.color; }
    getDarkColor(): string | null { return this.darkColor ?? this.color; }
    /** The Tailwind palette: shade 600, and 400 in dark mode. */
    static getDefaults(): Record<string, TextColor> {
        return Object.fromEntries(Object.entries(Color).map(([name, palette]) => {
            const key = name.toLowerCase();
            const translation = t(`filament-forms::components.rich_editor.actions.text_color.modal.form.color.options.${key}`);
            return [key, TextColor.make(translation.includes('::') ? name : translation, (palette as any)[600], (palette as any)[400] ?? null)];
        }));
    }
}
/** Colors for the editor's JavaScript: `{ name: { color, darkColor } }`. */
export const textColorsForJs = (colors: Record<string, TextColor>) => Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, { color: color.getColor(), darkColor: color.getDarkColor() }]));

let defaultTextColors: Record<string, TextColor> | null = null;
const extraTextColors: Record<string, TextColor> = {};
const knownTextColors = () => ({ ...(defaultTextColors ??= TextColor.getDefaults()), ...extraTextColors });
/** Text colors known when content is saved and rendered (an editor's `textColors()` registers its own). */
export function registerTextColors(colors: Record<string, TextColor>): void { Object.assign(extraTextColors, colors); }

// ------------------------------------------------------------------ mentions
/** Who or what can be mentioned after a trigger character (`@` for users, `#` for tags…). */
export class MentionProvider {
    protected _char: string;
    protected _items: Record<string, string> | (() => MaybePromise<Record<string, string>>) = {};
    protected _search: ((search: string) => MaybePromise<Record<string, string>>) | null = null;
    protected _labels: ((ids: string[]) => MaybePromise<Record<string, string>>) | null = null;
    protected _url: ((id: string, label: string) => string | null) | null = null;
    protected _extraAttributes: Record<string, string> = {};
    protected _messages: { noItems?: string | null; noSearchResults?: string | null; searching?: string | null; searchPrompt?: string | null } = {};
    constructor(char: string) { this._char = char; }
    static make(char: string): MentionProvider { return new this(char); }
    getTriggerCharacter(): string { return this._char; }
    /** Mentionable items, `{ id: label }`, offered and filtered in the browser. */
    items(items: Record<string, string> | (() => MaybePromise<Record<string, string>>)): this { this._items = items; return this; }
    /** Searches on the server as the user types (large lists). */
    getSearchResultsUsing(callback: ((search: string) => MaybePromise<Record<string, string>>) | null): this { this._search = callback; return this; }
    /** Labels of mentioned ids, to show current names in stored content. */
    getLabelsUsing(callback: ((ids: string[]) => MaybePromise<Record<string, string>>) | null): this { this._labels = callback; return this; }
    /** Link of a mention in rendered content. */
    url(callback: ((id: string, label: string) => string | null) | null): this { this._url = callback; return this; }
    extraAttributes(attributes: Record<string, string>): this { this._extraAttributes = attributes; return this; }
    noItemsMessage(message: string | null): this { this._messages.noItems = message; return this; }
    noSearchResultsMessage(message: string | null): this { this._messages.noSearchResults = message; return this; }
    searchingMessage(message: string | null): this { this._messages.searching = message; return this; }
    searchPrompt(message: string | null): this { this._messages.searchPrompt = message; return this; }
    isSearchable(): boolean { return this._search !== null; }
    async getItems(): Promise<Record<string, string>> {
        const items = typeof this._items === 'function' ? await this._items() : this._items;
        return Object.fromEntries(Object.entries(items ?? {}).map(([id, label]) => [String(id), String(label)]));
    }
    async getSearchResults(search: string): Promise<Record<string, string>> {
        if (this._search) return Object.fromEntries(Object.entries((await this._search(search)) ?? {}).map(([id, label]) => [String(id), String(label)]));
        const items = await this.getItems();
        const needle = search.toLowerCase();
        return needle ? Object.fromEntries(Object.entries(items).filter(([, label]) => label.toLowerCase().includes(needle))) : items;
    }
    async getLabels(ids: string[]): Promise<Record<string, string>> {
        const labels = this._labels ? await this._labels(ids) : Object.fromEntries(Object.entries(await this.getItems()).filter(([id]) => ids.includes(id)));
        return Object.fromEntries(Object.entries(labels ?? {}).map(([id, label]) => [String(id), String(label)]));
    }
    getUrl(id: string, label: string): string | null { return this._url ? this._url(id, label) : null; }
    async toJs(): Promise<Record<string, unknown>> {
        return {
            triggerCharacter: this._char,
            extraAttributes: this._extraAttributes,
            isSearchable: this.isSearchable(),
            items: this.isSearchable() ? [] : Object.entries(await this.getItems()).map(([id, label]) => ({ id, label })),
            noOptionsMessage: this._messages.noItems ?? t('filament-forms::components.rich_editor.mentions.no_options_message'),
            noSearchResultsMessage: this._messages.noSearchResults ?? t('filament-forms::components.rich_editor.mentions.no_search_results_message'),
            searchPrompt: this._messages.searchPrompt ?? t('filament-forms::components.rich_editor.mentions.search_prompt'),
            searchingMessage: this._messages.searching ?? t('filament-forms::components.rich_editor.mentions.searching_message'),
        };
    }
}

// ------------------------------------------------------------------ custom blocks
/**
 * A block users insert in the content (a call to action, a video, a product…), configured in a modal. Extend this class:
 * `id` and `label`, the modal's fields in `configureEditorAction()`, the preview in the editor, and the final HTML.
 */
export abstract class RichContentCustomBlock {
    /** Unique id, stored in the content. */
    static getId(): string { throw new Error(`${this.name}.getId() must be defined.`); }
    static getLabel(): string { return this.getId().replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
    /** Icon in the blocks panel. */
    static getIcon(): string | null { return null; }
    /** Group of the block in the panel (none by default). */
    static getGroup(): string | null { return null; }
    /** Modal of the block: add fields with `action.schema([...])`. Without fields, the block is inserted directly. */
    static configureEditorAction(action: Action): Action { return action.modalHidden(); }
    /** Label of an inserted block in the editor. */
    static getPreviewLabel(_config: Record<string, unknown>): string { return this.getLabel(); }
    /** HTML of the block in the editor (build it from escaped values). */
    static toPreviewHtml(_config: Record<string, unknown>): string | null { return null; }
    static shouldApplyProseStylingToPreview(_config: Record<string, unknown>): boolean { return false; }
    /** HTML of the block in rendered content; `data` comes from `RichContentRenderer.customBlocks()`. Build it from escaped values. */
    static toHtml(_config: Record<string, unknown>, _data: Record<string, unknown>): string | null { return null; }
}
export type CustomBlockClass = typeof RichContentCustomBlock;

// ------------------------------------------------------------------ server-side extensions
const json = (value: unknown) => { try { return JSON.stringify(value ?? null); } catch { return 'null'; } };
const parseConfig = (value: string | null): unknown => { try { const parsed = JSON.parse(value ?? 'null'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; } };

/** `<span class="color" data-color="red">`: the color must be a known palette name or a safe CSS color. */
export const TextColorMark = Mark.create({
    name: 'textColor',
    parseHTML() { return [{ tag: 'span', getAttrs: (element: any) => (String(element.getAttribute?.('class') ?? '').split(/\s+/).includes('color') ? null : false) }]; },
    addAttributes() {
        return {
            'data-color': {
                default: null,
                parseHTML: (element: any) => { const value = element.getAttribute('data-color'); return knownTextColors()[value] ? value : sanitizeCssColor(value); },
                renderHTML: (attributes: any) => (attributes['data-color'] ? { 'data-color': attributes['data-color'] } : {}),
            },
        };
    },
    renderHTML({ HTMLAttributes }) {
        const name = HTMLAttributes['data-color'];
        const known = typeof name === 'string' ? knownTextColors()[name] : undefined;
        const color = known ? null : sanitizeCssColor(name);
        const style = known ? `--color: ${known.getColor()}; --dark-color: ${known.getDarkColor()}` : color ? `--color: ${color}; --dark-color: ${color}` : null;
        return ['span', mergeAttributes({ class: 'color' }, HTMLAttributes, style ? { style } : {}), 0];
    },
});
/** `<span data-type="mergeTag" data-id="name">`: replaced by its value when the content is rendered. */
export const MergeTagNode = Node.create({
    name: 'mergeTag',
    group: 'inline', inline: true, atom: true, selectable: false,
    addAttributes() { return { id: { default: null, parseHTML: (element: any) => element.getAttribute('data-id') || null, renderHTML: (attributes: any) => ({ 'data-id': attributes.id }) } }; },
    parseHTML() { return [{ tag: 'span[data-type="mergeTag"]' }]; },
    renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes({ 'data-type': 'mergeTag' }, HTMLAttributes)]; },
    renderText({ node }) { return `{{ ${node.attrs.id} }}`; },
});
/** `<span data-type="mention" data-id="7" data-label="Ada" data-char="@">@Ada</span>`. */
export const MentionNode = Node.create({
    name: 'mention',
    group: 'inline', inline: true, atom: true, selectable: false,
    addAttributes() {
        return {
            id: { default: null, parseHTML: (element: any) => element.getAttribute('data-id') || null, renderHTML: (attributes: any) => ({ 'data-id': attributes.id }) },
            label: { default: null, parseHTML: (element: any) => element.getAttribute('data-label') || null, renderHTML: (attributes: any) => (attributes.label ? { 'data-label': attributes.label } : {}) },
            char: { default: '@', parseHTML: (element: any) => String(element.getAttribute('data-char') || '@').slice(0, 3), renderHTML: (attributes: any) => ({ 'data-char': attributes.char ?? '@' }) },
            href: { default: null, parseHTML: () => null, renderHTML: (attributes: any) => (attributes.href ? { href: attributes.href } : {}) },
        };
    },
    parseHTML() { return [{ tag: 'span[data-type="mention"]' }, { tag: 'a[data-type="mention"]' }]; },
    renderHTML({ node, HTMLAttributes }) { return [node.attrs.href ? 'a' : 'span', mergeAttributes({ 'data-type': 'mention' }, HTMLAttributes), `${node.attrs.char ?? '@'}${node.attrs.label ?? ''}`]; },
    renderText({ node }) { return `${node.attrs.char ?? '@'}${node.attrs.label ?? ''}`; },
});
/** `<div data-type="customBlock" data-id="hero" data-config="{…}">`: rendered by its block class. */
export const CustomBlockNode = Node.create({
    name: 'customBlock',
    group: 'block', atom: true,
    addAttributes() {
        return {
            id: { default: null, parseHTML: (element: any) => element.getAttribute('data-id') || null, renderHTML: (attributes: any) => ({ 'data-id': attributes.id }) },
            config: { default: null, parseHTML: (element: any) => parseConfig(element.getAttribute('data-config')), renderHTML: (attributes: any) => ({ 'data-config': json(attributes.config) }) },
        };
    },
    parseHTML() { return [{ tag: 'div[data-type="customBlock"]' }]; },
    renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes({ 'data-type': 'customBlock' }, HTMLAttributes)]; },
});
const lengthOf = (value: unknown): string | null => { const text = String(value ?? '').trim(); return /^\d{1,5}(\.\d{1,3})?(px|%|em|rem)?$/.test(text) ? text : null; };
const styleLength = (value: string) => (/^\d+(\.\d+)?$/.test(value) ? `${value}px` : value);
/** Images with an optional id (attachments) and size (resizable images). */
export const SizedImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            id: { default: null, parseHTML: (element: any) => element.getAttribute('data-id'), renderHTML: (attributes: any) => (attributes.id ? { 'data-id': attributes.id } : {}) },
            width: {
                default: null,
                parseHTML: (element: any) => lengthOf(element.getAttribute('width') ?? /(?:^|;)\s*width:\s*([^;]+)/.exec(element.getAttribute('style') ?? '')?.[1]),
                renderHTML: (attributes: any) => (attributes.width ? { width: attributes.width, style: `width: ${styleLength(attributes.width)}` } : {}),
            },
            height: {
                default: null,
                parseHTML: (element: any) => lengthOf(element.getAttribute('height') ?? /(?:^|;)\s*height:\s*([^;]+)/.exec(element.getAttribute('style') ?? '')?.[1]),
                renderHTML: (attributes: any) => (attributes.height ? { height: attributes.height, style: `height: ${styleLength(attributes.height)}` } : {}),
            },
        };
    },
});

/** Extensions added to the editor's schema by your application (`registerRichContentExtensions()`). */
export const customRichContentExtensions: Extensions = [];
/**
 * Adds TipTap extensions to the server schema of every rich editor and renderer: content using their nodes and marks is then
 * kept when saved. Load the matching browser extensions with `RichEditor.extensions()`.
 */
export function registerRichContentExtensions(...extensions: Extensions): void { customRichContentExtensions.push(...extensions); }

// ------------------------------------------------------------------ renderer
type RichDocument = { type: string; content?: RichDocument[]; attrs?: Record<string, any>; text?: string; marks?: unknown[] };
/**
 * Renders stored rich content (HTML or JSON) for display: merge tags replaced by their values, mentions with their current
 * labels and links, custom blocks rendered by their classes. The output is sanitized by the editor's schema.
 */
export class RichContentRenderer {
    protected content: unknown;
    protected _mergeTags: Record<string, unknown | (() => unknown)> = {};
    protected _blocks: Record<string, { block: CustomBlockClass; data: Record<string, unknown> }> = {};
    protected _mentions: MentionProvider[] = [];
    constructor(content: unknown) { this.content = content; }
    static make(content: unknown): RichContentRenderer { return new this(content); }
    /** Values of the merge tags: text (escaped), an `HtmlString` (inserted as is), or a function returning one. */
    mergeTags(values: Record<string, unknown | (() => unknown)>): this { this._mergeTags = values; return this; }
    /** Block classes, optionally with data passed to their `toHtml()`: `[HeroBlock]` or `{ hero: { block: HeroBlock, data } }`. */
    customBlocks(blocks: CustomBlockClass[] | Record<string, { block: CustomBlockClass; data?: Record<string, unknown> }>): this {
        this._blocks = Array.isArray(blocks)
            ? Object.fromEntries(blocks.map((block) => [block.getId(), { block, data: {} }]))
            : Object.fromEntries(Object.entries(blocks).map(([id, entry]) => [id, { block: entry.block, data: entry.data ?? {} }]));
        return this;
    }
    mentions(providers: MentionProvider[]): this { this._mentions = providers; return this; }
    async toHtml(): Promise<string> {
        const { richHtmlToDocument, richDocumentToHtml, renderRichDocument } = await import('./index.ts');
        // Sanitized first: only what the schema accepts goes through.
        const sanitized = richDocumentToHtml(typeof this.content === 'string' ? richHtmlToDocument(this.content) : this.content);
        if (sanitized === null) return '';
        const document = richHtmlToDocument(sanitized) as RichDocument;
        const raw = new Map<string, string>();
        const placeholder = (html: string) => { const key = `navette-raw-${randomBytes(8).toString('hex')}`; raw.set(key, html); return { type: 'paragraph', content: [{ type: 'text', text: key }] }; };
        const inlinePlaceholder = (html: string) => { const key = `navette-raw-${randomBytes(8).toString('hex')}`; raw.set(key, html); return { type: 'text', text: key }; };
        // Current labels of the mentions, by trigger character.
        const mentioned = new Map<string, Set<string>>();
        const collect = (node: RichDocument) => { if (node.type === 'mention' && node.attrs?.id != null) { const char = node.attrs.char ?? '@'; if (!mentioned.has(char)) mentioned.set(char, new Set()); mentioned.get(char)!.add(String(node.attrs.id)); } node.content?.forEach(collect); };
        collect(document);
        const labels = new Map<string, Record<string, string>>();
        for (const [char, ids] of mentioned) { const provider = this._mentions.find((candidate) => candidate.getTriggerCharacter() === char); if (provider) labels.set(char, await provider.getLabels([...ids])); }
        const transform = async (node: RichDocument): Promise<RichDocument | null> => {
            if (node.type === 'mergeTag') {
                const id = String(node.attrs?.id ?? '');
                if (!Object.hasOwn(this._mergeTags, id)) return { type: 'text', text: `{{ ${id} }}` };
                let value = this._mergeTags[id];
                if (typeof value === 'function') value = await (value as () => unknown)();
                if (value instanceof HtmlString) return inlinePlaceholder(value.html);
                const text = value === null || value === undefined ? '' : String(value);
                return text === '' ? null : { type: 'text', text, ...(node.marks ? { marks: node.marks } : {}) };
            }
            if (node.type === 'mention') {
                const char = node.attrs?.char ?? '@', id = String(node.attrs?.id ?? '');
                const label = labels.get(char)?.[id] ?? node.attrs?.label ?? '';
                const url = this._mentions.find((candidate) => candidate.getTriggerCharacter() === char)?.getUrl(id, label) ?? null;
                return { ...node, attrs: { ...node.attrs, label, href: url && /^(https?:\/\/|\/(?!\/)|mailto:)/i.test(url) ? url : null } };
            }
            if (node.type === 'customBlock') {
                const entry = this._blocks[String(node.attrs?.id ?? '')];
                if (!entry) return null;
                const config = node.attrs?.config && typeof node.attrs.config === 'object' ? node.attrs.config : {};
                const html = entry.block.toHtml(config, entry.data);
                return html ? placeholder(html) : null;
            }
            if (!node.content) return node;
            const children: RichDocument[] = [];
            for (const child of node.content) { const result = await transform(child); if (result) children.push(result); }
            return { ...node, content: children };
        };
        const html = renderRichDocument(await transform(document));
        let output = html;
        for (const [key, value] of raw) output = output.replace(`<p>${key}</p>`, () => value).replace(key, () => value);
        return output;
    }
}

/** "Lead" paragraph group: `<div class="lead">`. */
export const LeadNode = Node.create({
    name: 'lead', group: 'block', content: 'block+',
    parseHTML() { return [{ tag: 'div', getAttrs: (element: any) => (String(element.getAttribute?.('class') ?? '').split(/\s+/).includes('lead') ? null : false) }]; },
    renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes({ class: 'lead' }, HTMLAttributes), 0]; },
});
/** Small text: `<small>`. */
export const SmallMark = Mark.create({
    name: 'small',
    parseHTML() { return [{ tag: 'small' }]; },
    renderHTML({ HTMLAttributes }) { return ['small', HTMLAttributes, 0]; },
});
const count = (value: unknown, max: number) => Math.min(max, Math.max(1, Math.floor(Number(value)) || 1));
/** Columns: `<div class="grid-layout" data-cols="2">` with `<div class="grid-layout-col">` children. */
export const GridNode = Node.create({
    name: 'grid', group: 'block', content: 'gridColumn+', isolating: true,
    addAttributes() {
        return {
            'data-cols': { default: 2, parseHTML: (element: any) => count(element.getAttribute('data-cols'), 12) },
            'data-from-breakpoint': { default: 'md', parseHTML: (element: any) => (/^(sm|md|lg|xl|2xl)$/.test(element.getAttribute('data-from-breakpoint') ?? '') ? element.getAttribute('data-from-breakpoint') : 'md') },
        };
    },
    parseHTML() { return [{ tag: 'div', getAttrs: (element: any) => (String(element.getAttribute?.('class') ?? '').split(/\s+/).includes('grid-layout') ? null : false) }]; },
    renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes({ class: 'grid-layout', style: `--cols: repeat(${count(HTMLAttributes['data-cols'], 12)}, minmax(0, 1fr))` }, HTMLAttributes), 0]; },
});
export const GridColumnNode = Node.create({
    name: 'gridColumn', content: 'block+', isolating: true,
    addAttributes() { return { 'data-col-span': { default: 1, parseHTML: (element: any) => count(element.getAttribute('data-col-span'), 12) } }; },
    parseHTML() { return [{ tag: 'div', getAttrs: (element: any) => (String(element.getAttribute?.('class') ?? '').split(/\s+/).includes('grid-layout-col') ? null : false) }]; },
    renderHTML({ HTMLAttributes }) { const span = count(HTMLAttributes['data-col-span'], 12); return ['div', mergeAttributes({ class: 'grid-layout-col', style: `--col-span: span ${span} / span ${span}` }, HTMLAttributes), 0]; },
});
/** Server schema additions of the rich editor, besides the starter kit. */
export const RICH_CONTENT_EXTENSIONS: Extensions = [TextColorMark, SmallMark, MergeTagNode, MentionNode, CustomBlockNode, LeadNode, GridNode, GridColumnNode];
