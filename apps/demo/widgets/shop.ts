// Widgets du tableau de bord Shop — port de App\Filament\Widgets\{ShopKpisStats, OrdersYearOverYearChart, CustomerGrowthChart,
// TopProductsByRevenueChart, CustomerSegmentsChart, OrderValueDistributionChart, ProductMarginAnalysisChart}.
// Tous reçoivent les filtres de la page (`pageFilters`) : période, statuts de commande, catégorie de produit.
import { ChartWidget, PAGE_FILTERS, Stat, StatsOverviewWidget, TableWidget, type ChartData } from '@navette-js/panels';
import { ObjectionAdapter } from '@navette-js/database';
import { TextColumn, type Table } from '@navette-js/tables';
import { Order, STATUSES } from '../resources/OrderResource.ts';
import { addMonths, diffInDays, endOfMonth, knex, lastMonths, monthKey, monthLabel, now, parse, round, sql, startOfMonth, subDays, subMonths, truncate, usd } from './dates.ts';

type Filters = Record<string, unknown> | null;
const filled = (value: unknown) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
/** Filtres de la page, mis en forme : dates en `Y-m-d H:i:s` (minuit), statuts en liste, catégorie en identifiant. */
function read(filters: Filters) {
    const date = (value: unknown) => (filled(value) ? parse(String(value)) : null);
    const statuses = filters?.orderStatuses;
    return {
        startDate: date(filters?.startDate), endDate: date(filters?.endDate),
        orderStatuses: Array.isArray(statuses) && statuses.length ? statuses.map(String) : null,
        productCategory: filled(filters?.productCategory) ? String(filters!.productCategory) : null,
    };
}
/** Commandes non supprimées, restreintes à une période et à des statuts (colonnes éventuellement préfixées). */
function ordersBetween(start: Date | null, end: Date | null, statuses: string[] | null, table = 'orders') {
    const query = knex()(table).whereNull(`${table}.deleted_at`);
    if (start) query.where(`${table}.created_at`, '>=', sql(start));
    if (end) query.where(`${table}.created_at`, '<=', sql(end));
    if (statuses) query.whereIn(`${table}.status`, statuses);
    return query;
}
const count = async (query: any): Promise<number> => Number(((await query.count({ n: '*' }).first()) as any)?.n ?? 0);
const month = (value: unknown) => String(value ?? '').slice(0, 7);

