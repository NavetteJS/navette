// Dashboard filters (URL, session, filters action), stat attributes and placeholders, chart filter forms,
// empty state actions and raw JavaScript options.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Action } from '@navette-js/actions';
import { DatePicker, RawJs, Select, TextInput } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { resetConfigurators } from '@navette-js/support';
import { ChartWidget, Dashboard, FilterAction, Notification, PAGE_FILTERS, Panel, Stat, StatsOverviewWidget, type ChartData, type SessionStore, type User } from '../src/index.ts';
import { normalizeFilterValuesFromQueryString, readQueryStringProperty, sanitizeFilterState } from '../src/dashboard-filters.ts';
import { actingAs, livewire, setCurrentPanel } from '../src/testing.ts';

/** Session store shared by every test browser, so that a second `livewire()` call sees what the first one saved. */
class SharedStore implements SessionStore {
    values = new Map<string, unknown>();
    get(_session: string, key: string) { return this.values.get(key); }
    set(_session: string, key: string, value: unknown) { this.values.set(key, JSON.parse(JSON.stringify(value))); }
}

class FilteredStats extends StatsOverviewWidget {
    static isLazy = false;
    static reactive = PAGE_FILTERS;
    pageFilters: Record<string, unknown> | null = null;
    getStats() { return [Stat.make('Status', String(this.pageFilters?.status ?? 'none'))]; }
}
class ShopDashboard extends Dashboard {
    static slug = 'shop';
    filtersFormSchema(schema: Schema): Schema {
        return schema.components([DatePicker.make('startDate'), Select.make('status').options({ new: 'New', shipped: 'Shipped' }).default('new')]);
    }
    getWidgets() { return [FilteredStats]; }
}
class NotPersisted extends ShopDashboard {
    static slug = 'not-persisted';
    static persistsFiltersInSession = false;
}
class ModalDashboard extends Dashboard {
    static slug = 'modal';
    getHeaderActions() {
        return [FilterAction.make().schema([DatePicker.make('startDate').required(), Select.make('status').options({ new: 'New', shipped: 'Shipped' })])];
    }
    getWidgets() { return [FilteredStats]; }
}

class SalesChart extends ChartWidget {
    static isLazy = false;
    getType() { return 'bar'; }
    filtersFormSchema(schema: Schema): Schema { return schema.components([TextInput.make('region').default('north')]); }
    getData(): ChartData { return { datasets: [{ label: `Sales ${String(this.filters?.region ?? '')}`, data: [1, 2] }], labels: ['a', 'b'] }; }
}
class DeferredChart extends SalesChart {
    static hasDeferredFilters = true;
    filtersApplyAction(action: Action) { return action.label('Update chart'); }
}
class EmptyChart extends ChartWidget {
    static isLazy = false;
    getType() { return 'line'; }
    getEmptyStateActions() {
        return [
            Action.make('refresh').label('Refresh').action(() => { Notification.make().title('Refreshed').send(); }),
            Action.make('confirmReset').label('Reset data').requiresConfirmation().action(() => { Notification.make().title('Reset done').send(); }),
            Action.make('docs').label('Docs').url('/docs'),
        ];
    }
}
class CustomEmptyChart extends ChartWidget {
    static isLazy = false;
    getType() { return 'line'; }
    getEmptyState() { return '<p class="custom-empty">Nothing here</p>'; }
}
class NotEmptyChart extends ChartWidget {
    static isLazy = false;
    getType() { return 'line'; }
    getData(): ChartData { return { datasets: [{ data: [] }] }; }
    isEmpty() { return true; }
}
class CallbackChart extends ChartWidget {
    static isLazy = false;
    getType() { return 'line'; }
    getData(): ChartData { return { datasets: [{ data: [1] }], labels: ['x'] }; }
    getOptions() { return RawJs.make('{ scales: { y: { ticks: { callback: (value) => "€" + value } } } }'); }
}

class LazyStats extends StatsOverviewWidget {
    static isLazy = true;
    placeholder(): string { const column = this.gridColumn(); return `<div class="custom-placeholder ${column.classes.join(' ')}" style="${column.style}">Loading</div>`; }
    getStats() { return [Stat.make('Lazy', 1)]; }
}
class LazyDashboard extends Dashboard {
    static slug = 'lazy';
    getWidgets() { return [LazyStats]; }
}

const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const store = new SharedStore();
const panel = Panel.make().id('widget-features').key('widget-key').auth({ find: async () => user } as any).sessionStore(store)
    .pages([ShopDashboard, NotPersisted, ModalDashboard, LazyDashboard])
    .widgets([LazyStats, FilteredStats, SalesChart, DeferredChart, EmptyChart, CustomEmptyChart, NotEmptyChart, CallbackChart]);
