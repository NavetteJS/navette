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

`iconPosition('after')` puts the icon after the text, and `iconColor()` gives it a color:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<User>('email')
    .icon(() => 'm-envelope')
    .iconPosition('after')
    .iconColor('primary')
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

<Aside variant="info">
`BadgeColumn` is deprecated: `BadgeColumn.make('status')` is the same as `TextColumn.make('status').badge()`. Likewise, `BooleanColumn` is `IconColumn.make(name).boolean()`.
</Aside>

You may add other things to the badge, like an [icon](#adding-an-icon), and a label instead of the raw value with [`formatStateUsing()`](#formatting). When the attribute is cast to an [enum](/advanced/enums#casting-model-attributes-to-an-enum) on the model, or with `enum()`, the label, color and icon of each value come from the enum instead:

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

`date()`, `dateTime()` and `time()` accept a format, written with PHP date characters: `d`, `j`, `D`, `l`, `S`, `m`, `n`, `M`, `F`, `Y`, `y`, `H`, `G`, `h`, `g`, `i`, `s`, `a`, `A` and `T`. Escape a letter with a backslash to print it as it is:

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

If you do not pass a `timezone()` to the column, it uses Navette's default time zone, `UTC` unless you set another one with `NavetteTimezone.set()`, once, when your app starts (for example in `server.ts`, before the panels are built):

```ts
import { NavetteTimezone } from '@navette-js/support';

NavetteTimezone.set('America/New_York');
```

`NavetteTimezone.set()` also accepts a function, called each time a component needs the time zone, so the default may depend on the signed-in user (read from your own request context): `NavetteTimezone.set(() => currentUser()?.timezone ?? null)`. A function returning `null` falls back to `UTC`, and `NavetteTimezone.get()` returns the time zone in effect. The default applies to `DateTimePicker` fields with a time, `TextColumn` and `TextEntry` date formatting; date-only values (`DatePicker`, the date constraints of the query builder, date filters) are never converted, since a date alone has no instant.

#### Displaying a relative date

`since()` displays how long ago the date was, such as `2 days ago` (`il y a 2 jours` with `setLocale('fr')`):

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .since()
```

#### Displaying the date in a tooltip

`dateTooltip()`, `dateTimeTooltip()`, `timeTooltip()` and `sinceTooltip()` show the date in a tooltip, for example the exact date next to a relative one. They take the same format and time zone arguments as `date()`, `dateTime()` and `time()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('created_at')
    .since()
    .dateTimeTooltip()
```

An empty state has no tooltip.

#### Using Carbon's `isoFormat()` formats

`isoDate()`, `isoDateTime()` and `isoTime()` format the date like Carbon's `isoFormat()` (Moment.js tokens): `L` (`11/09/2026`), `LLL` (`November 9, 2026 2:30 PM`) and `LT` (`2:30 PM`) by default, or any format such as `dddd D MMMM YYYY` or `HH:mm [h]` (text in brackets is kept as is). `isoDateTooltip()`, `isoDateTimeTooltip()` and `isoTimeTooltip()` do the same in a tooltip:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('published_at')
    .isoDate('Do MMMM YYYY')
    .isoDateTimeTooltip(null, 'Europe/Paris')
```

The macro formats (`LT`, `LTS`, `L`, `LL`, `LLL`, `LLLL` and their lowercase forms) and the names of months and days are in English.

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

Numbers are formatted for the `en-US` locale (`1,234.5`) by default. The other arguments of `numeric(decimalPlaces, decimalSeparator, thousandsSeparator, maxDecimalPlaces, locale)` set fixed separators, a maximum number of decimals, or a locale. You may pass them in an object instead:

```ts
import { TextColumn } from '@navette-js/tables';

// 1 234,50 (French formatting)
TextColumn.make('amount')
    .numeric({ decimalPlaces: 2, locale: 'fr' })

// 1.234,5 (fixed separators)
TextColumn.make('amount')
    .numeric(1, ',', '.')

// At most two decimals: 3.14, 2.5, 7
TextColumn.make('ratio')
    .numeric({ maxDecimalPlaces: 2 })
```

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

The state is the amount itself (`19.99`). For an amount stored in cents, pass `divideBy`: `money('eur', 100)` shows `1999` as `€19.99`. The next arguments are the locale and the number of decimal places (`money(currency, divideBy, locale, decimalPlaces)`), or pass an object in place of `divideBy`:

```ts
import { TextColumn } from '@navette-js/tables';

// 1 999,00 € (French formatting of 199900 cents)
TextColumn.make('price_in_cents')
    .money('eur', 100, 'fr')

// $20 (no decimals)
TextColumn.make('price_in_cents')
    .money('usd', { divideBy: 100, decimalPlaces: 0 })
```

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

You may `limit()` the length of the cell's text (100 characters by default). Longer text is cut and followed by `...`, or by the text passed as second argument, such as `limit(50, ' (more)')`:

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

You may display the full text in a tooltip when it is cut. Pass a function that receives the record to `tooltip()`, and return `null` for no tooltip. `getCharacterLimit()` returns the limit set by `limit()` (`getWordLimit()` the one of `words()`), so you do not repeat it:

```ts
import { TextColumn } from '@navette-js/tables';

const title = TextColumn.make<Task>('title').limit(40);
title.tooltip((record) => (record.title.length > (title.getCharacterLimit() ?? Infinity) ? record.title : null));
```

`limit()` and `words()` do not apply to [HTML or Markdown](#rendering-html) states: cutting them could break their markup.

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

To copy something else than the displayed text, such as the raw value, use `copyableState()` with a string or a function of the record and the value. `copyMessage()` and `copyMessageDuration()` (in milliseconds, 2000 by default) customize the confirmation:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make<Order>('total')
    .money('usd')
    .copyable()
    .copyableState((record) => String(record.total))
    .copyMessage('Amount copied')
    .copyMessageDuration(1500)
```

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

`words()` truncates the text to a number of words (100 by default), like `limit()` does with characters. Its second argument replaces the `...` ending: `words(10, '…')`.

### Displaying the text inline

`inline()` renders the text without its block layout, so that it flows with the content around it, for example inside a [stacked layout](/tables/layout).

## Combining display options

Every option combines with the others: a badge can have an icon and a tooltip, a formatted date can be copyable, a description can sit below a list. `weight()`, `size()`, `fontFamily()`, `color()`, `icon()`, `iconColor()`, `tooltip()` and `copyable()` also accept a function of the record and of the value, to vary per value of a list:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('tags')
    .badge()
    .color((record, tag) => (tag === 'urgent' ? 'danger' : 'gray'))
```

## Rendering Markdown

If your column value is Markdown, you may render it using `markdown()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('description')
    .markdown()
```

Headings, paragraphs, lists, quotes, code, emphasis and links are rendered. HTML written in the Markdown is shown as text, and links only keep `http`, `https`, `mailto` and relative URLs.

## Rendering HTML

If your column value is HTML, you may render it using `html()`:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('description')
    .html()
```

The HTML is sanitized before it is rendered. Only formatting elements are kept: paragraphs, line breaks, emphasis, headings, lists, quotes, code, and links with safe URLs. Their `style`, `class` and event attributes are removed, as are scripts, images, frames and forms. `sanitizeHtml()` and `markdownToHtml()` from `@navette-js/support` do the same work if you need them elsewhere.

<Aside variant="warning">
Inline `style` attributes are removed too, since they allow CSS-based attacks such as `background: url(...)`. Navette always sanitizes, even for trusted content: to render your own markup as it is, use a [view column](/tables/columns/custom-columns) and escape the record data yourself.
</Aside>

Both `html()` and `markdown()` accept a function of the record and of the value, to render only some values as HTML. `limit()` and `words()` are not applied to an HTML or Markdown state.

<Aside variant="info">
Without `html()` or `markdown()`, the text is always escaped: a value containing `<b>` shows those characters.
</Aside>

### Rendering rich content

When the record registers the column's attribute as [rich content](/forms/rich-editor#registering-rich-content-attributes) (`registerRichContent()` of `InteractsWithRichContent`), it is rendered automatically with that configuration: merge tags replaced, custom blocks rendered, attachment URLs computed, then sanitized like any HTML state. No option is needed:

```ts
import { TextColumn } from '@navette-js/tables';

TextColumn.make('content')
```

A column with its own `state()` is not affected.

