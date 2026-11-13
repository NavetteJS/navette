---
title: Custom fields
---

## Introduction

When none of the built-in fields fits your data, you may create your own field. A custom field is a class extending `Field`, which renders its control in `toHtml()` and hands it to `wrap()`. `wrap()` adds what every field shares: the label, the required mark, the hint, the helper text and the validation error.

```ts
import { Field } from '@navette-js/forms';
import { configured, e } from '@navette-js/support';

export class LocationPicker extends Field {
    static make(name: string): LocationPicker {
        return configured(new LocationPicker(name));
    }

    async toHtml(): Promise<string> {
        return this.wrap(`<div class="fi-input-wrp"><div class="fi-input-wrp-content-ctn">
            <input type="text" id="${e(this.getId())}" wire:model="${e(this.getStatePath())}" class="fi-input" />
        </div></div>`);
    }
}
```

You may use it in a form like any other field:

```ts
LocationPicker.make('location')
    .label('Office location')
    .required()
```

```preview
// state: {"location": "12 Rue de Rivoli, Paris"}
// width: 32rem
class LocationPicker extends Field {
    static make(name) {
        return configured(new LocationPicker(name));
    }

    async toHtml() {
        return this.wrap(`<div class="fi-input-wrp"><div class="fi-input-wrp-content-ctn">
            <input type="text" id="${e(this.getId())}" wire:model="${e(this.getStatePath())}" class="fi-input" />
        </div></div>`);
    }
}

return LocationPicker.make('location')
    .label('Office location')
    .required()
```

Your field inherits all the [shared field methods](/forms/overview): `label()`, `required()`, `disabled()`, `default()`, `helperText()`, `hint()`, `visible()`, `afterStateUpdated()`, `rule()`…

## Generating a field class

The CLI creates a field class in `src/fields`, with an Alpine.js control entangled with the state and a validation rule to adapt:

```bash
npx navette make:field RatingInput
```

Import it in your resource like any field: `RatingInput.make('rating').required()`. The command never overwrites an existing file, unless you pass `--force`.

## Custom field classes

### Creating instances with configured()

