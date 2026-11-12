// Builds the documentation website from content/**/*.md into a static site.
// Usage: node build.ts   (DOCS_BASE=/docs for a site served under a sub-path, DOCS_OUT=<dir> for another output directory)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontMatter, render, type Heading } from './markdown.ts';
import { closePreviews, previewDocument, renderPreview } from './previews.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, 'content');
const dist = process.env.DOCS_OUT ?? path.join(here, 'dist');
const base = (process.env.DOCS_BASE ?? '').replace(/\/$/, '');
const navette = path.resolve(here, '../..');
const version = JSON.parse(readFileSync(path.join(navette, 'packages/panels/package.json'), 'utf8')).version as string;
const GITHUB = 'https://github.com/NavetteJS/navette';

export type DocPage = { file: string; url: string; title: string; section: string[]; html: string; headings: Heading[]; text: string; previews: string[] };
export type NavNode = { title: string; url?: string; children?: NavNode[] };

const stripPrefix = (name: string) => name.replace(/^\d+-/, '').replace(/\.md$/, '');
const titleOf = (name: string) => stripPrefix(name).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const withBase = (html: string) => (base ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`) : html);

/** Pages and navigation tree; numeric prefixes give the order and are dropped from URLs. */
export function collect(): { pages: DocPage[]; nav: NavNode[]; home: DocPage | null } {
    const pages: DocPage[] = [];
    let home: DocPage | null = null;
    const walk = (dir: string, segments: string[], sectionTitles: string[]): NavNode[] => {
        const nodes: NavNode[] = [];
        const entries = readdirSync(dir).filter((name) => !name.startsWith('_') && !name.startsWith('.')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
        for (const name of entries) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) {
                const meta = path.join(full, '_section.json');
                const title = existsSync(meta) ? (JSON.parse(readFileSync(meta, 'utf8')).title as string) : titleOf(name);
                const children = walk(full, [...segments, stripPrefix(name)], [...sectionTitles, title]);
                if (children.length) nodes.push({ title, children });
                continue;
            }
            if (!name.endsWith('.md')) continue;
            const source = readFileSync(full, 'utf8');
            const { title, body } = frontMatter(source);
            const rendered = render(body);
            const isHome = segments.length === 0 && stripPrefix(name) === 'index';
            const url = isHome ? '/' : '/' + [...segments, stripPrefix(name)].join('/');
            const page: DocPage = { file: path.relative(contentDir, full).replace(/\\/g, '/'), url, title: title ?? titleOf(name), section: sectionTitles, ...rendered };
            if (isHome) { home = page; continue; }
            pages.push(page);
            nodes.push({ title: page.title, url });
        }
        return nodes;
    };
    const nav = existsSync(contentDir) ? walk(contentDir, [], []) : [];
    return { pages, nav, home };
}

// ------------------------------------------------------------------ layout
const logo = `<span class="logo"><img class="logo-light" src="/assets/navette-light.svg" alt="Navette"><img class="logo-dark" src="/assets/navette-dark.svg" alt="Navette"></span>`;
const icons = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/></svg>',
    search: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd"/></svg>',
    sun: '<svg class="icon-sun" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.657-1.596a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06Zm-9.193 9.192a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10Zm9.596 5.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.061 1.06l1.06 1.06Z"/></svg>',
    moon: '<svg class="icon-moon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clip-rule="evenodd"/></svg>',
    github: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
    chevron: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>',
};

function renderNav(nodes: NavNode[], current: string, depth = 0): string {
    return `<ul class="nav-list nav-depth-${depth}">${nodes.map((node) => {
        if (node.url) return `<li><a href="${node.url}" class="nav-link${node.url === current ? ' active' : ''}"${node.url === current ? ' aria-current="page"' : ''}>${escape(node.title)}</a></li>`;
        const open = JSON.stringify(node).includes(`"url":"${current}"`);
        if (depth === 0) return `<li class="nav-section"><p class="nav-section-title">${escape(node.title)}</p>${renderNav(node.children ?? [], current, depth + 1)}</li>`;
        return `<li class="nav-group"><details${open ? ' open' : ''}><summary>${escape(node.title)}${icons.chevron}</summary>${renderNav(node.children ?? [], current, depth + 1)}</details></li>`;
    }).join('')}</ul>`;
}

function shell(options: { title: string; description: string; nav: NavNode[]; current: string; main: string; toc: string; bodyClass?: string }): string {
    const pageTitle = options.current === '/' ? 'Navette documentation' : `${options.title} - Navette documentation`;
    return withBase(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(pageTitle)}</title>
<meta name="description" content="${escape(options.description)}">
<link rel="icon" href="/assets/navette-icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts/inter/index.css">
<link rel="stylesheet" href="/assets/style.css">
<script>(() => { try { const mode = localStorage.getItem('navette-docs-theme'); if (mode === 'dark' || (!mode && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); } catch {} })();</script>
</head>
<body class="${options.bodyClass ?? ''}" data-base="${base}">
<a href="#content" class="skip-link">Skip to content</a>
<header class="topbar">
  <button type="button" class="icon-button menu-button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">${icons.menu}</button>
  <a href="/" class="brand" aria-label="Navette documentation home">${logo}</a>
  <span class="version" title="Navette version">v${escape(version)}</span>
  <button type="button" class="search-button" aria-haspopup="dialog">${icons.search}<span>Search documentation</span><kbd>Ctrl K</kbd></button>
  <nav class="topbar-links" aria-label="External links">
    <a href="/getting-started/overview">Docs</a>
    <a href="${GITHUB}" target="_blank" rel="noopener" class="icon-button" aria-label="GitHub">${icons.github}</a>
    <button type="button" class="icon-button theme-button" aria-label="Toggle dark mode">${icons.sun}${icons.moon}</button>
  </nav>
</header>
<div class="layout">
  <nav id="sidebar" class="sidebar" aria-label="Documentation">${renderNav(options.nav, options.current)}</nav>
  <div class="sidebar-overlay" hidden></div>
  <main id="content" class="content">${options.main}</main>
  <aside class="toc" aria-label="On this page">${options.toc}</aside>
</div>
<div class="search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation" hidden>
  <div class="search-panel">
    <div class="search-field">${icons.search}<input type="search" placeholder="Search documentation" autocomplete="off" spellcheck="false" aria-label="Search"><kbd>Esc</kbd></div>
    <ul class="search-results" role="listbox"></ul>
    <p class="search-empty" hidden>No results.</p>
  </div>
</div>
<script src="/assets/app.js" defer></script>
</body>
</html>
`);
}

