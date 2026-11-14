import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Action, useColorManager as useActionsColorManager } from '@navette-js/actions';
import { Callout, EmptyState, Fieldset, Grid, Group, Schema, Section, Tab, Tabs, Text, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
views.share({ assetUrl: (path: string) => `/${path}` });

const host = (extra: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data: {}, getSchema() { return null as any; }, getActionMountContext: () => ({}), ...extra });
const render = async (components: any[], livewire: any = host(), configure: (schema: Schema) => Schema = (schema) => schema) => (await configure(Schema.make(livewire).key('form').statePath('data')).components(components).toHtml()).replace(/>\s*\n\s*/g, '>').replace(/\s*\n\s*</g, '<').replace(/&#039;/g, "'");
/** Strips `<svg>` bodies: the icons themselves are not compared. */
const withoutSvgBodies = (html: string) => html.replace(/(<svg[^>]*>)[\s\S]*?<\/svg>/g, '$1</svg>');

test('Grid placement: column start and order per breakpoint, container queries', async () => {
    const html = await render([Grid.make({ '@md': 3 }).gridContainer().schema([
        Text.make('a').columnStart({ sm: 2, '@xl': 3, '!@md': 2 }).columnOrder({ default: 2, lg: 1 }),
        Text.make('b').columnStart(2).columnOrder(0),
        Text.make('c').columnStart({ 'x; color: red': 2, md: 'bad' as any, lg: 1.5 }).columnOrder(({ operation }) => (operation === null ? 3 : 1)),
    ])]);
    assert.ok(html.includes('<div class="nv-sc-component nv-grid-ctn"><div><div class="nv-grid @md:nv-grid-cols nv-sc nv-sc-has-gap" style="--cols-cmd: repeat(3, minmax(0, 1fr)); --cols-default: repeat(1, minmax(0, 1fr));">'));
    assert.ok(html.includes('class="nv-grid-col sm:nv-grid-col-start @xl:nv-grid-col-start !@md:nv-grid-col-start nv-grid-col-order lg:nv-grid-col-order" style="--col-span-default: span 1 / span 1; --col-start-sm: 2; --col-start-cxl: 3; --col-start-ncmd: 2; --col-order-default: 2; --col-order-lg: 1;"'));
    assert.ok(html.includes('class="nv-grid-col lg:nv-grid-col-start lg:nv-grid-col-order" style="--col-span-default: span 1 / span 1; --col-start-lg: 2; --col-order-lg: 0;"'));
    // Unknown breakpoints and non-integer values are dropped; a function's number applies to every screen size.
    assert.ok(html.includes('class="nv-grid-col nv-grid-col-order" style="--col-span-default: span 1 / span 1; --col-order-default: 3;"'));
    assert.ok(!html.includes('color: red'));
});

test('Spacing and headings: dense() and gap() are inherited, heading levels follow nesting', async () => {
    const html = await render([Fieldset.make('Dense').dense().schema([Group.make([Text.make('a')])]), Grid.make().gap(false).schema([Text.make('b')])]);
    assert.ok(html.includes('<fieldset class="nv-sc-fieldset nv-fieldset"><legend>Dense</legend><div class="nv-grid lg:nv-grid-cols nv-sc nv-sc-has-gap nv-sc-dense"'));
    assert.match(html, /<div><div class="nv-grid nv-sc nv-sc-has-gap nv-sc-dense" style="--cols-default/);
    assert.match(html, /<div class="nv-grid lg:nv-grid-cols nv-sc" style="--cols-lg: repeat\(2/);
    const nested = await render([Section.make('Outer').schema([Section.make('Inner').schema([EmptyState.make('Nothing')])])]);
    assert.ok(nested.includes('<h2 id="form.outer::data::section-heading" class="nv-section-header-heading">Outer</h2>'));
    assert.ok(nested.includes('<h3 id="form.inner::data::section-heading" class="nv-section-header-heading">Inner</h3>'));
    assert.ok(nested.includes('<h4 class="nv-empty-state-heading">Nothing</h4>'));
    const modal = await render([Section.make('Details').schema([Text.make('a')])], host(), (schema) => schema.rootHeadingLevel(3));
    assert.ok(modal.includes('<h3 id="form.details::data::section-heading"'));
    const deep = await render([Section.make('Deep').schema([Text.make('a')])], host(), (schema) => schema.rootHeadingLevel(7));
    assert.ok(deep.includes('<p id="form.deep::data::section-heading" class="nv-section-header-heading">Deep</p>'));
});

test('Section: description, icon, aside, compact, secondary, footer, function heading', async () => {
    const html = withoutSvgBodies(await render([Section.make(({ operation }) => (operation === null ? 'Cart <b>' : 'x')).description('Items "selected"').icon('o-shopping-bag').iconColor('primary').aside().compact().secondary().schema([Text.make('a')])]));
    assert.ok(html.includes('<div id="form.cart-b::data::section" class="nv-sc-section"><section x-data="{'));
    assert.ok(html.includes('aria-labelledby="form.cart-b::data::section-heading" aria-describedby="form.cart-b::data::section-description" class="nv-section nv-section-has-header nv-aside nv-compact nv-secondary"><header class="nv-section-header"><svg class="nv-color nv-color-primary nv-icon nv-size-lg"'));
    assert.ok(html.includes('<div class="nv-section-header-text-ctn"><h2 id="form.cart-b::data::section-heading" class="nv-section-header-heading">Cart &lt;b&gt;</h2><p id="form.cart-b::data::section-description" class="nv-section-header-description">Items &quot;selected&quot;</p></div>'));
    // An aside section cannot be collapsed.
    const aside = await render([Section.make('A').aside().collapsible().schema([Text.make('a')])]);
    assert.ok(!aside.includes('nv-collapsible') && !aside.includes('nv-section-collapse-btn'));
    // Footer actions (aligned) or free-form footer; header actions; all exposed for mounting.
    const section = Section.make('Rate limiting').headerActions([Action.make('test').action(() => {})]).footerActions([Action.make('save').action(() => {})]).footerActionsAlignment('end').schema([Text.make('a')]);
    const footer = withoutSvgBodies(await render([section]));
    assert.match(footer, /<div class="nv-section-header-after-ctn"><div class="nv-sc nv-inline nv-align-end nv-sc-has-gap nv-sc-dense"><div class="nv-sc-action"><button [^>]*wire:click="mountAction\('test'/);
    assert.match(footer, /<footer class="nv-section-footer"><div class="nv-sc nv-inline nv-align-end nv-sc-has-gap nv-sc-dense"><div class="nv-sc-action"><button [^>]*wire:click="mountAction\('save'/);
    assert.deepEqual(section.getActions().map((action: any) => action.getName()), ['test', 'save']);
    const custom = await render([Section.make('Notes').afterHeader([Text.make('Draft').badge()]).footer([Text.make('Saved 5 minutes ago')]).contained(false).schema([Text.make('a')])]);
    assert.ok(custom.includes('class="nv-section nv-section-not-contained nv-section-has-header">'));
    assert.match(custom, /<div class="nv-section-header-after-ctn"><div class="nv-sc nv-inline nv-align-end nv-sc-has-gap nv-sc-dense"><div x-data="[^"]+"><div class="nv-sc-component"><span class="nv-sc-text nv-badge nv-size-md[^"]*">/);
    assert.match(custom, /<footer class="nv-section-footer"><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense"><div x-data="[^"]+"><div class="nv-sc-component"><span class="nv-sc-text">Saved 5 minutes ago<\/span>/);
    // Extra attributes on the outer element.
    const extra = await render([Section.make().extraAttributes({ class: 'my-section', 'data-x': 'y' }).schema([Text.make('a')])]);
    assert.ok(extra.includes('<div class="my-section nv-sc-section" data-x="y"><section'));
});

test('Section: collapsed state persisted in local storage', async () => {
    const html = await render([Section.make('Cart').collapsed().persistCollapsed().schema([Text.make('a')])]);
    assert.ok(html.includes("isCollapsed: $persist(true).as(`navette:section:collapsed:${'form.cart::data::section' ?? $el.id}`),"));
    assert.ok(!html.includes('x-on:reset-schema-component-state.window="if'));
    assert.ok(html.includes('<div id="form.cart::data::section-content" x-cloak class="nv-section-content-ctn">'));
    const keyed = await render([Section.make('Cart').key('order-cart').collapsible().persistCollapsed().schema([Text.make('a')])]);
    assert.ok(keyed.includes("$persist(false).as(`navette:section:collapsed:${'form.order-cart' ?? $el.id}`)"));
});

test('Tabs: active tab, badges, icon position, vertical, not contained', async () => {
    const tabs = Tabs.make('Settings').activeTab(2).vertical().contained(false).extraAttributes({ 'data-x': 'y' }).schema([
        Tab.make('General').icon('m-cog').iconPosition('after').schema([Text.make('a')]),
        Tab.make('Notifications').badge(5).badgeColor('success').badgeTooltip('Unread "items"').schema([Text.make('b')]),
        Tab.make('Hidden').hidden().badge(1).schema([Text.make('c')]),
    ]);
    const html = withoutSvgBodies(await render([tabs]));
    assert.ok(html.includes('activeTab: 2,'));
    assert.ok(html.includes('isVertical: true,'));
    assert.ok(html.includes(`wire:ignore.self id="form.settings::data::tabs" wire:key="lw.form.settings::data::tabs.container" data-x="y" class="nv-sc-tabs nv-vertical"><div x-cloak="x-cloak" x-ref="tabsHeader" class="nv-tabs nv-vertical">`));
    assert.ok(html.includes(`x-bind:aria-orientation="hasVisibleTabHeaders ? 'vertical' : null" x-on:keydown="handleKeydown($event)" class="nv-sc-tabs-tablist">`));
    assert.match(html, /<span class="nv-tabs-item-label">General<\/span><svg class="nv-icon nv-size-md"[^>]*><\/svg><\/button>/);
    assert.match(html, /<span class="nv-tabs-item-label">Notifications<\/span><span x-tooltip="\{ content: 'Unread \\u0022items\\u0022', theme: \$store\.theme, allowHTML: false \}" class="nv-badge nv-size-sm nv-color nv-color-success [^"]+"><span class="nv-badge-label-ctn"><span class="nv-badge-label">5<\/span><\/span><\/span><\/button>/);
    assert.ok(!html.includes('Hidden'));
    // An invalid active tab falls back to the first one.
    assert.ok((await render([Tabs.make('T').activeTab(0).schema([Tab.make('A').schema([])])])).includes('activeTab: 1,'));
});

test('Tabs: persisted tab, query string (validated against the tabs), not scrollable', async () => {
    const make = () => Tabs.make('Settings').persistTab().persistTabInQueryString('settings-tab').scrollable(false).schema([
        Tab.make('General').schema([Text.make('a')]),
        Tab.make('Billing').badge('New').schema([Text.make('b')]),
    ]);
    const html = withoutSvgBodies(await render([make()], host({ _ctx: { req: { query: { 'settings-tab': 'billing::data::tab' } } } })));
    assert.ok(html.includes("tab: $persist(null).as('navette:tabs:active:form.settings::data::tabs'),"));
    assert.ok(html.includes('isTabPersisted: true,') && html.includes('isTabPersistedInQueryString: true,'));
    assert.ok(html.includes("tabQueryStringKey: 'settings-tab',"));
    assert.ok(html.includes('activeTab: 2,'));
    assert.ok(html.includes(` x-on:resize.window="scheduleUpdate(true)" wire:ignore.self`));
    assert.ok(html.includes(`<div x-cloak="x-cloak" x-bind:class="{ 'nv-invisible': ! overflowReady }" x-ref="tabsHeader" class="nv-tabs nv-contained">`));
    assert.match(html, /<button type="button" tabindex="-1" aria-hidden="true" data-tabs-overflow-trigger="data-tabs-overflow-trigger" data-tab-trigger-key="billing::data::tab" aria-label="[^"]+: Billing" x-show="overflowReady &amp;&amp; overflowTabs\.includes\('billing::data::tab'\) &amp;&amp; isTabSelected\('billing::data::tab'\)" class="nv-tabs-item nv-active">/);
    assert.match(html, /<div data-tab-menu-key="general::data::tab" x-bind:aria-disabled="availableTabs\.includes\('general::data::tab'\) \? 'false' : 'true'" x-show="\(true\) &amp;&amp; overflowTabs\.includes\('general::data::tab'\)" class="nv-dropdown-list-item nv-sc-tabs-overflow-placeholder"><span class="nv-dropdown-list-item-label">General<\/span><\/div>/);
    // A query string naming no tab is ignored.
    const forged = await render([make()], host({ _ctx: { req: { query: { 'settings-tab': "x');alert(1)//" } } } }));
    assert.ok(forged.includes('activeTab: 1,') && !forged.includes('alert(1)'));
});

test('Callout controls and Text js()', async () => {
    const callout = Callout.make('Backup complete').success().controls([Text.make('2 min ago'), Action.make('dismiss').label('Dismiss').icon('m-x-mark').iconButton().color('gray').action(() => {})]);
    const html = withoutSvgBodies(await render([callout]));
    assert.match(html, /<div class="nv-callout-controls"><div class="nv-sc nv-inline nv-sc-has-gap nv-sc-dense"><div x-data="[^"]+"><div class="nv-sc-component"><span class="nv-sc-text">2 min ago<\/span><\/div><\/div><div class="nv-sc-action"><button title="Dismiss" aria-label="Dismiss"/);
    assert.deepEqual(callout.getActions().map((action: any) => action.getName()), ['dismiss']);
    const text = await render([Text.make("$get('name') ? `Hello, ${$get('name')}` : \"Please enter your name.\"").js()]);
    assert.ok(text.includes(`<span class="nv-sc-text"><span x-text="() => eval('$get(\\u0027name\\u0027) ? \`Hello, \${$get(\\u0027name\\u0027)}\` : \\u0022Please enter your name.\\u0022')"></span></span>`));
});
