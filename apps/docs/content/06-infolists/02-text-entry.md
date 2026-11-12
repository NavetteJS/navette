---
title: Text entry
---

## Introduction

Text entries display simple text:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
```

```preview
// record: {"title": "Introducing Navette"}
TextEntry.make('title')
```

The text is escaped when it is rendered.

## Displaying as a "badge"

By default, text is quite plain and has no background color. You can make it appear as a "badge" instead using the `badge()` method. A great use case for this is with statuses, where you may want to display a badge with a color that matches the status:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('status')
    .badge()
    .color((record) => ({
        draft: 'gray',
        reviewing: 'warning',
        published: 'success',
        rejected: 'danger',
    })[(record as Post).status] ?? 'gray')
```

```preview
// record: {"status": "reviewing"}
TextEntry.make('status')
    .badge()
    .color((record) => ({
        draft: 'gray',
        reviewing: 'warning',
        published: 'success',
        rejected: 'danger',
    })[record.status] ?? 'gray')
```

Optionally, you may pass a boolean value to control if the text should be in a badge or not.

### Customizing the badge color

Badges use the `primary` color by default. You may pass another color to the `color()` method, or a function that receives the **record** and returns the color, as in the example above:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('employment_type')
    .badge()
    .color('info')
```

```preview
// record: {"employment_type": "Full-time"}
TextEntry.make('employment_type')
    .badge()
    .color('info')
```

### Adding an icon to the badge

Badges may also have an icon. The `icon()` method accepts a function that receives the record and returns a [Heroicons name](/schemas/primes#icon-component), or `null` for no icon:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('status')
    .badge()
    .icon((record) => ((record as Expense).status === 'approved' ? 'c-check-circle' : null))
```

```preview
// record: {"status": "approved"}
TextEntry.make('status')
    .badge()
    .icon((record) => (record.status === 'approved' ? 'c-check-circle' : null))
```

<Aside variant="warning">
In Navette, `color()` and `icon()` only apply to badges: they have no effect on plain text yet. `iconPosition()` and `iconColor()` are not available.
</Aside>

## Formatting

