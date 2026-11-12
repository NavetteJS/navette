---
title: Overview
---

## Introduction

Navette's infolists package lets you display a read-only list of data for a specific record. It's integrated into the view page of [resources](#using-an-infolist-on-a-view-page) and into [action modals](#using-an-infolist-in-a-modal). An infolist is a [schema](/schemas/overview): you arrange its entries with the same layout components as forms, such as sections, grids and tabs.

## Defining entries

Entry classes are exported by `@navette-js/infolists`. They reside within the schema array of components. Navette includes a number of entries built-in:

- [Text entry](/infolists/text-entry)
- [Icon entry](/infolists/icon-entry)
- [Image entry](/infolists/image-entry)
- [Color entry](/infolists/color-entry)
- [Code entry](/infolists/code-entry)
- [Key-value entry](/infolists/key-value-entry)
- [Repeatable entry](/infolists/repeatable-entry)

You may also [create your own custom entries](/infolists/custom-entries) to display data however you wish.

Entries may be created using the static `make()` method, passing its unique name. Usually, the name of an entry corresponds to the name of an attribute of the record. You may use "dot notation" to access attributes within relationships:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')

TextEntry.make('author.name')
```

```preview
// record: {"title": "Introducing Navette", "author": {"name": "Ada Lovelace"}}
[
    TextEntry.make('title'),
    TextEntry.make('author.name'),
]
```

## Using an infolist on a view page

To give a resource a view page, set its static `hasViewPage` property to `true` and define the static `infolist()` method. Navette passes it a schema with a two-column grid, the `view` operation and the record being viewed:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Resource } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';

export class LeaveRequestResource extends Resource {
    static hasViewPage = true;

    static infolist(schema: Schema): Schema {
        return schema.components([
            Section.make('Leave Details')
                .columns(3)
                .columnSpanFull()
                .schema([
                    TextEntry.make('employee.name').label('Employee'),
                    TextEntry.make('start_date').date(),
                    TextEntry.make('end_date').date(),
                    TextEntry.make('reason').columnSpanFull(),
                ]),
            Section.make('Review')
                .columns(2)
                .columnSpanFull()
                .schema([
                    TextEntry.make('approver.name').label('Approver').placeholder('Not yet assigned'),
                    TextEntry.make('reviewed_at').dateTime().placeholder('Not yet reviewed'),
                ]),
        ]);
    }
}
```

```preview
// record: {"employee": {"name": "Grace Hopper"}, "start_date": "2025-07-14", "end_date": "2025-07-25", "reason": "Summer holiday with family in Brittany. Ongoing tickets have been handed over to Alan.", "approver": null, "reviewed_at": null}
// viewport: 1100
[
    Section.make('Leave Details')
        .columns(3)
        .columnSpanFull()
        .schema([
            TextEntry.make('employee.name').label('Employee'),
            TextEntry.make('start_date').date(),
            TextEntry.make('end_date').date(),
            TextEntry.make('reason').columnSpanFull(),
        ]),
    Section.make('Review')
        .columns(2)
        .columnSpanFull()
        .schema([
            TextEntry.make('approver.name').label('Approver').placeholder('Not yet assigned'),
            TextEntry.make('reviewed_at').dateTime().placeholder('Not yet reviewed'),
        ]),
]
```

The rows of the resource's table then lead to the view page. To change the behavior of the page, such as its header actions, extend `ViewRecord` and register your class in the `pages` property of the resource:

```ts
import { Action } from '@navette-js/actions';
import { Resource, ViewRecord } from '@navette-js/panels';

class ViewLeaveRequest extends ViewRecord {
    getHeaderActions(): Action[] {
        return [approveAction(), this.editAction()];
    }
}

export class LeaveRequestResource extends Resource {
    static hasViewPage = true;
    static pages = { view: ViewLeaveRequest };

    // ...
}
```

The view page reads the record again on every request, and checks that the user may view it before rendering the infolist.

## Using an infolist in a modal

When a resource has an `infolist()` but no view page, `ViewAction` opens the infolist in a modal:

```ts
import { IconEntry, TextEntry } from '@navette-js/infolists';
import { ViewAction } from '@navette-js/panels';
import { type Schema } from '@navette-js/schemas';
import { type Table } from '@navette-js/tables';

static infolist(schema: Schema): Schema {
    return schema.columns(1).components([
        TextEntry.make('name'),
        TextEntry.make('slug').copyable(),
        IconEntry.make('is_visible').label('Visibility').boolean(),
        TextEntry.make('updated_at').label('Last modified at').dateTime(),
    ]);
}

static table(table: Table<PostCategory>): Table<PostCategory> {
    return table
        // ...
        .recordActions([
            ViewAction.make(),
        ]);
}
```

```preview
// record: {"name": "Release notes", "slug": "release-notes", "is_visible": true, "updated_at": "2025-03-05 10:11:12"}
// width: 32rem
[
    TextEntry.make('name'),
    TextEntry.make('slug').copyable(),
    IconEntry.make('is_visible').label('Visibility').boolean(),
    TextEntry.make('updated_at').label('Last modified at').dateTime(),
]
```

You may also pass entries to the `schema()` method of any [action](/actions/overview) to display them in its modal. The entries read the record of the action:

```ts
import { Action } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';

Action.make('viewProfile')
    .slideOver()
    .modalSubmitAction(false)
    .schema(() => [
        TextEntry.make('name'),
        TextEntry.make('email'),
        TextEntry.make('hire_date').date(),
    ])
```

Entries may also be placed in a form, for example to display the creation date of the record next to its fields.

## Entry content (state)

The data that an entry displays is called its "state". The infolist is aware of the record it is displaying, so the state of the entry is read from the attribute of the record with the same name. For example, if the entry is used in the infolist of a `PostResource`, then the `title` attribute value of the current post will be displayed:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
```

If you want to access the value stored in a relationship, you can use "dot notation". The name of the relationship comes first, followed by a dot, and then the name of the attribute:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('author.name')
```

For `author.name`, Navette first reads a flat `author_name` attribute of the record, which a data adapter can compute with a join or a subquery. If the record has no such attribute, it follows the path through nested objects: `record.author.name`. You can also use dot notation to read keys of a JSON column, such as `meta.title`, as long as your model returns the column as an object rather than as a JSON string.

### Setting the state of an entry

You can compute the state of an entry yourself by passing a function to the `state()` method. It receives the [context object](/schemas/overview#component-utility-injection), and may be `async`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('created_at')
    .state(({ record }) => diffForHumans((record as Brand).created_at))

TextEntry.make('tasks_count')
    .label('Open tasks')
    .state(async ({ record }) => String(await countOpenTasks((record as Project).id)))
```

#### Adding placeholder text if an entry is empty

Sometimes you may want to display placeholder text for entries with an empty state, which is styled as a lighter gray text. Text, color, code and key-value entries have a `placeholder()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('project.name')
    .label('Project')
    .placeholder('No project')
```

```preview
// record: {"project": null}
TextEntry.make('project.name')
    .label('Project')
    .placeholder('No project')
```

<Aside variant="warning">
Default state (`default()`) is not available in Navette yet: use `placeholder()`, or return a fallback from `state()`.
</Aside>

## Setting an entry's label

By default, the label of the entry is generated from the name of the entry: `hire_date` becomes "Hire date", and `department.name` becomes "Department". You may customize this using the `label()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('name')
    .label('Full name')
```

```preview
// record: {"name": "Ada Lovelace"}
TextEntry.make('name')
    .label('Full name')
```

The label is escaped when it is rendered. `label()` only accepts a string.

### Hiding an entry's label

It may be tempting to set the label to an empty string to hide it, but this is not recommended. Setting the label to an empty string will not communicate the purpose of the entry to screen readers, even if the purpose is clear visually. Instead, you should use the `hiddenLabel()` method, so it is hidden visually but still accessible to screen readers:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('name')
    .hiddenLabel()
```

```preview
// record: {"name": "Ada Lovelace"}
TextEntry.make('name')
    .hiddenLabel()
```

<Aside variant="tip">
If you need arbitrary text or UI rather than a labelled data entry, consider a [prime component](/schemas/primes), such as text, an icon, or an image.
</Aside>

## Hiding an entry

You may hide an entry:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('role')
    .hidden()
```

Optionally, you may pass a boolean value, or a function that receives the [context object](/schemas/overview#component-utility-injection), to control if the entry should be hidden or not:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('salary')
    .hidden(({ record }) => (record as Employee).employment_type === 'contractor')
```

Alternatively, you may use the `visible()` method to control if the entry should be hidden or not. In some situations, this may help to make your code more readable:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('hourly_rate')
    .visible(({ record }) => (record as Employee).employment_type === 'contractor')
```

<Aside variant="info">
If both `hidden()` and `visible()` are used, they both need to indicate that the entry should be visible for it to be shown.
</Aside>

### Hiding an entry based on the current operation

The "operation" of a schema is the current action being performed on it. On resource pages, this is `create`, `edit` or `view`. You can hide an entry based on the current operation by passing an operation, or an array of operations, to the `hiddenOn()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('created_at')
    .hiddenOn('create')

TextEntry.make('updated_at')
    .hiddenOn(['create', 'edit'])
```

Alternatively, you may use the `visibleOn()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('reviewed_at')
    .visibleOn('view')
```

<Aside variant="warning">
The `hiddenOn()` method will overwrite any previous calls to the `hidden()` method, and vice versa. The same applies to `visibleOn()` and `visible()`.
</Aside>

## Entry utility injection

Methods that accept functions, such as `state()`, `hidden()` and `visible()`, pass them the [context object](/schemas/overview#component-utility-injection) of the schema. In an infolist, you will mostly use:

- `record`, the record displayed by the infolist.
- `operation`, the current operation (`'view'` on a view page).
- `livewire`, the page that renders the infolist.

Some formatting methods of the [text entry](/infolists/text-entry), such as `color()`, receive the record directly instead.

## Global settings

If you wish to change the default behavior of all entries globally, then you can call the static `configureUsing()` method once when your application starts, to which you pass a function to modify the entries. For example, if you wish to give all `TextEntry` components a placeholder, you can do it like so:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.configureUsing((entry) => entry.placeholder('None'));
```

Of course, you are still able to overwrite this on each entry individually:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('name')
    .placeholder(null)
```

<Aside variant="warning">
Opening a URL when an entry is clicked (`url()`), tooltips, inline labels, content alignment, the extra content slots (`aboveLabel()`, `belowContent()`…), JavaScript visibility (`hiddenJs()`) and extra HTML attributes on entries are not available in Navette yet.
</Aside>
