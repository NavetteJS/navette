---
title: Text input
---

## Introduction

The text input allows you to interact with a string:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
```

```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name')
```

## Setting the HTML input type

You may set the type of string using a set of methods. Some, such as `email()`, also add a validation rule:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('text')
    .email() // or
    .numeric() // or
    .integer() // or
    .password() // or
    .tel() // or
    .url()
```

| Method | Input type | Server-side rule |
|---|---|---|
| `email()` | `email` | The value must look like `name@domain.tld`. |
| `numeric()` | `number`, with `inputmode="decimal"` | The value must be a finite number. |
| `integer()` | `number`, with `inputmode="numeric"` | The value must be a whole number. |
| `password()` | `password` | None. |
| `tel()` | `tel` | Digits, spaces, `+`, parentheses and the usual separators. |
| `url()` | `url` | An `http://` or `https://` address. |

You may instead use the `type()` method to pass another [HTML input type](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types). This does not add any rule:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('background_color')
    .type('color')
```

```preview
// state: {"background_color": "#3b82f6"}
TextInput.make('background_color')
    .type('color')
```

<Aside variant="warning">
`email()` always adds its rule: `email(false)` does not remove it in the current version.
</Aside>

## Setting the numeric step

`numeric()` sets the `step` attribute to `any`, and `integer()` sets it to `1`. You may set another step with the `step()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('price')
    .numeric()
    .step(0.01)
```

The step only guides the browser's input: it is not checked on the server. To enforce a precision, add a [custom rule](/forms/validation#custom-rules).

## Autocompleting text

You may allow the text to be autocompleted by the browser using the `autocomplete()` method. `true` sets `autocomplete="on"`, `false` sets `autocomplete="off"`, and a string is used as is:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password')
    .password()
    .autocomplete('new-password')
```

## Adding affix text aside the field

You may place text before and after the input using the `prefix()` and `suffix()` methods:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('domain')
    .prefix('https://')
    .suffix('.com')
```

```preview
// state: {"domain": "navette"}
TextInput.make('domain')
    .prefix('https://')
    .suffix('.com')
```

The affixes are escaped. Icons and actions as affixes are not available yet.

## Revealable password inputs

When using `password()`, you can also make the input `revealable()`, so that the user can see a plain text version of the password they're typing by clicking a button:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('password')
    .password()
    .revealable()
```

```preview
// state: {"password": "correct-horse-battery"}
TextInput.make('password')
    .password()
    .revealable()
```

## Input masking

Input masking is the practice of defining a format that the input value must conform to. You may define a static mask pattern with the `mask()` method, using the [Alpine.js mask](https://alpinejs.dev/plugins/mask) syntax:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('phone')
    .tel()
    .mask('(999) 999-9999')
```

```preview
// state: {"phone": "(555) 123-4567"}
TextInput.make('phone')
    .tel()
    .mask('(999) 999-9999')
```

The mask only guides typing in the browser. It is not a validation rule: always add the rules your data needs, as `tel()` does here.

## Making the field live

The text input accepts `live()`, which sends its value to the server on every keystroke, and `live({ onBlur: true })`, which sends it when the input loses focus. See [reactivity](/forms/overview#the-basics-of-reactivity).

## Text input validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to text inputs.

### Length validation

You may limit the length of the input by setting the `minLength()` and `maxLength()` methods. These methods add both frontend and backend validation:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .minLength(2)
    .maxLength(255)
```

### Size validation

You may validate the minimum and maximum value of a numeric input by setting the `minValue()` and `maxValue()` methods:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('number')
    .numeric()
    .minValue(1)
    .maxValue(100)
```

### Phone number validation

When using `tel()`, the value is validated against this regular expression on the server: `/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\.\/0-9]*$/`.

To accept another format, use `type('tel')` instead, which sets the input type without adding a rule, and add your own [custom rule](/forms/validation#custom-rules).

<Aside variant="warning">
`length()`, `datalist()`, `readOnly()`, `copyable()`, `trim()`, `inputMode()`, `autocapitalize()` and icon affixes are not available yet.
</Aside>
