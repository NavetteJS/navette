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

Navette looks for an `author` relationship on the record's Objection model (`relationMappings`), loads it if it is not loaded yet, and displays the `name` attribute of the related record. Nested relationships work too (`author.country.name`), and a relationship holding several records (`tags.name`) gives the list of their values. You can also use dot notation to read keys of a JSON column, such as `meta.title`, as long as your model returns the column as an object rather than as a JSON string. A flat `author_name` attribute of the record, if your data adapter computes one, takes precedence.

To display an aggregate of related records, such as their number, see [aggregating relationships](/infolists/text-entry#aggregating-relationships).

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

### Setting the default state of an entry

When an entry is empty (its state is `null` or `undefined`), you can use the `default()` method to define alternative state to use instead. This method treats the default state as if it were real, so entries like [image](/infolists/image-entry) or [color](/infolists/color-entry) display the default image or color:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
    .default('Untitled')
```

```preview
// record: {"title": null}
TextEntry.make('title')
    .default('Untitled')
```

#### Adding placeholder text if an entry is empty

Sometimes you may want to display placeholder text for entries with an empty state, which is styled as a lighter gray text. This differs from the [default state](#setting-the-default-state-of-an-entry), as the placeholder is always text and not treated as if it were real state. Every entry has a `placeholder()` method:

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

You may also show a tooltip on an empty entry with `emptyTooltip()`.

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

The label is escaped when it is rendered. You may also pass a function to `label()`, which receives the [context object](/schemas/overview#component-utility-injection):

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('total')
    .label(({ record }) => `Total (${(record as Invoice).currency.toUpperCase()})`)
```

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

Optionally, you may pass a boolean value, or a function that receives the context object, to `hiddenLabel()`.

## Opening a URL when an entry is clicked

When an entry is clicked, you may open a URL. To do this, pass a URL to the `url()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
    .url('/about/titles')
```

```preview
// record: {"title": "Introducing Navette"}
TextEntry.make('title')
    .url('/about/titles')
```

The whole content of the entry becomes a link. You may pass a function to the `url()` method to compute the URL from the [context object](/schemas/overview#component-utility-injection), for example to link to another page of a resource:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('author.name')
    .url(({ record }) => `/admin/authors/${(record as Post).author_id}`)
```

You may also choose to open the URL in a new tab, with the second argument of `url()` or with `openUrlInNewTab()`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('website')
    .url(({ record }) => (record as Company).website)
    .openUrlInNewTab()
```

Optionally, you may pass a boolean value, or a function that receives the context object, to `openUrlInNewTab()`.

<Aside variant="danger">
Navette only renders the link when the URL is safe: an `http://` or `https://` URL, a `mailto:` address or a path of your site. Any other scheme, such as `javascript:` or `data:`, is ignored and the entry is displayed without a link. The URL is escaped, but it is still your responsibility to check that a URL read from the database leads where you expect.
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

### Hiding an entry using JavaScript

The functions passed to `hidden()` and `visible()` run on the server: when an entry depends on a form field, the schema has to be rendered again for the condition to be evaluated again. Alternatively, you can write JavaScript to hide the entry in the browser, based on the value of a field. This is done by passing a JavaScript expression to the `hiddenJs()` method:

```ts
import { Select } from '@navette-js/forms';
import { IconEntry } from '@navette-js/infolists';

Select.make('role')
    .options({
        user: 'User',
        staff: 'Staff',
    })

IconEntry.make('is_admin')
    .boolean()
    .hiddenJs(`$get('role') !== 'staff'`)
```

The `$get()` function reads the current value of another field of the schema, without the depended-on field having to be `live()`.

The `visibleJs()` method is also available, which works in the same way as `hiddenJs()`, but controls if the entry should be visible or not:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('is_admin')
    .boolean()
    .visibleJs(`$get('role') === 'staff'`)
```

<Aside variant="info">
If both `hiddenJs()` and `visibleJs()` are used, they both need to indicate that the entry should be visible for it to be shown. The entry is still rendered on the server: these methods only hide it in the browser.
</Aside>

<Aside variant="danger">
The expression is inserted in the page as JavaScript. Write it in your code, and never build it from user input or from data stored in the database.
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

## Inline labels

Entries may have their labels displayed inline with the entry, rather than above it. This is useful for infolists with many entries, where vertical space is at a premium. To display an entry's label inline, use the `inlineLabel()` method:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('name')
    .inlineLabel()
```

```preview
// record: {"name": "Ada Lovelace", "email": "ada@example.com"}
// viewport: 1100
[
    TextEntry.make('name').inlineLabel(),
    TextEntry.make('email').label('Email address').inlineLabel(),
]
```

The label and the content are side by side from the `sm` breakpoint. Optionally, you may pass a boolean value, or a function that receives the context object, to control if the label should be displayed inline or not.

To display all the labels of a section inline, call `inlineLabel()` on each entry, for example with a loop or a small helper function.

## Adding a tooltip to an entry

You may specify a tooltip to display when you hover over the content of an entry:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
    .tooltip('Shown at the top of the page')
```

The tooltip is escaped. You may also pass a function, which receives the record and the state, and returns the tooltip or `null`:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('sku')
    .tooltip((record) => `Supplier reference: ${(record as Product).supplier_sku}`)
```

Text, icon, image and color entries display tooltips.

## Aligning entry content

You may align the content of an entry to the start (left in left-to-right interfaces, right in right-to-left interfaces), center, or end (right in left-to-right interfaces, left in right-to-left interfaces) using the `alignStart()`, `alignCenter()` or `alignEnd()` methods:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('title')
    .alignStart() // This is the default alignment.

TextEntry.make('title')
    .alignCenter()

TextEntry.make('title')
    .alignEnd()
```

```preview
// record: {"title": "Introducing Navette"}
[
    TextEntry.make('title').label('Start'),
    TextEntry.make('title').label('Center').alignCenter(),
    TextEntry.make('title').label('End').alignEnd(),
]
```

Alternatively, you may pass `'start'`, `'center'`, `'end'`, `'left'`, `'right'`, `'justify'` or `'between'` to the `alignment()` method. Any other value is ignored.

The `alignLeft()` and `alignRight()` methods align the content to the left or the right whatever the direction of the interface, and `alignJustify()` justifies it:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('code')
    .alignRight() // Same as alignment('right'), also in right-to-left interfaces.
```

## Adding extra content to an entry

Entries contain many "slots" where content can be inserted. Slots can accept text, [any schema component](/schemas/overview) and [actions](/actions/overview). Usually, [prime components](/schemas/primes) are used for content.

The following slots are available for all entries:

- `aboveLabel()`
- `beforeLabel()`
- `afterLabel()`
- `belowLabel()`
- `aboveContent()`
- `beforeContent()`
- `afterContent()`
- `belowContent()`

To insert plain text, you can pass a string to these methods. It is escaped:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('name')
    .belowContent("This is the user's full name.")
```

```preview
// record: {"name": "Ada Lovelace"}
TextEntry.make('name')
    .belowContent("This is the user's full name.")
```

To insert a schema component, often a [prime component](/schemas/primes), you can pass the component to the method:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Text } from '@navette-js/schemas';

TextEntry.make('name')
    .belowContent(Text.make("This is the user's full name.").weight('bold'))
```

To insert an [action](/actions/overview), you can pass the action to the method. Actions are rendered as small links, and are mounted on the entry:

```ts
import { Action } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('name')
    .belowContent(Action.make('generate'))
```

You can insert any combination of content into the slots by passing an array of content to the method:

```ts
import { Action } from '@navette-js/actions';
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .belowContent([
        Icon.make('o-information-circle'),
        "This is the user's full name.",
        Action.make('generate'),
    ])
```

```preview
// record: {"name": "Ada Lovelace"}
TextEntry.make('name')
    .belowContent([
        Icon.make('o-information-circle'),
        "This is the user's full name.",
    ])
```

As well as allowing static values, the slot methods also accept functions, which receive the [context object](/schemas/overview#component-utility-injection) and return the content:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('email')
    .belowContent(({ record }) => ((record as User).email_verified_at ? 'Verified' : 'Not verified yet'))
```

An `HtmlString` from `@navette-js/support` (`raw()`) is inserted as is: only build it from values escaped with `e()`.

### Adding extra content above an entry's label

You can insert extra content above an entry's label using the `aboveLabel()` method. You can [pass any content](#adding-extra-content-to-an-entry) to this method, like text, a schema component or an action:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .aboveLabel([
        Icon.make('o-star'),
        "This is the content above the entry's label",
    ])
```

### Adding extra content before an entry's label

You can insert extra content before an entry's label using the `beforeLabel()` method:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .beforeLabel(Icon.make('o-star'))
```

### Adding extra content after an entry's label

You can insert extra content after an entry's label using the `afterLabel()` method. The content is aligned to the end of the container:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .afterLabel([
        Icon.make('o-star'),
        "This is the content after the entry's label",
    ])
```

```preview
// record: {"name": "Ada Lovelace"}
// width: 32rem
TextEntry.make('name')
    .afterLabel([
        Icon.make('o-star'),
        "This is the content after the entry's label",
    ])
```

### Adding extra content below an entry's label

You can insert extra content below an entry's label using the `belowLabel()` method:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .belowLabel([
        Icon.make('o-star'),
        "This is the content below the entry's label",
    ])
```

<Aside variant="info">
This may seem like the same as the [`aboveContent()` method](#adding-extra-content-above-an-entrys-content). However, when using [inline labels](#inline-labels), the `aboveContent()` method will place the content above the entry, not below the label, since the label is displayed in a separate column to the entry content.
</Aside>

### Adding extra content above an entry's content

You can insert extra content above an entry's content using the `aboveContent()` method:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .aboveContent([
        Icon.make('o-star'),
        "This is the content above the entry's content",
    ])
```

### Adding extra content before an entry's content

You can insert extra content before an entry's content using the `beforeContent()` method:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .beforeContent(Icon.make('o-star'))
```

### Adding extra content after an entry's content

You can insert extra content after an entry's content using the `afterContent()` method. The content is aligned to the end of the container:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Icon } from '@navette-js/schemas';

TextEntry.make('name')
    .afterContent(Icon.make('o-star'))
```

```preview
// record: {"name": "Ada Lovelace"}
// width: 32rem
TextEntry.make('name')
    .afterContent(Icon.make('o-star'))
```

## Adding extra HTML attributes to an entry

You can pass extra HTML attributes to the entry via the `extraAttributes()` method, which will be merged onto the outer HTML element of its content. The attributes should be represented by an object, where the key is the attribute name and the value is the attribute value:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('slug')
    .extraAttributes({ class: 'bg-gray-200' })
```

Calling `extraAttributes()` several times merges the attributes. The values are escaped, and attribute names that are not valid are ignored.

### Adding extra HTML attributes to the entry wrapper

You can also pass extra HTML attributes to the very outer element of the "entry wrapper" which surrounds the label and content of the entry. This is useful if you want to style the label or spacing of the entry via CSS, since you could target elements as children of the wrapper:

```ts
import { TextEntry } from '@navette-js/infolists';

TextEntry.make('slug')
    .extraEntryWrapperAttributes({ class: 'components-locked' })
```

## Entry utility injection

Methods that configure the entry as a whole and accept functions, such as `state()`, `label()`, `url()`, `hidden()`, `visible()`, `inlineLabel()`, `alignment()` and the slot methods, pass them the [context object](/schemas/overview#component-utility-injection) of the schema. In an infolist, you will mostly use:

- `record`, the record displayed by the infolist.
- `operation`, the current operation (`'view'` on a view page).
- `livewire`, the page that renders the infolist.

Methods that may give a different result for each value of a list, such as `tooltip()` and the `color()` or `icon()` methods of the [text entry](/infolists/text-entry), receive two arguments instead: the record, and the state (the item of the list being rendered).

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
Not available in Navette yet: running an action when an entry is clicked (`action()`), a different URL for each value of a list, `inlineLabel()` on a section or on a whole schema, and the alignment helpers of slot content (`Schema.start()`, `Schema.end()`, `Schema.between()`).
</Aside>
