// Fake content for seeders and tests: `RichEditor.fake()` (a TipTap document, stored as HTML or JSON) and `MarkdownEditor.fake()`
// (Markdown), as Filament's `fake()->filamentRichContent()` and `fake()->filamentMarkdown()`. Blocks are chained, then the
// content is produced; a `seed` makes the output reproducible.
import type { CustomBlockClass, MentionProvider, TextColor } from './rich-content.ts';

// ------------------------------------------------------------------ random values
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta explicabo nemo ipsam quia voluptas aspernatur aut odit fugit consequuntur magni dolores eos ratione sequi nesciunt neque porro quisquam dolorem adipisci numquam eius modi tempora incidunt magnam quaerat'.split(' ');
const TLDS = ['com', 'net', 'org', 'io', 'dev'];

/** Seedable random values (mulberry32), with the few Faker helpers the content fakers need. */
export class FakeValues {
    private next: () => number;
    constructor(seed: number | null = null, random: (() => number) | null = null) {
        if (random) { this.next = random; return; }
        let state = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
        this.next = () => {
            state = (state + 0x6d2b79f5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    numberBetween(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
    /** `true` with the given chance, in percent. */
    boolean(chance = 50): boolean { return this.next() * 100 < chance; }
    randomElement<T>(items: readonly T[]): T { return items[this.numberBetween(0, items.length - 1)]; }
    word(): string { return this.randomElement(WORDS); }
    words(count: number): string { return Array.from({ length: count }, () => this.word()).join(' '); }
    /** A sentence of about `words` words (±40%), capitalized, ending with a period. */
    sentence(words = 6): string {
        const count = Math.max(1, words + this.numberBetween(-Math.floor(words * 0.4), Math.floor(words * 0.4)));
        const text = this.words(count);
        return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
    }
    paragraph(sentences = 3): string {
        const count = Math.max(1, sentences + this.numberBetween(-1, 1));
        return Array.from({ length: count }, () => this.sentence()).join(' ');
    }
    /** Text of at most `maxCharacters` characters (sentences). */
    text(maxCharacters = 200): string {
        const sentences: string[] = [];
        while (true) {
            const sentence = this.sentence();
            if ([...sentences, sentence].join(' ').length > maxCharacters) break;
            sentences.push(sentence);
        }
        return sentences.length ? sentences.join(' ') : this.sentence(3).slice(0, maxCharacters);
    }
    uuid(): string {
        const hex = Array.from({ length: 32 }, () => this.numberBetween(0, 15).toString(16)).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[this.numberBetween(0, 3)]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    }
    slug(): string { return this.words(this.numberBetween(2, 4)).replace(/ /g, '-'); }
    domainName(): string { return `${this.word()}${this.word()}.${this.randomElement(TLDS)}`; }
    userName(): string { return `${this.word()}.${this.word()}${this.numberBetween(1, 99)}`; }
    safeEmail(): string { return `${this.userName()}@example.${this.randomElement(['com', 'net', 'org'])}`; }
    url(): string { return `https://www.${this.domainName()}/${this.slug()}`; }
    /** Replaces each `#` with a random digit. */
    numerify(pattern: string): string { return pattern.replace(/#/g, () => String(this.numberBetween(0, 9))); }
}

const title = (text: string) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());
const fail = (message: string): never => { throw new RangeError(message); };

export type ContentFakerOptions = { seed?: number | null; random?: (() => number) | null };

/** Common parts of the content fakers: articles, headings and paragraphs text, image and link URLs. */
export abstract class ContentFaker {
    protected faker: FakeValues;
    constructor(options: ContentFakerOptions = {}) { this.faker = new FakeValues(options.seed ?? null, options.random ?? null); }
    /** An introduction, then sections with level-two headings; `depth` (1 to 5) nests sections with the next heading levels. */
    article(depth = 1): this {
        if (depth < 1 || depth > 5) fail('Article depth must be between 1 and 5.');
        this.addArticleIntroduction();
        this.addArticleSections(2, depth, true);
        return this;
    }
    protected abstract addArticleIntroduction(): void;
    protected abstract addArticleHeading(level: number): void;
    protected abstract addArticleParagraphs(count: number, links: boolean, bold: boolean, italic: boolean): void;
    protected addArticleSections(level: number, depth: number, isRoot = false): void {
        const count = this.faker.numberBetween(isRoot ? 2 : 1, isRoot ? 4 : 2);
        for (let section = 0; section < count; section++) {
            this.addArticleHeading(level);
            this.addArticleParagraphs(this.faker.numberBetween(1, 3), this.faker.boolean(30), this.faker.boolean(40), this.faker.boolean(20));
            if (depth > 1) this.addArticleSections(level + 1, depth - 1);
        }
    }
    protected makeHeadingText(): string { return title(this.faker.words(this.faker.numberBetween(3, 8))); }
    protected makeParagraphText(sentence = false): string { return (sentence ? this.faker.sentence() : this.faker.paragraph()).replace(/\.+$/, ''); }
    protected makeImageUrl(width: number, height: number): string { return `https://picsum.photos/seed/${this.faker.uuid()}/${width}/${height}`; }
    protected makeLinkUrl(protocols: string[] | null = null): string {
        if (protocols === null) return this.faker.url();
        if (!protocols.length) return `/${this.faker.slug()}`;
        const protocol = this.faker.randomElement(protocols);
        if (['http', 'https', 'ftp', 'ftps'].includes(protocol)) return `${protocol}://${this.faker.domainName()}/${this.faker.slug()}`;
        if (protocol === 'mailto') return `mailto:${this.faker.safeEmail()}`;
        if (['tel', 'callto', 'sms'].includes(protocol)) return `${protocol}:${this.faker.numerify('+1##########')}`;
        if (protocol === 'cid') return `cid:${this.faker.uuid()}`;
        if (protocol === 'xmpp') return `xmpp:${this.faker.userName()}@${this.faker.domainName()}`;
        return `${protocol}:${this.faker.slug()}`;
    }
}

// ------------------------------------------------------------------ Markdown
type MarkdownBlock = { type: string; markdown: string };
/** Fake Markdown: chain blocks, then `toString()`. */
export class MarkdownFaker extends ContentFaker {
    protected content: MarkdownBlock[] = [];
    static make(options: ContentFakerOptions = {}): MarkdownFaker { return new this(options); }
    protected addArticleIntroduction(): void { this.paragraphs(); }
    protected addArticleHeading(level: number): void { this.heading(level); }
    protected addArticleParagraphs(count: number, links: boolean, bold: boolean, italic: boolean): void { this.paragraphs(count, { links, bold, italic }); }
    heading(level = 2): this {
        if (level < 1 || level > 6) fail('Heading level must be between 1 and 6.');
        this.content.push({ type: 'heading', markdown: `${'#'.repeat(level)} ${this.makeHeadingText()}` });
        return this;
    }
    /** Paragraphs, optionally with a link and bold, italic, strike-through and code words. */
    paragraphs(count = 1, options: { links?: boolean; bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean } = {}): this {
        if (count < 0) fail('Paragraph count must be at least 0.');
        for (let paragraph = 0; paragraph < count; paragraph++) {
            let markdown = this.makeParagraphText();
            for (const [delimiter, enabled] of [['**', options.bold], ['*', options.italic], ['~~', options.strike], ['`', options.code]] as const) {
                if (enabled) markdown += ` ${delimiter}${this.faker.words(this.faker.numberBetween(1, 4))}${delimiter}`;
            }
            if (options.links) markdown += ` [${this.faker.words(this.faker.numberBetween(2, 5))}](${this.makeLinkUrl()})`;
            this.content.push({ type: 'paragraph', markdown: `${markdown}.` });
        }
        return this;
    }
    bulletList(items = 3): this { return this.list('-', items); }
    orderedList(items = 3): this { return this.list('1.', items); }
    protected list(marker: string, items: number): this {
        if (items < 1) fail('List item count must be at least 1.');
        this.content.push({ type: 'list', markdown: Array.from({ length: items }, () => `${marker} ${this.makeParagraphText(true)}.`).join('\n') });
        return this;
    }
    blockquote(paragraphs = 1): this {
        if (paragraphs < 1) fail('Blockquote paragraph count must be at least 1.');
        this.content.push({ type: 'blockquote', markdown: Array.from({ length: paragraphs }, () => `> ${this.makeParagraphText()}.`).join('\n>\n') });
        return this;
    }
    codeBlock(language: string | null = null, code: string | null = null): this {
        code ??= this.faker.text(120);
        const fenceCharacter = (language ?? '').includes('`') ? '~' : '`';
        const longest = Math.max(0, ...(code.match(new RegExp(`\\${fenceCharacter}+`, 'g')) ?? []).map((fence) => fence.length));
        const fence = fenceCharacter.repeat(Math.max(3, longest + 1));
        this.content.push({ type: 'codeBlock', markdown: `${fence}${language ? ` ${language}` : ''}\n${code}\n${fence}` });
        return this;
    }
    horizontalRule(): this { this.content.push({ type: 'horizontalRule', markdown: '---' }); return this; }
    /** A line break inside a random paragraph (one is added if there is none). */
    hardBreak(): this {
        let indexes = this.content.flatMap((block, index) => (block.type === 'paragraph' ? [index] : []));
        if (!indexes.length) { this.paragraphs(); indexes = [this.content.length - 1]; }
        this.content[this.faker.randomElement(indexes)].markdown += `  \n${this.makeParagraphText(true)}.`;
        return this;
    }
    table(columns = 3, rows = 2): this {
        if (columns < 1 || rows < 1) fail('Table column and row counts must be at least 1.');
        const lines = [`| ${Array.from({ length: columns }, () => this.makeHeadingText()).join(' | ')} |`, `| ${Array(columns).fill('---').join(' | ')} |`];
        for (let row = 1; row < rows; row++) lines.push(`| ${Array.from({ length: columns }, () => this.faker.words(this.faker.numberBetween(1, 3))).join(' | ')} |`);
        this.content.push({ type: 'table', markdown: lines.join('\n') });
        return this;
    }
    image(url: string | null = null, width = 1280, height = 720, alt: string | null = null): this {
        if (width < 1 || height < 1) fail('Image width and height must be at least 1.');
        const text = (alt ?? this.faker.sentence()).replace(/[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/g, (character) => `\\${character}`);
        const target = (url ?? this.makeImageUrl(width, height)).replace(/[\\<>&]/g, (character) => ({ '\\': '\\\\', '<': '\\<', '>': '\\>', '&': '&amp;' })[character]!);
        this.content.push({ type: 'image', markdown: `![${text}](<${target}>)` });
        return this;
    }
    toString(): string { return this.content.map((block) => block.markdown).join('\n\n'); }
}

// ------------------------------------------------------------------ rich content
type RichNode = { type: string; attrs?: Record<string, any>; content?: RichNode[]; text?: string; marks?: { type: string; attrs?: Record<string, any> }[] };
/** A custom block able to generate a valid configuration for the faker (`RichEditor.fake().customBlock()`). */
export interface CanGenerateFakeConfiguration { generateFakeConfiguration(faker: FakeValues): Record<string, unknown> }
/** What the rich content faker uses from an editor: its configuration (see `RichEditor.fake({ editor })`). */
type FakerEditor = {
    isJson(): boolean;
    getMergeTags(): Record<string, string>;
    getMentionProviders(): MentionProvider[];
    getCustomBlocks(): CustomBlockClass[];
    getTextColors(): Record<string, TextColor>;
    getLinkProtocols(): string[];
    dehydrateRichDocument(document: unknown): Promise<string | null>;
    renderRichDocument(document: unknown): Promise<string>;
};
export type RichContentFakerOptions = ContentFakerOptions & { editor?: FakerEditor | null };
type Marks = { links?: boolean; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; subscript?: boolean; superscript?: boolean; code?: boolean; small?: boolean; highlight?: boolean };

/**
 * Fake rich content: chain blocks, then `toHtml()` (storage HTML), `toArray()` (the TipTap document), `toValue()` (JSON or HTML,
 * as the editor stores it), `toRenderedHtml()` or `toText()`. Inline nodes needing the editor's configuration (merge tags,
 * mentions) are generated when the content is produced: the output methods are asynchronous.
 */
export class RichContentFaker extends ContentFaker {
    protected content: RichNode[] = [];
    protected steps: (() => void | Promise<void>)[] = [];
    protected ran = 0;
    protected editor: FakerEditor | null;
    protected renderer: ((document: RichNode) => string | Promise<string>) | null = null;
    constructor(options: RichContentFakerOptions = {}) { super(options); this.editor = options.editor ?? null; }
    static make(options: RichContentFakerOptions = {}): RichContentFaker { return new this(options); }
    /** Uses an editor's configuration (Filament's `attribute()`). */
    attribute(editor: FakerEditor | null): this { this.editor = editor; return this; }
    protected step(callback: () => void | Promise<void>): this { this.steps.push(callback); return this; }
    protected addArticleIntroduction(): void { this.lead(); }
    protected addArticleHeading(level: number): void { this.heading(level); }
    protected addArticleParagraphs(count: number, links: boolean, bold: boolean, italic: boolean): void { this.paragraphs(count, { links, bold, italic }); }
    heading(level = 2): this {
        if (level < 1 || level > 6) fail('Heading level must be between 1 and 6.');
        return this.step(() => { this.content.push({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: this.makeHeadingText() }] }); });
    }
    /** Paragraphs, optionally with a link and words in bold, italic, underline, strike, subscript, superscript, code, small or highlight. */
    paragraphs(count = 1, marks: Marks = {}): this {
        if (count < 0) fail('Paragraph count must be at least 0.');
        return this.step(() => { for (let paragraph = 0; paragraph < count; paragraph++) this.content.push(this.makeParagraphNode(false, marks)); });
    }
    lead(paragraphs = 1): this {
        if (paragraphs < 1) fail('Lead paragraph count must be at least 1.');
        return this.step(() => { this.content.push({ type: 'lead', content: Array.from({ length: paragraphs }, () => this.makeParagraphNode()) }); });
    }
    bulletList(items = 3): this { return this.list('bulletList', items); }
    orderedList(items = 3): this { return this.list('orderedList', items); }
    protected list(type: string, items: number): this {
        if (items < 1) fail('List item count must be at least 1.');
        return this.step(() => { this.content.push({ type, content: Array.from({ length: items }, () => ({ type: 'listItem', content: [this.makeParagraphNode(true)] })) }); });
    }
    blockquote(paragraphs = 1): this {
        if (paragraphs < 1) fail('Blockquote paragraph count must be at least 1.');
        return this.step(() => { this.content.push({ type: 'blockquote', content: Array.from({ length: paragraphs }, () => this.makeParagraphNode()) }); });
    }
    codeBlock(language: string | null = null, code: string | null = null): this {
        return this.step(() => {
            const text = code ?? this.faker.text(120);
            this.content.push({ type: 'codeBlock', attrs: { language }, ...(text !== '' ? { content: [{ type: 'text', text }] } : {}) });
        });
    }
    horizontalRule(): this { return this.step(() => { this.content.push({ type: 'horizontalRule' }); }); }
    hardBreak(): this { return this.step(() => this.insertInlineNode({ type: 'hardBreak' }, false)); }
    /** A table whose first row is a header row. */
    table(columns = 3, rows = 2): this {
        if (columns < 1 || rows < 1) fail('Table column and row counts must be at least 1.');
        return this.step(() => {
            this.content.push({
                type: 'table',
                content: Array.from({ length: rows }, (_, row) => ({
                    type: 'tableRow',
                    content: Array.from({ length: columns }, () => ({ type: row === 0 ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: row === 0 ? title(this.faker.word()) : this.faker.words(this.faker.numberBetween(1, 3)) }] }] })),
                })),
            });
        });
    }
    details(paragraphs = 1): this {
        if (paragraphs < 1) fail('Details paragraph count must be at least 1.');
        return this.step(() => {
            this.content.push({ type: 'details', content: [{ type: 'detailsSummary', content: [{ type: 'text', text: this.faker.sentence() }] }, { type: 'detailsContent', content: Array.from({ length: paragraphs }, () => this.makeParagraphNode()) }] });
        });
    }
    /** Columns of the given spans, side by side from `breakpoint`. */
    grid(columns: number[] = [1, 1], breakpoint = 'lg'): this {
        if (!columns.length) fail('A grid must contain at least one column.');
        if (columns.some((span) => span < 1)) fail('Grid column spans must be at least 1.');
        return this.step(() => {
            this.content.push({ type: 'grid', attrs: { 'data-cols': columns.reduce((sum, span) => sum + span, 0), 'data-from-breakpoint': breakpoint }, content: columns.map((span) => ({ type: 'gridColumn', attrs: { 'data-col-span': span }, content: [this.makeParagraphNode()] })) });
        });
    }
    image(url: string | null = null, width = 1280, height = 720, alt: string | null = null): this {
        if (width < 1 || height < 1) fail('Image width and height must be at least 1.');
        return this.step(() => { this.content.push({ type: 'paragraph', content: [{ type: 'image', attrs: { src: url ?? this.makeImageUrl(width, height), alt: alt ?? this.faker.sentence(), width, height } }] }); });
    }
    /** An image referencing a stored attachment by its key (`data-id`). */
    fileAttachment(id: string, width: number | null = null, height: number | null = null, alt: string | null = null): this {
        if (width !== null && width < 1) fail('File attachment width must be at least 1.');
        if (height !== null && height < 1) fail('File attachment height must be at least 1.');
        return this.step(() => { this.content.push({ type: 'paragraph', content: [{ type: 'image', attrs: { id, alt: alt ?? this.faker.sentence(), width, height } }] }); });
    }
    /**
     * A custom block: a block class or id, with its configuration. Without arguments, a random block of the editor among those
     * implementing `generateFakeConfiguration()` (a static method of the block class).
     */
    customBlock(block: CustomBlockClass | string | null = null, configuration: Record<string, unknown> | null = null): this {
        return this.step(() => {
            const blocks = this.editor?.getCustomBlocks() ?? [];
            let chosen: CustomBlockClass | string | null = block;
            if (chosen === null) {
                const fakeable = blocks.filter((candidate) => typeof (candidate as any).generateFakeConfiguration === 'function');
                if (!fakeable.length) throw new Error('No registered custom blocks can generate fake configuration.');
                chosen = this.faker.randomElement(fakeable);
            }
            const blockClass = typeof chosen === 'string' ? blocks.find((candidate) => candidate.getId() === chosen) ?? null : chosen;
            const config = configuration ?? (blockClass && typeof (blockClass as any).generateFakeConfiguration === 'function' ? (blockClass as any).generateFakeConfiguration(this.faker) : null);
            this.content.push({ type: 'customBlock', attrs: { id: blockClass ? blockClass.getId() : chosen, config: config ?? {} } });
        });
    }
    /** A merge tag in a random paragraph: the given id, or one of the editor's. */
    mergeTag(id: string | null = null): this {
        return this.step(() => {
            let tag = id;
            if (tag === null) {
                const tags = Object.keys(this.editor?.getMergeTags() ?? {});
                if (!tags.length) throw new Error('No merge tags are configured on the rich editor.');
                tag = this.faker.randomElement(tags);
            }
            this.insertInlineNode({ type: 'mergeTag', attrs: { id: tag } });
        });
    }
    mergeTags(count = 1): this {
        if (count < 0) fail('Merge tag count must be at least 0.');
        for (let index = 0; index < count; index++) this.mergeTag();
        return this;
    }
    /** A mention in a random paragraph: the given id (with its trigger character when there are several providers), or a random item. */
    mention(id: string | number | null = null, char: string | null = null): this {
        return this.step(async () => {
            const providers = this.editor?.getMentionProviders() ?? [];
            if (id !== null && char === null && providers.length > 1) throw new RangeError('A mention trigger character must be specified when generating an explicit mention ID with multiple providers.');
            let provider: MentionProvider | null = null;
            let items: Record<string, string> | null = null;
            if (providers.length) {
                if (id === null && char === null) {
                    const withItems: [MentionProvider, Record<string, string>][] = [];
                    for (const candidate of providers) { const found = await candidate.getSearchResults(''); if (Object.keys(found).length) withItems.push([candidate, found]); }
                    if (withItems.length) [provider, items] = this.faker.randomElement(withItems);
                } else {
                    provider = char === null ? this.faker.randomElement(providers) : providers.find((candidate) => candidate.getTriggerCharacter() === char) ?? null;
                }
            }
            if (id === null && !provider) throw new Error('No matching mention provider is configured on the rich editor.');
            const trigger = char ?? provider?.getTriggerCharacter() ?? '@';
            let mentionId: string, label: string;
            if (id === null) {
                items ??= await provider!.getSearchResults('');
                if (!Object.keys(items).length) throw new Error(`The mention provider for [${trigger}] did not return any items.`);
                mentionId = this.faker.randomElement(Object.keys(items));
                label = items[mentionId];
            } else {
                mentionId = String(id);
                label = (provider ? (await provider.getLabels([mentionId]))[mentionId] : undefined) ?? mentionId;
            }
            this.insertInlineNode({ type: 'mention', attrs: { id: mentionId, label, char: trigger } });
        });
    }
    mentions(count = 1): this {
        if (count < 0) fail('Mention count must be at least 0.');
        for (let index = 0; index < count; index++) this.mention();
        return this;
    }
    /** Colors random text with one of the editor's text colors (the default palette without editor), or the given one. */
    textColor(color: string | null = null): this {
        return this.step(async () => {
            let picked = color;
            if (picked === null) {
                const { TextColor } = await import('./rich-content.ts');
                const colors = Object.keys(this.editor?.getTextColors() ?? TextColor.getDefaults());
                if (!colors.length) throw new Error('No text colors are configured on the rich editor.');
                picked = this.faker.randomElement(colors);
            }
            this.markRandomText({ type: 'textColor', attrs: { 'data-color': picked } });
        });
    }
    /** Aligns a random heading or paragraph (`start`, `center`, `end` or `justify`, random by default). */
    textAlignment(alignment: 'start' | 'center' | 'end' | 'justify' | null = null): this {
        if (alignment !== null && !['start', 'center', 'end', 'justify'].includes(alignment)) fail('Text alignment must be start, center, end, or justify.');
        return this.step(() => {
            const picked = alignment ?? this.faker.randomElement(['start', 'center', 'end', 'justify']);
            if (!this.countNodes(this.content, ['heading', 'paragraph'])) this.content.push(this.makeParagraphNode());
            this.modifyRandomNode(['heading', 'paragraph'], (node) => { node.attrs = { ...node.attrs, textAlign: picked }; });
        });
    }
    /** A raw block node (a plugin's node, for example). */
    block(node: RichNode): this { return this.step(() => { this.content.push(node); }); }
    /** A raw inline node, in a random paragraph. */
    inline(node: RichNode): this { return this.step(() => this.insertInlineNode(node)); }
    /** Renders `toRenderedHtml()` with your own function instead of the editor's renderer. */
    renderUsing(renderer: ((document: RichNode) => string | Promise<string>) | null): this { this.renderer = renderer; return this; }

