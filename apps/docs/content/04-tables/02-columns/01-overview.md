---
title: Overview
---

## Introduction

Column classes are exported by `@navette-js/tables`. They are passed to the `columns()` method of a table. Navette includes these columns:

- [Text column](/tables/columns/text)
- [Icon column](/tables/columns/icon)
- [Image column](/tables/columns/image)
- [Color column](/tables/columns/color)

Editable columns allow the user to update data without leaving the table:

- [Select column](/tables/columns/select)
- [Toggle column](/tables/columns/toggle)
- [Text input column](/tables/columns/text-input)
- [Checkbox column](/tables/columns/checkbox)

You may also [render a column yourself](/tables/columns/custom-columns) to display data however you wish.

Columns are created using the static `make()` method, passing their unique name. Usually, the name of a column is the name of an attribute of the record. Pass the record type as a type argument to get typed records in the column's functions:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Post>('title')
```

```preview
// records: [{"title": "Introducing Navette"}, {"title": "Building your first panel"}, {"title": "Ten tips for faster tables"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
    ])
```

## Column content (state)

The data that a column displays is called its "state". By default, the state is the value of the record's attribute that has the column's name. In the table of a `PostResource`, the following column displays the `title` of each post:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('title')
```

### Setting the state of a column

You can compute the state of a column from the record by passing a function to the `getStateUsing()` method. The function receives an object with the `record`, and may be asynchronous:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Post>('status')
    .getStateUsing(({ record }) => (record.published_at ? 'Published' : 'Draft'))
```

```preview
// records: [{"title": "Introducing Navette", "published_at": "2025-03-05 10:11:12"}, {"title": "Building your first panel", "published_at": null}, {"title": "Ten tips for faster tables", "published_at": "2025-04-18 09:00:00"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status')
            .getStateUsing(({ record }) => (record.published_at ? 'Published' : 'Draft')),
    ])
```

This is also how you read a value nested in a JSON column, once the model declares it in `jsonAttributes`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Post>('meta.title')
    .getStateUsing(({ record }) => record.meta?.title ?? null)
```

### Setting the state directly

`state()` sets a fixed value, or a function of the record. It is a shorter form of `getStateUsing()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('full_name')
    .state((record) => `${record.first_name} ${record.last_name}`)
```

### Setting a default value

`default()` sets the value displayed when the state is empty (`null`, `undefined` or an empty string):

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('status')
    .default('draft')
```

#### Adding placeholder text if a column is empty

You may display placeholder text when the state of a text column is empty (`null`, `undefined` or an empty string). It is styled as lighter gray text:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('department.name')
    .placeholder('No department')
```

```preview
// records: [{"name": "Ada Lovelace", "department": {"name": "Engineering"}}, {"name": "Grace Hopper", "department": null}, {"name": "Alan Turing", "department": {"name": "Research"}}]
new Table()
    .pluralModelLabel('employees')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('department.name')
            .placeholder('No department'),
    ])
```

### Displaying data from relationships

You may use "dot notation" to access columns within relationships. The name of the relationship comes first, followed by a period, followed by the name of the column to display:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('author.name')
```

The relationship must be declared by the Objection model (`relationMappings`). The table eager-loads it with the records (one query per relationship, not one per row), and nested relationships work too: `TextColumn.make('author.country.name')`. When a relationship holds several records (has-many, many-to-many), the state is the list of their values, which a text column can display [as a list](/tables/columns/text#listing-multiple-values):

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('tags.name')
    .badge()
```

Use `distinctList()` to show each value only once. A first segment that is not a relationship is read as a key of an object attribute, such as a JSON column (`meta.title`); when the model lists that column in its `jsonAttributes`, the key can be sorted and searched too.

