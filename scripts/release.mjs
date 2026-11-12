// Prépare les paquets @navette-js/* pour npm, sans toucher au mode développement (où les paquets exportent leurs sources .ts) :
// chaque paquet est compilé (JavaScript + déclarations .d.ts) dans `.release/<paquet>/`, avec un package.json de publication.
// Node refuse d'exécuter du TypeScript placé dans node_modules : les paquets publiés ne contiennent donc que du JavaScript.
//
// Usage : node scripts/release.mjs <version>          prépare .release/ (aucune publication)
//         node scripts/release.mjs <version> --pack   prépare puis crée les archives .tgz (npm pack) dans .release/
// La publication elle-même se fait à la main : voir PUBLISHING.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) { console.error('Usage : node scripts/release.mjs <version> [--pack]'); process.exit(2); }
const pack = process.argv.includes('--pack');
const out = path.join(root, '.release');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

/** Dossiers et fichiers livrés avec chaque paquet, en plus du JavaScript compilé (vues, traductions, assets de Filament…). */
const EXTRA = ['views', 'data', 'icons', 'dist', 'resources', 'vendor', 'theme.css'];
const DESCRIPTIONS = {
    actions: 'Actions and modals for Navette, the Node.js port of Filament.',
    database: 'Data adapters (Objection/Knex) for Navette panels.',
    forms: 'Form fields for Navette, the Node.js port of Filament.',
    infolists: 'Infolist entries for Navette, the Node.js port of Filament.',
    panels: 'Admin panels for Node.js: a port of Filament (resources, pages, navigation, authentication, tenancy).',
    schemas: 'Layout components and schemas for Navette, the Node.js port of Filament.',
    support: 'Shared utilities, colors, icons, views and translations for Navette.',
    tables: 'Interactive tables for Navette, the Node.js port of Filament.',
    wire: 'Server-side runtime compatible with Livewire 3 for Node.js and Express.',
    cli: 'Command-line tools for Navette projects: migrations, users, and generators for resources, pages and widgets (npx navette).',
    create: 'Create a Navette project: npm create navette@latest',
};
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const packages = fs.readdirSync(path.join(root, 'packages')).filter((name) => fs.existsSync(path.join(root, 'packages', name, 'package.json')));
const tarballs = [];

for (const name of packages) {
    const source = path.join(root, 'packages', name);
    const target = path.join(out, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));

    // 1. JavaScript et déclarations : les imports relatifs `.ts` deviennent `.js` ; pas de vérification de types (le code n'en dépend pas).
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

    // 2. Fichiers livrés avec le paquet.
    for (const entry of EXTRA) if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(target, entry), { recursive: true });
    fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'LICENSE'));
    if (name === 'panels' || name === 'wire' || name === 'support') fs.copyFileSync(path.join(root, 'THIRD-PARTY-NOTICES.md'), path.join(target, 'THIRD-PARTY-NOTICES.md'));

    // 3. package.json de publication : exports vers lib/, dépendances internes à la même version.
    const exports = Object.fromEntries(Object.entries(manifest.exports).map(([key, value]) => {
        const match = /^\.\/src\/(.+)\.ts$/.exec(value);
        return [key, match ? { types: `./lib/${match[1]}.d.ts`, default: `./lib/${match[1]}.js` } : value];
    }));
    // Exécutables (`bin`) : vers le JavaScript compilé.
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
        keywords: ['navette', 'filament', 'admin', 'panel', 'livewire', 'express', 'node', ...(bin ? ['cli', 'scaffold'] : [])],
        dependencies,
        publishConfig: { access: 'public', tag: version.includes('-') ? 'beta' : 'latest' },
    };
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(published, null, 2) + '\n');
    fs.writeFileSync(path.join(target, 'README.md'), `# ${manifest.name}\n\n${published.description}\n\nPart of [Navette](https://github.com/NavetteJS/navette), a Node.js port of [Filament](https://filamentphp.com). ${name === 'create' ? 'Start a project with \`npm create navette@latest\`.' : 'Start a project with \`npm create navette@latest\`, or install the framework with \`npm install @navette-js/panels\`.'}\n\n**Beta:** the API may still change between beta releases.\n\nLicense: MIT. Third-party notices: see \`THIRD-PARTY-NOTICES.md\` where present.\n`);

    // 4. Aucune source TypeScript ni test ne doit partir.
    const leaked = fs.readdirSync(path.join(target, 'lib')).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));
    if (leaked.length) throw new Error(`${name} : sources .ts dans lib/ (${leaked.join(', ')})`);
    if (pack) tarballs.push(execFileSync('npm', ['pack', '--pack-destination', out], { cwd: target, shell: true, encoding: 'utf8' }).trim().split('\n').at(-1));
    console.log(`✔ ${manifest.name}@${version}`);
}
if (pack) console.log(`\nArchives : ${tarballs.join(', ')}`);
