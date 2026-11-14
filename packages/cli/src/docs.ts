// `navette docs`: the documentation of the installed version, offline and searchable. The Markdown pages ship with the
// package (`docs/`, written at release time); in the repository they come from the built site (`apps/docs/dist`).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DocEntry = { path: string; title: string; section: string[]; description: string };
export type Docs = { dir: string; version: string; pages: DocEntry[] };
export type SearchResult = { page: DocEntry; score: number; snippets: { line: number; text: string }[] };

/** Directory holding `pages.json` and the `.md` pages: `NAVETTE_DOCS_DIR`, the package's `docs/`, or the repository's built site. */
export function docsDirectory(): string | null {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [process.env.NAVETTE_DOCS_DIR, path.join(here, '..', 'docs'), path.join(here, '..', '..', '..', 'apps', 'docs', 'dist')];
    return candidates.find((dir) => dir && existsSync(path.join(dir, 'pages.json'))) ?? null;
}

export function loadDocs(dir: string): Docs {
    const manifest = JSON.parse(readFileSync(path.join(dir, 'pages.json'), 'utf8')) as { version: string; pages: DocEntry[] };
    return { dir, version: manifest.version, pages: manifest.pages };
}

const cache = new Map<string, string>();
export function pageMarkdown(docs: Docs, page: DocEntry): string {
    const file = path.join(docs.dir, ...page.path.split('/')) + '.md';
    if (!cache.has(file)) cache.set(file, readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    return cache.get(file)!;
}

const label = (page: DocEntry) => [...page.section, page.title].join(' / ');

/** Sections and their pages. */
export function formatList(docs: Docs, options: { descriptions?: boolean } = {}): string {
    const out = [`Navette ${docs.version} documentation: ${docs.pages.length} pages`];
    let section = '';
    const width = Math.min(48, Math.max(...docs.pages.map((page) => page.path.length)));
    for (const page of docs.pages) {
        if (page.section[0] !== section) { section = page.section[0]; out.push('', `${section}`); }
        const title = [...page.section.slice(1), page.title].join(' / ');
        out.push(`  ${page.path.padEnd(width)}  ${title}${options.descriptions ? `\n  ${' '.repeat(width)}  ${page.description}` : ''}`);
    }
    out.push('', 'Search: npx navette docs search <terms>   Read a page: npx navette docs show <page>', `Markdown files: ${docs.dir}`);
    return out.join('\n');
}

const termsOf = (query: string) => [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
/** Case-insensitive match of a term at the start of a word (`table` finds "tables", not "repeatable"). */
const matchers = new Map<string, RegExp>();
const matcher = (term: string) => {
    if (!matchers.has(term)) matchers.set(term, new RegExp(`${/^[\p{L}\p{N}]/u.test(term) ? '(?<![\\p{L}\\p{N}])' : ''}${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu'));
    return matchers.get(term)!;
};
const count = (text: string, term: string) => Math.min(20, text.match(new RegExp(matcher(term).source, 'giu'))?.length ?? 0);

/**
 * Pages containing every term at the start of a word (or, when none does, any term), best first: matches in the title, path, section and
 * description weigh more than in headings, which weigh more than in the text. Each result has up to `snippets` matching lines.
 */
export function searchDocs(docs: Docs, query: string, options: { limit?: number; snippets?: number } = {}): SearchResult[] {
    const terms = termsOf(query);
    if (!terms.length) return [];
    const scored = docs.pages.map((page) => {
        const markdown = pageMarkdown(docs, page);
        const lower = markdown.toLowerCase();
        const lines = lower.split('\n');
        const title = page.title.toLowerCase();
        const fields = { path: page.path.toLowerCase(), section: page.section.join(' ').toLowerCase(), description: page.description.toLowerCase() };
        const segments = page.path.split('/');
        let matched = 0;
        let score = 0;
        for (const term of terms) {
            const inBody = count(lower, term);
            const has = (text: string) => matcher(term).test(text);
            const inHeadings = lines.filter((line) => line.startsWith('#') && has(line)).length;
            const hit = inBody + Number(has(title)) + Number(has(fields.path)) + Number(has(fields.section));
            if (!hit) continue;
            matched++;
            // The overview of a section named after the term is its entry point.
            const overview = segments.at(-1) === 'overview' && segments.slice(0, -1).some((segment) => segment === term || segment === `${term}s`);
            score += (has(title) ? 20 : 0) + (has(fields.path) ? 8 : 0) + (has(fields.section) ? 5 : 0) + (overview ? 30 : 0)
                + (has(fields.description) ? 4 : 0) + Math.min(inHeadings, 5) * 3 + inBody;
        }
        if (terms.length > 1 && lower.includes(terms.join(' '))) score += 10;
        if (title === terms.join(' ')) score += 30;
        return { page, matched, score, lines: markdown.split('\n') };
    }).filter((result) => result.matched > 0);
    const all = scored.filter((result) => result.matched === terms.length);
    const pool = all.length ? all : scored;
    pool.sort((a, b) => b.matched - a.matched || b.score - a.score || a.page.path.localeCompare(b.page.path));
    return pool.slice(0, options.limit ?? 10).map(({ page, score, lines }) => {
        const candidates = lines.map((text, index) => ({ line: index + 1, text, hits: terms.filter((term) => matcher(term).test(text)).length }))
            .filter((line) => line.hits > 0 && line.line > 1);
        candidates.sort((a, b) => b.hits - a.hits || Number(b.text.startsWith('#')) - Number(a.text.startsWith('#')) || a.line - b.line);
        const snippets = candidates.slice(0, options.snippets ?? 3).sort((a, b) => a.line - b.line).map(({ line, text }) => ({ line, text: excerpt(text.trim(), terms) }));
        return { page, score, snippets };
    });
}

/** At most 160 characters of a line, around its first match. */
function excerpt(text: string, terms: string[]): string {
    if (text.length <= 160) return text;
    const at = Math.min(...terms.map((term) => text.search(matcher(term))).filter((index) => index >= 0));
    const start = Math.max(0, Math.min(at - 50, text.length - 160));
    return `${start > 0 ? '…' : ''}${text.slice(start, start + 158).trim()}${start + 158 < text.length ? '…' : ''}`;
}

export function formatResults(results: SearchResult[], query: string): string {
    if (!results.length) return `No page matches "${query}". List the pages with: npx navette docs`;
    const out = results.flatMap((result, index) => [
        `${index + 1}. ${label(result.page)}   (${result.page.path})`,
        `   ${result.page.description}`,
        ...result.snippets.map((snippet) => `   ${String(snippet.line).padStart(4)}: ${snippet.text}`),
        '',
    ]);
    out.push('Read a page: npx navette docs show <page>   (add #heading-anchor to print one section)');
    return out.join('\n');
}

/** Accepts `tables/columns/overview`, `/tables/columns/overview.md`, a full site URL, a unique suffix (`columns/overview`) or a title. */
export function resolvePage(docs: Docs, reference: string): { page: DocEntry | null; anchor: string | null; candidates: DocEntry[] } {
    let value = reference.trim();
    if (/^https?:\/\//.test(value)) { try { const url = new URL(value); value = url.pathname + url.hash; } catch { /* kept as is */ } }
    const [target, anchor = null] = value.split('#');
    const key = target.toLowerCase().replace(/\\/g, '/').replace(/(\/index)?(\.md|\.html)$/, '').replace(/^\/+|\/+$/g, '');
    const found = (page: DocEntry | undefined) => ({ page: page ?? null, anchor: anchor || null, candidates: [] });
    const exact = docs.pages.find((page) => page.path === key);
    if (exact) return found(exact);
    for (const match of [
        (page: DocEntry) => key.endsWith(`/${page.path}`),
        (page: DocEntry) => page.path.endsWith(`/${key}`),
        (page: DocEntry) => page.title.toLowerCase() === key.replace(/-/g, ' '),
    ]) {
        const pages = docs.pages.filter(match);
        if (pages.length === 1) return found(pages[0]);
        if (pages.length > 1) return { page: null, anchor: anchor || null, candidates: pages };
    }
    const words = key.split(/[\s/-]+/).filter(Boolean);
    return { page: null, anchor: anchor || null, candidates: words.length ? docs.pages.filter((page) => words.every((word) => page.path.includes(word))) : [] };
}

/** Heading anchor, as on the site: lowercase, punctuation removed, spaces as dashes. */
const slugify = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').toLowerCase().replace(/[`*]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

/** The Markdown of a page, or of the section under one of its headings. */
export function showPage(docs: Docs, page: DocEntry, anchor: string | null = null): string | null {
    const markdown = pageMarkdown(docs, page);
    if (!anchor) return markdown;
    const lines = markdown.split('\n');
    let fenced = false;
    let start = -1;
    let level = 0;
    for (const [index, line] of lines.entries()) {
        if (line.trim().startsWith('```')) fenced = !fenced;
        const heading = !fenced && /^(#{2,4})\s+(.+?)\s*#*$/.exec(line);
        if (!heading) continue;
        if (start >= 0 && heading[1].length <= level) return lines.slice(start, index).join('\n').trimEnd() + '\n';
        if (start < 0 && slugify(heading[2]) === slugify(anchor)) { start = index; level = heading[1].length; }
    }
    return start >= 0 ? lines.slice(start).join('\n').trimEnd() + '\n' : null;
}
