import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanMarkdown, summaryOf, writeAgentFiles, type AgentPage } from '../../../apps/docs/agents.ts';
import { formatList, formatResults, loadDocs, resolvePage, searchDocs, showPage } from '../src/docs.ts';

const dir = mkdtempSync(path.join(tmpdir(), 'navette-docs-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const pages: AgentPage[] = [
    {
        url: '/forms/select', title: 'Select', section: ['Forms'], description: null,
        markdown: [
            '## Introduction', '', 'The select component lets users pick options from a list:', '',
            '```ts', "Select.make('status').options({ draft: 'Draft' })", '```', '',
            '```preview', "Select.make('status')", '```', '',
            '<Aside variant="tip">', 'Make it searchable with `searchable()`, see [tables](/tables/columns/overview#searching).', '</Aside>', '',
            '## Searching options', '', 'Call `searchable()` to filter the options as the user types.', '',
            '### Searching on the server', '', 'Use `getSearchResultsUsing()` for large tables.', '',
            '## Multiple values', '', 'Call `multiple()`.',
        ].join('\n'),
    },
    {
        url: '/tables/columns/overview', title: 'Overview', section: ['Tables', 'Columns'], description: 'Columns of a table, and how to search and sort them.',
        markdown: ['## Introduction', '', 'Columns display the records. See the [select field](/forms/select) and the [guide](https://example.com/guide).', '', '## Searching', '', 'A column becomes searchable with `searchable()`.'].join('\n'),
    },
    {
        url: '/forms/overview', title: 'Overview', section: ['Forms'], description: 'What forms are.',
        markdown: ['## Introduction', '', 'Forms collect data. Unrelated text.'].join('\n'),
    },
];
writeAgentFiles(dir, pages, { prefix: '', version: '1.2.3', home: { url: '/', title: 'Admin panels.', section: [], description: null, markdown: 'Navette builds admin panels on Node.js. More text.' } });
const docs = loadDocs(dir);

test('Markdown pages: asides become blockquotes, previews are dropped, links point to .md files', () => {
    const select = readFileSync(path.join(dir, 'forms', 'select.md'), 'utf8');
    assert.ok(select.startsWith('# Select\n\n## Introduction\n'));
    assert.ok(!select.includes('```preview') && !select.includes("Select.make('status')\n```"));
    assert.ok(select.includes("Select.make('status').options"));
    assert.ok(select.includes('> **Tip**\n>\n> Make it searchable with `searchable()`, see [tables](/tables/columns/overview.md#searching).'));
    assert.ok(!/<\/?Aside/.test(select));
    const columns = readFileSync(path.join(dir, 'tables', 'columns', 'overview.md'), 'utf8');
    assert.ok(columns.includes('[select field](/forms/select.md)') && columns.includes('(https://example.com/guide)'));
    assert.equal(cleanMarkdown('Keep `[x](/forms/select)` as code.', (href) => `X${href}`), 'Keep `[x](/forms/select)` as code.\n');
    assert.equal(cleanMarkdown('[a](/forms/select)', (href) => `https://site${href}.md`), '[a](https://site/forms/select.md)\n');
});

test('summaries come from the front matter, else from the first sentence', () => {
    assert.equal(summaryOf(pages[0]), 'The select component lets users pick options from a list.');
    assert.equal(summaryOf(pages[1]), 'Columns of a table, and how to search and sort them.');
    assert.equal(summaryOf(pages[2]), 'What forms are.');
    assert.equal(summaryOf({ description: null, markdown: '## Introduction\n\nFirst `code()` sentence. Second.' }), 'First code() sentence.');
});

test('llms.txt follows the convention; llms-full.txt and pages.json list every page in order', () => {
    const llms = readFileSync(path.join(dir, 'llms.txt'), 'utf8');
    assert.match(llms, /^# Navette\n\n> Navette builds admin panels on Node\.js\.\n/);
    assert.ok(llms.includes('## Forms\n\n- [Select](/forms/select.md): The select component lets users pick options from a list.\n- [Overview](/forms/overview.md): What forms are.'));
    assert.ok(llms.includes('## Tables\n\n- [Columns / Overview](/tables/columns/overview.md): Columns of a table'));
    const full = readFileSync(path.join(dir, 'llms-full.txt'), 'utf8');
    assert.ok(full.indexOf('<!-- Page: Forms / Select | /forms/select.md -->') < full.indexOf('<!-- Page: Tables / Columns / Overview | /tables/columns/overview.md -->'));
    assert.ok(readFileSync(path.join(dir, 'index.md'), 'utf8').startsWith('# Navette\n'));
    assert.deepEqual(docs.pages.map((page) => page.path), ['forms/select', 'tables/columns/overview', 'forms/overview']);
    assert.equal(docs.version, '1.2.3');
});

test('docs search ranks pages and returns matching lines', () => {
    const results = searchDocs(docs, 'searchable');
    assert.deepEqual(results.map((result) => result.page.path), ['forms/select', 'tables/columns/overview']);
    assert.ok(results[0].snippets.every((snippet) => snippet.text.toLowerCase().includes('searchable')));
    assert.ok(results[0].snippets.length <= 3 && results[0].snippets[0].line > 1);
    // Every term must match when a page has them all; a title match wins.
    assert.deepEqual(searchDocs(docs, 'select options').map((result) => result.page.path), ['forms/select']);
    assert.equal(searchDocs(docs, 'columns search')[0].page.path, 'tables/columns/overview');
    // No page has both terms: pages with either one are returned.
    assert.deepEqual(searchDocs(docs, 'multiple unrelated').map((result) => result.page.path).sort(), ['forms/overview', 'forms/select']);
    assert.deepEqual(searchDocs(docs, '   '), []);
    // Terms match at the start of a word; the overview of a section named after the term comes first.
    assert.deepEqual(searchDocs(docs, 'lect'), []);
    assert.equal(searchDocs(docs, 'form')[0].page.path, 'forms/overview');
    assert.equal(searchDocs(docs, '.options(')[0].page.path, 'forms/select');
    assert.match(formatResults(searchDocs(docs, 'searchable'), 'searchable'), /^1\. Forms \/ Select   \(forms\/select\)\n/);
    assert.match(formatResults([], 'nothing'), /No page matches "nothing"/);
});

test('docs show accepts paths, .md and site URLs, suffixes and titles, and prints one section with an anchor', () => {
    for (const reference of ['tables/columns/overview', '/tables/columns/overview.md', 'https://navettejs.github.io/navette/tables/columns/overview.md', 'navette/tables/columns/overview', 'columns/overview']) {
        assert.equal(resolvePage(docs, reference).page?.path, 'tables/columns/overview', reference);
    }
    assert.equal(resolvePage(docs, 'Select').page?.path, 'forms/select');
    const ambiguous = resolvePage(docs, 'overview');
    assert.equal(ambiguous.page, null);
    assert.deepEqual(ambiguous.candidates.map((page) => page.path), ['tables/columns/overview', 'forms/overview']);
    const select = resolvePage(docs, 'forms/select#searching-options');
    assert.equal(select.anchor, 'searching-options');
    assert.equal(showPage(docs, select.page!, select.anchor), '## Searching options\n\nCall `searchable()` to filter the options as the user types.\n\n### Searching on the server\n\nUse `getSearchResultsUsing()` for large tables.\n');
    assert.equal(showPage(docs, select.page!, 'missing'), null);
    assert.ok(showPage(docs, select.page!)!.startsWith('# Select\n'));
});

test('the navette docs command lists, searches and prints pages', () => {
    const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');
    const run = (...args: string[]) => execFileSync(process.execPath, [cli, 'docs', ...args], { cwd: dir, env: { ...process.env, NAVETTE_DOCS_DIR: dir }, encoding: 'utf8' });
    assert.equal(run().trim(), formatList(docs).trim());
    assert.match(run(), /^Navette 1\.2\.3 documentation: 3 pages\n\nForms\n {2}forms\/select +Select\n/);
    assert.match(run('search', 'searchable'), /1\. Forms \/ Select/);
    assert.equal(run('show', 'forms/overview'), readFileSync(path.join(dir, 'forms', 'overview.md'), 'utf8'));
    assert.throws(() => execFileSync(process.execPath, [cli, 'docs', 'show', 'overview'], { cwd: dir, env: { ...process.env, NAVETTE_DOCS_DIR: dir }, stdio: 'pipe' }), /Did you mean: tables\/columns\/overview, forms\/overview/);
});
