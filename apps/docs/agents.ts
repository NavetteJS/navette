// Plain Markdown versions of the documentation, for AI coding agents and offline reading: one `.md` twin per page,
// `llms.txt` (index), `llms-full.txt` (every page in one file) and `pages.json` (read by `npx navette docs`).
// The site build writes them next to the HTML pages; `export-markdown.ts` writes the copy shipped with @navette-js/cli.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { plain } from './markdown.ts';

export type AgentPage = { url: string; title: string; section: string[]; description: string | null; markdown: string };
export type AgentOptions = { /** Put before every `/page.md` link: `https://host/base`, `/base` or ``. */ prefix: string; version: string; home?: AgentPage | null; /** Also write llms-full.txt (default). */ full?: boolean };

const ASIDE_TITLES: Record<string, string> = { tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Danger' };

/** `/tables/columns/overview` → `tables/columns/overview.md`; the home page is `index.md`. */
export const markdownFile = (url: string) => (url === '/' ? 'index' : url.replace(/^\/|\/$/g, '')) + '.md';

/** Page body as plain Markdown: asides become blockquotes, preview blocks are dropped, links to pages point to their `.md`. */
export function cleanMarkdown(body: string, link: (href: string) => string): string {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const fence = /^```(\w*)\s*$/.exec(line.trim());
        if (fence) {
            const block = [line];
            index++;
            while (index < lines.length && lines[index].trim() !== '```') block.push(lines[index++]);
            block.push(lines[index] ?? '```');
            if (fence[1] !== 'preview') out.push(...block);
            continue;
        }
        const aside = /^<Aside(?:\s+variant="(tip|info|warning|danger)")?\s*>\s*$/.exec(line.trim());
        if (aside) {
            const inner: string[] = [];
            index++;
            while (index < lines.length && lines[index].trim() !== '</Aside>') inner.push(lines[index++]);
            const content = cleanMarkdown(inner.join('\n'), link).trimEnd().split('\n');
            out.push(`> **${ASIDE_TITLES[aside[1] ?? 'info']}**`, '>', ...content.map((text) => (text ? `> ${text}` : '>')));
            continue;
        }
        // Inline code is left untouched.
        out.push(line.split(/(`[^`]*`)/).map((part) => (part.startsWith('`') ? part : part.replace(/\]\((\/[^)\s]*)\)/g, (_, href) => `](${link(href)})`))).join(''));
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** The front matter `description`, or the first sentence of the first paragraph. */
export function summaryOf(page: Pick<AgentPage, 'description' | 'markdown'>): string {
    if (page.description) return page.description;
    const paragraph: string[] = [];
    let fenced = false;
    for (const line of page.markdown.replace(/\r\n/g, '\n').split('\n')) {
        const text = line.trim();
        if (text.startsWith('```')) fenced = !fenced;
        const outside = !fenced && text && !/^(```|#|<|\||[-*] |\d+\. |>)/.test(text);
        if (outside) paragraph.push(text);
        else if (paragraph.length) break;
    }
    const first = plain(paragraph.join(' '));
    const sentence = (first.match(/^(.+?[.!?])(?=\s|$)/)?.[1] ?? first).replace(/:$/, '.');
    return sentence.length > 220 ? sentence.slice(0, 217).replace(/\s+\S*$/, '') + '…' : sentence;
}

/** Writes the `.md` twins, `llms.txt`, `llms-full.txt` and `pages.json` into `dir`. */
export function writeAgentFiles(dir: string, pages: AgentPage[], options: AgentOptions): void {
    const urls = new Set(pages.map((page) => page.url));
    const to = (file: string) => `${options.prefix}/${file}`;
    const link = (href: string) => {
        const [target, anchor] = href.split('#');
        const url = target.replace(/(.)\/$/, '$1');
        if (url !== '/' && !urls.has(url)) return options.prefix + href;
        return to(markdownFile(url)) + (anchor ? `#${anchor}` : '');
    };
    const twin = (page: AgentPage) => `# ${page.title}\n\n${cleanMarkdown(page.markdown, link)}`;
    const save = (file: string, content: string) => {
        const target = path.join(dir, ...file.split('/'));
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
    };

    const summary = options.home ? summaryOf(options.home) : 'Navette is a TypeScript framework for building admin panels on Node.js.';
    const intro = [
        `Documentation of Navette ${options.version}. Each link is the Markdown version of a page${options.full === false ? '.' : `; [llms-full.txt](${to('llms-full.txt')}) has every page in one file.`}`,
        'In a Navette project, the same pages are available offline: `npx navette docs` lists them, `npx navette docs search <terms>` searches them and `npx navette docs show <page>` prints one.',
    ].join('\n');
    const sections = new Map<string, AgentPage[]>();
    for (const page of pages) sections.set(page.section[0] ?? 'Documentation', [...(sections.get(page.section[0] ?? 'Documentation') ?? []), page]);
    const index = [`# Navette`, '', `> ${summary}`, '', intro, ''];
    for (const [section, list] of sections) {
        index.push(`## ${section}`, '');
        for (const page of list) index.push(`- [${[...page.section.slice(1), page.title].join(' / ')}](${to(markdownFile(page.url))}): ${summaryOf(page)}`);
        index.push('');
    }
    save('llms.txt', index.join('\n'));

    const full = [`# Navette documentation (${options.version})`, '', `> ${summary}`, '', `Every page of the documentation, in navigation order. Pages are separated by a horizontal rule and a comment giving their section and Markdown URL.`, ''];
    for (const page of pages) {
        full.push('---', '', `<!-- Page: ${[...page.section, page.title].join(' / ')} | ${to(markdownFile(page.url))} -->`, '', twin(page));
        save(markdownFile(page.url), twin(page));
    }
    if (options.full !== false) save('llms-full.txt', full.join('\n'));
    if (options.home) save('index.md', twin({ ...options.home, title: 'Navette' }));

    const manifest = { version: options.version, pages: pages.map((page) => ({ path: page.url.slice(1), title: page.title, section: page.section, description: summaryOf(page) })) };
    save('pages.json', JSON.stringify(manifest, null, 1) + '\n');
}
