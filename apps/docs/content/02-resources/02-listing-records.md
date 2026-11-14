---
title: Listing records
---

## Introduction

The list page of a resource displays its [table](/tables/overview), with a "New" button in the header that leads to the [create page](/resources/creating-records). It is generated from the `ListRecords` class, and its table is the one returned by the static `table()` method of the resource.

The page also renders the [header widgets](/resources/widgets) of the resource above the table, and the tabs described below.

## Using tabs to filter the records

You can add tabs above the table, which can be used to filter the records based on some predefined conditions. Each tab can scope the query of the table differently. Define them in the static `tabs()` method of the resource, as an object of `Tab` instances:

```ts
import { Resource, Tab } from '@navette-js/panels';

export class TaskResource extends Resource {
    // ...

    static tabs(): Record<string, Tab> {
        return {
            '': Tab.make('All'),
            open: Tab.make('Open').query((query) => { query.where('is_done', 0); }),
            done: Tab.make('Done').query((query) => { query.where('is_done', 1); }),
        };
    }
}
```

The `query()` callback receives the query builder of the adapter (an Objection query builder with `ObjectionAdapter`) and adds conditions to it. It is applied on the server, together with the search, the filters and the scope of the adapter. Only a tab declared by the page can be selected: an unknown tab key sent by the browser falls back to the default tab.

### Customizing the filter tab labels

The label of a tab is the argument of `make()`. Without it, the label is generated from the key, `in_progress` becoming "In progress":

```ts
static tabs(): Record<string, Tab> {
    return {
        all: Tab.make(),
        in_progress: Tab.make(),
    };
}
```

### Adding badges to filter tabs

You can add a badge to a tab using the `badge()` method. It takes a function, which may be asynchronous. The badges are computed after the page is displayed, so a slow count does not delay the table:

```ts
import { Tab } from '@navette-js/panels';

Tab.make('Pending')
    .badge(() => LeaveRequest.query().where('status', 'pending').resultSize())
    .badgeColor('warning')
    .query((query) => { query.where('status', 'pending'); })
```

The color of a badge is set with `badgeColor()`. Without it, the badge has no color class.

### Customizing the default tab

The first tab is selected by default. A tab with an empty key (`''`) is a convenient "All" tab, since its key is not written in the page state:

```ts
static tabs(): Record<string, Tab> {
    return {
        '': Tab.make('All'),
        active: Tab.make('Active').query((query) => { query.where('is_active', 1); }),
    };
}
```

To decide the tabs on the page rather than on the resource, override `getTabs()` in a [custom list page](/resources/overview#customizing-resource-pages).

### Adding icons to tabs

`icon()` adds an icon before the tab label; `iconPosition('after')` moves it after:

```ts
import { Tab } from '@navette-js/panels';

Tab.make('Active').icon('m-check-circle').iconPosition('after')
```

### Adding extra attributes to filter tabs

You may also pass extra HTML attributes to filter tabs using `extraAttributes()`:

```ts
import { Tab } from '@navette-js/panels';

Tab.make('Confirmed')
    .extraAttributes({ 'data-cy': 'statement-confirmed-tab' })
```

The attributes are added to the tab button. A `class` is added to its classes; the attributes that the button needs (`id`, `type`, `tabindex`, `wire:click`…) cannot be replaced. Pass `true` as the second argument to merge them with the attributes given before.

### Excluding the tab query when resolving records

When a user interacts with a table record (e.g., clicking an action button), Navette resolves that record from the database. While a tab is active, its query is applied when resolving the record: a record that does not match the active tab is not found, and the action does not run.

However, when a record's state changes after the user saw it in the table, you may still want the user to interact with it. For example, if you have an "Active" tab and an action sets a record to inactive, subsequent actions on that row (or in the same modal) would fail to resolve that record.

You may mark a tab to be excluded when resolving records using the `excludeQueryWhenResolvingRecord()` method:

```ts
import { Resource, Tab } from '@navette-js/panels';

export class CustomerResource extends Resource {
    // ...

    static tabs(): Record<string, Tab> {
        return {
            active: Tab.make('Active')
                .query((query) => { query.where('active', 1); })
                .excludeQueryWhenResolvingRecord(),
            inactive: Tab.make('Inactive')
                .query((query) => { query.where('active', 0); })
                .excludeQueryWhenResolvingRecord(),
        };
    }
}
```

<Aside variant="danger">
Tabs are chosen by the browser and must not be your only tenant or ownership restriction. Apply mandatory restrictions with the `modify` option of the [adapter](/advanced/data-adapters#customizing-the-query) or with [tenancy](/panels/tenancy), and authorize operations separately. `excludeQueryWhenResolvingRecord()` only changes how records are resolved; it must not remove your application's authorization boundary.
</Aside>

## Authorization

The list page, and the navigation item of the resource, are only available to users who have the `viewAny` ability. The "New" button requires the `create` ability, and the default "Edit" link of each row requires `update` on that record. See [authorization](/resources/authorization).

## Customizing the table query

To restrict the records of the resource everywhere (list, edit page, bulk actions, global search), use the `modify` option of the [adapter](/advanced/data-adapters#customizing-the-query).

To add a condition to the table of the list page only, override `modifyTableQuery()` in a custom list page. It receives the list query, and adds a modifier that will be applied to the query builder:

```ts
import { ListRecords } from '@navette-js/panels';

class ListOrders extends ListRecords {
    modifyTableQuery(query: { modifiers?: ((query: any) => void)[] }): void {
        super.modifyTableQuery(query); // keeps the active tab
        (query.modifiers ??= []).push((builder) => { builder.where('total_price', '>', 0); });
    }
}

export class OrderResource extends Resource {
    static pages = { index: ListOrders };
}
```

<Aside variant="danger">
`modifyTableQuery()` only changes what the table shows. A record hidden this way can still be opened by its URL. To keep users away from records, restrict the adapter instead.
</Aside>

## Custom actions

The header of the list page contains a "New" button. To add actions before it, define the static `listHeaderActions()` method on the resource:

```ts
import { Action } from '@navette-js/actions';

static listHeaderActions = () => [
    Action.make('leave_requests')
        .label('Leave requests')
        .color('gray')
        .icon('m-calendar')
        .url('/hr/leave-requests'),
];
```

To replace the header actions entirely, override `getHeaderActions()` in a custom list page. See [actions](/actions/overview) for what an action can do.

## Custom page content

Each page of a panel renders a [schema](/schemas/overview), returned by its `contentSchema()` method. On the list page, it contains the tabs, the render hooks around the table, and the table itself. You may override it to add components around the table:

```ts
import { ListRecords } from '@navette-js/panels';
import { Html, type Schema } from '@navette-js/schemas';

class ListTasks extends ListRecords {
    contentSchema(schema: Schema): Schema {
        const content = super.contentSchema(schema);

        return content.components([
            Html.make('<p class="app-notice">Tasks are archived after 90 days.</p>'),
            ...content.getComponents(),
        ]);
    }
}
```

The HTML of `Html.make()` is inserted as is: escape any data with `e()` from `@navette-js/support`. To add markup without a custom page, you may also use the `panels::resource.pages.list-records.table.before` and `.after` [render hooks](/advanced/render-hooks).