setCurrentPanel(panel);
actingAs(user);
after(() => resetConfigurators());

test('query string filters: Livewire brackets, nested objects, sanitized values', () => {
    assert.deepEqual(readQueryStringProperty({ 'filters[startDate]': '2026-01-01', 'filters[statuses][0]': 'new', 'filters[statuses][1]': 'shipped', other: 'x' }, 'filters'), { startDate: '2026-01-01', statuses: ['new', 'shipped'] });
    assert.deepEqual(readQueryStringProperty({ filters: { startDate: '2026-01-01' } }, 'filters'), { startDate: '2026-01-01' });
    assert.equal(readQueryStringProperty({ other: '1' }, 'filters'), null);
    // Prototype keys, deep paths and malformed brackets are dropped.
    assert.deepEqual(readQueryStringProperty({ 'filters[__proto__][polluted]': '1', 'filters[a][b][c][d][e]': 'deep', 'filters[x]]': '1', 'filters[ok]': 'yes' }, 'filters'), { ok: 'yes' });
    assert.equal(({} as any).polluted, undefined);
    assert.deepEqual(normalizeFilterValuesFromQueryString({ a: 'null', b: 'true', c: ['false', 'x'] }), { a: null, b: true, c: [false, 'x'] });
    assert.deepEqual(sanitizeFilterState({ n: Infinity, f: () => 1, s: 'x'.repeat(2000), constructor: 'no' }), { n: null, s: 'x'.repeat(1000) });
});

test('dashboard filters come from the URL, are kept in the URL, and reach the widgets', async () => {
    const page = livewire(ShopDashboard, {}, { query: { 'filters[startDate]': '2026-01-01', 'filters[status]': 'shipped', 'filters[injected]': 'x' } });
    await page.assertOk().assertSet('filters.startDate', '2026-01-01').assertSet('filters.status', 'shipped').assertSeeText('shipped');
    // Only the fields of the form are restored.
    assert.equal((page.get('filters') as any).injected, undefined);
    assert.deepEqual(page.getEffects().url, { filters: { as: 'filters', use: 'replace', alwaysShow: false, except: null } });
});

test('dashboard filters are persisted in the session, unless turned off', async () => {
    store.values.clear();
    await livewire(ShopDashboard).assertSet('filters.status', 'new').set('filters.status', 'shipped').assertSet('filters.status', 'shipped');
    // A later visit (no query string) restores them; a field without a restored value is empty, not its default.
    store.values.set([...store.values.keys()][0], { status: 'shipped' });
    await livewire(ShopDashboard).assertSet('filters.status', 'shipped').assertSet('filters.startDate', null);
    // The URL wins over the session.
    await livewire(ShopDashboard, {}, { query: { 'filters[status]': 'new' } }).assertSet('filters.status', 'new');
    // A forged session value is sanitized like a query string.
    store.values.set([...store.values.keys()][0], { status: { deep: { deeper: { deepest: { gone: 1 } } } } });
    await livewire(ShopDashboard).assertOk();
    // Without persistence, nothing is stored or restored.
    store.values.clear();
    await livewire(NotPersisted).set('filters.status', 'shipped');
    assert.equal(store.values.size, 0);
    await livewire(NotPersisted).assertSet('filters.status', 'new');
});

test('filters action: a modal filled with the current filters, validated, applied on submit', async () => {
    store.values.clear();
    const page = livewire(ModalDashboard);
    await page.assertOk().assertSet('filters', null).assertSeeText('none').assertActionExists('filter').assertActionHasLabel('filter', 'Filter');
    await page.callAction('filter', { status: 'shipped' }).assertHasFormErrors(['startDate']);
    await page.call('unmountAction');
    await page.callAction('filter', { startDate: '2026-02-01', status: 'shipped' }).assertHasNoFormErrors().assertSet('filters.startDate', '2026-02-01').assertSet('filters.status', 'shipped');
    // The widgets receive the applied filters (the browser re-renders them with the new props).
    assert.deepEqual(page.instance().getWidgetData(), { pageFilters: { startDate: '2026-02-01', status: 'shipped' } });
    // Kept in the session too.
    await livewire(ModalDashboard).assertSet('filters.status', 'shipped');
    // The action opens with the applied filters.
    await page.mountAction('filter').assertSchemaStateSet({ startDate: '2026-02-01', status: 'shipped' }, 'mountedActionSchema0');
});

