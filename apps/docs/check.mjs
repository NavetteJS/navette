// Checks the documentation content: a title, "Introduction" first, internal links and anchors that resolve,
// no syntax outside the subset of WRITING.md, and the built Markdown versions (.md pages, llms.txt).
// Usage: node build.ts && node check.mjs   (exit code 1 on problems)
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './build.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const { pages, home } = collect();
const all = home ? [...pages, home] : pages;
const ids = new Map(all.map((page) => [page.url, new Set([...page.html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]))]));
const problems = [];
const report = (page, message) => problems.push(`${page.file} : ${message}`);

for (const page of all) {
    const source = readFileSync(path.join(here, 'content', page.file), 'utf8');
    if (!/^---\r?\n[\s\S]*?^title:\s*\S/m.test(source)) report(page, 'no title in the front matter');
    if (page !== home && page.headings[0]?.text !== 'Introduction') report(page, `the page must start with "## Introduction" (first heading: ${page.headings[0]?.text ?? 'none'})`);
    if (/^# /m.test(source.replace(/```[\s\S]*?```/g, ''))) report(page, 'level-1 heading (#): the title comes from the front matter');
    if (/&lt;\/?(Aside|AutoScreenshot|UtilityInjection|Disclosure)/.test(page.html)) report(page, 'unsupported component, or <Aside> not closed');
    if ((source.match(/^\s*```/gm) ?? []).length % 2) report(page, 'code block not closed');
    for (const [, href] of page.html.matchAll(/href="([^"]+)"/g)) {
        if (/^https?:\/\//.test(href)) continue;
        const [target, anchor] = href.split('#');
        const url = target === '' ? page.url : target.replace(/\/$/, '') || '/';
        if (!ids.has(url)) { report(page, `link to a missing page: ${href}`); continue; }
        if (anchor && !ids.get(url).has(decodeURIComponent(anchor))) report(page, `missing anchor: ${href}`);
    }
}
// Built Markdown outputs (same DOCS_OUT, DOCS_BASE and DOCS_ORIGIN as the build): .md twins, llms.txt, llms-full.txt, pages.json.
const dist = process.env.DOCS_OUT ? path.resolve(process.env.DOCS_OUT) : path.join(here, 'dist');
const prefix = (process.env.DOCS_ORIGIN ?? '').replace(/\/$/, '') + (process.env.DOCS_BASE ?? '').replace(/\/$/, '');
const built = (file) => path.join(dist, ...file.split('/'));
const markdownOf = (url) => (url === '/' ? 'index' : url.slice(1)) + '.md';
if (!existsSync(built('llms.txt'))) problems.push(`${dist} : no llms.txt, run \`node build.ts\` first`);
else {
    const llms = readFileSync(built('llms.txt'), 'utf8');
    const full = readFileSync(built('llms-full.txt'), 'utf8');
    const listed = JSON.parse(readFileSync(built('pages.json'), 'utf8')).pages.map((page) => page.path);
    /** A link of a built Markdown file must point to a built file of the site. */
    const resolves = (href) => {
        if (!href.startsWith(prefix + '/')) return !href.startsWith('/');
        const file = href.slice(prefix.length + 1).split('#')[0];
        return existsSync(built(file)) && statSync(built(file)).isFile() || existsSync(built(path.posix.join(file, 'index.html')));
    };
    const linksOf = (markdown) => [...markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
    if (!/^# Navette\n\n> \S/.test(llms)) problems.push('llms.txt : must start with "# Navette" and a one-line "> " summary');
    for (const href of linksOf(llms)) if (!resolves(href)) problems.push(`llms.txt : link to a missing file: ${href}`);
    for (const page of all) {
        const file = markdownOf(page.url);
        if (!existsSync(built(file))) { report(page, `no Markdown version (${file})`); continue; }
        const markdown = readFileSync(built(file), 'utf8');
        if (!markdown.startsWith('# ')) report(page, `${file} does not start with a level-1 title`);
        if (/<\/?Aside|```preview/.test(markdown)) report(page, `${file} still contains an <Aside> or a preview block`);
        for (const href of linksOf(markdown)) if (!resolves(href)) report(page, `${file} : link to a missing file: ${href}`);
        const html = readFileSync(built(page.url === '/' ? 'index.html' : path.posix.join(page.url.slice(1), 'index.html')), 'utf8');
        if (!html.includes(`<link rel="alternate" type="text/markdown" href="${(process.env.DOCS_BASE ?? '').replace(/\/$/, '')}/${file}"`)) report(page, 'no <link rel="alternate" type="text/markdown"> to its .md');
        if (page === home) continue;
        if (!llms.includes(`](${prefix}/${file})`)) report(page, 'not listed in llms.txt');
        if (!full.includes(`| ${prefix}/${file} -->`)) report(page, 'not in llms-full.txt');
        if (!listed.includes(page.url.slice(1))) report(page, 'not in pages.json');
    }
}

const sections = new Set(pages.map((page) => page.section[0]));
console.log(`${all.length} pages, ${sections.size} sections: ${[...sections].join(', ')}`);
if (problems.length) {
    console.log(`\n${problems.length} problem(s):\n` + problems.map((problem) => ` - ${problem}`).join('\n'));
    process.exit(1);
}
console.log('No problems.');
