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

Navette does not convert dates between timezones: the value the user types is the value saved. If your users are in several timezones, convert the value yourself, for example in the page's `mutateFormDataBeforeSave()` and `mutateFormDataBeforeFill()` hooks.

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

The date-time picker and the time picker cannot be `live()` yet.

## Setting a placeholder

`DatePicker` accepts `placeholder()`. The attribute is set on the input, but most browsers don't display it on a native date input.

## Date-time picker validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to date pickers.

### Min and max date validation

You may restrict the minimum and maximum date that can be selected with the picker. The `minDate()` and `maxDate()` methods accept a `YYYY-MM-DD` string, `'today'`, or a function of the [field context](/forms/overview#using-the-field-context):

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

<Aside variant="warning">
A JavaScript date picker (`native(false)`, display formats, disabled dates, first day of the week), timezone handling and `minDate()` / `maxDate()` on the date-time picker are not available yet.
</Aside>
