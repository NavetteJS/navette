import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'src', 'cli.ts');
// Inside the repository, so that the generated files resolve the workspace packages.
const project = mkdtempSync(path.join(here, '.project-'));
after(() => rmSync(project, { recursive: true, force: true }));
const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('make:widget --js generates a JavaScript widget and its renderer module', async () => {
    const output = run('make:widget', 'revenue overview', '--js');
    assert.match(output, /Created src\/admin\/widgets\/RevenueOverview\.ts/);
    assert.match(output, /Created resources\/js\/admin\/widgets\/revenue-overview\.js/);
    const classFile = path.join(project, 'src', 'admin', 'widgets', 'RevenueOverview.ts');
    const rendererFile = path.join(project, 'resources', 'js', 'admin', 'widgets', 'revenue-overview.js');
    assert.match(readFileSync(classFile, 'utf8'), /export class RevenueOverview extends JsWidget/);
    const renderer = readFileSync(rendererFile, 'utf8');
    assert.match(renderer, /^\/\*\* @param \{import\('@navette-js\/panels'\)\.JsWidgetRendererContext\} context \*\/\nexport default function mountRevenueOverview\(\{ host, props: initialProps \}\)/);
    assert.match(renderer, /return \{ update, destroy: \(\) => host\.replaceChildren\(\) \}/);

    // The class registers the renderer as an asset loaded on request, and points the widget at its versioned URL.
    const { RevenueOverview } = await import(pathToFileURL(classFile).href);
    const { NavetteAsset } = await import('@navette-js/panels');
    const src = NavetteAsset.getScriptSrc('admin/widgets/revenue-overview');
    assert.match(src, /^\/js\/app\/admin\/widgets\/revenue-overview\.js\?v=[a-f0-9]{12}$/);
    assert.equal(NavetteAsset.resolve(src.split('?')[0])?.getPath(), rendererFile);
    assert.doesNotMatch(NavetteAsset.renderScripts(), /revenue-overview/);
    const widget = new RevenueOverview();
    assert.equal(widget.getRenderer(), src);
    assert.deepEqual(widget.getRendererConfiguration(), { heading: 'Revenue overview', description: 'Widget description' });

    // Another panel, the --type=js spelling; an existing file is kept unless --force.
    assert.match(run('make:widget', 'Visits', '--type=js', '--panel=shop'), /Created resources\/js\/shop\/widgets\/visits\.js/);
    assert.ok(existsSync(path.join(project, 'src', 'shop', 'widgets', 'Visits.ts')));
    assert.throws(() => run('make:widget', 'RevenueOverview', '--js'), /already exists/);
    run('make:widget', 'RevenueOverview', '--js', '--force');
});

test('make:widget refuses the bundler-only renderer options and mixed types', () => {
    for (const option of ['--react', '--vue', '--svelte', '--ts', '--typescript']) assert.throws(() => run('make:widget', 'Sales', '--js', option), /needs a bundler/);
    assert.throws(() => run('make:widget', 'Sales', '--js', '--type=chart'), /cannot be combined/);
    assert.throws(() => run('make:widget', 'Sales', '--type=custom'), /--type must be stats, chart, table or js/);
    assert.ok(!existsSync(path.join(project, 'src', 'admin', 'widgets', 'Sales.ts')));
});
