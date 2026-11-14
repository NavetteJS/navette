---
title: Registering assets
---

## Introduction

All packages in the Navette ecosystem share an asset management system. This allows both your application and plugins to register CSS and JavaScript files, which the panel router then serves and adds to the panel's pages.

Assets always have an ID chosen by you, unique within their package. The ID is used as the file name in the asset's URL, and to reference the asset from your views. If you are registering assets for a plugin, you do not need to worry about IDs clashing with other plugins: each package has its own folder in the URLs.

Registered files are served with a version in their URL, a hash of their content: browsers may cache them for a year, and they fetch the new file as soon as it changes.

## The `NavetteAsset` registry

Use `NavetteAsset` to register the asset files of your application or of a plugin. Its main method, `register()`, accepts an array of assets. Call it at startup, before creating the panel routers:

```ts
import { NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    // ...
]);
```

Assets registered with `NavetteAsset` are loaded in every panel. To register assets for one panel only, use the panel's `assets()` method, which accepts the same arguments:

```ts
import { Css, Panel } from '@navette-js/panels';

const panel = Panel.make()
    // ...
    .assets([
        Css.make('admin-stylesheet', fileURLToPath(new URL('./resources/css/admin.css', import.meta.url))),
    ]);
```

### Registering assets for a plugin

When registering assets for a plugin, you should pass the name of its npm package as the second argument of `register()` or `assets()`:

```ts
import { NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    // ...
], '@acme/navette-blog');
```

The assets of this plugin are then served from their own folder (`/css/@acme/navette-blog/…`), so they cannot clash with other plugins' files with the same names. Without a package, assets belong to the `app` package. A [plugin](/plugins/panel-plugins#registering-assets) usually registers its assets with `panel.assets()` in its `register()` method.

## Registering CSS files

To register a CSS file, pass a `Css` object to `register()`. Each `Css` object has an ID and the path to the CSS file:

```ts
import { fileURLToPath } from 'node:url';
import { Css, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    Css.make('custom-stylesheet', fileURLToPath(new URL('../resources/css/custom.css', import.meta.url))),
]);
```

In this example, `import.meta.url` gives a path relative to the current module. The file is served at `/css/app/custom-stylesheet.css?v=<version>`, and it is loaded in the `<head>` of every panel page, before the panel's stylesheet. If you're interested in only loading the CSS when it is required by an element on the page, check out the [lazy loading CSS](#lazy-loading-css) section.

`register()` throws an error if the file does not exist, if the ID is not a valid file name, or if another file is already registered at the same URL.

### Registering CSS files from a URL

If you want to register a CSS file from a URL, you may do so. These assets are loaded on every page as normal, but they are not served by the panel. This is useful for registering external stylesheets from a CDN, or stylesheets that your application already serves, for example with `express.static()`:

```ts
import { Css, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    Css.make('example-external-stylesheet', 'https://example.com/external.css'),
    Css.make('example-local-stylesheet', '/css/local.css'),
]);
```

A path starting with `/` is a URL of the application, unless it is the path of an existing file.

### Registering CSS variables

Sometimes, you may wish to use dynamic data from the backend in CSS files. To do this, you can use the `registerCssVariables()` method:

```ts
import { NavetteAsset } from '@navette-js/panels';

NavetteAsset.registerCssVariables({
    'background-image': 'url(/images/background.jpg)',
});
```

Now, you can access these variables from any CSS file:

```css
background-image: var(--background-image);
```

Variable names may only contain letters, digits, `-` and `_`. The characters `<`, `>`, `{`, `}`, `;` and `\` are removed from values, so that a value cannot end its declaration.

### Lazy loading CSS

Registered CSS files load on every page by default. To prevent a file from being loaded automatically, register it with `loadedOnRequest()`:

```ts
import { Css, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    Css.make('custom-stylesheet', fileURLToPath(new URL('../resources/css/custom.css', import.meta.url))).loadedOnRequest(),
]);
```

Then, use the `x-load-css` directive on the element that requires it, with the URL returned by `getStyleHref()`:

```ts
import { NavetteAsset } from '@navette-js/panels';
import { e, js } from '@navette-js/support';

