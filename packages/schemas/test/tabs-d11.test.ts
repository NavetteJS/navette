import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, Tab, Tabs, Text, useColorManager } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
views.share({ assetUrl: (path: string) => `/${path}` });

const host = (extra: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data: {}, getSchema() { return null as any; }, getActionMountContext: () => ({}), ...extra });
const schemaOf = (components: any[], livewire: any = host()) => Schema.make(livewire).key('form').statePath('data').components(components);
const render = async (components: any[], livewire: any = host()) => (await schemaOf(components, livewire).toHtml()).replace(/>\s*\n\s*/g, '>').replace(/\s*\n\s*</g, '<').replace(/&#039;/g, "'");

test('Tabs: lazy-loaded badges are fetched after rendering, keyed by tab, and their label is never HTML', async () => {
    let queries = 0;
    const tabs = Tabs.make('Inbox').schema([
        Tab.make('All').badge(3).schema([Text.make('a')]),
        Tab.make('Unread').badge(() => { queries++; return '<b>7</b>'; }).badgeColor('danger').badgeIcon('m-bell').badgeTooltip('Unread messages').lazyLoadedBadge().schema([Text.make('b')]),
        Tab.make('Archived').badge(() => null).deferBadge().schema([Text.make('c')]),
    ]);
    const html = await render([tabs]);
    assert.equal(queries, 0, 'the badge of a lazy tab is not computed while rendering');
    assert.ok(html.includes('const badges = await this.$getLazyLoadedTabBadges()'));
    assert.ok(html.includes('class="nv-tabs-item-badge-placeholder"'));
    assert.ok(html.includes('x-text="deferredBadges[1]?.badge"'));
    assert.ok(html.includes('x-text="deferredBadges[2]?.badge"'));
    assert.ok(!html.includes('deferredBadges[0]'), 'a regular badge is rendered directly');
    assert.match(html, /<span class="nv-badge-label">3<\/span>/);
    assert.equal(await tabs.hasLazyLoadedBadges(), true);
    assert.ok(tabs.getExposedMethods().includes('getLazyLoadedTabBadges'));

    const badges = await tabs.getLazyLoadedTabBadges();
    assert.equal(queries, 1);
    assert.deepEqual(Object.keys(badges), ['1', '2']);
    assert.equal(badges['1'].badge, '<b>7</b>', 'the label is data, inserted with x-text');
    assert.match(badges['1'].badgeColorClasses, /^nv-color nv-color-danger/);
    assert.match(badges['1'].badgeIconHtml ?? '', /^<svg/);
    assert.equal(badges['1'].badgeIconPosition, 'before');
    assert.equal(badges['1'].badgeTooltip, 'Unread messages');
    assert.deepEqual(badges['2'], { badge: null, badgeColorClasses: '', badgeColorStyles: '', badgeIconHtml: null, badgeIconPosition: 'before', badgeTooltip: null });
    assert.deepEqual(await tabs.getDeferredTabBadges(), await tabs.getLazyLoadedTabBadges());

    // Without lazy badges, the header has no Alpine data of its own.
    const plain = await render([Tabs.make('Plain').schema([Tab.make('A').badge(1).schema([])])]);
    assert.ok(!plain.includes('deferredBadges'));
});

test('Tabs: lazy badges in the overflow dropdown, hidden tabs are skipped', async () => {
    const tabs = Tabs.make('Inbox').scrollable(false).schema([
        Tab.make('All').schema([]),
        Tab.make('Unread').badge(() => 2).lazyLoadedBadge().schema([]),
        Tab.make('Secret').hidden().badge(() => 9).lazyLoadedBadge().schema([]),
    ]);
    const html = await render([tabs]);
    assert.ok(html.includes('class="nv-dropdown-list-item-badge-placeholder"'));
    assert.ok(html.includes(`x-bind:class="'nv-badge ' + (deferredBadges[1]?.badgeColorClasses ?? '')"`));
    assert.deepEqual(Object.keys(await tabs.getLazyLoadedTabBadges()), ['1']);
});

test('Tabs: tabPanels(false) renders a group of pressed buttons without panels', async () => {
    const html = await render([Tabs.make('Filter').tabPanels(false).schema([Tab.make('All').schema([Text.make('content-a')]), Tab.make('Mine').schema([Text.make('content-b')])])]);
    assert.ok(html.includes('hasTabPanels: false,'));
    assert.ok(html.includes('<div x-ref="tablist" role="group" aria-label="Filter" x-on:keydown="handleKeydown($event)" class="nv-sc-tabs-tablist">'));
    assert.ok(html.includes(`tabindex="0" x-bind:tabindex="getTabIndex('all::data::tab')" data-tab-key="all::data::tab"`));
    assert.ok(html.includes(`x-bind:aria-pressed="isTabSelected('all::data::tab')"`));
    assert.ok(html.includes(`x-show="(true) &amp;&amp; ! overflowTabs.includes('all::data::tab')"`));
    assert.ok(!html.includes('role="tab"') && !html.includes('role="tabpanel"') && !html.includes('aria-controls'));
    assert.ok(!html.includes('nv-sc-tabs-header-overflow'));
    assert.ok(!html.includes('content-a'), 'no panel content');

    const overflow = await render([Tabs.make('Filter').tabPanels(false).scrollable(false).schema([Tab.make('All').schema([]), Tab.make('Mine').schema([])])]);
    assert.ok(overflow.includes('<div x-data="navetteDropdown" class="nv-dropdown"><div x-on:mousedown="if ($event.button === 0) { toggle($event) }" class="nv-dropdown-trigger">'));
    assert.ok(overflow.includes(`<button role="menuitem" type="button" data-tab-menu-key="mine::data::tab" x-bind:aria-disabled="availableTabs.includes('mine::data::tab') ? 'false' : 'true'" x-on:click="if ($el.getAttribute('aria-disabled') !== 'true') selectTab('mine::data::tab', $event, true)"`));
    assert.ok(overflow.includes(`x-cloak x-float.placement.bottom-start.flip.offset="{ offset: 8 }" x-ref="panel"`));
    assert.ok(!overflow.includes('x-ref="overflowPanel"'));
    assert.ok(!overflow.includes('x-on:resize.window'));
    assert.ok(!overflow.includes('x-on:wheel'));
    assert.equal(await Tabs.make('X').hasTabPanels(), true);
});

test('Tabs: livewireProperty() binds the active tab to a property of the host, only the active tab is rendered', async () => {
    const livewire = host({ activeStatus: 'published' });
    const make = () => Tabs.make('Status').livewireProperty('activeStatus').schema({
        all: Tab.make('All').schema([Text.make('every-post')]),
        published: Tab.make('Published').badge(() => 4).lazyLoadedBadge().schema([Text.make('published-posts')]),
        "it's": Tab.make('Quoted').schema([]),
    });
    const tabs = make();
    const html = await render([tabs], livewire);
    assert.ok(html.includes("livewireProperty: 'activeStatus',"));
    assert.ok(html.includes("tab: 'published',"));
    assert.ok(html.includes('activeTab: 2,'));
    assert.ok(html.includes('isScrollable: true,'));
    assert.ok(html.includes('<input type="hidden" x-ref="tabsData" data-active-tab="published" />'));
    assert.ok(html.includes('data-prevent-disabled-clicks wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" wire:target="activeStatus" class="nv-sc-tabs-tablist"'));
    assert.ok(html.includes(`role="tab" aria-controls="form.published" aria-selected="true" x-bind:aria-selected="isTabSelected('published')" tabindex="0"`));
    assert.ok(html.includes(`aria-selected="false" x-bind:aria-selected="isTabSelected('all')" tabindex="-1"`));
    assert.ok(html.includes(`wire:click="$set('activeStatus', 'published')" class="nv-tabs-item nv-active"`));
    assert.ok(html.includes(`x-on:click.capture="if (! selectTab('published', $event)) { $event.preventDefault(); $event.stopImmediatePropagation() }"`));
    // A key with a quote is escaped in the JavaScript.
    assert.ok(html.includes(`wire:click="$set('activeStatus', 'it\\u0027s')"`));
    assert.ok(html.includes('published-posts'));
    assert.ok(!html.includes('every-post'), 'inactive tabs are not rendered');
    assert.ok(html.includes(`x-text="deferredBadges['published']?.badge"`));
    assert.deepEqual(Object.keys(await tabs.getLazyLoadedTabBadges()), ['published']);
    assert.equal(make().getLivewireProperty(), 'activeStatus');

    const pressed = await render([make().tabPanels(false)], livewire);
    assert.ok(pressed.includes(`aria-pressed="true" x-bind:aria-pressed="isTabSelected('published')" tabindex="0"`));
    assert.ok(pressed.includes('role="group"'));
    assert.ok(!pressed.includes('role="tabpanel"') && !pressed.includes('published-posts'));

    // An unknown value activates no tab; the default active tab is announced.
    const none = await render([make()], host({ activeStatus: null }));
    assert.ok(none.includes("tab: '',") && none.includes('activeTab: 1,'));
    assert.ok(!none.includes('nv-tabs-item nv-active'));
});

test('Tabs: a livewireProperty() name must be an identifier', () => {
    for (const name of ["x'); alert(1); ('", 'a.b', '', '1abc', 'a b']) assert.throws(() => Tabs.make('T').livewireProperty(name), /Invalid Livewire property name/);
    assert.equal(Tabs.make('T').livewireProperty('activeTab').livewireProperty(null).getLivewireProperty(), null);
});

test('Components liberated from the container grid get a display-contents scope wrapper', async () => {
    const html = await render([Text.make('free').key('free').liberatedFromContainerGrid(), Text.make('boxed')]);
    assert.match(html, /<div class="nv-sc-liberated" wire:key="lw\.form\.free" x-data="navetteSchemaComponent\([^"]*\)">/);
    assert.equal(Text.make('x').isLiberatedFromContainerGrid(), false);
    assert.ok(html.includes('nv-grid-col'), 'other components keep their grid column');
});
