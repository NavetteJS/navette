---
title: Configuration
---

## Introduction

A panel is the admin application itself: its brand, its navigation, its pages and resources, and the way users log into it. It is configured with a chain of methods on a `Panel` object, then mounted in an [Express](https://expressjs.com/) application with `panelRouter()`:

```ts
import express from 'express';
import { Dashboard, Panel, panelRouter } from '@navette-js/panels';
import { Color } from '@navette-js/support';
import { WireRuntime } from '@navette-js/wire';

const key = process.env.APP_KEY!;

const panel = Panel.make()
    .id('admin')
    .key(key)
    .brandName('Acme')
    .setColors({ primary: Color.Emerald })
    .login()
    .pages([Dashboard])
    .resources([CustomerResource, OrderResource])
    .auth(users);

const app = express();
app.use(panelRouter(panel, new WireRuntime({ key })));
app.listen(3000);
```

`panelRouter()` returns an Express router that serves the assets of the panel, its pages, its login and logout routes, and the endpoint used by the browser to update components. Your own routes can live in the same application.

## Introducing panels

### The panel object

| Method | Description |
|---|---|
| `id('admin')` | Identifier of the panel. It names the theme cookie (`navette_admin_theme`) and, with `authGuard(null)`, the session cookie (`navette_admin_session`), the components, and the `fi-panel-admin` class of the `<body>`. Defaults to `admin`. |
| `key(secret)` | Secret used to sign the sessions, the password reset links and the email verification links. Required in production: see [deployment](/advanced/deployment#setting-the-application-key). |
| `authGuard('web')` | Session shared with the panels that use the same guard (`web` by default); `null` gives the panel a session of its own. See [sharing the session between panels](/panels/users#sharing-the-session-between-panels). |
| `canAccess(fn)` | Who may use the panel. See [authorizing access](/panels/users#authorizing-access-to-the-panel). |
| `auth(provider)` | The [user provider](/panels/users#providing-users) that checks credentials and finds users. |
| `login()` | Enables the login page. See [users](/panels/users). |
| `pages([...])` | Custom pages, including dashboards. |
| `resources([...])` | [Resources](/resources/overview). |
| `widgets([...])` | Widgets of the panel, displayed by its dashboards. |

### The runtime

Pages, widgets and relation managers are stateful components: the browser sends their state back to the server, which runs a method and renders them again. The `WireRuntime` of `@navette-js/wire` handles these requests. It signs the state of every component with its `key`, and receives [file uploads](/advanced/file-storage) when it is given an `UploadStore`:

```ts
import { UploadStore, WireRuntime } from '@navette-js/wire';

const runtime = new WireRuntime({ key, uploads: new UploadStore('./storage/tmp', key) });
app.use(panelRouter(panel, runtime));
```

Each panel needs its own runtime: see [multiple panels](#running-multiple-panels-in-one-application).

## Changing the path

By default, a panel is served at the root of the application: `/login`, `/customers`. To serve it under a prefix, use `path()`:

```ts
panel.path('admin');
```

The pages are then at `/admin/login`, `/admin/customers`, and the component endpoint at `/admin/livewire/update`.

## Setting a domain

A panel may be served on its own domain. Requests for any other host go to the next routes of the application, as if the panel did not exist:

```ts
panel.domain('admin.example.com');
```

`domains()` accepts several of them. The host is read from `req.hostname`: behind a proxy, set `app.set('trust proxy', …)` so that Express trusts the `X-Forwarded-Host` header.

## Setting the brand

The brand name is displayed in the sidebar or topbar, on the login page, and at the end of every page title:

```ts
panel.brandName('Acme');
```

To display a logo instead, pass its URL to `brandLogo()`. You may give a different logo for dark mode, and change its height (`1.5rem` by default):

```ts
panel
    .brandLogo('/images/logo-light.svg')
    .darkModeBrandLogo('/images/logo-dark.svg')
    .brandLogoHeight('2rem')
    .favicon('/images/icon.svg');
```

The files are served by your application, for example with `app.use(express.static('./public'))`.

## Changing the font

The panel uses the Inter font, served by the panel itself. To use another font, pass its family to `font()`. Without a second argument, the font is loaded from [Bunny Fonts](https://fonts.bunny.net):

```ts
panel.font('Albert Sans');
```

To load the font from elsewhere, for example from your own server, pass the URL of its stylesheet:

```ts
panel.font('Albert Sans', '/fonts/albert-sans.css');
```

Each [user-selectable theme](/styling/overview#offering-themes-to-users) may also have its own font.

## Customizing the maximum content width

By default, the content of a page is at most `7xl` wide. Change it with `maxContentWidth()`, which takes a size name (`xs` to `7xl`, `full`, `screen-sm` to `screen-2xl`, `screen`, `prose`):

```ts
panel.maxContentWidth('full');
```

## Setting the default sub-navigation position

Sub-navigation is rendered at the start of the page by default. You may change it for every page of the panel with `subNavigationPosition()`, which takes `'start'`, `'end'` or `'top'` (tabs):

```ts
panel.subNavigationPosition('top');
```

A resource or a page may override it with its own static `subNavigationPosition` property.

## SPA mode

SPA mode uses the navigation of Livewire (`wire:navigate`): links between pages of the panel load the new page in the background and swap it in, without a full reload. To enable it:

```ts
panel.spa();
```

### SPA prefetching

Prefetching loads a page as soon as the user hovers its link, so that it is often ready when they click (`wire:navigate.hover`):

```ts
panel.spa(true, { prefetch: true });
```

Prefetched pages are requested like any other page: each hovered link makes a request, even if the user does not click it.

## Unsaved changes alerts

The user may be warned before leaving a create or edit page whose form has changes that are not saved yet:

```ts
panel.unsavedChangesAlerts();
```

Closing the tab or reloading asks the browser's confirmation; in SPA mode, following a link of the panel asks first too. The comparison is made with the form data as last saved (`savedDataHash`). A page may opt in or out with its static `hasUnsavedDataChangesAlert` property:

```ts
import { EditRecord } from '@navette-js/panels';

export class EditSettings extends EditRecord {
    static hasUnsavedDataChangesAlert = false;
}
```

A field whose value is reformatted as the page loads (a [mask](/forms/text-input#input-masking)) counts as a change.

## Enabling database transactions

The creation and the saving of a record may run in a database transaction: if anything throws between `beforeCreate()` and `afterCreate()` (or `beforeSave()` and `afterSave()`), every query of the operation is rolled back, relationships included:

```ts
panel.databaseTransactions();
```

A page may opt in or out with its static `hasDatabaseTransactions` property. The transaction is opened by the resource's data adapter (`DataAdapter.transaction()`): `ObjectionAdapter` supports it, and a custom adapter without this method saves as before.

Every query made through a connection created with `createConnection()` or `sqlite()` joins the open transaction, whether it comes from an Objection model or from `knex(table)`. Your own code can open one with `transaction()`:

```ts
import { transaction } from '@navette-js/database';

await transaction(knex, async () => {
    await knex('accounts').where('id', from).decrement('balance', amount);
    await knex('accounts').where('id', to).increment('balance', amount);
});
```

Called inside an open transaction, `transaction()` joins it. With SQLite, a single connection is shared: a query sent from a Knex instance created outside `createConnection()` would wait for the transaction to end.

## Strict authorization mode

Without a rule for an ability in its [policy](/resources/authorization), a resource allows it. In strict mode, checking an ability that the policy does not define throws an error, which shows the missing rules while developing:

```ts
panel.strictAuthorization();
```

The panel's `authorizeUsing()` hook is still consulted first: when it decides, no rule is needed.

## Lifecycle hooks

`bootUsing()` runs a function on every request handled by the panel (its pages and their component updates), before them:

```ts
panel.bootUsing(async (panel, req) => {
    // Per-request setup: a locale, a feature flag…
});
```

An error thrown by the function is passed to the Express error handler.

## Configuring the topbar and the sidebar

By default, the panel has a topbar, with the user menu and global search, and a sidebar with the navigation. Several methods change this layout:

| Method | Effect |
|---|---|
| `topbar(false)` | Removes the topbar: the logo, global search, notifications and user menu move to the sidebar. |
| `topNavigation()` | Moves the navigation to the topbar, with a dropdown per group. See [navigation](/panels/navigation#using-top-navigation). |
| `navigation(false)` | Removes the navigation entirely. |
| `sidebarCollapsibleOnDesktop()` | Lets the user collapse the sidebar to a column of icons on large screens. |
| `sidebarFullyCollapsibleOnDesktop()` | Lets the user hide the sidebar entirely on large screens. |
| `userMenuPosition('sidebar')` | Moves the user menu to the sidebar. |
| `globalSearchPosition('sidebar')` | Moves [global search](/resources/global-search) to the sidebar. |
| `databaseNotificationsPosition('sidebar')` | Moves the notifications bell to the sidebar. |

The three positions default to the topbar when there is one, and to the sidebar otherwise.

## Applying middleware

`panelRouter()` returns an ordinary Express router. You may run your own middleware before it, for the whole application or for the path of the panel:

```ts
app.set('trust proxy', 1);

// Your own middleware: here, the panel is only reachable from the office network.
app.use('/admin', (req, res, next) => {
    if (!isOfficeAddress(req.ip)) return void res.status(403).send('Forbidden');
    next();
});

app.use(panelRouter(panel, runtime));
```

A middleware mounted before the panel can also fill an `AsyncLocalStorage` with request data (the logged-in user, a locale) for your adapters to read. To know the user, call `await panel.user(req)`, which reads the session cookie of the panel.

## Customizing error pages

The errors of a panel are answered with its own error pages, in its colors, light and dark: the Navette cable car in trouble, with the status code painted on its cabin. Each common status has its scene, title and description, in English and French:

| Status | Page |
|---|---|
| 401 | A padlock on the line: sign in first. |
| 403 | A no-entry sign stops the cabin. |
| 404 | The cable disappears into the clouds. |
| 419 | The cabin left the station without you. |
| 429 | Rush hour: the cabins queue on the line. |
| 500 | The cable snapped and the cabin dangles. |
| 503 | The line is under maintenance. |

Other client errors use the 404 scene, other server errors the 500 one. Requests that do not accept HTML, such as `fetch()` calls asking for JSON, get the status in plain text.

The pages answer the URLs of a panel that match nothing (when the panel has a path), the pages a user may not open, invalid links, and the errors thrown while rendering a page, which are also logged with `console.error()`. With `NODE_ENV=development`, the 500 page shows the stack of the error; it is never shown otherwise. Component updates keep Livewire's own error handling.

### Answering unknown URLs at the root

A panel served at the root leaves the URLs it does not know to the rest of your application. Mount `panelNotFound()` after your routes to answer them with its 404 page:

```ts
import { panelNotFound, panelRouter } from '@navette-js/panels';

app.use(panelRouter(panel, runtime));
app.get('/api/health', (req, res) => res.send('ok'));
app.use(panelNotFound(panel));
```

### Using the error pages in your middleware

`renderErrorPage()` answers a request with the error page of a status. A maintenance mode, for example:

```ts
import { renderErrorPage } from '@navette-js/panels';

app.use((req, res, next) => {
    if (!isUnderMaintenance()) return next();
    renderErrorPage(panel, req, res, 503);
});
```

The `description` option replaces the text of the status: `renderErrorPage(panel, req, res, 403, { description: 'Your trial has ended.' })`.

The page is the `filament-panels::errors.page` view: [override it](/styling/css-hooks#overriding-views) to change its layout. Its elements have `fi-error-*` CSS hook classes, and its `<body>` has the `fi-error-<status>` class.

## Running multiple panels in one application

An application may serve several panels, for example an admin panel for staff and an app panel for customers. Give each panel its own `id`, its own `path`, and its own `WireRuntime`:

```ts
const adminPanel = Panel.make().id('admin').path('admin').key(key) /* ... */;
const customerPanel = Panel.make().id('app').path('app').key(key) /* ... */;

app.use(panelRouter(customerPanel, new WireRuntime({ key, uploads: new UploadStore('./storage/tmp', key) })));
app.use(panelRouter(adminPanel, new WireRuntime({ key, uploads: new UploadStore('./storage/tmp', key) })));
```

Passing the same runtime to two panels throws an error at startup. Each panel then has:

- its own component endpoint (`/admin/livewire/update`, `/app/livewire/update`);
- a shared session with the other panels by default: see [sharing the session between panels](/panels/users#sharing-the-session-between-panels);
- its own colors, themes and [render hooks](/advanced/render-hooks), applied to its requests only.

Global settings made with `configureUsing()`, overridden views and the render hooks registered with `renderHooks.register()` are shared by all the panels of the process.

At most one panel may be served at the root. Mount the panels that have a path before the one at the root, whose routes would otherwise catch their URLs. The demo application (`apps/demo/server.ts` and `apps/demo/app-panel.ts`) runs two panels this way.

