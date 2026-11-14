import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager } from '@navette-js/support';
import '@navette-js/support/ui';
import { Action, ActionGroup, useColorManager } from '../src/index.ts';

useColorManager(new ColorManager());
const ctx = { livewire: { getActionMountContext: () => ({}) }, component: null, operation: null, record: null, get: () => undefined, state: undefined } as any;
const clean = (html: string) => html.replace(/\s+/g, ' ');

test('trigger styles: link, icon button, badge, outlined and labeled from a breakpoint', async () => {
    const run = Action.make('run').label('Run').icon('m-play').action(() => {});
    assert.match(clean(await Action.make('run').label('Run').action(() => {}).link().toHtml(ctx)), /class="fi-ac-link-action fi-link fi-size-md[^"]*">(<svg[^]*?<\/svg>)?<span class="fi-link-label">Run<\/span><\/button>/);
    assert.match(clean(await Action.make('run').label('Run').icon('m-play').action(() => {}).iconButton().toHtml(ctx)), /<button title="Run" aria-label="Run" [^>]*class="fi-ac-icon-btn-action fi-icon-btn fi-size-md/);
    assert.match(clean(await Action.make('run').label('Run').action(() => {}).badge().toHtml(ctx)), /class="fi-ac-badge-action fi-badge fi-size-md[^"]*">(<svg[^]*?<\/svg>)?<span class="fi-badge-label-ctn"><span class="fi-badge-label">Run<\/span>/);
    assert.match(clean(await Action.make('run').label('Run').action(() => {}).badge(3).toHtml(ctx)), /fi-btn-badge-ctn|class="fi-ac-btn-action fi-btn/, 'badge(value) keeps the counter');
    assert.match(clean(await Action.make('run').label('Run').color('danger').action(() => {}).outlined().toHtml(ctx)), /fi-btn fi-size-md fi-outlined/);
    const labeled = clean(await run.labeledFrom('md').toHtml(ctx));
    assert.match(labeled, /class="md:fi-hidden fi-ac-icon-btn-action fi-icon-btn/);
    assert.match(labeled, /fi-btn [^"]*fi-hidden md:fi-inline-grid"/);
    assert.match(clean(await Action.make('docs').label('Docs').url('/docs').link().toHtml(ctx)), /<a href="\/docs" wire:navigate[^>]*class="fi-ac-link-action fi-link/);
    assert.doesNotMatch(clean(await Action.make('bad').label('Bad').url('javascript:alert(1)').link().toHtml(ctx)), /javascript/);
});

test('action groups: custom trigger, dropdown options, sections with dividers, button group', async () => {
    const edit = Action.make('edit').action(() => {}), view = Action.make('view').action(() => {}), remove = Action.make('delete').color('danger').action(() => {});
    const keyOf = (action: Action) => `k.${action.getName()}`;
    const group = ActionGroup.make([view, edit, ActionGroup.make([remove]).dropdown(false)])
        .label('More').icon('m-cog').button().tooltip('Options')
        .dropdownPlacement('top-start').dropdownWidth('xs').dropdownOffset(16).maxHeight('200px');
    const html = clean(await group.toHtml(ctx, {}, keyOf));
    assert.match(html, /class="fi-ac-btn-group fi-btn fi-size-md[^"]*"><svg[^]*?<\/svg>More<\/button>/);
    assert.match(html, /x-tooltip=/);
    assert.match(html, /x-float\.placement\.top-start\.flip\.teleport\.offset="\{ offset: 16 \}"/);
    assert.match(html, /class="fi-dropdown-panel fi-width-xs fi-scrollable" style="max-height: 200px"/);
    assert.equal((html.match(/class="fi-dropdown-list" role="group"/g) ?? []).length, 2, 'the nested group is a separate section');
    assert.deepEqual(group.getActions().map((action) => action.getName()), ['view', 'edit', 'delete']);
    assert.equal(group.isMountable(), false);
    assert.match(clean(await ActionGroup.make([view, edit]).buttonGroup().toHtml(ctx)), /^<div class="fi-btn-group"> ?<button/);
    assert.equal(await ActionGroup.make([Action.make('x').hidden().action(() => {})]).toHtml(ctx), '');
    const defaults = clean(await ActionGroup.make([view]).toHtml(ctx, {}, keyOf));
    assert.match(defaults, /<button title="Actions" aria-label="Actions" type="button"[^>]*class="fi-ac-icon-btn-group fi-icon-btn fi-size-md/);
    assert.match(defaults, /x-float\.placement\.bottom-end\.flip\.teleport\.offset="\{ offset: 8 \}"/);
});

test('icon aliases: default group trigger and confirmation modal icons can be replaced', async (t) => {
    const { icon, icons } = await import('@navette-js/support');
    t.after(() => icons.alias({ 'actions::action-group': null }));
    const paths = (name: string) => icon(name).replace(/^<svg[^>]*>/, '');
    const group = () => ActionGroup.make([Action.make('edit').action(() => {})]).toHtml(ctx);
    assert.ok((await group()).includes(paths('m-ellipsis-vertical')));
    icons.alias({ 'actions::action-group': 'm-bars-3' });
    const replaced = await group();
    assert.ok(replaced.includes(paths('m-bars-3')) && !replaced.includes(paths('m-ellipsis-vertical')));
    // An explicit icon wins over the alias.
    assert.ok((await ActionGroup.make([Action.make('edit').action(() => {})]).icon('m-cog').toHtml(ctx)).includes(paths('m-cog')));
});