export class ShopKpisStats extends StatsOverviewWidget {
    static pollingInterval = null;
    static reactive = PAGE_FILTERS;
    pageFilters: Filters = null;
    async getStats(): Promise<Stat[]> {
        const { startDate, orderStatuses, ...filters } = read(this.pageFilters);
        const endDate = filters.endDate ?? now();
        const orders: any[] = await ordersBetween(startDate, endDate, orderStatuses).select('id', 'total_price', 'status');
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_price), 0);
        const cancelledOrders = orders.filter((order) => order.status === 'cancelled').length;
        const itemsOf = async (ids: number[]): Promise<number> => {
            let total = 0;
            // Par tranches : SQLite limite le nombre de paramètres d'une requête.
            for (let i = 0; i < ids.length; i += 500) total += await count(knex()('order_items').whereIn('order_id', ids.slice(i, i + 500)));
            return total;
        };
        const totalItems = await itemsOf(orders.map((order) => order.id));
        const customersBetween = () => {
            const query = knex()('customers').whereNull('customers.deleted_at');
            if (startDate) query.where('customers.created_at', '>=', sql(startDate));
            query.where('customers.created_at', '<=', sql(endDate));
            return query;
        };
        // `has('orders', '>=', 2)` : au moins deux commandes non supprimées, sans condition de période.
        const ordersOfCustomer = '(select count(*) from orders where orders.customer_id = customers.id and orders.deleted_at is null)';
        const totalCustomers = await count(customersBetween());
        const repeatCustomers = await count(customersBetween().whereRaw(`${ordersOfCustomer} >= 2`));
        const repeatRate = totalCustomers > 0 ? round((repeatCustomers / totalCustomers) * 100, 1) : 0;
        const avgItemsPerOrder = totalOrders > 0 ? round(totalItems / totalOrders, 1) : 0;
        const cancellationRate = totalOrders > 0 ? round((cancelledOrders / totalOrders) * 100, 1) : 0;
        const revenuePerCustomer = totalCustomers > 0 ? round(totalRevenue / totalCustomers, 2) : 0;

        // Courbes : les sept derniers mois, sans tenir compte de la période choisie (comme la démo).
        const months = lastMonths(7);
        const monthlyOrders: any[] = await ordersBetween(months[0], null, orderStatuses).select('id', 'total_price', 'status', 'created_at');
        const monthlyCustomers: any[] = await knex()('customers').whereNull('deleted_at').where('created_at', '>=', sql(months[0])).select('created_at', knex().raw(`${ordersOfCustomer} as orders_count`));
        const repeatChart: number[] = [], avgItemsChart: number[] = [], cancellationChart: number[] = [], revenueChart: number[] = [];
        for (const start of months) {
            const key = monthKey(start);
            const monthOrders = monthlyOrders.filter((order) => month(order.created_at) === key);
            const monthRevenue = monthOrders.reduce((sum, order) => sum + Number(order.total_price), 0);
            const monthCustomers = monthlyCustomers.filter((customer) => month(customer.created_at) === key);
            const monthRepeat = monthCustomers.filter((customer) => Number(customer.orders_count) >= 2).length;
            repeatChart.push(monthCustomers.length > 0 ? round((monthRepeat / monthCustomers.length) * 100, 1) : 0);
            const monthItems = monthOrders.length ? await itemsOf(monthOrders.map((order) => order.id)) : 0;
            avgItemsChart.push(monthOrders.length > 0 ? round(monthItems / monthOrders.length, 1) : 0);
            const monthCancelled = monthOrders.filter((order) => order.status === 'cancelled').length;
            cancellationChart.push(monthOrders.length > 0 ? round((monthCancelled / monthOrders.length) * 100, 1) : 0);
            revenueChart.push(monthCustomers.length > 0 ? round(monthRevenue / monthCustomers.length, 2) : 0);
        }
        return [
            Stat.make('Repeat Customer Rate', `${repeatRate}%`).description(`${repeatCustomers} of ${totalCustomers} customers`).descriptionIcon('m-arrow-path').chart(repeatChart).color('success'),
            Stat.make('Avg Items / Order', String(avgItemsPerOrder)).description(`${totalItems} items, ${totalOrders} orders`).descriptionIcon('m-shopping-cart').chart(avgItemsChart).color('info'),
            Stat.make('Cancellation Rate', `${cancellationRate}%`).description(`${cancelledOrders} cancelled orders`).descriptionIcon('m-x-circle').chart(cancellationChart).color(cancellationRate > 10 ? 'danger' : 'warning'),
            Stat.make('Revenue / Customer', usd(revenuePerCustomer)).description(`${usd(totalRevenue, 0)} total revenue`).descriptionIcon('m-currency-dollar').chart(revenueChart).color('success'),
        ];
    }
}

/** Graphique du tableau de bord Shop : pas de rafraîchissement périodique, filtres de la page. */
abstract class ShopChart extends ChartWidget {
    static pollingInterval = null;
    static reactive = PAGE_FILTERS;
    pageFilters: Filters = null;
}

export class OrdersYearOverYearChart extends ShopChart {
    static heading = 'Orders Year-over-Year';
    getType(): string { return 'line'; }
    async getData(): Promise<ChartData> {
        const { orderStatuses } = read(this.pageFilters);
        const recentMonths = lastMonths(12), priorMonths = lastMonths(12, 12);
        const byMonth = (rows: any[]) => { const counts = new Map<string, number>(); for (const row of rows) counts.set(month(row.created_at), (counts.get(month(row.created_at)) ?? 0) + 1); return counts; };
        const recent = byMonth(await ordersBetween(recentMonths[0], null, orderStatuses).select('created_at'));
        const prior = byMonth(await ordersBetween(priorMonths[0], null, orderStatuses).where('created_at', '<', sql(recentMonths[0])).select('created_at'));
        return {
            datasets: [
                { label: 'Last 12 Months', data: recentMonths.map((start) => recent.get(monthKey(start)) ?? 0), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: 'start' },
                { label: 'Prior 12 Months', data: priorMonths.map((start) => prior.get(monthKey(start)) ?? 0), borderColor: '#9ca3af', backgroundColor: 'rgba(156, 163, 175, 0.05)', borderDash: [5, 5] },
            ],
            labels: recentMonths.map(monthLabel),
        };
    }
}

