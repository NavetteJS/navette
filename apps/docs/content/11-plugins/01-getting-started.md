---
title: Getting started
---

## Introduction

A plugin is a reusable piece of a Navette application: a set of resources and pages, a widget, a form field, a table column. You may keep it inside your project, or publish it as an npm package for other projects.

There are two kinds of plugins, and one package may contain both:

- **Panel plugins** add something to a panel: resources, pages, widgets, render hooks, navigation items, themes. They are added to each panel with `panel.plugin()`, and may be configured differently in each one. See [panel plugins](/plugins/panel-plugins).
- **Standalone plugins** provide components used anywhere: form fields, infolist entries, table columns, schema components, view components. They need no registration: the application imports and uses them. See [building a standalone plugin](/plugins/building-a-standalone-plugin).

## Creating a plugin

In a project created with `npm create navette`, generate a plugin package with the CLI:

```bash
npx navette make:plugin Blog
```

It creates `plugins/blog/`:

| File | Contents |
| --- | --- |
| `package.json` | The package: its name, `"type": "module"`, its entry point, and the Navette packages it needs as peer dependencies |
| `src/index.ts` | The entry point: registers the package's views and translations, exports the plugin |
| `src/BlogPlugin.ts` | The plugin class, with an option and its `register()` and `boot()` methods |
| `src/BlogPage.ts` | A page added to the panel by the plugin |
| `views/page.ejs` | The view of the page |
| `lang/en/blog.json` | English translations |
| `README.md` | Installation and usage instructions |

Add the plugin to a panel, for example in `src/panels/admin.ts`:

```ts
import { BlogPlugin } from '../../plugins/blog/src/index.ts';

export default Panel.make()
    .id('admin')
    // ...
    .plugin(BlogPlugin.make());
```

With `--standalone`, the command creates a schema component package instead of a panel plugin:

```bash
npx navette make:plugin PriceTag --standalone
```

## Understanding the structure of a plugin package

A plugin package is an ES module package. Its entry point registers what the package ships, once, when it is first imported:

```ts
import { views } from '@navette-js/support';
import { loadTranslationsFrom } from '@navette-js/support/i18n';

views.namespace('blog', new URL('../views', import.meta.url));
loadTranslationsFrom(new URL('../lang', import.meta.url), 'blog');

export { BlogPlugin } from './BlogPlugin.ts';
```

Name the namespaces after your package, so they do not clash with another plugin's.

### Views

`views.namespace('blog', directory)` makes the EJS files of the directory available as `blog::<path>`: `views.render('blog::posts.card', data)` renders `views/posts/card.ejs`. A page uses one with `static view = 'blog::page'`. Views may use the [UI components](/components/overview) (`<x-section>`, `<x-badge>`…).

An application may replace a view of your plugin without changing it, with a [view override](/styling/css-hooks#overriding-views): the file `<overrides>/blog/posts/card.ejs` replaces `blog::posts.card`.

### Translations

`loadTranslationsFrom(directory, 'blog')` reads the JSON files of `<directory>/<locale>/<group>.json`. The file `lang/en/posts.json`:

```json
{
    "title": "Posts",
    "form": {
        "title": { "label": "Title" }
    }
}
```

provides the keys `blog::posts.title` and `blog::posts.form.title.label`, translated with `t()`:

```ts
import { t } from '@navette-js/support/i18n';

t('blog::posts.title'); // "Posts"
t('blog::posts.greeting', { name: 'Ada' }); // ":name" placeholders are replaced
```

A key missing in the current locale falls back to English. You may also give translations as an object with `addTranslations()`:

```ts
import { addTranslations } from '@navette-js/support/i18n';

addTranslations('blog', {
    en: { posts: { title: 'Posts' } },
    fr: { posts: { title: 'Articles' } },
});
```

Keys added later replace the earlier ones: an application may call `addTranslations()` after importing a plugin to change some of its texts. Navette's own texts may be changed the same way, with their namespaces (`navette-panels`, `navette-forms`, `navette-tables`, `navette-actions`…).

### Assets

Plugins have no routes of their own: Navette serves the stylesheets and scripts they register. A panel plugin registers the assets its panels need with `panel.assets([...], 'your-package')` in its `register()` method, so they are only loaded by the panels that use the plugin: see [registering assets](/plugins/panel-plugins#registering-assets). Assets shared by standalone components are registered with `NavetteAsset.register([...], 'your-package')` when the package is imported: see [registering assets](/advanced/assets#registering-assets-for-a-plugin). A very small stylesheet may also be inlined with a [render hook](/advanced/render-hooks), as the [standalone plugin walkthrough](/plugins/building-a-standalone-plugin#loading-the-stylesheet) does.

## Publishing a plugin

Node.js runs the TypeScript sources of your project directly, but it does not strip types from files inside `node_modules`. A plugin used from its folder (`plugins/blog`, imported by path, or listed as a `file:` dependency) can stay in TypeScript. A plugin published to npm must contain JavaScript:

1. Compile `src/` with TypeScript (`tsc` with `"module": "nodenext"`, `"rewriteRelativeImportExtensions": true` and `"declaration": true`) into `lib/`.
2. Point `exports` at the compiled files, `{ ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" } }`, and list `lib`, `views` and `lang` in `files`.
3. Keep the `@navette-js/*` packages in `peerDependencies`, so the plugin uses the application's copy.

A plugin that resolves its folders from `import.meta.url` (`new URL('../views', import.meta.url)`) keeps working once compiled, as `lib/` and `src/` are at the same depth.

## Example plugins

The Navette repository contains two complete plugins in `examples/`, used by its tests:

- `examples/clock-widget`: a panel plugin, walked through in [building a panel plugin](/plugins/building-a-panel-plugin).
- `examples/headings`: a standalone plugin, walked through in [building a standalone plugin](/plugins/building-a-standalone-plugin).
