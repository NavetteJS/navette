---
title: Custom pages
---

## Introduction

A custom page is a class extending `Page`, in the `pages` folder of the panel (see [creating a custom page](/panels/navigation#creating-a-custom-page)). Its content is a [schema](/schemas/overview), returned by `contentSchema()`. This page describes the options shared by every page of a panel, the resource pages included.

```bash
npx navette make:page Reports
```

## Adding a subheading

The subheading is shown under the title. A string is escaped; return an `HtmlString` for trusted HTML:

```ts
import { Page } from '@navette-js/panels';

export class Reports extends Page {
    static slug = 'reports';
    static title = 'Reports';
    static subheading = 'Figures of the current month';
}
```

Override `getSubheading()` to compute it:

```ts
getSubheading(): string | null {
    return `Updated ${new Date().toLocaleDateString('en')}`;
}
```

## Aligning the header actions

The actions returned by `getHeaderActions()` are aligned to the start of the header. Set `headerActionsAlignment` to `'center'`, `'end'` or `'between'`:

```ts
export class Reports extends Page {
    static headerActionsAlignment = 'end';

    getHeaderActions(): Action[] {
        return [Action.make('export').action(() => exportReports())];
    }
}
```

## Opening an action when the page loads

A page may open one of its actions as soon as it is displayed, an onboarding modal for example. Set `defaultAction` to the name of the action, and `defaultActionArguments` to its arguments:

```ts
import { Action } from '@navette-js/actions';
import { Dashboard as BaseDashboard } from '@navette-js/panels';

export class Dashboard extends BaseDashboard {
    defaultAction: string | null = 'onboarding';
    defaultActionArguments: Record<string, unknown> | null = { step: 1 };

    getHeaderActions(): Action[] {
        return [Action.make('onboarding').modalHeading('Welcome').schema([/* ... */]).action(() => {})];
    }
}
```

Set them in `mount()` to decide per user. A link may also open an action of the page with `?action=onboarding` (and `actionArguments[step]=2`), which takes precedence. The action is mounted with the usual checks: an action that is hidden, disabled or not authorized is not opened.

## Adding widgets to a page

`getHeaderWidgets()` and `getFooterWidgets()` return the widgets displayed above and below the content. `getHeaderWidgetsColumns()` and `getFooterWidgetsColumns()` set the number of columns of their grid (2 by default), either one number, used from the `lg` breakpoint, or one number per breakpoint:

```ts
export class Reports extends Page {
    getHeaderWidgets() {
        return [OrdersChart, LatestOrders];
    }

    getHeaderWidgetsColumns() {
        return { md: 2, xl: 4 };
    }
}
```

### Passing properties to a widget

`make()` gives properties to one widget of the list. They are assigned to the public properties of the same name, before `mount()`:

```ts
export class OrdersChart extends ChartWidget {
    static locked = ['status'];
    status = 'paid';

    async getData() {
        return ordersPerMonth(this.status);
    }
}

getHeaderWidgets() {
    return [OrdersChart.make({ status: 'paid' }), OrdersChart.make({ status: 'refunded' })];
}
```

List these properties in `static locked`: the browser could change them otherwise. The same applies to the widgets of a panel's `widgets([...])` and of a resource's `headerWidgets`.

## Replacing the header or adding a footer

`getHeader()` replaces the whole header of the page (breadcrumbs, title, subheading and header actions), and `getFooter()` adds content after the page. Both return trusted HTML: escape any value with `e()`, or render a view:

```ts
import { e, HtmlString } from '@navette-js/support';

export class Reports extends Page {
    getHeader() {
        return new HtmlString(`<header class="reports-header"><h1>${e(this.getTitle())}</h1></header>`);
    }

    getFooter() {
        return new HtmlString('<footer class="reports-footer">Figures are updated every hour.</footer>');
    }
}
```

Return `null` (the default) to keep the normal header, or no footer.

## Customizing the maximum content width

A page takes the [maximum content width of the panel](/panels/configuration#customizing-the-maximum-content-width). Set `maxContentWidth` on a page to change it there only: `'full'`, `'screen'`, `'7xl'`, `'4xl'`…

```ts
export class Reports extends Page {
    static maxContentWidth = 'full';
}
```

## Adding attributes to the body

`extraBodyAttributes` adds attributes to the `<body>` element on this page. A `class` is added to the classes of the body:

```ts
export class Reports extends Page {
    static extraBodyAttributes = { class: 'reports-page', 'data-section': 'reports' };
}
```

## Generating URLs to a page

`getUrl()` returns the URL of the page in the current panel. When the same page class is registered in several panels, pass the panel (or its id) to target another one, and `tenant` in a panel with [tenancy](/panels/tenancy):

```ts
Reports.getUrl();                                 // /admin/reports
Reports.getUrl({ month: '2026-11' });             // /admin/reports?month=2026-11
Reports.getUrl({}, { panel: 'staff' });           // /staff/reports
```