export class CustomerGrowthChart extends ShopChart {
    static heading = 'Customer Growth';
    getType(): string { return 'line'; }
    async getData(): Promise<ChartData> {
        const filters = read(this.pageFilters);
        const startDate = filters.startDate ? startOfMonth(filters.startDate) : startOfMonth(subMonths(now(), 11));
        const endDate = filters.endDate ? endOfMonth(filters.endDate) : now();
        const months: Date[] = [];
        for (let cursor = startDate; cursor <= endDate; cursor = addMonths(cursor, 1)) months.push(cursor);
        const rows: any[] = await knex()('customers').whereNull('deleted_at').where('created_at', '>=', sql(startDate)).where('created_at', '<=', sql(endDate)).select('created_at');
        const counts = new Map<string, number>();
        for (const row of rows) counts.set(month(row.created_at), (counts.get(month(row.created_at)) ?? 0) + 1);
        return {
            datasets: [{ label: 'New Customers', data: months.map((start) => counts.get(monthKey(start)) ?? 0), fill: 'start', borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)' }],
            labels: months.map(monthLabel),
        };
    }
}

export class TopProductsByRevenueChart extends ShopChart {
    static heading = 'Top Products by Revenue';
    getType(): string { return 'bar'; }
    getOptions(): Record<string, unknown> { return { indexAxis: 'y' }; }
    async getData(): Promise<ChartData> {
        const { startDate, endDate, orderStatuses, productCategory } = read(this.pageFilters);
        // Jointure directe, comme la démo : les commandes supprimées ne sont pas écartées ici.
        const query = knex()('order_items').join('products', 'order_items.product_id', 'products.id').join('orders', 'order_items.order_id', 'orders.id');
        if (startDate) query.where('orders.created_at', '>=', sql(startDate));
        if (endDate) query.where('orders.created_at', '<=', sql(endDate));
        if (orderStatuses) query.whereIn('orders.status', orderStatuses);
        if (productCategory) query.whereExists(knex()('product_category_product').select(knex().raw('1')).whereRaw('product_category_product.product_id = products.id').where('product_category_product.product_category_id', productCategory));
        const products: any[] = await query.select('products.name', knex().raw('SUM(order_items.qty * order_items.unit_price) as revenue')).groupBy('products.id', 'products.name').orderBy('revenue', 'desc').limit(10);
        return {
            datasets: [{ label: 'Revenue', data: products.map((product) => round(Number(product.revenue), 2)), backgroundColor: '#3b82f6' }],
            labels: products.map((product) => truncate(product.name, 25)),
        };
    }
}

export class CustomerSegmentsChart extends ShopChart {
    static heading = 'Customer Segments';
    getType(): string { return 'doughnut'; }
    async getData(): Promise<ChartData> {
        const { startDate, endDate, orderStatuses } = read(this.pageFilters);
        const rows: any[] = await ordersBetween(startDate, endDate, orderStatuses).join('customers', 'customers.id', 'orders.customer_id').whereNull('customers.deleted_at').groupBy('orders.customer_id').select(knex().raw('count(*) as orders_count'));
        const segments = { 'One-time (1)': 0, 'Occasional (2-3)': 0, 'Regular (4-9)': 0, 'VIP (10+)': 0 };
        for (const row of rows) {
            const orders = Number(row.orders_count);
            if (orders <= 0) continue;
            segments[orders === 1 ? 'One-time (1)' : orders <= 3 ? 'Occasional (2-3)' : orders <= 9 ? 'Regular (4-9)' : 'VIP (10+)']++;
        }
        return { datasets: [{ label: 'Customers', data: Object.values(segments), backgroundColor: ['#9ca3af', '#3b82f6', '#22c55e', '#f59e0b'] }], labels: Object.keys(segments) };
    }
}

export class OrderValueDistributionChart extends ShopChart {
    static heading = 'Order Value Distribution';
    getType(): string { return 'bar'; }
    async getData(): Promise<ChartData> {
        const { startDate, endDate, orderStatuses } = read(this.pageFilters);
        const prices: any[] = await ordersBetween(startDate, endDate, orderStatuses).whereNotNull('total_price').select('total_price');
        const ranges = { '$0-50': 0, '$50-100': 0, '$100-250': 0, '$250-500': 0, '$500-1k': 0, '$1k+': 0 };
        for (const row of prices) {
            const price = Number(row.total_price);
            ranges[price < 50 ? '$0-50' : price < 100 ? '$50-100' : price < 250 ? '$100-250' : price < 500 ? '$250-500' : price < 1000 ? '$500-1k' : '$1k+']++;
        }
        const colors = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
        return { datasets: [{ label: 'Orders', data: Object.values(ranges), backgroundColor: colors, borderColor: colors }], labels: Object.keys(ranges) };
    }
}

export class ProductMarginAnalysisChart extends ShopChart {
    static heading = 'Product Margin Analysis';
    getType(): string { return 'scatter'; }
    async getData(): Promise<ChartData> {
        const { productCategory } = read(this.pageFilters);
        const query = knex()('products').whereNotNull('price').where('price', '>', 0).whereNotNull('cost').where('cost', '>', 0);
        if (productCategory) query.whereExists(knex()('product_category_product').select(knex().raw('1')).whereRaw('product_category_product.product_id = products.id').where('product_category_product.product_category_id', productCategory));
        const products: any[] = await query.select('id', 'price', 'cost', 'qty');
        return {
            datasets: [{
                label: 'Products', showLine: false,
                data: products.map((product) => ({ x: round(((Number(product.price) - Number(product.cost)) / Number(product.price)) * 100, 1), y: Math.trunc(Number(product.qty)) })),
                backgroundColor: '#3b82f6',
            }],
        };
    }
}

/** Port de App\Filament\Widgets\FlaggedOrders : commandes « New » de plus de 3 jours ou « Processing » de plus de 7 jours. */
export class FlaggedOrders extends TableWidget {
    getDataAdapterForTable() {
        return new ObjectionAdapter(Order, {
            softDeletes: 'deleted_at',
            modify: (query) => {
                query.select('orders.*', knex()('customers').select('customers.name').whereRaw('customers.id = orders.customer_id').as('customer_name'))
                    .where((flagged) => {
                        flagged.where((q) => { q.where('status', 'new').where('orders.created_at', '<=', sql(subDays(now(), 3))); })
                            .orWhere((q) => { q.where('status', 'processing').where('orders.created_at', '<=', sql(subDays(now(), 7))); });
                    });
            },
        });
    }
    table(table: Table<Order>): Table<Order> {
        return table
            .defaultPaginationPageOption(5)
            .defaultSort('created_at', 'asc')
            .columns([
                TextColumn.make<Order>('number').searchable().sortable().copyable().weight('medium'),
                TextColumn.make<Order>('customer.name').getStateUsing(({ record }) => record.customer_name ?? null).searchable({ column: 'customer_name' }).sortable({ column: 'customer_name' }),
                TextColumn.make<Order>('status').badge()
                    .formatStateUsing(({ record }) => STATUSES[record.status]?.label ?? record.status)
                    .color((record) => STATUSES[record.status]?.color ?? 'gray').icon((record) => STATUSES[record.status]?.icon ?? null),
                TextColumn.make<Order>('total_price').money().alignEnd().sortable(),
                // Trié par la date de création, en sens inverse de l'âge affiché.
                TextColumn.make<Order>('days_old').label('Days old').alignEnd().getStateUsing(({ record }) => Math.trunc(diffInDays(parse(record.created_at), now()))).sortable({ column: 'created_at', inverted: true }).weight('bold'),
                TextColumn.make<Order>('issue').label('Issue').getStateUsing(({ record }) => (record.status === 'new' ? 'Awaiting processing' : 'Stuck in processing')).badge().color((record) => (record.status === 'new' ? 'warning' : 'danger')),
            ]);
    }
}

export const shopWidgets = [ShopKpisStats, OrdersYearOverYearChart, CustomerGrowthChart, FlaggedOrders, TopProductsByRevenueChart, CustomerSegmentsChart, OrderValueDistributionChart, ProductMarginAnalysisChart];
