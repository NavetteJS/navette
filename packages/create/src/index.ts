#!/usr/bin/env node
// `npm create navette`: asks a few questions, then creates a ready-to-run Navette project (panels, migrations, admin user).
// Without an interactive terminal (or with --yes), answers come from the flags and defaults.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface, type Interface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { readSecret } from './secret.ts';
import { projectFiles, type ProjectOptions } from './templates.ts';

const own = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')) as { version: string };
const args = process.argv.slice(2);
const flags: Record<string, string | true> = {};
const positional: string[] = [];
for (const arg of args) { const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg); if (m) flags[m[1]] = m[2] ?? true; else positional.push(arg); }
const flag = (name: string) => (typeof flags[name] === 'string' ? (flags[name] as string) : undefined);
const interactive = process.stdin.isTTY && !flags.yes;
const say = (text = '') => process.stdout.write(text + '\n');
const bold = (text: string) => (process.stdout.isTTY ? `\x1b[1m${text}\x1b[0m` : text);
const dim = (text: string) => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text);
const fail = (text: string): never => { process.stderr.write(`\n  ✖ ${text}\n\n`); process.exit(1); };

let rl: Interface | null = null;
const prompt = () => (rl ??= createInterface({ input: process.stdin, output: process.stdout }));
async function text(question: string, fallback: string, given?: string): Promise<string> {
    if (given !== undefined) return given;
    if (!interactive) return fallback;
    return (await prompt().question(`  ${bold(question)} ${dim(`(${fallback})`)} `)).trim() || fallback;
}
async function secret(question: string): Promise<string> {
    // Readline would echo the characters: it is closed while the password is typed (`prompt()` opens a new one after).
    rl?.close();
    rl = null;
    return readSecret(`  ${bold(question)} `);
}
/** Asks for the admin's password twice; returns `null` when left empty (a password is then generated). */
async function choosePassword(): Promise<string | null> {
    for (;;) {
        const password = await secret(`Admin password ${dim('(at least 8 characters; leave empty to generate one)')}`);
        if (!password) return null;
        if (password.length < 8) { say(`  ${dim('✖')} At least 8 characters: try again.`); continue; }
        if ((await secret('Confirm the password')) === password) return password;
        say(`  ${dim('✖')} The passwords do not match: try again.`);
    }
}
async function choose<T extends string>(question: string, choices: [T, string][], fallback: T, given?: string): Promise<T> {
    if (given !== undefined) { const match = choices.find(([value]) => value === given); if (!match) fail(`--${question.toLowerCase()} must be one of ${choices.map(([v]) => v).join(', ')}`); return match![0]; }
    if (!interactive) return fallback;
    say(`  ${bold(question)}`);
    choices.forEach(([value, label], index) => say(`    ${index + 1}. ${label}${value === fallback ? dim(' (default)') : ''}`));
    const answer = (await prompt().question(`  ${dim('›')} `)).trim();
    return choices[Number(answer) - 1]?.[0] ?? choices.find(([value]) => value === answer)?.[0] ?? fallback;
}
async function confirm(question: string, fallback: boolean, given?: string | true): Promise<boolean> {
    if (given !== undefined) return given === true || given === 'true' || given === 'yes';
    if (!interactive) return fallback;
    const answer = (await prompt().question(`  ${bold(question)} ${dim(fallback ? '(Y/n)' : '(y/N)')} `)).trim().toLowerCase();
    return answer ? answer.startsWith('y') || answer.startsWith('o') : fallback;
}

say(`\n  ${bold('Navette')} ${dim(`v${own.version}`)} — admin panels for Node.js\n`);
const name = (positional[0] ?? (await text('Project name', 'my-navette-app', flag('name')))).trim();
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) fail(`Invalid project name: ${name} (letters, digits, dots, dashes and underscores).`);
const target = resolve(name);
if (existsSync(target) && readdirSync(target).length) fail(`The folder ${name} already exists and is not empty.`);

