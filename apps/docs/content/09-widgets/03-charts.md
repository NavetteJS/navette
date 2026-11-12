---
title: Chart widgets
---

## Introduction

Navette comes with many "chart" widgets, which you can use to display real-time, interactive charts. Charts are drawn in the browser by [Chart.js](https://www.chartjs.org), with the bundle shipped by Filament: you don't need to install anything.

Create a class extending `ChartWidget`, return the type of chart from `getType()` and the data from `getData()`:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static heading = 'Blog Posts';

    getType() {
        return 'line';
    }

    getData() {
        return {
            datasets: [
                {
                    label: 'Blog posts created',
                    data: [0, 10, 5, 2, 21, 32, 45, 74, 65, 45, 77, 89],
                },
            ],
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        };
    }
}
```

Then [register the widget](/widgets/overview#registering-widgets) and display it on a dashboard or a page.

The `getData()` method returns the data in the format of Chart.js: an array of `datasets` and an array of `labels`. Each dataset accepts the [Chart.js dataset options](https://www.chartjs.org/docs/latest/general/data-structures.html), such as `backgroundColor`, `borderColor`, `fill` or `borderDash`. The data is serialized to JSON, so it may only contain plain values.

## Available chart types

Below is a list of available chart types, to return from `getType()`:

- `'bar'`: bar chart. For a horizontal bar chart, add `indexAxis: 'y'` to the [options](#setting-chart-configuration-options).
- `'bubble'`: bubble chart.
- `'doughnut'`: doughnut chart.
- `'line'`: line chart.
- `'pie'`: pie chart.
- `'polarArea'`: polar area chart.
- `'radar'`: radar chart.
- `'scatter'`: scatter chart. Its data points are `{ x, y }` objects.

## Customizing the chart color

You can customize the color of the chart data by setting the static `color` property, to a color of the panel (`primary` by default):

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static color = 'info';
}
```

The color applies to datasets that do not set their own colors. To customize the color further, or customize the color of each dataset, set `backgroundColor` and `borderColor` in the data:

```ts
{
    datasets: [
        { label: 'Budget used %', data: budgetUsed, backgroundColor: '#3b82f6' },
        { label: 'Timeline elapsed %', data: timelineElapsed, backgroundColor: '#f59e0b' },
    ],
    labels,
}
```

## Generating chart data from the database

`getData()` may be asynchronous, which is how you query your database. For example, with Knex:

```ts
import { ChartWidget } from '@navette-js/panels';

export class DepartmentLeaveLoadChart extends ChartWidget {
    static heading = 'Department Leave Load';

    getType() {
        return 'bar';
    }

    async getData() {
        const rows = await knex('leave_requests')
            .join('employees', 'employees.id', 'leave_requests.employee_id')
            .join('departments', 'departments.id', 'employees.department_id')
            .whereIn('leave_requests.status', ['approved', 'taken'])
            .groupBy('departments.name')
            .select('departments.name')
            .sum({ days: 'leave_requests.days_requested' });

        return {
            datasets: [{ label: 'Leave days', data: rows.map((row) => Number(row.days)), backgroundColor: '#8b5cf6' }],
            labels: rows.map((row) => row.name),
        };
    }
}
```

`getData()` is called once per request: its result is cached for the rest of the request.

## Filtering chart data

### Basic select filter

You can set up chart filters to change the data shown on the chart. Commonly, this is used to change the time period that chart data is rendered for.

To set a default filter value, set the `filter` property. Then, define the filters in `getFilters()`, an object of values and labels:

```ts
import { ChartWidget } from '@navette-js/panels';

export class OrdersChart extends ChartWidget {
    filter: string | null = 'week';

    getFilters() {
        return {
            today: 'Today',
            week: 'Last week',
            month: 'Last month',
            year: 'This year',
        };
    }
}
```

The filter is displayed as a select in the header of the widget. When the user changes it, the widget is rendered again, and you can read the selected value from `this.filter` in `getData()`:

```ts
async getData() {
    const period = ['today', 'week', 'month', 'year'].includes(String(this.filter)) ? String(this.filter) : 'week';
    // ...
}
```

<Aside variant="warning">
The `filter` property is updated by the browser: check that its value is one of your filters before using it. Custom filter forms in a dropdown or a modal are not available yet.
</Aside>

To filter the data of several widgets at once from a dashboard, see [filtering widget data](/widgets/overview#filtering-widget-data).

## Empty state

When `getData()` returns an empty object, the chart is replaced by an empty state, with the heading "No chart data".

<Aside variant="warning">
Customizing the empty state's heading, description, icon and actions is not available yet.
</Aside>

## Live updating chart data (polling)

By default, chart widgets refresh their data every 5 seconds. The new data is only sent to the browser when it has changed.

To customize this, you may override the static `pollingInterval` property on the class to a new interval, in seconds (`'10s'`) or milliseconds (`'500ms'`):

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static pollingInterval = '10s';
}
```

Alternatively, you may disable polling altogether:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static pollingInterval = null;
}
```

## Setting a maximum chart height

You may place a maximum height on the chart to ensure that it doesn't get too big, using the static `maxHeight` property:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static maxHeight = '300px';
}
```

## Setting chart configuration options

You may specify an object of configuration options for the chart by overriding the `getOptions()` method. For more information on the options available, see the [Chart.js documentation](https://www.chartjs.org/docs/latest/general/options.html):

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    getOptions() {
        return {
            plugins: {
                legend: {
                    display: false,
                },
            },
        };
    }
}
```

The options are serialized to JSON: functions (such as tick callbacks) are not supported.

## Adding a heading and a description

You may add a heading and a description below it with the static `heading` and `description` properties:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static heading = 'Blog Posts';
    static description = 'The number of blog posts published per month.';
}
```

To compute them, override `getHeading()` and `getDescription()` instead. Both are escaped.

## Disabling lazy loading

By default, widgets are lazy-loaded. This means that they will only be loaded when they are visible on the page.

To disable this behavior, you may override the static `isLazy` property on the widget class:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static isLazy = false;
}
```

## Making the chart collapsible

You may allow the chart to be collapsed by setting the static `isCollapsible` property to `true`:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static isCollapsible = true;
}
```

## Providing an accessible alternative

The chart is labeled for screen readers with its heading and description. Charts are visual, so you should also provide the information in text. Override `getChartAssistiveContent()` to return a summary that screen readers read instead of the canvas:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    getChartAssistiveContent() {
        return 'Blog posts grew from 0 in January to 89 in December, peaking in December.';
    }
}
```

The text is escaped, and it is not displayed when the chart is empty.

<Aside variant="warning">
Custom Chart.js plugins are not available yet.
</Aside>
