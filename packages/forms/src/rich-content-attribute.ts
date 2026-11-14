// Rich content attributes registered on a model (Filament's `HasRichContent` / `InteractsWithRichContent`): one
// configuration (custom blocks, merge tags, mentions, plugins, attachments…) shared by the `RichEditor` editing the
// attribute, `TextColumn` / `TextEntry` displaying it, and `renderRichContent()`.
import type { FileAttachmentProvider } from './file-attachment-provider.ts';
import type { AttachmentsVisibility } from './rich-editor-attachments.ts';
import { RichContentRenderer, type CustomBlockClass, type MentionProvider, type TextColor } from './rich-content.ts';
import type { RichContentPlugin } from './rich-editor-toolbar.ts';
import type { CustomBlocks, FileStorage } from './index.ts';

type MergeTagValue = unknown | (() => unknown);

export class RichContentAttribute {
    readonly record: unknown;
    readonly name: string;
    customBlocksValue: CustomBlocks | null = null;
    mergeTagsValue: Record<string, MergeTagValue> | null = null;
    mergeTagLabelsValue: Record<string, string> | null = null;
    mentionsValue: MentionProvider[] | null = null;
    pluginsValue: RichContentPlugin[] = [];
    linkProtocolsValue: string[] | null = null;
    jsonValue: boolean | null = null;
    textColorsValue: Record<string, TextColor> | null = null;
    customTextColorsValue: boolean | null = null;
    fileAttachmentsStorageValue: FileStorage | null = null;
    fileAttachmentsVisibilityValue: AttachmentsVisibility | null = null;
    fileAttachmentProviderValue: FileAttachmentProvider | null = null;

    constructor(record: unknown, name: string) { this.record = record; this.name = name; }
    static make(record: unknown, name: string): RichContentAttribute { return new this(record, name); }

    customBlocks(blocks: CustomBlocks | null): this { this.customBlocksValue = blocks; return this; }
    /** Values of the merge tags, rendered in the content (a function is called when rendering). */
    mergeTags(tags: Record<string, MergeTagValue> | null): this { this.mergeTagsValue = tags; return this; }
    /** Labels of the merge tags in the editor's panel (the tag's name by default). */
    mergeTagLabels(labels: Record<string, string> | null): this { this.mergeTagLabelsValue = labels; return this; }
    mentions(providers: MentionProvider[] | null): this { this.mentionsValue = providers; return this; }
    plugins(plugins: RichContentPlugin[]): this { this.pluginsValue = [...this.pluginsValue, ...plugins]; return this; }
    linkProtocols(protocols: string[] | null): this { this.linkProtocolsValue = protocols; return this; }
    json(condition = true): this { this.jsonValue = condition; return this; }
    textColors(colors: Record<string, TextColor> | null): this { this.textColorsValue = colors; return this; }
    customTextColors(condition = true): this { this.customTextColorsValue = condition; return this; }
    fileAttachmentsStorage(storage: FileStorage | null): this { this.fileAttachmentsStorageValue = storage; return this; }
    fileAttachmentsVisibility(visibility: AttachmentsVisibility | null): this { this.fileAttachmentsVisibilityValue = visibility; return this; }
    fileAttachmentProvider(provider: FileAttachmentProvider | null): this { this.fileAttachmentProviderValue = provider; return this; }

    getName(): string { return this.name; }
    getRecord(): unknown { return this.record; }
    getFileAttachmentProvider(): FileAttachmentProvider | null { return this.fileAttachmentProviderValue; }
    /** Visibility: the attribute's, else the provider's default. */
    getFileAttachmentsVisibility(): AttachmentsVisibility | null { return this.fileAttachmentsVisibilityValue ?? this.fileAttachmentProviderValue?.getDefaultFileAttachmentVisibility?.() ?? null; }
    getMergeTags(): Record<string, MergeTagValue> { return { ...(this.mergeTagsValue ?? {}) }; }
    /** Labels shown by the editor: every merge tag, labelled by `mergeTagLabels()` or its name. */
    getMergeTagLabels(): Record<string, string> { return Object.fromEntries(Object.keys(this.mergeTagsValue ?? {}).map((tag) => [tag, this.mergeTagLabelsValue?.[tag] ?? tag])); }
    getCustomBlockClasses(): CustomBlockClass[] { const blocks = this.customBlocksValue ?? []; return Array.isArray(blocks) ? blocks : Object.values(blocks).flat(); }