When using a text entry, you may want the actual outputted text in the UI to differ from the raw [state](/infolists/overview#entry-content-state) of the entry, which is often automatically retrieved from the record. Formatting the state allows you to preserve the integrity of the raw data while also allowing it to be presented in a more user-friendly way.

To format the state of a text entry without changing the state itself, you can use the `formatStateUsing()` method. This method accepts a function that receives an object with the raw `state` and the `record`, and returns the formatted text:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('status')
    .formatStateUsing(({ state }) => STATUSES[String(state)]?.label ?? String(state))
```

```preview
// record: {"status": "published"}
TextEntry.make('status')
    .formatStateUsing(({ state }) => ({ draft: 'Draft', published: 'Published' })[String(state)] ?? String(state))
```

In this case, the `status` column in the database might contain values like `draft` or `published`, but the formatted state will be their labels. The formatted text is escaped: returning HTML from `formatStateUsing()` displays the tags as text.

`formatStateUsing()` receives the raw state, and its result replaces the result of [date](#date-formatting), [number](#number-formatting) and [money](#money-formatting) formatting.

### Date formatting

Instead of passing a function to `formatStateUsing()`, you may use the `date()`, `dateTime()`, and `time()` methods to format the entry's state:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('hire_date')
    .date() // Mar 5, 2024

TextEntry.make('approved_at')
    .dateTime() // Mar 5, 2024 10:11:12

TextEntry.make('start_time')
    .time() // 10:11:12

TextEntry.make('start_time')
    .time('H:i') // 10:11
```

```preview
// record: {"hire_date": "2024-03-05", "approved_at": "2024-03-05 10:11:12", "start_time": "10:11:12"}
// viewport: 1100
Grid.make(4).schema([
    TextEntry.make('hire_date').date(),
    TextEntry.make('approved_at').dateTime(),
    TextEntry.make('start_time').time(),
    TextEntry.make('start_time').label('Start time (H:i)').time('H:i'),
])
```

The state should be a string in the `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` format, as stored by SQL databases (an ISO 8601 string also works). The date and time are displayed as stored, without any timezone conversion.

<Aside variant="warning">
Custom date formats, `since()`, the `iso…()` methods, date tooltips and timezones are not available in Navette yet. `time()` only accepts `'H:i:s'` (the default) and `'H:i'`. A JavaScript `Date` object is not supported as state: convert it to a string first, or use `formatStateUsing()`.
</Aside>

For a relative date, compute it yourself with `state()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('updated_at')
    .label('Last modified at')
    .state(({ record }) => diffForHumans((record as Brand).updated_at))
```

### Number formatting

Instead of passing a function to `formatStateUsing()`, you can use the `numeric()` method to format an entry as a number, with thousands separators. The number is also aligned like a number:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('stock')
    .numeric() // 1,234,567
```

```preview
// record: {"stock": 1234567}
TextEntry.make('stock')
    .numeric()
```

### Money formatting

Instead of passing a function to `formatStateUsing()`, you can use the `money()` method to easily format amounts of money, in any currency. The default currency is `usd`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('price')
    .money('eur') // €1,234.50
```

```preview
// record: {"price": 1234.5}
TextEntry.make('price')
    .money('eur')
```

The state is the amount in the main unit of the currency, not in cents.

<Aside variant="warning">
Numbers and amounts are formatted with the `en-US` locale. The `locale`, `decimalPlaces` and `divideBy` arguments are not available in Navette yet: use `formatStateUsing()` for other formats.
</Aside>

### Adding a suffix

You may add a suffix after the formatted text using the `suffix()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('days_requested')
    .formatStateUsing(({ state }) => Number(state).toFixed(1))
    .suffix(' days')
```

```preview
// record: {"days_requested": 3}
TextEntry.make('days_requested')
    .formatStateUsing(({ state }) => Number(state).toFixed(1))
    .suffix(' days')
```

### Rendering rich text

If your entry value is rich text, such as the HTML saved by a [rich editor](/forms/rich-editor), you may render it using `markdown()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .markdown()
    .placeholder('No description')
```

```preview
// record: {"description": "Navette is a port of Filament to Node.js.\n\nIt renders the same views as Filament, translated to TypeScript, with the same CSS."}
TextEntry.make('description')
    .markdown()
    .placeholder('No description')
```

If the value contains HTML tags, the HTML is rendered after it has been sanitized. Inside a panel, the sanitizer only keeps the tags supported by the rich editor, and removes everything else, such as scripts and event handler attributes. If the value has no HTML tags, it is escaped, and its blank lines separate paragraphs.

You may also apply typographic styles to the content with `prose()`. It only has an effect with `markdown()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('content')
    .markdown()
    .prose()
```

```preview
// record: {"content": "Install the packages, then register a panel in your Express application.\n\nEach resource of the panel describes a form, a table and, optionally, an infolist."}
TextEntry.make('content')
    .markdown()
    .prose()
```

<Aside variant="warning">
Navette's `markdown()` does not convert Markdown syntax yet: `**bold**` is displayed as typed. `html()` is not available: use `markdown()`, which renders sanitized HTML. Outside a panel, no sanitizer is configured and HTML is escaped, unless you set one with `useHtmlSanitizer()` from `@navette-js/infolists`.
</Aside>

<Aside variant="danger">
If you set your own sanitizer with `useHtmlSanitizer()`, it must remove every unsafe element and attribute: its output is inserted in the page as is.
</Aside>

## Listing multiple values

If the state of a badge text entry is an array, each value is displayed as its own badge. This can happen if the record has an array attribute, or if you have passed an array from the [`state()` method](/infolists/overview#setting-the-state-of-an-entry):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('tags')
    .badge()
```

```preview
// record: {"tags": ["Laravel", "Node.js", "TypeScript"]}
TextEntry.make('tags')
    .badge()
```

All the badges share the same color, computed from the record.

<Aside variant="warning">
Without `badge()`, the values of an array are joined with commas and no space. `listWithLineBreaks()`, `bulleted()`, `limitList()` and `separator()` are not available in Navette yet: join the values yourself in `formatStateUsing()`.
</Aside>

## Allowing the text to be copied to the clipboard

You may make the text copyable, such that clicking on the entry copies the displayed text (after formatting) to the clipboard:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('expense_number')
    .copyable()
```

```preview
// record: {"expense_number": "EXP-2025-0042"}
TextEntry.make('expense_number')
    .copyable()
```

Optionally, you may pass a boolean value to control if the text should be copyable or not.

<Aside variant="warning">
Browsers only allow copying to the clipboard on secure origins, so this feature only works when the panel is served over HTTPS (or on `localhost`). `copyMessage()` and `copyMessageDuration()` are not available on text entries yet.
</Aside>

<Aside variant="warning">
Customizing the text size, font weight and font family, limiting the length of the text (`limit()`, `words()`, `lineClamp()`), preventing wrapping, `prefix()`, and prefix or suffix actions are not available on text entries in Navette yet. For styled stand-alone text, use the [`Text` prime component](/schemas/primes#text-component).
</Aside>
