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
    assert.match(clean(await Action.make('run').label('Run').action(() => {}).link().toHtml(ctx)), /class="nv-ac-link-action nv-link nv-size-md[^"]*">(<svg[^]*?<\/svg>)?<span class="nv-link-label">Run<\/span><\/button>/);
    assert.match(clean(await Action.make('run').label('Run').icon('m-play').action(() => {}).iconButton().toHtml(ctx)), /<button title="Run" aria-label="Run" [^>]*class="nv-ac-icon-btn-action nv-icon-btn nv-size-md/);
    assert.match(clean(await Action.make('run').label('Run').action(() => {}).badge().toHtml(ctx)), /class="nv-ac-badge-action nv-badge nv-size-md[^"]*">(<svg[^]*?<\/svg>)?<span class="nv-badge-label-ctn"><span class="nv-badge-label">Run<\/span>/);
    assert.match(clean(await Action.make('run').label('Run').action(() => {}).badge(3).toHtml(ctx)), /nv-btn-badge-ctn|class="nv-ac-btn-action nv-btn/, 'badge(value) keeps the counter');
    assert.match(clean(await Action.make('run').label('Run').color('danger').action(() => {}).outlined().toHtml(ctx)), /nv-btn nv-size-md nv-outlined/);
    const labeled = clean(await run.labeledFrom('md').toHtml(ctx));
    assert.match(labeled, /class="md:nv-hidden nv-ac-icon-btn-action nv-icon-btn/);
    assert.match(labeled, /nv-btn [^"]*nv-hidden md:nv-inline-grid"/);
    assert.match(clean(await Action.make('docs').label('Docs').url('/docs').link().toHtml(ctx)), /<a href="\/docs" wire:navigate[^>]*class="nv-ac-link-action nv-link/);
    assert.doesNotMatch(clean(await Action.make('bad').label('Bad').url('javascript:alert(1)').link().toHtml(ctx)), /javascript/);
    // Protocol-relative URLs that browsers read as another site (`/\host`, `/<tab>/host`) are no links either.
    for (const url of ['//evil.example', '/\\evil.example', '/\t/evil.example']) {
        for (const html of [await Action.make('bad').label('Bad').url(url).link().toHtml(ctx), await Action.make('bad').label('Bad').url(url).toHtml(ctx)]) assert.doesNotMatch(html, /href="[^"]*evil\.example/, JSON.stringify(url));
    }
});

test('action groups: custom trigger, dropdown options, sections with dividers, button group', async () => {
    const edit = Action.make('edit').action(() => {}), view = Action.make('view').action(() => {}), remove = Action.make('delete').color('danger').action(() => {});
    const keyOf = (action: Action) => `k.${action.getName()}`;
    const group = ActionGroup.make([view, edit, ActionGroup.make([remove]).dropdown(false)])
        .label('More').icon('m-cog').button().tooltip('Options')
        .dropdownPlacement('top-start').dropdownWidth('xs').dropdownOffset(16).maxHeight('200px');
    const html = clean(await group.toHtml(ctx, {}, keyOf));
    assert.match(html, /class="nv-ac-btn-group nv-btn nv-size-md[^"]*"><svg[^]*?<\/svg>More<\/button>/);
    assert.match(html, /x-tooltip=/);
    assert.match(html, /x-float\.placement\.top-start\.flip\.teleport\.offset="\{ offset: 16 \}"/);
    assert.match(html, /class="nv-dropdown-panel nv-width-xs nv-scrollable" style="max-height: 200px"/);
    assert.equal((html.match(/class="nv-dropdown-list" role="group"/g) ?? []).length, 2, 'the nested group is a separate section');
    assert.deepEqual(group.getActions().map((action) => action.getName()), ['view', 'edit', 'delete']);
    assert.equal(group.isMountable(), false);
    assert.match(clean(await ActionGroup.make([view, edit]).buttonGroup().toHtml(ctx)), /^<div class="nv-btn-group"> ?<button/);
    assert.equal(await ActionGroup.make([Action.make('x').hidden().action(() => {})]).toHtml(ctx), '');
    const defaults = clean(await ActionGroup.make([view]).toHtml(ctx, {}, keyOf));
    assert.match(defaults, /<button title="Actions" aria-label="Actions" type="button"[^>]*class="nv-ac-icon-btn-group nv-icon-btn nv-size-md/);
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

test('SPA navigation only for paths of this site, unless spa(false)', async () => {
    const link = async (action: Action) => clean(await action.toHtml(ctx));
    for (const view of ['link', 'button', 'iconButton', 'badge'] as const) {
        const make = (url: string) => Action.make('go').label('Go').icon('m-arrow-right').url(url)[view]();
        assert.match(await link(make('/admin/posts')), / wire:navigate /, view);
        // An OAuth redirect to another origin: SPA navigation would be blocked by CORS.
        assert.doesNotMatch(await link(make('https://steamcommunity.com/openid/login')), /wire:navigate/, view);
        assert.doesNotMatch(await link(make('/auth/discord/redirect').spa(false)), /wire:navigate/, view);
    }
    const group = clean(await ActionGroup.make([Action.make('steam').url('https://steamcommunity.com/openid/login'), Action.make('home').url('/admin'), Action.make('full').url('/reports').spa(false)]).toHtml(ctx));
    assert.doesNotMatch(group, /href="https:\/\/steamcommunity\.com\/openid\/login" wire:navigate/);
    assert.match(group, /href="\/admin" wire:navigate/);
    assert.doesNotMatch(group, /href="\/reports" wire:navigate/);
    assert.equal(Action.make('a').url('/x').spa(false).navigatesTo('/x'), false);
    assert.equal(Action.make('a').url('/x').navigatesTo('//evil.example/x'), false);
});
