---
title: Overview
---

## Introduction

Resources are classes that build a CRUD interface for one kind of record. A resource describes how administrators interact with your data, using a table and a form, and Navette generates the pages from that description:

```ts
import { Model, ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

class Customer extends Model {
    static tableName = 'customers';
}

export class CustomerResource extends Resource {
    static slug = 'customers';
    static modelLabel = 'customer';
    static recordTitleAttribute = 'name';
    static adapter = new ObjectionAdapter(Customer);

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('name').required().maxLength(255),
            TextInput.make('email').email().required(),
        ]);
    }

    static table(table: Table<Customer>): Table<Customer> {
        return table.columns([
            TextColumn.make<Customer>('name').searchable().sortable(),
            TextColumn.make<Customer>('email').searchable(),
        ]);
    }
}
```

A resource is registered on a panel with `resources()`:

```ts
import { Panel } from '@navette-js/panels';

const panel = Panel.make()
    // ...
    .resources([CustomerResource]);
```

Once registered, the resource has three pages, and an item in the navigation that leads to the first one:

| Page | URL | Class |
|---|---|---|
| List | `/customers` | [`ListRecords`](/resources/listing-records) |
| Create | `/customers/create` | [`CreateRecord`](/resources/creating-records) |
| Edit | `/customers/{record}/edit` | [`EditRecord`](/resources/editing-records) |

A resource never talks to the database directly. Every read and write goes through its `adapter`, an object that implements the `DataAdapter` interface of `@navette-js/database`. `ObjectionAdapter` is the adapter provided for SQL databases, through [Objection](https://vincit.github.io/objection.js/) and [Knex](https://knexjs.org/). See [data adapters](/advanced/data-adapters) to configure it or to write your own.

## Creating a resource

A resource is a class that extends `Resource`, with a few static properties:

| Property | Description |
|---|---|
| `slug` | The URL segment of the resource pages. It may contain slashes: `shop/customers`. |
| `adapter` | The [data adapter](/advanced/data-adapters) that lists, reads and writes the records. |
| `modelLabel` | The singular name of a record, used in titles, buttons and notifications. Defaults to `record`. |
| `form()` | The form [schema](/schemas/overview) used by the create and edit pages. |
| `table()` | The [table](/tables/overview) of the list page. |

To generate a resource class, run `npx navette make:resource` in your project (see the [command line](/getting-started/cli)); add `--generate` to build its form and table from the database table. You may also write the class by hand.

### Simple (modal) resources

Sometimes, your records are simple enough that you only want to manage them on a single page, using modals to create, edit and delete them. To do this, set `isSimple` to `true`:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';
import { DeleteAction, EditAction, Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';
import { TextColumn, type Table } from '@navette-js/tables';

export class DepartmentResource extends Resource {
    static slug = 'hr/departments';
    static modelLabel = 'department';
    static isSimple = true;
    static adapter = new ObjectionAdapter(Department);

    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('name').required()]);
    }

    static table(table: Table): Table {
        return table
            .columns([TextColumn.make('name').searchable()])
            .recordActions([EditAction.make(), DeleteAction.make()]);
    }
}
```

A simple resource only has a list page. Its header contains a [create action](/actions/create) that opens the form in a modal, and clicking a row opens the `edit` row action, so the table should include `EditAction.make()`.

### Handling soft-deletes

When the adapter is configured with a `softDeletes` column, deleting a record only sets that column, and the edit page offers restore and force-delete actions. See [deleting records](/resources/deleting-records#handling-soft-deletes).

### Adding a View page

A resource may also have a read-only page that displays a record with an [infolist](/infolists/overview). Set `hasViewPage` to `true` and define `infolist()`. See [viewing records](/resources/viewing-records).

## Record titles

A resource may have a "record title attribute", which is the name of the column used to identify a record to the user. It is used in the breadcrumbs, the page titles, the modal headings, and it makes the resource [globally searchable](/resources/global-search):

```ts
static recordTitleAttribute = 'name';
```

When the title needs more than one column, override `getRecordTitle()`:

```ts
static getRecordTitle(record: any): string {
    return `${record.first_name} ${record.last_name}`;
}
```

Without a record title attribute, the title of a record is the model label in title case ("Leave Request"), and the edit page breadcrumbs do not include the record.

## Resource forms

The static `form()` method returns the [schema](/schemas/overview) of the create and edit pages. It receives a schema already set to two columns from the `lg` breakpoint, and to the current operation:

```ts
import { DatePicker, TextInput } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';

