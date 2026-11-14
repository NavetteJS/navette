// HTML from application data: an allowlist sanitizer (configurable with `HtmlSanitizerConfig`), URL checks, and a small
// Markdown renderer whose output is safe by construction.

/** Elements removed together with their content, whatever the configuration: they can run code or hide markup. */
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'textarea', 'title', 'noscript', 'svg', 'math', 'select', 'head', 'frame', 'frameset', 'applet', 'noembed', 'xmp', 'plaintext']);
/** Elements that can never be allowed: code, plugins, frames, forms and document-level elements. */
const FORBIDDEN_ELEMENTS = new Set([...DROPPED, 'base', 'link', 'meta', 'form', 'input', 'button', 'option', 'optgroup', 'html', 'body', 'portal', 'fencedframe', 'param', 'dialog']);
/** Attributes holding a URL: links (`href`, `cite`) and media (`src`, `poster`) follow the scheme rules; the others are never kept. */
const LINK_ATTRIBUTES = new Set(['href', 'cite']);
const MEDIA_ATTRIBUTES = new Set(['src', 'poster']);
const FORBIDDEN_ATTRIBUTES = new Set(['action', 'formaction', 'srcset', 'imagesrcset', 'xlink:href', 'background', 'ping', 'data', 'codebase', 'dynsrc', 'lowsrc', 'srcdoc', 'is', 'nonce']);
const VOID = new Set(['area', 'br', 'col', 'hr', 'img', 'source', 'track', 'wbr']);
const ATTRIBUTE_NAME = /^[a-z][a-z0-9_.:-]*$/;
const ELEMENT_NAME = /^[a-z][a-z0-9-]*$/;

/** Navette's default allowlist: formatting elements, lists, headings, code and links. */
const DEFAULT_ELEMENTS: Record<string, string[]> = {
    a: ['href', 'title'], abbr: ['title'], b: [], blockquote: [], br: [], code: [], del: [], div: [], em: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    hr: [], i: [], kbd: [], li: [], mark: [], ol: ['start'], p: [], pre: [], s: [], small: [], span: [], strong: [], sub: [], sup: [], u: [], ul: [],
};
/** `allowSafeElements()`: elements that cannot run code, with their safe attributes (as Symfony's HtmlSanitizer). */
const SAFE_ELEMENTS: Record<string, string[]> = {
    a: ['href', 'title', 'hreflang'], abbr: ['title'], address: [], article: [], aside: [], b: [], bdi: [], bdo: [], blockquote: ['cite'], br: [], caption: [], cite: [], code: [], col: ['span'], colgroup: ['span'],
    data: ['value'], dd: [], del: ['cite', 'datetime'], details: ['open'], dfn: ['title'], div: [], dl: [], dt: [], em: [], figcaption: [], figure: [], footer: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    header: [], hgroup: [], hr: [], i: [], img: ['src', 'alt', 'title', 'width', 'height', 'loading'], ins: ['cite', 'datetime'], kbd: [], li: ['value'], main: [], mark: [], nav: [], ol: ['start', 'reversed', 'type'], p: [], pre: [],
    q: ['cite'], rp: [], rt: [], ruby: [], s: [], samp: [], section: [], small: [], span: [], strong: [], sub: [], summary: [], sup: [], table: [], tbody: [], td: ['colspan', 'rowspan', 'headers'], tfoot: [],
    th: ['colspan', 'rowspan', 'headers', 'scope', 'abbr'], thead: [], time: ['datetime'], tr: [], u: [], ul: [], var: [], wbr: [],
};
/** `allowSafeElements()` also allows these attributes on every element. */
const SAFE_GLOBAL_ATTRIBUTES = ['title', 'lang', 'dir'];

export type HtmlSanitizerConfigOptions = {
    elements: Map<string, Set<string>>;
    globalAttributes: Set<string>;
    blocked: Set<string>;
    dropped: Set<string>;
    droppedAttributes: Map<string, Set<string>>;
    forced: Map<string, Map<string, string>>;
    linkSchemes: string[];
    mediaSchemes: string[];
    linkHosts: string[] | null;
    mediaHosts: string[] | null;
    relativeLinks: boolean;
    relativeMedias: boolean;
    forceHttps: boolean;
    maxInputLength: number;
    linkRel: string | null;
};

