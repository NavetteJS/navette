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

## Customizing the color

You may set a color for the text, such as `primary`, `success`, `warning`, `danger`, `info` or `gray`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('status')
    .color('primary')
```

```preview
// record: {"status": "Published"}
TextEntry.make('status')
    .color('primary')
```

You may also pass a function, which receives the **record** and the **state**, and returns the color or `null`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('balance')
    .color((record, state) => (Number(state) < 0 ? 'danger' : null))
```

The shade of the color is chosen to keep enough contrast with the background, in the light and dark themes.

## Adding an icon

Text entries may also have an icon, a [Heroicons name](/schemas/primes#icon-component):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('email')
    .icon('o-envelope')
```

```preview
// record: {"email": "ada@example.com"}
TextEntry.make('email')
    .icon('o-envelope')
```

The `icon()` method also accepts a function, which receives the record and the state, and returns a name or `null` for no icon.

You may set the position of an icon using `iconPosition()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('email')
    .icon('o-envelope')
    .iconPosition('after') // `'before'` or `'after'`
```

The icon is gray by default, but you may customize the icon color separately using `iconColor()`. It also accepts a function of the record and the state:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('email')
    .icon('o-envelope')
    .iconColor('primary')
```

```preview
// record: {"email": "ada@example.com"}
TextEntry.make('email')
    .icon('o-envelope')
    .iconColor('primary')
```

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

Badges use the `primary` color by default. Optionally, you may pass a boolean value to control if the text should be in a badge or not.

You may add other things to the badge, like an [icon](#adding-an-icon):

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

When the attribute is cast to an [enum](/advanced/enums#casting-model-attributes-to-an-enum) on the model, or with `enum()`, the label, color and icon of each value come from the enum.

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

In this case, the `status` column in the database might contain values like `draft` or `published`, but the formatted state will be their labels. The formatted text is escaped: returning HTML from `formatStateUsing()` displays the tags as text, unless you return an [`HtmlString`](#rendering-html).

`formatStateUsing()` receives the raw state, and its result replaces the result of [date](#date-formatting), [number](#number-formatting) and [money](#money-formatting) formatting.

### Date formatting

Instead of passing a function to `formatStateUsing()`, you may use the `date()`, `dateTime()`, and `time()` methods to format the entry's state using [PHP date formatting tokens](https://www.php.net/manual/en/datetime.format.php):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('hire_date')
    .date() // Mar 5, 2024

TextEntry.make('approved_at')
    .dateTime() // Mar 5, 2024 10:11:12

TextEntry.make('start_time')
    .time() // 10:11:12
```

```preview
// record: {"hire_date": "2024-03-05", "approved_at": "2024-03-05 10:11:12", "start_time": "10:11:12"}
// viewport: 1100
Grid.make(3).schema([
    TextEntry.make('hire_date').date(),
    TextEntry.make('approved_at').dateTime(),
    TextEntry.make('start_time').time(),
])
```

You may customize the date format by passing a custom format string:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('hire_date')
    .date('d/m/Y') // 05/03/2024

TextEntry.make('approved_at')
    .dateTime('l jS \\o\\f F Y, H:i') // Tuesday 5th of March 2024, 10:11

TextEntry.make('start_time')
    .time('H:i') // 10:11
```

A backslash escapes a character of the format. Month and day names are in English.

The state may be a JavaScript `Date`, or a string in the `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` format, as stored by SQL databases (an ISO 8601 string also works). A string without a time zone is read as UTC, and a time alone (`HH:MM:SS`) is read as a time of the current day. A value that cannot be read as a date is displayed as is.

#### Date formatting using ISO formats

You may use the `isoDate()`, `isoDateTime()`, and `isoTime()` methods to format the entry's state using the macro formats and tokens of Carbon's [`isoFormat()`](https://carbon.nesbot.com/docs/#api-localization), such as `L`, `LLL` or `dddd D MMMM YYYY`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('hire_date')
    .isoDate() // 03/05/2024

TextEntry.make('approved_at')
    .isoDateTime() // March 5, 2024 10:11 AM

TextEntry.make('start_time')
    .isoTime() // 10:11 AM
```

You may customize the format by passing a custom format string. Text in `[brackets]` is kept as is:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('hire_date')
    .isoDate('dddd, Do [of] MMMM YYYY') // Tuesday, 5th of March 2024
```

The macro formats (`LT`, `LTS`, `L`, `LL`, `LLL`, `LLLL` and their lowercase variants) are those of the English locale.

#### Relative date formatting

You may use the `since()` method to format the entry's state using a relative time, such as "2 days ago" or "in 3 hours", in the current locale (`setLocale()`):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('created_at')
    .since()
```

#### Displaying a formatting date in a tooltip

Additionally, you can use the `dateTooltip()`, `dateTimeTooltip()`, `timeTooltip()`, `isoDateTooltip()`, `isoDateTimeTooltip()`, `isoTimeTooltip()` or `sinceTooltip()` method to display a formatted date in a [tooltip](/infolists/overview#adding-a-tooltip-to-an-entry), often to provide extra information:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('created_at')
    .since()
    .dateTooltip() // Accepts a custom PHP date format string, like `dateTooltip('d/m/Y')`
```

#### Setting the timezone for date formatting

Each of the date formatting methods listed above also accepts a `timezone` argument, which allows you to convert the time set in the state to a different [IANA time zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('created_at')
    .dateTime(null, 'Europe/Paris')
```

You can also pass a time zone to the `timezone()` method of the entry to apply it to all the date-time formatting methods:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('created_at')
    .timezone('Europe/Paris')
    .dateTime()
```

An unknown time zone is ignored, and UTC is used instead.

If you do not pass a `timezone()` to the entry, it uses Navette's default time zone, `UTC` unless you set another one with `NavetteTimezone.set()`, once, when your app starts (for example in `server.ts`, before the panels are built):

```ts
import { NavetteTimezone } from '@navette-js/support';

NavetteTimezone.set('America/New_York');
```

`NavetteTimezone.set()` also accepts a function, called each time a component needs the time zone, so the default may depend on the signed-in user (read from your own request context): `NavetteTimezone.set(() => currentUser()?.timezone ?? null)`. A function returning `null` falls back to `UTC`, and `NavetteTimezone.get()` returns the time zone in effect. The default applies to `DateTimePicker` fields with a time, `TextColumn` and `TextEntry` date formatting; date-only values (`DatePicker`, the date constraints of the query builder, date filters) are never converted, since a date alone has no instant.

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

If you would like to customize the number of decimal places used to format the number with, you can pass a number to `numeric()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('rating')
    .numeric(2) // 4.50
```

By default, numbers are formatted with the `en-US` locale. To use another locale, or other options, pass an object:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('rating')
    .numeric({ decimalPlaces: 2, locale: 'fr' }) // 4,50

TextEntry.make('ratio')
    .numeric({ maxDecimalPlaces: 4 }) // At most 4 decimal places

TextEntry.make('price')
    .numeric({ decimalPlaces: 2, decimalSeparator: ',', thousandsSeparator: '.' }) // 1.234,50
```

A state that is not a number is displayed as is.

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

There is also a `divideBy` argument for `money()` that allows you to divide the original value by a number before formatting it. This could be useful if your database stores the price in cents, for example:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('price')
    .money('eur', 100) // 123450 becomes €1,234.50
```

By default, the `en-US` locale is used to format the money. You may pass another locale as the third argument, and the number of decimal places as the fourth argument:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('price')
    .money('eur', 0, 'fr') // 1 234,50 €

TextEntry.make('price')
    .money('eur', 0, null, 0) // €1,235
```

You may also pass these options as an object: `money('eur', { divideBy: 100, locale: 'fr', decimalPlaces: 2 })`. The currency may be a function of the record, such as `money((record) => (record as Order).currency)`.

### Adding a prefix or suffix

You may add a prefix or suffix to the formatted text using the `prefix()` and `suffix()` methods:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('domain')
    .prefix('https://')
    .suffix('.com')
```

```preview
// record: {"domain": "navette"}
TextEntry.make('domain')
    .prefix('https://')
    .suffix('.com')
```

The prefix and suffix are escaped. An `HtmlString` from `@navette-js/support` (`raw()`) is inserted as is: only build it from values escaped with `e()`.

### Rendering Markdown

If your entry value is Markdown, you may render it using `markdown()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .markdown()
    .placeholder('No description')
```

```preview
// record: {"description": "Navette builds **admin panels** for Node.js.\n\n- Forms\n- Tables\n- Infolists"}
TextEntry.make('description')
    .markdown()
    .placeholder('No description')
```

Paragraphs, headings, lists, quotes, code, emphasis and links are converted, with typographic styles. Raw HTML inside the Markdown is displayed as text, and links only keep `http(s)`, `mailto` and relative URLs.

If the value starts with an HTML tag, such as the HTML saved by a [rich editor](/forms/rich-editor), it is rendered as HTML after it has been sanitized instead.

Optionally, you may pass a boolean value to control if the text should be rendered as Markdown or not.

### Rendering HTML

If your entry value is HTML, you may render it using `html()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .html()
```

```preview
// record: {"description": "<p>Navette is <strong>fast</strong>.</p><script>alert(1)</script>"}
TextEntry.make('description')
    .html()
```

The HTML is sanitized before it is rendered. Inside a panel, the sanitizer only keeps the tags supported by the rich editor. Outside a panel, `sanitizeHtml()` from `@navette-js/support` only keeps formatting elements (paragraphs, emphasis, lists, links with safe URLs…). Scripts, styles, images, event handler attributes and `style` attributes are removed. You may set another sanitizer with `useHtmlSanitizer()` from `@navette-js/infolists`.

To apply typographic styles to the HTML, such as rich editor content, use `prose()`, which also renders the state as sanitized HTML:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('content')
    .prose()
```

### Rendering rich content

When the record registers the entry's attribute as [rich content](/forms/rich-editor#registering-rich-content-attributes) (`registerRichContent()` of `InteractsWithRichContent`), it is rendered automatically with that configuration: merge tags replaced, custom blocks rendered, attachment URLs computed, then sanitized like any HTML state, and displayed as prose. No option is needed:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('content')
```

A entry with its own `state()` is not affected.

#### Rendering raw HTML without sanitization

If you'd like to opt out of sanitization, you can wrap the HTML in an `HtmlString` object by formatting it:

```ts
import { TextEntry } from '@navette-js/infolists';
import { e, raw } from '@navette-js/support';

TextEntry.make('code')
    .formatStateUsing(({ state }) => raw(`<kbd>${e(state)}</kbd>`))
```

<Aside variant="danger">
Be cautious when rendering raw HTML, as it may contain malicious content, which can lead to security vulnerabilities in your app such as cross-site scripting (XSS) attacks. Escape every value that comes from a user or from the database with `e()`. The same applies to a sanitizer set with `useHtmlSanitizer()`: it must remove every unsafe element and attribute, since its output is inserted in the page as is.
</Aside>

## Listing multiple values

Multiple values can be rendered in a text entry if its [state](/infolists/overview#entry-content-state) is an array. This can happen if the record has an array attribute, or if you have passed an array from the [`state()` method](/infolists/overview#setting-the-state-of-an-entry). If there are multiple values inside your text entry, they will be comma-separated. You may use the `listWithLineBreaks()` method to display them on new lines instead:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('authors')
    .listWithLineBreaks()
```

```preview
// record: {"authors": ["Ada Lovelace", "Grace Hopper", "Alan Turing"]}
// viewport: 1100
Grid.make(2).schema([
    TextEntry.make('authors').label('Comma-separated'),
    TextEntry.make('authors').label('With line breaks').listWithLineBreaks(),
])
```

Optionally, you may pass a boolean value to control if the text should have line breaks between each item or not.

If the entry is a badge, each value is displayed as its own badge. The color, the icon and the other options that accept a function are computed for each value, which the function receives as its state:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('tags')
    .badge()
    .color((record, state) => (state === 'urgent' ? 'danger' : 'gray'))
```

```preview
// record: {"tags": ["urgent", "backend", "review"]}
TextEntry.make('tags')
    .badge()
    .color((record, state) => (state === 'urgent' ? 'danger' : 'gray'))
```

### Adding bullet points to the list

You may add a bullet point to each list item using the `bulleted()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('authors')
    .bulleted()
```

```preview
// record: {"authors": ["Ada Lovelace", "Grace Hopper", "Alan Turing"]}
TextEntry.make('authors')
    .bulleted()
```

Optionally, you may pass a boolean value to control if the text should have bullet points or not.

### Limiting the number of values in the list

You can limit the number of values in the list using the `limitList()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('authors')
    .listWithLineBreaks()
    .limitList(3)
```

```preview
// record: {"authors": ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Margaret Hamilton"]}
TextEntry.make('authors')
    .listWithLineBreaks()
    .limitList(3)
```

#### Expanding the limited list

You can allow the limited items to be expanded and collapsed, using the `expandableLimitedList()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('authors')
    .listWithLineBreaks()
    .limitList(3)
    .expandableLimitedList()
```

<Aside variant="info">
This is only a feature for `listWithLineBreaks()` or `bulleted()`, where each item is on its own line.
</Aside>

Optionally, you may pass a boolean value to control if the text should be expandable or not.

### Splitting a single value into multiple list items

If you want to "explode" a text string from your record into multiple list items, you can do so with the `separator()` method. This is useful for displaying comma-separated tags [as badges](#displaying-as-a-badge), for example:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('tags')
    .badge()
    .separator(',')
```

```preview
// record: {"tags": "laravel,node,typescript"}
TextEntry.make('tags')
    .badge()
    .separator(',')
```

The string is split on the separator as is: spaces around the values are kept.

## Aggregating relationships

Navette provides several methods for aggregating a relationship field, including `avg()`, `max()`, `min()` and `sum()`. For instance, if you wish to show the average of a field on all related records, you may use the `avg()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('users_avg_age')
    .avg('users', 'age')
```

In this example, `users` is the name of the relationship, while `age` is the field that is being averaged. The name of the entry must be `users_avg_age`: the relationship, the function and the field.

If you'd like to scope the relationship before aggregating, you can pass an object to the method, where the key is the relationship name and the value is the function to scope the Objection query with:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('users_avg_age')
    .avg({
        users: (query) => query.where('is_active', true),
    }, 'age')
```

You may also count the related records with `counts()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('users_count')
    .counts('users')
```

The aggregate is computed for the displayed record, when the entry is rendered, unless the record already has it (selected by the query that loaded it). It needs an Objection model record (`relationMappings`).

## Customizing the text size

Text entries have small font size by default, but you may change this to `'xs'`, `'md'` (or `'base'`) or `'lg'`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
    .size('lg')
```

```preview
// record: {"title": "Introducing Navette"}
TextEntry.make('title')
    .size('lg')
```

The size of a badge or of an icon follows the size of the text.

## Customizing the font weight

Text entries have regular font weight by default, but you may change this to any of the following options: `'thin'`, `'extralight'`, `'light'`, `'medium'`, `'semibold'`, `'bold'`, `'extrabold'` or `'black'`.

For instance, you may make the font bold using `weight('bold')`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
    .weight('bold')
```

```preview
// record: {"title": "Introducing Navette"}
TextEntry.make('title')
    .weight('bold')
```

## Customizing the font family

You can change the text font family to any of the following options: `'sans'`, `'serif'` or `'mono'`.

For instance, you may make the font monospaced using `fontFamily('mono')`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('api_key')
    .fontFamily('mono')
```

```preview
// record: {"api_key": "nv_live_4f9a2c7e1b"}
TextEntry.make('api_key')
    .fontFamily('mono')
```

The `size()`, `weight()` and `fontFamily()` methods also accept a function of the record and the state.

## Handling long text

### Limiting text length

You may `limit()` the length of the entry's value:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .limit(50)
```

By default, the text is followed by `...` when it is truncated. You may pass another ending as the second argument. To show the full text when the user hovers over the entry, add a [tooltip](/infolists/overview#adding-a-tooltip-to-an-entry):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .limit(50)
    .tooltip((record, state) => (String(state).length > 50 ? String(state) : null))
```

`getCharacterLimit()` returns the limit of the entry, which avoids repeating it in the tooltip:

```ts
import { TextEntry } from '@navette-js/infolists';

const description: TextEntry = TextEntry.make('description')
    .limit(50)
    .tooltip((record, state) => (String(state).length > (description.getCharacterLimit() ?? Infinity) ? String(state) : null));
```

The limit and its ending may also be functions of the record and of the state item, `(record, state) => …`, for a different limit for each value of a list. `getCharacterLimitEnd()` returns the ending.

### Limiting word count

You may limit the number of `words()` displayed in the entry:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .words(10)
```

```preview
// record: {"description": "Navette builds admin panels for Node.js from components written in TypeScript, rendered on the server."}
TextEntry.make('description')
    .words(10)
```

The limits do not apply to Markdown or HTML.

### Limiting text to a specific number of lines

You may want to limit text to a specific number of lines instead of limiting it to a fixed length. Clamping text to a number of lines is useful in responsive interfaces where you want to ensure a consistent experience across all screen sizes. This can be achieved using the `lineClamp()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .lineClamp(2)
```

### Preventing text wrapping

By default, text will wrap to the next line if it exceeds the width of the container. You can disable this behavior using `wrap(false)`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('description')
    .wrap(false)
```

## Allowing the text to be copied to the clipboard

You may make the text copyable, such that clicking on the entry copies the displayed text (after formatting) to the clipboard, and optionally specify a custom confirmation message and duration in milliseconds:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('expense_number')
    .copyable()
    .copyMessage('Copied!')
    .copyMessageDuration(1500)
```

```preview
// record: {"expense_number": "EXP-2025-0042"}
TextEntry.make('expense_number')
    .copyable()
```

Optionally, you may pass a boolean value, or a function of the record and the state, to control if the text should be copyable or not.

To copy another value than the displayed text, use `copyableState()`, which accepts a value or a function of the record and the state:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('order_number')
    .copyable()
    .copyableState((record) => `https://shop.example.com/orders/${(record as Order).id}`)
```

<Aside variant="warning">
Browsers only allow copying to the clipboard on secure origins, so this feature only works when the panel is served over HTTPS (or on `localhost`).
</Aside>

## Adding suffix and prefix actions

You may place an [action](/actions/overview) before and after the entry using the `prefixAction()` and `suffixAction()` methods:

```ts
import { Action } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('cost')
    .prefix('€')
    .suffixAction(
        Action.make('copyCostToPrice')
            .icon('o-clipboard')
            .requiresConfirmation()
            .action(async ({ record }) => {
                await ProductResource.adapter.update(record.id, { price: record.cost });
            }),
    )
```

Affix actions are small icon buttons, unless they choose another style (`button()`, `link()`) or size. Several actions can be given with `prefixActions([...])` and `suffixActions([...])`, and each method also accepts a function of the context returning the action. The actions are mounted with the entry, so they open their modal and run their handler like any other schema action.

<Aside variant="warning">
Not available in Navette yet: a different URL for each value of a list, and translated month and day names in date formats.
</Aside>
