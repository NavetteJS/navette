// Renames the Filament-branded names of vendored Filament files (CSS, bundled JavaScript, markup) to Navette's own:
// `fi-*` classes and data attributes become `nv-*`, asset folders `filament` become `navette`, JavaScript globals,
// Alpine component names, storage keys, view and translation namespaces and the notifications header follow.
// License files and credits are left untouched.
//
// As a module: `import { rebrand, rebrandPath } from './rebrand.mjs'` (used by the vendoring tools, so that a new
// Filament release is vendored with the same names). As a script: `node scripts/rebrand.mjs [--apply]` rewrites the
// tracked files of this repository and moves the renamed folders (dry run without `--apply`).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = '(?:panels|forms|tables|actions|schemas|notifications|infolists|widgets|query-builder)';

/** Ordered `[pattern, replacement]` rules. */
export const RULES = [
    // The version widget (`filament-info-widget`, icon aliases `widgets.filament-info.*`).
    [/\bfilament-info\b/g, 'navette-info'],
    // Classes, ids and data attributes: `fi-btn`, `.fi-modal`, `data-fi-modal-id`, `'fi-' + name`, icon names `fi-o-code`.
    [/(?<![\p{L}\p{N}_$])fi-/gu, 'nv-'],
    // ... also after an escape: `/\bfi-btn\b/`, `\u0022fi-icon` (JSON-escaped markup).
    [/(?<=\\(?:b|[nst]|u00[0-9A-Fa-f]{2}|x[0-9A-Fa-f]{2}))fi-/g, 'nv-'],
    // Asset paths.
    [/\b(js|css|fonts)\/filament\/filament\//g, '$1/navette/navette/'],
    [/\bjs\/filament\//g, 'js/navette/'],
    [/\b(dist|resources|assets|icons)\/filament\b/g, '$1/navette'],
    // View and translation namespaces (`filament-panels::`, `filament::`), and view overrides `views/vendor/filament-*`.
    // Blade tags such as `<x-filament-actions::modals />` (Filament's own syntax, quoted in comments) are kept.
    [new RegExp(`(?<![\\w-])filament(-${PACKAGES})?::`, 'g'), 'navette$1::'],
    [/<(\/?)x-filament::link\b/g, '<$1x-navette::link'],
    [new RegExp(`\\bvendor/filament(-${PACKAGES})?/`, 'g'), 'vendor/navette$1/'],
    [new RegExp(`(['"\`])filament(-${PACKAGES})?\\1`, 'g'), '$1navette$2$1'],
    [/(?<![\w$.-])filament(?=: 'support')/g, 'navette'],
    // Browser storage keys: `filament:theme:mode`, `filament:sidebar:open`, `filament:section:collapsed:…`.
    [/(?<![\w-])filament:(?=[a-z])/g, 'navette:'],
    [/(?<=['"])filament\.(?=notifications\.)/g, 'navette.'],
    // The notifications response header and the data attribute of the notifications component.
    [/\b([Xx])-Filament-Notifications/g, '$1-Navette-Notifications'],
    [/(['"])x-filament-notifications/g, '$1x-navette-notifications'],
    [/\bdata-filament-/g, 'data-navette-'],
    // JavaScript globals and Alpine components: `filamentDropdown`, `window.filamentData`, `setUpFilamentUnsavedDataChangesAlert`,
    // `isFilamentNotificationsComponent`, `window.FilamentNotification`, `window.FilamentRichEditor`.
    [/(?<![\w$>-])filament(?=[A-Z])/g, 'navette'],
    [/(?<=[a-z])Filament(?=[A-Z])/g, 'Navette'],
    [/(?<![\w$\\-])Filament(?=(?:Notification\w*|RichEditor)\b)/g, 'Navette'],
];

/** References to Filament's own API in prose ("Filament's `fake()->filamentMarkdown()`"), kept as they are. */
const QUOTED = /Filament's `[^`\n]*`/g;
const MARK = '\u{E000}';

/** Applies the rules to a file's text. */
export const rebrand = (text) => {
    const quoted = [];
    const masked = text.replace(QUOTED, (match) => `${MARK}${quoted.push(match) - 1}${MARK}`);
    const renamed = RULES.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), masked);
    return renamed.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'gu'), (_match, index) => quoted[Number(index)]);
};

/** A path with its `filament` folders renamed (`dist/filament/js/filament/forms` → `dist/navette/js/navette/forms`). */
export const rebrandPath = (file) => file.split(/([\\/])/).map((part) => (part === 'filament' ? 'navette' : part.replace('filament-info-widget', 'navette-info-widget'))).join('');

/** Files never rewritten: licenses (legal notices) and generated files. */
const KEEP = [/(^|\/)[^/]*LICENSE[^/]*$/i, /(^|\/)package-lock\.json$/, /\.(woff2?|ttf|otf|png|jpe?g|gif|ico|webp|sqlite|db|zip|tgz|pdf|xlsx)$/i];
/** Folders whose `filament` segments are renamed on disk. */
const MOVED = ['packages/panels/dist/filament/', 'packages/panels/resources/filament/', 'packages/support/icons/filament/'];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const apply = process.argv.includes('--apply');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const self = path.relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 28 }).toString().split('\0').filter(Boolean);
    let changed = 0, moved = 0;
    for (const file of files) {
        if (file === self || KEEP.some((pattern) => pattern.test(file))) continue;
        const absolute = path.join(root, file);
        const buffer = fs.readFileSync(absolute);
        if (buffer.includes(0)) continue;
        const before = buffer.toString('utf8'), after = rebrand(before);
        if (after !== before) { changed++; if (apply) fs.writeFileSync(absolute, after); else console.log(file); }
    }
    for (const file of files) {
        if (!MOVED.some((prefix) => file.startsWith(prefix))) continue;
        const target = rebrandPath(file);
        if (target === file) continue;
        moved++;
        if (apply) {
            fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
            execFileSync('git', ['mv', file, target], { cwd: root });
        }
    }
    console.log(`${changed} files rewritten, ${moved} files moved${apply ? '' : ' (dry run)'}`);
}
