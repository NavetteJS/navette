---
title: Overview
---

## Introduction

Navette's forms package allows you to build dynamic forms for your panels. It's used by other Navette packages to render forms in resource pages, action modals, table filters and more. Learning how to build forms is essential to learning how to use the rest of Navette.

A form is a schema: a list of fields, arranged by layout components such as sections and grids. In a resource, you define the form in the static `form()` method:

```ts
import { RichEditor, TextInput, Toggle } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';

export class BrandResource extends Resource {
    static form(schema: Schema): Schema {
        return schema.components([
            Section.make('Brand').schema([
                TextInput.make('name').required().maxLength(255),
                TextInput.make('website').url(),
                Toggle.make('is_visible').label('Visibility').default(true),
                RichEditor.make('description').columnSpanFull(),
            ]),
        ]);
    }
}
```

```preview
// state: {"name": "Acme", "website": "https://acme.example", "is_visible": true}
Section.make('Brand').schema([
    TextInput.make('name').required().maxLength(255),
    TextInput.make('website').url(),
    Toggle.make('is_visible').label('Visibility').default(true),
])
```

In an action modal, you pass the same kind of components to the action's `schema()` method, and read the validated values from `data`:

```ts
import { Action } from '@navette-js/actions';
import { Textarea } from '@navette-js/forms';

Action.make('reject')
    .schema([
        Textarea.make('reason').required().maxLength(1000),
    ])
    .action(async ({ record, data }) => {
        // `data.reason` has been validated on the server.
    });
```

## Form fields

Form field classes are exported by `@navette-js/forms` (the builder is exported by `@navette-js/forms/builder`). Navette ships with these fields:

- [Text input](/forms/text-input)
- [Select](/forms/select)
- [Checkbox](/forms/checkbox)
- [Toggle](/forms/toggle)
- [Checkbox list](/forms/checkbox-list)
- [Radio](/forms/radio)
- [Date-time picker](/forms/date-time-picker)
- [File upload](/forms/file-upload)
- [Rich editor](/forms/rich-editor)
- [Markdown editor](/forms/markdown-editor)
- [Repeater](/forms/repeater)
- [Builder](/forms/builder)
- [Tags input](/forms/tags-input)
- [Textarea](/forms/textarea)
- [Key-value](/forms/key-value)
- [Color picker](/forms/color-picker)
- [Toggle buttons](/forms/toggle-buttons)
- [Slider](/forms/slider)
- [Code editor](/forms/code-editor)
- [Hidden](/forms/hidden)

`@navette-js/forms` also exports `OneTimeCodeInput`, a code entered one digit per box. You may also [create your own custom fields](/forms/custom-fields) to edit data however you wish.

Fields are created using the static `make()` method, passing their unique name. Usually, the name of a field corresponds to the name of a column of the record:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
```

```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name')
```

You may use "dot notation" to bind fields to keys of nested objects. The value is read from, and saved to, `record.socials.github_url`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('socials.github_url')
```

## Validating fields

You can add validation rules to your fields by using methods like `required()` and `maxLength()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .required()
    .maxLength(255)
```

```preview
// state: {"name": ""}
// errors: {"data.name": ["The name field is required."]}
TextInput.make('name')
    .required()
    .maxLength(255)
```

