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

### Autocompleting text with a datalist

You may specify [datalist](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/datalist) options for a text input using the `datalist()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('manufacturer')
    .datalist([
        'BMW',
        'Ford',
        'Mercedes-Benz',
        'Porsche',
        'Toyota',
        'Volkswagen',
    ])
```

Datalists provide autocomplete options to users when they use a text input. However, these are purely recommendations, and the user is still able to type any value into the input. If you're looking to strictly limit users to a set of predefined options, check out the [select field](/forms/select). The datalist is not rendered when the field is disabled or read-only.

## Autocapitalizing text

You may control how the browser's virtual keyboard capitalizes the text using the `autocapitalize()` method. It accepts `'none'`, `'sentences'`, `'words'` or `'characters'`; `true` sets `autocapitalize="on"` and `false` sets `autocapitalize="off"`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .autocapitalize('words')
```

## Setting the input mode

You may set the [`inputmode` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode) of the input using the `inputMode()` method, so mobile devices show a suitable virtual keyboard: `none`, `text`, `decimal`, `numeric`, `tel`, `search`, `email` or `url`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('pin')
    .inputMode('numeric')
```

Without `inputMode()`, `numeric()` sets `inputmode="decimal"` and `integer()` sets `inputmode="numeric"`.

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

The affixes are escaped.

### Using icons as affixes

You may place an [icon](/styling/icons) before and after the input using the `prefixIcon()` and `suffixIcon()` methods:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('domain')
    .url()
    .suffixIcon('m-globe-alt')
```

```preview
// state: {"domain": "https://navette.dev"}
TextInput.make('domain')
    .url()
    .suffixIcon('m-globe-alt')
```

#### Setting the affix icon's color

Affix icons are gray by default, but you may set a different color using the `prefixIconColor()` and `suffixIconColor()` methods:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('domain')
    .url()
    .suffixIcon('m-check-badge')
    .suffixIconColor('success')
```

```preview
// state: {"domain": "https://navette.dev"}
TextInput.make('domain')
    .url()
    .suffixIcon('m-check-badge')
    .suffixIconColor('success')
```

### Using actions as affixes

You may place an [action](/actions/overview) before and after the input using the `prefixAction()` and `suffixAction()` methods. The action is rendered as an icon button. Its callbacks receive the field's `state`, and a `set(name, value)` function that changes a field of the same form:

```ts
import { Action } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';

TextInput.make('code')
    .suffixAction(
        Action.make('uppercase')
            .label('Uppercase')
            .icon('m-arrow-up')
            .action(({ state, set }) => {
                set!('code', String(state ?? '').toUpperCase());
            }),
    )
```

```preview
// state: {"code": "nav-1042"}
TextInput.make('code')
    .suffixAction(
        Action.make('uppercase')
            .label('Uppercase')
            .icon('m-arrow-up')
            .action(() => {}),
    )
```

`prefixAction()` and `suffixAction()` may be called several times to add more actions, and `prefixActions()` and `suffixActions()` replace the list. Hidden actions are not rendered.

### Displaying affixes inside the input

By default, affixes are displayed in a separate box next to the input. You may display them inside the input instead by passing `true` as the second argument of `prefix()`, `suffix()`, `prefixIcon()`, `suffixIcon()`, `prefixAction()` or `suffixAction()`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('price')
    .numeric()
    .prefix('$', true)
```

```preview
// state: {"price": "49.90"}
TextInput.make('price')
    .numeric()
    .prefix('$', true)
```

The prefix label, icon and actions share one setting, and so do the suffix ones: the last of these methods to be called decides whether the prefix (or suffix) is inline.

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

## Allowing the text to be copied to the clipboard

You may make the text copyable, so that clicking a button after the input copies the text to the clipboard, and optionally specify a custom confirmation message and its duration in milliseconds. This feature only works when SSL is enabled for the app (or on `localhost`), because the browser's clipboard API requires a secure context:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('api_key')
    .copyable(true, 'Copied!', 1500)
```

```preview
// state: {"api_key": "nv_live_7f3a9c21"}
TextInput.make('api_key')
    .copyable(true, 'Copied!', 1500)
```

By default, the message is "Copied" and it is shown for 2000 milliseconds. `copyable(false)` removes the button.

## Making the field read-only

Not to be confused with [disabling the field](/forms/overview#disabling-a-field), you may make the field "read-only" using the `readOnly()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .readOnly()
```

```preview
// state: {"name": "Ada Lovelace"}
TextInput.make('name')
    .readOnly()
```

There are a few differences, compared to `disabled()`:

- When using `readOnly()`, the field will still be sent to the server when the form is submitted. It can be mutated with the browser console, or via JavaScript. You can use [`dehydrated(false)`](/forms/overview#preventing-a-field-from-being-saved) to prevent this.
- There are no styling changes, such as less opacity, when using `readOnly()`.
- The field is still focusable when using `readOnly()`.
- The field is still validated on the server, but the browser's `required` check is dropped.

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

## Trimming whitespace

You can automatically trim whitespace from the beginning and end of the value using the `trim()` method. The value is trimmed before it is validated and saved:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('name')
    .trim()
```

You may want to enable trimming globally for all text inputs, as Laravel's `TrimStrings` middleware does. You can do this once, when the application starts, with the `configureUsing()` method:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.configureUsing((component) => {
    component.trim();
});
```

As well as allowing a static value, the `trim()` method also accepts a function of the [field context](/forms/overview#using-the-field-context).

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

You can also specify the exact length of the input by setting the `length()` method. This method adds both frontend and backend validation:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('code')
    .length(8)
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

