---
title: Custom components
---

## Introduction

For a one-off piece of content, insert [HTML into your schema](#inserting-html-into-a-schema). For a reusable component with its own configuration, write a [component class](#custom-component-classes): a TypeScript class that extends `Component` from `@navette-js/schemas` and renders its HTML.

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

<Aside variant="warning">
Rendering components with JavaScript frameworks (`JsComponent`) and inserting a nested Livewire component are not available yet. There is no command that generates a component class, but `npx navette make:component` generates a [view component](/components/creating-components) that your class can render.
</Aside>
