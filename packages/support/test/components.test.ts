import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ColorManager, ViewRegistry, views } from '../src/index.ts';
import { compileComponentTags } from '../src/components.ts';
import { useColorManager } from '../src/ui.ts';

useColorManager(new ColorManager());
const dir = mkdtempSync(path.join(tmpdir(), 'navette-components-'));
const write = (file: string, content: string) => { mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); writeFileSync(path.join(dir, file), content); };
views.namespace('test-components', path.join(dir, 'views'));
views.components(path.join(dir, 'components'));
const render = (source: string, data: Record<string, unknown> = {}) => {
    const name = `v${Math.random().toString(36).slice(2)}`;
    write(`views/${name}.ejs`, source);
    return views.render(`test-components::${name}`, data);
};

test('built-in components: props, default slot, attributes and named slots', () => {
    const html = render(`<x-section heading="Orders" description="Last 30 days" class="my-section" x-data="{ open: true }">
<p><%= message %></p>
<x-slot name="footer"><x-button color="danger" icon="o-trash" wire:click="clear">Clear</x-button></x-slot>
</x-section>`, { message: '<b>hi</b>' });
    assert.match(html, /<section [^>]*class="[^"]*nv-section[^"]*my-section|<section [^>]*class="my-section[^"]*nv-section/);
    assert.match(html, /x-data="\{ open: true \}"/);
    assert.match(html, /<h2 class="nv-section-header-heading">Orders<\/h2>/);
    assert.match(html, /<p>&lt;b&gt;hi&lt;\/b&gt;<\/p>/);
    assert.match(html, /<footer class="nv-section-footer"><button [^>]*wire:click="clear"[^>]*>/);
    assert.match(html, /nv-color-danger/);
    assert.equal((html.match(/nv-section-footer/g) ?? []).length, 1, 'the named slot is not repeated in the content');
});

test('bound props, flags, self-closing tags and the slot:name syntax', () => {
    const html = render(`<x-badge :color="status === 'paid' ? 'success' : 'gray'">Paid</x-badge><x-icon name="o-check" size="lg" /><x-section heading="A" collapsible collapsed><x-slot:after-header><span>after</span></x-slot>Body</x-section>`, { status: 'paid' });
    assert.match(html, /nv-color-success[^"]*nv-badge|nv-badge[^"]*nv-color-success/);
    assert.match(html, /<svg [^>]*class="nv-icon nv-size-lg"/);
    assert.match(html, /nv-collapsible/);
    assert.match(html, /isCollapsed: true/);
    assert.match(html, /nv-section-header-after-ctn"><span>after<\/span>/);
});

test('application components from a directory: props, slot, named slots, attribute bag, nesting', () => {
    write('components/card.ejs', `<article <%- attributes.class(['card']) %>><h3><%= title %></h3><div class="body"><%- slot %></div><% if (slots.footer) { %><footer><%- slots.footer %></footer><% } %></article>`);
    write('components/forms/hint.ejs', `<small class="hint"><%- slot %></small>`);
    const html = render(`<x-card :title="post.title" id="post-1" data-kind="post"><x-forms.hint>Nested <x-badge>new</x-badge></x-forms.hint><x-slot name="footer">By <%= post.author %></x-slot></x-card>`, { post: { title: 'A <title>', author: 'Ada & co' } });
    assert.match(html, /<article [^>]*id="post-1"/);
    assert.match(html, /data-kind="post"/);
    assert.match(html, /class="card"/);
    assert.match(html, /<h3>A &lt;title&gt;<\/h3>/);
    assert.match(html, /<small class="hint">Nested <span [^>]*nv-badge/);
    assert.match(html, /<footer>By Ada &amp; co<\/footer>/);
});

test('application components override built-ins, function components can be registered', () => {
    const registry = new ViewRegistry();
    registry.component('rating', (props, slot) => `<span class="rating" data-value="${Number(props.value)}">${slot}</span>`);
    assert.equal(registry.renderComponent('rating', { value: '4' }, '★'), '<span class="rating" data-value="4">★</span>');
    write('components/badge.ejs', '<i class="my-badge"><%- slot %></i>');
    assert.equal(render('<x-badge>x</x-badge>'), '<i class="my-badge">x</i>');
});

test('errors: unknown component, unclosed or mismatched tags, slot outside a component', () => {
    assert.throws(() => render('<x-missing-thing />'), /Unknown component <x-missing-thing>/);
    assert.throws(() => compileComponentTags('<x-card>'), /never closed/);
    assert.throws(() => compileComponentTags('<x-card></x-section>'), /does not close/);
    assert.throws(() => compileComponentTags('<x-slot name="a">x</x-slot>'), /must be inside a component/);
    assert.equal(compileComponentTags('<div x-data="{}">no tags</div>'), '<div x-data="{}">no tags</div>');
});

test('tags inside EJS code or comments are left alone', () => {
    assert.doesNotMatch(compileComponentTags('<%# <x-slot name="footer"> in a comment %><p>x</p>'), /__component|__xn\[/);
    assert.equal(render(`<%# usage: <x-card title="…">…</x-card> %><% const tag = '<x-not-a-component>'; %><%= tag %>`), '&lt;x-not-a-component&gt;');
});

test('built-in fixes: modal and pagination ids, checkbox attributes, dropdown item content, empty slots, badge links', () => {
    const modal = render('<x-modal id="confirm" heading="Sure?">Body</x-modal>');
    assert.match(modal, /id="confirm"/);
    assert.match(modal, /aria-labelledby="confirm.heading"/);
    assert.doesNotMatch(modal, /undefined/);
    assert.match(render('<x-checkbox name="agree" value="yes" checked />'), /<input [^>]*name="agree"[^>]*value="yes"|<input [^>]*value="yes"[^>]*name="agree"/);
    assert.match(render('<x-dropdown-item><%= name %></x-dropdown-item>', { name: 'Tom & Jerry' }), /nv-dropdown-list-item-label">Tom &amp; Jerry</);
    const section = render(`<x-section heading="A">
    <x-slot name="footer">F</x-slot>
</x-section>`);
    assert.doesNotMatch(section, /nv-section-content"/);
    // An earlier test overrides <x-badge> with a file: remove it to test the built-in.
    rmSync(path.join(dir, 'components', 'badge.ejs'), { force: true });
    assert.match(render('<x-badge tag="a" href="/orders">Orders</x-badge>'), /<a [^>]*href="\/orders"/);
});
