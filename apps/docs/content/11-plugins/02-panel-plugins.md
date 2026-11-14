---
title: Panel plugins
---

## Introduction

A panel plugin packages a piece of panel configuration so it can be reused: in several panels of one application, in several projects, or published as an npm package. Anything you can do to a panel by hand, a plugin can do: register resources, pages and widgets, add render hooks, themes, navigation items, user menu items, or an authorization hook. Each panel adds the plugins it wants, and may configure each one differently.

## Configuring the panel with a plugin class

A plugin class extends `PanelPlugin` and implements three methods:

- `getId()` returns the unique identifier of the plugin among the plugins of a panel. Make it specific enough not to clash with another plugin, for example the name of your package.
- `register(panel)` receives the panel while it is being configured. It may use any configuration method of the panel: [resources](/resources/overview), [custom pages](/resources/custom-pages), [widgets](/widgets/overview), [render hooks](/advanced/render-hooks), [themes](/styling/overview), navigation items…
- `boot(panel)` runs when the panel is served, once everything is registered. It is optional.

```ts
import { PanelPlugin, type Panel } from '@navette-js/panels';
import { CategoryResource } from './resources/CategoryResource.ts';
import { PostResource } from './resources/PostResource.ts';
import { Settings } from './pages/Settings.ts';

export class BlogPlugin extends PanelPlugin {
    getId(): string {
        return 'blog';
    }

    register(panel: Panel): void {
        panel
            .resources([PostResource, CategoryResource])
            .pages([Settings]);
    }

    boot(panel: Panel): void {
        //
    }
}
```

The users of your plugin add it to a panel with `plugin()`, or several plugins at once with `plugins()`:

```ts
import { BlogPlugin } from 'navette-blog';

panel
    .plugin(BlogPlugin.make())
    .plugins([AuditPlugin.make(), HelpPlugin.make()]);
```

`register()` runs immediately, inside the `plugin()` call. Two plugins with the same identifier cannot be added to the same panel: the second call throws an error.

### Understanding when boot() runs

`boot()` runs once, when `panelRouter()` serves the panel: the panel's configuration is then complete, including what was registered after your plugin. Use it for work that depends on the whole configuration, or that should only happen for panels that are actually served.

The server process serves every request, so `boot()` does not run per request. For work that must happen before each request of the panel (its pages and their updates), register a callback with `bootUsing()`:

```ts
register(panel: Panel): void {
    panel.bootUsing(async (panel, req) => {
        // Before every request of the panel.
    });
}
```

### Writing a plugin as an object

A plugin does not have to be a class: any object with an `id` and a `register()` method (and optionally `boot()`) is a plugin. A function returning one is enough for a plugin without many options:

```ts
import { e } from '@navette-js/support';
import type { Plugin } from '@navette-js/panels';

export const footerPlugin = (text: string): Plugin => ({
    id: 'footer',
    register(panel) {
        // The HTML of a render hook is inserted as is: escape what does not come from you.
        panel.renderHook('panels::content.end', () => `<p class="app-footer">${e(text)}</p>`);
    },
});

panel.plugin(footerPlugin('Acme, internal tool'));
```

## Fluently instantiating the plugin class

`PanelPlugin` provides a static `make()` method, which creates an instance of your plugin class:

```ts
panel.plugin(BlogPlugin.make());
```

The callbacks registered with `configureUsing()` from `@navette-js/support` are applied to every instance created by `make()`. An application may use it to configure a plugin for all its panels:

```ts
import { configureUsing } from '@navette-js/support';

configureUsing(BlogPlugin, (plugin) => plugin.authorResource());
```

## Configuring plugins per panel

You may add other methods to your plugin class, to let your users configure it. Add a setter and a getter for each option: the setter stores the preference in a property and returns the plugin, the getter reads it:

