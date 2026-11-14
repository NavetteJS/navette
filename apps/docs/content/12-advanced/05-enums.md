---
title: Enums
---

## Introduction

An enum is a fixed set of values, such as the statuses of a post or the priorities of a task. Navette's enums give each value an optional label, color, icon and description, and the components use them wherever a fixed set of values is expected: field options, filters, table columns and infolist entries.

You define an enum with `defineEnum()`, from `@navette-js/support`. Each key is a stored value:

```ts
import { defineEnum, type EnumValue } from '@navette-js/support';

export const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: { label: 'Published', color: 'success', icon: 'm-check' },
    rejected: { label: 'Rejected', color: 'danger', icon: 'm-x-mark' },
});

export type Status = EnumValue<typeof Status>; // 'draft' | 'reviewing' | 'published' | 'rejected'
```

The values stay plain strings in your records and forms: `record.status === 'draft'` keeps working, and the `Status` type checks the values you write in your code.

<Aside variant="warning">
An enum is part of your application code. Never build one from user input: labels are escaped when they are displayed, but colors and icons are used as given.
</Aside>

## Defining an enum

Every property of a case is optional. A string instead of an object is the label, and a case without a label displays its value:

```ts
import { defineEnum } from '@navette-js/support';

export const Size = defineEnum({
    sm: 'Small',
    md: 'Medium',
    lg: { label: 'Large', description: 'For the main headings.' },
});

export const Unit = defineEnum(['kg', 'g', 'lb']);
```

| Property | Used by |
|---|---|
| `label` | Field and filter options, columns, entries, group titles. The value is displayed when there is none. |
| `color` | Badges and text of columns and entries, icons, toggle buttons. A [color](/styling/colors) name: `gray`, `primary`, `success`… |
| `icon` | Columns and entries, toggle buttons. An [icon](/styling/icons) name: `m-pencil`, `o-check`… |
| `description` | Radio buttons and checkbox lists, under the option label. |

### Translating labels and descriptions

A label or a description may be a function: it is called each time the text is displayed, so it follows the language of the current request:

```ts
import { defineEnum } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';

export const Status = defineEnum({
    draft: { label: () => t('statuses.draft'), color: 'gray' },
    published: { label: () => t('statuses.published'), color: 'success' },
});
```

### Using TypeScript enums and constant objects

Node.js runs TypeScript by removing the types, which does not support the `enum` keyword. The usual replacement is a constant object, which `nativeEnum()` turns into an enum. Its keys are the case names, and its members are the stored values. Labels, colors, icons and descriptions may be added by case name or by value; a case without a label displays its name:

```ts
import { nativeEnum } from '@navette-js/support';

export const Visibility = {
    Public: 'public',
    Private: 'private',
} as const;

export const VisibilityEnum = nativeEnum(Visibility, {
    Private: { label: 'Only me', color: 'danger', icon: 'm-lock-closed' },
});
```

`nativeEnum()` also accepts a TypeScript `enum`, in code compiled by `tsc`. Numeric enums are supported: since form state is always a string, `'2'` and `2` designate the same case.

## Reading an enum

An enum lists its cases and finds the case of a value:

```ts
Status.values();            // ['draft', 'reviewing', 'published', 'rejected']
Status.has('draft');        // true
Status.tryFrom('archived'); // null
Status.from('archived');    // throws a RangeError

const draft = Status.from('draft');
draft.value;                // 'draft'
draft.label;                // 'Draft'
draft.color;                // 'gray'
draft.icon;                 // 'm-pencil'
draft.description;          // null
draft.is('draft');          // true
```

`cases()` returns every case, in definition order. A case converts to its value in a string and in JSON. You may also read a property of a value directly with `getLabel()`, `getColor()`, `getIcon()` and `getDescription()`, or all of them with `options()` (`[value, label]` pairs), `labels()`, `colors()`, `icons()` and `descriptions()`.

## Using an enum for field options

Pass the enum to `options()`: its values become the options, and its labels their text. This works with [`Select`](/forms/select), [`Radio`](/forms/radio), [`CheckboxList`](/forms/checkbox-list) and [`ToggleButtons`](/forms/toggle-buttons) fields, with the [`SelectColumn`](/tables/columns/select), the [`SelectFilter`](/tables/filters/select) and the [query builder](/tables/filters/query-builder)'s `SelectConstraint`:

```ts
import { CheckboxList, Radio, Select, ToggleButtons } from '@navette-js/forms';
import { SelectColumn, SelectFilter } from '@navette-js/tables';
import { Status } from '../enums.ts';

Select.make('status').options(Status)

Radio.make('status').options(Status)

CheckboxList.make('statuses').options(Status)

ToggleButtons.make('status').options(Status)

SelectColumn.make('status').options(Status)

SelectFilter.make('status').options(Status)
```

