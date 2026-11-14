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

You may also render the control with a component of a JavaScript framework, such as React, Vue or Svelte: see [rendering fields with JavaScript frameworks](#rendering-fields-with-javascript-frameworks).

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

## Rendering fields with JavaScript frameworks

You may render the control of a field with a component of a JavaScript framework, such as React, Vue or Svelte, or with plain DOM code. Navette renders the field wrapper (label, helper text, validation error) and binds the component to the field state; your application brings the framework and builds the component into an ES module.

Use `JsField` and pass the URL of the module to `renderer()`:

```ts
import { JsField } from '@navette-js/forms';

JsField.make('location')
    .renderer('/js/fields/location-picker.js')
    .default({ latitude: 51.5, longitude: -0.12 })
```

The URL is resolved against the page URL. The browser imports the module when the field initializes, without a script tag or a global registry, and each field gets its own mounted instance, even when the module is already loaded for another field.

<Aside variant="danger">
Only use URLs of modules that your application serves, or `RawJs` code that you wrote: never let user input choose the module or appear in a `RawJs` expression. Renderers are not sandboxed and must follow your Content Security Policy. The state they send comes from the browser: validate it on the server, including for disabled or read-only fields.
</Aside>

`renderer()` also accepts a function of the [field context](/forms/overview#using-the-field-context), such as `({ record }) => …`. If a script you already load defines the mount function, you may pass a trusted `RawJs` expression instead of a URL: `.renderer(RawJs.make('window.mountLocationPicker'))`.

### Serving the module

The module must default-export a [mount function](#writing-a-renderer). Build it with your bundler (Vite, esbuild, Rollup…) as an ES module, and serve the output from a public folder, mounted with `express.static()` before the panel. For example, with esbuild:

```bash
npx esbuild resources/js/fields/location-picker.jsx --bundle --format=esm --minify --outfile=public/js/fields/location-picker.js
```

The bundle may include the framework, or import it from a URL that your application serves, so that several renderers share one copy. Add a version to the URL (`/js/fields/location-picker.js?v=3`) or a hash to the file name when you deploy a new build, so that browsers do not keep an old one.

### Writing a renderer

The mount function receives `host`, `props` and `utilities`. Render inside `host`, then return `update(props)`, which receives every change, and `destroy()`, which cleans up. `props` holds the state, the input settings and the callbacks that connect your input to the form. Each example below edits a latitude and a longitude, storing an empty input as `null`.

#### Creating a React field

Create `resources/js/fields/location-picker.jsx`. Apply the input props so that the label, the helper text, the validation error and the disabled or read-only states work:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';

function LocationPicker(props) {
    return ['latitude', 'longitude'].map((coordinate) => (
        <label key={coordinate}>
            {coordinate === 'latitude' ? 'Latitude' : 'Longitude'}
            <input
                id={coordinate === 'latitude' ? props.id : `${props.id}-longitude`}
                type="number"
                step="any"
                value={props.value?.[coordinate] ?? ''}
                disabled={props.isDisabled}
                readOnly={props.isReadOnly}
                required={props.isRequired}
                aria-invalid={props.isInvalid}
                aria-describedby={props.ariaDescribedBy}
                onChange={(event) => props.onChange({
                    ...props.value,
                    [coordinate]: event.target.value === '' ? null : Number(event.target.value),
                })}
                onBlur={props.onBlur}
            />
        </label>
    ));
}

export default function mountLocationPicker({ host, props: initialProps }) {
    const root = createRoot(host);
    const update = (props) => root.render(<LocationPicker {...props} />);

    update(initialProps);

    return { update, destroy: () => root.unmount() };
}
```

#### Creating a Vue field

Create `resources/js/fields/LocationPicker.vue`:

```vue
<script setup>
defineOptions({ inheritAttrs: false });

const props = defineProps(['value', 'id', 'isDisabled', 'isReadOnly', 'isRequired', 'isInvalid', 'ariaDescribedBy', 'onChange', 'onBlur']);

function changeCoordinate(coordinate, event) {
    props.onChange({
        ...props.value,
        [coordinate]: event.target.value === '' ? null : Number(event.target.value),
    });
}
</script>

<template>
    <label v-for="coordinate in ['latitude', 'longitude']" :key="coordinate">
        {{ coordinate === 'latitude' ? 'Latitude' : 'Longitude' }}
        <input
            :id="coordinate === 'latitude' ? props.id : `${props.id}-longitude`"
            type="number"
            step="any"
            :value="props.value?.[coordinate] ?? ''"
            :disabled="props.isDisabled"
            :readonly="props.isReadOnly"
            :required="props.isRequired"
            :aria-invalid="props.isInvalid"
            :aria-describedby="props.ariaDescribedBy"
            @input="changeCoordinate(coordinate, $event)"
            @blur="props.onBlur()"
        />
    </label>
</template>
```

Create `resources/js/fields/location-picker.js` to mount it, and build this entry with a bundler that compiles Vue components (Vite with `@vitejs/plugin-vue`, for example):

```js
import { createApp, h, shallowRef } from 'vue';
import LocationPicker from './LocationPicker.vue';

export default function mountLocationPicker({ host, props: initialProps }) {
    const props = shallowRef(initialProps);
    const application = createApp({
        setup: () => () => h(LocationPicker, props.value),
    });

    application.mount(host);

    return {
        update(nextProps) {
            props.value = nextProps;
        },
        destroy: () => application.unmount(),
    };
}
```

Without a build step, you may serve Vue's ES module browser build (`vue.runtime.esm-browser.prod.js`) from your public folder, import it by URL from your module, and write the component with render functions (`h()`) instead of a template.

#### Creating a Svelte field

Create `resources/js/fields/LocationPicker.svelte`:

```svelte
<script>
    let { value, id, isDisabled, isReadOnly, isRequired, isInvalid, ariaDescribedBy, onChange, onBlur } = $props();

    function changeCoordinate(coordinate, event) {
        onChange({
            ...value,
            [coordinate]: event.target.value === '' ? null : Number(event.target.value),
        });
    }
</script>

{#each ['latitude', 'longitude'] as coordinate (coordinate)}
    <label>
        {coordinate === 'latitude' ? 'Latitude' : 'Longitude'}
        <input
            id={coordinate === 'latitude' ? id : `${id}-longitude`}
            type="number"
            step="any"
            value={value?.[coordinate] ?? ''}
            disabled={isDisabled}
            readonly={isReadOnly}
            required={isRequired}
            aria-invalid={isInvalid}
            aria-describedby={ariaDescribedBy}
            oninput={(event) => changeCoordinate(coordinate, event)}
            onblur={onBlur}
        />
    </label>
{/each}
```

Create `resources/js/fields/location-picker.svelte.js` to mount it. The `.svelte.js` extension lets the Svelte compiler process `$state`. Build this entry with a bundler that compiles Svelte 5 components (Vite with `@sveltejs/vite-plugin-svelte`, for example):

```js
import { mount, unmount } from 'svelte';
import LocationPicker from './LocationPicker.svelte';

export default function mountLocationPicker({ host, props: initialProps }) {
    const props = $state({ ...initialProps });
    const component = mount(LocationPicker, { target: host, props });

    return {
        update: (nextProps) => Object.assign(props, nextProps),
        destroy: () => unmount(component),
    };
}
```

#### Creating a framework-free JavaScript field

You do not need a framework, nor a build step. This module creates the same inputs with the DOM APIs, and can be served as is:

```js
export default function mountLocationPicker({ host, props: initialProps }) {
    const coordinates = ['latitude', 'longitude'];
    let currentProps = initialProps;
    const inputs = Object.fromEntries(coordinates.map((coordinate) => {
        const label = document.createElement('label');
        const input = document.createElement('input');

        input.type = 'number';
        input.step = 'any';
        label.append(coordinate === 'latitude' ? 'Latitude' : 'Longitude', input);
        host.append(label);

        return [coordinate, input];
    }));

    const onInput = (event) => {
        const coordinate = coordinates.find((name) => inputs[name] === event.currentTarget);

        initialProps.onChange({
            ...currentProps.value,
            [coordinate]: event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
        });
    };

    for (const input of Object.values(inputs)) {
        input.addEventListener('input', onInput);
        input.addEventListener('blur', initialProps.onBlur);
    }

    const update = (props) => {
        currentProps = props;

        for (const coordinate of coordinates) {
            const input = inputs[coordinate];

            input.id = coordinate === 'latitude' ? props.id : `${props.id}-longitude`;
            input.value = props.value?.[coordinate] ?? '';
            input.disabled = props.isDisabled;
            input.readOnly = props.isReadOnly;
            input.required = props.isRequired;
            input.setAttribute('aria-invalid', String(props.isInvalid));
            input.setAttribute('aria-describedby', props.ariaDescribedBy);
        }
    };

    update(initialProps);

    return {
        update,
        destroy() {
            for (const input of Object.values(inputs)) {
                input.removeEventListener('input', onInput);
                input.removeEventListener('blur', initialProps.onBlur);
            }

            host.replaceChildren();
        },
    };
}
```

The examples leave the styling to you. Your component may use the panel's classes, such as `fi-input-wrp` and `fi-input`, to look like the other fields.

### Receiving state and emitting changes

Render the current state from `props.value`, and call `props.onChange(nextValue)` after a user interaction. Always pass the complete value instead of mutating the received object. Values must be JSON-serializable: `null`, numbers, strings, booleans, arrays or objects. Set the initial shape with `default()`, and handle a cleared value in your component.

The mount function and `update(props)` both receive the complete props, including `onChange()` and `onBlur()`. These callbacks keep the same references for the lifetime of the mounted field, so you may replace the props on each update or keep the callbacks for native event listeners. Do not call `onChange()` while receiving props or rendering, as this may create a feedback loop.

By default, edits update the local state and are sent with the next request, for example when the form is saved. Use `live()` to change this:

```ts
JsField.make('location')
    .renderer('/js/fields/location-picker.js')
    .live({ onBlur: true })
```

`live()` sends each change immediately, `live({ onBlur: true })` waits for `props.onBlur()`, and `live({ debounce: 500 })` waits until 500 milliseconds after the latest edit (`'0.5s'` and `'500ms'` are also accepted). Other requests may send pending edits earlier.

#### Applying accessibility and input state

Apply the input props as in the examples:

| Prop | Description |
|---|---|
| `value` | The field state. |
| `configuration` | The [configuration](#passing-configuration-from-the-server) set on the server. |
| `id` | Put it on the primary input, so that the field label targets it. Label additional inputs yourself. |
| `ariaDescribedBy` | Ids of the helper text and of the validation error. Append your own ids instead of replacing it. |
| `isDisabled`, `isReadOnly`, `isRequired` | The field's `disabled()`, `readOnly()` and `required()` settings. |
| `isInvalid` | `true` when the field has a validation error, displayed by Navette under the control. |
| `isLive`, `isLiveOnBlur`, `debounce` | The state binding set with `live()`. |
| `onChange(value)`, `onBlur()` | Callbacks to call on edits and when the control loses focus. |

The field is validated on the server like any other: its `required()` setting and its `rule()` rules apply to the value sent by the component. When validation fails, the component receives `isInvalid: true` and the error id in `ariaDescribedBy`, without being remounted.

While the field is disabled or read-only, Navette ignores `onChange()`. A disabled field is not saved; a read-only field is, so validate its value on the server.

### Passing configuration from the server

Pass configuration to the renderer with `rendererConfiguration()`, and read it from `props.configuration`:

```ts
JsField.make('location')
    .renderer('/js/fields/location-picker.js')
    .rendererConfiguration({ zoom: 12 })
```

The configuration is separate from the built-in props, such as `value` and `onChange`, so it cannot override the state binding. Only pass JSON-serializable data meant for the browser, never secrets: it is written into the page. Changing it in JavaScript does not change it on the server.

`rendererConfiguration()` also accepts a function of the field context. For example, the selected country may configure the location picker:

```ts
JsField.make('location')
    .renderer('/js/fields/location-picker.js')
    .rendererConfiguration(({ get }) => ({
        country: get('country'),
        zoom: 12,
    }))
```

The function runs each time the field is rendered on the server, and the renderer is updated without being remounted. Make the country field `live()` so that its changes are sent immediately.

### Accessing schema utilities

Accept `utilities` next to `host` and `props` in the mount function to reach the rest of the form. For example, an event handler may read or change a sibling field:

```js
const country = utilities.$get('country');
await utilities.$set('country', 'GB');
```

`$get(path, isAbsolute)` and `$set(path, value, isAbsolute, isLive = false)` take paths relative to the field's container, unless `isAbsolute` is `true`. `$set()` is deferred unless `isLive` is `true`. Use `props.onChange()` for the field's own edits. `utilities.$statePath` is the field's absolute state path, and `utilities.$state` reads its current value. Treat returned values as read-only, and do not destructure `utilities`: `$state` is a getter. Reads do not follow later changes of other fields: use the [server configuration](#passing-configuration-from-the-server) for that.

The [exposed methods](#calling-field-methods-from-javascript) of your field class are also available, prefixed with `$`: `await utilities.$searchCities({ search: 'Par' })`, or `utilities.$callSchemaComponentMethod('searchCities', { search: 'Par' })`. `utilities.$wire` is the page component, for example to call one of its methods with `utilities.$wire.$call('save')`. Handle request failures, and stop using `utilities` once the renderer is destroyed.

### Typing renderers

The types of the mount function are exported by `@navette-js/forms`. Import them with `import type`, so that your bundler does not load the package in the browser:

```ts
import type { JsFieldRenderer } from '@navette-js/forms';

type Location = { latitude: number | null; longitude: number | null } | null;
type Configuration = { zoom: number };

const mountLocationPicker: JsFieldRenderer<Location, Configuration> = ({ host, props, utilities }) => {
    // Mount your component with `props` and `utilities`.

    return {
        update(nextProps) {
            // Update it with `nextProps.value` and `nextProps.configuration`.
        },
        destroy() {
            // Unmount it and remove listeners.
        },
    };
};

export default mountLocationPicker;
```

A third type argument declares the exposed methods: `JsFieldRenderer<Location, Configuration, { $searchCities(args: { search: string }): Promise<string[]> }>`. `JsFieldProps`, `JsRendererUtilities`, `JsRendererContext` and `JsRendererInstance` type the parts of an implementation. The types describe read-only snapshots; they do not replace server-side validation.

### Synchronizing and disposing renderers

`mount()` may return the `{ update, destroy }` object or a promise of it. Changes from the server update the renderer, and cancel a pending debounced edit when the incoming value differs. When the field is removed, pending edits are cancelled and `destroy()` is called; a renderer that finishes mounting after its removal is destroyed at once. Clean up subscriptions, listeners and framework roots in `destroy()`, even when the host is already detached.

Changing the renderer or the `live()` settings remounts the renderer with the current state. Changes to the configuration and to `isInvalid`, `isRequired`, `isDisabled` or `isReadOnly` update it in place. Keep data that must survive in the field value, not only in the component's local state.

Render only inside `host`, whose content is ignored when the page is updated, and do not change its parent or siblings. Records, closures and child schemas are not available inside it: compute serializable data in `rendererConfiguration()`, and keep actions, hints and child schemas outside the renderer.

If importing, mounting or `update()` fails, the field shows an accessible error message, the field value is unchanged, and the error is logged in the browser console with the renderer URL. Handle errors in your component's rendering and event handlers with your framework's own error handling.

### Customizing the markup around the renderer

A `JsField` has no view to replace: its `toHtml()` returns the field already wrapped (label, helper text, error) around the renderer's host, like Filament's `toEmbeddedHtml()`. To add your own markup, subclass it and build on `super.toHtml()`, keeping your content outside the renderer's host:

```ts
import { JsField } from '@navette-js/forms';
import { e } from '@navette-js/support';

export class MapField extends JsField {
    async toHtml(): Promise<string> {
        return `<div class="map-field">${await super.toHtml()}<p class="map-field-credits">${e('Map data © OpenStreetMap')}</p></div>`;
    }
}
```

The returned markup already includes the field wrapper: do not call `wrap()` again around it. The same applies to every built-in field, whose `toHtml()` can be extended the same way.

### Building reusable fields

To ship a field that renders with JavaScript, extend `JsField` and override `getRenderer()`. Your field is then used without a renderer URL:

```ts
import { JsField } from '@navette-js/forms';
import { configured } from '@navette-js/support';

export class LocationPicker extends JsField {
    protected _zoom = 12;

    static make(name: string): LocationPicker {
        return configured(new LocationPicker(name));
    }

    zoom(zoom: number): this {
        this._zoom = zoom;

        return this;
    }

    async getRenderer(): Promise<string> {
        return '/vendor/location-picker/location-picker.js';
    }

    async getRendererConfiguration(): Promise<Record<string, unknown>> {
        return { zoom: this._zoom };
    }
}
```

```ts
LocationPicker.make('location').zoom(8).live()
```

Serve the module at that URL, for example with `express.static()` on the folder of your package's prebuilt module. The class may also [expose methods](#calling-field-methods-from-javascript) and define [validation rules](#shaping-the-state), like any custom field.

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
- A `JsField` renderer runs with the rights of the page: only load modules that your application serves, never build a renderer URL or a `RawJs` expression from user input, and keep secrets out of the renderer configuration.
