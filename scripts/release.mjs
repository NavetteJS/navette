// Builds the @navette-js/* packages for npm without touching development mode (where packages export their .ts sources):
// each package is compiled (JavaScript + .d.ts declarations) into `.release/<package>/`, with a publishing package.json.
// Node does not run TypeScript from node_modules, so published packages contain JavaScript only.
//
// Usage: node scripts/release.mjs <version>          builds .release/ (publishes nothing)
//        node scripts/release.mjs <version> --pack   also creates the .tgz archives (npm pack) in .release/
// Publishing itself is manual: see PUBLISHING.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) { console.error('Usage: node scripts/release.mjs <version> [--pack]'); process.exit(2); }
const pack = process.argv.includes('--pack');
const out = path.join(root, '.release');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

/** Folders and files shipped with each package besides the compiled JavaScript (views, translations, assets…). */
const EXTRA = ['views', 'data', 'icons', 'dist', 'resources', 'vendor', 'theme.css'];
const DESCRIPTIONS = {
    actions: 'Actions and modals for Navette admin panels.',
    database: 'Data adapters (Objection/Knex) for Navette panels.',
    forms: 'Form fields and validation for Navette admin panels.',
    infolists: 'Read-only infolist entries for Navette admin panels.',
    panels: 'Admin panels for Node.js: resources, pages, navigation, authentication, tenancy.',
    schemas: 'Layout components and schemas for Navette admin panels.',
    support: 'Shared utilities, colors, icons, views and translations for Navette.',
    tables: 'Interactive tables for Navette admin panels.',
    wire: 'Server-side runtime compatible with Livewire 3 for Node.js and Express.',
    cli: 'Command-line tools for Navette projects: migrations, users, and generators for resources, pages, widgets and form fields (npx navette).',
    create: 'Create a Navette project: npm create navette@latest',
};
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const packages = fs.readdirSync(path.join(root, 'packages')).filter((name) => fs.existsSync(path.join(root, 'packages', name, 'package.json')));
const tarballs = [];

for (const name of packages) {
    const source = path.join(root, 'packages', name);
    const target = path.join(out, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));

    // 1. JavaScript and declarations: relative `.ts` imports become `.js`; no type checking (the output does not depend on it).
    const config = path.join(out, `tsconfig.${name}.json`);
    fs.writeFileSync(config, JSON.stringify({
        compilerOptions: {
            target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', rewriteRelativeImportExtensions: true, allowImportingTsExtensions: true,
            declaration: true, noCheck: true, skipLibCheck: true, strict: false, noEmitOnError: false, sourceMap: false, removeComments: false,
            rootDir: path.join(source, 'src'), outDir: path.join(target, 'lib'), types: ['node'],
        },
        files: fs.readdirSync(path.join(source, 'src')).filter((file) => file.endsWith('.ts')).map((file) => path.join(source, 'src', file).replaceAll('\\', '/')),
    }, null, 2));
    execFileSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit', cwd: root });
    fs.rmSync(config);

    // 2. Extra files shipped with the package.
    for (const entry of EXTRA) if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(target, entry), { recursive: true });
    fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'LICENSE'));
    if (name === 'panels' || name === 'wire' || name === 'support') fs.copyFileSync(path.join(root, 'THIRD-PARTY-NOTICES.md'), path.join(target, 'THIRD-PARTY-NOTICES.md'));

    // 3. Publishing package.json: exports point to lib/, internal dependencies pinned to the same version.
    const exports = Object.fromEntries(Object.entries(manifest.exports).map(([key, value]) => {
        const match = /^\.\/src\/(.+)\.ts$/.exec(value);
        return [key, match ? { types: `./lib/${match[1]}.d.ts`, default: `./lib/${match[1]}.js` } : value];
    }));
    const bin = manifest.bin ? Object.fromEntries(Object.entries(manifest.bin).map(([command, file]) => [command, file.replace(/^\.\/src\/(.+)\.ts$/, './lib/$1.js')])) : undefined;
    const dependencies = Object.fromEntries(Object.entries(manifest.dependencies ?? {}).map(([dependency, range]) => [dependency, dependency.startsWith('@navette-js/') ? version : range]));
    const published = {
        name: manifest.name, version, description: DESCRIPTIONS[name] ?? '', license: 'MIT', type: 'module',
        exports, types: exports['.']?.types, ...(bin ? { bin } : {}),
        files: ['lib', ...EXTRA.filter((entry) => fs.existsSync(path.join(source, entry))), 'LICENSE', 'README.md', ...(fs.existsSync(path.join(target, 'THIRD-PARTY-NOTICES.md')) ? ['THIRD-PARTY-NOTICES.md'] : [])],
        engines: { node: '>=24' },
        repository: { type: 'git', url: 'git+https://github.com/NavetteJS/navette.git', directory: `packages/${name}` },
        homepage: 'https://github.com/NavetteJS/navette#readme',
        bugs: { url: 'https://github.com/NavetteJS/navette/issues' },
        keywords: ['navette', 'admin', 'panel', 'livewire', 'express', 'node', ...(bin ? ['cli', 'scaffold'] : [])],
        dependencies,
        publishConfig: { access: 'public', tag: version.includes('-') ? 'beta' : 'latest' },
    };
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(published, null, 2) + '\n');
    fs.writeFileSync(path.join(target, 'README.md'), `# ${manifest.name}\n\n${published.description}\n\nPart of [Navette](https://github.com/NavetteJS/navette), admin panels for Node.js. ${name === 'create' ? 'Start a project with \`npm create navette@latest\`.' : 'Start a project with \`npm create navette@latest\`, or install the framework with \`npm install @navette-js/panels\`.'}\n\n**Beta:** the API may still change between beta releases.\n\nLicense: MIT. Third-party notices: see \`THIRD-PARTY-NOTICES.md\` where present.\n`);

    // 4. No TypeScript source may be published.
    const leaked = fs.readdirSync(path.join(target, 'lib')).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));
    if (leaked.length) throw new Error(`${name}: .ts sources in lib/ (${leaked.join(', ')})`);
    if (pack) tarballs.push(execFileSync('npm', ['pack', '--pack-destination', out], { cwd: target, shell: true, encoding: 'utf8' }).trim().split('\n').at(-1));
    console.log(`✔ ${manifest.name}@${version}`);
}
if (pack) console.log(`\nArchives: ${tarballs.join(', ')}`);
