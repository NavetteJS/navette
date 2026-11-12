// Checks the documentation content: a title, "Introduction" first, internal links and anchors that resolve,
// and no syntax outside the subset of WRITING.md. Usage: node check.mjs   (exit code 1 on problems)
import { readFileSync } from 'node:fs';
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
const sections = new Set(pages.map((page) => page.section[0]));
console.log(`${all.length} pages, ${sections.size} sections: ${[...sections].join(', ')}`);
if (problems.length) {
    console.log(`\n${problems.length} problem(s):\n` + problems.map((problem) => ` - ${problem}`).join('\n'));
    process.exit(1);
}
console.log('No problems.');
