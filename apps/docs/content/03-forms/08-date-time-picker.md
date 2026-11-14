---
title: Date-time picker
---

## Introduction

The date-time picker provides an interactive interface for selecting a date and/or a time:

```ts
import { DatePicker, DateTimePicker, TimePicker } from '@navette-js/forms';

DateTimePicker.make('published_at')
DatePicker.make('date_of_birth')
TimePicker.make('alarm_at')
```

```preview
// state: {"published_at": "2025-03-14 10:30:00", "date_of_birth": "1815-12-10", "alarm_at": "07:30:00"}
[
    DateTimePicker.make('published_at'),
    DatePicker.make('date_of_birth'),
    TimePicker.make('alarm_at'),
]
```

The three fields use the browser's native inputs (`date`, `datetime-local` and `time`), so the calendar and the clock follow the user's browser and locale.

## Understanding the storage format

Each field has a fixed format, which is also the format of its value in the form:

| Field | Saved value |
|---|---|
| `DatePicker` | `YYYY-MM-DD`. A longer value read from the record, such as `2025-03-14 10:30:00`, is cut to its date. |
| `DateTimePicker` | `YYYY-MM-DD HH:MM:SS`. The browser's `T` separator is replaced by a space, and missing seconds are set to `00`. |
| `TimePicker` | `HH:MM:SS`, or `HH:MM` without seconds. A date-time read from the record is reduced to its time. |

An empty field is saved as `null`.

A picker can also drop its date or its time part: `DateTimePicker.make('starts_at').time(false)` behaves as a `DatePicker`, and `DateTimePicker.make('opens_at').date(false)` as a `TimePicker` (input type, saved format and validation). Likewise, `DatePicker.make('due_at').time()` adds a time.

### Customizing the storage format

`format()` changes the format of the saved value, written with PHP's date tokens (`Y`, `m`, `d`, `H`, `i`, `s`, `j`, `n`, `g`, `A`, `U`…):

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date_of_birth')
    .format('d/m/Y')
```

The record's value is still read in any of the formats above; `format()` only shapes the value written.

## Enabling the JavaScript date picker

By default, the fields use the browser's native inputs. `native(false)` switches to Filament's JavaScript picker, which looks the same in every browser and offers more options:

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date_of_birth')
    .native(false)
```

```preview
// state: {"date_of_birth": "2026-03-14 00:00:00"}
// width: 24rem
DatePicker.make('date_of_birth')
    .native(false)
```

### Customizing the display format

With the JavaScript picker, `displayFormat()` sets how the value is shown, with PHP's date tokens. The defaults are `M j, Y` for dates, `H:i:s` for times, and both for date-times:

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date_of_birth')
    .native(false)
    .displayFormat('d/m/Y')
```

`locale()` translates the month and day names (`'fr'`, `'de'`…):

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date_of_birth')
    .native(false)
    .displayFormat('j F Y')
    .locale('fr')
```

### Configuring the time input intervals

`hoursStep()`, `minutesStep()` and `secondsStep()` set the step of the time inputs:

```ts
import { DateTimePicker } from '@navette-js/forms';

DateTimePicker.make('published_at')
    .native(false)
    .hoursStep(2)
    .minutesStep(15)
    .secondsStep(10)
```

### Configuring the first day of the week

`firstDayOfWeek()` takes a number from 0 (Sunday) to 6 (Saturday); the default is Monday (1). `weekStartsOnMonday()` and `weekStartsOnSunday()` are shortcuts:

```ts
import { DateTimePicker } from '@navette-js/forms';

DateTimePicker.make('published_at')
    .native(false)
    .weekStartsOnSunday()
```

### Disabling specific dates

`disabledDates()` takes a list of `YYYY-MM-DD` dates, or a function of the field context. They cannot be picked, and the server rejects them too, with "The selected … is invalid.":

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date')
    .native(false)
    .disabledDates(['2026-12-25', '2026-12-26'])
```

### Closing the picker when a date is selected

```ts
import { DateTimePicker } from '@navette-js/forms';

DateTimePicker.make('date')
    .native(false)
    .closeOnDateSelection()
```

### Focusing a default calendar date

`defaultFocusedDate()` sets the date shown when the picker opens on an empty field:

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('custom_starts_at')
    .native(false)
    .defaultFocusedDate('2026-01-01')
```

