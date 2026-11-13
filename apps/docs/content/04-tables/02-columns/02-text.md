---
title: Text column
---

## Introduction

Text columns display simple text:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('title')
```

```preview
// records: [{"title": "Introducing Navette"}, {"title": "Building your first panel"}, {"title": "Ten tips for faster tables"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
    ])
```

The state is converted to a string and escaped. See the [columns overview](/tables/columns/overview#column-content-state) to change which value is displayed.

## Customizing the color

You may set a [color](/styling/colors) for the text:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('email')
    .color('gray')
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('email').color('gray'),
    ])
```

You may also pass a function, which receives the record and returns the color:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Task>('due_date')
    .color((record) => (record.is_late ? 'danger' : 'gray'))
```

```preview
// records: [{"title": "Prepare the release notes", "due_date": "2025-03-03", "is_late": true}, {"title": "Review the pull requests", "due_date": "2025-03-12", "is_late": false}, {"title": "Update the screenshots", "due_date": "2025-03-01", "is_late": true}]
new Table()
    .pluralModelLabel('tasks')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('due_date')
            .color((record) => (record.is_late ? 'danger' : 'gray')),
    ])
```

## Adding an icon

Text columns may also have an [icon](/styling/icons), displayed before the text. Pass a function that receives the record and returns the icon name, or `null` for no icon:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<User>('email')
    .icon(() => 'm-envelope')
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('email')
            .icon(() => 'm-envelope'),
    ])
```

## Displaying as a "badge"

By default, text is quite plain and has no background color. You can make it appear as a "badge" instead using the `badge()` method. A great use case for this is with statuses, where you may want to display a badge with a color that matches the status:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('status')
    .badge()
    .color((record) => ({
        new: 'info',
        processing: 'warning',
        shipped: 'success',
        cancelled: 'danger',
    })[record.status] ?? 'gray')
```

```preview
// records: [{"number": "ORD-1042", "status": "new"}, {"number": "ORD-1043", "status": "processing"}, {"number": "ORD-1044", "status": "shipped"}, {"number": "ORD-1045", "status": "cancelled"}]
new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('status')
            .badge()
            .color((record) => ({
                new: 'info',
                processing: 'warning',
                shipped: 'success',
                cancelled: 'danger',
            })[record.status] ?? 'gray'),
    ])
```

Without `color()`, a badge uses the `primary` color.

You may add other things to the badge, like an [icon](#adding-an-icon), and a label instead of the raw value with [`formatStateUsing()`](#formatting):

```ts
import { TextColumn } from '@navette-js/tables';

const STATUSES: Record<string, { label: string; color: string; icon: string }> = {
    new: { label: 'New', color: 'info', icon: 'c-sparkles' },
    processing: { label: 'Processing', color: 'warning', icon: 'c-arrow-path' },
    shipped: { label: 'Shipped', color: 'success', icon: 'c-truck' },
};

TextColumn.make<Order>('status')
    .badge()
    .formatStateUsing(({ record }) => STATUSES[record.status]?.label ?? record.status)
    .color((record) => STATUSES[record.status]?.color ?? 'gray')
    .icon((record) => STATUSES[record.status]?.icon ?? null)
```

```preview
// records: [{"number": "ORD-1042", "status": "new"}, {"number": "ORD-1043", "status": "processing"}, {"number": "ORD-1044", "status": "shipped"}]
const STATUSES = {
    new: { label: 'New', color: 'info', icon: 'c-sparkles' },
    processing: { label: 'Processing', color: 'warning', icon: 'c-arrow-path' },
    shipped: { label: 'Shipped', color: 'success', icon: 'c-truck' },
};

return new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('status')
            .badge()
            .formatStateUsing(({ record }) => STATUSES[record.status]?.label ?? record.status)
            .color((record) => STATUSES[record.status]?.color ?? 'gray')
            .icon((record) => STATUSES[record.status]?.icon ?? null),
    ])
```

## Formatting

You may format the state of a column by passing a function to `formatStateUsing()`. It receives an object with the `state` and the `record`, and returns the text to display:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('status')
    .formatStateUsing(({ state }) => String(state).toUpperCase())
```

```preview
// records: [{"number": "ORD-1042", "status": "new"}, {"number": "ORD-1043", "status": "processing"}, {"number": "ORD-1044", "status": "shipped"}]
new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('status')
            .formatStateUsing(({ state }) => String(state).toUpperCase()),
    ])
```

The returned text is escaped.

### Date formatting

You may use the `date()` and `dateTime()` methods to format the column's state:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .dateTime()
```

```preview
// records: [{"number": "ORD-1042", "created_at": "2026-11-09 14:30:00"}, {"number": "ORD-1043", "created_at": "2026-11-10 09:12:45"}, {"number": "ORD-1044", "created_at": "2026-11-11 17:05:10"}]
new Table()
    .pluralModelLabel('orders')
    .columns([
        TextColumn.make('number'),
        TextColumn.make('created_at').dateTime(),
    ])
```

`date()` displays `Nov 9, 2026`, and `dateTime()` displays `Nov 9, 2026 14:30:00`. The state must be a date string such as `2026-11-09` or `2026-11-09 14:30:00`, which is how SQLite returns dates, or a `Date`. A string without a time zone is read as UTC.

#### Customizing the date format

`date()`, `dateTime()` and `time()` accept a format, written with the PHP date characters that Filament uses: `d`, `j`, `D`, `l`, `S`, `m`, `n`, `M`, `F`, `Y`, `y`, `H`, `G`, `h`, `g`, `i`, `s`, `a`, `A` and `T`. Escape a letter with a backslash to print it as it is:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .dateTime('d/m/Y H:i')
```

