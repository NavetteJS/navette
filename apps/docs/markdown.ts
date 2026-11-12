// Convertisseur du sous-ensemble Markdown décrit dans WRITING.md : titres, paragraphes, emphase, code, liens,
// listes (un niveau d'imbrication), blocs de code, tableaux et encarts <Aside>. Aucun HTML brut n'est accepté.

export type Heading = { level: number; text: string; id: string };
export type Rendered = { html: string; headings: Heading[]; text: string; previews: string[] };

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ancre d'un titre : texte en minuscules, ponctuation retirée, espaces en tirets (règle de WRITING.md). */
export function slugify(text: string): string {
    return text.toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

/** Texte brut d'une ligne Markdown en ligne (pour les ancres, le sommaire et la recherche). */
export const plain = (text: string) => text.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

/** Éléments en ligne : code, liens, gras, italique. Le texte est échappé avant toute mise en forme. */
export function inline(source: string): string {
    const codes: string[] = [];
    let text = source.replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(`<code>${escape(code)}</code>`) - 1}\u0000`);
    text = escape(text);
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
        const url = href.replace(/&amp;/g, '&');
        // Seules les adresses du site, les ancres et http(s) deviennent des liens.
        if (!/^(\/|#|https?:\/\/)/.test(url)) return label;
        const external = /^https?:\/\//.test(url);
        return `<a href="${escape(url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, '$1<em>$2</em>');
    return text.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

// ------------------------------------------------------------------ coloration syntaxique
const KEYWORDS: Record<string, string[]> = {
    ts: ['import', 'from', 'export', 'default', 'const', 'let', 'var', 'class', 'extends', 'implements', 'interface', 'type', 'static', 'async', 'await', 'return', 'new', 'if', 'else', 'for', 'of', 'in', 'while', 'function', 'this', 'super', 'true', 'false', 'null', 'undefined', 'as', 'typeof', 'keyof', 'readonly', 'private', 'protected', 'public', 'abstract', 'throw', 'try', 'catch', 'void', 'satisfies'],
    bash: ['npm', 'node', 'npx', 'cd', 'mkdir', 'export', 'git'],
    css: [],
    json: ['true', 'false', 'null'],
    html: [],
};
KEYWORDS.js = KEYWORDS.ts;

/** Coloration simple par jetons : commentaires, chaînes, nombres, mots-clés, appels et propriétés. */
export function highlight(code: string, language: string): string {
    const lang = language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language === 'sh' || language === 'shell' ? 'bash' : language;
    if (lang === 'html') return escape(code).replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-tag">$2</span>').replace(/([\w:-]+)=(&quot;[^&]*&quot;)/g, '<span class="tok-attr">$1</span>=<span class="tok-string">$2</span>');
    const keywords = new Set(KEYWORDS[lang] ?? []);
    const patterns: [string, RegExp][] = [
        ['comment', lang === 'bash' ? /#[^\n]*/y : lang === 'css' ? /\/\*[\s\S]*?\*\//y : /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
        ['string', /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
        ['number', /\b\d+(?:\.\d+)?\b/y],
        ['word', /[A-Za-z_$][\w$-]*/y],
        ['other', /[\s\S]/y],
    ];
    let out = '';
    let position = 0;
    while (position < code.length) {
        for (const [kind, pattern] of patterns) {
            pattern.lastIndex = position;
            const match = pattern.exec(code);
            if (!match) continue;
            const token = match[0];
            position += token.length;
            if (kind === 'word') {
                const next = code.slice(position).match(/^\s*\(/);
                const previous = code[position - token.length - 1];
                if (keywords.has(token)) out += `<span class="tok-keyword">${escape(token)}</span>`;
                else if (lang === 'css' && code.slice(position).match(/^\s*:/)) out += `<span class="tok-attr">${escape(token)}</span>`;
                else if (/^[A-Z]/.test(token) && lang !== 'bash') out += `<span class="tok-class">${escape(token)}</span>`;
                else if (next && lang !== 'bash') out += `<span class="tok-function">${escape(token)}</span>`;
                else if (previous === '.' && lang !== 'bash') out += `<span class="tok-property">${escape(token)}</span>`;
                else out += escape(token);
            } else if (kind === 'other') out += escape(token);
            else out += `<span class="tok-${kind}">${escape(token)}</span>`;
            break;
        }
    }
    return out;
}

// ------------------------------------------------------------------ blocs
const ASIDE_TITLES: Record<string, string> = { tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Danger' };

export function render(markdown: string): Rendered {
    const headings: Heading[] = [];
    const used = new Map<string, number>();
    const textParts: string[] = [];
    // Blocs ```preview : leur code n'est pas affiché ; un repère est laissé à leur place, remplacé au build par l'aperçu rendu.
    const previews: string[] = [];
    const uniqueId = (text: string) => {
        const base = slugify(text) || 'section';
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        return count ? `${base}-${count}` : base;
    };

    const renderBlocks = (lines: string[]): string => {
        const out: string[] = [];
        let index = 0;
        const isBlank = (line: string | undefined) => line === undefined || line.trim() === '';
        while (index < lines.length) {
            const line = lines[index];
            if (isBlank(line)) { index++; continue; }

            const fence = /^```(\w*)\s*$/.exec(line.trim());
            if (fence) {
                const indent = line.length - line.trimStart().length;
                const body: string[] = [];
                index++;
                while (index < lines.length && lines[index].trim() !== '```') { body.push(lines[index].slice(Math.min(indent, lines[index].length - lines[index].trimStart().length))); index++; }
                index++;
                const language = fence[1] || 'text';
                if (language === 'preview') { out.push(`<!--preview:${previews.push(body.join('\n')) - 1}-->`); continue; }
                textParts.push(body.join(' '));
                out.push(`<div class="code-block"><div class="code-head"><span>${escape(language)}</span><button type="button" class="copy" aria-label="Copy code">Copy</button></div><pre class="language-${escape(language)}"><code>${highlight(body.join('\n'), language)}</code></pre></div>`);
                continue;
            }

            const aside = /^<Aside(?:\s+variant="(tip|info|warning|danger)")?\s*>\s*$/.exec(line.trim());
            if (aside) {
                const body: string[] = [];
                index++;
                while (index < lines.length && lines[index].trim() !== '</Aside>') { body.push(lines[index]); index++; }
                index++;
                const variant = aside[1] ?? 'info';
                out.push(`<aside class="aside aside-${variant}"><p class="aside-title">${ASIDE_TITLES[variant]}</p>${renderBlocks(body)}</aside>`);
                continue;
            }

            const heading = /^(#{2,4})\s+(.+?)\s*#*$/.exec(line);
            if (heading) {
                const level = heading[1].length;
                const text = plain(heading[2]);
                const id = uniqueId(text);
                if (level <= 3) headings.push({ level, text, id });
                textParts.push(text);
                out.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inline(heading[2])}</h${level}>`);
                index++;
                continue;
            }

            if (/^\s*\|/.test(line) && lines[index + 1] && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1])) {
                const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
                const head = cells(line);
                const align = cells(lines[index + 1]).map((cell) => (cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : null));
                index += 2;
                const rows: string[][] = [];
                while (index < lines.length && /^\s*\|/.test(lines[index])) { rows.push(cells(lines[index])); index++; }
                const style = (column: number) => (align[column] ? ` style="text-align: ${align[column]}"` : '');
                textParts.push([...head, ...rows.flat()].map(plain).join(' '));
                out.push(`<div class="table-wrapper"><table><thead><tr>${head.map((cell, column) => `<th${style(column)}>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, column) => `<td${style(column)}>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
                continue;
            }

            if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
                const list = parseList(lines, index);
                index = list.end;
                out.push(list.html);
                continue;
            }

            const paragraph: string[] = [];
            while (index < lines.length && !isBlank(lines[index]) && !/^\s*(#{2,4}\s|```|<Aside|<\/Aside>|\|)/.test(lines[index]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
                paragraph.push(lines[index].trim());
                index++;
            }
            if (!paragraph.length) { paragraph.push(lines[index].trim()); index++; }
            textParts.push(plain(paragraph.join(' ')));
            out.push(`<p>${inline(paragraph.join(' '))}</p>`);
        }
        return out.join('\n');
    };

    /** Liste à partir de la ligne `start` : éléments au même retrait, sous-listes plus en retrait, lignes de continuation. */
    const parseList = (lines: string[], start: number): { html: string; end: number } => {
        const first = /^(\s*)([-*]|\d+\.)\s+/.exec(lines[start])!;
        const indent = first[1].length;
        const ordered = /\d/.test(first[2]);
        const items: string[][] = [];
        let index = start;
        while (index < lines.length) {
            const line = lines[index];
            const marker = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
            if (marker && marker[1].length === indent && /\d/.test(marker[2]) === ordered) { items.push([marker[3]]); index++; continue; }
            if (line.trim() === '') {
                // Une ligne vide termine la liste, sauf si l'élément suivant ou une continuation en retrait suit.
                const next = lines[index + 1];
                if (next !== undefined && (next.length - next.trimStart().length > indent) && next.trim() !== '') { items[items.length - 1].push(''); index++; continue; }
                const nextMarker = next !== undefined ? /^(\s*)([-*]|\d+\.)\s+/.exec(next) : null;
                if (nextMarker && nextMarker[1].length === indent) { index++; continue; }
                break;
            }
            if (line.length - line.trimStart().length > indent) { items[items.length - 1].push(line.slice(indent + 2)); index++; continue; }
            break;
        }
        const tag = ordered ? 'ol' : 'ul';
        const html = `<${tag}>${items.map((item) => {
            const [head, ...rest] = item;
            const nested = rest.length ? renderBlocks(rest) : '';
            textParts.push(plain(head));
            return `<li>${inline(head)}${nested ? `\n${nested}` : ''}</li>`;
        }).join('')}</${tag}>`;
        return { html, end: index };
    };

    const html = renderBlocks(markdown.replace(/\r\n/g, '\n').split('\n'));
    return { html, headings, text: textParts.join(' ').replace(/\s+/g, ' '), previews };
}

/** Front matter `---\ntitle: …\n---` : seul `title` est lu. */
export function frontMatter(source: string): { title: string | null; body: string } {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
    if (!match) return { title: null, body: source };
    const title = /^title:\s*(.+)$/m.exec(match[1])?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') ?? null;
    return { title, body: source.slice(match[0].length) };
}
