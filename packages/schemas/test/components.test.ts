import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, raw } from '@navette-js/support';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Callout, EmptyState, Fieldset, Html, Icon, Image, Schema, Text, UnorderedList, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);

const host = () => ({ id: 'lw', _errors: {} as Record<string, string[]>, data: {}, getSchema() { return null as any; }, getActionMountContext: () => ({}) });
/** Rendered HTML without the EJS layout whitespace, with apostrophes decoded, so it compares against compact expected markup. */
const render = async (components: any[], livewire: any = host()) => (await Schema.make(livewire).key('form').statePath('data').components(components).toHtml()).replace(/>\s*\n\s*/g, '>').replace(/\s*\n\s*</g, '<').replace(/&#039;/g, "'");
/** Strips `<svg>` bodies: the icons themselves are not compared. */
const withoutSvgBodies = (html: string) => html.replace(/(<svg[^>]*>)[\s\S]*?<\/svg>/g, '$1</svg>');

test('Fieldset: legend, two-column grid, optional state path', async () => {
    const html = await render([Fieldset.make('Rate limiting').statePath('fieldset').columns(3).schema([Html.make('<i>x</i>').key('hits')])]);
    assert.ok(html.includes('<fieldset id="form.fieldset" class="fi-sc-fieldset fi-fieldset"><legend>Rate limiting</legend><div class="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style="--cols-lg: repeat(3, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));"><div wire:partial="schema-component::form.fieldset.hits"'));
    assert.match(html, /\\u0022path\\u0022:\\u0022data.fieldset\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022/);
    const plain = await render([Fieldset.make('<b>').contained(false).hiddenLabel().markAsRequired().schema([])]);
    assert.ok(plain.includes('<fieldset class="fi-sc-fieldset fi-fieldset fi-fieldset-label-hidden fi-fieldset-not-contained"><legend>&lt;b&gt;<sup class="fi-fieldset-label-required-mark">*</sup></legend></fieldset>'));
});

test('Text: escaped text, color, badge, raw HTML, copyable', async () => {
    const html = await render([Text.make('<b>gras</b>'), Text.make('Danger').color('danger').weight('bold'), Text.make('Pastille').badge().color('success'), Text.make(raw('<a href="/x">x</a>')), Text.make('copie').copyable()]);
    assert.ok(html.includes('<span class="fi-sc-text">&lt;b&gt;gras&lt;/b&gt;</span>'));
    assert.match(html, /<span class="fi-color fi-color-danger fi-text-color-\d+ dark:fi-text-color-\d+ fi-sc-text fi-font-bold">Danger<\/span>/);
    assert.match(html, /<span class="fi-sc-text fi-badge fi-size-md fi-color fi-color-success [^"]+"><span class="fi-badge-label-ctn"><span class="fi-badge-label">Pastille<\/span><\/span><\/span>/);
    assert.ok(html.includes('<span class="fi-sc-text"><a href="/x">x</a></span>'));
    assert.match(html, /<span role="button" tabindex="0" x-on:click="window\.navigator\.clipboard\.writeText\('copie'\)/);
});

test('Icon, Image: decorative or labelled, filtered URLs', async () => {
    const html = await render([Icon.make('o-user').tooltip('Profil'), Icon.make('o-user').color('gray').size('lg'), Image.make('/logo.png', 'Logo "x"').imageHeight(40).alignCenter(), Image.make('javascript:alert(1)', 'x'), Image.make('/a.png', 'a').imageWidth('10px;color:red')]);
    assert.match(html, /<svg aria-hidden="true" x-tooltip="\{ content: 'Profil', theme: \$store\.theme, allowHTML: false \}" class="fi-color fi-color-primary fi-sc-icon fi-icon fi-size-md"/);
    assert.ok(html.includes('<span aria-label="Profil" role="img" class="fi-sr-only"></span>'));
    assert.match(html, /<svg aria-hidden="true" class="fi-sc-icon fi-icon fi-size-lg"/);
    assert.ok(html.includes('<img alt="Logo &quot;x&quot;" src="/logo.png" class="fi-sc-image fi-align-center" style="height: 40px;" />'));
    assert.ok(!html.includes('javascript:') && !html.includes('color:red'));
});

test('UnorderedList: column grid, a string becomes a Text', async () => {
    const html = await render([UnorderedList.make(['Un', Text.make('Deux').weight('bold')]).size('sm')]);
    assert.ok(html.includes('<ul class="fi-grid fi-grid-direction-col sm:fi-grid-cols fi-sc-unordered-list fi-size-sm" style="--cols-sm: 2; --cols-default: 1;"><li wire:key="" x-data="filamentSchemaComponent(JSON.parse(\'{\\u0022key\\u0022:null,'));
    assert.ok(html.includes('"><span class="fi-sc-text">Un</span></li>'));
});

test('EmptyState: markup, footer actions mounted on the schema', async () => {
    const empty = EmptyState.make('No users yet').description('Get started by creating a new user.').icon('o-user').footer([Action.make('createUser').label('Create user').icon('m-plus').action(() => {})]);
    const html = withoutSvgBodies(await render([empty]));
    assert.ok(html.includes(`<div class="fi-sc-empty-state"><section class="fi-empty-state"><div class="fi-empty-state-content"><div class="fi-empty-state-icon-bg fi-color fi-color-primary"><svg class="fi-color fi-color-primary fi-icon fi-size-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon"></svg></div><div class="fi-empty-state-text-ctn"><h2 class="fi-empty-state-heading">No users yet</h2><p class="fi-empty-state-description">Get started by creating a new user.</p><footer class="fi-empty-state-footer"><div class="fi-sc fi-inline fi-sc-has-gap fi-sc-dense"><div class="fi-sc-action"><button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-btn-action fi-btn fi-size-md fi-color fi-color-primary`));
    assert.match(html, /wire:click="mountAction\('createUser', \{\}, JSON\.parse\('\{\\u0022schemaComponent\\u0022:\\u0022form\\u0022\}'\)\)"/);
    assert.deepEqual(empty.getActions().map((action: any) => action.getName()), ['createUser']);
    const compact = await render([EmptyState.make('<x>').compact().contained(false)]);
    assert.ok(compact.includes('<section class="fi-empty-state fi-compact fi-empty-state-not-contained"><div class="fi-empty-state-content"><div class="fi-empty-state-text-ctn"><h2 class="fi-empty-state-heading">&lt;x&gt;</h2></div></div></section>'));
});

test('Callout: status, color, link actions, controls', async () => {
    const info = withoutSvgBodies(await render([Callout.make('New version available').description('Filament v4 has been released with exciting new features and improvements.').info()]));
    assert.ok(info.includes('<div class="fi-color fi-color-info fi-sc-callout fi-callout"><svg aria-hidden="true" class="fi-color fi-color-info fi-callout-icon fi-icon fi-size-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon"></svg><div class="fi-callout-main"><div class="fi-callout-text"><h4 class="fi-callout-heading"><span class="fi-sr-only">Note: </span>New version available</h4><p class="fi-callout-description">Filament v4 has been released with exciting new features and improvements.</p></div></div></div>'));
    const plain = await render([Callout.make('Scheduled maintenance').warning().color(null)]);
    assert.match(plain, /<div class="fi-sc-callout fi-callout"><svg aria-hidden="true" class="fi-color fi-color-warning fi-callout-icon/);
    const callout = Callout.make('Trial').warning().actions([Action.make('compare').label('Compare plans').action(() => {})]).controlActions([Action.make('dismiss').label('Dismiss').icon('m-x-mark').iconButton().color('gray').action(() => {})]);
    const html = withoutSvgBodies(await render([callout]));
    assert.match(html, /<div class="fi-callout-footer"><div class="fi-sc fi-inline fi-align-start fi-sc-has-gap fi-sc-dense"><div class="fi-sc-action"><button type="button" wire:loading\.attr="aria-disabled" wire:loading\.class="fi-disabled" class="fi-ac-link-action fi-link fi-size-sm fi-color fi-color-primary [^"]+" wire:click="mountAction\('compare'/);
    assert.match(html, /<div class="fi-callout-controls"><div class="fi-sc fi-inline fi-align-start fi-sc-has-gap fi-sc-dense"><div class="fi-sc-action"><button title="Dismiss" aria-label="Dismiss" type="button" wire:loading\.attr="aria-disabled" wire:loading\.class="fi-disabled" class="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" wire:click="mountAction\('dismiss'/);
    assert.ok(!html.includes('wire:key=""'));
    assert.deepEqual(callout.getActions().map((action: any) => action.getName()), ['compare', 'dismiss']);
    // Free-form footer: components and actions mixed, no forced alignment.
    const footer = await render([Callout.make('Backup complete').success().footer([Text.make('Last backup: 5 minutes ago'), Action.make('view').action(() => {})])]);
    assert.match(footer, /<div class="fi-callout-footer"><div class="fi-sc fi-inline fi-sc-has-gap fi-sc-dense"><div x-data="filamentSchemaComponent\(JSON\.parse\('\{\\u0022key\\u0022:null,\\u0022exposedMethods\\u0022:\[\],\\u0022path\\u0022:\\u0022data\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022\}'\)\)"><div class="fi-sc-component"><span class="fi-sc-text">Last backup: 5 minutes ago<\/span><\/div><\/div><div class="fi-sc-action">/);
});
