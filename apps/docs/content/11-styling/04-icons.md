---
title: Icons
---

## Introduction

Icons are used throughout the interface of Navette: in the navigation, in actions, in columns and entries, in notifications. Navette ships with [Heroicons](https://heroicons.com). You can add other icon sets, such as the [Iconify](https://icon-sets.iconify.design) sets published on npm, register your own SVG icons, and replace any icon of the interface with your own.

## Using Heroicons in Navette

An icon is designated by its name, prefixed with its style:

| Prefix | Style | Size |
|---|---|---|
| `o-` | Outline | 24 px |
| `s-` | Solid | 24 px |
| `m-` | Mini | 20 px |
| `c-` | Micro | 16 px |

```ts
import { Action } from '@navette-js/actions';

static navigationIcon = 'o-user-group';

Action.make('export').icon('m-arrow-down-tray')
```

Names with the `heroicon-` prefix are accepted too: `heroicon-o-user-group` is the same icon as `o-user-group`. In Navette's own components, the navigation uses outline icons, buttons use mini icons, and table row actions use micro icons (`tableIcon()`).

The names are those of [heroicons.com](https://heroicons.com). An unknown name throws an error when the page is rendered, so a typo shows up during development.

## Using other icon sets in Navette

An icon of another set is designated by the prefix of the set and the name of the icon, separated by a colon: `lucide:house`. It can be used wherever an icon name is expected, like a Heroicons name.

### Iconify icon sets

The icon sets of [Iconify](https://icon-sets.iconify.design) (Lucide, Tabler, Phosphor, Material Symbols, Font Awesome and over 200 others) are published on npm as `@iconify-json/*` packages. Install the set you want, then register it with `icons.registerIconify()` when your application starts, before the panel is built:

```bash
npm install @iconify-json/lucide
```

```ts
import { icons } from '@navette-js/support';

icons.registerIconify('lucide');

Action.make('home').icon('lucide:house')
```

`registerIconify()` accepts the name of an installed package (`'lucide'` or `'@iconify-json/lucide'`), resolved from the current directory of the process, or the JSON of a set (the `icons.json` file of the package). The prefix of the icons is that of the set; pass another one with the `prefix` option:

```ts
import { icons } from '@navette-js/support';
import { icons as tabler } from '@iconify-json/tabler';

icons.registerIconify(tabler, { prefix: 'tb' });

Action.make('star').icon('tb:star')
```

The icons of a set use `currentColor`, so they follow the color of the component, and they get the same size classes as Heroicons. Browse the names of each set on [icon-sets.iconify.design](https://icon-sets.iconify.design).

### Registering your own icon set

You may register any set of icons with `icons.registerSet()`: a prefix, and a function returning the `<svg>` element of a name, or `null` when the set has no such icon. For example, to serve the SVG files of a directory of your application as `app:<file name>`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { icons } from '@navette-js/support';

icons.registerSet('app', (name) => {
    const file = new URL(`./resources/icons/${name}.svg`, import.meta.url);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
});

Action.make('star').icon('app:star')
```

A prefix is made of lowercase letters, digits and dashes. Before the function is called, the name is checked: it may only contain letters, digits and single `-`, `_` or `.` separators, so `app:../secret` is rejected and never reaches your function. Each icon is resolved once, then kept in memory; registering a set again with the same prefix replaces it.

<Aside variant="warning">
The SVG returned by a set, by an Iconify package or given to `registerIcon()` is inserted into the page as is, without sanitizing: it is trusted application input. Only register icons that come from your application or from packages you installed, never from user input.
</Aside>

## Using custom SVGs as icons

To use a single icon that is not part of a set, such as the logo of a service, register its SVG with `registerIcon()` (or `icons.register()`) when your application starts. The name is then usable wherever an icon name is expected:

```ts
import { registerIcon } from '@navette-js/support';

registerIcon('github', '<svg viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="…"/></svg>');

Action.make('repository').icon('github').url('https://github.com/acme/app')
```

The markup must be a complete `<svg>` element: other values throw an error. It is inserted as is, with the size classes of the component added, so it must come from your application, never from user input. Use `currentColor` to follow the color of the component.

## Replacing the default icons

Every icon that Navette uses by default in its interface has an alias, a unique name such as `panels::sidebar.collapse-button`. To replace icons, give `icons.alias()` the aliases and the icons to use instead, when your application starts:

```ts
import { HtmlString, icons } from '@navette-js/support';

icons.alias({
    'panels::global-search.field': 'lucide:search',
    'panels::sidebar.group.collapse-button': 'm-chevron-double-up',
    'tables::empty-state': new HtmlString('<svg viewBox="0 0 24 24">…</svg>'),
});
```

The value is the name of an icon (Heroicons, another set, or a registered icon), or HTML as an `HtmlString`, which is rendered inside a `<span class="fi-icon">` element with the size classes of the component. Passing `null` restores the default icon. An icon chosen explicitly, such as `ActionGroup.make([...]).icon('m-cog')` or `DeleteAction.make().icon('lucide:trash')`, takes precedence over the alias.

The icons of the interface are resolved when they are rendered, and the default icons of the prebuilt actions (`DeleteAction`, `EditAction`…) when the action is made: register your aliases before the panel is built, like your icon sets.

<Aside variant="tip">
To build a plugin that replaces Heroicons with another set, register the set and the aliases of the icons you want to change in your plugin's `register()` method.
</Aside>

## Rendering an icon in your own HTML

In a render hook, a custom view or an `Html` component, `icon()` returns the markup of an icon with its CSS hook classes (`fi-icon fi-size-md`). It accepts a size, extra attributes, and an alias that can replace the icon:

```ts
import { icon } from '@navette-js/support';

panel.renderHook('panels::sidebar.footer', () => `<a href="/help" class="app-help">${icon('o-question-mark-circle', { size: 'lg', alias: 'app::sidebar.help-link' })} Help</a>`);
```

`icons.resolve()` returns the icon registered for an alias, or `null`; given several aliases, it returns the icon of the first one that has one. `icons.has()` tells whether a name designates an icon that can be rendered.

## Available icon aliases

The rich editor toolbar aliases are also accepted with a single colon and underscores, for example `forms:components.rich-editor.toolbar.clear_formatting`.

### Actions icon aliases

| Alias | Default icon |
| --- | --- |
| `actions::action-group` | `m-ellipsis-vertical` |
| `actions::delete-action` | `c-trash`, `m-trash` |
| `actions::delete-action.grouped` | `m-trash` |
| `actions::delete-action.modal` | `o-trash` |
| `actions::detach-action` | `c-x-mark`, `m-x-mark` |
| `actions::detach-action.modal` | `o-x-mark` |
| `actions::dissociate-action` | `c-x-mark`, `m-x-mark` |
| `actions::dissociate-action.modal` | `o-x-mark` |
| `actions::edit-action` | `c-pencil-square` |
| `actions::edit-action.grouped` | `m-pencil-square` |
| `actions::export-action.grouped` | `m-arrow-down-tray` |
| `actions::force-delete-action` | `c-trash`, `m-trash` |
| `actions::force-delete-action.grouped` | `m-trash` |
| `actions::force-delete-action.modal` | `o-trash` |
| `actions::import-action.grouped` | `m-arrow-up-tray` |
| `actions::modal.confirmation` | `o-exclamation-triangle` |
| `actions::replicate-action` | `c-square-2-stack` |
| `actions::replicate-action.grouped` | `m-square-2-stack` |
| `actions::restore-action` | `c-arrow-uturn-left`, `m-arrow-uturn-left` |
| `actions::restore-action.grouped` | `m-arrow-uturn-left` |
| `actions::restore-action.modal` | `o-arrow-uturn-left` |
| `actions::view-action` | `c-eye` |
| `actions::view-action.grouped` | `m-eye` |

### Forms icon aliases

| Alias | Default icon |
| --- | --- |
| `forms::components.builder.actions.clone` | `m-square-2-stack` |
| `forms::components.builder.actions.collapse` | `m-chevron-up` |
| `forms::components.builder.actions.delete` | `m-trash` |
| `forms::components.builder.actions.edit` | `m-cog-6-tooth` |
| `forms::components.builder.actions.expand` | `m-chevron-down` |
| `forms::components.builder.actions.move-down` | `m-arrow-down` |
| `forms::components.builder.actions.move-up` | `m-arrow-up` |
| `forms::components.builder.actions.reorder` | `m-arrows-up-down` |
| `forms::components.checkbox-list.search-field` | `m-magnifying-glass` |
| `forms::components.file-upload.editor.actions.drag-crop` | `fi-o-crop` |
| `forms::components.file-upload.editor.actions.drag-move` | `fi-o-arrows-move` |
| `forms::components.file-upload.editor.actions.flip-horizontal` | `fi-o-flip-horizontal` |
| `forms::components.file-upload.editor.actions.flip-vertical` | `fi-o-flip-vertical` |
| `forms::components.file-upload.editor.actions.move-down` | `o-arrow-down-circle` |
| `forms::components.file-upload.editor.actions.move-left` | `o-arrow-left-circle` |
| `forms::components.file-upload.editor.actions.move-right` | `o-arrow-right-circle` |
| `forms::components.file-upload.editor.actions.move-up` | `o-arrow-up-circle` |
| `forms::components.file-upload.editor.actions.rotate-left` | `o-arrow-uturn-left` |
| `forms::components.file-upload.editor.actions.rotate-right` | `o-arrow-uturn-right` |
| `forms::components.file-upload.editor.actions.zoom-100` | `o-arrows-pointing-out` |
| `forms::components.file-upload.editor.actions.zoom-in` | `o-magnifying-glass-plus` |
| `forms::components.file-upload.editor.actions.zoom-out` | `o-magnifying-glass-minus` |
| `forms::components.key-value.actions.delete` | `m-trash` |
| `forms::components.key-value.actions.reorder` | `m-arrows-up-down` |
| `forms::components.repeater.actions.clone` | `m-square-2-stack` |
| `forms::components.repeater.actions.collapse` | `m-chevron-up` |
| `forms::components.repeater.actions.delete` | `m-trash` |
| `forms::components.repeater.actions.expand` | `m-chevron-down` |
| `forms::components.repeater.actions.move-down` | `m-arrow-down` |
| `forms::components.repeater.actions.move-up` | `m-arrow-up` |
| `forms::components.repeater.actions.reorder` | `m-arrows-up-down` |
| `forms::components.rich-editor.toolbar.blockquote` | `m-chat-bubble-bottom-center-text` |
| `forms::components.rich-editor.toolbar.bold` | `m-bold` |
| `forms::components.rich-editor.toolbar.bullet-list` | `m-list-bullet` |
| `forms::components.rich-editor.toolbar.clear-formatting` | `fi-o-clear-formatting` |
| `forms::components.rich-editor.toolbar.code` | `fi-o-code` |
| `forms::components.rich-editor.toolbar.code-block` | `fi-o-code-block` |
| `forms::components.rich-editor.toolbar.details` | `fi-o-details` |
| `forms::components.rich-editor.toolbar.highlight` | `fi-o-highlight` |
| `forms::components.rich-editor.toolbar.horizontal-rule` | `m-minus` |
| `forms::components.rich-editor.toolbar.italic` | `m-italic` |
| `forms::components.rich-editor.toolbar.lead` | `fi-o-lead` |
| `forms::components.rich-editor.toolbar.link` | `m-link` |
| `forms::components.rich-editor.toolbar.ordered-list` | `m-numbered-list` |
| `forms::components.rich-editor.toolbar.paragraph` | `fi-o-paragraph` |
| `forms::components.rich-editor.toolbar.redo` | `m-arrow-uturn-right` |
| `forms::components.rich-editor.toolbar.small` | `fi-o-small` |
| `forms::components.rich-editor.toolbar.strike` | `m-strikethrough` |
| `forms::components.rich-editor.toolbar.subscript` | `fi-o-subscript` |
| `forms::components.rich-editor.toolbar.superscript` | `fi-o-superscript` |
| `forms::components.rich-editor.toolbar.table` | `fi-o-table` |
| `forms::components.rich-editor.toolbar.table-add-column-after` | `fi-o-table-add-column-after` |
| `forms::components.rich-editor.toolbar.table-add-column-before` | `fi-o-table-add-column-before` |
| `forms::components.rich-editor.toolbar.table-add-row-after` | `fi-o-table-add-row-after` |
| `forms::components.rich-editor.toolbar.table-add-row-before` | `fi-o-table-add-row-before` |
| `forms::components.rich-editor.toolbar.table-delete` | `fi-o-table-delete` |
| `forms::components.rich-editor.toolbar.table-delete-column` | `fi-o-table-delete-column` |
| `forms::components.rich-editor.toolbar.table-delete-row` | `fi-o-table-delete-row` |
| `forms::components.rich-editor.toolbar.table-merge-cells` | `fi-o-table-merge-cells` |
| `forms::components.rich-editor.toolbar.table-split-cell` | `fi-o-table-split-cell` |
| `forms::components.rich-editor.toolbar.table-toggle-header-cell` | `fi-o-table-toggle-header-cell` |
| `forms::components.rich-editor.toolbar.table-toggle-header-row` | `fi-o-table-toggle-header-row` |
| `forms::components.rich-editor.toolbar.text-color` | `m-swatch` |
| `forms::components.rich-editor.toolbar.underline` | `m-underline` |
| `forms::components.rich-editor.toolbar.undo` | `m-arrow-uturn-left` |
| `forms::components.select.actions.create-option` | `m-plus` |
| `forms::components.select.actions.edit-option` | `m-pencil-square` |
| `forms::components.text-input.actions.copy` | `m-clipboard-document-list` |
| `forms::components.text-input.actions.hide-password` | `m-eye-slash` |
| `forms::components.text-input.actions.show-password` | `m-eye` |
| `forms::components.toggle-buttons.boolean.false` | `o-x-mark` |
| `forms::components.toggle-buttons.boolean.true` | `o-check` |

### Infolists icon aliases

| Alias | Default icon |
| --- | --- |
| `infolists::components.icon-entry.false` | `o-x-circle` |
| `infolists::components.icon-entry.true` | `o-check-circle` |

### Notifications icon aliases

| Alias | Default icon |
| --- | --- |
| `notifications::database.modal.empty-state` | `o-bell-slash` |
| `notifications::notification.close-button` | `m-x-mark` |
| `notifications::notification.danger` | `o-x-circle` |
| `notifications::notification.info` | `o-information-circle` |
| `notifications::notification.success` | `o-check-circle` |
| `notifications::notification.warning` | `o-exclamation-circle` |

### Panels icon aliases

| Alias | Default icon |
| --- | --- |
| `panels::auth.multi-factor.app.actions.disable` | `m-lock-open` |
| `panels::auth.multi-factor.app.actions.disable.modal` | `o-lock-open` |
| `panels::auth.multi-factor.app.actions.disable.notification` | `o-lock-open` |
| `panels::auth.multi-factor.app.actions.regenerate-recovery-codes` | `m-arrow-path` |
| `panels::auth.multi-factor.app.actions.regenerate-recovery-codes.modal` | `o-arrow-path` |
| `panels::auth.multi-factor.app.actions.regenerate-recovery-codes.notification` | `o-lock-closed` |
| `panels::auth.multi-factor.app.actions.set-up` | `m-lock-closed` |
| `panels::auth.multi-factor.app.actions.set-up.modal` | `o-lock-closed` |
| `panels::auth.multi-factor.app.actions.set-up.notification` | `o-lock-closed` |
| `panels::auth.multi-factor.app.actions.show-new-recovery-codes.modal` | `o-lock-closed` |
| `panels::auth.multi-factor.email.actions.disable` | `m-lock-open` |
| `panels::auth.multi-factor.email.actions.disable.modal` | `o-lock-open` |
| `panels::auth.multi-factor.email.actions.disable.notification` | `o-lock-open` |
| `panels::auth.multi-factor.email.actions.set-up` | `m-lock-closed` |
| `panels::auth.multi-factor.email.actions.set-up.modal` | `o-lock-closed` |
| `panels::auth.multi-factor.email.actions.set-up.notification` | `o-lock-closed` |
| `panels::auth.multi-factor.security-keys.actions.register` | `m-key` |
| `panels::auth.multi-factor.security-keys.actions.register.modal` | `o-key` |
| `panels::auth.multi-factor.security-keys.actions.register.notification` | `o-key` |
| `panels::auth.multi-factor.security-keys.actions.remove` | `m-trash` |
| `panels::auth.multi-factor.security-keys.actions.remove.modal` | `o-trash` |
| `panels::auth.multi-factor.security-keys.field.button` | `o-key` |
| `panels::calendar.next-button` | `m-chevron-right` |
| `panels::calendar.previous-button` | `m-chevron-left` |
| `panels::error-page.actions.back` | `m-arrow-left` |
| `panels::error-page.actions.home` | `m-home` |
| `panels::error-page.actions.login` | `m-arrow-right-end-on-rectangle` |
| `panels::error-page.actions.retry` | `m-arrow-path` |
| `panels::global-search.field` | `m-magnifying-glass` |
| `panels::pages.dashboard.navigation-item` | `o-home` |
| `panels::pages.password-reset.request-password-reset.actions.login` | `m-arrow-left` |
| `panels::resources.pages.edit-record.navigation-item` | `o-pencil-square` |
| `panels::resources.pages.manage-related-records.navigation-item` | `o-rectangle-stack` |
| `panels::resources.pages.view-record.navigation-item` | `o-eye` |
| `panels::sidebar.collapse-button` | `o-chevron-left` |
| `panels::sidebar.expand-button` | `o-bars-3`, `o-chevron-right` |
| `panels::sidebar.group.collapse-button` | `m-chevron-up` |
| `panels::sidebar.open-database-notifications-button` | `o-bell` |
| `panels::sub-navigation.mobile-menu.button` | `m-chevron-down` |
| `panels::tenant-menu.billing-button` | `m-credit-card` |
| `panels::tenant-menu.profile-button` | `m-cog-6-tooth` |
| `panels::tenant-menu.registration-button` | `m-plus` |
| `panels::theme-switcher.dark-button` | `m-moon` |
| `panels::theme-switcher.light-button` | `m-sun` |
| `panels::theme-switcher.system-button` | `m-computer-desktop` |
| `panels::topbar.close-sidebar-button` | `o-x-mark` |
| `panels::topbar.group.toggle-button` | `m-chevron-down` |
| `panels::topbar.open-sidebar-button` | `o-bars-3` |
| `panels::user-menu.logout-button` | `m-arrow-left-on-rectangle` |
| `panels::user-menu.profile-item` | `m-user-circle` |
| `panels::user-menu.theme-list.active-item` | `m-check` |
| `panels::widgets.account.logout-button` | `m-arrow-left-end-on-rectangle` |
| `panels::widgets.filament-info.open-documentation-button` | `m-book-open` |
| `panels::widgets.filament-info.open-github-button` | GitHub logo |

### Query builder icon aliases

| Alias | Default icon |
| --- | --- |
| `query-builder::add-rule-action` | `c-plus` |
| `query-builder::constraints.boolean` | `m-check-circle` |
| `query-builder::constraints.date` | `m-calendar` |
| `query-builder::constraints.number` | `m-variable` |
| `query-builder::constraints.relationship` | `m-arrows-pointing-out` |
| `query-builder::constraints.select` | `m-chevron-up-down` |
| `query-builder::constraints.text` | `m-language` |
| `query-builder::or-group.block` | `m-slash` |

### Schemas icon aliases

| Alias | Default icon |
| --- | --- |
| `schemas::components.callout.danger` | `o-x-circle` |
| `schemas::components.callout.info` | `o-information-circle` |
| `schemas::components.callout.success` | `o-check-circle` |
| `schemas::components.callout.warning` | `o-exclamation-circle` |
| `schemas::components.tabs.dropdown-trigger-button` | `m-chevron-down` |
| `schemas::components.tabs.more-tabs-button` | `m-ellipsis-horizontal` |
| `schemas::components.wizard.completed-step` | `o-check` |

### Tables icon aliases

| Alias | Default icon |
| --- | --- |
| `tables::actions.disable-reordering` | `m-check` |
| `tables::actions.enable-reordering` | `m-arrows-up-down` |
| `tables::actions.filter` | `m-funnel` |
| `tables::actions.group` | `m-rectangle-stack` |
| `tables::actions.open-bulk-actions` | `m-ellipsis-vertical` |
| `tables::columns.collapse-button` | `m-chevron-down` |
| `tables::columns.icon-column.false` | `o-x-circle` |
| `tables::columns.icon-column.true` | `o-check-circle` |
| `tables::empty-state` | `o-x-mark` |
| `tables::filters.remove-all-button` | `m-x-mark` |
| `tables::grouping.collapse-button` | `m-chevron-up` |
| `tables::header-cell.sort-asc-button` | `m-chevron-up` |
| `tables::header-cell.sort-button` | `m-chevron-down` |
| `tables::header-cell.sort-desc-button` | `m-chevron-down` |
| `tables::reorder.handle` | `m-bars-2` |
| `tables::search-field` | `m-magnifying-glass` |

### UI components icon aliases

| Alias | Default icon |
| --- | --- |
| `breadcrumbs.separator` | `m-chevron-right` |
| `breadcrumbs.separator.rtl` | `m-chevron-left` |
| `modal.close-button` | `o-x-mark` |
| `pagination.first-button` | `m-chevron-double-left` |
| `pagination.last-button` | `m-chevron-double-right` |
| `pagination.next-button` | `m-chevron-right` |
| `pagination.previous-button` | `m-chevron-left` |
| `section.collapse-button` | `m-chevron-up` |

### Widgets icon aliases

| Alias | Default icon |
| --- | --- |
| `widgets::chart-widget.empty-state` | `o-x-mark` |