Create instances in `make()` with `configured(new YourField(name))`, from `@navette-js/support`. This applies the [global settings](/forms/overview#global-settings) registered with `configureUsing()`, on your class and on its parents.

### Binding a field to its state

The state path of the field (for example `data.location`) is returned by `getStatePath()`. For a native input, bind it with `wire:model`. The value is then sent with the next request, or immediately with `wire:model.live`.

For an interactive control, write an [Alpine.js](https://alpinejs.dev) component and entangle a variable with the state:

```ts
import { e, js } from '@navette-js/support';

`<div x-data="{ state: $wire.$entangle(${e(js(this.getStatePath()))}) }">…</div>`
```

`js()` turns a value into a JavaScript expression, and `e()` escapes it for the HTML attribute. `$entangle(path, true)` sends each change to the server immediately.

### Accessing the state of other fields

`this.context()` returns the [field context](/forms/overview#using-the-field-context): `state` (the field's own value), `get()` (the value of another field), `record`, `operation` and `livewire`:

```ts
async toHtml(): Promise<string> {
    const { state, get, record, operation } = this.context();
    // ...
}
```

### Adding a configuration method to a custom field class

You may add your own fluent methods. To accept a function of the field context, as the built-in methods do, type the property with `Lazy` and resolve it with `evaluate()`:

```ts
import { Field } from '@navette-js/forms';
import type { ComponentContext } from '@navette-js/schemas';
import { configured, e, evaluate, js, type Lazy } from '@navette-js/support';

export class RatingInput extends Field {
    protected _stars: Lazy<number, ComponentContext> = 5;

    static make(name: string): RatingInput {
        return configured(new RatingInput(name));
    }

    stars(stars: Lazy<number, ComponentContext>): this {
        this._stars = stars;

        return this;
    }

    async getStars(): Promise<number> {
        return evaluate(this._stars, this.context());
    }

    async toHtml(): Promise<string> {
        const id = this.getId();
        const stars = await this.getStars();
        const disabled = await this.isDisabled();
        const buttons = Array.from({ length: stars }, (_, index) => `
            <button type="button" aria-label="${index + 1} / ${stars}" x-on:click="state = ${index + 1}"
                x-bind:aria-pressed="(state >= ${index + 1}).toString()"${disabled ? ' disabled' : ''}>★</button>`).join('');

        return this.wrap(
            `<div id="${e(id)}" role="group" aria-labelledby="${e(id)}-label" x-data="{ state: $wire.$entangle(${e(js(this.getStatePath()))}) }">${buttons}</div>`,
            { labelAsDiv: true },
        );
    }
}
```

```ts
RatingInput.make('rating')
    .stars(({ get }) => (get('type') === 'detailed' ? 10 : 5))
```

### Configuring the wrapper

`wrap(html, options)` accepts these options:

| Option | Description |
|---|---|
| `labelAsDiv` | Renders the label as a `<div id="<id>-label">` instead of a `<label for="<id>">`. Use it when the control is a group (radio buttons, stars…), and reference the label with `aria-labelledby`. |
| `labelPrefix` | HTML placed before the label, on the same line, like the box of a checkbox. |
| `after` | HTML placed after the control and before the error message. |
| `wrapperClass` | A class added to the field wrapper. |
| `focusable` | Adds `tabindex="-1"` to the wrapper, so that it can receive focus from a script (the toggle buttons use it for groups of radio inputs). |

The validation error is rendered with the id `<id>-error`. When the field has an error, `this.hasError()` is `true`: set `aria-invalid="true"` on your control, and reference the error with `aria-describedby`.

## Shaping the state

You may override these methods to control the field's value:

| Method | Description |
|---|---|
| `getDefaultState()` | The value of a new form. Call `super.getDefaultState()` to keep `default()` working. |
| `hydrateState(value)` | Shapes the record's value when it fills the form. |
| `dehydrateState(state)` | Shapes the state before it is saved. May be asynchronous. |
| `getValidationRules()` | The field's rules. Call `super.getValidationRules()` to keep `required()` and `rule()`. |

The state comes from the browser: validate its shape in `getValidationRules()`, and never let `dehydrateState()` save something you have not checked.

```ts
import { Field } from '@navette-js/forms';

export class RatingInput extends Field {
    // ...

    async getValidationRules() {
        const max = await this.getStars();

        return [
            ...(await super.getValidationRules()),
            {
                name: 'between',
                passes: (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= max,
                message: (attribute: string) => `The ${attribute} field must be between 1 and ${max}.`,
            },
        ];
    }

    dehydrateState(state: unknown): unknown {
        return state === null || state === undefined || state === '' ? null : Number(state);
    }
}
```

## Rendering the field with a view

When the markup grows, move it to an [EJS](https://ejs.co) view. Register a namespace for your views once, when your application starts, then render a view with `views.render()`:

```ts
import path from 'node:path';
import { views } from '@navette-js/support';

views.namespace('app', path.resolve('./views'));
```

```ts
async toHtml(): Promise<string> {
    return this.wrap(views.render('app::fields.rating', {
        id: this.getId(),
        statePath: this.getStatePath(),
        stars: await this.getStars(),
    }));
}
```

The view `views/fields/rating.ejs` receives your data, plus helpers such as `e`, `js` and `t` (translations). In a view, `<%= value %>` escapes the value, and `<%- html %>` inserts it as is:

```html
<div id="<%= id %>" role="group" aria-labelledby="<%= id %>-label" x-data="{ state: $wire.$entangle(<%= js(statePath) %>) }">
    <% for (let star = 1; star <= stars; star++) { %>
        <button type="button" x-on:click="state = <%= star %>">★</button>
    <% } %>
</div>
```

Resolve everything asynchronous (labels, options, `evaluate()` results) in `toHtml()` before calling `views.render()`: views are synchronous.

## Calling field methods from JavaScript

The JavaScript of your field may call methods of the field on the server, for example to search options. List the names of the callable methods in `getExposedMethods()`:

```ts
import { Field } from '@navette-js/forms';

export class CityPicker extends Field {
    getExposedMethods(): string[] {
        return ['searchCities'];
    }

    async searchCities(search: unknown): Promise<string[]> {
        const term = String(search ?? '').slice(0, 100).toLowerCase();

        return (await listCities()).filter((city) => city.toLowerCase().includes(term)).slice(0, 20);
    }

    // ...
}
```

From the field's Alpine component, call it with `$wire.callSchemaComponentMethod()`, passing the field's key (`this.getKey()`), the method name and its arguments, as a list or as an object whose values are passed in order:

```ts
`<div x-data="{
    results: [],
    async search(term) {
        this.results = await $wire.callSchemaComponentMethod(${e(js(this.getKey()))}, 'searchCities', { search: term })
    },
}">…</div>`
```

Only exposed methods can be called. By default, the call does not re-render the component. If the method changes the form and the component must be re-rendered, override `isRenderlessMethod(method)` to return `false` for it.

<Aside variant="danger">
An exposed method is an endpoint: anyone who can open the page can call it with any arguments. Treat the arguments as untrusted input, check permissions, and limit the size of what you return.
</Aside>

## Security

- Escape every value you insert in HTML with `e()` (or `<%= %>` in a view). A custom field that inserts a raw value opens an XSS hole.
- Validate the state on the server, in `getValidationRules()`. Attributes such as `min`, `max` or `required` on your input only guide the browser.

<Aside variant="warning">
Rendering fields with JavaScript frameworks (React, Vue, Svelte) is not available yet. Write the control with Alpine.js, or mount your framework component yourself from an Alpine `x-init`.
</Aside>
