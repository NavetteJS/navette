// HTML from application data: an allowlist sanitizer, and a small Markdown renderer whose output is safe by construction.

/** Allowed elements and, for each one, its allowed attributes. Everything else is removed (the text inside is kept). */
const ALLOWED: Record<string, string[]> = {
    a: ['href', 'title'], abbr: ['title'], b: [], blockquote: [], br: [], code: [], del: [], div: [], em: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    hr: [], i: [], kbd: [], li: [], mark: [], ol: ['start'], p: [], pre: [], s: [], small: [], span: [], strong: [], sub: [], sup: [], u: [], ul: [],
};
const VOID = new Set(['br', 'hr']);
/** Elements removed together with their content. */
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'textarea', 'title', 'noscript', 'svg', 'math', 'select', 'head', 'frame', 'frameset', 'applet', 'noembed', 'xmp', 'plaintext']);

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Text between tags: entities are kept, anything else that could start markup is escaped. */
const escapeText = (text: string) => text.replace(/&(?!(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeEntities = (value: string) => value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Math.min(Number.parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
    .replace(/&colon;/gi, ':').replace(/&tab;/gi, '\t').replace(/&newline;/gi, '\n').replace(/&amp;/gi, '&');
/** Link targets: http(s), mailto, site paths, anchors and relative paths; never `javascript:`, `data:` or another scheme. */
export function isSafeUrl(value: string): boolean {
    const url = decodeEntities(value).replace(/[\u0000- \u007f-\u009f]/g, '');
    if (/^(https?:|mailto:)/i.test(url)) return true;
    if (url.startsWith('//')) return false;
    // No scheme at all: a colon may only appear after a `/`, `?` or `#`.
    return !/^[^/?#]*:/.test(url);
}

/**
 * Removes everything but a small set of formatting elements (paragraphs, emphasis, lists, links, headings, code...) and
 * their safe attributes. No `style`, `class`, event handler, image or form survives, and links only keep safe URLs.
 */
export function sanitizeHtml(html: string): string {
    const out: string[] = [];
    const open: string[] = [];
    const source = String(html ?? '');
    let position = 0;
    while (position < source.length) {
        const next = source.indexOf('<', position);
        if (next < 0) { out.push(escapeText(source.slice(position))); break; }
        out.push(escapeText(source.slice(position, next)));
        position = next;
        const rest = source.slice(position);
        if (rest.startsWith('<!--')) { const end = source.indexOf('-->', position + 4); position = end < 0 ? source.length : end + 3; continue; }
        const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/.exec(rest);
        if (!tag) { out.push('&lt;'); position++; continue; }
        position += tag[0].length;
        const [, closing, rawName, rawAttributes] = tag;
        const name = rawName.toLowerCase();
        if (DROPPED.has(name)) {
            if (!closing) {
                const end = source.toLowerCase().indexOf(`</${name}`, position);
                position = end < 0 ? source.length : (source.indexOf('>', end) < 0 ? source.length : source.indexOf('>', end) + 1);
            }
            continue;
        }
        if (!Object.hasOwn(ALLOWED, name)) continue;
        if (closing) {
            const index = open.lastIndexOf(name);
            if (index >= 0) while (open.length > index) out.push(`</${open.pop()}>`);
            continue;
        }
        const attributes: string[] = [];
        for (const match of rawAttributes.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) {
            const attribute = match[1].toLowerCase();
            const value = match[2] ?? match[3] ?? match[4] ?? '';
            if (!ALLOWED[name].includes(attribute) || attributes.some((existing) => existing.startsWith(`${attribute}=`))) continue;
            if (attribute === 'href' && !isSafeUrl(value)) continue;
            if (attribute === 'start' && !/^\d{1,9}$/.test(value)) continue;
            attributes.push(`${attribute}="${escapeAttribute(decodeEntities(value))}"`);
        }
        if (name === 'a' && attributes.some((attribute) => attribute.startsWith('href='))) attributes.push('rel="noopener noreferrer nofollow"');
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
