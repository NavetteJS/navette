---
title: Stats overview widgets
---

## Introduction

Navette comes with a "stats overview" widget, which you can use to display a number of different stats in a single widget, without writing any HTML.

Create a class extending `StatsOverviewWidget`, and return `Stat` instances from its `getStats()` method:

```ts
import { Stat, StatsOverviewWidget } from '@navette-js/panels';

export class StatsOverview extends StatsOverviewWidget {
    getStats() {
        return [
            Stat.make('Unique views', '192.1k'),
            Stat.make('Bounce rate', '21%'),
            Stat.make('Average time on page', '3:12'),
        ];
    }
}
```

```preview
// viewport: 1100
[
    Stat.make('Unique views', '192.1k'),
    Stat.make('Bounce rate', '21%'),
    Stat.make('Average time on page', '3:12'),
]
```

`getStats()` may be asynchronous, which is how you query your database:

```ts
import { Stat, StatsOverviewWidget } from '@navette-js/panels';

export class TaskStats extends StatsOverviewWidget {
    async getStats() {
        const open = await Task.query().where('is_done', 0).resultSize();

        return [
            Stat.make('Open tasks', open),
            Stat.make('Total', await Task.query().resultSize()),
        ];
    }
}
```

Then [register the widget](/widgets/overview#registering-widgets) and display it on a dashboard or a page.

The value may be a string or a number. It is displayed as-is, so format numbers and currencies yourself, for example with `Intl.NumberFormat`. A `null` or empty value displays a placeholder.

The stats are laid out in three columns, or in four when three columns would leave a single stat on the last row (4, 7, 10…). The widget spans the full width of the page by default.

## Adding a description and icon to a stat

You may add a `description()` to provide additional information, along with a `descriptionIcon()`:

```ts
import { Stat } from '@navette-js/panels';

Stat.make('Unique views', '192.1k')
    .description('32k increase')
    .descriptionIcon('m-arrow-trending-up')
```

```preview
// width: 24rem
Stat.make('Unique views', '192.1k').description('32k increase').descriptionIcon('m-arrow-trending-up')
```

The `descriptionIcon()` method also accepts a second parameter to put the icon before the description instead of after it:

```ts
import { Stat } from '@navette-js/panels';

Stat.make('Unique views', '192.1k')
    .description('32k increase')
    .descriptionIcon('m-arrow-trending-up', 'before')
```

You may also add an icon before the label of the stat with `icon()`:

```ts
import { Stat } from '@navette-js/panels';

Stat.make('Orders', 128)
    .icon('m-shopping-bag')
```

```preview
// width: 24rem
Stat.make('Orders', 128).icon('m-shopping-bag')
```

The label, value and description are escaped.

## Changing the color of the stat

You may also give stats a color, which is used for the description and the chart:

```ts
import { Stat } from '@navette-js/panels';

Stat.make('Turnover rate', `${turnoverRate}%`)
    .description(`${inactiveCount} departed of ${totalCount}`)
    .descriptionIcon('m-arrow-right-on-rectangle')
    .color(turnoverRate > 20 ? 'danger' : 'warning')
```

```preview
// viewport: 1100
[
    Stat.make('Turnover rate', '24%').description('12 departed of 50').descriptionIcon('m-arrow-right-on-rectangle').color('danger'),
    Stat.make('New hires', 8).description('3 more than last month').descriptionIcon('m-arrow-trending-up').color('success'),
    Stat.make('Open positions', 5).description('2 urgent').color('warning'),
]
```

## Linking a stat to a page

You may make the whole stat a link with `url()`:

```ts
import { Stat } from '@navette-js/panels';

Stat.make('Open tasks', open)
    .url('/tasks')
```

## Adding a chart to a stat

You may also add or chain a `chart()` to each stat to provide historical data. The `chart()` method accepts an array of data points to plot, or an object of values keyed by label:

```ts
import { Stat } from '@navette-js/panels';

Stat.make('Unique views', '192.1k')
    .description('32k increase')
    .descriptionIcon('m-arrow-trending-up')
    .chart([7, 2, 10, 3, 15, 4, 17])
    .color('success')
```

The trend line is drawn in the browser by Chart.js.

## Live updating stats (polling)

By default, stats overview widgets refresh their data every 5 seconds.

To customize this, you may override the static `pollingInterval` property on the class to a new interval, in seconds (`'10s'`) or milliseconds (`'500ms'`):

```ts
import { StatsOverviewWidget } from '@navette-js/panels';

export class StatsOverview extends StatsOverviewWidget {
    static pollingInterval = '10s';
}
```

Alternatively, you may disable polling altogether:

```ts
import { StatsOverviewWidget } from '@navette-js/panels';

export class StatsOverview extends StatsOverviewWidget {
    static pollingInterval = null;
}
```

Every poll runs `getStats()` again: with expensive queries, disable polling or choose a long interval.

## Disabling lazy loading

By default, widgets are lazy-loaded. This means that they will only be loaded when they are visible on the page.

To disable this behavior, you may override the static `isLazy` property on the widget class:

```ts
import { StatsOverviewWidget } from '@navette-js/panels';

export class StatsOverview extends StatsOverviewWidget {
    static isLazy = false;
}
```

## Using the state of the table

On the list page of a resource, a `PageTableStatsWidget` receives the state of the table (search, column searches, filters, active tab, sort) and can compute stats on exactly the records the table displays. The numbers follow every search and filter.

```ts
import { PageTableStatsWidget, Resource, Stat } from '@navette-js/panels';

export class OrderStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => OrderResource.getPages().index as any;

    async getStats() {
        const all = await this.aggregatePageTable({ avg: ['total_price'] });
        // The second argument further restricts the query for this stat only.
        const open = await this.aggregatePageTable({}, (query) => query.whereIn('status', ['new', 'processing']));

        return [
            Stat.make('Orders', all.count),
            Stat.make('Open orders', open.count),
            Stat.make('Average order value', formatMoney(all.avg.total_price)),
        ];
    }
}

export class OrderResource extends Resource {
    static widgets = [OrderStats];
    static headerWidgets = [OrderStats];
}
```

`tablePage` returns the list page class whose table is observed. `aggregatePageTable(columns, modify)` returns `{ count, sum, avg }`, with one entry in `sum` and `avg` for each column you ask for. The state received from the page goes through the same validation as on the page itself.

For trend charts, `trendPageTable({ start, end, dateColumn, average, modify })` returns one value per month between `start` and `end`: the number of records, or the average of the `average` column. `dateColumn` defaults to `created_at`. Columns in `modify` are prefixed with `t.`:

```ts
const orders = await this.trendPageTable({ start, end });
const openOrders = await this.trendPageTable({ start, end, modify: (query) => query.whereIn('t.status', ['new', 'processing']) });

return [
    Stat.make('Orders', all.count).chart(orders),
    Stat.make('Open orders', open.count).chart(openOrders),
];
```

<Aside variant="info">
`trendPageTable()` requires the resource to use an `ObjectionAdapter`, and groups months with the SQLite function `strftime()`.
</Aside>

<Aside variant="warning">
A heading and description for the stats overview widget, extra HTML attributes on a stat, and custom placeholders are not available yet.
</Aside>