```preview
// records: [{"title": "Introducing Navette", "author": {"name": "Ada Lovelace"}, "tags": [{"name": "news"}, {"name": "release"}]}, {"title": "Building your first panel", "author": {"name": "Grace Hopper"}, "tags": [{"name": "tutorial"}]}, {"title": "Ten tips for faster tables", "author": {"name": "Alan Turing"}, "tags": []}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('author.name'),
        TextColumn.make('tags.name').badge(),
    ])
```

Relationship columns can be [sorted](#sorting) and [searched](#searching) like any other column: the search matches records whose related record matches (`whereExists`), and the sort orders by the related value with a subquery, so each record stays a single row and the pagination stays exact. Sorting is only possible through relationships that hold a single record (belongs-to-one, has-one).

<Aside variant="info">
Relationships are handled by the data adapter. `ObjectionAdapter` supports them; a [custom adapter](/advanced/data-adapters) receives the relationships to load in `with`, and the dot-notation names in its search and sort columns. A custom adapter that returns records with nested objects (`{ author: { name } }`) displays them without doing anything.
</Aside>

#### Counting relationships

If you wish to count the number of related records in a column, you may use the `counts()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('users_count').counts('users')
```

In this example, `users` is the name of the relationship to count from. The name of the column must be `users_count`, as this is the convention (Laravel's `withCount()`) used to name the result. A camel-case relationship gives a snake-case name: `blogPosts` gives `blog_posts_count`. The count is selected with the records by a subquery, so the column can be sorted.

You may choose another name with `as`: `counts('users as members_count')`, for a column named `members_count`.

If you'd like to scope the relationship before counting, you can pass an object to the method, where the key is the relationship name and the value is the function to scope the Objection query with:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('users_count').counts({
    users: (query) => query.where('is_active', true),
})
```

#### Determining relationship existence

If you simply wish to indicate whether related records exist in a column, you may use the `exists()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('users_exists').exists('users')
```

In this example, `users` is the name of the relationship to check for existence. The name of the column must be `users_exists`. The state is `true` or `false`, which suits an [icon column](/tables/columns/icon) with `boolean()`.

If you'd like to scope the relationship before checking existence, you can pass an object to the method, where the key is the relationship name and the value is the function to scope the Objection query with:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('users_exists').exists({
    users: (query) => query.where('is_active', true),
})
```

#### Aggregating relationships

Navette provides several methods for aggregating a relationship field, including `avg()`, `max()`, `min()` and `sum()`. For instance, if you wish to show the average of a field on all related records in a column, you may use the `avg()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('users_avg_age').avg('users', 'age')
```

In this example, `users` is the name of the relationship, while `age` is the field that is being averaged. The name of the column must be `users_avg_age`: the relationship, the function and the field (`orders_sum_total`, `orders_max_total`).

If you'd like to scope the relationship before aggregating, you can pass an object to the method, where the key is the relationship name and the value is the function to scope the Objection query with:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('users_avg_age').avg({
    users: (query) => query.where('is_active', true),
}, 'age')
```

<Aside variant="info">
Relationship and column names are written by you, never taken from the browser, and must be plain identifiers. Aggregates need a data adapter that supports relationships (`ObjectionAdapter`); with any other adapter, the table throws an error naming the column and the adapter.
</Aside>

## Setting a column's label

By default, the label of the column, displayed in the header of the table, is generated from its name: underscores and hyphens become spaces, and the first letter is capitalized. For a name with dots, the segment before the last dot is used (`author.name` gives "Author"). You may customize the label using the `label()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .label('Full name')
```

```preview
// records: [{"name": "Ada Lovelace"}, {"name": "Grace Hopper"}, {"name": "Alan Turing"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name').label('Full name'),
    ])
```

## Sorting

Columns may be sortable, by clicking on the column label. To make a column sortable, use the `sortable()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .sortable()
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name').sortable(),
        TextColumn.make('email'),
    ])
