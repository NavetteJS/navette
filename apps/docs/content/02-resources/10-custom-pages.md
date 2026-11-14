---
title: Custom pages
---

## Introduction

Navette generates the pages of a resource, but you are not limited to them. There are several ways to add your own screens to a resource:

- replace a generated page with a subclass, through the `pages` property ([customizing resource pages](/resources/overview#customizing-resource-pages));
- add a page of related records, through `relatedPages` ([relation pages](/resources/managing-relationships#relation-pages));
- add a custom page bound to a record, through `relatedPages` too, as described below;
- register a free [page](/panels/navigation#creating-a-custom-page) of the panel.

## Using a resource record

A custom page of a record extends `InteractsWithRecord(Page)` and is declared in the `relatedPages` of its resource, under the name used in its URL:

```ts
import { InteractsWithRecord, Page, Resource } from '@navette-js/panels';
import { TextEntry } from '@navette-js/infolists';
import { Section, type Schema } from '@navette-js/schemas';

export class OrderReceipt extends InteractsWithRecord(Page) {
    static title = 'Receipt';
    static navigationIcon = 'o-receipt-percent';

    getHeading(): string {
        return `Receipt for ${this.getRecord().number}`;
    }

    contentSchema(schema: Schema): Schema {
        const order = this.getRecord();

        return schema.components([
            Section.make().schema([
                TextEntry.make('number').state(() => order.number),
                TextEntry.make('total').state(() => order.total_price).money('usd'),
            ]),
        ]);
    }
}

export class OrderResource extends Resource {
    static relatedPages = { receipt: OrderReceipt };
}
```

The page is served at `/<slug>/{record}/receipt`, and `OrderResource.getUrl('receipt', order.id)` generates its URL, for example in a row action:

```ts
Action.make('receipt').url(({ record }) => OrderResource.getUrl('receipt', record.id))
```

On every request sent by the page, the record is read again through the adapter of the resource, so the scope of the resource and of the current tenant apply (and, in a [nested resource](/resources/nesting), the parent records). An unknown record answers 404. The user needs the `viewAny` ability of the resource, the page's own `canAccess()`, and the `view` ability on the record; override `canAccessRecord()` to check another ability:

```ts
canAccessRecord(record: any, user: User | null) {
    return OrderResource.can('update', user, record);
}
```

`getRecord()` returns the record, `getRecordTitle()` its title, and `recordKey` its key, which the browser cannot change. The breadcrumbs lead back to the list and to the record (when the resource has a `recordTitleAttribute`, linked to its View page, or else its Edit page, if the user may open it); the last one is the static `breadcrumb` property, or the page title. Actions of the page receive the record.

### Adding a record page to the sub-navigation

List the page in `recordSubNavigation` to show it next to the View and Edit pages of the record. Its item uses `navigationLabel` (or the title) and `navigationIcon`:

```ts
static recordSubNavigation = ['view', 'edit', 'receipt'];
```

### Using a free page

A free page of the panel can also read a record: a parameter in its slug, written in braces, is passed to `mount()` and copied into the public property of the same name (`static slug = 'shop/orders/{record}/receipt'`). Such a page is not attached to the resource: read the record through the resource adapter and check the resource policy yourself in `hydrate()`, which runs on every request of the page, list `record` in `static locked`, and throw a `WireError` with status 404 or 403 when the record is missing or forbidden. It cannot appear in the record sub-navigation; prefer `InteractsWithRecord(Page)` for pages of a record.

## Rendering a page with a view

The content of a page is a [schema](/schemas/overview) by default. For a screen that schemas do not describe well, such as a report, a dashboard of your own or a guided tour, render the content with an EJS view instead. Set the static `view` property to the file of the view, and return its variables from `getViewData()`:

```ts
import { Page } from '@navette-js/panels';

export class SalesReport extends Page {
    static slug = 'sales-report';
    static title = 'Sales report';
    static navigationIcon = 'o-chart-bar';
    static view = new URL('./sales-report.ejs', import.meta.url);
    static callable = ['setPeriod'];

    period = 'week';

    setPeriod(period: unknown): void {
        // The argument comes from the browser.
        if (period === 'week' || period === 'month') this.period = period;
    }

    async getViewData() {
        // `period` is a public property: the browser may send any value.
        const days = this.period === 'month' ? 30 : 7;
        const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

        return { days, orders: await Order.query().where('created_at', '>=', since).orderBy('created_at', 'desc') };
    }
}
```

The view sits next to the class, in `src/admin/pages/sales-report.ejs`. It may use the [UI components](/components/overview) of Navette and your own:

```html
<x-section heading="Orders" :description="'Placed in the last ' + days + ' days'">
    <x-slot name="after-header">
        <x-button size="sm" :color="page.period === 'week' ? 'primary' : 'gray'" wire:click="setPeriod('week')">Week</x-button>
        <x-button size="sm" :color="page.period === 'month' ? 'primary' : 'gray'" wire:click="setPeriod('month')">Month</x-button>
    </x-slot>

    <% if (orders.length === 0) { %>
        <x-empty-state heading="No orders" icon="o-shopping-bag" :contained="false" />
    <% } else { %>
        <ul>
            <% for (const order of orders) { %>
                <li>
                    <%= order.number %>
                    <x-badge :color="order.paid ? 'success' : 'warning'"><%= order.paid ? 'Paid' : 'Unpaid' %></x-badge>
                </li>
            <% } %>
        </ul>
    <% } %>
</x-section>
```

The view receives:

| Variable | Content |
| --- | --- |
| `page` | The page instance: its public properties and its methods (`page.period`, `page.getTitle()`) |
| `livewireId` | The id of the page component, for the [`livewire-id` of a modal](/components/modal#using-a-modal-in-a-page) or the `id` of a [pagination](/components/other#pagination) |
| The keys of `getViewData()` | Your variables. `getViewData()` may be asynchronous |

The view replaces the content schema only: the heading, breadcrumbs, header actions and widgets of the page are rendered as usual. The view is rendered again after every request of the page, so it always shows the current state. A `Dashboard` renders its widgets: `view` has no effect on it.

`view` may also be a path, or the name of a namespaced view. Register the namespace once when your application starts, then give the name:

```ts
import { fileURLToPath } from 'node:url';
import { views } from '@navette-js/support';

views.namespace('app', fileURLToPath(new URL('./views', import.meta.url)));

class SalesReport extends Page {
    static view = 'app::pages.sales-report'; // views/pages/sales-report.ejs
}
```

### Calling the page from the view

Elements of the view call methods of the page with `wire:click`, like in the example above. Only the methods named in `callable` can be called; the arguments come from the browser, so check them in the method. A method that changes a public property makes the page render again with the new value. See [security](/advanced/security#restricting-the-methods-callable-from-the-browser).

<Aside variant="danger">
Print values with `<%= %>`, which escapes them. `<%- %>` prints HTML as it is: use it only for HTML that you built and escaped yourself. See [escaping and security](/components/overview#escaping-and-security).
</Aside>