In this example, the field is `required()`, and has a `maxLength()`. Validation always runs on the server when the form is submitted; the matching HTML attributes (`required`, `maxlength`…) only give the user earlier feedback. Navette has [methods for the most common rules](/forms/validation#available-rules), and you can add your own [custom rules](/forms/validation#custom-rules).

## Setting a field's label

By default, the label of the field is generated from its name: `first_name` and `firstName` both become "First name". To override the field's label, you may use the `label()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .label('Full name')
```

```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name')
    .label('Full name')
```

As well as allowing a static value, the `label()` method also accepts a function to dynamically calculate it. The function receives the [field context](#using-the-field-context):

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .label(({ operation }) => (operation === 'create' ? 'Name' : 'Display name'))
```

### Hiding a field's label

It may be tempting to set the label to an empty string to hide it, but this is not recommended: an empty label does not communicate the purpose of the field to screen readers. Instead, use the `hiddenLabel()` method, so the label is hidden visually but still read by screen readers:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .hiddenLabel()
```

```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name')
    .hiddenLabel()
```

Optionally, you may pass a boolean value to control if the label should be hidden or not.

## Adding helper text

You can add instructions below a field using `helperText()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('email')
    .helperText('Use your work email address.')
```

```preview
// state: {"email": "ada@example.com"}
TextInput.make('email')
    .helperText('Use your work email address.')
```

The helper text is escaped. On text inputs, toggles, Markdown and code editors and sliders, it is also linked to the control with `aria-describedby`, so assistive technology reads it with the field.

## Adding a hint next to the label

A hint is displayed at the end of the label row. Use it for short, secondary information:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password')
    .password()
    .hint('At least 12 characters')
```

```preview
// state: {"password": "correct-horse-battery"}
TextInput.make('password')
    .password()
    .hint('At least 12 characters')
```

The hint text is escaped. To insert markup, pass an `HtmlString` created with `raw()` from `@navette-js/support`, built only from values escaped with `e()`:

```ts
import { TextInput } from '@navette-js/forms';
import { raw } from '@navette-js/support';

TextInput.make('password')
    .password()
    .hint(raw('<a href="/password-reset" class="fi-link">Forgot password?</a>'))
```

```preview
// state: {"password": "correct-horse-battery"}
TextInput.make('password')
    .password()
    .hint(raw('<a href="/password-reset" class="fi-link">Forgot password?</a>'))
```

You may change the color of the hint with `hintColor()`, and add an icon with `hintIcon()`. The second argument of `hintIcon()` is a tooltip, which is also used as the icon's accessible name:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('vat_number')
    .hint('Required in the EU')
    .hintColor('warning')
    .hintIcon('o-information-circle', 'Your VAT number is printed on your invoices.')
```

```preview
// state: {"vat_number": "FR40303265045"}
TextInput.make('vat_number')
    .hint('Required in the EU')
    .hintColor('warning')
    .hintIcon('o-information-circle', 'Your VAT number is printed on your invoices.')
```

`hint()`, `hintColor()`, `hintIcon()` and `hintIconTooltip()` also accept a function of the [field context](#using-the-field-context).

### Adding an action to the hint

You may add one or more actions after the hint with `hintAction()` or `hintActions()`. They are rendered as small links, and mounted on the field:

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';

TextInput.make('sku')
    .hintAction(
        Action.make('generate')
            .label('Generate')
            .action(({ livewire }) => {
                livewire.data.sku = `SKU-${Date.now()}`;
            }),
    )
```

```preview
// state: {"sku": "SKU-1042"}
TextInput.make('sku')
    .hintAction(
        Action.make('generate')
            .label('Generate')
            .action(() => {}),
    )
```

## Setting the default value of a field

Fields may have a default value. The default is used when the form is filled with no data: on the Create page of a resource, or in an action modal without `fillForm()`. To define a default value, use the `default()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .default('John')
```

You may also pass a function, which is called every time the form is filled. This is useful for values such as the current date, which must not be computed once when the module is loaded:

```ts
import { DatePicker } from '@navette-js/forms';

DatePicker.make('hire_date')
    .default(() => new Date().toISOString().slice(0, 10))
```

<Aside variant="warning">
A default function is supported by `TextInput`, `Textarea`, `DatePicker`, `DateTimePicker`, `TimePicker`, `Radio`, `ToggleButtons` and `ColorPicker`. `Select`, `Checkbox`, `Toggle`, `CheckboxList`, `TagsInput`, `KeyValue` and `Slider` currently accept a static default value only.
</Aside>

<Aside variant="info">
On an Edit page, the form is filled from the record. When the record's value is `null` or missing, the default value is used.
</Aside>

## Disabling a field

You may disable a field to prevent it from being edited by the user:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .disabled()
```

```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name')
    .disabled()
```

Optionally, you may pass a boolean value, or a function of the [field context](#using-the-field-context), to control if the field should be disabled or not:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('slug')
    .disabled(({ operation }) => operation === 'edit')
```

Disabling a field also prevents it from being saved, and its validation rules are skipped. The value submitted by the browser for a disabled field is never used. If you'd like the field to be saved anyway, for example because its value is computed on the server by another field, use `dehydrated()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('slug')
    .disabled()
    .dehydrated()
```

<Aside variant="danger">
A disabled field that is `dehydrated()` is saved with whatever state it holds, and that state is part of the form data the browser sends back. Validate it like any other field, and never trust it for anything the user must not change: compute such values again on the server before saving.
</Aside>

### Disabling a field based on the current operation

The operation is `'create'` or `'edit'` on resource pages, `'view'` on View pages. You may disable a field for some operations only with `disabledOn()`, which accepts an operation or a list of operations:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('email')
    .disabledOn('edit')

TextInput.make('code')
    .disabledOn(['edit', 'view'])
```


## Hiding a field

You may hide a field:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .hidden()
```

Optionally, you may pass a boolean value or a function to control if the field should be hidden or not. You may also use `visible()` with the opposite meaning:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('company_name')
    .visible(({ get }) => get('type') === 'company')
```

A hidden field is neither validated nor saved, and neither are the fields of a hidden layout component such as a section. When the visibility depends on another field, make that field [live](#the-basics-of-reactivity) so the form is re-rendered when it changes.

### Hiding a field using JavaScript

When the visibility depends on another field, making that field `live()` sends a request every time it changes. You may instead hide the field in the browser, with a JavaScript expression evaluated by Alpine.js. `$get()` reads the state of another field, and `$state` is the field's own state:

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('role')
    .options({ user: 'User', staff: 'Staff' })

TextInput.make('department')
    .hiddenJs(`$get('role') !== 'staff'`)
```

`visibleJs()` does the opposite: the field is shown only while the expression is true. Both methods also accept a function of the [field context](#using-the-field-context) returning the expression.

<Aside variant="warning">
The field is only hidden in the browser: it is still rendered, validated and saved by the server. If the field must not be saved when it is hidden, combine `hiddenJs()` with a server-side `hidden()` or `dehydrated()` condition. Never build these expressions from user input: they run as JavaScript in the browser.
</Aside>


### Hiding a field based on the current operation

The operation is `'create'` or `'edit'` on resource pages. You may hide or show a field for some operations only with `hiddenOn()` and `visibleOn()`, which accept an operation or a list of operations:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password')
    .password()
    .visibleOn('create')
```

## Inline labels

Fields may have their labels displayed inline with the field, rather than above it. This is useful for forms with many fields, where vertical space is at a premium:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .inlineLabel()
```

```preview
TextInput.make('name')
    .inlineLabel()
```

Optionally, you may pass a boolean value, or a function of the [field context](#using-the-field-context), to control if the label should be displayed inline or not.

### Using inline labels in multiple places at once

If you wish to display all labels inline in a [layout component](/schemas/layouts) like a [section](/schemas/sections) or a tab, you may use `inlineLabel()` on the component itself, and all fields within it will have their labels displayed inline:

```ts
import { Section } from '@navette-js/schemas';
import { TextInput } from '@navette-js/forms';

Section.make('Details')
    .inlineLabel()
    .schema([
        TextInput.make('name'),
        TextInput.make('email')
            .label('Email address'),
        TextInput.make('phone')
            .label('Phone number'),
    ])
```

You may also use `inlineLabel()` on the entire schema, in a resource's `form()` method for example:

```ts
static form(schema: Schema): Schema {
    return schema
        .inlineLabel()
        .components([
            // ...
        ]);
}
```

When using `inlineLabel()` on a layout component or a schema, you can still opt out for an individual field by using `inlineLabel(false)` on it.


## Autofocusing a field when the form is loaded

You may focus a text input or a select when the form is loaded, using the `autofocus()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .autofocus()
```

## Setting the placeholder of a field

Text inputs, textareas, selects, date pickers, tags inputs and Markdown editors may have a placeholder, displayed when the field has no value:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .placeholder('John Doe')
```

```preview
TextInput.make('name')
    .placeholder('John Doe')
```

## Fusing fields together into a group

The `FusedGroup` component from `@navette-js/schemas` displays several fields as one control, under a single label. Each field keeps a label for screen readers, and the first validation error of the group is displayed below it:

```ts
import { Select, TextInput } from '@navette-js/forms';
import { FusedGroup } from '@navette-js/schemas';

FusedGroup.make([
    TextInput.make('city').placeholder('City'),
    Select.make('country').placeholder('Country').options({ fr: 'France', be: 'Belgium' }),
])
    .label('Location')
    .columns(2)
```

```preview
// state: {"city": "Lyon", "country": "fr"}
// viewport: 1100
// width: 36rem
FusedGroup.make([
    TextInput.make('city').placeholder('City'),
    Select.make('country').placeholder('Country').options({ fr: 'France', be: 'Belgium' }),
])
    .label('Location')
    .columns(2)
```

You may hide the group's label with `hiddenLabel()`, and add a required asterisk with `markAsRequired()`. The asterisk is visual only: validation stays the responsibility of each field.

## Adding extra content to a field

Fields contain many "slots" where content can be inserted in a child schema. Slots can accept text, any [schema component](/schemas/overview), [actions](/actions/overview) and [action groups](/actions/grouping-actions). Usually, [prime components](/schemas/primes) are used for content.

The following slots are available for all fields:

| Method | Position |
|---|---|
| `aboveLabel()` | Above the label. |
| `beforeLabel()` | Before the label, on the same line. |
| `afterLabel()` | After the label, on the same line. |
| `belowLabel()` | Below the label. |
| `aboveContent()` | Above the field's content (its input). |
| `beforeContent()` | Before the field's content, on the same line. |
| `afterContent()` | After the field's content, on the same line. |
| `belowContent()` | Below the field's content. |
| `aboveErrorMessage()` | Above the validation error message. |
| `belowErrorMessage()` | Below the validation error message. |

To insert plain text, you can pass a string to these methods:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .belowContent('This is the user\'s full name.')
```

```preview
TextInput.make('name')
    .belowContent('This is the user\'s full name.')
```

To insert a schema component, like an [icon](/schemas/primes#icon-component) or a [text](/schemas/primes#text-component), or an [action](/actions/overview), you can pass it, or a list of them, to these methods:

```ts
import { Action } from '@navette-js/actions';
import { Icon, Text } from '@navette-js/schemas';
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .afterLabel([
        Icon.make('heroicon-m-star'),
        Text.make('Required'),
    ])
    .belowContent(Action.make('generate').action(() => {
        // ...
    }))
```

To align the content, wrap it in `Schema.start()`, `Schema.end()` or `Schema.between()`. A list mixing them puts each group at its position:

```ts
import { Action } from '@navette-js/actions';
import { Icon, Schema } from '@navette-js/schemas';
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .belowContent(Schema.end([
        Icon.make('heroicon-m-information-circle'),
        'This is the user\'s full name.',
        Action.make('generate'),
    ]))
```

All the slot methods also accept a function of the [field context](#using-the-field-context) returning the content. `belowContent()` is the most common place for longer instructions; `aboveErrorMessage()` and `belowErrorMessage()` are only rendered while the field has a validation error.

## Adding extra HTML attributes to a field

You can pass extra HTML attributes to the field via the `extraAttributes()` method, which will be merged onto its outer HTML element. The attributes should be represented by an object, where the key is the attribute name and the value is the attribute value:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .extraAttributes({ title: 'Text input' })
```

By default, calling `extraAttributes()` multiple times will overwrite the previous attributes. If you wish to merge the attributes instead, you can pass `true` as the second argument.

### Adding extra HTML attributes to the input element of a field

Some fields use an underlying `<input>` or `<select>` DOM element, but this is often not the outermost element in the field, so `extraAttributes()` may not work as you wish. In this case, you may use the `extraInputAttributes()` method, which merges the attributes onto the `<input>` or `<select>` element:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('categories')
    .extraInputAttributes({ width: 200 })
```

Fields controlled by an Alpine.js component, such as a textarea or a rich editor, also accept `extraAlpineAttributes()`, merged onto the element holding `x-data`:

```ts
import { Textarea } from '@navette-js/forms';

Textarea.make('bio')
    .extraAlpineAttributes({ 'x-on:keydown.ctrl.enter': '$wire.save()' })
```

### Adding extra HTML attributes to the field wrapper

You can also pass extra HTML attributes to the very outer element of the "field wrapper", which surrounds the field's label and content, with `extraFieldWrapperAttributes()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('categories')
    .extraFieldWrapperAttributes({ class: 'components-locked' })
```

These three methods accept a function of the [field context](#using-the-field-context) too, and `true` as their second argument to merge the attributes with the previous ones instead of replacing them.


## Using the field context

Many methods accept a function instead of a static value. Navette calls these functions with one context object. You may destructure the properties you need:

| Property | Description |
|---|---|
| `state` | The current value of the field. |
| `rawState` | The value as stored in the host component. Navette applies no state casts, so it is the same as `state`. |
| `get` | A function returning the current value of another field: `get('type')` (see [below](#getting-the-state-of-another-field)). |
| `set` | A function changing the value of another field (see [setting the state of another field](#setting-the-state-of-another-field)). |
| `record` | The record being edited, or `null` on a Create page. |
| `operation` | The current operation (`'create'`, `'edit'`), or `null`. |
| `livewire` | The component (page, widget…) that hosts the form. |
| `component` | The field instance itself. |

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('discount')
    .numeric()
    .required(({ get }) => get('type') === 'promotion')
    .hint(({ record }) => (record ? `Previously ${record.discount}%` : null))
```

These functions may be asynchronous. They run on the server, every time the form is rendered or validated.

Almost every method of a field accepts such a function instead of a static value: labels, helper texts, hints, placeholders, prefixes and suffixes, `readOnly()`, `autofocus()`, `mask()`, the options of a select, the limits of a repeater (`addable()`, `maxItems()`…), and the parameters of validation rules (`minLength()`, `same()`, `in()`, `startsWith()`…). Guards such as `addable()` or `deletable()` are evaluated again on the server when the browser calls the corresponding action, so a function returning `false` cannot be bypassed.

Inside a function, the field instance is available as `component`, and its container as `component.getContainer()`. `getContainer().getComponent('key')` finds another component of the same schema by its key (or by a function testing each component).

### Getting the state of another field

`get()` reads the state of a field of the same container. In the root form, that is any field of the form, even inside a section or a tab. Inside a [repeater](/forms/repeater) or [builder](/forms/builder) item, `get()` is relative to the item: `get('quantity')` reads the quantity of the same row.

To read a field outside of the item, climb with `../`, as in a file path: inside a repeater item, `get('../customer_id')` reads the repeater's level, `get('../../customer_id')` the level above. A path starting with `/` (or `get(path, true)`) is absolute, from the root of the host component, where the form state lives under `data` on resource pages: `get('/data.customer_id')`. Dots read nested state: `get('address.city')`.

`get` also has typed helpers, which convert the value: `get.string('name')`, `get.integer('quantity')`, `get.float('price')`, `get.boolean('is_active')`, `get.array('tags')` and `get.date('published_at')`. Each takes `isNullable` as its second argument, to return `null` instead of an empty value (`''`, `0`, `false`…). `get.filled('name')` and `get.blank('name')` test the value as Laravel's helpers do.

### Using JavaScript to determine text content

Labels and other texts are usually computed on the server. When a text depends on the state of a field, you may compute it in the browser instead, without a request, with `JsContent`. Its expression is evaluated by Alpine.js, with `$get()` and `$state` available:

```ts
import { JsContent } from '@navette-js/schemas';
import { TextInput } from '@navette-js/forms';

TextInput.make('greeting')
    .label(JsContent.make(`($get('name') === 'John Doe') ? 'Hello, John' : 'Hello, stranger'`))
```

`JsContent` is accepted wherever a label, a helper text or a hint is: it renders an element whose text is bound to the expression. Never build the expression from user input.

## The basics of reactivity

By default, when the user changes a field, the form is not sent to the server. Since sending it requires a network request, this is a performance optimization. If you wish to re-render the form after the user has interacted with a field, use the `live()` method:

```ts
import { Select } from '@navette-js/forms';

Select.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
    .live()
```

In this example, when the user changes the value of the `status` field, the form is re-rendered. Functions passed to `visible()`, `required()`, `options()` and the other methods then see the new value through `get()`. You can also [hook into the field's lifecycle](#field-updates) to run custom logic when the field is updated.

`live()` is available on every field. Optionally, you may pass a boolean value, or a function of the [field context](#using-the-field-context), as its `condition`: `live({ condition: ({ operation }) => operation === 'create' })`.

### Reactive fields on blur

When a text input is `live()`, the form is re-rendered every time the user types. You may wish to re-render the form only once the user has finished using the field, when it loses focus. You can do this using `live({ onBlur: true })`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('username')
    .live({ onBlur: true })
```

### Debouncing reactive fields

You may wish to find a middle ground between `live()` and `live({ onBlur: true })`, using "debouncing". Debouncing prevents a network request from being sent until the user has stopped typing for a certain period of time, in milliseconds (or as a string such as `'1s'`):

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('username')
    .live({ debounce: 500 })
```

## Field lifecycle

Each field goes through a lifecycle: it is filled when the form is loaded, updated when the user interacts with it, and its state is extracted when the form is submitted.

### Field hydration

Hydration fills the fields with data. On an Edit page, each field receives the value of the record's attribute of the same name, and shapes it for its control: a date picker keeps the `YYYY-MM-DD` part of a date-time, a checkbox list parses a JSON string into a list, a rich editor converts HTML into an editor document. On a Create page, each field receives its [default value](#setting-the-default-value-of-a-field).

To change the record's data before it fills the form, override `mutateFormDataBeforeFill()` on the Edit page.

You may run code after a field is hydrated with `afterStateHydrated()`. The function receives the [field context](#using-the-field-context); `component.state()` replaces the field's state:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .required()
    .afterStateHydrated(({ component, state }) => {
        component.state(String(state ?? '').toUpperCase());
    })
```

To only format the value shown in the field, use `formatStateUsing()`, which returns the new state. It runs when the field is filled, from the record on an Edit page or from the default value on a Create page:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('status')
    .formatStateUsing(({ state }) => String(state ?? '').toLowerCase())
```

### Field updates

You may use the `afterStateUpdated()` method to run code on the server after the user updates a field. The function receives the [field context](#using-the-field-context), where `state` is the new value:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .live({ onBlur: true })
    .afterStateUpdated(({ state }) => {
        // ...
    })
```

Use it together with `live()`, so the hook runs as soon as the field changes.

The context of `afterStateUpdated()` also contains `old`, the state of the field before the update (and `oldRaw`, the same value before casts, which Navette does not apply):

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .live()
    .afterStateUpdated(({ old, state }) => {
        // ...
    })
```

To react to a change in the browser only, without a request, use `afterStateUpdatedJs()`. Its JavaScript expression runs each time the state changes, with `$state`, `$old`, `$get()` and `$set()` available. The field does not need to be `live()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .afterStateUpdatedJs(`$set('email', ($state ?? '').replaceAll(' ', '.').toLowerCase() + '@example.com')`)

TextInput.make('email')
    .label('Email address')
```

Never build this expression from user input: it runs as JavaScript in the browser.

#### Setting the state of another field

The context also contains a `set()` function, which changes the value of another field of the same container. When the function returns, the form is re-rendered with the new value:

```ts
import { TextInput } from '@navette-js/forms';
import { slug } from '@navette-js/schemas';

TextInput.make('title')
    .live({ onBlur: true })
    .afterStateUpdated(({ operation, state, set }) => {
        if (operation === 'create') {
            set('slug', slug(String(state ?? '')));
        }
    })
```

`set()` takes the same paths as [`get()`](#getting-the-state-of-another-field): a sibling (inside a repeater item, `set('amount', …)` changes the amount of the same row), a nested path (`set('address.city', …)`), `../` to climb a level, or an absolute path starting with `/`. Setting a field this way does not call that field's own `afterStateUpdated()`, unless you pass `{ shouldCallUpdatedHooks: true }` as the third argument:

```ts
set('slug', 'my-post', { shouldCallUpdatedHooks: true })
```

When a field inside a repeater item changes, the `afterStateUpdated()` hooks of the field and then of the repeater are called. This lets the repeater recalculate a total:

```ts
import { Repeater, TextInput } from '@navette-js/forms';

Repeater.make('lines')
    .afterStateUpdated(({ state, set }) => {
        const lines = Object.values((state ?? {}) as Record<string, { amount?: unknown }>);
        set('total', lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0).toFixed(2));
    })
    .schema(() => [
        TextInput.make('description'),
        TextInput.make('amount').numeric().live({ onBlur: true }),
    ])
```

### Field dehydration

Dehydration extracts the data from the fields when the form is submitted. Only the fields declared in the form, visible and not disabled, are included: a value the browser adds to the request for an unknown field is dropped. Each field also shapes its value for storage. For example, an empty string becomes `null`, a checkbox list only keeps known options, and a rich editor converts its document to sanitized HTML.

You may change the saved value of a field with `dehydrateStateUsing()`. The function receives the [field context](#using-the-field-context) and returns the value to save:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .required()
    .dehydrateStateUsing(({ state }) => String(state ?? '').toUpperCase())
```

`mutateDehydratedStateUsing()` does the same after the field's own shaping, and `beforeStateDehydrated()` runs a function just before the field is dehydrated.

#### Preventing a field from being saved

You may prevent a field from being saved using `dehydrated(false)`. In this example, the field is not present in the data passed to the page's save hooks and to the data adapter:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password_confirmation')
    .password()
    .dehydrated(false)
```

<Aside variant="info">
Even when a field is not saved, it is still validated, unless you use [`validatedWhenNotDehydrated(false)`](/forms/validation#disabling-validation-when-fields-are-not-saved). A field that is only disabled is not validated.
</Aside>

### Field rendering

Each time a `live()` field is updated, the whole host component is re-rendered. You may restrict this.

#### Field partial rendering

`partiallyRenderComponentsAfterStateUpdated()` re-renders only the listed components, by key or state path relative to the container, while the rest of the page is left as it is:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .live()
    .partiallyRenderComponentsAfterStateUpdated(['email'])

TextInput.make('email')
    .label(({ get }) => `Email address for ${get('name')}`)
```

To re-render the updated field itself only, use `partiallyRenderAfterStateUpdated()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .live()
    .partiallyRenderAfterStateUpdated()
    .belowContent(({ state }) => `Your name is ${state}.`)
```

#### Preventing the component from rendering after a field is updated

If the update only needs to run `afterStateUpdated()`, or if it is handled in JavaScript, you may skip the re-rendering altogether with `skipRenderAfterStateUpdated()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .live()
    .skipRenderAfterStateUpdated()
    .afterStateUpdated(({ state }) => {
        // Save the state somewhere…
    })
```

These three methods also accept a function of the field context.

## Reactive forms cookbook

### Conditionally hiding a field

Make the controlling field `live()`, and pass a function to `visible()` or `hidden()`:

```ts
import { TextInput, ToggleButtons } from '@navette-js/forms';

ToggleButtons.make('type')
    .options({ person: 'Person', company: 'Company' })
    .default('person')
    .inline()
    .live(),

TextInput.make('company_name')
    .visible(({ get }) => get('type') === 'company')
    .required(),
```

Since a hidden field is not validated, `company_name` is only required when it is visible.

### Conditionally making a field required

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('contact_method')
    .options({ email: 'Email', phone: 'Phone' })
    .live(),

TextInput.make('phone')
    .tel()
    .required(({ get }) => get('contact_method') === 'phone'),
```

### Dependant select options

The options of a select may be computed from another field. Reset the dependant field when the first one changes, so it never keeps a value that is no longer an option:

```ts
import { Select } from '@navette-js/forms';

Select.make('category_id')
    .options(async () => listCategories())
    .live()
    .afterStateUpdated(({ set }) => set('sub_category_id', null)),

Select.make('sub_category_id')
    .options(async ({ get }) => (get('category_id') ? listSubCategories(String(get('category_id'))) : [])),
```

The submitted value is checked against the options computed for the submitted category, so a forged value is rejected.

## Saving data to relationships

You may load and save the contents of a layout component to a singular relationship of the record (has-one or belongs-to) by using the `relationship()` method. The fields inside it then read and write the related record instead of the record itself:

```ts
import { Fieldset } from '@navette-js/schemas';
import { FileUpload, Textarea, TextInput } from '@navette-js/forms';

Fieldset.make('Metadata')
    .relationship('metadata')
    .schema([
        TextInput.make('title'),
        Textarea.make('description'),
        FileUpload.make('image'),
    ])
```

`relationship()` is available on `Group`, `Section`, `Fieldset`, `Grid` and the other layout components. In this example, `title`, `description` and `image` are loaded from the `metadata` relationship of the model when the form is filled, and saved to it once the record is saved. If the related record does not exist yet, it is created. Relationships may be nested: a layout with a `relationship()` may contain another one.

The fields inside the layout are not part of the record's own data, so they never reach the page's `mutateFormDataBeforeSave()` hooks. To change their data, use `mutateRelationshipDataBeforeFillUsing()`, `mutateRelationshipDataBeforeCreateUsing()` and `mutateRelationshipDataBeforeSaveUsing()` on the layout component, each receiving `{ data, record, ctx }` and returning the data.

### Saving data to a `BelongsTo` relationship

For a belongs-to relationship, the related record is created first, then related to the record (its foreign key is updated). You may pass the model class to create, if it differs from the relationship's related model, as the third argument: `relationship('author', true, Author)`.

### Conditionally saving data to a relationship

Sometimes, saving the related record is only useful if the user has filled in some fields. Pass a `condition` as the second argument: a function receiving the [field context](#using-the-field-context), whose `state` is the layout's data. When it returns `false`, nothing is created, and an existing related record is deleted:

```ts
import { Group } from '@navette-js/schemas';
import { TextInput } from '@navette-js/forms';

Group.make()
    .relationship('customer', ({ state }) => Boolean(state?.name))
    .schema([
        TextInput.make('name')
            .label('Customer')
            .requiredWith('email'),
        TextInput.make('email')
            .label('Email address')
            .email()
            .requiredWith('name'),
    ])
```

### Saving relationship data when the component is hidden

By default, a hidden layout component does not save its relationship. To save it anyway, use `saveRelationshipsWhenHidden()`:

```ts
import { Group } from '@navette-js/schemas';
import { TextInput } from '@navette-js/forms';

Group.make()
    .relationship('customer')
    .saveRelationshipsWhenHidden()
    .schema([
        TextInput.make('name'),
    ])
```


## Global settings

If you wish to change the default behavior of all fields of a type, call the static `configureUsing()` method once, when your application starts. The function receives every instance created afterwards by `make()`, before your own method calls, so an explicit setting still wins:

```ts
import { Select, TextInput } from '@navette-js/forms';

TextInput.configureUsing((input) => input.maxLength(255));
Select.configureUsing((select) => select.searchable());
```

The setting also applies to subclasses: `Field.configureUsing()` changes every field.