    /** The TipTap document. */
    async toArray(): Promise<{ type: 'doc'; content: RichNode[] }> {
        // Each chained block is generated once: calling several output methods gives the same content.
        while (this.ran < this.steps.length) await this.steps[this.ran++]();
        return { type: 'doc', content: this.content.length ? JSON.parse(JSON.stringify(this.content)) : [{ type: 'paragraph' }] };
    }
    /** Storage HTML (custom blocks, merge tags, mentions and attachments are kept as nodes, so that they can be edited). */
    async toHtml(): Promise<string> {
        const document = await this.toArray();
        if (this.editor) return (await this.editor.dehydrateRichDocument(document)) ?? '';
        const { richDocumentToHtml } = await import('./index.ts');
        return richDocumentToHtml(document) ?? '';
    }
    /** The value as the editor stores it: the document with `json()`, HTML otherwise. */
    async toValue(): Promise<string | { type: 'doc'; content: RichNode[] }> {
        if (!this.editor?.isJson()) return this.toHtml();
        const { richHtmlToDocument } = await import('./index.ts');
        return richHtmlToDocument(await this.toHtml()) as { type: 'doc'; content: RichNode[] };
    }
    /** HTML for display: merge tags, mentions and custom blocks rendered (`RichContentRenderer`). */
    async toRenderedHtml(): Promise<string> {
        const document = await this.toArray();
        if (this.renderer) return this.renderer(document as RichNode);
        if (this.editor) return this.editor.renderRichDocument(document);
        const { RichContentRenderer } = await import('./rich-content.ts');
        return RichContentRenderer.make(document).toHtml();
    }
    /** Plain text of the rendered content. */
    async toText(): Promise<string> {
        const { richDocumentToText, richHtmlToDocument } = await import('./index.ts');
        return richDocumentToText(richHtmlToDocument(await this.toRenderedHtml()));
    }

