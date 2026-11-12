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
| `id('admin')` | Identifier of the panel. It names the session and theme cookies (`navette_admin_session`), the components, and the `fi-panel-admin` class of the `<body>`. Defaults to `admin`. |
| `key(secret)` | Secret used to sign the sessions, the password reset links and the email verification links. Required in production: see [deployment](/advanced/deployment#setting-the-application-key). |
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
- its own session: logging into one panel does not log into the other;
- its own colors, themes and [render hooks](/advanced/render-hooks), applied to its requests only.

Global settings made with `configureUsing()`, overridden views and the render hooks registered with `renderHooks.register()` are shared by all the panels of the process.

At most one panel may be served at the root. Mount the panels that have a path before the one at the root, whose routes would otherwise catch their URLs. The demo application (`apps/demo/server.ts` and `apps/demo/app-panel.ts`) runs two panels this way.

<Aside variant="warning">
Setting a domain, SPA prefetching, unsaved changes alerts, database transactions, strict authorization mode and panel lifecycle hooks are not available yet. A [plugin](/panels/plugins) may run code when the router is created.
</Aside>