    /** Stored content of the attribute. */
    getContent(): unknown { return this.record && typeof this.record === 'object' ? (this.record as Record<string, unknown>)[this.name] : null; }
    isEmpty(): boolean {
        const content = this.getContent();
        if (content === null || content === undefined) return true;
        if (typeof content === 'string') return content.replace(/<[^>]*>/g, '').trim() === '' && !/<(img|hr|iframe|video)\b/i.test(content) && !/data-type="customBlock"/.test(content);
        const nodes = (content as { content?: unknown }).content;
        return typeof content === 'object' && Array.isArray(nodes) && nodes.length === 0;
    }
    /** A renderer of the content configured by this attribute. */
    getRenderer(): RichContentRenderer {
        const renderer = RichContentRenderer.make(this.getContent() ?? '').customBlocks(this.getCustomBlockClasses()).mergeTags(this.getMergeTags()).mentions(this.mentionsValue ?? []).plugins(this.pluginsValue).linkProtocols(this.linkProtocolsValue);
        if (this.fileAttachmentsStorageValue) renderer.fileAttachmentsStorage(this.fileAttachmentsStorageValue);
        const visibility = this.getFileAttachmentsVisibility();
        if (visibility) renderer.fileAttachmentsVisibility(visibility);
        if (this.fileAttachmentProviderValue) renderer.fileAttachmentProvider(this.fileAttachmentProviderValue, this.record, this.name);
        return renderer;
    }
    /** Rendered HTML of the content (empty for empty content). */
    async toHtml(): Promise<string> { return this.isEmpty() ? '' : this.getRenderer().toHtml(); }
    async toText(): Promise<string> { return this.isEmpty() ? '' : this.getRenderer().toText(); }
}

/** A model registering rich content attributes. */
export interface HasRichContent {
    getRichContentAttributes(): Record<string, RichContentAttribute>;
    getRichContentAttribute(name: string): RichContentAttribute | null;
    hasRichContentAttribute(name: string): boolean;
    renderRichContent(name: string): Promise<string>;
}

type Constructor<T = object> = abstract new (...args: any[]) => T;
/** Registered attributes by record: not an own property, so that a model never saves them as a column. */
const registered = new WeakMap<object, Record<string, RichContentAttribute>>();

/**
 * Adds rich content attributes to a model class (Filament's `InteractsWithRichContent`): override `setUpRichContent()`
 * and register each attribute with `this.registerRichContent('content')`.
 */
export function InteractsWithRichContent<TBase extends Constructor>(Base: TBase) {
    abstract class WithRichContent extends Base implements HasRichContent {
        /** Registers the rich content attributes of the model: `this.registerRichContent('content').customBlocks([...])`. */
        setUpRichContent(): void {}
        registerRichContent(name: string): RichContentAttribute {
            let attributes = registered.get(this);
            if (!attributes) registered.set(this, attributes = {});
            return attributes[name] = RichContentAttribute.make(this, name);
        }
        /** Attributes registered by `setUpRichContent()`, set up on first use (kept outside the record's own properties). */
        getRichContentAttributes(): Record<string, RichContentAttribute> {
            let attributes = registered.get(this);
            if (!attributes) { registered.set(this, attributes = {}); this.setUpRichContent(); }
            return attributes;
        }
        getRichContentAttribute(name: string): RichContentAttribute | null { return Object.hasOwn(this.getRichContentAttributes(), name) ? this.getRichContentAttributes()[name] : null; }
        hasRichContentAttribute(name: string): boolean { return Object.hasOwn(this.getRichContentAttributes(), name); }
        /** Rendered HTML of an attribute, with its registered configuration (a plain renderer if it is not registered). */
        renderRichContent(name: string): Promise<string> { return (this.getRichContentAttribute(name) ?? RichContentAttribute.make(this, name)).toHtml(); }
    }
    return WithRichContent;
}

/** The rich content attribute a record registers under this name, if any. */
export function getRichContentAttribute(record: unknown, name: string): RichContentAttribute | null {
    const host = record as Partial<HasRichContent> | null;
    if (!host || typeof host !== 'object' || typeof host.hasRichContentAttribute !== 'function' || typeof host.getRichContentAttribute !== 'function') return null;
    return host.hasRichContentAttribute(name) ? host.getRichContentAttribute(name) : null;
}