    // ---- document helpers
    protected makeParagraphNode(sentence = false, marks: Marks = {}): RichNode {
        const content: RichNode[] = [{ type: 'text', text: this.makeParagraphText(sentence) }];
        for (const mark of ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'code', 'small', 'highlight'] as const) {
            if (marks[mark]) content.push({ type: 'text', text: ` ${this.faker.words(this.faker.numberBetween(1, 4))}`, marks: [{ type: mark }] });
        }
        if (marks.links) content.push({ type: 'text', text: ` ${this.faker.words(this.faker.numberBetween(2, 5))}`, marks: [{ type: 'link', attrs: { href: this.makeLinkUrl() } }] });
        content.push({ type: 'text', text: '.' });
        return { type: 'paragraph', content };
    }
    protected makeLinkUrl(): string { return super.makeLinkUrl(this.editor ? this.editor.getLinkProtocols() : null); }
    protected insertInlineNode(node: RichNode, surroundWithSpaces = true): void {
        if (!this.countNodes(this.content, ['paragraph'])) this.content.push(this.makeParagraphNode());
        this.modifyRandomNode(['paragraph'], (paragraph) => {
            const content = paragraph.content ?? [];
            const candidates = content.flatMap((child, index) => (child.type === 'text' && !child.marks?.length && (child.text ?? '').trim().split(/\s+/).length > 1 ? [index] : []));
            if (!candidates.length) {
                const last = content[content.length - 1];
                if (surroundWithSpaces && last) {
                    if (last.type === 'text') { if (!/\s$/.test(last.text ?? '')) last.text += ' '; }
                    else if (last.type !== 'hardBreak') content.push({ type: 'text', text: ' ' });
                }
                paragraph.content = [...content, node];
                return;
            }
            const index = this.faker.randomElement(candidates);
            const textNode = content[index];
            const [, leading, middle, trailing] = /^(\s*)([\s\S]*?)(\s*)$/.exec(textNode.text ?? '')!;
            const words = middle.split(/\s+/);
            const offset = this.faker.numberBetween(1, words.length - 1);
            let before = leading + words.slice(0, offset).join(' ');
            let after = words.slice(offset).join(' ') + trailing;
            if (surroundWithSpaces) { before += ' '; after = ` ${after}`; }
            content.splice(index, 1, { ...textNode, text: before }, node, { ...textNode, text: after });
            paragraph.content = content;
        });
    }
    protected markRandomText(mark: { type: string; attrs?: Record<string, any> }): void {
        const eligible = (node: RichNode) => node.type === 'text' && (node.text ?? '').trim().length > 1 && (mark.type === 'code' || !(node.marks ?? []).some((existing) => existing.type === 'code'));
        const textNodes: RichNode[] = [];
        const collect = (nodes: RichNode[], inParagraph: boolean) => { for (const node of nodes) { if (inParagraph && eligible(node)) textNodes.push(node); if (node.content) collect(node.content, inParagraph || node.type === 'paragraph'); } };
        collect(this.content, false);
        if (!textNodes.length) { this.content.push(this.makeParagraphNode()); collect(this.content.slice(-1), false); }
        if (!textNodes.length) return;
        const target = textNodes[this.faker.numberBetween(0, textNodes.length - 1)];
        target.marks = [...(target.marks ?? []).filter((existing) => existing.type !== mark.type), mark];
    }
    protected countNodes(nodes: RichNode[], types: string[]): number { return nodes.reduce((count, node) => count + (types.includes(node.type) ? 1 : 0) + (node.content ? this.countNodes(node.content, types) : 0), 0); }
    protected modifyRandomNode(types: string[], callback: (node: RichNode) => void): void {
        const matches: RichNode[] = [];
        const collect = (nodes: RichNode[]) => { for (const node of nodes) { if (types.includes(node.type)) matches.push(node); if (node.content) collect(node.content); } };
        collect(this.content);
        if (matches.length) callback(matches[this.faker.numberBetween(0, matches.length - 1)]);
    }
}
