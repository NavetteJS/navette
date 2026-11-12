---
title: Widgets
---

## Introduction

Resource widgets are widgets displayed on the pages of a resource, most often above the table of its list page. They are ordinary [widgets](/widgets/overview), registered by the resource.

## Creating a resource widget

A widget is a class that extends one of the widget classes of `@navette-js/panels`, such as `StatsOverviewWidget`:

```ts
import { Stat, StatsOverviewWidget } from '@navette-js/panels';

export class OrderStats extends StatsOverviewWidget {
    static pollingInterval = null;

    async getStats(): Promise<Stat[]> {
        return [
            Stat.make('Orders', await Order.query().resultSize()),
            Stat.make('Open orders', await Order.query().whereIn('status', ['new', 'processing']).resultSize()).color('warning'),
        ];
    }
}
```

## Displaying a widget on a resource page

A widget must be registered before it can be displayed. List the widgets of the resource in `widgets`, then choose the ones shown above the table of the list page with `headerWidgets`:

```ts
export class OrderResource extends Resource {
    static widgets = [OrderStats];
    static headerWidgets = [OrderStats];
}
```

<Aside variant="warning">
A widget listed in `headerWidgets`, or returned by a page, but registered neither in the `widgets` of a resource nor in the `widgets()` of the panel cannot be rendered.
</Aside>

To display widgets on another page of the resource, override `getHeaderWidgets()` or `getFooterWidgets()` in a [custom page](/resources/overview#customizing-resource-pages):

```ts
import { EditRecord } from '@navette-js/panels';

class EditOrder extends EditRecord {
    getHeaderWidgets() {
        return [OrderStats];
    }
}
```

The number of columns of the widget grid is returned by `getHeaderWidgetsColumns()` and `getFooterWidgetsColumns()` (2 by default). Widgets the user may not see, according to their `canView()` method, are left out.

## Accessing the current record in the widget

Widgets are separate components. A page passes data to its widgets with `getWidgetData()`: each value is copied into the widget property of the same name when the widget is mounted. To give the record key to a widget on an edit page:

```ts
import { EditRecord, Stat, StatsOverviewWidget } from '@navette-js/panels';

class CustomerOrdersStats extends StatsOverviewWidget {
    static locked = ['record'];
    record = '';

    async getStats(): Promise<Stat[]> {
        const count = await Order.query().where('customer_id', this.record).resultSize();
        return [Stat.make('Orders', count)];
    }
}

class EditCustomer extends EditRecord {
    getHeaderWidgets() { return [CustomerOrdersStats]; }
    getWidgetData() { return { record: this.recordKey }; }
}
```

Public properties travel to the browser and back: list the property in `locked` so the browser cannot change it.

## Accessing page table data in the widget

A widget above the table of the list page can work on exactly the records that the table displays, with its search, filters and active tab. Extend `PageTableStatsWidget`, and point `tablePage` to the list page of the resource:

```ts
import { PageTableStatsWidget, Stat } from '@navette-js/panels';

export class ProductStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => ProductResource.getPages().index as any;

    async getStats(): Promise<Stat[]> {
        const { count, sum, avg } = await this.aggregatePageTable({ sum: ['qty'], avg: ['price'] });

        return [
            Stat.make('Total Products', count),
            Stat.make('Product Inventory', sum.qty),
            Stat.make('Average price', avg.price.toFixed(2)),
        ];
    }
}
```

The widget receives the state of the table (search, filters, sort, active tab) every time it changes, and is rendered again. `aggregatePageTable()` runs the current query of the table through the resource adapter, and returns the number of records, and the sums and averages of the given columns. Its second argument adds a condition to the query, for a statistic about a part of the displayed records:

```ts
const open = await this.aggregatePageTable({}, (query) => { query.whereIn('status', ['new', 'processing']); });
```

`trendPageTable()` returns one value per month for the same query, to draw the chart of a statistic:

```ts
const perMonth = await this.trendPageTable({ start: lastYear, end: today });

Stat.make('Orders', count).chart(perMonth)
```

It counts the records by month of `created_at` by default; pass `dateColumn` to use another column, and `average` to average a column instead. Its date functions are written for SQLite.

The state received from the browser goes through the same validation as on the list page: only the search, filters and tabs declared by the page are applied.

### Accessing the total table records count

The `count` returned by `aggregatePageTable()` is the number of records matching the table, across all its pages.
