---
title: Custom components
---

## Introduction

For a one-off piece of content, insert [HTML into your schema](#inserting-html-into-a-schema). For a reusable component with its own configuration, write a [component class](#custom-component-classes): a TypeScript class that extends `Component` from `@navette-js/schemas` and renders its HTML. To create one, run:

```bash
npx navette make:schema-component Chart
```

Then customize the generated class, following [custom component classes](#custom-component-classes). Most custom components can render their HTML with the schema's existing utilities; use a [nested Livewire component](#inserting-a-livewire-component-into-a-schema) when you need a separately managed component with its own state and requests.

Use a [custom field](/forms/custom-fields) for an input with state binding and validation, and a [custom entry](/infolists/custom-entries) for a labelled read-only value.

## Inserting HTML into a schema

You may use the `Html` component to insert HTML into a schema. Pass it a string, or a function that receives the [context object](/schemas/overview#component-utility-injection):

```ts
import { Html } from '@navette-js/schemas';
import { e } from '@navette-js/support';

Html.make(({ record, operation }) => operation === 'create'
    ? '<p>This is a new post.</p>'
    : `<p>Editing ${e((record as Post).title)}.</p>`)
```

```preview
// record: {"title": "Announcing Navette"}
Html.make(({ record, operation }) => operation === 'create'
    ? '<p>This is a new post.</p>'
    : `<p>Editing ${e(record.title)}.</p>`)
```

From the context object, you may access the state of another component with `get()`, the current `record`, the current `operation`, and the page with `livewire`.

<Aside variant="danger">
The HTML is inserted as is. Escape every value that comes from a user or from the database with `e()` from `@navette-js/support`, otherwise your application will be vulnerable to XSS attacks.
</Aside>

<Aside variant="tip">
Unless a form field is `live()`, the HTML will not refresh when the value of the field changes, only when the next user interaction occurs that makes a request to the server.
</Aside>

## Inserting a Livewire component into a schema

You may insert a Livewire component (a component class of `@navette-js/wire`) directly into a schema:

```ts
import { Livewire } from '@navette-js/schemas';
import { SalesChart } from './livewire/SalesChart.ts';

Livewire.make(SalesChart)
```

The component is mounted as a child of the page. It has its own state and its own requests: calling one of its methods does not render the page again, and it keeps its state when the page renders again. For example:

```ts
import { Component } from '@navette-js/wire';
import { e } from '@navette-js/support';

export class SalesChart extends Component {
    static callable = ['setPeriod'];

    period = 'week';

    setPeriod(period: unknown): void {
        this.period = period === 'month' ? 'month' : 'week';
    }

    render(): string {
        return `<div><button type="button" wire:click="setPeriod('month')">Month</button> Sales of the ${e(this.period)}</div>`;
    }
}
```

The first time it is rendered, the class is registered with the runtime of the panel under the name `livewire.<name in kebab case>` (`livewire.sales-chart`). Register it yourself when your server starts, before `panelRouter()`, so that its requests are answered even when no page has rendered it since the server started (after a restart, for example). `Livewire.make()` then uses that name:

```ts
const runtime = new WireRuntime({ key });
runtime.register('livewire.sales-chart', SalesChart);

app.use(panelRouter(panel, runtime));
```

You may also pass the registered name instead of the class: `Livewire.make('livewire.sales-chart')`.

<Aside variant="info">
When inserting a Livewire component into the schema, there are limited capabilities. The nested component is rendered separately: it can't render a child schema, read the live state of another component, or access the page or the schema component. Only [the data that you pass to the Livewire component](#passing-parameters-to-a-livewire-component), and [the current record](#accessing-the-current-record-in-the-livewire-component) are accessible. Situations where you should render a nested Livewire component instead of a [component class](#custom-component-classes) are rare because of these limitations.
</Aside>

<Aside variant="warning">
A nested Livewire component does not inherit the authorization of its page. Its public properties are sent to the browser and come back with every request, and its callable methods can be called with any arguments: re-query and authorize the records it uses, and list in `static locked` the properties that the browser must not change. See [security](/advanced/security).
</Aside>

If you are rendering multiple of the same Livewire component, please make sure to pass a unique `key()` to each:

```ts
import { Livewire } from '@navette-js/schemas';

Livewire.make(SalesChart)
    .key('chart-first')

Livewire.make(SalesChart)
    .key('chart-second')
```

### Passing parameters to a Livewire component

You can pass an object of parameters to a Livewire component:

```ts
import { Livewire } from '@navette-js/schemas';

Livewire.make(SalesChart, { bar: 'baz' })
```

As well as allowing a static value, the `make()` method also accepts a function to dynamically calculate it. The function receives the [context object](/schemas/overview#component-utility-injection):

```ts
Livewire.make(SalesChart, ({ get }) => ({ currency: get('currency') }))
```

Now, those parameters will be passed to the Livewire component's `mount()` method:

```ts
export class SalesChart extends Component {
    mount(params: Record<string, unknown>): void {
        // params.bar
    }
}
```

Alternatively, they will be set on the public properties of the same name:

```ts
export class SalesChart extends Component {
    static locked = ['bar'];

    bar: string | null = null;
}
```

For server-provided configuration that should not be editable, list the property in `static locked`, like `bar` above.

#### Accessing the current record in the Livewire component

You can access the current record in the `mount()` method of the Livewire component, as `params.record`:

```ts
import { Component } from '@navette-js/wire';

export class SalesChart extends Component {
    static locked = ['productId'];

    productId: number | null = null;

    mount(params: Record<string, unknown>): void {
        this.productId = (params.record as Product | null)?.id ?? null;
    }
}
```

Keep the key of the record, not the record itself, in a public property: public properties are sent to the browser. Re-query the record from its key when you need it.

Please be aware that when the record has not yet been created, it will be `null`. If you'd like to hide the Livewire component when the record is `null`, you can use the `hidden()` method:

```ts
import { Livewire } from '@navette-js/schemas';

Livewire.make(SalesChart)
    .hidden(({ record }) => record === null)
```

### Lazy loading a Livewire component

You may allow the component to lazily load when it enters the viewport using the `lazyLoaded()` method. Its `placeholder()` is shown meanwhile:

```ts
import { Livewire } from '@navette-js/schemas';

Livewire.make(SalesChart)
    .lazyLoaded()
```

The parameters of a lazy component are written in the page (signed, but readable) until it loads. For this reason, the record is not passed to a lazy component: pass its key in the parameters instead, `Livewire.make(SalesChart, ({ record }) => ({ productId: (record as Product | null)?.id ?? null })).lazyLoaded()`, and never pass a secret.

## Custom component classes

You may create your own component classes, which you can reuse across your project. A component class extends `Component`, declares a static `make()` method, and implements the asynchronous `toHtml()` method, which returns the HTML of the component:

```ts
import { Component } from '@navette-js/schemas';

export class Chart extends Component {
    static make(): Chart {
        return new Chart();
    }

    async toHtml(): Promise<string> {
        return '<div class="chart"></div>';
    }
}
```

Use the class in your schema:

```ts
import { Chart } from './components/Chart.ts';

Chart.make()
```

To generate a component class, use the `make:schema-component` command. It creates `src/schemas/components/Chart.ts`, a component with a `heading()` [configuration method](#adding-a-configuration-method-to-a-custom-component-class) that accepts a function, and a `toHtml()` method that escapes it:

```bash
npx navette make:schema-component Chart
```

Navette places the HTML in the grid of the schema, so your component automatically supports `columnSpan()`, `hidden()`, `visible()`, `hiddenOn()` and the other methods shared by all components.

<Aside variant="info">
Navette schema components are not stateful components. Defining public properties on a component class does not send them to the browser: the component is rebuilt from your schema on every request.
</Aside>

### Accessing the context in a component class

Inside the class, `this.context()` returns the [context object](/schemas/overview#component-utility-injection): the current `record`, `operation`, the `get()` function, the page (`livewire`) and the component itself:

```ts
import { Component } from '@navette-js/schemas';
import { e } from '@navette-js/support';

export class PostStatus extends Component {
    static make(): PostStatus {
        return new PostStatus();
    }

    async toHtml(): Promise<string> {
        const { record, get } = this.context();

        if (record === null) {
            return '<p>This is a new post.</p>';
        }

        return `<p>Status: ${e(get('status'))}</p>`;
    }
}
```

When your HTML grows beyond a few lines, you may move it to an EJS view. Register a namespace for your views once when your application starts, then render a view with `views.render()`. In a view, `<%= value %>` escapes the value and `<%- html %>` inserts it as is:

```ts
import path from 'node:path';
import { views } from '@navette-js/support';

views.namespace('app', path.resolve('./views'));

// In the component class:
async toHtml(): Promise<string> {
    return views.render('app::components.chart', { heading: 'Sales' });
}
```

The view may use [UI components](/components/overview) (`<x-section>`, `<x-badge>`…). You may also render a [view component](/components/creating-components) directly, with its attributes and, optionally, its slot as third argument: `views.renderComponent('chart', { heading: 'Sales' })`.

### Adding a configuration method to a custom component class

You may add a public method to the custom component class that accepts a configuration value, stores it in a property, and returns the component:

```ts
import { Component } from '@navette-js/schemas';
import { e } from '@navette-js/support';

export class Chart extends Component {
    private headingValue: string | null = null;

    static make(): Chart {
        return new Chart();
    }

    heading(heading: string | null): this {
        this.headingValue = heading;

        return this;
    }

    async toHtml(): Promise<string> {
        return `<div class="chart"><h3>${e(this.headingValue)}</h3></div>`;
    }
}
```

To pass the configuration value to the custom component class, you may use the public method:

```ts
import { Chart } from './components/Chart.ts';

Chart.make()
    .heading('Sales')
```

<Aside variant="warning">
Avoid naming your methods like the methods of `Component` (`key()`, `hidden()`, `context()`, `columnSpan()`…) or the properties used by Navette, which start with an underscore.
</Aside>

#### Allowing utility injection in a custom component configuration method

You can allow users to pass a function instead of a static value by typing the parameter with `Lazy` from `@navette-js/support`. Resolve the value with `evaluate()`, which calls the function with the context object if the user passed one, or returns the value if it is static:

```ts
import { Component, type ComponentContext } from '@navette-js/schemas';
import { e, evaluate, type Lazy } from '@navette-js/support';

export class Chart extends Component {
    private headingValue: Lazy<string | null, ComponentContext> = null;

    static make(): Chart {
        return new Chart();
    }

    heading(heading: Lazy<string | null, ComponentContext>): this {
        this.headingValue = heading;

        return this;
    }

    async toHtml(): Promise<string> {
        const heading = await evaluate(this.headingValue, this.context());

        return `<div class="chart"><h3>${e(heading)}</h3></div>`;
    }
}
```

Now, you can pass a static value or a function to the `heading()` method:

```ts
import { Chart } from './components/Chart.ts';

Chart.make()
    .heading(({ record }) => `${(record as Product).name} sales`)
```

### Accepting a configuration value in the constructor of a custom component class

You may accept a configuration value in the `make()` method of the custom component and pass it to the corresponding setter method. To let your component honour [global settings](/schemas/overview#global-settings), wrap the new instance with `configured()` from `@navette-js/support`:

```ts
import { Component, type ComponentContext } from '@navette-js/schemas';
import { configured, type Lazy } from '@navette-js/support';

export class Chart extends Component {
    private headingValue: Lazy<string | null, ComponentContext> = null;

    static make(heading: Lazy<string | null, ComponentContext> = null): Chart {
        return configured(new Chart()).heading(heading);
    }

    // ...
}
```

### Rendering child components

A layout component renders other components. Return their schema from `getChildSchemas()`, built with `childSchema()`, and render it in `toHtml()`:

```ts
import { Component, childSchema, type Schema } from '@navette-js/schemas';

export class Aside extends Component {
    private children: Component[];

    constructor(children: Component[]) {
        super();
        this.children = children;
    }

    static make(children: Component[] = []): Aside {
        return new Aside(children);
    }

    getChildSchemas(): Schema[] {
        return [childSchema(this, this.children)];
    }

    async toHtml(): Promise<string> {
        return `<aside>${await this.getChildSchemas()[0].toHtml()}</aside>`;
    }
}
```

The child schema shares the state path, record and operation of the parent schema. Declaring it in `getChildSchemas()` is required for the fields inside your component to be filled, validated and saved with the rest of the form. You may call `columns()` on the child schema to give it a grid.

## Rendering components with JavaScript frameworks

You may render a schema component with a component of a JavaScript framework, such as React, Vue or Svelte, or with plain DOM code. Your application brings the framework and builds the component into an ES module; Navette loads the module, mounts it and keeps it up to date.

Use `JsComponent` and pass the URL of the module to `renderer()`:

```ts
import { JsComponent } from '@navette-js/schemas';

JsComponent.make()
    .key('sales-summary')
    .renderer('/js/components/sales-summary.js')
    .rendererConfiguration({ message: 'Sales increased by 12% this quarter.' })
```

Give each instance a unique `key()`. Instances may share a renderer without sharing their local state. The URL is resolved against the page URL; serve the module from a public folder, as for [fields rendered with JavaScript frameworks](/forms/custom-fields#serving-the-module).

<Aside variant="danger">
Only use URLs of modules that your application serves, or `RawJs` code that you wrote: never let user input choose the module or appear in a `RawJs` expression. Renderers are not sandboxed and must follow your Content Security Policy. Validate and authorize the requests they make on the server.
</Aside>

`renderer()` also accepts a function of the component context. If a script you already load defines the mount function, you may pass a trusted `RawJs` expression from `@navette-js/forms` instead of a URL: `.renderer(RawJs.make('window.mountSalesSummary'))`.

### Writing a component renderer

The module default-exports a mount function receiving `host`, `props` and `utilities`. Render inside `host`, then return `update(props)` and `destroy()`. `props.configuration` holds the configuration set with `rendererConfiguration()`, and `props.id` the component's id: its key, or the value of `id()`, or `null`.

With React, create `resources/js/components/sales-summary.jsx` and build it with your bundler:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';

function SalesSummary(props) {
    return <p>{props.configuration.message}</p>;
}

export default function mountSalesSummary({ host, props: initialProps }) {
    const root = createRoot(host);
    const update = (props) => root.render(<SalesSummary {...props} />);

    update(initialProps);

    return { update, destroy: () => root.unmount() };
}
```

With Vue, create `resources/js/components/SalesSummary.vue`:

```vue
<script setup>
defineOptions({ inheritAttrs: false });

const props = defineProps(['id', 'configuration']);
</script>

<template>
    <p>{{ props.configuration.message }}</p>
</template>
```

Then mount it from the entry `resources/js/components/sales-summary.js`:

```js
import { createApp, h, shallowRef } from 'vue';
import SalesSummary from './SalesSummary.vue';

export default function mountSalesSummary({ host, props: initialProps }) {
    const props = shallowRef(initialProps);
    const application = createApp({
        setup: () => () => h(SalesSummary, props.value),
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

With Svelte 5, create `resources/js/components/SalesSummary.svelte`:

```svelte
<script>
    let { configuration } = $props();
</script>

<p>{configuration.message}</p>
```

Then mount it from the entry `resources/js/components/sales-summary.svelte.js` (the `.svelte.js` extension lets the Svelte compiler process `$state`):

```js
import { mount, unmount } from 'svelte';
import SalesSummary from './SalesSummary.svelte';

export default function mountSalesSummary({ host, props: initialProps }) {
    const props = $state({ ...initialProps });
    const component = mount(SalesSummary, { target: host, props });

    return {
        update: (nextProps) => Object.assign(props, nextProps),
        destroy: () => unmount(component),
    };
}
```

Without a framework, the module may be served as is:

```js
export default function mountSalesSummary({ host, props: initialProps }) {
    const paragraph = document.createElement('p');
    const update = (props) => {
        paragraph.textContent = props.configuration.message ?? '';
    };

    update(initialProps);
    host.append(paragraph);

    return { update, destroy: () => paragraph.remove() };
}
```

### Configuring the renderer from the server

`rendererConfiguration()` also accepts a function of the component context, for example to display the value of a field:

```ts
JsComponent.make()
    .key('sales-summary')
    .renderer('/js/components/sales-summary.js')
    .rendererConfiguration(({ get }) => ({
        message: get('summary'),
    }))
```

Each time the component is rendered on the server, the renderer receives the new configuration in `update(props)`, without being remounted. Make the source field `live()` so that its changes trigger a render. Changing the renderer or the id remounts the component. The configuration is written into the page: only pass JSON-serializable data meant for the browser, never secrets.

`utilities` gives the renderer the same [schema utilities](/forms/custom-fields#accessing-schema-utilities) as a field renderer: `$get()`, `$set()`, `$state`, `$statePath` (the path of the surrounding schema, or `null`), `$wire`, and the [exposed methods](#calling-component-methods-from-javascript) of your component class, such as `utilities.$getChartData({ dateRange: 'week' })`. Type the mount function with `JsComponentRenderer<Configuration, Methods>`, imported with `import type` from `@navette-js/schemas`.

Render only inside `host`, whose content is ignored when the page is updated, and keep child schemas and actions outside the renderer. If importing, mounting or `update()` fails, the component shows an accessible error message and the error is logged in the browser console. Clean up subscriptions, listeners and framework roots in `destroy()`.

### Building reusable JavaScript components

To ship a component that renders with JavaScript, extend `JsComponent` and override `getRenderer()`, and `getRendererConfiguration()` for its configuration:

```ts
import { JsComponent } from '@navette-js/schemas';
import { configured } from '@navette-js/support';

export class SalesSummary extends JsComponent {
    static make(): SalesSummary {
        return configured(new SalesSummary());
    }

    async getRenderer(): Promise<string> {
        return '/vendor/reports/sales-summary.js';
    }

    async getRendererConfiguration(): Promise<Record<string, unknown>> {
        return { message: 'Sales increased by 12% this quarter.' };
    }
}
```

Use it with `SalesSummary.make().key('sales-summary')`, and expose its settings through [configuration methods](#adding-a-configuration-method-to-a-custom-component-class).

## Calling component methods from JavaScript

Sometimes you need to call a method on the component class from JavaScript in its HTML. For example, you might want to fetch data asynchronously or perform some server-side computation.

### Exposing a method

To expose a method to JavaScript, return its name from `getExposedMethods()`:

```ts
import { Component } from '@navette-js/schemas';

export class Chart extends Component {
    static make(): Chart {
        return new Chart();
    }

    getExposedMethods(): string[] {
        return ['getChartData'];
    }

    async getChartData(dateRange: unknown): Promise<number[]> {
        // Fetch and process chart data...

        return chartData;
    }

    // ...
}
```

<Aside variant="warning">
Only the methods returned by `getExposedMethods()` can be called from JavaScript, but being exposed does not authorize access to the method's data or operations. The arguments come from the browser: validate them, and authorize sensitive operations inside the method. Navette finds the component in the schema even when it is hidden, so do not rely on `hidden()` to protect an exposed method.
</Aside>

### Calling the method from JavaScript

Give your component a unique `key()` when adding it to a schema so Navette can locate it when the method is called:

```ts
import { Chart } from './components/Chart.ts';

Chart.make().key('chart')
```

In the HTML of the component, call the exposed method using its `$`-prefixed name. The utility is bound to this schema component, so you do not need to pass its key:

```html
<div
    x-data="{
        data: null,
        async loadData() {
            this.data = await this.$getChartData()
        },
    }"
    x-init="loadData"
>
    <!-- Render the chart using the data -->
</div>
```

You can also use `$callSchemaComponentMethod('getChartData')`.

### Passing arguments to an exposed method

Pass arguments as an object. Navette passes its values to the method in the order of their keys:

```html
<div
    x-data="{
        data: null,
        dateRange: 'week',
        async loadData() {
            this.data = await this.$getChartData({ dateRange: this.dateRange })
        },
    }"
    x-init="loadData"
>
    <select x-model="dateRange" x-on:change="loadData">
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
    </select>
</div>
```

### Preventing re-renders

By default, calling an exposed method does not re-render the page, since most methods only return data. If the page must be re-rendered after the method, for example because it changes the state of the form, override `isRenderlessMethod()`:

```ts
import { Component } from '@navette-js/schemas';

export class Chart extends Component {
    isRenderlessMethod(method: string): boolean {
        return method !== 'resetRange';
    }

    // ...
}
```

