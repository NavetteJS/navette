import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChartWidget, Dashboard, Panel, Stat, StatsOverviewWidget, Widget } from '../src/index.ts';

class First extends StatsOverviewWidget {
    static sort = 2;
    static columnSpan = { md: 2, xl: 'full' as const };
    protected getHeading() { return 'Sales <today>'; }
    protected getDescription() { return 'Last 24 hours'; }
    getStats() { return [Stat.make('Orders', '12')]; }
}
class Second extends ChartWidget {
    static sort = 1;
    getType() { return 'line' as const; }
    getData() { return {}; }
    protected getEmptyStateHeading() { return 'Nothing yet'; }
    protected getEmptyStateDescription() { return 'Come back tomorrow'; }
}
class Unsorted extends StatsOverviewWidget { getStats() { return []; } }

const panel = Panel.make().id('widgets-test').key('k').pages([Dashboard]).widgets([Unsorted, First, Second]);
const mount = <T extends Widget>(Class: new () => T): T => { const widget = new Class(); (widget as any)._ctx = { panel }; (widget as any)._id = 'w1'; return widget; };

test('dashboard widgets are ordered by sort, unsorted last', () => {
    const dashboard = Object.create(Dashboard.prototype) as Dashboard;
    (dashboard as any)._ctx = { panel };
    assert.deepEqual(dashboard.getWidgets().map((widget) => widget.name), ['Second', 'First', 'Unsorted']);
});

test('stats heading and description are escaped; spans per breakpoint', async () => {
    const html = await mount(First).render();
    assert.match(html, /<h3 class="nv-section-header-heading">Sales &lt;today&gt;<\/h3><p class="nv-section-header-description">Last 24 hours<\/p>/);
    assert.match(html, /md:nv-grid-col-span xl:nv-grid-col-span/);
    assert.match(html, /--col-span-md: span 2 \/ span 2; --col-span-xl: 1 \/ -1;/);
});

test('chart empty state can be customized', async () => {
    const html = await mount(Second).render();
    assert.match(html, /Nothing yet<\/h2><p class="nv-empty-state-description">Come back tomorrow<\/p>/);
});
