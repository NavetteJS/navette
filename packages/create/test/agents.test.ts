import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { projectFiles, type ProjectOptions } from '../src/templates.ts';

const base: ProjectOptions = { name: 'my-app', appName: 'My App', template: 'starter', userPanel: true, teams: true, database: 'sqlite', locale: 'en', version: '^1.0.0', port: 3000 };
const variants: ProjectOptions[] = [
    base,
    { ...base, teams: false },
    { ...base, userPanel: false, teams: false },
    { ...base, template: 'blank', database: 'postgres', port: 4000 },
    { ...base, template: 'blank', userPanel: false, teams: false, database: 'mysql' },
];
const cli = readFileSync(new URL('../../cli/src/cli.ts', import.meta.url), 'utf8');
const commands = new Set([...cli.matchAll(/^ {4}'?([a-z][a-z:-]*)'?: \{$/gm)].map((match) => match[1]));

for (const options of variants) {
    const name = `${options.template}, user panel ${options.userPanel}, teams ${options.teams}, ${options.database}`;
    test(`AGENTS.md and CLAUDE.md describe the generated project (${name})`, () => {
        const files = projectFiles(options);
        const agents = files['AGENTS.md'];
        assert.ok(agents.startsWith('# AGENTS.md\n'));
        assert.match(files['CLAUDE.md'], /\[AGENTS\.md\]\(AGENTS\.md\)[\s\S]*\n@AGENTS\.md\n$/);
        // Every path of the structure table exists in the project.
        for (const [, cell] of agents.matchAll(/^\| (`[^|]+`) \|/gm)) {
            for (const [, entry] of cell.matchAll(/`([^`]+)`/g)) {
                const path = entry.replace(/…$/, '');
                if (['pages/', 'widgets/'].includes(path)) continue;
                assert.ok(Object.keys(files).some((file) => file === path || file.startsWith(path)), `${path} is not in the project`);
            }
        }
        // Every command it shows exists.
        for (const [, command] of agents.matchAll(/npx navette ([a-z][a-z:-]*)/g)) assert.ok(commands.has(command), `unknown command: ${command}`);
        for (const [, command] of agents.matchAll(/`(make:[a-z-]+)`/g)) assert.ok(commands.has(command), `unknown command: ${command}`);
        for (const script of ['dev', 'test']) assert.ok(agents.includes(`npm ${script === 'test' ? 'test' : `run ${script}`}`) && JSON.parse(files['package.json']).scripts[script]);
        assert.ok(agents.includes(`http://127.0.0.1:${options.port}`));
        assert.ok(agents.includes('npx navette docs search <terms>') && agents.includes('https://navettejs.github.io/navette/llms.txt') && agents.includes('node_modules/@navette-js/cli/docs/'));
        assert.equal(agents.includes('/app'), options.userPanel);
        assert.equal(agents.includes('--panel=app'), options.userPanel);
        assert.equal(agents.includes('team'), options.teams && options.userPanel);
        assert.equal(agents.includes('TaskResource'), options.template === 'starter');
        assert.equal(agents.includes('DATABASE_URL'), options.database !== 'sqlite');
        assert.ok(!/filament/i.test(agents + files['CLAUDE.md']));
    });
}