static form(schema: Schema): Schema {
    return schema.components([
        TextInput.make('name').required().maxLength(255),
        TextInput.make('email').email().required().unique({ ignoreRecord: true }),
        DatePicker.make('birthday').maxDate('today'),
    ]);
}
```

The same form is used by the `CreateAction` and `EditAction` modals of the resource, for example on a [simple resource](#simple-modal-resources).

### Hiding components based on the current operation

The schema knows whether it is creating or editing a record. Components can use the `hiddenOn()` and `visibleOn()` methods, or read `operation` and `record` from the context object that Navette passes to closures:

```ts
import { TextInput } from '@navette-js/forms';
import { Section } from '@navette-js/schemas';

TextInput.make('password').password().hiddenOn('edit'),

Section.make('History')
    .hidden(({ record }) => record === null),

TextInput.make('title')
    .live({ onBlur: true })
    .afterStateUpdated(({ operation, state, set }) => {
        if (operation === 'create') set('slug', slugify(String(state ?? '')));
    }),
```

`operation` is `'create'` or `'edit'`, and `record` is the record being edited, or `null` on the create page.

## Resource tables

The static `table()` method configures the [table](/tables/overview) of the list page. It receives a table that already knows the plural model label, and where a click on a row leads to the edit page (or the View page when there is one):

```ts
import { DeleteBulkAction } from '@navette-js/panels';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';

static table(table: Table<Task>): Table<Task> {
    return table
        .columns([
            TextColumn.make<Task>('title').searchable().sortable(),
            TextColumn.make<Task>('due_date').date().sortable(),
        ])
        .defaultSort('due_date')
        .filters([SelectFilter.make('priority').options([['low', 'Low'], ['high', 'High']])])
        .groupedBulkActions([DeleteBulkAction.make()]);
}
```

When the table declares no row action, the list page adds an "Edit" link to each row the user is allowed to update. When it declares no bulk action, the list page offers `DeleteBulkAction`; pass `groupedBulkActions([])` to remove the checkboxes.

## Customizing the model label

Each resource has a "model label" derived from `modelLabel`. It is used in several places in the UI, such as the "New customer" button and the "Customer created" notification:

```ts
static modelLabel = 'customer';
```

### Customizing the plural model label

The plural label is used in the page titles, the navigation item and the breadcrumbs. Navette builds it from the singular label with simple English rules ("category" becomes "categories", "address" becomes "addresses"). When the rule is wrong, set it yourself:

```ts
static modelLabel = 'person';
static pluralModelLabel = 'people';
```

### Automatic model label capitalization

Labels are written in lower case, and Navette capitalizes them where needed: "Post Categories" in the page title, "New post category" on the button.

## Resource navigation items

The navigation item of a resource is the navigation item of its list page. It uses the title-case plural model label, and the static properties below.

### Customizing a resource navigation label

The `navigationLabel` property replaces the plural model label in the menu:

```ts
static navigationLabel = 'Clients';
```

The item may also be shown [below another item](/panels/navigation#nesting-navigation-items) (`navigationParentItem`), or in a [cluster](/panels/clusters) (`cluster`).

### Setting a resource navigation icon

The `navigationIcon` property sets the [icon](/styling/icons) of the navigation item:

```ts
static navigationIcon = 'o-user-group';
```

### Sorting resource navigation items

The `navigationSort` property sets the order of the item, lowest first:

```ts
static navigationSort = 2;
```

### Grouping resource navigation items

The `navigationGroup` property puts the item in a collapsible group of the sidebar:

```ts
static navigationGroup = 'Shop';
```

The order of the groups is set on the panel, see [navigation](/panels/navigation#grouping-navigation-items). A resource may also display a [badge](/panels/navigation#adding-a-badge-to-a-navigation-item) next to its item.

## Generating URLs to resource pages

The static `getUrl()` method generates the URL of a page of the resource:

```ts
CustomerResource.getUrl();              // '/shop/customers'
CustomerResource.getUrl('create');      // '/shop/customers/create'
CustomerResource.getUrl('edit', 12);    // '/shop/customers/12/edit'
CustomerResource.getUrl('view', 12);    // '/shop/customers/12'
PostResource.getUrl('comments', 3);     // '/blog/posts/3/comments', a related-records page
```

The URL includes the path of the panel and, in a [multi-tenant panel](/panels/tenancy), the key of the current tenant.

### Generating URLs to resource modals

The list page opens a row action when its URL carries the action name and the record key. The action is mounted with the usual checks: the record must be in the scope of the adapter, and the action must be visible to the user:

```ts
`${DepartmentResource.getUrl()}?tableAction=edit&tableActionRecord=${department.id}`
```

[Global search](/resources/global-search) uses these URLs for the records of simple resources.

## Customizing the resource query

Everything a resource reads or writes goes through its adapter. To restrict the records of a resource, or to add computed columns, use the `modify` option of `ObjectionAdapter`. It applies to every query: listing, reading, bulk selections, global search.

```ts
import { ObjectionAdapter } from '@navette-js/database';

