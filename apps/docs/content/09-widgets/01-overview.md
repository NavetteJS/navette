---
title: Overview
---

## Introduction

Navette allows you to build dynamic dashboards, comprised of "widgets". Each widget is an element on the dashboard that displays data in a specific way. For example, you can display [stats](/widgets/stats-overview), a [chart](/widgets/charts), a [table](/widgets/table-widgets) or a [calendar](/widgets/calendar).

Widgets are also displayed above or below the content of any page, such as the list page of a resource.

## Creating a widget

A widget is a class extending one of the widget classes of `@navette-js/panels`:

| Class | Displays |
|---|---|
| `StatsOverviewWidget` | A row of [statistics](/widgets/stats-overview), with optional trend charts. |
| `ChartWidget` | A Chart.js [chart](/widgets/charts). |
| `TableWidget` | A [table](/widgets/table-widgets) of records. |
| `CalendarWidget` | A month, week or list [calendar](/widgets/calendar) of events. |
| `Widget` | Anything: you write the HTML (see [custom widgets](#custom-widgets)). |

```ts
import { Stat, StatsOverviewWidget } from '@navette-js/panels';

export class OrdersOverview extends StatsOverviewWidget {
    async getStats() {
        return [
            Stat.make('Orders', await countOrders()),
            Stat.make('Revenue', formatMoney(await sumRevenue())),
        ];
    }
}
```

## Registering widgets

A widget is a stateful component: it must be registered before a page can display it. Register it on the panel with `widgets()`:

```ts
import { Panel } from '@navette-js/panels';

const panel = Panel.make()
    // ...
    .widgets([OrdersOverview, RevenueChart, LatestOrders]);
```

Widgets that belong to a resource may instead be registered with the resource's `static widgets` property. A widget that is displayed without being registered causes an "unknown component" error.

## Customizing the dashboard page

A dashboard is a page extending `Dashboard`. Register it in the panel's `pages()`:

```ts
import { Dashboard, Panel } from '@navette-js/panels';

class Home extends Dashboard {
    static navigationLabel = 'Home';

    getHeading() {
        return 'Welcome back';
    }
}

const panel = Panel.make()
    // ...
    .pages([Home])
    .widgets([OrdersOverview, RevenueChart]);
```

By default, a dashboard displays all the widgets registered on the panel, in the order of registration. To choose its widgets and their order, override `getWidgets()`:

```ts
import { Dashboard } from '@navette-js/panels';

class Home extends Dashboard {
    getWidgets() {
        return [OrdersOverview, RevenueChart, LatestOrders];
    }
}
```

### Creating multiple dashboards

You may create as many dashboards as you need by extending the `Dashboard` class again. You will also need to define the URL path of each extra dashboard with `slug`, otherwise it will be at `/`:

```ts
import { Dashboard } from '@navette-js/panels';

class ShopDashboard extends Dashboard {
    static slug = 'shop';
    static title = 'Shop Dashboard';
    static navigationIcon = 'o-shopping-cart';
    static navigationSort = -1;

    getWidgets() {
        return [ShopKpisStats, OrdersYearOverYearChart, FlaggedOrders];
    }
}
```

The default navigation sort of a dashboard is `-2`, and its default icon is `o-home`. Since every dashboard shows the panel's widgets by default, override `getWidgets()` on each of them as soon as you have several.

### Customizing the widgets' grid

You may change how many grid columns are used to display widgets, by overriding the `getColumns()` method. The default is 2 columns, from the `lg` breakpoint:

```ts
import { Dashboard } from '@navette-js/panels';

class Home extends Dashboard {
    getColumns() {
        return 3;
    }
}
```

#### Responsive widgets grid

You may change the number of widget grid columns based on the responsive breakpoint of the browser, by returning an object that contains the number of columns at each breakpoint:

```ts
import { Dashboard } from '@navette-js/panels';

class Home extends Dashboard {
    getColumns() {
        return { md: 4, xl: 5 };
    }
}
```

#### Customizing widget width

You may customize the width of a widget using the static `columnSpan` property. You may use a number to indicate how many columns the widget should span, or `'full'` to make it occupy the full width of the page:

```ts
import { ChartWidget } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    static columnSpan = 2;
}
```

The span applies from the `lg` breakpoint; below it, widgets take the full width. Stats, table and calendar widgets span the full width by default, and other widgets one column.

You may also give a span per breakpoint (`default`, `sm`, `md`, `lg`, `xl`, `2xl`):

```ts
import { ChartWidget } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    static columnSpan = { md: 2, xl: 3 };
}
```

#### Sorting widgets

The dashboard displays the panel's widgets in the order of their static `sort` property (lowest first). Widgets without a `sort` come after, in the order of the array that lists them:

```ts
import { StatsOverviewWidget } from '@navette-js/panels';

export class StatsOverview extends StatsOverviewWidget {
    static sort = 1;
}
```

Header and footer widgets of other pages keep the order of the array returned by the page.

## Displaying widgets on other pages

Any page may display widgets above its content (header widgets) and below it (footer widgets):

```ts
import { Page } from '@navette-js/panels';

class Reports extends Page {
    static slug = 'reports';

    getHeaderWidgets() {
        return [OrdersOverview];
    }

    getFooterWidgets() {
        return [RevenueChart, CustomerGrowthChart];
    }

    getFooterWidgetsColumns() {
        return 2;
    }
}
```

`getHeaderWidgetsColumns()` returns a number of columns, and `getFooterWidgetsColumns()` a number or an object with a number of columns per breakpoint; both default to 2. Values returned by the page's `getWidgetData()` are passed to each widget as initial properties.

On the list page of a resource, set the resource's `static headerWidgets` to display widgets above the table. The widgets receive the state of the table (search, filters, active tab), which `PageTableStatsWidget` uses to compute [statistics on the displayed records](/widgets/stats-overview#using-the-state-of-the-table).

```ts
import { Resource } from '@navette-js/panels';

export class OrderResource extends Resource {
    static widgets = [OrderStats];
    static headerWidgets = [OrderStats];
}
```

## Conditionally hiding widgets

You may override the static `canView()` method on widgets to conditionally hide them. It receives the logged-in user:

```ts
import { StatsOverviewWidget, type User } from '@navette-js/panels';

export class RevenueOverview extends StatsOverviewWidget {
    static canView(user: User) {
        return user.role === 'admin';
    }
}
```

Navette also checks `canView()` on every request of the widget, including when a lazy widget loads and when it polls. If access is denied, the request returns a 403 response, and pages leave out denied widgets before mounting them. A panel authorizer registered with `authorizeUsing()` is consulted first, with the ability `view` and the widget class.

## Disabling lazy loading

By default, widgets are lazy-loaded: the page is displayed with a placeholder, and each widget loads when it becomes visible. You can disable this behavior with the static `isLazy` property:

```ts
import { ChartWidget } from '@navette-js/panels';

export class RevenueChart extends ChartWidget {
    static isLazy = false;
}
```

### Customizing the loading placeholder

While a lazy widget loads, a gray box of the widget's width is shown. Override `placeholder()` to return your own HTML, written by you (escape any data you put in it). Its root element must be a single element, and should keep the widget's grid column, given by `gridColumn()`:

```ts
import { StatsOverviewWidget } from '@navette-js/panels';

export class OrdersOverview extends StatsOverviewWidget {
    placeholder(): string {
        const column = this.gridColumn();

        return `<div role="status" aria-busy="true" class="fi-section ${column.classes.join(' ')}" style="${column.style} height: 6rem;"><div class="fi-section-content-ctn"><div class="fi-section-content">Loading the orders…</div></div></div>`;
    }

    getStats() {
        // ...
    }
}
```

## Filtering widget data

You may add a form to the dashboard that allows the user to filter the data displayed across all widgets. When the filters are updated, the widgets are rendered again with the new data, without reloading the page.

Define the form in the dashboard's `filtersFormSchema()` method. Its fields are made "live" automatically:

```ts
import { DatePicker, Select } from '@navette-js/forms';
import { Dashboard } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';

class ShopDashboard extends Dashboard {
    static slug = 'shop';

    filtersFormSchema(schema: Schema): Schema {
        return schema.components([
            Section.make()
                .schema([
                    DatePicker.make('startDate').maxDate(({ get }) => (get('endDate') as string) || 'today'),
                    DatePicker.make('endDate').minDate(({ get }) => (get('startDate') as string) || 'today').maxDate('today'),
                    Select.make('orderStatuses').options(ORDER_STATUSES).multiple(),
                ])
                .columns({ md: 2, xl: 3 })
                .columnSpanFull(),
        ]);
    }
}
```

In each widget that should receive the filters, declare the `pageFilters` property and mark it as reactive with `PAGE_FILTERS`. The dashboard sets it, and the widget is rendered again when it changes:

```ts
import { ChartWidget, PAGE_FILTERS } from '@navette-js/panels';

export class CustomerGrowthChart extends ChartWidget {
    static reactive = PAGE_FILTERS;
    pageFilters: Record<string, unknown> | null = null;

    getType() {
        return 'line';
    }

    async getData() {
        const startDate = this.pageFilters?.startDate ?? null;
        const endDate = this.pageFilters?.endDate ?? null;
        // ...
    }
}
```

`pageFilters` is `null` when the dashboard has no filters. A reactive property can only be set by the page, never by the browser through the widget.

<Aside variant="warning">
The filter values come from the user's browser, are not validated, and change live: validate them in your widgets before using them in a query (dates, allowed statuses, existing IDs), as in this helper:

```ts
const STATUSES = ['new', 'processing', 'shipped'];

const statusOf = (value: unknown): string | null => (typeof value === 'string' && STATUSES.includes(value) ? value : null);
const dateOf = (value: unknown): string | null => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
```

Pass them to your queries as bound values (`query.where('status', status)`), never inside raw SQL.
</Aside>

### Filtering widget data using an action modal

Alternatively, you can swap out the filters form for an action modal, opened by a button in the header of the page. There are many benefits to using this approach:

- The filters form is not always visible, which allows you to use the full height of the page for widgets.
- The filters do not update the widgets until the user clicks the "Apply" button, which means that the widgets are not reloaded until the user is ready. This can improve performance if the widgets are expensive to load.
- Validation can be performed on the filters form: the user cannot submit the form until it is valid. Canceling the modal discards the user's changes.

To use an action modal instead of a filters form, leave out `filtersFormSchema()` and register a `FilterAction` in the dashboard's `getHeaderActions()`, with the filter fields in `schema()`:

```ts
import { DatePicker, Select } from '@navette-js/forms';
import { Dashboard, FilterAction } from '@navette-js/panels';

class ShopDashboard extends Dashboard {
    static slug = 'shop';

    getHeaderActions() {
        return [
            FilterAction.make()
                .schema([
                    DatePicker.make('startDate').maxDate('today'),
                    DatePicker.make('endDate').maxDate('today'),
                    Select.make('status').options({ new: 'New', shipped: 'Shipped' }),
                ]),
        ];
    }
}
```

The action opens in a slide-over, filled with the current filters. Handling the data in the widgets is the same as with a filters form: declare `pageFilters` with `static reactive = PAGE_FILTERS`. `FilterAction.make()` returns an action like any other, so you may customize its label, icon, color or modal (`slideOver(false)`, `modalWidth('lg')`).

<Aside variant="info">
The rules of the action's form run on the server before the filters are applied. The `filters` property of the page can still be changed by a crafted request, so the widgets must keep validating `pageFilters` before use.
</Aside>

### Persisting widget filters in the user's session

By default, the dashboard filters persist in the user's session between page loads. If you use [tenancy](/panels/tenancy), filters are persisted separately for each tenant. To disable persistence, set the static `persistsFiltersInSession` property of the dashboard to `false`:

```ts
import { Dashboard } from '@navette-js/panels';

class ShopDashboard extends Dashboard {
    static persistsFiltersInSession = false;
}
```

Alternatively, override the `persistsFiltersInSession()` method:

```ts
import { Dashboard, type PanelContext } from '@navette-js/panels';

class ShopDashboard extends Dashboard {
    persistsFiltersInSession(): boolean {
        return (this._ctx as PanelContext).user?.role !== 'kiosk';
    }
}
```

The session is the browser's session with the panel, and the values are saved in the panel's session store, like [the persisted table filters](/tables/filters/overview#persisting-filters-in-the-users-session): give the panel your own store with `sessionStore()` to keep them in a database or a shared cache.

### Keeping the filters in the URL

The filters are also kept in the query string of the page (`/shop?filters[startDate]=2026-01-01&filters[status]=shipped`), updated as they change: a reloaded or shared link shows the same filters. When the page loads, the filters come from the URL first, then from the session, then from the defaults of the filters form.

Values read from the URL or the session are sanitized (plain values and lists only, with limited depth and length), and `'true'`, `'false'` and `'null'` are converted to `true`, `false` and `null`. With a filters form, only the values of its fields are kept.

## Custom widgets

To build a widget from scratch, extend `Widget` and return its HTML from `render()`, wrapped with `this.wrap()`, which adds the grid column classes of the widget:

```ts
import { Widget, type PanelContext } from '@navette-js/panels';
import { e } from '@navette-js/support';

export class Greeting extends Widget {
    static columnSpan = 'full' as const;
    static isLazy = false;

    render() {
        const { user } = this._ctx as PanelContext;

        return this.wrap(`<section class="fi-section"><div class="fi-section-content-ctn"><div class="fi-section-content">Hello, ${e(user!.name)}!</div></div></section>`);
    }
}
```

`render()` may be asynchronous. Escape everything that comes from data with `e()`.

A widget is a stateful component: its public properties are sent to the browser with the widget's signed snapshot, and the browser may update them, unless they are listed in the static `locked` property. Only the methods listed in the static `callable` property can be called from the browser, for example with `wire:click="refreshStats"`:

```ts
import { Widget } from '@navette-js/panels';

export class ServerStatus extends Widget {
    static callable = ['refreshStats'];
    static locked = ['region'];
    region = 'eu-west';

    refreshStats() {
        // The widget is rendered again after the call.
    }

    async render() {
        // ...
    }
}
```

## Available widgets

Navette includes two ready-made widgets, which you may register and display like your own:

- `AccountWidget` greets the logged-in user, with their avatar and a logout button.
- `NavetteInfoWidget` displays the version of Navette and links to its documentation and repository.

```ts
import { AccountWidget, NavetteInfoWidget, Panel } from '@navette-js/panels';

Panel.make()
    // ...
    .widgets([AccountWidget, NavetteInfoWidget]);
```

Navette does not add any widget to a panel by default.
