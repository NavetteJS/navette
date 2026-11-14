---
title: Plugins
---

## Introduction

A plugin packages a piece of panel configuration so it can be reused: in several panels of one application, in several projects, or published as an npm package. Anything you can do to a panel by hand, a plugin can do: register resources, pages and widgets, add render hooks, themes, navigation items, user menu items, or an authorization hook.

## Creating a plugin

A plugin is an object with an `id` and a `register()` method, which receives the panel while it is being built:

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
```

### Usage

Pass the plugin to `plugin()`, or several plugins to `plugins()`:

```ts
panel
    .plugin(footerPlugin('Acme — internal tool'))
    .plugins([auditPlugin({ retentionDays: 90 }), helpPlugin()]);
```

`register()` runs immediately, inside the `plugin()` call. Two plugins with the same `id` cannot be registered on the same panel: the second call throws an error.

## Understanding the plugin object

| Member | Description |
|---|---|
| `id` | A unique identifier, such as the name of your package. |
| `register(panel)` | Configures the panel. Called by `panel.plugin()`. |
| `boot(panel)` | Optional. Called by `panelRouter()`, when everything is registered on the panel. Use it for work that needs the complete configuration. |

`panel.getPlugins()` returns the plugins registered on a panel.

## Configuring plugins

Navette has no plugin classes: a plugin is usually returned by a function, whose arguments are its options. Each call creates an independent plugin, so each panel may configure it differently:

```ts
import type { Plugin } from '@navette-js/panels';

export const auditPlugin = (options: { retentionDays: number; navigationGroup?: string }): Plugin => ({
    id: 'audit',
    register(panel) {
        AuditLogResource.navigationGroup = options.navigationGroup ?? 'Settings';
        AuditLogResource.retentionDays = options.retentionDays;
        panel.resources([AuditLogResource]);
        panel.renderHook('panels::sidebar.footer', () => '<p class="audit-note">Actions are logged</p>');
    },
    boot(panel) {
        scheduleCleanup(options.retentionDays);
    },
});

adminPanel.plugin(auditPlugin({ retentionDays: 90 }));
```

<Aside variant="warning">
Resource classes are shared by every panel of the process: a static property set by a plugin applies to all the panels that register the resource. To configure one resource differently per panel, create a subclass in the plugin.
</Aside>

## Distributing a panel in a plugin

A plugin may register everything a panel needs: resources, pages, widgets, navigation groups and themes. The application only creates the panel, provides the users and the key, and adds the plugin:

```ts
import { Panel, type Plugin } from '@navette-js/panels';

export const blogPlugin = (): Plugin => ({
    id: 'blog',
    register(panel) {
        panel
            .navigationGroups(['Blog'])
            .resources([PostResource, PostCategoryResource, AuthorResource])
            .widgets([LatestPostsWidget]);
    },
});

const panel = Panel.make().id('admin').key(key).login().auth(users).plugin(blogPlugin());
```

## Registering assets

A plugin registers its stylesheets, scripts and Alpine components with `panel.assets()`, under the name of its npm package. The panel serves the files and adds the tags to its pages:

```ts
import { fileURLToPath } from 'node:url';
import { Css, Js } from '@navette-js/panels';

register(panel) {
    panel.assets([
        Css.make('audit', fileURLToPath(new URL('../dist/audit.css', import.meta.url))),
        Js.make('audit', fileURLToPath(new URL('../dist/audit.js', import.meta.url))).defer(),
    ], '@acme/navette-audit');
},
```

See [registering assets](/advanced/assets) for the details, [render hooks](/advanced/render-hooks) to insert other markup, and [CSS hooks](/styling/css-hooks) to style the existing interface.

<Aside variant="info">
Navette is written in TypeScript that Node.js runs directly, without a build step. A plugin published on npm should do the same, or ship compiled JavaScript: Node.js does not strip types from files inside `node_modules`.
</Aside>
