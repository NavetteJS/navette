---
title: JavaScript widgets
---

## Introduction

A JavaScript widget renders its content in the browser, with an ES module that you write: framework-free JavaScript, or React, Vue, Svelte or any other library you bundle yourself. Navette handles the widget's grid placement, its section, its lazy loading, and passes the data computed on the server to your module.

To generate a JavaScript widget, add `--js` to the [widget generator](/getting-started/cli#generating-a-widget):

```bash
npx navette make:widget RevenueOverview --js
```

The command creates two files:

- `src/admin/widgets/RevenueOverview.ts`, the widget class, extending `JsWidget`.
- `resources/js/admin/widgets/revenue-overview.js`, the renderer module, with a framework-free starter.

Use `--panel=app` for another panel. Register the class in your panel like any other widget, with `widgets()`, or return it from the `getWidgets()` method of a page.

<Aside variant="info">
Navette does not run a bundler: React, Vue, Svelte and TypeScript renderers must be compiled to an ES module first (with Vite, esbuild…). Point `getRenderer()` at the compiled file. The generator therefore only accepts `--js`: `--react`, `--vue`, `--svelte` and `--ts` are refused.
</Aside>

## Writing the widget class

A JavaScript widget extends `JsWidget`, from `@navette-js/panels`. `getRenderer()` returns the URL of the renderer module, and `getRendererConfiguration()` the data the module receives:

```ts
import { fileURLToPath } from 'node:url';
import { Js, JsWidget, NavetteAsset } from '@navette-js/panels';

// Served by the panel, and only loaded by the pages showing the widget.
NavetteAsset.register([
    Js.make('revenue-overview', fileURLToPath(new URL('../../../resources/js/revenue-overview.js', import.meta.url))).loadedOnRequest(),
]);

export class RevenueOverview extends JsWidget {
    getRenderer(): string {
        return NavetteAsset.getScriptSrc('revenue-overview');
    }

    async getRendererConfiguration(): Promise<Record<string, unknown>> {
        return {
            heading: 'Revenue overview',
            description: `Total revenue: ${await totalRevenue()}`,
        };
    }
}
```

`loadedOnRequest()` keeps the module out of the layout of the panel: the page imports it only when it shows the widget. `NavetteAsset.getScriptSrc()` returns its versioned URL (`/js/app/revenue-overview.js?v=…`), so browsers fetch a new copy whenever the file changes. See [assets](/advanced/assets).

`getRenderer()` may also return:

- the path of a file your application serves itself (`'/js/revenue-overview.js'`), or an `http(s)://` URL.
- a trusted mount function, written as JavaScript with `RawJs` from `@navette-js/forms`: `RawJs.make('window.mountRevenueOverview')`. It is inserted into the page as code: never build it from user data.
- `null`, for no renderer.

Any other URL (`javascript:`, `data:`, `//host`, a relative path) is refused with an error when the widget renders.

### Passing configuration from the server

`getRendererConfiguration()` returns an object of JSON-serializable values. The renderer receives it as `props.configuration`. When the widget renders again, Navette passes the new configuration to the renderer's `update()` method, without remounting it. Changing `props.configuration` in JavaScript does not change anything on the server.

<Aside variant="danger">
The configuration is written into the page: only include data that the current user is authorized to see.
</Aside>

### Receiving dashboard filter values

To use the [dashboard filters](/widgets/overview#filtering-widget-data), declare the `pageFilters` property as reactive, as in any other widget, and include the values the renderer needs in the configuration:

```ts
import { JsWidget, PAGE_FILTERS } from '@navette-js/panels';

const STATUSES = ['new', 'processing', 'shipped'];

export class RevenueOverview extends JsWidget {
    static reactive = PAGE_FILTERS;
    pageFilters: Record<string, unknown> | null = null;

    getRenderer() {
        return '/js/revenue-overview.js';
    }

    async getRendererConfiguration() {
        // The filter values come from the browser: validate them before use.
        const status = typeof this.pageFilters?.status === 'string' && STATUSES.includes(this.pageFilters.status) ? this.pageFilters.status : null;

        return {
            heading: 'Revenue overview',
            status,
            total: await totalRevenue({ status }),
        };
    }
}
```

When the user changes a filter, the widget renders again and the renderer's `update()` receives the new configuration.

## Writing a renderer

A renderer module default-exports a function receiving `{ host, props, utilities }`. Mount your UI inside `host` and return an object with `update(props)` and `destroy()` methods:

```js
export default function mountRevenueOverview({ host, props: initialProps }) {
    const heading = document.createElement('h2')
    const description = document.createElement('p')

    const update = ({ configuration }) => {
        heading.textContent = configuration.heading
        description.textContent = configuration.description
    }

    update(initialProps)
    host.append(heading, description)

    return { update, destroy: () => host.replaceChildren() }
}
```

Set text with `textContent`, not `innerHTML`: the configuration may contain user data.

### Using a framework

Bundle the framework with your renderer into an ES module, and point `getRenderer()` at the compiled file. For example, with React:

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'

function RevenueOverview({ configuration }) {
    return <><h2>{configuration.heading}</h2><p>{configuration.description}</p></>
}

export default function mountRevenueOverview({ host, props: initialProps }) {
    const root = createRoot(host)
    const update = (props) => root.render(<RevenueOverview {...props} />)
    update(initialProps)

    return { update, destroy: () => root.unmount() }
}
```

With Vue, keep the props in a shallow ref and replace them in `update()`; with Svelte 5, keep them in `$state()` and assign the new values in `update()`. The mount function is the same for every framework: mount into `host`, apply the props in `update()`, unmount in `destroy()`.

### Calling server methods

`utilities.$wire` is the widget's own Livewire proxy. Use it to call a method listed in the static `callable` property of the widget, or to read and set its public properties:

```js
export default function mountRevenueOverview({ host, utilities }) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Refresh revenue'
    button.onclick = () => utilities.$wire.$call('refreshRevenue')
    host.append(button)

    return { update() {}, destroy: () => host.replaceChildren() }
}
```

```ts
export class RevenueOverview extends JsWidget {
    static callable = ['refreshRevenue'];

    async refreshRevenue() {
        // The widget renders again after the call: its renderer receives the new configuration.
    }

    // ...
}
```

Validate the arguments sent from the browser, and authorize the operation, inside the method. To call the server from a framework component, pass `utilities` to it as a prop.

### Typing renderers

The types of the renderer contract are exported by `@navette-js/panels`. `JsWidgetRenderer<Configuration, Methods>` types the configuration and the widget's callable methods:

```ts
import type { JsWidgetRenderer } from '@navette-js/panels';

type Configuration = { heading: string; total: number };
type Methods = { refreshRevenue(): Promise<void> };

const mountRevenueOverview: JsWidgetRenderer<Configuration, Methods> = ({ host, props }) => {
    const update = ({ configuration }: typeof props) => {
        host.textContent = `${configuration.heading}: ${configuration.total}`;
    };
    update(props);

    return { update, destroy: () => host.replaceChildren() };
};

export default mountRevenueOverview;
```

`JsWidgetProps<Configuration>`, `JsWidgetRendererContext<Configuration, Methods>` and `JsWidgetRendererInstance<Configuration>` are also available. In a framework-free JavaScript renderer, use them in a JSDoc comment, as the generated starter does: `/** @param {import('@navette-js/panels').JsWidgetRendererContext} context */`.

### Synchronizing and disposing renderers

Livewire does not manage the contents of `host`. Use `update()` to apply the server configuration while preserving local UI state. Do not render Livewire or Alpine components inside this subtree.

Mounting may be asynchronous: Navette delivers the latest props when it completes, or disposes the instance if the widget was removed. Changing `getRenderer()` replaces the renderer; changing `getRendererConfiguration()` updates it in place.

Use `destroy()` to unmount your framework and release listeners, observers, timers and subscriptions. Stop DOM work immediately: Navette does not wait for asynchronous cleanup before remounting. Cancel or order overlapping asynchronous updates in your renderer.

#### Handling renderer errors

If importing, mounting or updating fails, Navette logs the error in the browser console, disposes the renderer, and replaces its contents with an accessible error message. Reload the page to retry.

If mounting allocates resources before throwing, clean them up in the mount function: Navette has not received an instance to dispose yet.

## Customizing the rendering

`JsWidget.render()` wraps the renderer in a section and in the widget's grid column. To add your own markup around it, override `render()` and keep the renderer with `renderJsWidgetContent()`, which returns the section and the renderer without the widget wrapper:

```ts
import { e } from '@navette-js/support';

export class RevenueOverview extends JsWidget {
    // ...

    async render() {
        return this.wrap(`<p class="revenue-note">${e('Updated hourly')}</p>${await this.renderJsWidgetContent()}`, ['nv-wi-js']);
    }
}
```

`jsWidgetContentHtml({ widgetId, assetUrl, renderer, rendererConfiguration })`, exported by `@navette-js/panels`, builds the same markup for a widget that does not extend `JsWidget`.

## Building reusable plugin widgets

For a [plugin](/plugins/getting-started), register the compiled renderer under the plugin's package name, loaded on request, and return its URL from the widget:

```ts
import { fileURLToPath } from 'node:url';
import { Js, JsWidget, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    Js.make('revenue-overview', fileURLToPath(new URL('../dist/revenue-overview.js', import.meta.url))).loadedOnRequest(),
], 'acme/reports');

export class RevenueOverview extends JsWidget {
    getRenderer() {
        return NavetteAsset.getScriptSrc('revenue-overview', 'acme/reports');
    }
}
```

Keep the module's default export, and register any chunk or stylesheet it imports too.