static adapter = new ObjectionAdapter(Order, {
    softDeletes: 'deleted_at',
    modify: (query) => {
        query.select(
            'orders.*',
            Order.knex()('customers').select('customers.name').whereRaw('customers.id = orders.customer_id').as('customer_name'),
        );
    },
});
```

A record outside this scope does not exist for the resource: its pages answer 404, even if its key is typed in the URL. See [data adapters](/advanced/data-adapters#customizing-the-query).

## Customizing the resource URL

The URL of the resource pages is its `slug`. It may contain several segments:

```ts
static slug = 'shop/customers';
```

## Resource sub-navigation

Sub-navigation lets the user move between the pages of one record: its View page, its Edit page, and its [related-records pages](/resources/managing-relationships#relation-pages). List the pages to show, in order, with `recordSubNavigation`:

```ts
export class PostResource extends Resource {
    static hasViewPage = true;
    static relatedPages = { comments: ManagePostComments };
    static recordSubNavigation = ['view', 'edit', 'comments'];
}
```

The View and Edit items use the "View" and "Edit" labels with an eye and a pencil icon; a related-records page uses its navigation label and its `navigationIcon`.

### Setting the sub-navigation position for a resource

The sub-navigation is rendered at the start of the page by default. Set `subNavigationPosition` to `'end'`, or to `'top'` to render it as tabs:

```ts
static subNavigationPosition = 'top' as const;
```

The default for every page of a panel is set with [`subNavigationPosition()`](/panels/configuration#setting-the-default-sub-navigation-position) on the panel.

## Customizing resource pages

The pages of a resource are generated from `ListRecords`, `CreateRecord`, `EditRecord` and `ViewRecord`. To change one, extend the class and declare it in `pages`:

```ts
import { CreateRecord, EditRecord } from '@navette-js/panels';

class CreateTask extends CreateRecord {
    protected getCreatedNotificationTitle(): string { return 'Task created'; }
}

class EditTask extends EditRecord {
    getHeaderActions() { return [DeleteAction.make()]; }
}

export class TaskResource extends Resource {
    static pages = { create: CreateTask, edit: EditTask };
}
```

The keys are `index`, `create`, `edit` and `view`. The page classes are linked to the resource for you: inside a page, `this.resource` is the resource class.

Pages cannot be removed from a resource. To forbid creating records, deny the `create` ability in the [policy](/resources/authorization); the button disappears and the create page answers 403.

## Security

### Authorization

By default, every user who can log into the panel can list, create, edit and delete the records of every resource. Navette applies authorization rules at every request, whether they come from the interface or from a forged request: see [authorization](/resources/authorization).

### Protecting model attributes

The create and edit pages only send the values of the fields declared in the form, after validating them on the server. A hidden or disabled field is not saved, unless you make it `dehydrated()`. Values the user must not choose, such as the author of a record, belong in the [lifecycle hooks](/resources/creating-records#customizing-data-before-saving), not in a hidden field.
