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
    assert.ok(html.includes('<fieldset id="form.fieldset" class="nv-sc-fieldset nv-fieldset"><legend>Rate limiting</legend><div class="nv-grid lg:nv-grid-cols nv-sc nv-sc-has-gap" style="--cols-lg: repeat(3, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));"><div wire:partial="schema-component::form.fieldset.hits"'));
    assert.match(html, /\\u0022path\\u0022:\\u0022data.fieldset\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022/);
    const plain = await render([Fieldset.make('<b>').contained(false).hiddenLabel().markAsRequired().schema([])]);
    assert.ok(plain.includes('<fieldset class="nv-sc-fieldset nv-fieldset nv-fieldset-label-hidden nv-fieldset-not-contained"><legend>&lt;b&gt;<sup class="nv-fieldset-label-required-mark">*</sup></legend></fieldset>'));
});

test('Text: escaped text, color, badge, raw HTML, copyable', async () => {
    const html = await render([Text.make('<b>gras</b>'), Text.make('Danger').color('danger').weight('bold'), Text.make('Pastille').badge().color('success'), Text.make(raw('<a href="/x">x</a>')), Text.make('copie').copyable()]);
    assert.ok(html.includes('<span class="nv-sc-text">&lt;b&gt;gras&lt;/b&gt;</span>'));
    assert.match(html, /<span class="nv-color nv-color-danger nv-text-color-\d+ dark:nv-text-color-\d+ nv-sc-text nv-font-bold">Danger<\/span>/);
    assert.match(html, /<span class="nv-sc-text nv-badge nv-size-md nv-color nv-color-success [^"]+"><span class="nv-badge-label-ctn"><span class="nv-badge-label">Pastille<\/span><\/span><\/span>/);
    assert.ok(html.includes('<span class="nv-sc-text"><a href="/x">x</a></span>'));
    assert.match(html, /<span role="button" tabindex="0" x-on:click="window\.navigator\.clipboard\.writeText\('copie'\)/);
});

test('Icon, Image: decorative or labelled, filtered URLs', async () => {
    const html = await render([Icon.make('o-user').tooltip('Profil'), Icon.make('o-user').color('gray').size('lg'), Image.make('/logo.png', 'Logo "x"').imageHeight(40).alignCenter(), Image.make('javascript:alert(1)', 'x'), Image.make('/a.png', 'a').imageWidth('10px;color:red')]);
    assert.match(html, /<svg aria-hidden="true" x-tooltip="\{ content: 'Profil', theme: \$store\.theme, allowHTML: false \}" class="nv-color nv-color-primary nv-sc-icon nv-icon nv-size-md"/);
    assert.ok(html.includes('<span aria-label="Profil" role="img" class="nv-sr-only"></span>'));
    assert.match(html, /<svg aria-hidden="true" class="nv-sc-icon nv-icon nv-size-lg"/);
    assert.ok(html.includes('<img alt="Logo &quot;x&quot;" src="/logo.png" class="nv-sc-image nv-align-center" style="height: 40px;" />'));
    assert.ok(!html.includes('javascript:') && !html.includes('color:red'));
});

test('UnorderedList: column grid, a string becomes a Text', async () => {
    const html = await render([UnorderedList.make(['Un', Text.make('Deux').weight('bold')]).size('sm')]);
    assert.ok(html.includes('<ul class="nv-grid nv-grid-direction-col sm:nv-grid-cols nv-sc-unordered-list nv-size-sm" style="--cols-sm: 2; --cols-default: 1;"><li wire:key="" x-data="navetteSchemaComponent(JSON.parse(\'{\\u0022key\\u0022:null,'));
    assert.ok(html.includes('"><span class="nv-sc-text">Un</span></li>'));
});

test('EmptyState: markup, footer actions mounted on the schema', async () => {
    const empty = EmptyState.make('No users yet').description('Get started by creating a new user.').icon('o-user').footer([Action.make('createUser').label('Create user').icon('m-plus').action(() => {})]);
    const html = withoutSvgBodies(await render([empty]));
    assert.ok(html.includes(`<div class="nv-sc-empty-state"><section class="nv-empty-state"><div class="nv-empty-state-content"><div class="nv-empty-state-icon-bg nv-color nv-color-primary"><svg class="nv-color nv-color-primary nv-icon nv-size-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon"></svg></div><div class="nv-empty-state-text-ctn"><h2 class="nv-empty-state-heading">No users yet</h2><p class="nv-empty-state-description">Get started by creating a new user.</p><footer class="nv-empty-state-footer"><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense"><div class="nv-sc-action"><button type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="nv-ac-btn-action nv-btn nv-size-md nv-color nv-color-primary`));
    assert.match(html, /wire:click="mountAction\('createUser', \{\}, JSON\.parse\('\{\\u0022schemaComponent\\u0022:\\u0022form\\u0022\}'\)\)"/);
    assert.deepEqual(empty.getActions().map((action: any) => action.getName()), ['createUser']);
    const compact = await render([EmptyState.make('<x>').compact().contained(false)]);
    assert.ok(compact.includes('<section class="nv-empty-state nv-compact nv-empty-state-not-contained"><div class="nv-empty-state-content"><div class="nv-empty-state-text-ctn"><h2 class="nv-empty-state-heading">&lt;x&gt;</h2></div></div></section>'));
});

test('Callout: status, color, link actions, controls', async () => {
    const info = withoutSvgBodies(await render([Callout.make('New version available').description('Navette 2 has been released with exciting new features and improvements.').info()]));
    assert.ok(info.includes('<div class="nv-color nv-color-info nv-sc-callout nv-callout"><svg aria-hidden="true" class="nv-color nv-color-info nv-callout-icon nv-icon nv-size-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon"></svg><div class="nv-callout-main"><div class="nv-callout-text"><h4 class="nv-callout-heading"><span class="nv-sr-only">Note: </span>New version available</h4><p class="nv-callout-description">Navette 2 has been released with exciting new features and improvements.</p></div></div></div>'));
    const plain = await render([Callout.make('Scheduled maintenance').warning().color(null)]);
    assert.match(plain, /<div class="nv-sc-callout nv-callout"><svg aria-hidden="true" class="nv-color nv-color-warning nv-callout-icon/);
    const callout = Callout.make('Trial').warning().actions([Action.make('compare').label('Compare plans').action(() => {})]).controlActions([Action.make('dismiss').label('Dismiss').icon('m-x-mark').iconButton().color('gray').action(() => {})]);
    const html = withoutSvgBodies(await render([callout]));
    assert.match(html, /<div class="nv-callout-footer"><div class="nv-sc nv-inline nv-align-start nv-sc-has-gap nv-sc-dense"><div class="nv-sc-action"><button type="button" wire:loading\.attr="aria-disabled" wire:loading\.class="nv-disabled" class="nv-ac-link-action nv-link nv-size-sm nv-color nv-color-primary [^"]+" wire:click="mountAction\('compare'/);
    assert.match(html, /<div class="nv-callout-controls"><div class="nv-sc nv-inline nv-align-start nv-sc-has-gap nv-sc-dense"><div class="nv-sc-action"><button title="Dismiss" aria-label="Dismiss" type="button" wire:loading\.attr="aria-disabled" wire:loading\.class="nv-disabled" class="nv-ac-icon-btn-action nv-icon-btn nv-size-sm" wire:click="mountAction\('dismiss'/);
    assert.ok(!html.includes('wire:key=""'));
    assert.deepEqual(callout.getActions().map((action: any) => action.getName()), ['compare', 'dismiss']);
    // Free-form footer: components and actions mixed, no forced alignment.
    const footer = await render([Callout.make('Backup complete').success().footer([Text.make('Last backup: 5 minutes ago'), Action.make('view').action(() => {})])]);
    assert.match(footer, /<div class="nv-callout-footer"><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense"><div x-data="navetteSchemaComponent\(JSON\.parse\('\{\\u0022key\\u0022:null,\\u0022exposedMethods\\u0022:\[\],\\u0022path\\u0022:\\u0022data\\u0022,\\u0022containerPath\\u0022:\\u0022data\\u0022\}'\)\)"><div class="nv-sc-component"><span class="nv-sc-text">Last backup: 5 minutes ago<\/span><\/div><\/div><div class="nv-sc-action">/);
});