function tocOf(headings: Heading[]): string {
    if (!headings.length) return '';
    return `<p class="toc-title">On this page</p><ul>${headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${heading.id}">${escape(heading.text)}</a></li>`).join('')}</ul>`;
}

function pageHtml(page: DocPage, nav: NavNode[], previous: DocPage | null, next: DocPage | null): string {
    const pager = `<nav class="pager" aria-label="Previous and next pages">${previous ? `<a class="pager-previous" href="${previous.url}"><span>Previous</span>${escape(previous.title)}</a>` : '<span></span>'}${next ? `<a class="pager-next" href="${next.url}"><span>Next</span>${escape(next.title)}</a>` : ''}</nav>`;
    const main = `<article class="prose"><p class="eyebrow">${escape(page.section.join(' / '))}</p><h1>${escape(page.title)}</h1>${page.html}</article>${pager}`;
    return shell({ title: page.title, description: page.text.slice(0, 160), nav, current: page.url, main, toc: tocOf(page.headings) });
}

function homeHtml(home: DocPage | null, nav: NavNode[], pages: DocPage[]): string {
    const cards = nav.map((section) => {
        const first = pages.find((page) => page.section[0] === section.title);
        const count = pages.filter((page) => page.section[0] === section.title).length;
        return first ? `<a class="card" href="${first.url}"><span class="card-title">${escape(section.title)}</span><span class="card-meta">${count} page${count > 1 ? 's' : ''}</span></a>` : '';
    }).join('');
    const intro = home ? home.html : '';
    const main = `<section class="hero"><p class="eyebrow">Documentation · v${escape(version)}</p><h1>${escape(home?.title ?? 'Navette')}</h1>${intro}<div class="hero-actions"><a class="button button-primary" href="/getting-started/installation">Get started</a><a class="button" href="/getting-started/overview">What is Navette?</a></div></section><section class="cards">${cards}</section>`;
    return shell({ title: 'Navette', description: home?.text.slice(0, 160) ?? 'Navette documentation', nav, current: '/', main, toc: '', bodyClass: 'home' });
}

// ------------------------------------------------------------------ build
export async function build(): Promise<{ pages: DocPage[]; previewErrors: string[] }> {
    const { pages, nav, home } = collect();
    // Empty the directory instead of removing it: Windows refuses to remove a directory that a terminal has open.
    mkdirSync(dist, { recursive: true });
    for (const entry of readdirSync(dist)) rmSync(path.join(dist, entry), { recursive: true, force: true });
    const write = (url: string, html: string) => {
        const target = url === '/' ? path.join(dist, 'index.html') : path.join(dist, ...url.split('/').filter(Boolean), 'index.html');
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, html);
    };
    // Each ```preview block becomes a standalone page, shown in an iframe where its marker was.
    const previewErrors: string[] = [];
    for (const page of pages) {
        for (const [index, code] of page.previews.entries()) {
            const name = `${page.url.split('/').filter(Boolean).join('-')}-${index + 1}`;
            let frame = '';
            try {
                const target = path.join(dist, 'previews', `${name}.html`);
                mkdirSync(path.dirname(target), { recursive: true });
                writeFileSync(target, previewDocument(await renderPreview({ code })));
                frame = `<div class="preview"><div class="preview-label">Preview</div><iframe src="/previews/${name}.html" title="Preview" loading="lazy"></iframe></div>`;
            } catch (error) {
                previewErrors.push(`${page.file} (preview ${index + 1}): ${(error as Error).message}`);
            }
            page.html = page.html.replace(`<!--preview:${index}-->`, () => withBase(frame));
        }
    }
    await closePreviews();
    pages.forEach((page, index) => write(page.url, pageHtml(page, nav, pages[index - 1] ?? null, pages[index + 1] ?? null)));
    write('/', homeHtml(home, nav, pages));
    writeFileSync(path.join(dist, '404.html'), shell({ title: 'Page not found', description: 'Page not found', nav, current: '', main: '<article class="prose"><h1>Page not found</h1><p>This page does not exist. Try the search, or go back to the <a href="/">documentation home</a>.</p></article>', toc: '' }));

    // Search index: one entry per page and per heading.
    const index = pages.flatMap((page) => [
        { t: page.title, s: page.section.join(' / '), u: page.url, x: page.text.slice(0, 400) },
        ...page.headings.map((heading) => ({ t: heading.text, s: `${page.section.join(' / ')} / ${page.title}`, u: `${page.url}#${heading.id}`, x: '' })),
    ]);
    writeFileSync(path.join(dist, 'search.json'), JSON.stringify(index));


    const assets = path.join(dist, 'assets');
    cpSync(path.join(here, 'assets'), assets, { recursive: true });
    for (const name of ['navette-light.svg', 'navette-dark.svg', 'navette-icon.svg']) cpSync(path.join(navette, 'apps/demo/public/images/logo', name), path.join(assets, name));
    cpSync(path.join(navette, 'packages/panels/dist/filament/fonts/filament/filament/inter'), path.join(assets, 'fonts/inter'), { recursive: true });
    // Panel CSS and JavaScript, used by the previews.
    cpSync(path.join(navette, 'packages/panels/dist/filament'), path.join(assets, 'filament'), { recursive: true });
    return { pages, previewErrors };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\//, '')}` || process.argv[1]?.endsWith('build.ts')) {
    const { pages, previewErrors } = await build();
    const previews = pages.reduce((total, page) => total + page.previews.length, 0);
    console.log(`Navette docs: ${pages.length} pages, ${previews} previews, written to ${path.relative(process.cwd(), dist) || dist}`);
    if (previewErrors.length) { console.log(`\n${previewErrors.length} preview(s) failed:\n` + previewErrors.map((error) => ` - ${error}`).join('\n')); process.exitCode = 1; }
}
