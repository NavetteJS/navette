import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Attributes, ColorManager, loadingIndicator, useLoadingIndicator, views } from '../src/index.ts';
import { button, iconButton, link, pagination, useColorManager } from '../src/ui.ts';

useColorManager(new ColorManager());
const dir = mkdtempSync(path.join(tmpdir(), 'navette-component-props-'));
views.namespace('test-props', dir);
const render = (source: string, data: Record<string, unknown> = {}) => {
    const name = `v${Math.random().toString(36).slice(2)}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${name}.ejs`), source);
    return views.render(`test-props::${name}`, data);
};
const unescape = (html: string) => html.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');

test('tooltip on buttons, links and icon buttons; a disabled button with a tooltip stays focusable', () => {
    const html = unescape(render(`<x-button tooltip="Register a user">New</x-button><x-link href="/a" tooltip="Go">A</x-link><x-icon-button icon="o-plus" label="Add" tooltip="Add a user" />`));
    assert.match(html, /<button [^>]*x-tooltip="\{\s*content: 'Register a user',\s*theme: \$store\.theme,\s*allowHTML: false,\s*\}"/);
    assert.match(html, /<a [^>]*x-tooltip="\{\s*content: 'Go',/);
    assert.match(html, /x-tooltip="\{\s*content: 'Add a user',/);
    assert.doesNotMatch(html, /title="Add"/, 'the tooltip replaces the title');
    const disabled = button({ disabled: true, tooltip: 'Not now' }, 'Save');
    assert.match(disabled, /aria-disabled="true"/);
    assert.doesNotMatch(disabled, / disabled[ >=]/);
    assert.match(button({ disabled: true }, 'Save'), / disabled/);
    assert.match(iconButton({ icon: 'o-plus', label: 'Add', tag: 'a', href: '/x', disabled: true, tooltip: 'No' }), /tabindex="0"/);
    assert.match(link({ tag: 'button', disabled: true }, 'Off'), /fi-disabled/);
});

test('modal: trigger slot, disabled trigger and autofocus', () => {
    const html = unescape(render(`<x-modal id="edit-user" heading="Edit"><x-slot name="trigger"><x-button>Open</x-button></x-slot><p>Body</p></x-modal>`));
    assert.match(html, /^<div><div x-on:click="\$dispatch\('open-modal', \{ id: 'edit-user' \}\)" class="fi-modal-trigger"><button /);
    assert.match(html, /x-trap\.noreturn="isTrapActive"/);
    const disabled = unescape(render(`<x-modal id="m2" :autofocus="false"><x-slot name="trigger" disabled><x-button :disabled="true">Open</x-button></x-slot>Body</x-modal>`));
    assert.match(disabled, /<div class="fi-modal-trigger">/);
    assert.doesNotMatch(disabled, /\$dispatch\('open-modal', \{ id: 'm2'/);
    assert.match(disabled, /x-trap\.noreturn\.noautofocus="isTrapActive"/);
    // Without an id, the modal gets one, and its trigger opens it.
    const anonymous = unescape(render(`<x-modal><x-slot:trigger><x-button>Open</x-button></x-slot>Body</x-modal>`));
    const id = /data-fi-modal-id="([^"]+)"/.exec(anonymous)![1];
    assert.ok(anonymous.includes(`id: '${id}'`));
});

test('section: persisted collapsed state', () => {
    const html = unescape(render(`<x-section heading="User details" collapsible collapsed persist-collapsed id="user-details">Content</x-section>`));
    assert.match(html, /x-data="\{ isCollapsed: \$persist\(true\)\.as\(`filament:section:collapsed:\$\{null \?\? \$el\.id\}`\) , \}"/);
    assert.match(html, /id="user-details"/);
    assert.match(html, /x-cloak class="fi-section-content-ctn"/);
    const open = unescape(render(`<x-section heading="A" collapsible persist-collapsed collapse-id="a">Content</x-section>`));
    assert.match(open, /\$persist\(false\)\.as\(`filament:section:collapsed:\$\{'a' \?\? \$el\.id\}`\)/);
    assert.match(open, /x-cloak class="fi-section-content-ctn"/, 'hidden until the persisted state is read');
});

test('dropdown with other content than a menu', () => {
    const html = render(`<x-dropdown :menu="false"><x-slot name="trigger"><x-button>Edit notes</x-button></x-slot><label for="n">Notes</label></x-dropdown>`);
    assert.match(html, /filamentDropdown\(\{ isMenu: false \}\)/);
    assert.doesNotMatch(html, /role="menu"/);
    assert.match(render(`<x-dropdown><x-slot name="trigger">T</x-slot>x</x-dropdown>`), /role="menu"/);
});

test('pagination loading targets', () => {
    const html = pagination({ id: 'c1', page: 1, perPage: 10, total: 50, loadingTargets: ['search', 'applyFilters'] });
    assert.match(html, /wire:target="search,applyFilters,previousPage,gotoPage,setPage,nextPage,paginators,tableRecordsPerPage"/);
    const tagged = render(`<x-pagination id="c2" :page="1" :per-page="10" :total="30" :loading-targets="['search']" />`);
    assert.match(tagged, /wire:target="search,previousPage/);
});

test('tabs: <x-tabs.item> with active and alpine-active', () => {
    const html = unescape(render(`<x-tabs label="Content tabs" x-data="{ activeTab: 'tab1' }"><x-tabs.item alpine-active="activeTab === 'tab1'" x-on:click="activeTab = 'tab1'">Tab 1</x-tabs.item><x-tabs.item active>Tab <b>2</b></x-tabs.item><x-tabs.item tag="a" href="/x" :active="true" icon="o-user">Link</x-tabs.item></x-tabs>`));
    assert.match(html, /<nav [^>]*aria-label="Content tabs"[^>]*class="fi-tabs"/);
    assert.match(html, /<button type="button" x-bind:class="\{\s*'fi-active': activeTab === 'tab1',\s*\}" x-on:click="activeTab = 'tab1'" class="fi-tabs-item">/);
    assert.match(html, /<button type="button" aria-current="true" class="fi-tabs-item fi-active"><span class="fi-tabs-item-label">Tab <b>2<\/b><\/span>/);
    assert.match(html, /<a href="\/x" aria-current="page" class="fi-tabs-item fi-active">/);
});

test('input wrapper: alpine-valid and alpine-disabled; Filament tag names', () => {
    const html = unescape(render(`<div x-data="{ errors: ['name'] }"><x-input.wrapper alpine-valid="! errors.includes('name')"><x-input type="text" wire:model="name" /></x-input.wrapper></div>`));
    assert.match(html, /<div x-bind:class="\{\s*'fi-invalid': ! \(! errors\.includes\('name'\)\),\s*\}" class="fi-input-wrp">/);
    const both = unescape(render(`<x-input-wrapper alpine-disabled="locked" alpine-valid="ok" :valid="false" disabled>x</x-input-wrapper>`));
    assert.match(both, /'fi-disabled': locked,\s*'fi-invalid': ! \(ok\),/);
    assert.match(both, /class="fi-input-wrp"/, 'the Alpine expressions replace the static states');
    assert.match(render(`<x-dropdown.list><x-dropdown.list.item>One</x-dropdown.list.item></x-dropdown.list>`), /<div class="fi-dropdown-list"><button [^>]*class="fi-dropdown-list-item"/);
});

test('the loading indicator can be replaced everywhere', () => {
    useLoadingIndicator((attributes) => `<span ${attributes.toHtml()}>Loading…</span>`);
    try {
        assert.equal(loadingIndicator(new Attributes({ 'wire:loading': '' }), 'sm'), '<span wire:loading="" class="fi-icon fi-loading-indicator fi-size-sm">Loading…</span>');
        assert.match(render(`<x-loading-indicator class="h-5 w-5" />`), /<span class="[^"]*fi-loading-indicator[^"]*">Loading…<\/span>/);
    } finally { useLoadingIndicator(null); }
    assert.match(loadingIndicator(), /^<svg /);
});
