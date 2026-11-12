---
title: Render hooks
---

## Introduction

Navette allows you to render HTML at various points of the layout, without overriding any view. These locations are called render hooks. Each one has a fixed name and sits at a fixed place of the markup.

## Registering render hooks

To register a render hook, call `renderHook()` on the panel, with the name of the location and a function that returns HTML:

```ts
import { PanelsRenderHook } from '@navette-js/panels';
import { e } from '@navette-js/support';

panel.renderHook(PanelsRenderHook.BODY_START, () => '<div class="app-banner">Maintenance tonight at 22:00</div>');

panel.renderHook('panels::content.end', () => `<p class="app-footer">${e(companyName)} — support: 555-0100</p>`);
```

The function is called every time the location is rendered, and its result is inserted as is. **Escape every value that does not come from you** with `e()`. Return an empty string, `null` or `undefined` to render nothing.

A hook registered on a panel only applies to the requests of that panel. To register a hook for every panel of the process, use the shared registry of `@navette-js/support`:

```ts
import { renderHooks } from '@navette-js/support';

renderHooks.register('panels::head.end', () => '<link rel="stylesheet" href="/css/admin.css">');
```

## Available render hooks

The names are available as constants: `PanelsRenderHook` and `WidgetsRenderHook` in `@navette-js/panels`, `TablesRenderHook` in `@navette-js/tables`, and `ActionsRenderHook` in `@navette-js/actions`. You may use the constant or the name it contains.

### Panel render hooks

Document and layout:

| Constant | Name | Location |
|---|---|---|
| `HEAD_START`, `HEAD_END` | `panels::head.start`, `panels::head.end` | Start and end of `<head>` |
| `STYLES_BEFORE`, `STYLES_AFTER` | `panels::styles.before`, `panels::styles.after` | Before and after the stylesheets of the panel |
| `BODY_START`, `BODY_END` | `panels::body.start`, `panels::body.end` | Start and end of `<body>` |
| `SCRIPTS_BEFORE`, `SCRIPTS_AFTER` | `panels::scripts.before`, `panels::scripts.after` | Before and after the scripts of the panel |
| `LAYOUT_START`, `LAYOUT_END` | `panels::layout.start`, `panels::layout.end` | Start and end of the layout (`.fi-layout`) |
| `CONTENT_BEFORE`, `CONTENT_AFTER` | `panels::content.before`, `panels::content.after` | Before and after `<main>` |
| `CONTENT_START`, `CONTENT_END` | `panels::content.start`, `panels::content.end` | Start and end of `<main>` |
| `FOOTER` | `panels::footer` | After the content, in both the full and simple layouts |
| `SIMPLE_LAYOUT_START`, `SIMPLE_LAYOUT_END` | `panels::simple-layout.start`, `panels::simple-layout.end` | Start and end of the simple layout (login, registration…) |
| `SIMPLE_PAGE_START`, `SIMPLE_PAGE_END` | `panels::simple-page.start`, `panels::simple-page.end` | Start and end of a simple page |

Sidebar, topbar and menus:

