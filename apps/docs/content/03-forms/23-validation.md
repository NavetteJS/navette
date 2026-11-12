---
title: Validation
---

## Introduction

Validation rules may be added to any [field](/forms/overview#form-fields).

In Navette, every rule runs on the server. Fields also set the matching HTML attributes (`required`, `maxlength`, `min`, `max`…) so the browser can warn the user early, but these attributes are only a convenience: a request crafted outside the browser still goes through the server-side rules.

The form is validated:

- when a resource's Create or Edit form is submitted,
- before the action of a modal with a form is run,
- when the user clicks "Next" in a wizard, for the fields of the current step.

When a field fails, its first error message is displayed below it, escaped, and nothing is saved.

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('email')
    .required()
    .email()
    .maxLength(255)
    .unique({ ignoreRecord: true })
```

```preview
// state: {"email": "ada@example"}
// errors: {"data.email": ["The email field must be a valid email address."]}
// width: 32rem
TextInput.make('email')
    .required()
    .email()
    .maxLength(255)
    .unique({ ignoreRecord: true })
```

## Understanding how rules run

For each field, `required` runs first, then the other rules in the order you added them. Validation stops at the first failing rule of the field.

- **Empty values skip the other rules.** When the value is empty (`null`, an empty string or an empty list), only `required` is checked. An optional field may therefore be left empty even if it has `minLength()` or `email()`.
- **Hidden fields are not validated.** Neither are the fields of a hidden section, tab or other layout component.
- **Disabled fields are not validated**, unless they are `dehydrated()`, since their value is not saved.
- **Fields that are not saved are still validated.** A field with `dehydrated(false)`, such as a password confirmation, keeps its rules.

## Available rules

### Required

The field must have a value. `null`, an empty string, an empty list and `false` fail:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .required()
```

`required()` also accepts a function of the [field context](/forms/overview#using-the-field-context), and marks the label with an asterisk:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('company_name')
    .required(({ get }) => get('type') === 'company')
```

On a checkbox or a toggle, `required()` means the box must be checked. On a repeater, it means at least one item; on a file upload, at least one file; on a rich editor, some content.

### Email

The value must look like an email address: `name@domain.tld`. Available on text inputs:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('email')
    .email()
```

### URL

The value must be an `http://` or `https://` URL. Available on text inputs:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('website')
    .url()
```

### Telephone

The value must contain digits, spaces and the usual phone punctuation. Available on text inputs as `tel()`. See [phone number validation](/forms/text-input#phone-number-validation).

### Numeric and integer

The value must be a number (`numeric()`), or a whole number (`integer()`). Available on text inputs:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('quantity')
    .integer()
```

### Min and max value

The numeric value must be at least `minValue()` and at most `maxValue()`. Available on text inputs:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('price')
    .numeric()
    .minValue(0)
    .maxValue(99999999.99)
```

### Min and max length

The string must have at least `minLength()` and at most `maxLength()` characters. `minLength()` and `maxLength()` are available on text inputs and Markdown editors; textareas have `maxLength()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .minLength(2)
    .maxLength(255)
```

### Min and max date

The date must be on or after `minDate()`, and on or before `maxDate()`. Available on date pickers. See [min and max date validation](/forms/date-time-picker#min-and-max-date-validation).

### Unique

The value must not already exist in the database. The rule checks the column of the same name as the field, through the resource's data adapter. Use `ignoreRecord: true` on forms that edit a record, so that the record's own value is accepted, and `column` when the column has another name:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('email')
    .unique({ ignoreRecord: true })

TextInput.make('code')
    .unique({ column: 'sku', ignoreRecord: true })
```

The rule calls the adapter's `exists(column, value, ignoredKey)` method. It works on resource pages; on a component that has no `getDataAdapter()`, validation throws an error. The default adapter checks the whole table, like Laravel's `unique` rule.

### In

Fields with predefined options check that the submitted value is one of them: `Select`, `Radio`, `CheckboxList` and `ToggleButtons` do it automatically. See [select validation](/forms/select#select-validation).

### Hex color

`ColorPicker` checks that the value is a hexadecimal color. See [color picker validation](/forms/color-picker#color-picker-validation).

### Other built-in rules

- `FileUpload` validates file types, sizes and counts. See [file upload validation](/forms/file-upload#file-upload-validation).
- `Slider` validates that each value is a number within its range and on its step. See [slider](/forms/slider).
- `MarkdownEditor` and `CodeEditor` check that the value is a string.
- `OneTimeCodeInput` checks that the value has exactly `length()` digits.

## Custom rules

You may add any rule to a field with the `rule()` method. A rule has a `name`, a `passes()` function and a `message()` function:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('code')
    .rule({
        name: 'code_format',
        passes: (value) => /^[A-Z]{3}-\d{4}$/.test(String(value)),
        message: (attribute) => `The ${attribute} field format is invalid.`,
    })
```

```preview
// state: {"code": "abc-12"}
// errors: {"data.code": ["The code field format is invalid."]}
// width: 32rem
TextInput.make('code')
    .rule({
        name: 'code_format',
        passes: (value) => /^[A-Z]{3}-\d{4}$/.test(String(value)),
        message: (attribute) => `The ${attribute} field format is invalid.`,
    })
```

`passes()` receives the value and the [field context](/forms/overview#using-the-field-context), and may be asynchronous. It is not called when the value is empty: use `required()` for that.

You may use `get()` from the context to compare the value with other fields:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password_confirmation')
    .password()
    .required()
    .dehydrated(false)
    .rule({
        name: 'same',
        passes: (value, { get }) => value === get('password'),
        message: (attribute) => `The ${attribute} field must match password.`,
    })
```

Rules may also query the database. This one checks that a selected order belongs to the customer chosen in the form:

```ts
import { Select } from '@navette-js/forms';

Select.make('order_id')
    .options(async ({ get }) => listOrdersOf(get('customer_id')))
    .rule({
        name: 'exists',
        passes: async (value, { get }) => Boolean(await knex('orders').where({ id: value, customer_id: get('customer_id') }).first()),
        message: (attribute) => `The selected ${attribute} is invalid.`,
    })
```

## Validation messages

Navette's messages are Laravel's default English messages, such as "The name field is required.". The attribute in the message is the field's label in lower case.

`message()` receives this attribute. To change the wording of a built-in rule, replace the rule with your own: for example, use a custom rule instead of `maxLength()` to write your own length message.

Error messages are always escaped when displayed.

<Aside variant="warning">
Filament's `rules()` with Laravel rule strings, `validationAttribute()`, `validationMessages()`, translated messages and the Laravel rules without a dedicated method in Navette (`alpha`, `regex`, `confirmed`, `exists`, `different`, `uuid`…) are not available. Write them as custom rules with `rule()`.
</Aside>
