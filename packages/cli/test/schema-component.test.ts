import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Schema } from '@navette-js/schemas';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'src', 'cli.ts');
// Inside the repository, so that the generated file resolves the workspace packages.
const project = mkdtempSync(path.join(here, '.project-'));
after(() => rmSync(project, { recursive: true, force: true }));
const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('make:schema-component generates a working component class', async () => {
    const output = run('make:schema-component', 'sales chart');
    assert.match(output, /Created src\/schemas\/components\/SalesChart\.ts/);
    const file = path.join(project, 'src', 'schemas', 'components', 'SalesChart.ts');
    assert.match(readFileSync(file, 'utf8'), /export class SalesChart extends Component/);
    const { SalesChart } = await import(pathToFileURL(file).href);
    const host = { id: 'page', _errors: {}, getSchema() { return null as any; } };
    const html = await Schema.make(host).key('content').record({ name: '<Lamp>' })
        .components([SalesChart.make().heading(({ record }: any) => `${record.name} sales`)]).toHtml();
    assert.match(html, /<div class="sales-chart"><h3>&lt;Lamp&gt; sales<\/h3><\/div>/);
    // An existing file is kept, unless --force.
    assert.throws(() => run('make:schema-component', 'SalesChart'), /already exists/);
    run('make:schema-component', 'SalesChart', '--force');
    assert.ok(existsSync(file));
    assert.throws(() => run('make:schema-component', '123'), /Invalid component name/);
});
