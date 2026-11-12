// Contrôle du contenu de la documentation : titre, « Introduction » en tête, liens internes et ancres résolus,
// syntaxe hors du sous-ensemble de WRITING.md. Usage : node check.mjs   (code de sortie 1 en cas d'erreur)
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
    if (!/^---\r?\n[\s\S]*?^title:\s*\S/m.test(source)) report(page, 'pas de titre dans le front matter');
    if (page !== home && page.headings[0]?.text !== 'Introduction') report(page, `la page doit commencer par « ## Introduction » (premier titre : ${page.headings[0]?.text ?? 'aucun'})`);
    if (/^# /m.test(source.replace(/```[\s\S]*?```/g, ''))) report(page, 'titre de niveau 1 (#) : le titre vient du front matter');
    if (/&lt;\/?(Aside|AutoScreenshot|UtilityInjection|Disclosure)/.test(page.html)) report(page, 'composant non pris en charge ou <Aside> mal fermé');
    if ((source.match(/^\s*```/gm) ?? []).length % 2) report(page, 'bloc de code non fermé');
    for (const [, href] of page.html.matchAll(/href="([^"]+)"/g)) {
        if (/^https?:\/\//.test(href)) continue;
        const [target, anchor] = href.split('#');
        const url = target === '' ? page.url : target.replace(/\/$/, '') || '/';
        if (!ids.has(url)) { report(page, `lien vers une page absente : ${href}`); continue; }
        if (anchor && !ids.get(url).has(decodeURIComponent(anchor))) report(page, `ancre absente : ${href}`);
    }
}
const sections = new Set(pages.map((page) => page.section[0]));
console.log(`${all.length} pages, ${sections.size} sections : ${[...sections].join(', ')}`);
if (problems.length) {
    console.log(`\n${problems.length} problème(s) :\n` + problems.map((problem) => ` - ${problem}`).join('\n'));
    process.exit(1);
}
console.log('Aucun problème.');
