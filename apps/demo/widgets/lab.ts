// `/lab/widgets`: a dashboard trying the widget features on the demo's orders — filters in a modal (kept in the URL and
// the session), clickable stats with placeholders, a chart with a deferred filters form and a Chart.js plugin, and an
// empty chart with actions.
import { Action } from '@navette-js/actions';
import { DatePicker, Select } from '@navette-js/forms';
import { ChartWidget, Dashboard, FilterAction, Notification, PAGE_FILTERS, Stat, StatsOverviewWidget, type ChartData } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { STATUSES } from '../resources/OrderResource.ts';
import { knex } from './dates.ts';

type Filters = Record<string, unknown> | null;
const STATUS_OPTIONS = Object.fromEntries(Object.entries(STATUSES).map(([value, status]) => [value, status.label]));
/** Filter values come from the browser: only a known status and a `Y-m-d` date are used. */
const statusOf = (value: unknown): string | null => (typeof value === 'string' && value in STATUSES ? value : null);
const dateOf = (value: unknown): string | null => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
function orders(filters: Filters) {
    const query = knex()('orders').whereNull('deleted_at');
    const status = statusOf(filters?.status), startDate = dateOf(filters?.startDate);
    if (status) query.where('status', status);
    if (startDate) query.where('created_at', '>=', `${startDate} 00:00:00`);
    return query;
}
const count = async (query: any): Promise<number> => Number(((await query.count({ n: '*' }).first()) as any)?.n ?? 0);

export class LabOrderStats extends StatsOverviewWidget {
    static isLazy = false;
    static pollingInterval = null;
    static reactive = PAGE_FILTERS;
    pageFilters: Filters = null;
    async getStats(): Promise<Stat[]> {
        const status = statusOf(this.pageFilters?.status);
        return [
            Stat.make('Orders', await count(orders(this.pageFilters))).description(status ? `Status: ${STATUSES[status].label}` : 'All statuses'),
            // A click filters the dashboard: the stat dispatches an event the dashboard listens to.
            Stat.make('Shipped orders', await count(orders({ ...this.pageFilters, status: 'shipped' }))).color('success').icon('o-truck')
                .extraAttributes({ class: 'nv-lab-clickable-stat', 'data-status': 'shipped', 'wire:click': "$dispatch('setStatusFilter', { status: 'shipped' })" }),
            // No value yet: the placeholder is shown instead.
            Stat.make('Refunded', null).placeholder('Not tracked'),
        ];
    }
}

export class LabOrdersChart extends ChartWidget {
    static isLazy = false;
    static pollingInterval = null;
    static heading = 'Orders per status';
    static hasDeferredFilters = true;
    static reactive = PAGE_FILTERS;
    pageFilters: Filters = null;
    getType() { return 'bar'; }
    filtersFormSchema(schema: Schema): Schema {
        return schema.components([
            Select.make('status').label('Status').options(STATUS_OPTIONS).placeholder('All statuses'),
            DatePicker.make('startDate').label('Created after'),
        ]);
    }
    filtersApplyAction(action: Action): Action { return action.label('Update chart'); }
    async getData(): Promise<ChartData> {
        // The chart's own filters, then the dashboard's.
        const rows: any[] = await orders({ ...this.pageFilters, ...Object.fromEntries(Object.entries(this.filters ?? {}).filter(([, value]) => value !== null && value !== '')) })
            .groupBy('status').select('status').count({ n: '*' });
        const counts = new Map(rows.map((row) => [row.status, Number(row.n)]));
        const statuses = Object.keys(STATUSES).filter((status) => counts.has(status));
        return { datasets: [{ label: 'Orders', data: statuses.map((status) => counts.get(status)!) }], labels: statuses.map((status) => STATUSES[status].label) };
    }
}

export class LabReturnsChart extends ChartWidget {
    static isLazy = false;
    static pollingInterval = null;
    static heading = 'Returns';
    getType() { return 'line'; }
    getData(): ChartData { return {}; }
    protected getEmptyStateHeading(): string { return 'No returns yet'; }
    protected getEmptyStateDescription(): string | null { return 'Returns appear here once customers send items back.'; }
    getEmptyStateActions() {
        return [
            Action.make('importReturns').label('Import returns').icon('m-arrow-up-tray').requiresConfirmation().modalDescription('Returns are read from the carrier.')
                .action(() => { Notification.make().info().title('No returns to import').send(); }),
            Action.make('refreshReturns').label('Refresh').color('gray').action(() => { Notification.make().success().title('Returns refreshed').send(); }),
        ];
    }
}

/** Filters in a slide-over (header button), applied to every widget, kept in the URL and in the session. */
export class LabWidgetsDashboard extends Dashboard {
    static slug = 'widgets';
    static title = 'Widgets lab';
    static navigationIcon = 'o-chart-bar';
    static navigationGroup = 'Widgets';
    static listeners = { setStatusFilter: 'applyStatusFilter' };
    getHeaderActions() {
        return [FilterAction.make().schema([Select.make('status').label('Status').options(STATUS_OPTIONS), DatePicker.make('startDate').label('Created after').maxDate('today')])];
    }
    /** Click on a stat: the status comes from the browser, so it must be a known one. */
    applyStatusFilter(status: unknown): void {
        if (statusOf(status)) this.filters = { ...(this.filters ?? {}), status };
    }
    getWidgets() { return [LabOrderStats, LabOrdersChart, LabReturnsChart]; }
}

export const labWidgets = [LabOrderStats, LabOrdersChart, LabReturnsChart];