```

Each click cycles through ascending order, descending order, and no sort.

### Sorting by a different column

By default, the table is sorted by the column of the query that has the column's name (through the relationship for a [relationship column](#displaying-data-from-relationships) such as `author.name`). If the state of the column comes from another column of the query, pass it with the `column` option, which may be a relationship column too:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Post>('author')
    .getStateUsing(({ record }) => `${record.author?.first_name} ${record.author?.last_name}`)
    .sortable({ column: 'author.last_name' })
```

When the sort column evolves in the opposite direction of the displayed value, set `inverted: true`. For example, an age computed from a birth date is sorted by the date, in reverse:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Employee>('age')
    .getStateUsing(({ record }) => ageOf(record.birth_date))
    .sortable({ column: 'birth_date', inverted: true })
```

### Sorting by several columns

Pass a list of columns of the query to `sortable()` to sort by all of them, in that order. This is useful when the column displays several attributes, such as a full name:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<User>('full_name')
    .getStateUsing(({ record }) => `${record.first_name} ${record.last_name}`)
    .sortable(['last_name', 'first_name'])
```

### Customizing the sort query

To order the query yourself, pass a function as the second argument of `sortable()` (or as the `query` option). It receives the query and the direction, `'asc'` or `'desc'`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<User>('full_name')
    .sortable(true, (query, direction) => query
        .orderBy('last_name', direction)
        .orderBy('first_name', direction))
```

The function receives the direction already checked: only `'asc'` or `'desc'` reach it, whatever the browser sends.

### Sorting by default

You may choose to sort a table by default if no other sort is applied, using the table's [`defaultSort()`](/tables/overview#sorting-records-by-default) method.

## Searching

Columns may be searchable by using the text input field in the top right of the table. To make a column searchable, you must use the `searchable()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .searchable()
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name').searchable(),
        TextColumn.make('email'),
    ])
```

The search term is split into words (a phrase in double quotes is one word). Each word must appear, ignoring case, in at least one of the searchable columns. The search field is only displayed when at least one column is searchable, unless the table is [`searchable()` itself](/tables/overview#searching-records).

### Searching several columns

Pass a column of the query, or a list of them, to `searchable()` to search those columns instead of the one named like the column:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<User>('full_name')
    .getStateUsing(({ record }) => `${record.first_name} ${record.last_name}`)
    .searchable(['first_name', 'last_name'])
```

### Customizing the search query

To search with your own conditions, use the `query` option. The function receives the query and the search term (one word at a time, unless the terms are [not split](/tables/overview#searching-records)), and adds conditions to the query:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<User>('full_name')
    .searchable({
        query: (query, search) => query
            .where('first_name', 'like', `%${search}%`)
            .orWhere('last_name', 'like', `%${search}%`),
    })
```

The conditions are grouped, and combined with the other searchable columns with `or`. Pass the search term as a bound value, as above, never inside raw SQL.

### Searching a different column

By default, the column of the query that has the column's name is searched (through the relationship for a [relationship column](#displaying-data-from-relationships)). To search another column instead, pass it with the `column` option, which may be a relationship column too:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('customer')
    .getStateUsing(({ record }) => record.customer?.full_name ?? null)
    .searchable({ column: 'customer.last_name' })
```

<Aside variant="info">
Searching a column alias in the `WHERE` clause of the list query works with SQLite. Some databases, such as PostgreSQL and MySQL, do not accept select aliases there: with them, search a real column of the table.
</Aside>

### Searching individually

You can choose to enable a per-column search input field using the `isIndividual` option:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .searchable({ isIndividual: true })
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name').searchable({ isIndividual: true }),
        TextColumn.make('email'),
    ])
```

If you use the `isIndividual` option, you may still search that column using the main "global" search input field for the entire table. To disable that while still preserving the individual search, use the `isGlobal` option:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('email')
    .searchable({ isIndividual: true, isGlobal: false })
```

Each word of an individual search must appear in that column. An individual search uses the same columns, or the same `query` function, as the global search of the column.

