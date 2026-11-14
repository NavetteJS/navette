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
    .getStateUsing(({ record }) => record.department_name ?? null)
    .placeholder('No department')
```

```preview
// records: [{"name": "Ada Lovelace", "department_name": "Engineering"}, {"name": "Grace Hopper", "department_name": null}, {"name": "Alan Turing", "department_name": "Research"}]
new Table()
    .pluralModelLabel('employees')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('department.name')
            .getStateUsing(({ record }) => record.department_name ?? null)
            .placeholder('No department'),
    ])
```

### Displaying data from relationships

A column does not load relationships. A dot in a column name has no special meaning for the state: `TextColumn.make('author.name')` reads `record['author.name']`. To display data from a related record, add it to the list query of the data adapter, preferably as a subquery so that each record stays a single row and pagination stays exact:

```ts
import { ObjectionAdapter } from '@navette-js/database';

static adapter = new ObjectionAdapter(Post, {
    modify: (query) => {
        query.select(
            'posts.*',
            Post.knex()('authors').select('authors.name').whereRaw('authors.id = posts.author_id').as('author_name'),
        );
    },
});
```

Then read the computed column from the record. Keeping the relationship in the column's name gives it a meaningful default label ("Author"), and the `column` options make it [sortable](#sorting) and [searchable](#searching):

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Post>('author.name')
    .getStateUsing(({ record }) => record.author_name ?? null)
    .searchable({ column: 'author_name' })
    .sortable({ column: 'author_name' })
```

```preview
// records: [{"title": "Introducing Navette", "author_name": "Ada Lovelace"}, {"title": "Building your first panel", "author_name": "Grace Hopper"}, {"title": "Ten tips for faster tables", "author_name": "Alan Turing"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('author.name')
            .getStateUsing(({ record }) => record.author_name ?? null)
            .searchable({ column: 'author_name' })
            .sortable({ column: 'author_name' }),
    ])
```

#### Counting relationships

To count related records, add a counting subquery in the same way:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { TextColumn } from '@navette-js/tables';

static adapter = new ObjectionAdapter(Order, {
    modify: (query) => {
        query.select(
            'orders.*',
            Order.knex()('order_items').count('*').whereRaw('order_items.order_id = orders.id').as('items_count'),
        );
    },
});

// In `table()`:
TextColumn.make<Order>('items_count')
    .label('Items')
    .numeric()
    .sortable()
```

<Aside variant="info">
The `modify` function of the adapter applies to every query of the resource, including the queries of record pages and actions. Computed columns are read-only: if the model writes all of its attributes, remove them before saving, for example in `$formatDatabaseJson()`.
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

By default, the table is sorted by the column of the query that has the column's name. If the state of the column comes from another column of the query, such as a [computed column](#displaying-data-from-relationships), pass it with the `column` option:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Post>('author.name')
    .getStateUsing(({ record }) => record.author_name ?? null)
    .sortable({ column: 'author_name' })
```

When the sort column evolves in the opposite direction of the displayed value, set `inverted: true`. For example, an age computed from a birth date is sorted by the date, in reverse:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Employee>('age')
    .getStateUsing(({ record }) => ageOf(record.birth_date))
    .sortable({ column: 'birth_date', inverted: true })
```

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

The search term is split into words. Each word must appear, ignoring case, in at least one of the searchable columns. The search field is only displayed when at least one column is searchable.

### Searching a different column

By default, the column of the query that has the column's name is searched. To search a [computed column](#displaying-data-from-relationships) instead, pass it with the `column` option:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('customer.name')
    .getStateUsing(({ record }) => record.customer_name ?? null)
    .searchable({ column: 'customer_name' })
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

Each word of an individual search must appear in that column.

<Aside variant="warning">
Individual searches query the column of the query that has the column's name: the `column` option only applies to the global search.
</Aside>

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

The cells get Filament's `fi-vertical-align-*` class.

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

The first argument is the label of the group, and `columns()` takes the columns inside it; like in Filament, they may also be passed as the second argument of `make()`: `ColumnGroup.make('Details', [...])`. A header row is added above the column headers, with one cell spanning each group.

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

- `extraAttributes()`: the element holding the column's content (`.fi-ta-text`, `.fi-ta-icon`...),
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
Unlike Filament, Navette escapes the values and checks the names: a value computed from a record cannot break out of its attribute, and event handler attributes (`onclick`...) are dropped. Alpine attributes (`x-tooltip`, `x-on:click`...) are kept: never build them from user input.
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

<Aside variant="info">
The column manager's state is part of the page's state: it is kept while the user stays on the page, but is not persisted in the session yet.
</Aside>

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