const html = `<div x-data="{}" x-load-css="${e(js([NavetteAsset.getStyleHref('custom-stylesheet')]))}">
    <!-- ... -->
</div>`;
```

If your CSS file was [registered to a plugin](#registering-assets-for-a-plugin), you must pass the package as the second argument of `getStyleHref()`:

```ts
NavetteAsset.getStyleHref('custom-stylesheet', '@acme/navette-blog')
```

## Registering JavaScript files

To register a JavaScript file, pass a `Js` object to `register()`. Each `Js` object has an ID and the path to the JavaScript file:

```ts
import { fileURLToPath } from 'node:url';
import { Js, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    Js.make('custom-script', fileURLToPath(new URL('../resources/js/custom.js', import.meta.url))),
]);
```

The file is served at `/js/app/custom-script.js?v=<version>`, and it is loaded at the end of the `<body>` of every panel page, before the panel's own scripts. In SPA mode, it runs once, not after each navigation; call `navigateOnce(false)` to run it after every navigation.

You may set the attributes of the `<script>` tag:

| Method | Effect |
|---|---|
| `async()` | Adds the `async` attribute. |
| `defer()` | Adds the `defer` attribute. |
| `module()` | Loads the file as an ES module (`type="module"`). |
| `core()` | Loads the file after the other registered scripts. |
| `extraAttributes({ 'data-site': 'shop' })` | Adds other attributes. Their values are escaped. |
| `html(markup)` | Renders this markup instead of the `<script>` tag. It is inserted as is: never pass data from end users. |

### Registering JavaScript files from a URL

As with CSS files, you may register a JavaScript file from a URL. It is loaded on every page, but not served by the panel:

```ts
import { Js, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    Js.make('example-external-script', 'https://example.com/external.js'),
    Js.make('example-local-script', '/js/local.js'),
]);
```

### Registering script data

Sometimes, you may wish to make data from the backend available to JavaScript files. To do this, you can use the `registerScriptData()` method:

```ts
import { NavetteAsset } from '@navette-js/panels';

NavetteAsset.registerScriptData({
    support: { email: 'help@example.com' },
});
```

Now, you can access that data from any JavaScript file at runtime, using the `window.navetteData` object:

```js
window.navetteData.support.email // 'help@example.com'
```

The data is the same for every user and every request: never put secrets or user data in it.

### Lazy loading JavaScript

Registered JavaScript files load on every page by default. To prevent a file from being loaded automatically, register it with `loadedOnRequest()`, then use the `x-load-js` directive on the element that requires it, with the URL returned by `getScriptSrc()`:

```ts
import { Js, NavetteAsset } from '@navette-js/panels';
import { e, js } from '@navette-js/support';

NavetteAsset.register([
    Js.make('custom-script', fileURLToPath(new URL('../resources/js/custom.js', import.meta.url))).loadedOnRequest(),
]);

const html = `<div x-data="{}" x-load-js="${e(js([NavetteAsset.getScriptSrc('custom-script')]))}">
    <!-- ... -->
</div>`;
```

`getScriptSrc()` also gives the URL of an ES module to import on demand, with `import()`. If your file was registered to a plugin, pass the package as the second argument.

## Asynchronous Alpine.js components

Sometimes, you may want to load external JavaScript libraries for your Alpine.js-based components. The best way to do this is by storing the compiled JavaScript and Alpine component in a separate file, and letting the page load it whenever the component is rendered.

Write the component as an ES module whose default export is the component function:

```js
// resources/js/components/test-component.js
export default function testComponent({ state }) {
    return {
        state,

        init() {
            // Initialise the Alpine component here, if you need to.
        },
    }
}
```

If the component imports libraries from npm, bundle it into a single file first, for example with esbuild:

```bash
npx esbuild resources/js/components/test-component.js --bundle --format=esm --minify --outfile=resources/js/dist/components/test-component.js
```

Register the file with an `AlpineComponent` object. Alpine components are always loaded on request:

```ts
import { fileURLToPath } from 'node:url';
import { AlpineComponent, NavetteAsset } from '@navette-js/panels';

NavetteAsset.register([
    AlpineComponent.make('test-component', fileURLToPath(new URL('../resources/js/dist/components/test-component.js', import.meta.url))),
]);
```

Finally, load the component in your view with the `x-load` attributes and the URL returned by `getAlpineComponentSrc()`. The component's name in `x-data` is the name of its function:

```ts
import { NavetteAsset } from '@navette-js/panels';
import { e } from '@navette-js/support';

const html = `<div
    x-load
    x-load-src="${e(NavetteAsset.getAlpineComponentSrc('test-component'))}"
    x-data="testComponent({ state: $wire.$entangle('data.color') })"
    wire:ignore
>
    <input x-model="state" />
</div>`;
```

The file is served at `/js/app/components/test-component.js?v=<version>`, and it is only downloaded when an element using it is on the page. `x-load` also accepts loading strategies: `x-load="visible"` waits until the element is visible, `x-load="idle"` until the browser is idle.

## Security

Navette provides these protections:

- Only registered files are served, by their ID: no other file of the folders can be reached through an asset URL.
- Asset IDs and package names are checked when they are registered, and two different files cannot share a URL.
- Files are served with `X-Content-Type-Options: nosniff` and a content type matching their kind.
- Script data is encoded so that it cannot close its `<script>` element, CSS variable values cannot leave their declaration, and the values of `extraAttributes()` are escaped.

What your application must still do:

- Only register files that you trust: they run in the pages of every user of the panel.
- Never put secrets in script data or CSS variables: they are sent to every page.
- Keep `html()` markup free of data from end users.