```preview
// state: {"status": "reviewing"}
const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: { label: 'Published', color: 'success', icon: 'm-check' },
});
return Select.make('status').options(Status)
```

The fields only accept the values of the enum: any other value sent by the browser is rejected by the `in` rule ("The selected status is invalid."). For a field without options, the `in()` and `enum()` [validation rules](/forms/validation#in-and-not-in) accept an enum too:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('status')
    .enum(Status)
```

## Casting model attributes to an enum

Declare the enum of an attribute in the `casts` of its model. The value stays as stored, and the components displaying the attribute use the enum:

```ts
import { Model } from '@navette-js/database';
import { Status } from '../enums.ts';

export class Post extends Model {
    static tableName = 'posts';
    static casts = { status: Status };
    id!: number;
    status!: Status;
}
```

- A [`TextColumn`](/tables/columns/text) or a [`TextEntry`](/infolists/text-entry) displays the label of the value, in its color, with its icon. This works best with `badge()`.
- An [`IconColumn`](/tables/columns/icon) or an [`IconEntry`](/infolists/icon-entry) displays the icon of the value, in its color, with its label for screen readers.
- A table [grouped](/tables/grouping) by the attribute uses the labels as group titles.

Your own options take precedence: `formatStateUsing()`, `color()` and `icon()` replace the label, color and icon of the enum. A value that is not in the enum is displayed as is.

### Displaying values through an enum without a cast

When the records do not come from a model with casts (a [custom data adapter](/advanced/data-adapters), a computed state), pass the enum to the column or the entry with `enum()`:

```ts
import { TextEntry } from '@navette-js/infolists';
import { TextColumn } from '@navette-js/tables';

TextColumn.make('status')
    .enum(Status)
    .badge()

TextEntry.make('status')
    .enum(Status)
    .badge()
```

```preview
// records: [{"title": "Getting started", "status": "published"}, {"title": "Release notes", "status": "reviewing"}, {"title": "Roadmap", "status": "draft"}]
const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: { label: 'Published', color: 'success', icon: 'm-check' },
});
return new Table().columns([
    TextColumn.make('title'),
    TextColumn.make('status').enum(Status).badge(),
])
```

A state that is already a case, such as `getStateUsing(({ record }) => Status.from(record.status))`, is displayed the same way.

## Enum colors

The `color` of a case is used by:

- [`TextColumn`](/tables/columns/text#displaying-as-a-badge) and [`TextEntry`](/infolists/text-entry#displaying-as-a-badge), for the text or the badge,
- [`IconColumn`](/tables/columns/icon) and [`IconEntry`](/infolists/icon-entry), for the icon,
- [`ToggleButtons`](/forms/toggle-buttons#changing-the-color-of-option-buttons), for the buttons, unless `colors()` sets others.

## Enum icons

The `icon` of a case is used by:

- [`TextColumn`](/tables/columns/text#adding-an-icon) and [`TextEntry`](/infolists/text-entry#adding-an-icon), next to the label,
- [`IconColumn`](/tables/columns/icon) and [`IconEntry`](/infolists/icon-entry), as the icon,
- [`ToggleButtons`](/forms/toggle-buttons#adding-icons-to-option-buttons), in the buttons, unless `icons()` sets others.

```preview
// state: {"status": "published"}
const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: { label: 'Published', color: 'success', icon: 'm-check' },
});
return ToggleButtons.make('status').options(Status).inline()
```

## Enum descriptions

The `description` of a case is displayed under its label by [`Radio`](/forms/radio#setting-option-descriptions) and [`CheckboxList`](/forms/checkbox-list#setting-option-descriptions) fields, unless `descriptions()` sets others:

```ts
import { defineEnum } from '@navette-js/support';
import { Radio } from '@navette-js/forms';

const Status = defineEnum({
    draft: { label: 'Draft', description: 'This has not finished being written yet.' },
    reviewing: { label: 'Reviewing', description: 'This is ready for a staff member to read.' },
    published: { label: 'Published', description: 'This has been approved by a staff member and is public on the website.' },
});

Radio.make('status')
    .options(Status)
```

```preview
// state: {"status": "reviewing"}
const Status = defineEnum({
    draft: { label: 'Draft', description: 'This has not finished being written yet.' },
    reviewing: { label: 'Reviewing', description: 'This is ready for a staff member to read.' },
    published: { label: 'Published', description: 'This has been approved by a staff member and is public on the website.' },
});
return Radio.make('status').options(Status)
```

## Importing enum values

An [import column](/actions/import) with `enum()` only accepts the values of the enum: a row with another value fails with "The selected status is invalid.", and an empty value is accepted (add the `required` rule to refuse it). The values of a numeric enum are saved as numbers:

```ts
import { ImportColumn } from '@navette-js/panels';

ImportColumn.make('status')
    .enum(Status)
```