| Constant | Name | Location |
|---|---|---|
| `SIDEBAR_START` | `panels::sidebar.start` | Top of the sidebar |
| `SIDEBAR_LOGO_BEFORE`, `SIDEBAR_LOGO_AFTER` | `panels::sidebar.logo.before`, `panels::sidebar.logo.after` | Around the logo in the sidebar |
| `SIDEBAR_NAV_START`, `SIDEBAR_NAV_END` | `panels::sidebar.nav.start`, `panels::sidebar.nav.end` | Before and after the navigation items |
| `SIDEBAR_FOOTER` | `panels::sidebar.footer` | After the footer of the sidebar (below the user menu) |
| `TOPBAR_BEFORE`, `TOPBAR_AFTER` | `panels::topbar.before`, `panels::topbar.after` | Before and after the topbar |
| `TOPBAR_START`, `TOPBAR_END` | `panels::topbar.start`, `panels::topbar.end` | Start and end of the topbar |
| `TOPBAR_LOGO_BEFORE`, `TOPBAR_LOGO_AFTER` | `panels::topbar.logo.before`, `panels::topbar.logo.after` | Around the logo in the topbar |
| `GLOBAL_SEARCH_BEFORE`, `GLOBAL_SEARCH_AFTER` | `panels::global-search.before`, `panels::global-search.after` | Around the global search field, in the topbar |
| `GLOBAL_SEARCH_START`, `GLOBAL_SEARCH_END` | `panels::global-search.start`, `panels::global-search.end` | Start and end of the global search container |
| `USER_MENU_BEFORE`, `USER_MENU_AFTER` | `panels::user-menu.before`, `panels::user-menu.after` | Around the user menu |
| `USER_MENU_PROFILE_BEFORE`, `USER_MENU_PROFILE_AFTER` | `panels::user-menu.profile.before`, `panels::user-menu.profile.after` | Around the user name at the top of the user menu (shown when the panel has no profile page) |
| `TENANT_MENU_BEFORE`, `TENANT_MENU_AFTER` | `panels::tenant-menu.before`, `panels::tenant-menu.after` | Around the [tenant menu](/panels/tenancy#customizing-the-tenant-menu) |

Pages:

| Constant | Name | Location |
|---|---|---|
| `PAGE_START`, `PAGE_END` | `panels::page.start`, `panels::page.end` | Start and end of a page (`.fi-page`) |
| `PAGE_HEADER_HEADING_BEFORE`, `PAGE_HEADER_HEADING_AFTER` | `panels::page.header.heading.before`, `panels::page.header.heading.after` | Around the heading of the page |
| `PAGE_HEADER_ACTIONS_BEFORE`, `PAGE_HEADER_ACTIONS_AFTER` | `panels::page.header.actions.before`, `panels::page.header.actions.after` | Around the header actions |
| `PAGE_HEADER_WIDGETS_BEFORE`, `PAGE_HEADER_WIDGETS_AFTER` | `panels::page.header-widgets.before`, `panels::page.header-widgets.after` | Before and after the header widgets |
| `PAGE_HEADER_WIDGETS_START`, `PAGE_HEADER_WIDGETS_END` | `panels::page.header-widgets.start`, `panels::page.header-widgets.end` | Inside the grid of header widgets, when the page has some |
| `PAGE_FOOTER_WIDGETS_BEFORE`, `PAGE_FOOTER_WIDGETS_AFTER` | `panels::page.footer-widgets.before`, `panels::page.footer-widgets.after` | Before and after the footer widgets |
| `PAGE_FOOTER_WIDGETS_START`, `PAGE_FOOTER_WIDGETS_END` | `panels::page.footer-widgets.start`, `panels::page.footer-widgets.end` | Inside the grid of footer widgets, when the page has some |
| `PAGE_SUB_NAVIGATION_START_BEFORE`, `PAGE_SUB_NAVIGATION_START_AFTER` | `panels::page.sub-navigation.start.before`, `panels::page.sub-navigation.start.after` | Around a sub-navigation at the start of the page |
| `PAGE_SUB_NAVIGATION_END_BEFORE`, `PAGE_SUB_NAVIGATION_END_AFTER` | `panels::page.sub-navigation.end.before`, `panels::page.sub-navigation.end.after` | Around a sub-navigation at the end of the page |
| `PAGE_SUB_NAVIGATION_SIDEBAR_BEFORE`, `PAGE_SUB_NAVIGATION_SIDEBAR_AFTER` | `panels::page.sub-navigation.sidebar.before`, `panels::page.sub-navigation.sidebar.after` | Inside the column of a start or end sub-navigation |
| `PAGE_SUB_NAVIGATION_TOP_BEFORE`, `PAGE_SUB_NAVIGATION_TOP_AFTER` | `panels::page.sub-navigation.top.before`, `panels::page.sub-navigation.top.after` | Around a sub-navigation rendered as tabs |
| `PAGE_SUB_NAVIGATION_MOBILE_MENU_BEFORE`, `PAGE_SUB_NAVIGATION_MOBILE_MENU_AFTER` | `panels::page.sub-navigation.module-menu.before`, `panels::page.sub-navigation.module-menu.after` | Around the dropdown that replaces the sub-navigation on small screens |

Authentication and resources:

| Constant | Name | Location |
|---|---|---|
| `AUTH_LOGIN_FORM_BEFORE`, `AUTH_LOGIN_FORM_AFTER` | `panels::auth.login.form.before`, `panels::auth.login.form.after` | Around the login form |
| `AUTH_REGISTER_FORM_BEFORE`, `AUTH_REGISTER_FORM_AFTER` | `panels::auth.register.form.before`, `panels::auth.register.form.after` | Around the registration form |
| `AUTH_PASSWORD_RESET_REQUEST_FORM_BEFORE`, `AUTH_PASSWORD_RESET_REQUEST_FORM_AFTER` | `panels::auth.password-reset.request.form.before`, `…after` | Around the password reset request form |
| `AUTH_PASSWORD_RESET_RESET_FORM_BEFORE`, `AUTH_PASSWORD_RESET_RESET_FORM_AFTER` | `panels::auth.password-reset.reset.form.before`, `…after` | Around the new password form |
| `RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE`, `RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER` | `panels::resource.pages.list-records.table.before`, `…after` | Around the table of a list page |
| `RESOURCE_RELATION_MANAGER_BEFORE`, `RESOURCE_RELATION_MANAGER_AFTER` | `panels::resource.relation-manager.before`, `…after` | Around the table of a relation manager or of a relation page |

#### Declared but not rendered

A few names are declared, but rendered nowhere. `UNPLACED_RENDER_HOOKS`, exported by `@navette-js/panels`, lists them:

| Constant | Reason |
|---|---|
| `RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE`, `…_AFTER` | Relation pages render the relation manager hooks instead. |
| `RESOURCE_PAGES_LIST_RECORDS_TABS_START`, `…_END` | Reserved: no page renders it yet. |
| `RESOURCE_TABS_START`, `RESOURCE_TABS_END` | Reserved: no page renders it yet. |

### Table render hooks

| Constant | Name | Location |
|---|---|---|
| `HEADER_BEFORE`, `HEADER_AFTER` | `tables::header.before`, `tables::header.after` | Around the header of the table (heading, header actions) |
| `TOOLBAR_BEFORE`, `TOOLBAR_AFTER` | `tables::toolbar.before`, `tables::toolbar.after` | Around the toolbar |
| `TOOLBAR_START`, `TOOLBAR_END` | `tables::toolbar.start`, `tables::toolbar.end` | Start and end of the toolbar |
| `TOOLBAR_REORDER_TRIGGER_BEFORE`, `…_AFTER` | `tables::toolbar.reorder-trigger.before`, `…after` | Around the reorder button |
| `TOOLBAR_GROUPING_SELECTOR_BEFORE`, `…_AFTER` | `tables::toolbar.grouping-selector.before`, `…after` | Around the grouping selector |
| `TOOLBAR_SEARCH_BEFORE`, `…_AFTER` | `tables::toolbar.search.before`, `…after` | Around the search field |
| `TOOLBAR_COLUMN_MANAGER_TRIGGER_BEFORE`, `…_AFTER` | `tables::toolbar.toggle-column-trigger.before`, `…after` | Around the column manager button |
| `SELECTION_INDICATOR_ACTIONS_BEFORE`, `…_AFTER` | `tables::selection.indicator.actions.before`, `…after` | Around "Select all" and "Deselect all" |
| `FILTER_INDICATORS` | `tables::filter.indicators` | **Replaces** the active filter indicators. Receives `data.filterIndicators`. |
| `HEADER_CELL` | `tables::header.cell` | **Replaces** a header cell. Receives `data.column` and `data.isReordering`. |
| `CONTENT_BEFORE`, `CONTENT_AFTER` | `tables::content.before`, `tables::content.after` | Before and after the rows. Receives `data.table` and `data.records`. |

The two replacing hooks keep the default markup when the hook returns nothing, so they may replace one column only:

```ts
import { TablesRenderHook } from '@navette-js/tables';

panel.renderHook(TablesRenderHook.HEADER_CELL, ({ data }) =>
    data.column.name === 'country' ? '<th scope="col" class="fi-ta-header-cell">Country of residence</th>' : null,
CustomerResource);
```

### Action render hooks

These locations are inside the modal of an action. They receive the action as `data.action`.

| Constant | Name | Location |
|---|---|---|
| `MODAL_CUSTOM_CONTENT_BEFORE`, `MODAL_CUSTOM_CONTENT_AFTER` | `actions::modal.custom-content.before`, `…after` | Start of the content of the modal |
| `MODAL_SCHEMA_BEFORE`, `MODAL_SCHEMA_AFTER` | `actions::modal.schema.before`, `…after` | Around the form of the modal |
| `MODAL_CUSTOM_CONTENT_FOOTER_BEFORE`, `MODAL_CUSTOM_CONTENT_FOOTER_AFTER` | `actions::modal.custom-content-footer.before`, `…after` | End of the content of the modal |

### Widget render hooks

| Constant | Name | Location |
|---|---|---|
| `TABLE_WIDGET_START`, `TABLE_WIDGET_END` | `widgets::table-widget.start`, `widgets::table-widget.end` | Start and end of a table widget |

## Scoping render hooks

Some render hooks can be given a "scope", which allows them to only be rendered on specific pages. Pass the classes as the third argument of `renderHook()`: a page class, a resource (all its pages), a widget class, or an array of them:

```ts
import { PanelsRenderHook } from '@navette-js/panels';

panel.renderHook(
    PanelsRenderHook.PAGE_START,
    () => '<p class="app-notice">An import is in progress.</p>',
    OrderResource,
);
```

Each page carries its own class as a scope, and the pages of a resource also carry the resource. The class of a resource page is generated by Navette from the one you declare in `pages`, so scope the hook to the resource, not to your page class. The locations of the layout (`head`, `body`, `layout`, `content`, `footer`, around the topbar) and of the tables carry the scopes of the displayed page. The locations inside the sidebar, the topbar, the user menu, the tenant menu and global search carry no scope: only hooks without a scope are rendered there.

Hooks without a scope are rendered first, then the hooks of each scope, and a hook registered for several matching scopes is rendered once.

### Retrieving the currently active scopes inside the render hook

The function receives an object with the scopes of the location:

```ts
import { EditRecord, PanelsRenderHook } from '@navette-js/panels';

panel.renderHook(PanelsRenderHook.PAGE_START, ({ scopes }) => {
    const isEditPage = scopes.some((scope: any) => scope.prototype instanceof EditRecord);

    return isEditPage ? '<p class="app-notice">Changes are logged.</p>' : null;
});
```

The page classes of a resource are generated subclasses of `ListRecords`, `CreateRecord`, `EditRecord` and `ViewRecord` (or of your own page classes): compare them with `instanceof` on their prototype, or use the resource itself as a scope.

## Passing data to render hooks

Some locations pass data to the hook, as `data`: the action of a modal, the column of a header cell, the records of a table. See the tables above.

```ts
import { ActionsRenderHook } from '@navette-js/actions';
import { e } from '@navette-js/support';

panel.renderHook(ActionsRenderHook.MODAL_SCHEMA_AFTER, ({ data }) =>
    data.action.getName() === 'delete' ? `<p class="app-hint">${e('This cannot be undone.')}</p>` : null);
```

## Rendering hooks

In your own components and views, render a location with `renderHook()` from `@navette-js/support`. It renders the shared hooks, then the hooks of the panel of the current request:

```ts
import { renderHook } from '@navette-js/support';

const html = renderHook('app::report.footer', [ReportPage], { report });
```

In a schema, the `RenderHook` component renders a location with the scopes of the page:

```ts
import { RenderHook } from '@navette-js/schemas';

schema.components([
    RenderHook.make('app::status.before'),
    // ...
]);
```

Your own locations may have any name; prefix them with the name of your application or plugin.