By default, individual search terms are split into words like the global search (see the table's [`splitSearchTerms()`](/tables/overview#splitting-search-terms)). To match the whole term of one column instead, use `splitIndividualSearchTerms(false)`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('sku')
    .searchable({ isIndividual: true })
    .splitIndividualSearchTerms(false)
```

## Clickable cell content

When a cell is clicked, the [record URL or record action](/tables/overview#record-urls-clickable-rows) of the row is used. You may give a column its own URL instead.

### Opening URLs

To open a URL when the cell is clicked, pass a function to the `url()` method. It receives the record and returns a URL, or `null`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Payment>('order.number')
    .getStateUsing(({ record }) => record.order_number ?? null)
    .url((record) => `/shop/orders/${record.order_id}/edit`)
```

<Aside variant="danger">
Navette escapes the URL in the HTML, but does not check its scheme. If it contains user-controlled data, make sure it cannot use a dangerous scheme such as `javascript:` or `data:`.
</Aside>

#### Opening URLs in a new tab

Pass `true` as the second argument of `url()`, or use `openUrlInNewTab()`, to open the URL in a new tab (`target="_blank"`). Both also accept a function of the record:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Product>('name')
    .url((record) => `https://shop.example.com/products/${record.slug}`, true)

TextColumn.make<Product>('website')
    .url((record) => record.website)
    .openUrlInNewTab()
```

### Disabling the click

`disabledClick()` makes the cells of a column plain content: neither the column's own `url()` or `action()`, nor the row's record URL or record action, wrap them. It is useful for a column whose content has its own links or buttons:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('notes')
    .markdown()
    .disabledClick()
```

Editable columns (select, toggle, text input, checkbox) never wrap their cells.

### Triggering actions

To run an action when the cell is clicked, pass an `Action` to the `action()` method. It is mounted with the record of the row, like a [record action](/tables/actions#record-actions): its visibility and authorization are checked again on the server:

```ts
import { Action } from '@navette-js/actions';
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('number')
    .action(
        Action.make('showNotes')
            .modalHeading('Order notes')
            .modalDescription(({ record }) => record.notes ?? 'No notes.')
            .modalSubmitAction(false),
    )
```

You may also pass the name of one of the table's record actions, such as `action('edit')`.

A column `url()` takes precedence over its action. The column's action takes precedence over the row's [record URL or record action](/tables/overview#record-urls-clickable-rows). Editable columns, such as the toggle column, are never clickable.

## Adding a tooltip to the column header

`headerTooltip()` shows a tooltip when the header label is hovered, for example to explain an abbreviation:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('mrr')
    .label('MRR')
    .headerTooltip('Monthly recurring revenue')
```

The tooltip text is escaped.

## Aligning column content

You may align the content of a column, and its header, to the start, center or end using the `alignment()` method, or its shortcuts `alignStart()`, `alignCenter()` and `alignEnd()`. `alignLeft()` and `alignRight()` align to the left or right whatever the text direction, and `alignJustify()` and `alignBetween()` are also available. Each shortcut accepts a boolean condition (`alignEnd(false)` removes the alignment):

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('price')
    .money('usd')
    .alignEnd()
```

```preview
// records: [{"name": "Wireless keyboard", "price": 79}, {"name": "USB-C hub", "price": 39.9}, {"name": "27-inch monitor", "price": 1249.99}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('price')
            .money('usd')
            .alignEnd(),
    ])
```

Numbers are easier to compare when they are aligned to the end.

### Vertical alignment

When the cells of a row have different heights (a long description, a list), their content is vertically centered. `verticalAlignment()` changes it for one column: `start`, `center` or `end`, or the shortcuts `verticallyAlignStart()`, `verticallyAlignCenter()` and `verticallyAlignEnd()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('tags')
    .listWithLineBreaks()
    .verticallyAlignStart()
```

The cells get the `nv-vertical-align-*` class.

## Grouping columns

You can group several columns together under a common heading using a `ColumnGroup` object:

```ts
import { ColumnGroup, TextColumn } from '@navette-js/tables';

static table(table: Table<Payment>): Table<Payment> {
    return table
        .columns([
            TextColumn.make<Payment>('order.number').getStateUsing(({ record }) => record.order_number ?? null),
            ColumnGroup.make<Payment>('Details').columns([
                TextColumn.make<Payment>('reference').searchable().copyable(),
                TextColumn.make<Payment>('amount').money((record) => record.currency).alignEnd(),
            ]),
            ColumnGroup.make<Payment>('Context').columns([
                TextColumn.make<Payment>('provider'),
                TextColumn.make<Payment>('method'),
            ]),
        ]);
}
```

```preview
// records: [{"order_number": "ORD-1042", "reference": "pi_3Nk2Lq", "amount": 129.9, "currency": "eur", "provider": "Stripe", "method": "Card"}, {"order_number": "ORD-1043", "reference": "PAYID-MZ7Q", "amount": 54, "currency": "usd", "provider": "PayPal", "method": "Wallet"}, {"order_number": "ORD-1044", "reference": "pi_3Nk9Xa", "amount": 870.5, "currency": "gbp", "provider": "Stripe", "method": "SEPA debit"}]
// viewport: 1100
new Table()
    .pluralModelLabel('payments')
    .columns([
        TextColumn.make('order.number').getStateUsing(({ record }) => record.order_number),
        ColumnGroup.make('Details').columns([
            TextColumn.make('reference').searchable().copyable(),
            TextColumn.make('amount').money((record) => record.currency).alignEnd(),
        ]),
        ColumnGroup.make('Context').columns([
            TextColumn.make('provider'),
            TextColumn.make('method'),
        ]),
    ])
```

The first argument is the label of the group, and `columns()` takes the columns inside it; they may also be passed as the second argument of `make()`: `ColumnGroup.make('Details', [...])`. A header row is added above the column headers, with one cell spanning each group.

The group's header cell can be customized:

```ts
import { ColumnGroup, TextColumn } from '@navette-js/tables';

ColumnGroup.make('Shipping address', [
    TextColumn.make('street'),
    TextColumn.make('city'),
])
    .alignment('center') // or alignStart(), alignCenter(), alignEnd()
    .wrapHeader()
    .hiddenFrom('md')
    .extraHeaderAttributes({ 'data-group': 'address' })
```

`wrapHeader()` lets a long label wrap, `visibleFrom()` and `hiddenFrom()` hide the group's header cell on some screen sizes (hide its columns too), and `extraHeaderAttributes()` adds HTML attributes to its `<th>`.

## Adding extra HTML attributes

Three methods add HTML attributes to a column:

- `extraAttributes()`: the element holding the column's content (`.nv-ta-text`, `.nv-ta-icon`...),
- `extraCellAttributes()`: each `<td>` cell,
- `extraHeaderAttributes()`: the `<th>` header cell.

They take an object; `extraAttributes()` and `extraCellAttributes()` also accept a function of the record. Classes and styles are added to the column's own; pass `true` as the second argument to merge with the attributes of an earlier call instead of replacing them:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('status')
    .extraAttributes((record) => ({ 'data-status': record.status }))
    .extraCellAttributes({ class: 'whitespace-nowrap' })
    .extraHeaderAttributes({ style: 'min-width: 8rem' })
```

<Aside variant="info">
Navette escapes the values and checks the names: a value computed from a record cannot break out of its attribute, and event handler attributes (`onclick`...) are dropped. Alpine attributes (`x-tooltip`, `x-on:click`...) are kept: never build them from user input.
</Aside>

## Hiding columns

`hidden()` and `visible()` remove a column from the table: its header, its cells, its search and its sort, and the column manager. They accept a boolean or a function, evaluated each time the table is rendered:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('salary')
    .visible(() => currentUser()?.role === 'admin')
```

The function receives no record: a column is shown or hidden for the whole table. Read the current user from your own request context, for example an `AsyncLocalStorage` filled by a middleware.

<Aside variant="warning">
Hiding a column is a display choice. A hidden column cannot be sorted or searched, but the record data is still loaded: restrict sensitive data in your [data adapter](/advanced/data-adapters) or your [policies](/resources/overview#authorization).
</Aside>

### Hiding columns responsively

If you would like to hide a column on some screen sizes, use `visibleFrom()` or `hiddenFrom()` with a breakpoint (`sm`, `md`, `lg`, `xl` or `2xl`):

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('slug')
    .visibleFrom('md')

TextColumn.make('excerpt')
    .hiddenFrom('xl')
```

The column is only hidden with CSS: its data is still sent to the browser.

## Setting a column's width

By default, columns take up as much space as they need. You may set a width with `width()`, a CSS length or a number of pixels, or let a column take the remaining space with `grow()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .width('1%')

TextColumn.make('description')
    .grow()
```

`wrapHeader()` lets a long label wrap onto several lines in the header.

### Allowing users to manage columns

Users may hide or show columns themselves. To make a column toggleable, use the `toggleable()` method:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('email')
    .toggleable()
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('email').toggleable(),
    ])
```

A column manager button appears in the toolbar of the table, with a checkbox for each toggleable column. Only toggleable columns can be hidden, whatever the browser sends.

#### Making toggleable columns hidden by default

By default, toggleable columns are visible. To make them hidden instead, use the `isToggledHiddenByDefault` option:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('id')
    .toggleable(true, { isToggledHiddenByDefault: true })
```

The column manager's state is kept in the user's session, so the hidden columns are restored when the user comes back. The table can also let users [reorder the columns, apply changes at once, or open the manager in a modal](/tables/overview#column-manager).

## Accessing the record in column functions

Navette passes values to the functions you give to columns in two ways:

- `getStateUsing()` receives an object, `({ record })`, and `formatStateUsing()` receives `({ state, record })`.
- Functions that configure the display of a single record (`color()`, `icon()`, `url()`, `tooltip()`, `alt()`, `money()`, `disabled()`) receive the record itself.

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('status')
    .badge()
    .formatStateUsing(({ state }) => STATUSES[String(state)]?.label ?? String(state))
    .color((record) => STATUSES[record.status]?.color ?? 'gray')
```

```preview
// records: [{"number": "ORD-1042", "status": "new"}, {"number": "ORD-1043", "status": "processing"}, {"number": "ORD-1044", "status": "shipped"}, {"number": "ORD-1045", "status": "cancelled"}]
const STATUSES = {
    new: { label: 'New', color: 'info' },
    processing: { label: 'Processing', color: 'warning' },
    shipped: { label: 'Shipped', color: 'success' },
    cancelled: { label: 'Cancelled', color: 'danger' },
};

return new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('status')
            .badge()
            .formatStateUsing(({ state }) => STATUSES[String(state)]?.label ?? String(state))
            .color((record) => STATUSES[record.status]?.color ?? 'gray'),
    ])
```

The record is the object returned by the data adapter: with `ObjectionAdapter`, a model instance, including any computed column of the query.

### Using the row loop

The `rowLoop` of the state functions describes the row being rendered: `getStateUsing()` receives `({ record, rowLoop })`, and a function given to `state()` receives `(record, { rowLoop })`. Its properties are `index` (from 0), `iteration` (from 1), `count`, `remaining`, `first`, `last`, `odd` and `even`. For example, to number the rows of the page:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('number')
    .label('#')
    .state((record, { rowLoop }) => rowLoop?.iteration ?? null)
```

In any other column function, call `getRowLoop()` from `@navette-js/tables`. Both are `null` outside a table row (in an export, for example).

## Global settings

If you wish to change the default behavior of all columns of a type, call its static `configureUsing()` method when your application starts. The function runs for each column of that type created afterwards:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.configureUsing((column) => {
    column.toggleable();
});
```

You can still override this behavior on each column:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('name')
    .toggleable(false)
```