In the form state, the JavaScript picker uses `YYYY-MM-DD HH:MM:SS` (a time picker uses today's date). The saved value keeps the formats described in [the storage format](#understanding-the-storage-format).

## Disabling the seconds input

The date-time picker and the time picker let the user enter seconds by default. You may disable the seconds input using the `seconds(false)` method:

```ts
import { DateTimePicker, TimePicker } from '@navette-js/forms';

DateTimePicker.make('published_at')
    .seconds(false)

TimePicker.make('start_time')
    .seconds(false)
```

```preview
// state: {"published_at": "2025-03-14 10:30:00", "start_time": "09:00"}
[
    DateTimePicker.make('published_at')
        .seconds(false),
    TimePicker.make('start_time')
        .seconds(false),
]
```

The time picker then saves `HH:MM`. The date-time picker still saves `HH:MM:00`.

## Timezones

`timezone()` shows and edits a date-time in a time zone, while it is saved in UTC: the record's value is converted when the form is filled, and the submitted value is converted back before it is validated against `minDate()` / `maxDate()` and saved:

```ts
import { DateTimePicker } from '@navette-js/forms';

DateTimePicker.make('published_at')
    .timezone('America/New_York')
```

The time zone may come from the user, for example `.timezone(user.timezone)`. An invalid time zone name throws an error when the field is declared. Date pickers and time pickers are not converted, since a date or a time alone has no instant.

## Making the field live

The date picker accepts `live()`, so the form is re-rendered as soon as the date changes. This example computes the number of days of a leave request:

```ts
import { DatePicker, TextInput } from '@navette-js/forms';

type UpdateContext = { get: (name: string) => unknown; set: (name: string, value: unknown) => void };

const calculateDays = ({ get, set }: UpdateContext) => {
    const start = get('start_date');
    const end = get('end_date');

    set('days', start && end ? (Date.parse(String(end)) - Date.parse(String(start))) / 86_400_000 + 1 : null);
};

DatePicker.make('start_date').required().live().afterStateUpdated(calculateDays),
DatePicker.make('end_date').required().live().afterStateUpdated(calculateDays),
TextInput.make('days').disabled().dehydrated(),
```

```preview
// state: {"start_date": "2025-07-07", "end_date": "2025-07-18", "days": 12}
[
    DatePicker.make('start_date').required().live(),
    DatePicker.make('end_date').required().live(),
    TextInput.make('days').disabled().dehydrated(),
]
```

The date-time picker and the time picker also accept `live()` and `live({ onBlur: true })`.

## Setting a placeholder

All three pickers accept `placeholder()`. With the JavaScript picker, it is shown in the empty field; most browsers don't display it on native date inputs.

## Autocompleting dates with a datalist

Unless you're using the [JavaScript date picker](#enabling-the-javascript-date-picker), you may specify [datalist](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/datalist) options for a date picker using the `datalist()` method:

```ts
import { TimePicker } from '@navette-js/forms';

TimePicker.make('appointment_at')
    .seconds(false)
    .datalist([
        '09:00',
        '09:30',
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
    ])
```

Datalists provide autocomplete options to users when they use the picker. However, these are purely recommendations, and the user is still able to type any value into the input. If you're looking to strictly limit users to a set of predefined options, check out the [select field](/forms/select). As well as allowing a static value, the `datalist()` method also accepts a function of the [field context](/forms/overview#using-the-field-context). The datalist is left out when the field is disabled or read-only.

## Adding affix text aside the field

You may place text before and after the input using the `prefix()` and `suffix()` methods:

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date')
    .prefix('Starts')
    .suffix('at midnight')
```

```preview
// state: {"date": "2025-03-14"}
DatePicker.make('date')
    .prefix('Starts')
    .suffix('at midnight')
```

As well as allowing static values, the `prefix()` and `suffix()` methods also accept a function of the [field context](/forms/overview#using-the-field-context). Pass `true` as the second argument to display the affix inside the input, as with the [text input](/forms/text-input#displaying-affixes-inside-the-input). Affix actions are also available, with `prefixAction()` and `suffixAction()`, as on the [text input](/forms/text-input#using-actions-as-affixes).

### Using icons as affixes

You may place an [icon](/styling/icons) before and after the input using the `prefixIcon()` and `suffixIcon()` methods:

```ts
import { TimePicker } from '@navette-js/forms';

TimePicker.make('at')
    .prefixIcon('m-play')
```

```preview
// state: {"at": "07:30:00"}
TimePicker.make('at')
    .prefixIcon('m-play')
```

As well as allowing static values, the `prefixIcon()` and `suffixIcon()` methods also accept a function of the field context.

#### Setting the affix icon's color

Affix icons are gray by default, but you may set a different color using the `prefixIconColor()` and `suffixIconColor()` methods:

```ts
import { TimePicker } from '@navette-js/forms';

TimePicker.make('at')
    .prefixIcon('m-check-circle')
    .prefixIconColor('success')
```

```preview
// state: {"at": "07:30:00"}
TimePicker.make('at')
    .prefixIcon('m-check-circle')
    .prefixIconColor('success')
```

## Making the field read-only

Not to be confused with [disabling the field](/forms/overview#disabling-a-field), you may make the field "read-only" using the `readOnly()` method:

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date_of_birth')
    .readOnly()
```

This setting applies to both native and [JavaScript date pickers](#enabling-the-javascript-date-picker). Read-only JavaScript date pickers remain focusable, but cannot open the picker or clear the value.

There are a few differences, compared to `disabled()`:

- When using `readOnly()`, the field will still be sent to the server when the form is submitted. It can be mutated with the browser console, or via JavaScript. You can use [`dehydrated(false)`](/forms/overview#preventing-a-field-from-being-saved) to prevent this.
- There are no styling changes, such as less opacity, when using `readOnly()`.
- The field is still focusable when using `readOnly()`.
- The field is still validated on the server, but the browser's `required` check is dropped.

Optionally, you may pass a boolean, or a function of the field context, to control if the field should be read-only or not: `readOnly(({ operation }) => operation === 'edit')`.

## Date-time picker validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to date pickers.

### Min and max date validation

You may restrict the minimum and maximum date that can be selected with the picker. The `minDate()` and `maxDate()` methods accept a date (`YYYY-MM-DD`, or `YYYY-MM-DD HH:MM:SS` on a date-time picker, `HH:MM` on a time picker), `'today'`, `'tomorrow'`, `'yesterday'`, or a function of the [field context](/forms/overview#using-the-field-context):

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('date_of_birth')
    .maxDate('today'),

DatePicker.make('end_date')
    .minDate(({ get }) => (get('start_date') as string | null) || null),
```

The bounds are set on the input, and checked on the server. A function returning `null` removes the bound.

<Aside variant="info">
`'today'` is computed in UTC on the server. Close to midnight, it may differ from the user's local date.
</Aside>

The date pickers also check that the value is a valid date.
