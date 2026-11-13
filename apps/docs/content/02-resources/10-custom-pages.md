---
title: Custom pages
---

## Introduction

Navette generates the pages of a resource, but you are not limited to them. There are three ways to add your own screens to a resource:

- replace a generated page with a subclass, through the `pages` property ([customizing resource pages](/resources/overview#customizing-resource-pages));
- add a page of related records, through `relatedPages` ([relation pages](/resources/managing-relationships#relation-pages));
- register a free [page](/panels/navigation#creating-a-custom-page) whose URL contains the record key, as described below.

## Using a resource record

A page of a panel may have parameters in its slug, written in braces. The router passes them to `mount()`, and copies each one into the public property of the same name:

```ts
import { Page, type PanelContext } from '@navette-js/panels';
import { WireError } from '@navette-js/wire';
import { TextEntry } from '@navette-js/infolists';
import { Section, type Schema } from '@navette-js/schemas';

export class OrderReceipt extends Page {
    static slug = 'shop/orders/{record}/receipt';
    static title = 'Receipt';
    static shouldRegisterNavigation = false;
    static locked = ['record'];

    record = '';
    _order: any = null;

    // Runs on every request of the page: read the record again and check the rights.
    async hydrate(): Promise<void> {
        const user = (this._ctx as PanelContext).user;
        this._order = await OrderResource.adapter.find(this.record);
        if (!this._order) throw new WireError(404, 'Not Found');
        if (!(await OrderResource.can('view', user, this._order))) throw new WireError(403, 'Forbidden');
    }

    async mount(): Promise<void> {
        await this.hydrate();
    }

    getHeading(): string {
        return `Receipt for ${this._order.number}`;
    }

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make().schema([
                TextEntry.make('number').state(() => this._order.number),
                TextEntry.make('total').state(() => this._order.total_price).money('usd'),
            ]),
        ]);
    }
}
```

Register it on the panel, then link to it from the resource, for example with a row action:

```ts
panel.pages([OrderReceipt]);

Action.make('receipt').url(({ record }) => panel.getUrl(`shop/orders/${record.id}/receipt`))
```

This page is not attached to the resource: Navette only checks its `canAccess()` method. Reading the record through the resource adapter keeps the scope of the resource (and of the current tenant), and checking the resource policy in `hydrate()`, which runs on every request sent by the page, keeps a forged request away from records the user may not view. A WireError with status 404 or 403 thrown while the page is displayed answers with that status.

Properties whose name starts with `_` stay on the server; `locked` keeps the browser from changing `record`.

<Aside variant="warning">
A free page cannot appear in the record sub-navigation of a resource (`recordSubNavigation` only accepts the View, Edit and related-records pages).
</Aside>

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
