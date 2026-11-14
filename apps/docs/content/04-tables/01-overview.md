---
title: Overview
---

## Introduction

Tables are a common UI pattern for displaying lists of records. Navette provides a TypeScript API for defining tables with sorting, searching, filtering, pagination, actions, summaries and grouping.

In a panel, the table of a resource is defined by the static `table()` method of the resource. It receives a `Table` instance, already configured by the list page, and returns it:

```ts
import { Resource } from '@navette-js/panels';
import { IconColumn, TextColumn, type Table } from '@navette-js/tables';

export class PostResource extends Resource {
    // ...

    static table(table: Table<Post>): Table<Post> {
        return table
            .columns([
                TextColumn.make<Post>('title'),
                TextColumn.make<Post>('slug'),
                IconColumn.make<Post>('is_featured').boolean(),
            ]);
    }
}
```

```preview
// records: [{"title": "Introducing Navette", "slug": "introducing-navette", "is_featured": true}, {"title": "Building your first panel", "slug": "building-your-first-panel", "is_featured": false}, {"title": "Ten tips for faster tables", "slug": "ten-tips-for-faster-tables", "is_featured": true}, {"title": "Migrating an existing app", "slug": "migrating-an-existing-app", "is_featured": false}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('slug'),
        IconColumn.make('is_featured').boolean(),
    ])
```

The same `table()` method exists on relation managers and on related-record pages, and a [table widget](#using-a-table-outside-a-resource) defines its table the same way.

### Defining table columns

The basis of any table is rows and columns. Each row is a record returned by the resource's [data adapter](#understanding-where-the-data-comes-from), and you are responsible for defining the columns of that row.

Navette includes several column types, listed in the [columns overview](/tables/columns/overview). You can also write a [custom column](/tables/columns/custom-columns) to render a cell however you need.

Columns are passed as an array to the `columns()` method. In the example above, there are 3 columns: the first two display [text](/tables/columns/text), the title and slug of each record, and the third displays an [icon](/tables/columns/icon), a green check or a red cross depending on whether the post is featured.

#### Making columns sortable and searchable

You can modify columns by chaining methods onto them. For example, you can make a column [searchable](/tables/columns/overview#searching) using the `searchable()` method. A search field appears above the table, and the user can filter rows by the value of that column:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('title')
    .searchable()
```

```preview
// records: [{"title": "Introducing Navette", "slug": "introducing-navette"}, {"title": "Building your first panel", "slug": "building-your-first-panel"}, {"title": "Ten tips for faster tables", "slug": "ten-tips-for-faster-tables"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title').searchable(),
        TextColumn.make('slug'),
    ])
```

You can make several columns searchable, and Navette searches for matches in any of them at once.

You can also make a column [sortable](/tables/columns/overview#sorting) using the `sortable()` method. A sort button is added to the column header, and clicking it sorts the table by that column:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('title')
    .sortable()
```

```preview
// records: [{"title": "Introducing Navette", "slug": "introducing-navette"}, {"title": "Building your first panel", "slug": "building-your-first-panel"}, {"title": "Ten tips for faster tables", "slug": "ten-tips-for-faster-tables"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title').sortable(),
        TextColumn.make('slug'),
    ])
```

#### Accessing related data from columns

You can also display data in a column that belongs to a relationship. For example, if you have a `Post` model that belongs to an `Author` model (the `author` relationship of its `relationMappings`), you can display the author's name in the table:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('author.name')
```

```preview
// records: [{"title": "Introducing Navette", "author": {"name": "Ada Lovelace"}}, {"title": "Building your first panel", "author": {"name": "Grace Hopper"}}, {"title": "Ten tips for faster tables", "author": {"name": "Alan Turing"}}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('author.name'),
    ])
