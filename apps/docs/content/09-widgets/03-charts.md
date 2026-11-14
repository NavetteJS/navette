---
title: Chart widgets
---

## Introduction

Navette comes with many "chart" widgets, which you can use to display real-time, interactive charts. Charts are drawn in the browser by [Chart.js](https://www.chartjs.org), which is bundled with Navette: you don't need to install anything.

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
The `filter` property is updated by the browser: check that its value is one of your filters before using it.
</Aside>

### Custom filters

You can use [schema components](/schemas/overview) to build custom filters for your chart widget. This approach offers a more flexible way to define filters. The form is displayed in a dropdown, opened by a button in the header of the widget.

To get started, define the `filtersFormSchema()` method:

```ts
import { DatePicker } from '@navette-js/forms';
import { ChartWidget } from '@navette-js/panels';
import { type Schema } from '@navette-js/schemas';

export class BlogPostsChart extends ChartWidget {
    filtersFormSchema(schema: Schema): Schema {
        return schema.components([
            DatePicker.make('startDate').default(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
            DatePicker.make('endDate').default(() => new Date().toISOString().slice(0, 10)),
        ]);
    }
}
```

A widget may name the method `filtersSchema()` instead: both work the same way.

The filter values are accessible via the `this.filters` object. You can use these values inside your `getData()` method:

```ts
async getData() {
    const startDate = this.filters?.startDate ?? null;
    const endDate = this.filters?.endDate ?? null;

    return {
        // ...
    };
}
```

The `this.filters` object will always reflect the current form data. Please note that this data is not validated, as it is available live and can be changed by the browser: you must ensure that the data is valid before using it (a date matching `/^\d{4}-\d{2}-\d{2}$/`, a value among your options).

<Aside variant="info">
If you want to add filters that apply to multiple widgets at once, see [filtering widget data](/widgets/overview#filtering-widget-data) in the dashboard.
</Aside>

#### Deferring filter updates

By default, filters using the `filtersFormSchema()` method update the chart data immediately as they are changed. However, for complex queries or better user experience, you may want to **defer** filter updates until the user clicks an "Apply" button.

When deferred, filter changes are only applied when the user clicks the "Apply" button. This ensures that the chart only re-renders when the user has finished adjusting all of their filters.

The chart will display data using the default filter values when the page first loads, ensuring users see meaningful data immediately without needing to take action.

To enable deferred filters, set the static `hasDeferredFilters` property to `true`:

```ts
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    static hasDeferredFilters = true;

    // ...
}
```

If you need dynamic control over whether filters are deferred, you may override the `hasDeferredFilters()` method:

```ts
import { ChartWidget, type PanelContext } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    hasDeferredFilters(): boolean {
        return (this._ctx as PanelContext).user?.prefersDeferredFilters === true;
    }
}
```

While the form is edited, its state is in `this.deferredFilters`; "Apply" copies it to `this.filters`.

#### Resetting filters to defaults

When using deferred filters, a "Reset" button appears in the filter dropdown footer alongside the "Apply" button. Clicking it restores all filters to their default values as defined in the `filtersFormSchema()` method. For example, if you set `default()` on a `DatePicker`, the reset action will restore that default date, not an empty value.

You may also call `this.resetFilters()` from your chart widget to restore the default filter values and refresh the chart data. This applies the defaults immediately, even when filter updates are deferred.

#### Customizing filter actions

You may customize the apply and reset actions that appear when using deferred filters. All methods that are available to [customize action trigger buttons](/actions/overview) can be used:

```ts
import { Action } from '@navette-js/actions';
import { ChartWidget } from '@navette-js/panels';

export class BlogPostsChart extends ChartWidget {
    filtersApplyAction(action: Action): Action {
        return action
            .label('Update Chart')
            .color('success');
    }

    filtersResetAction(action: Action): Action {
        return action
            .label('Clear Filters')
            .color('danger');
    }
}
```

To filter the data of several widgets at once from a dashboard, see [filtering widget data](/widgets/overview#filtering-widget-data).

## Empty state

When `getData()` returns an empty object, the chart is replaced by an empty state, with the heading "No chart data".

You may customize it by overriding `getEmptyStateHeading()`, `getEmptyStateDescription()` and `getEmptyStateIcon()` (`null` for no icon):

```ts
import { ChartWidget } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    protected getEmptyStateHeading(): string {
        return 'No revenue yet';
    }

    protected getEmptyStateDescription(): string | null {
        return 'Revenue appears here after the first order.';
    }
}
```

### Customizing when the empty state is shown

By default, the empty state is shown when `getData()` returns an empty object. To customize when it is rendered, override the `isEmpty()` method:

```ts
import { ChartWidget } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    async isEmpty(): Promise<boolean> {
        const data = await this.getCachedData();

        return !(data.datasets?.[0]?.data as unknown[] | undefined)?.length;
    }
}
```

### Adding empty state actions

You can add [actions](/actions/overview) to the empty state to prompt users to take action by overriding the `getEmptyStateActions()` method:

```ts
import { Action } from '@navette-js/actions';
import { ChartWidget, Notification } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    getEmptyStateActions() {
        return [
            Action.make('refresh')
                .label('Refresh')
                .action(() => {
                    Notification.make().success().title('Revenue refreshed').send();
                }),
            Action.make('importOrders')
                .label('Import orders')
                .requiresConfirmation()
                .action(async () => {
                    // ...
                }),
            Action.make('newOrder')
                .label('New order')
                .url('/shop/orders/create'),
        ];
    }
}
```

The actions are mounted on the widget: they may open a modal, with a confirmation or a form, and run on the server when submitted. Only the actions returned by `getEmptyStateActions()` can be mounted, and hidden or disabled actions are refused, even if the browser asks for them. An action may also call a method of the widget listed in its `static callable` property, with `action('refresh')`.

### Using a custom empty state view

You may use a completely custom empty state by overriding the `getEmptyState()` method. It returns HTML, written by you: escape the data you put in it with `e()` from `@navette-js/support`:

```ts
import { ChartWidget } from '@navette-js/panels';
import { e } from '@navette-js/support';

export class RevenueChart extends ChartWidget {
    getEmptyState(): string {
        return `<div class="nv-wi-chart-frame"><p>${e(`No revenue since ${this.filter}`)}</p></div>`;
    }
}
```

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

The options are serialized to JSON. If you want to return raw JavaScript from this method instead, you can return a `RawJs` object. This is useful if you want to use a JavaScript callback function, for example:

```ts
import { RawJs } from '@navette-js/forms';
import { ChartWidget } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    getOptions() {
        return RawJs.make(`{
            scales: {
                y: {
                    ticks: {
                        callback: (value) => '€' + value,
                    },
                },
            },
        }`);
    }
}
```

The JavaScript is written into the page as it is: never build it from user data.

## Styling charts in a theme

To style the canvas-rendered chart from a [custom theme](/styling/overview#creating-a-custom-theme), set these CSS custom properties on `.nv-wi-chart` or a parent element:

```css
.nv-wi-chart {
    --chart-border-width: 1;
    --chart-line-tension: 0.4;
    --chart-point-radius: 3;
    --chart-point-style: rect;
    --chart-bar-border-radius: 4;
}
```

- `--chart-border-width`: the thickness of the data outlines.
- `--chart-line-tension`: the curvature of a line chart, from `0` for straight segments to `1`.
- `--chart-point-radius`: the marker size for line, radar and scatter charts.
- `--chart-point-style`: the marker shape: `circle`, `cross`, `crossRot`, `dash`, `line`, `rect`, `rectRounded`, `rectRot`, `star` or `triangle`. Use `none` to hide markers.
- `--chart-bar-border-radius`: the corner radius of bars. Use `0` for square corners instead of the default rounded corners.

Use unitless numbers and the supported keywords, not CSS lengths such as `3px`. You may set different values for light and dark mode (`.dark .nv-wi-chart { … }`).

<Aside variant="info">
To configure an individual chart, use [`getOptions()`](#setting-chart-configuration-options). Explicit options for these settings take precedence over the CSS custom properties.
</Aside>

### Styling the chart legend

The legend beneath a chart is drawn onto the canvas as well. Two properties control the color swatch next to each label:

```css
.nv-wi-chart {
    --chart-legend-box-width: 16;
    --chart-legend-border-radius: 0;
}
```

`--chart-legend-box-width` sets how wide each swatch is, and `--chart-legend-border-radius` rounds its corners, which are slightly rounded by default to match the bars of a bar chart. Set it to `0` for square swatches.

### Styling chart tooltips

The tooltip that appears when hovering over a chart is drawn onto the canvas as well. Its shape comes from two more properties:

```css
.nv-wi-chart {
    --chart-tooltip-corner-radius: 0;
    --chart-tooltip-border-width: 1;
}
```

Its colors are set differently, so that you can use the same palette and dark mode variants as the rest of your theme. The chart reads them from hidden elements that you style with an ordinary `color` declaration:

```css
.nv-wi-chart {
    & .nv-wi-chart-tooltip-bg-color {
        @apply text-gray-900 dark:text-white;
    }

    & .nv-wi-chart-tooltip-text-color {
        @apply text-white dark:text-gray-900;
    }

    & .nv-wi-chart-tooltip-border-color {
        @apply text-gray-700 dark:text-gray-200;
    }
}
```

A tooltip has no border until you give it a width, so `--chart-tooltip-border-width` and `.nv-wi-chart-tooltip-border-color` usually change together.

The colors of the chart itself work in the same way: `.nv-wi-chart-bg-color` and `.nv-wi-chart-border-color` fill and outline the data, `.nv-wi-chart-grid-color` draws the grid lines, and `.nv-wi-chart-text-color` labels the axes.

The small charts inside a [stats overview widget](/widgets/stats-overview#styling-stat-charts-in-a-theme) are styled separately, with their own set of properties.

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

## Using custom Chart.js plugins

Chart.js offers a powerful plugin system that allows you to extend its functionality and create custom chart behaviors. This guide details how to use them in a chart widget.

### Step 1: Install the plugin with NPM

To start with, install the plugin using NPM into your project. In this guide, we will install [`chartjs-plugin-datalabels`](https://chartjs-plugin-datalabels.netlify.app/guide/getting-started.html#installation):

```bash
npm install chartjs-plugin-datalabels --save-dev
```

### Step 2: Create a JavaScript file importing the plugin

Create a new JavaScript file where you will define your custom plugin. In this guide, we'll call it `resources/js/chart-js-plugins.js`. Import the plugin, and add it to the `window.navetteChartJsPlugins` array:

```ts
import ChartDataLabels from 'chartjs-plugin-datalabels';

window.navetteChartJsPlugins ??= [];
window.navetteChartJsPlugins.push(ChartDataLabels);
```

This is equivalent to including the plugins "inline" via `new Chart(..., { plugins: [...] })` when instantiating a Chart.js chart.

It's important to initialize the array if it has not been already, before pushing onto it. This ensures that multiple JavaScript files (especially those from plugins) that register Chart.js plugins do not overwrite each other, regardless of the order they are loaded in.

You can push as many plugins to the array as you would like to install, you do not need a separate file to import each plugin. A plugin may also be an object written in the file itself:

```ts
window.navetteChartJsPlugins ??= [];
window.navetteChartJsPlugins.push({
    id: 'chartAreaBorder',
    afterDraw(chart) {
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.strokeRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.restore();
    },
});
```

Additionally, you can also register any "global plugins" which will use `Chart.register([...])` in the `window.navetteChartJsGlobalPlugins` array:

```ts
import ChartDataLabels from 'chartjs-plugin-datalabels';

window.navetteChartJsGlobalPlugins ??= [];
window.navetteChartJsGlobalPlugins.push(ChartDataLabels);
```

Global plugins are registered when the first chart of the page loads, so the file must run before that.

### Step 3: Bundle the JavaScript file

A file importing npm packages must be bundled for the browser, with esbuild, Vite or your bundler of choice. For example, with esbuild:

```bash
npx esbuild resources/js/chart-js-plugins.js --bundle --minify --outfile=public/js/chart-js-plugins.js
```

A file without `import` statements, like the `chartAreaBorder` example, can be served as it is.

### Step 4: Register the JavaScript file in the panel

The panel must load the file on its pages, before the charts are created. Serve the `public` folder with `express.static()`, and add the script tag with the `panels::scripts.before` [render hook](/advanced/render-hooks):

```ts
import express from 'express';
import { Panel } from '@navette-js/panels';

app.use(express.static('public'));

const panel = Panel.make()
    // ...
    .renderHook('panels::scripts.before', () => '<script src="/js/chart-js-plugins.js"></script>');
```

The script is loaded on every page of the panel, before the chart widgets. Charts are loaded on demand, so they always find the plugins. A [panel plugin](/plugins/panel-plugins#registering-assets) registers its Chart.js plugins the same way, from its `register()` method.
