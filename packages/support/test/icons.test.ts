import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ColorManager, HtmlString, Attributes, icon, iconifyToSvg, icons, registerIcon, type IconifyJson } from '../src/index.ts';
import { pagination, section, useColorManager } from '../src/ui.ts';

useColorManager(new ColorManager());

const SET: IconifyJson = {
    prefix: 'demo', width: 24, height: 24,
    icons: {
        house: { body: '<path d="M1 1h22"/>' },
        wide: { body: '<path d="M0 0"/>', width: 32, left: -4 },
    },
    aliases: {
        home: { parent: 'house' },
        'house-flipped': { parent: 'house', hFlip: true },
        'house-rotated': { parent: 'house-flipped', rotate: 1 },
        loop: { parent: 'loop' },
    },
};

test('Aliases replace interface icons; without one, the given icon renders as before', (t) => {
    t.after(() => icons.alias({ 'section.collapse-button': null, 'panels::sidebar.collapse-button': null, 'forms:components.rich-editor.toolbar.clear_formatting': null, 'tables::empty-state': null }));
    const chevron = icon('m-chevron-up');
    assert.equal(icon('m-chevron-up', { alias: 'section.collapse-button' }), chevron);
    assert.equal(icons.resolve('section.collapse-button'), null);

    icons.alias({ 'section.collapse-button': 'm-chevron-down', 'panels::sidebar.collapse-button': 'o-arrow-left' });
    assert.equal(icon('m-chevron-up', { alias: 'section.collapse-button' }), icon('m-chevron-down'));
    assert.equal(icons.resolve(['nothing', 'panels::sidebar.collapse-button']), 'o-arrow-left');
    // Filament's alternative spellings resolve to the same icon.
    icons.alias({ 'forms:components.rich-editor.toolbar.clear_formatting': 'm-x-mark' });
    assert.equal(icons.resolve('forms::components.rich-editor.toolbar.clear-formatting'), 'm-x-mark');
    // HTML: rendered inside a `nv-icon` span with the size and extra classes.
    icons.alias({ 'tables::empty-state': new HtmlString('<svg data-custom></svg>') });
    assert.equal(icon('o-x-mark', { alias: 'tables::empty-state', size: 'lg', attributes: new Attributes({ class: 'extra' }) }), '<span class="extra nv-icon nv-size-lg"><svg data-custom></svg></span>');
    assert.equal(icon(new HtmlString('<b>i</b>')), '<span class="nv-icon nv-size-md"><b>i</b></span>');
    // `null` removes the replacement.
    icons.alias({ 'section.collapse-button': null });
    assert.equal(icon('m-chevron-up', { alias: 'section.collapse-button' }), chevron);
    assert.throws(() => icons.alias({ x: 42 as any }), /expects an icon name/);
    // An HTML alias name is not usable as a Heroicons name.
    assert.throws(() => icon('@m-eye'), /Icon not found/);
});

test('Interface components read their alias at render time', (t) => {
    t.after(() => icons.alias({ 'section.collapse-button': null, 'pagination.next-button': null, 'modal.close-button': null }));
    const paths = (name: string) => icon(name).replace(/^<svg[^>]*>/, '');
    const before = section({ heading: 'Orders', collapsible: true }, 'x');
    assert.ok(before.includes(paths('m-chevron-up')));
    icons.alias({ 'section.collapse-button': 'm-minus' });
    const after = section({ heading: 'Orders', collapsible: true }, 'x');
    assert.ok(after.includes(paths('m-minus')) && !after.includes(paths('m-chevron-up')));
    const page = () => pagination({ id: 'p', page: 2, perPage: 10, total: 30 });
    assert.ok(page().includes(paths('m-chevron-right')));
    icons.alias({ 'pagination.next-button': 'm-arrow-right' });
    assert.ok(page().includes(paths('m-arrow-right')) && !page().includes(paths('m-chevron-right')));
});