/**
 * What `sanitizeHtml()` keeps: Navette's equivalent of Symfony's `HtmlSanitizerConfig`, which Filament configures. Each
 * method returns a new configuration. Event handler attributes (`on…`), `<script>`, `<style>`, frames, plugins and forms
 * can never be allowed, and URL attributes always follow the scheme allowlists: `javascript:` is only kept if you add it
 * to `allowLinkSchemes()` yourself.
 *
 * ```ts
 * useHtmlSanitizerConfig((config) => config.allowAttribute('class', '*'));
 * ```
 */
export class HtmlSanitizerConfig {
    readonly #options: HtmlSanitizerConfigOptions;
    constructor(options?: Partial<HtmlSanitizerConfigOptions>) {
        this.#options = {
            elements: new Map(), globalAttributes: new Set(), blocked: new Set(), dropped: new Set(), droppedAttributes: new Map(), forced: new Map(),
            linkSchemes: ['http', 'https', 'mailto', 'tel'], mediaSchemes: ['http', 'https', 'data'], linkHosts: null, mediaHosts: null,
            relativeLinks: false, relativeMedias: false, forceHttps: false, maxInputLength: 20_000_000, linkRel: null,
            ...options,
        };
    }
    /** An empty configuration: nothing is allowed until you allow it (as Symfony's `new HtmlSanitizerConfig()`). */
    static make(): HtmlSanitizerConfig { return new HtmlSanitizerConfig(); }
    /** Navette's default: formatting elements, lists, headings, code, and links to http(s), `mailto:` or relative URLs, with `rel="noopener noreferrer nofollow"`. */
    static default(): HtmlSanitizerConfig {
        let config = new HtmlSanitizerConfig({ linkSchemes: ['http', 'https', 'mailto'], relativeLinks: true, linkRel: 'noopener noreferrer nofollow', maxInputLength: 500_000 });
        for (const [element, attributes] of Object.entries(DEFAULT_ELEMENTS)) config = config.allowElement(element, attributes);
        return config;
    }
    #with(change: (options: HtmlSanitizerConfigOptions) => void): HtmlSanitizerConfig {
        const o = this.#options;
        const copy: HtmlSanitizerConfigOptions = {
            ...o, elements: new Map([...o.elements].map(([k, v]) => [k, new Set(v)])), globalAttributes: new Set(o.globalAttributes), blocked: new Set(o.blocked), dropped: new Set(o.dropped),
            droppedAttributes: new Map([...o.droppedAttributes].map(([k, v]) => [k, new Set(v)])), forced: new Map([...o.forced].map(([k, v]) => [k, new Map(v)])),
            linkSchemes: [...o.linkSchemes], mediaSchemes: [...o.mediaSchemes], linkHosts: o.linkHosts ? [...o.linkHosts] : null, mediaHosts: o.mediaHosts ? [...o.mediaHosts] : null,
        };
        change(copy);
        return new HtmlSanitizerConfig(copy);
    }
    /** Allows the elements that cannot run code (formatting, lists, tables, images, quotes…) and their safe attributes. */
    allowSafeElements(): HtmlSanitizerConfig {
        let config: HtmlSanitizerConfig = this;
        for (const [element, attributes] of Object.entries(SAFE_ELEMENTS)) config = config.allowElement(element, [...attributes, ...SAFE_GLOBAL_ATTRIBUTES]);
        return config;
    }
    /** Same as `allowSafeElements()`: the elements Symfony calls "static" are already in that list. */
    allowStaticElements(): HtmlSanitizerConfig { return this.allowSafeElements(); }
    /** Allows an element, with these attributes (`'*'`: its safe attributes and those allowed on every element). */
    allowElement(element: string, attributes: string[] | '*' = []): HtmlSanitizerConfig {
        const name = checkElement(element);
        const list = attributes === '*' ? [...(SAFE_ELEMENTS[name] ?? []), ...SAFE_GLOBAL_ATTRIBUTES] : attributes.map(checkAttribute);
        return this.#with((o) => { o.elements.set(name, new Set([...(o.elements.get(name) ?? []), ...list])); o.blocked.delete(name); o.dropped.delete(name); });
    }
    /** Removes the element's tags but keeps its content. */
    blockElement(element: string): HtmlSanitizerConfig { const name = checkName(element); return this.#with((o) => { o.elements.delete(name); o.dropped.delete(name); o.blocked.add(name); }); }
    /** Removes the element with its content. */
    dropElement(element: string): HtmlSanitizerConfig { const name = checkName(element); return this.#with((o) => { o.elements.delete(name); o.blocked.delete(name); o.dropped.add(name); }); }
    /** Allows an attribute on some elements (`'*'`: every allowed element). The elements themselves must be allowed. */
    allowAttribute(attribute: string, elements: string | string[] = '*'): HtmlSanitizerConfig {
        const name = checkAttribute(attribute);
        const targets = elements === '*' ? null : (Array.isArray(elements) ? elements : [elements]).map(checkName);
        return this.#with((o) => {
            if (targets === null) o.globalAttributes.add(name);
            else for (const element of targets) o.elements.set(element, new Set([...(o.elements.get(element) ?? []), name]));
            for (const element of targets ?? ['*']) o.droppedAttributes.get(element)?.delete(name);
        });
    }
    /** Removes an attribute from some elements (`'*'`: all of them), even when another rule allows it. */
    dropAttribute(attribute: string, elements: string | string[] = '*'): HtmlSanitizerConfig {
        const name = attribute.toLowerCase();
        const targets = elements === '*' ? ['*'] : (Array.isArray(elements) ? elements : [elements]).map(checkName);
        return this.#with((o) => { for (const element of targets) o.droppedAttributes.set(element, new Set([...(o.droppedAttributes.get(element) ?? []), name])); });
    }
    /** Sets an attribute on every occurrence of an element, replacing any value from the input (`forceAttribute('a', 'rel', 'noopener')`). */
    forceAttribute(element: string, attribute: string, value: string): HtmlSanitizerConfig {
        const name = checkElement(element), attr = checkAttribute(attribute);
        if (LINK_ATTRIBUTES.has(attr) || MEDIA_ATTRIBUTES.has(attr)) throw new Error(`forceAttribute(): "${attr}" holds a URL and cannot be forced.`);
        return this.#with((o) => { o.forced.set(name, new Map([...(o.forced.get(name) ?? []), [attr, String(value)]])); });
    }
    /** Schemes allowed in links (`href`, `cite`); `['http', 'https', 'mailto', 'tel']` by default. Replaces the list. */
    allowLinkSchemes(schemes: string[]): HtmlSanitizerConfig { const list = schemes.map(checkScheme); return this.#with((o) => { o.linkSchemes = list; }); }
    /** Schemes allowed in media (`src`, `poster`); `['http', 'https', 'data']` by default. Replaces the list. */
    allowMediaSchemes(schemes: string[]): HtmlSanitizerConfig { const list = schemes.map(checkScheme); return this.#with((o) => { o.mediaSchemes = list; }); }
    /** Hosts allowed in absolute links (`null`: any host). */
    allowLinkHosts(hosts: string[] | null): HtmlSanitizerConfig { return this.#with((o) => { o.linkHosts = hosts?.map((host) => host.toLowerCase()) ?? null; }); }
    /** Hosts allowed in absolute media URLs (`null`: any host). */
    allowMediaHosts(hosts: string[] | null): HtmlSanitizerConfig { return this.#with((o) => { o.mediaHosts = hosts?.map((host) => host.toLowerCase()) ?? null; }); }
    /** Keeps links without a scheme (`/orders/1`, `#top`, `page.html`). */
    allowRelativeLinks(condition = true): HtmlSanitizerConfig { return this.#with((o) => { o.relativeLinks = condition; }); }
    /** Keeps media URLs without a scheme (`/storage/photo.jpg`). */
    allowRelativeMedias(condition = true): HtmlSanitizerConfig { return this.#with((o) => { o.relativeMedias = condition; }); }
    /** Rewrites `http:` links and media URLs to `https:`. */
    forceHttpsUrls(condition = true): HtmlSanitizerConfig { return this.#with((o) => { o.forceHttps = condition; }); }
    /** Longer input is cut at this length before it is sanitized. */
    withMaxInputLength(length: number): HtmlSanitizerConfig {
        if (!Number.isInteger(length) || length < 1) throw new Error('withMaxInputLength(): expected a positive integer.');
        return this.#with((o) => { o.maxInputLength = length; });
    }
    /** `rel` added to links that have an `href` (`null`: none). */
    withLinkRel(rel: string | null): HtmlSanitizerConfig { return this.#with((o) => { o.linkRel = rel; }); }
    getMaxInputLength(): number { return this.#options.maxInputLength; }
    getLinkSchemes(): string[] { return [...this.#options.linkSchemes]; }
    getMediaSchemes(): string[] { return [...this.#options.mediaSchemes]; }
    getAllowedElements(): Record<string, string[]> { return Object.fromEntries([...this.#options.elements].map(([element, attributes]) => [element, [...attributes]])); }
    /** Whether an element is kept, its content only, or dropped with its content. */
    elementMode(element: string): 'allow' | 'block' | 'drop' {
        const o = this.#options;
        if (DROPPED.has(element) || o.dropped.has(element)) return 'drop';
        return o.elements.has(element) ? 'allow' : 'block';
    }
    /** Whether an attribute is kept on an element. */
    isAttributeAllowed(element: string, attribute: string): boolean {
        const o = this.#options;
        if (attribute.startsWith('on') || FORBIDDEN_ATTRIBUTES.has(attribute)) return false;
        if (o.droppedAttributes.get('*')?.has(attribute) || o.droppedAttributes.get(element)?.has(attribute)) return false;
        const own = o.elements.get(element);
        return own !== undefined && (own.has(attribute) || o.globalAttributes.has(attribute));
    }
    /** The value to write for a URL attribute, or `null` when the URL is not allowed. */
    checkUrl(attribute: string, value: string): string | null {
        const o = this.#options;
        const media = MEDIA_ATTRIBUTES.has(attribute);
        const url = checkUrl(value, { schemes: media ? o.mediaSchemes : o.linkSchemes, allowRelative: media ? o.relativeMedias : o.relativeLinks, hosts: media ? o.mediaHosts : o.linkHosts });
        if (url === null) return null;
        return o.forceHttps ? url.replace(/^http:/i, 'https:') : url;
    }
    isUrlAttribute(attribute: string): boolean { return LINK_ATTRIBUTES.has(attribute) || MEDIA_ATTRIBUTES.has(attribute); }
    getForcedAttributes(element: string): [string, string][] { return [...(this.#options.forced.get(element) ?? [])]; }
    getLinkRel(): string | null { return this.#options.linkRel; }
}
function checkName(element: string): string {
    const name = String(element).toLowerCase();
    if (!ELEMENT_NAME.test(name)) throw new Error(`Invalid element name: ${element}`);
    return name;
}
function checkElement(element: string): string {
    const name = checkName(element);
    if (FORBIDDEN_ELEMENTS.has(name)) throw new Error(`The <${name}> element can run code or submit data: it cannot be allowed by the HTML sanitizer.`);
    return name;
}
function checkAttribute(attribute: string): string {
    const name = String(attribute).toLowerCase();
    if (!ATTRIBUTE_NAME.test(name)) throw new Error(`Invalid attribute name: ${attribute}`);
    if (name.startsWith('on')) throw new Error(`The "${name}" attribute is an event handler: it cannot be allowed by the HTML sanitizer.`);
    if (FORBIDDEN_ATTRIBUTES.has(name)) throw new Error(`The "${name}" attribute cannot be allowed by the HTML sanitizer.`);
    return name;
}
function checkScheme(scheme: string): string {
    const name = String(scheme).toLowerCase().replace(/:$/, '');
    if (!/^[a-z][a-z0-9+.-]*$/.test(name)) throw new Error(`Invalid URL scheme: ${scheme}`);
    return name;
}

let defaultConfig: HtmlSanitizerConfig | null = null;
let customized = false;
/** The configuration used by `sanitizeHtml()` when none is given. */
export function getHtmlSanitizerConfig(): HtmlSanitizerConfig { return (defaultConfig ??= HtmlSanitizerConfig.default()); }
/**
 * Replaces the process-wide configuration of `sanitizeHtml()` (Filament: binding or extending `HtmlSanitizerConfig` in the
 * container). A function receives the current one and returns the new one; `null` restores Navette's default.
 */
export function useHtmlSanitizerConfig(config: HtmlSanitizerConfig | ((current: HtmlSanitizerConfig) => HtmlSanitizerConfig) | null): void {
    if (config === null) { defaultConfig = null; customized = false; return; }
    defaultConfig = typeof config === 'function' ? config(getHtmlSanitizerConfig()) : config;
    if (!(defaultConfig instanceof HtmlSanitizerConfig)) throw new Error('useHtmlSanitizerConfig(): expected an HtmlSanitizerConfig.');
    customized = true;
}
/** Whether the application set its own configuration with `useHtmlSanitizerConfig()`. */
export function hasCustomHtmlSanitizerConfig(): boolean { return customized; }

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Text between tags: entities are kept, anything else that could start markup is escaped. */
const escapeText = (text: string) => text.replace(/&(?!(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeEntities = (value: string) => value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Math.min(Number.parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
    .replace(/&colon;/gi, ':').replace(/&tab;/gi, '\t').replace(/&newline;/gi, '\n').replace(/&amp;/gi, '&');

/** Checks a URL against schemes (and hosts). Returns the decoded URL as the browser reads it, or `null`. */
function checkUrl(value: string, options: { schemes: string[]; allowRelative: boolean; hosts?: string[] | null }): string | null {
    const decoded = decodeEntities(String(value ?? ''));
    // Browsers ignore control characters and spaces inside the scheme: `java\tscript:` is `javascript:`.
    const url = decoded.replace(/[\u0000- \u007f-\u009f]/g, '');
    if (url.startsWith('//') || url.startsWith('\\\\') || /^\/\\|^\\\//.test(url)) return null;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
    if (!scheme) {
        // No scheme at all: a colon may only appear after a `/`, `?` or `#`.
        if (/^[^/?#]*:/.test(url)) return null;
        return options.allowRelative ? decoded : null;
    }
    if (!options.schemes.includes(scheme[1].toLowerCase())) return null;
    if (options.hosts && /^https?:$/i.test(`${scheme[1]}:`)) {
        let host: string;
        try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
        if (!options.hosts.includes(host)) return null;
    }
    return decoded;
}

/**
 * Whether a URL can be put in a link: http(s), `mailto:`, site paths, anchors and relative paths by default; never
 * `javascript:`, `data:` or another scheme. `schemes` replaces the allowed schemes; `allowRelative: false` refuses URLs
 * without a scheme. Entities and control characters are decoded first, as the browser does.
 */
export function isSafeUrl(value: string, options: { schemes?: string[]; allowRelative?: boolean } = {}): boolean {
    return checkUrl(value, { schemes: (options.schemes ?? ['http', 'https', 'mailto']).map(checkScheme), allowRelative: options.allowRelative ?? true }) !== null;
}

/**
 * The URL when it has no scheme (relative) or one of the allowed schemes (`http` and `https` by default), otherwise
 * `null` (Filament's `Str::sanitizeUrl()`). URLs with control characters or raw whitespace are refused. The value is
 * returned unchanged: it still has to be escaped when it is written into HTML (Navette's components do).
 */
export function sanitizeUrl(url: string | null | undefined, allowedSchemes: string[] = ['http', 'https']): string | null {
    if (typeof url !== 'string' || url === '') return null;
    if (/[\u0000- \u007f-\u009f]/.test(decodeEntities(url))) return null;
    return checkUrl(url, { schemes: allowedSchemes.map(checkScheme), allowRelative: true }) === null ? null : url;
}

/**
 * Keeps only what the configuration allows (Navette's default: formatting elements, lists, headings, code and links). No
 * event handler, `<script>`, `<style>`, frame or form ever survives, and URLs only keep allowed schemes.
 */
export function sanitizeHtml(html: string, config: HtmlSanitizerConfig = getHtmlSanitizerConfig()): string {
    const out: string[] = [];
    const open: string[] = [];
    const source = String(html ?? '').slice(0, config.getMaxInputLength());
    let position = 0;
    while (position < source.length) {
        const next = source.indexOf('<', position);
        if (next < 0) { out.push(escapeText(source.slice(position))); break; }
        out.push(escapeText(source.slice(position, next)));
        position = next;
        const rest = source.slice(position);
        if (rest.startsWith('<!--')) { const end = source.indexOf('-->', position + 4); position = end < 0 ? source.length : end + 3; continue; }
        const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/.exec(rest);
        if (!tag) { out.push('&lt;'); position++; continue; }
        position += tag[0].length;
        const [, closing, rawName, rawAttributes] = tag;
        const name = rawName.toLowerCase();
        const mode = config.elementMode(name);
        if (mode === 'drop') {
            if (!closing && !/\/\s*$/.test(rawAttributes)) {
                const end = source.toLowerCase().indexOf(`</${name}`, position);
                position = end < 0 ? source.length : (source.indexOf('>', end) < 0 ? source.length : source.indexOf('>', end) + 1);
            }
            continue;
        }
        if (mode === 'block') continue;
        if (closing) {
            const index = open.lastIndexOf(name);
            if (index >= 0) while (open.length > index) out.push(`</${open.pop()}>`);
            continue;
        }
        const attributes: string[] = [];
        const seen = new Set<string>();
        const forced = config.getForcedAttributes(name);
        for (const match of rawAttributes.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) {
            const attribute = match[1].toLowerCase();
            const value = match[2] ?? match[3] ?? match[4] ?? '';
            if (seen.has(attribute) || !config.isAttributeAllowed(name, attribute) || forced.some(([forcedName]) => forcedName === attribute)) continue;
            // The link rel of the configuration replaces the input's.
            if (name === 'a' && attribute === 'rel' && config.getLinkRel()) continue;
            if (attribute === 'start' && !/^\d{1,9}$/.test(value)) continue;
            let written = decodeEntities(value);
            if (config.isUrlAttribute(attribute)) {
                const checked = config.checkUrl(attribute, value);
                if (checked === null) continue;
                written = checked;
            }
            seen.add(attribute);
            attributes.push(`${attribute}="${escapeAttribute(written)}"`);
        }
        for (const [attribute, value] of forced) attributes.push(`${attribute}="${escapeAttribute(value)}"`);
        const rel = config.getLinkRel();
        if (name === 'a' && rel && seen.has('href') && !forced.some(([attribute]) => attribute === 'rel')) attributes.push(`rel="${escapeAttribute(rel)}"`);
        out.push(`<${name}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`);
        if (!VOID.has(name)) open.push(name);
    }
    while (open.length) out.push(`</${open.pop()}>`);
    return out.join('');
}

// ------------------------------------------------------------------ Markdown
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Inline Markdown: code spans, links, bold, italic, strikethrough and hard line breaks. The text is escaped first. */
function inlineMarkdown(source: string): string {
    const codes: string[] = [];
    let text = source.replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(`<code>${escapeHtml(code)}</code>`) - 1}\u0000`);
    text = escapeHtml(text);
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, label, href, title) => {
        const url = href.replace(/&amp;/g, '&');
        if (!isSafeUrl(url)) return label;
        return `<a href="${escapeHtml(url)}"${title ? ` title="${title}"` : ''} rel="noopener noreferrer nofollow">${label}</a>`;
    });
    // Bare URLs become links; they stop before an escaped quote or angle bracket.
    text = text.replace(/(^|[\s(])(https?:\/\/(?:(?!&quot;|&lt;|&gt;)[^\s<])*(?:(?!&quot;|&lt;|&gt;)[^\s<.,;:!?)]))/g, (_, before, url) => `${before}<a href="${url}" rel="noopener noreferrer nofollow">${url}</a>`);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, '$1<em>$2</em>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/(?: {2,}|\\)\n/g, '<br>\n');
    return text.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

/**
 * Renders Markdown (paragraphs, headings, lists, quotes, code blocks, emphasis, links). Raw HTML is never passed through:
 * it is shown as text. Links only keep safe URLs.
 */
export function markdownToHtml(markdown: string): string {
    const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out: string[] = [];
    let index = 0;
    const isBlockStart = (line: string) => /^(#{1,6}\s|>\s?|```|\s*([-*+]|\d{1,9}[.)])\s+|\s*([-*_])(\s*\3){2,}\s*$)/.test(line);
    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === '') { index++; continue; }
        if (line.startsWith('```')) {
            const code: string[] = [];
            index++;
            while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
            index++;
            out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
            continue;
        }
        const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
        if (heading) { out.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`); index++; continue; }
        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); index++; continue; }
        if (/^>\s?/.test(line)) {
            const quote: string[] = [];
            while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
            out.push(`<blockquote>${markdownToHtml(quote.join('\n'))}</blockquote>`);
            continue;
        }
        const listItem = /^\s*([-*+]|(\d{1,9})[.)])\s+(.*)$/.exec(line);
        if (listItem) {
            const ordered = listItem[2] !== undefined;
            const items: string[] = [];
            while (index < lines.length) {
                const match = /^\s*([-*+]|(\d{1,9})[.)])\s+(.*)$/.exec(lines[index]);
                if (!match || (match[2] !== undefined) !== ordered) break;
                items.push(`<li>${inlineMarkdown(match[3])}</li>`);
                index++;
            }
            const start = ordered && listItem[2] !== '1' ? ` start="${Number(listItem[2])}"` : '';
            out.push(ordered ? `<ol${start}>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
            continue;
        }
        const paragraph: string[] = [];
        while (index < lines.length && lines[index].trim() !== '' && (paragraph.length === 0 || !isBlockStart(lines[index]))) paragraph.push(lines[index++]);
        out.push(`<p>${inlineMarkdown(paragraph.join('\n'))}</p>`);
    }
    return out.join('');
}