const template = await choose('Template', [['starter', 'Starter — a dashboard with stats, a tasks resource and user management'], ['blank', 'Blank — an empty admin panel, ready for your resources']], 'starter', flag('template'));
const userPanel = await confirm('Add a user panel (/app) with sign-up, password reset, email verification and profile?', false, flags['user-panel']);
const teams = userPanel ? await confirm('Let users create and join teams (multi-tenancy)?', false, flags.teams) : false;
const database = await choose('Database', [['sqlite', 'SQLite — a file, nothing to install'], ['postgres', 'PostgreSQL'], ['mysql', 'MySQL / MariaDB']], 'sqlite', flag('db'));
const locale = await choose('Language of the interface', [['en', 'English'], ['fr', 'Français']], 'en', flag('locale'));
const install = await confirm('Install the dependencies now?', true, flags['no-install'] ? 'no' : flags.install);
const adminEmail = install && database === 'sqlite' ? await text('Admin email address', 'admin@example.com', flag('admin-email')) : null;
// The admin's password: `--admin-password`, typed twice, or generated (and then shown at the end).
const givenPassword = flag('admin-password');
if (givenPassword !== undefined && givenPassword.length < 8) fail('--admin-password must be at least 8 characters.');
const chosenPassword = adminEmail ? (givenPassword ?? (interactive ? await choosePassword() : null)) : null;
rl?.close();

const options: ProjectOptions = {
    name: name.toLowerCase(), appName: name.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    template, userPanel, teams, database, locale, version: flag('version') ?? `^${own.version}`, port: Number(flag('port') ?? 3000),
};
const files = projectFiles(options);
// For tests: install packages from local tarballs instead of the npm registry (--packages=<folder of .tgz files>).
const local = flag('packages');
if (local) {
    const pkg = JSON.parse(files['package.json']);
    for (const group of ['dependencies', 'devDependencies']) for (const dependency of Object.keys(pkg[group])) {
        if (!dependency.startsWith('@navette-js/')) continue;
        const archive = readdirSync(local).find((file) => file.startsWith(`navette-js-${dependency.slice(12)}-`) && file.endsWith('.tgz'));
        if (archive) pkg[group][dependency] = `file:${resolve(local, archive).replaceAll('\\', '/')}`;
    }
    files['package.json'] = JSON.stringify(pkg, null, 2) + '\n';
}
for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    writeFileSync(join(target, file), content);
}
say(`\n  ✔ Created ${name} (${Object.keys(files).length} files)`);

const run = (command: string, commandArgs: string[]) => spawnSync(command, commandArgs, { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;
let adminPassword: string | null = null;
const passwordGenerated = adminEmail !== null && chosenPassword === null;
if (install) {
    say('  … Installing dependencies\n');
    if (!run('npm', ['install', '--no-fund', '--no-audit'])) fail('npm install failed: fix the error above, then run `npm install` in the project.');
    if (adminEmail) {
        adminPassword = chosenPassword ?? randomBytes(12).toString('base64url');
        // Passed through the environment, not the command line, where other users of the machine could read it.
        const created = spawnSync('npx', ['navette', 'make:user', '--admin', '--name=Admin', `--email=${adminEmail}`], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, NAVETTE_PASSWORD: adminPassword } }).status === 0;
        if (!created) fail('Creating the admin user failed: run `npx navette make:user --admin` in the project.');
    }
}

say(`\n  ${bold('Next steps')}\n`);
say(`    cd ${name}`);
if (!install) say('    npm install');
if (database !== 'sqlite') say(`    ${dim('# set DATABASE_URL in .env, then:')}`);
if (!adminPassword) say('    npx navette make:user --admin');
say('    npm run dev\n');
say(`  Admin panel  http://127.0.0.1:${options.port}/admin`);
if (userPanel) say(`  User panel   http://127.0.0.1:${options.port}/app`);
if (adminPassword) {
    say(`\n  ${bold('Admin account')}\n`);
    say(`    Email     ${adminEmail}`);
    say(passwordGenerated
        ? `    Password  ${bold(adminPassword)}   ${dim('generated: copy it now, it is not shown again')}`
        : `    Password  ${dim('the one you chose')}`);
}
say(`\n  Generate code with ${bold('npx navette make:resource Post --generate')} — see README.md.\n`);