```

In this case, Navette looks for an `author` relationship on the `Post` model, and then displays the `name` attribute of that relationship. We call this "dot notation", and you can use it to display any attribute of any relationship, even nested relationships. Navette uses this dot notation to eager-load the results of that relationship for you, and the column can be sorted and searched through the relationship.

For more information about column relationships, visit the [Relationships section](/tables/columns/overview#displaying-data-from-relationships).

### Defining table filters

As well as making columns `searchable()`, you can let users narrow down the rows in other ways. [Filters](/tables/filters/overview) are defined in the `filters()` method:

```ts
import { SelectFilter, TernaryFilter, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .columns([
            // ...
        ])
        .filters([
            TernaryFilter.make('is_featured'),
            SelectFilter.make('status')
                .options({
                    draft: 'Draft',
                    reviewing: 'Reviewing',
                    published: 'Published',
                }),
        ]);
}
```

A "filter" icon button now appears in the top corner of the table. Clicking it opens a dropdown with the 2 filters. The first one lets the user show all posts, only featured posts, or only posts that are not featured. The second one is a select: when the user picks an option and applies the filters, only rows with that status are displayed.

You can use [form components](/tables/filters/custom) to build the form of a filter, for example a date range.

### Defining table actions

Navette tables can use [actions](/actions/overview). They are buttons added to the [end of each row](/tables/actions#record-actions), or to the [header](/tables/actions#header-actions) of the table. [Bulk actions](/tables/actions#bulk-actions) run code on the records the user selected:

```ts
import { Action } from '@navette-js/actions';
import { DeleteBulkAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .columns([
            // ...
        ])
        .recordActions([
            Action.make('feature')
                .action(async ({ record }) => { await PostResource.adapter.update(record.id, { is_featured: true }); })
                .hidden(({ record }) => Boolean((record as Post).is_featured)),
            Action.make('unfeature')
                .action(async ({ record }) => { await PostResource.adapter.update(record.id, { is_featured: false }); })
                .visible(({ record }) => Boolean((record as Post).is_featured)),
        ])
        .groupedBulkActions([
            DeleteBulkAction.make(),
        ]);
}
```

The `feature` and `unfeature` actions update the row's record. Their `hidden()` and `visible()` conditions show the appropriate action for the record's current state.

<Aside variant="warning">
Custom actions need explicit authorization, with `authorize()`. Showing or hiding an action based on the state of a record does not replace authorization.
</Aside>

When bulk actions are defined, each row of the table gets a checkbox. `DeleteBulkAction` deletes all selected records; you can also [write your own bulk actions](/tables/actions#bulk-actions).

## Sorting records by default

A table is sorted by its default sort until the user clicks a sortable column header. Pass the column of the query to sort by, and optionally the direction, to `defaultSort()`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Order>): Table<Order> {
    return table
        .columns([
            // ...
        ])
        .defaultSort('created_at', 'desc');
}
```

The default sort does not need to match a column of the table. Records are always sorted by their primary key last, so the order of rows is stable across pages.

## Pagination

Tables are paginated. By default, the user can choose between 5, 10, 25 and 50 records per page, and 10 is selected. If there are more records than the selected number, the user navigates between pages using the pagination buttons.

### Customizing the pagination options

You may customize the options of the "per page" select by passing them to the `paginationPageOptions()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .paginationPageOptions([10, 25, 50, 100]);
}
```

The options are enforced on the server: a page size sent by the browser that is not one of the options is replaced by the first option.

### Showing all records

Add `'all'` to the options to let the user show every record on one page:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .paginationPageOptions([10, 25, 50, 'all']);
}
```

### Disabling pagination

`paginated(false)` removes the pagination: every record is shown. `paginated([10, 25])` is a shorter form of `paginationPageOptions()`.

<Aside variant="warning">
`'all'` and `paginated(false)` load every matching record in one query, up to `MAX_UNPAGINATED_RECORDS` (10,000). Use them for tables that stay small; a large table stays fast only with pagination.
</Aside>

### Customizing the default pagination page option

To customize the number of records shown when the table opens, use the `defaultPaginationPageOption()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .defaultPaginationPageOption(25);
}
```

The default must be one of the [pagination options](#customizing-the-pagination-options). Otherwise, 10 is used if it is an option, and the first option if it is not.

### Using simple pagination

You may use simple pagination, with only "previous" and "next" buttons and no page numbers or total count, by passing `'simple'` to the `paginationMode()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .paginationMode('simple');
}
```

```preview
// records: [{"title": "Introducing Navette"}, {"title": "Building your first panel"}, {"title": "Ten tips for faster tables"}, {"title": "Migrating an existing app"}, {"title": "Writing custom columns"}, {"title": "Securing your panel"}, {"title": "Theming with CSS variables"}, {"title": "Testing resources"}, {"title": "Deploying to production"}, {"title": "Multi-tenancy explained"}, {"title": "Relation managers in depth"}, {"title": "What's next for Navette"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
    ])
    .paginationMode('simple')
```

## Record URLs (clickable rows)

In a resource table, each row is a link to the record's edit page, or to its view page when the resource has one (`static hasViewPage = true`). In a simple resource (`static isSimple = true`), clicking a row opens the edit action in a modal instead.

You may change the URL of each row by using the `recordUrl()` method. The function receives the record and returns a URL, or `null` for a row that should not be clickable:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .recordUrl((record) => `/blog/posts/${encodeURIComponent(record.slug)}`);
}
```

<Aside variant="danger">
Navette escapes the URL in the HTML, but it does not check its scheme. If the URL is built from user-controlled data, make sure it cannot use a dangerous scheme such as `javascript:` or `data:`: build it from a path you control, encode the values you insert, or reject anything that is not a relative path or an `http`/`https` URL.
</Aside>