test('Icon sets: prefix:name, validated names, cache cleared when a set is registered again', () => {
    assert.throws(() => icons.registerSet('Bad Prefix', () => null), /Invalid icon set prefix/);
    const asked: string[] = [];
    icons.registerSet('test-set', (name) => { asked.push(name); return name === 'star' ? '<svg viewBox="0 0 1 1"><path/></svg>' : name === 'text' ? 'not svg' : null; });
    assert.equal(icon('test-set:star'), '<svg class="nv-icon nv-size-md" viewBox="0 0 1 1"><path/></svg>');
    icon('test-set:star');
    assert.deepEqual(asked, ['star']); // cached
    assert.throws(() => icon('test-set:missing'), /Icon not found: test-set:missing/);
    assert.throws(() => icon('test-set:text'), /Icon not found/);
    assert.throws(() => icon('test-set:../etc/passwd'), /Invalid icon name/);
    assert.throws(() => icon('test-set:<script>'), /Invalid icon name/);
    assert.throws(() => icon('other:star'), /no icon set registered for the "other" prefix/);
    assert.equal(icons.has('test-set:star'), true);
    assert.equal(icons.has('test-set:nope'), false);
    icons.registerSet('test-set', () => '<svg id="v2"></svg>');
    assert.equal(icon('test-set:star'), '<svg class="nv-icon nv-size-md" id="v2"></svg>');
    // A single icon registered by name.
    registerIcon('brand', '<svg viewBox="0 0 2 2"></svg>');
    icons.register('brand-2', '<svg viewBox="0 0 3 3"></svg>');
    assert.equal(icon('brand'), '<svg class="nv-icon nv-size-md" viewBox="0 0 2 2"></svg>');
    assert.equal(icon('brand-2', { size: 'sm' }), '<svg class="nv-icon nv-size-sm" viewBox="0 0 3 3"></svg>');
});

test('Iconify JSON: viewBox, aliases, flips and rotations', () => {
    assert.equal(iconifyToSvg(SET, 'house'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" data-slot="icon"><path d="M1 1h22"/></svg>');
    assert.equal(iconifyToSvg(SET, 'home'), iconifyToSvg(SET, 'house'));
    assert.equal(iconifyToSvg(SET, 'wide'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 0 32 24" aria-hidden="true" data-slot="icon"><path d="M0 0"/></svg>');
    assert.equal(iconifyToSvg(SET, 'house-flipped'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" data-slot="icon"><g transform="translate(24 0) scale(-1 1)"><path d="M1 1h22"/></g></svg>');
    assert.equal(iconifyToSvg(SET, 'house-rotated'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" data-slot="icon"><g transform="rotate(90 12 12) translate(24 0) scale(-1 1)"><path d="M1 1h22"/></g></svg>');
    assert.equal(iconifyToSvg(SET, 'missing'), null);
    assert.equal(iconifyToSvg(SET, 'loop'), null);
    assert.equal(iconifyToSvg(SET, 'constructor'), null);

    icons.registerIconify(SET);
    assert.equal(icon('demo:home', { size: 'lg' }), '<svg class="nv-icon nv-size-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" data-slot="icon"><path d="M1 1h22"/></svg>');
    icons.registerIconify(SET, { prefix: 'other-demo' });
    assert.ok(icon('other-demo:house').includes('M1 1h22'));
    assert.throws(() => icons.registerIconify({} as any), /expects an Iconify JSON set/);
});

test('Iconify package installed in the application: loaded by name', (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'navette-iconify-'));
    const cwd = process.cwd();
    t.after(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });
    const pkg = path.join(dir, 'node_modules', '@iconify-json', 'fake');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{}');
    writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@iconify-json/fake', version: '1.0.0', exports: { './icons.json': './icons.json' } }));
    writeFileSync(path.join(pkg, 'icons.json'), JSON.stringify({ prefix: 'fake', icons: { dot: { body: '<circle r="1"/>' } } }));
    process.chdir(dir);
    icons.registerIconify('fake');
    assert.ok(icon('fake:dot').includes('<circle r="1"/>'));
    icons.registerIconify('@iconify-json/fake', { prefix: 'fake-2' });
    assert.ok(icon('fake-2:dot').includes('<circle r="1"/>'));
    assert.throws(() => icons.registerIconify('../evil'), /Invalid Iconify package name/);
    assert.throws(() => icons.registerIconify('not-installed'));
});