#### Displaying dates in a time zone

The second argument of `date()`, `dateTime()` and `time()`, or `timezone()`, displays the date in an IANA time zone:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .dateTime('M j, Y H:i', 'Europe/Paris')
```

#### Displaying a relative date

`since()` displays how long ago the date was, such as `2 days ago`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .since()
```

### Number formatting

The `numeric()` method allows you to format a number with thousands separators:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('stock')
    .numeric()
```

```preview
// records: [{"name": "Wireless keyboard", "stock": 1250}, {"name": "USB-C hub", "stock": 48}, {"name": "27-inch monitor", "stock": 12034}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('stock').numeric(),
    ])
```

Pass a number of decimal places to always display exactly that many:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('hours')
    .numeric(1)
```

Numbers are formatted for the `en-US` locale (`1,234.5`).

### Money formatting

The `money()` method allows you to format monetary values in any currency. Pass an ISO 4217 currency code, `usd` by default:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('price')
    .money('eur')
```

```preview
// records: [{"name": "Wireless keyboard", "price": 79}, {"name": "USB-C hub", "price": 39.9}, {"name": "27-inch monitor", "price": 1249.99}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('price').money('eur'),
    ])
```

The currency may also come from the record:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Payment>('amount')
    .money((record) => record.currency)
```

The state is the amount itself (`19.99`), not an amount in cents.

## Customizing the font weight

Text columns have regular font weight by default, but you may change this to any of the font weights of the theme, such as `thin`, `light`, `medium`, `semibold`, `bold` or `black`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('title')
    .weight('medium')
```

```preview
// records: [{"title": "Introducing Navette", "slug": "introducing-navette"}, {"title": "Building your first panel", "slug": "building-your-first-panel"}, {"title": "Ten tips for faster tables", "slug": "ten-tips-for-faster-tables"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title').weight('medium'),
        TextColumn.make('slug'),
    ])
```

## Handling long text

### Limiting text length

You may `limit()` the length of the cell's text. Longer text is cut and followed by `...`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('description')
    .limit(50)
```

```preview
// records: [{"name": "Wireless keyboard", "description": "A compact wireless keyboard with a rechargeable battery that lasts for months."}, {"name": "USB-C hub", "description": "Seven ports in one small aluminium case: HDMI, USB-A, SD card and Ethernet."}]
new Table()
    .pluralModelLabel('products')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('description').limit(50),
    ])
```

### Adding a tooltip

You may display the full text in a tooltip when it is cut. Pass a function that receives the record to `tooltip()`, and return `null` for no tooltip:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Task>('title')
    .limit(40)
    .tooltip((record) => (record.title.length > 40 ? record.title : null))
```

A tooltip may also be a fixed string. Tooltip content is displayed as text, never as HTML.

## Allowing the text to be copied to the clipboard

You may make the text copyable, such that clicking on the cell copies the text to the clipboard:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('email')
    .copyable()
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com"}, {"name": "Grace Hopper", "email": "grace@example.com"}, {"name": "Alan Turing", "email": "alan@example.com"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        TextColumn.make('name'),
        TextColumn.make('email').copyable(),
    ])
```

The copied text is the displayed text, for example the formatted amount of a `money()` column. A "Copied!" tooltip confirms the copy.

<Aside variant="warning">
This feature only works when SSL is enabled for the app, because browsers only expose the clipboard API in secure contexts (or on `localhost`).
</Aside>

## Displaying a description

`description()` adds a line of secondary text below the value, or above it with `'above'`. It accepts a string or a function of the record:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('title')
    .description((record) => record.excerpt)
```

```preview
// records: [{"title": "Introducing Navette", "excerpt": "Admin panels for Node.js"}, {"title": "Building your first panel", "excerpt": "From install to the first resource"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title').description((record) => record.excerpt),
    ])
```

## Listing multiple values

When the state is an array, its values are joined with commas. A string can be split into values with `separator()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('tags')
    .separator(',')
```

`listWithLineBreaks()` displays one value per line, and `bulleted()` adds bullets:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('authors')
    .listWithLineBreaks()
    .bulleted()
```

`limitList()` shows the first values only, followed by "and 3 more". With `true` as second argument, or with `expandableLimitedList()`, a link reveals the other values:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('authors')
    .listWithLineBreaks()
    .limitList(2, true)
```

Combined with `badge()`, each value gets its own badge.

## Customizing the text

### Setting the size

`size()` accepts `xs`, `sm` (the default), `md` and `lg`.

### Setting the font family

`fontFamily()` accepts `sans`, `serif` and `mono`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('sku')
    .fontFamily('mono')
```

### Wrapping long text

By default, long text stays on one line. `wrap()` lets it wrap, and `lineClamp()` limits it to a number of lines:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('description')
    .wrap()
    .lineClamp(2)
```

### Adding a prefix or a suffix

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('weight')
    .suffix(' kg')
```

### Limiting the number of words

`words()` truncates the text to a number of words, like `limit()` does with characters.

## Combining display options

Every option combines with the others: a badge can have an icon and a tooltip, a formatted date can be copyable, a description can sit below a list. `weight()`, `size()`, `fontFamily()`, `color()`, `icon()`, `iconColor()`, `tooltip()` and `copyable()` also accept a function of the record and of the value, to vary per value of a list:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('tags')
    .badge()
    .color((record, tag) => (tag === 'urgent' ? 'danger' : 'gray'))
```

<Aside variant="warning">
Markdown and HTML rendering are not available yet: the text is always escaped.
</Aside>