```ts
import { PanelPlugin, type Panel } from '@navette-js/panels';
import { AuthorResource } from './resources/AuthorResource.ts';

export class BlogPlugin extends PanelPlugin {
    protected _hasAuthorResource = false;

    getId(): string {
        return 'blog';
    }

    authorResource(condition = true): this {
        // The setter stores the user's preference on the plugin object,
        // and returns the plugin to allow chaining.
        this._hasAuthorResource = condition;

        return this;
    }

    hasAuthorResource(): boolean {
        return this._hasAuthorResource;
    }

    register(panel: Panel): void {
        // register() runs after the user configured the plugin:
        // their preferences are available here.
        if (this.hasAuthorResource()) {
            panel.resources([AuthorResource]);
        }
    }
}
```

```ts
panel.plugin(BlogPlugin.make().authorResource());
```

Each call to `make()` creates an independent plugin, so each panel may configure it differently.

### Accessing the plugin's configuration

You may access a plugin, and so its options, from anywhere with its panel's `getPlugin()` method, given its identifier. `hasPlugin()` tells whether a plugin was added to the panel:

```ts
panel.getPlugin<BlogPlugin>('blog').hasAuthorResource();

panel.hasPlugin('blog');
```

`getPlugin()` throws an error when the plugin is not registered on the panel. `getPlugins()` returns every plugin of the panel.

The static `get()` method of `PanelPlugin` returns the plugin of the panel serving the current request: a page, a resource, a widget or a component of your plugin may read the options with it, without knowing the panel:

```ts
BlogPlugin.get().hasAuthorResource();
```

Outside a request (when the application starts, in a script), pass the panel: `BlogPlugin.get(panel)`. `getCurrentPanel()`, exported by `@navette-js/panels`, returns the panel of the current request, or `null`.

<Aside variant="warning">
Resource and page classes are shared by every panel of the process: a static property set by a plugin applies to all the panels that register the class. To register a resource or a page differently in each panel, or several times in one panel, use [configurable resources and pages](/plugins/configurable-resources-and-pages).
</Aside>

## Distributing a panel in a plugin

A plugin may register everything a panel needs: resources, pages, widgets, navigation groups and themes. The application only creates the panel, provides the users and the key, and adds the plugin:

```ts
import { Panel, PanelPlugin } from '@navette-js/panels';

export class BlogPanelPlugin extends PanelPlugin {
    getId(): string {
        return 'blog-panel';
    }

    register(panel: Panel): void {
        panel
            .navigationGroups(['Blog'])
            .resources([PostResource, PostCategoryResource, AuthorResource])
            .widgets([LatestPostsWidget]);
    }
}

const blog = Panel.make().id('blog').path('blog').key(key).login().auth(users).plugin(BlogPanelPlugin.make());
```

## Registering assets

Register the stylesheets and scripts that every page of a panel needs with the panel's `assets()` method, in the plugin's `register()` method. They are then only loaded by the panels that use the plugin. Pass the name of your npm package as the second argument: the files are served from the package's own folder, so their IDs cannot clash with another plugin's:

```ts
import { fileURLToPath } from 'node:url';
import { Css, Js, PanelPlugin, type Panel } from '@navette-js/panels';

export class BlogPlugin extends PanelPlugin {
    // ...

    register(panel: Panel): void {
        panel.assets([
            Css.make('blog', fileURLToPath(new URL('../resources/blog.css', import.meta.url))),
            Js.make('blog', fileURLToPath(new URL('../resources/blog.js', import.meta.url))),
        ], 'navette-blog');
    }
}
```

Assets shared by standalone components, loaded in every panel or on request, are registered with `NavetteAsset.register([...], 'navette-blog')` when the package is imported. Both are described on the "Registering assets" page of the Advanced section.

A very small stylesheet may also be inlined with a render hook, only in the panels that use the plugin:

```ts
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../resources/blog.css', import.meta.url), 'utf8');

register(panel: Panel): void {
    panel.renderHook('panels::styles.after', () => `<style>${css}</style>`);
}
```

See [render hooks](/advanced/render-hooks) for the list of locations, and [CSS hooks](/styling/css-hooks) to style the existing interface.

## Registering resources and pages with options

A plugin may let its users register its resources and pages several times, each registration with its own slug, navigation item and options, with [configurable resources and pages](/plugins/configurable-resources-and-pages#using-configurable-resources-in-a-plugin-class).
