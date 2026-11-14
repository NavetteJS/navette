// `/lab/js-widgets`: a JavaScript widget (Filament's `HasJsRenderer`) on the demo's orders. Its renderer module is registered
// as an asset loaded on request, it receives the dashboard filters through its configuration, updates in place when they
// change, and calls a server method through `$wire`.
import { fileURLToPath } from 'node:url';
import { Radio } from '@navette-js/forms';
import { Dashboard, Js, JsWidget, NavetteAsset, PAGE_FILTERS } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { STATUSES } from '../resources/OrderResource.ts';
import { knex } from './dates.ts';

NavetteAsset.register([
    Js.make('orders-overview', fileURLToPath(new URL('../public/js/lab-d11-js-widget.js', import.meta.url))).loadedOnRequest(),
], 'navette/lab');

/** The filter comes from the browser: only a known status is used. */
const statusOf = (value: unknown): string | null => (typeof value === 'string' && Object.hasOwn(STATUSES, value) ? value : null);

export class LabOrdersJsWidget extends JsWidget {
    static isLazy = false;
    static columnSpan = 'full' as const;
    static reactive = PAGE_FILTERS;
    static callable = ['refreshOrders'];
    pageFilters: Record<string, unknown> | null = null;
    refreshes = 0;
    getRenderer() { return NavetteAsset.getScriptSrc('orders-overview', 'navette/lab'); }
    async getRendererConfiguration() {
        const status = statusOf(this.pageFilters?.status);
        const query = knex()('orders').whereNull('deleted_at');
        if (status) query.where('status', status);
        const row: any = await query.count({ n: '*' }).first();
        return {
            // Text set with `textContent` by the renderer: markup stays text.
            heading: 'Orders <overview>',
            status: status ? STATUSES[status].label : 'All statuses',
            orders: Number(row?.n ?? 0),
            refreshes: this.refreshes,
        };
    }
    refreshOrders(): void { this.refreshes++; }
}

export class LabJsWidgetsDashboard extends Dashboard {
    static slug = 'js-widgets';
    static title = 'JavaScript widgets';
    static navigationIcon = 'o-code-bracket';
    static navigationGroup = 'Widgets';
    static persistsFiltersInSession = false;
    filtersFormSchema(schema: Schema): Schema {
        return schema.components([
            Radio.make('status').label('Status').inline().options({ '': 'All', ...Object.fromEntries(Object.entries(STATUSES).map(([value, status]) => [value, status.label])) }).default(''),
        ]);
    }
    getWidgets() { return [LabOrdersJsWidget]; }
}

export const labJsWidgets = [LabOrdersJsWidget];