<Aside variant="tip">
You can also [set a URL for a specific column](/tables/columns/overview#opening-urls). A column URL takes precedence over the row URL in that cell.
</Aside>

### Opening an action when a row is clicked

Instead of a URL, a click on a row can open one of the table's [record actions](/tables/actions#record-actions). Pass the name of the action to `recordAction()`:

```ts
import { EditAction, ViewAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';

static table(table: Table<PostCategory>): Table<PostCategory> {
    return table
        .recordAction('view')
        .recordActions([
            ViewAction.make(),
            EditAction.make(),
        ]);
}
```

The action is mounted with the row's record, and goes through the same visibility and authorization checks as when the user clicks its button.

## Reordering records

To allow the user to reorder records using drag and drop, use the `reorderable()` method, passing the name of the column that stores the order of records:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Task>): Table<Task> {
    return table
        .defaultSort('sort')
        .reorderable('sort');
}
```

A button appears in the toolbar to toggle reordering. In reordering mode, every record matching the current search and filters is listed (up to 1,000) in the order of the `sort` column, with drag handles, and without pagination, actions, grouping or summaries. When the user drops a row, the new order is written to the `sort` column as 1, 2, 3 and so on. Use `defaultSort()` on the same column so that the table shows the saved order.

When the resource has a [policy](/resources/overview), reordering requires its `reorder` ability. Only the keys of records that the data adapter can see are updated, whatever the browser sends.

## Customizing the table header

You can add a heading to a table using the `heading()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Client>): Table<Client> {
    return table
        .heading('Clients')
        .columns([
            // ...
        ]);
}
```

```preview
// records: [{"name": "Acme Corporation", "email": "contact@acme.test"}, {"name": "Globex", "email": "hello@globex.test"}, {"name": "Initech", "email": "sales@initech.test"}]
new Table()
    .pluralModelLabel('clients')
    .heading('Clients')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('email'),
    ])
```

Relation managers set the heading to their title, and table widgets to the widget's heading.

## Styling table rows

### Custom row classes

You may style rows based on the record. Return a string of CSS classes, or `null`, from the function passed to `recordClasses()`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .recordClasses((record) => ({
            draft: 'draft-post-table-row',
            reviewing: 'reviewing-post-table-row',
            published: 'published-post-table-row',
        })[record.status] ?? null);
}
```

Define these classes in your [theme](/styling/overview).

## Understanding where the data comes from

A table never queries the database itself. It builds a list query from its state (search terms, sort, filters, page) and passes it to a data adapter, an object that implements the `DataAdapter` interface of `@navette-js/database`. In a resource, the adapter is the resource's static `adapter`:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { Resource } from '@navette-js/panels';

export class PostResource extends Resource {
    static adapter = new ObjectionAdapter(Post, {
        softDeletes: 'deleted_at',
        modify: (query) => { query.where('posts.team_id', currentTeamId()); },
    });
}
```

`ObjectionAdapter` reads and writes an [Objection](https://vincit.github.io/objection.js/) model with [Knex](https://knexjs.org/). Its `modify` function is applied to every query of the resource: use it to restrict which records are visible, or to add computed columns. Data from related records is read with [dot notation](#accessing-related-data-from-columns). To display data from another source, such as an API or an in-memory array, [write your own adapter](/tables/custom-data).

## Using a table outside a resource

A `TableWidget` displays a table on a dashboard or above a resource's table. It defines `table()` and returns its data adapter from `getDataAdapterForTable()`:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { TableWidget } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

export class LatestOrders extends TableWidget {
    getDataAdapterForTable() {
        return new ObjectionAdapter(Order, { modify: (query) => { query.whereNull('deleted_at'); } });
    }

    table(table: Table<Order>): Table<Order> {
        return table
            .defaultPaginationPageOption(5)
            .defaultSort('created_at', 'desc')
            .columns([
                TextColumn.make<Order>('number').searchable().sortable(),
                TextColumn.make<Order>('total_price').money('usd').alignEnd(),
            ]);
    }
}
```

A table widget uses simple pagination and its heading defaults to the class name ("Latest Orders"); set `static heading` to change it.

<Aside variant="warning">
Table widgets support columns, searching, sorting, pagination, the column manager, grouping and summaries, but not filters or actions yet.
</Aside>

## Security

All the state of a table comes from the browser: search terms, sort, page, page size, filters, hidden columns, grouping and selected records. Navette only keeps what the table declares:

- a sort is applied only to a `sortable()` column, using the sort column you declared;
- searches only query `searchable()` columns;
- filter values are cleaned by each filter, and values are passed to the database as bound parameters;
- only a `toggleable()` column can be hidden, and only a declared group can be selected;
- selected record keys are reduced to the records that the data adapter can see before a bulk action runs.

What Navette cannot know is which records a user may see. Restrict them in the data adapter (the `modify` option of `ObjectionAdapter`, or tenancy), never with a filter or a hidden column, which the user can remove.

## Global settings

To change the default configuration of every instance of a column, call its static `configureUsing()` method once, when your application starts. The function runs for each column created afterwards with `make()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.configureUsing((column) => {
    column.placeholder('-');
});
```

Filters, query builder constraints, summarizers and groups do not have a static `configureUsing()` method, but the `configureUsing()` function of `@navette-js/support` does the same for any class whose `make()` applies global settings:

```ts
import { configureUsing } from '@navette-js/support';
import { QueryBuilder } from '@navette-js/tables';

configureUsing(QueryBuilder, (queryBuilder) => {
    queryBuilder.constraintPickerColumns(2);
});
```

To change the defaults of every table, use `Table.configureUsing()`. It runs when a table is created, before its `table()` method, so a table's own options take precedence:

```ts
import { Table } from '@navette-js/tables';

Table.configureUsing((table) => {
    table
        .paginationPageOptions([25, 50, 100])
        .emptyStateHeading('Nothing here yet');
});
```
