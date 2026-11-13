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

- **Empty values skip the other rules.** When the value is empty (`null`, an empty string or an empty list), only the rules about presence run: `required` and its conditional variants (`requiredIf()`, `requiredWith()`…), `prohibited`, `accepted` and `declined`. An optional field may therefore be left empty even if it has `minLength()` or `email()`.
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

`markAsRequired()` shows the asterisk without adding the rule (useful with [conditional requirements](#conditional-requirements)), and `markAsRequired(false)` hides it on a required field:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .required()
    .markAsRequired(false)
```

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

### Format rules

These rules check the shape of a text value:

| Method | Rule | Passes when the value… |
| --- | --- | --- |
| `alpha()` | `alpha` | only contains letters |
| `alphaDash()` | `alpha_dash` | only contains letters, numbers, dashes and underscores |
| `alphaNum()` | `alpha_num` | only contains letters and numbers |
| `ascii()` | `ascii` | only contains ASCII characters |
| `uuid()` / `ulid()` | `uuid` / `ulid` | is a UUID / a ULID |
| `json()` | `json` | is a valid JSON string |
| `ip()`, `ipv4()`, `ipv6()` | `ip`, `ipv4`, `ipv6` | is an IP address |
| `macAddress()` | `mac_address` | is a MAC address |
| `hexColor()` | `hex_color` | is a hexadecimal color |
| `multipleOf(5)` | `multiple_of:5` | is a multiple of the number |
| `startsWith(['https://'])` | `starts_with` | starts with one of the strings |
| `endsWith('.pdf')` | `ends_with` | ends with one of the strings |
| `doesntStartWith()` / `doesntEndWith()` | `doesnt_start_with` / `doesnt_end_with` | does not start / end with any of the strings |

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('username')
    .alphaDash()
    .doesntStartWith(['admin'])
```

### Regex

The value must match a pattern. Pass a `RegExp`, or a string written like Laravel's (`/pattern/flags`, with the `i`, `m`, `s` and `u` flags). `notRegex()` does the opposite:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('code')
    .regex(/^[A-Z]{3}-\d{4}$/)
    .notRegex('/^XXX/i')
```

### In and not in

Besides the automatic check of fields with options, `in()` accepts a list of values, or an object whose values are the allowed ones (such as a TypeScript `const` enum object, also accepted by `enum()`). `notIn()` rejects the values of the list. On a list value, every item is checked:

```ts
import { TextInput } from '@navette-js/forms';

const Status = { Draft: 'draft', Published: 'published' } as const;

TextInput.make('status')
    .enum(Status)

TextInput.make('username')
    .notIn(['admin', 'root'])
```

### Distinct

A list value (tags, multiple select, checkbox list) must not contain the same value twice:

```ts
import { TagsInput } from '@navette-js/forms';

TagsInput.make('tags')
    .distinct()
```

### Comparing with other fields

These rules compare the value with another field of the same form, read with `get()` relative to the field's container:

- `confirmed()`: the value must equal the `<name>_confirmation` field (or the field you pass).
- `same('field')` / `different('field')`: the value must equal / differ from the other field.
- `gt()`, `gte()`, `lt()`, `lte()`: the value must be greater than (or equal to), less than (or equal to) a number or another field. Text is compared by length, numbers by value.

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password')
    .password()
    .confirmed()

TextInput.make('password_confirmation')
    .password()
    .dehydrated(false)

TextInput.make('max_price')
    .numeric()
    .gte('min_price')
```

### Conditional requirements

These rules make a field required, or forbid a value, depending on other fields. Unlike the other rules, they also run when the value is empty:

| Method | The field is required when… |
| --- | --- |
| `requiredIf('type', 'company')` | `type` has one of the values |
| `requiredUnless('type', ['person'])` | `type` has none of the values |
| `requiredIfAccepted('newsletter')` | `newsletter` is checked |
| `requiredWith('company')` / `requiredWithAll([...])` | one / all of the fields have a value |
| `requiredWithout('phone')` / `requiredWithoutAll([...])` | one / all of the fields are empty |

`prohibited()` rejects any value; `prohibitedIf()` and `prohibitedUnless()` do it depending on another field, and `prohibits(['other'])` rejects the other fields when this one has a value.

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('company_name')
    .requiredIf('customer_type', 'business')

TextInput.make('phone')
    .requiredWithout('email')
```

These rules do not show the required asterisk, since it depends on other values. To show it, use `markAsRequired()` (see [required](#required)); to show it only in some cases, combine `required()` with a function and `live()` on the other field.

### Exists

The value must exist in the database. Without an argument, the rule checks the column of the same name through the resource's data adapter, like `unique()`. You may pass another column, another adapter (to check another table), or a function:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { TextInput } from '@navette-js/forms';

TextInput.make('brand_id')
    .exists({ adapter: new ObjectionAdapter(Brand), column: 'id' })

TextInput.make('coupon')
    .exists(async (value) => Boolean(await knex('coupons').where({ code: value, active: true }).first()))
```

On a list value, every item must exist.

### Other built-in rules

- `FileUpload` validates file types, sizes and counts. See [file upload validation](/forms/file-upload#file-upload-validation).
- `Slider` validates that each value is a number within its range and on its step. See [slider](/forms/slider).
- `MarkdownEditor` and `CodeEditor` check that the value is a string.
- `OneTimeCodeInput` checks that the value has exactly `length()` digits.

## Laravel rule strings

`rules()` adds several rules written as Laravel rule strings, in a list or separated by `|`. `rule()` adds one:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('slug')
    .rules(['required', 'alpha_dash', 'max:64'])

TextInput.make('quantity')
    .integer()
    .rules('min:1|max:99')
```

Supported rules: `required`, `filled`, `nullable`, `sometimes`, `bail`, `string`, `present`, `accepted`, `declined`, `numeric`, `integer`, `boolean`, `array`, `email`, `url`, `uuid`, `ulid`, `alpha`, `alpha_dash`, `alpha_num`, `ascii`, `lowercase`, `uppercase`, `json`, `ip`, `ipv4`, `ipv6`, `mac_address`, `hex_color`, `date`, `min`, `max`, `size`, `between`, `digits`, `digits_between`, `multiple_of`, `in`, `not_in`, `regex`, `not_regex`, `starts_with`, `ends_with`, `doesnt_start_with`, `doesnt_end_with`, `distinct`, `confirmed`, `same`, `different`, `gt`, `gte`, `lt`, `lte`, `after`, `after_or_equal`, `before`, `before_or_equal` (with a date, `today`, `tomorrow` or a field), `required_if`, `required_unless`, `required_if_accepted`, `required_with`, `required_with_all`, `required_without`, `required_without_all`, `prohibited`, `prohibited_if`, `prohibited_unless` and `prohibits`.

`min`, `max`, `size` and `between` compare the number on a `numeric()` or `integer()` field, the number of items on a list, and the length of the text otherwise. `nullable`, `sometimes`, `bail`, `string` and `present` are accepted and do nothing, since empty values already skip the rules and validation stops at the first failure.

An unknown rule, or a malformed regex, throws an error when the field is declared. Rules that need the database (`unique`, `exists`) have their own methods.

### Conditional rules

`rule()` and `rules()` accept a condition, a boolean or a function of the [field context](/forms/overview#using-the-field-context):

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('vat_number')
    .rules(['required', 'regex:/^[A-Z]{2}\d+$/'], ({ get }) => get('country') !== 'US')
```

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

### Custom validation attribute

`validationAttribute()` changes the name of the field in its messages:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .validationAttribute('full name')
```

### Custom validation messages

`validationMessages()` replaces the message of a rule, by its name (the Laravel rule name: `required`, `max`, `regex`, `required_if`…). `:attribute` is replaced by the field's name. A message may also be a function that receives the attribute:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('email')
    .unique({ ignoreRecord: true })
    .validationMessages({
        unique: 'The :attribute has already been registered.',
        required: (attribute) => `Please enter your ${attribute}.`,
    })
```

```preview
// state: {"email": ""}
// errors: {"data.email": ["Please enter your email."]}
// width: 32rem
TextInput.make('email')
    .required()
    .validationMessages({ required: (attribute) => `Please enter your ${attribute}.` })
```

Error messages are always escaped when displayed.

<Aside variant="warning">
Messages are not translated yet: they are in English unless you replace them with `validationMessages()`.
</Aside>