test('stats: extra attributes and placeholders', () => {
    const stat = Stat.make('Processed', null).placeholder('<none>').url('/orders')
        .extraAttributes({ class: 'cursor-pointer', 'wire:click': "$dispatch('setStatusFilter', { filter: \"processed\" })", 'bad name': 'x', 'on"click': 'x', href: '/evil' })
        .extraAttributes({ 'data-stat': 'processed' }, true);
    const html = stat.toHtml(panel, 'k');
    assert.match(html, /^<a href="\/orders" class="nv-wi-stats-overview-stat cursor-pointer" wire:click="\$dispatch\(&#0?39;setStatusFilter&#0?39;, \{ filter: &quot;processed&quot; \}\)" data-stat="processed">/);
    assert.doesNotMatch(html, /bad name|on"click|\/evil/);
    assert.match(html, /<div class="nv-wi-stats-overview-stat-placeholder">&lt;none&gt;<\/div>/);
    // 0 is not blank; whitespace is.
    assert.match(Stat.make('Zero', 0).placeholder('-').toHtml(panel, 'k'), /stat-value">0</);
    assert.match(Stat.make('Blank', '  ').placeholder('-').toHtml(panel, 'k'), /stat-placeholder">-</);
    // Replacing the attributes drops the previous ones.
    assert.doesNotMatch(Stat.make('A', 1).extraAttributes({ id: 'a' }).extraAttributes({ title: 'b' }).toHtml(panel, 'k'), /id="a"/);
    // A default placeholder for every stat; a stat may still set its own.
    Stat.configureUsing((component) => component.placeholder('n/a'));
    assert.match(Stat.make('Default', null).toHtml(panel, 'k'), /stat-placeholder">n\/a</);
    assert.match(Stat.make('Own', null).placeholder('?').toHtml(panel, 'k'), /stat-placeholder">\?</);
    resetConfigurators();
});

test('chart filters form: live filters in a dropdown of the header', async () => {
    const chart = livewire(SalesChart);
    await chart.assertOk().assertSet('filters.region', 'north').assertSee(['nv-dropdown nv-wi-chart-filter', 'nv-wi-chart-filter-content', 'Sales north'])
        .assertDontSee('nv-wi-chart-filter-content-actions-ctn');
    await chart.set('filters.region', 'south').assertDispatched('updateChartData', (_name, params) => params.data.datasets[0].label === 'Sales south');
});

test('chart deferred filters: applied by the Apply button, reset to the defaults', async () => {
    const chart = livewire(DeferredChart);
    await chart.assertSet('filters.region', 'north').assertSet('deferredFilters.region', 'north').assertSee(['nv-wi-chart-filter-content-actions-ctn', 'Update chart', 'Reset']);
    await chart.set('deferredFilters.region', 'east').assertSet('filters.region', 'north');
    await chart.call('applyFilters').assertSet('filters.region', 'east').assertDispatched('updateChartData', (_name, params) => params.data.datasets[0].label === 'Sales east');
    await chart.call('resetFilters').assertSet('filters.region', 'north').assertSet('deferredFilters.region', 'north');
    // Without a filters form, the methods do nothing.
    await livewire(EmptyChart).call('applyFilters').assertSet('filters', null);
});

test('chart empty state: actions (with or without a modal), custom view, isEmpty()', async () => {
    const chart = livewire(EmptyChart);
    await chart.assertOk().assertSee(['nv-empty-state-footer', 'nv-ac nv-align-center', 'Refresh', 'Reset data', 'href="/docs"', 'wire:partial="action-modals"']);
    await chart.callAction('refresh').assertNotified('Refreshed');
    await chart.mountAction('confirmReset').assertActionMounted('confirmReset').callMountedAction().assertNotified('Reset done').assertActionNotMounted();
    // Only the declared actions can be mounted; a link is not mountable.
    await chart.call('mountAction', 'deleteEverything').assertNotFound();
    await chart.call('mountAction', 'docs').assertNotFound();
    await livewire(CustomEmptyChart).assertSee('<p class="custom-empty">Nothing here</p>').assertDontSee('nv-empty-state-heading');
    await livewire(NotEmptyChart).assertSee('nv-empty-state').assertDontSee('wire:partial="action-modals"');
});

test('chart options may be raw JavaScript', async () => {
    // Escaped in the attribute (assertSee decodes it): the browser reads the JavaScript as written.
    await livewire(CallbackChart).assertSee('options: { scales: { y: { ticks: { callback: (value) => "€" + value } } } }').assertDontSeeHtml('options: { scales: { y: { ticks: { callback: (value) => "');
});

test('a lazy widget may customize its loading placeholder', async () => {
    await livewire(LazyDashboard).assertOk().assertSee(['class="custom-placeholder nv-grid-col lg:nv-grid-col-span"', 'Loading', '__lazyLoad']);
    // Then it loads like any widget.
    await livewire(LazyStats).assertOk().assertSeeText('Lazy');
});
