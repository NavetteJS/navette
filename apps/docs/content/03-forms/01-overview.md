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
On an Edit page, the form is filled from the record. Unlike Filament, Navette also uses the default value when the record's value is `null` or missing.
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

### Hiding a field based on the current operation

The operation is `'create'` or `'edit'` on resource pages. You may hide or show a field for some operations only with `hiddenOn()` and `visibleOn()`, which accept an operation or a list of operations:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password')
    .password()
    .visibleOn('create')
```

## Autofocusing a field when the form is loaded

You may focus a text input or a select when the form is loaded, using the `autofocus()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .autofocus()
```

## Setting the placeholder of a field

Text inputs, selects, date pickers, tags inputs and Markdown editors may have a placeholder, displayed when the field has no value:

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

## Using the field context

Many methods accept a function instead of a static value. Navette calls these functions with one context object. You may destructure the properties you need:

| Property | Description |
|---|---|
| `state` | The current value of the field. |
| `get` | A function returning the current value of another field of the same container: `get('type')`. |
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

### Getting the state of another field

`get()` reads the state of a field of the same container. In the root form, that is any field of the form, even inside a section or a tab. Inside a [repeater](/forms/repeater) or [builder](/forms/builder) item, `get()` is relative to the item: `get('quantity')` reads the quantity of the same row. To read a field outside of the item, use the host component's state, which lives under `data` on resource pages: `livewire.data.customer_id`.

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

`live()` is available on `TextInput`, `Select`, `DatePicker`, `Radio`, `ToggleButtons`, `MarkdownEditor`, `CodeEditor` and `Slider`.

<Aside variant="warning">
`Checkbox`, `Toggle`, `CheckboxList`, `Textarea`, `TagsInput`, `KeyValue`, `ColorPicker`, `DateTimePicker`, `TimePicker` and `RichEditor` cannot be made `live()` yet. Their value is sent along with the next request.
</Aside>

### Reactive fields on blur

When a text input is `live()`, the form is re-rendered every time the user types. You may wish to re-render the form only once the user has finished using the field, when it loses focus. You can do this using `live({ onBlur: true })`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('username')
    .live({ onBlur: true })
```

### Debouncing reactive fields

The Markdown editor, the code editor and the slider also accept a `debounce` in milliseconds. The request is sent once the user has stopped typing for that long:

```ts
import { MarkdownEditor } from '@navette-js/forms';

MarkdownEditor.make('content')
    .live({ debounce: 500 })
```

## Field lifecycle

Each field goes through a lifecycle: it is filled when the form is loaded, updated when the user interacts with it, and its state is extracted when the form is submitted.

### Field hydration

Hydration fills the fields with data. On an Edit page, each field receives the value of the record's attribute of the same name, and shapes it for its control: a date picker keeps the `YYYY-MM-DD` part of a date-time, a checkbox list parses a JSON string into a list, a rich editor converts HTML into an editor document. On a Create page, each field receives its [default value](#setting-the-default-value-of-a-field).

To change the record's data before it fills the form, override `mutateFormDataBeforeFill()` on the Edit page.

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

`set()` accepts the plain name of a sibling field: inside a repeater item, `set('amount', …)` changes the amount of the same row. Names containing a dot are ignored. Setting a field this way does not call that field's own `afterStateUpdated()`.

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

#### Preventing a field from being saved

You may prevent a field from being saved using `dehydrated(false)`. In this example, the field is not present in the data passed to the page's save hooks and to the data adapter:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password_confirmation')
    .password()
    .dehydrated(false)
```

<Aside variant="info">
Even when a field is not saved, it is still validated. A field that is only disabled is not validated.
</Aside>

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

## Global settings

If you wish to change the default behavior of all fields of a type, call the static `configureUsing()` method once, when your application starts. The function receives every instance created afterwards by `make()`, before your own method calls, so an explicit setting still wins:

```ts
import { Select, TextInput } from '@navette-js/forms';

TextInput.configureUsing((input) => input.maxLength(255));
Select.configureUsing((select) => select.searchable());
```

The setting also applies to subclasses: `Field.configureUsing()` changes every field.
