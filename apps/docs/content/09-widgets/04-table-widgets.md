---
title: Table widgets
---

## Introduction

You may easily add tables to your dashboard. Create a class extending `TableWidget`, define the table in its `table()` method, and return the data adapter that provides the records from `getDataAdapterForTable()`:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { TableWidget } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

export class LatestOrders extends TableWidget {
    getDataAdapterForTable() {
        return new ObjectionAdapter(Order, {
            softDeletes: 'deleted_at',
            modify: (query) => {
                query.where('created_at', '>=', thirtyDaysAgo());
            },
        });
    }

    table(table: Table<Order>): Table<Order> {
        return table
            .defaultPaginationPageOption(5)
            .defaultSort('created_at', 'desc')
            .columns([
                TextColumn.make<Order>('number').searchable().sortable().copyable(),
                TextColumn.make<Order>('status').badge(),
                TextColumn.make<Order>('total_price').money().alignEnd().sortable(),
                TextColumn.make<Order>('created_at').label('Order date').date().sortable(),
            ]);
    }
}
```

Then [register the widget](/widgets/overview#registering-widgets) and display it on a dashboard or a page. The widget spans the full width of the page by default.

The `modify` option of the adapter restricts the records the table can show. Searching, sorting and pagination all apply on top of it, and nothing outside this scope is ever displayed.

## Setting the heading

The heading of the table is generated from the class name: `LatestOrders` becomes "Latest Orders", and a `Widget` suffix is removed. You may set it with the static `heading` property:

```ts
import { TableWidget } from '@navette-js/panels';

export class LatestOrders extends TableWidget {
    static heading = 'Orders of the last 30 days';
}
```

### Adding an icon to the heading

The static `icon` property displays an icon before the heading, aligned like the icon of a section header; `iconColor` changes its color (gray by default). To compute them, override `getIcon()` and `getIconColor()`:

```ts
import { TableWidget } from '@navette-js/panels';

export class LatestOrders extends TableWidget {
    static heading = 'Orders of the last 30 days';
    static icon = 'o-shopping-bag';
    static iconColor = 'primary';
}
```

Outside a widget, a table takes the same icon with `headingIcon()` and `headingIconColor()`.

## Supported table features

A table widget supports:

- Columns, including computed state, badges, colors, icons and formatting.
- Sorting, with `defaultSort()`.
- Global search and individual column search.
- Simple pagination ("Previous" / "Next", without a total), with `defaultPaginationPageOption()` and `paginationPageOptions()`.
- Hiding columns with the column manager, for `toggleable()` columns.

The widget also renders the `WidgetsRenderHook.TABLE_WIDGET_START` and `WidgetsRenderHook.TABLE_WIDGET_END` render hooks, scoped to the widget class.

<Aside variant="warning">
Table widgets do not support actions (header, row and bulk actions), record selection, or filters yet. To let users act on records, link the widget to a resource page instead, for example with a [stat](/widgets/stats-overview#linking-a-stat-to-a-page) or a page header action.
</Aside>

## Disabling lazy loading

By default, widgets are lazy-loaded. This means that they will only be loaded when they are visible on the page.

To disable this behavior, you may override the static `isLazy` property on the widget class:

```ts
import { TableWidget } from '@navette-js/panels';

export class LatestOrders extends TableWidget {
    static isLazy = false;
}
```
