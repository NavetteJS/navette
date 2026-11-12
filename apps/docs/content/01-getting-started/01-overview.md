---
title: What is Navette?
---

## Introduction

**Navette is a framework for building admin panels, dashboards and business software with Node.js and TypeScript.**

It is a port of [Filament](https://filamentphp.com), the Laravel framework, to Node.js. You describe your interface in TypeScript — resources, forms, tables, actions, widgets — and Navette renders it on the server. You can build a simple admin panel for one database table, or a complete back office with several panels, teams, dashboards and permissions.

Like Filament, Navette uses a Server-Driven UI approach: interfaces are configuration objects (`TextInput.make('name').required()`, `TextColumn.make('email').searchable()`), and the server turns them into HTML. The browser runs a small client (a port of Livewire's protocol, with Alpine.js) that sends user interactions back to the server. Most features need no custom JavaScript.

Navette reuses Filament's compiled CSS and JavaScript as they are, and produces the same HTML structure, classes and attributes. A Navette panel therefore looks exactly like a Filament panel, and Filament's CSS hook classes (`fi-btn`, `fi-ta-table`…) work the same way.

<Aside variant="warning">
Navette is in **beta**. Its API may still change between beta releases, and some Filament features are not available yet. Each page of this documentation only describes what Navette really implements.
</Aside>

## Packages

Navette is split into packages that mirror Filament's:

- `@navette-js/panels` - The panel builder: panels, resources, pages, navigation, authentication, multi-tenancy, dashboards and widgets. Most applications only import from this package and from the component packages below.
- `@navette-js/tables` - Interactive tables with search, sorting, filters, pagination, summaries, grouping, editable columns and a query builder.
- `@navette-js/schemas` - The schema system that every layout is built with: grids, sections, tabs, wizards, callouts, and "prime" components like text and icons.
- `@navette-js/forms` - Form fields built on schemas, from text inputs to rich editors, repeaters and builders, with server-side validation.
- `@navette-js/infolists` - Read-only entries (text, icons, images, colors, code, key-value, repeatable) for "View" pages and modals.
- `@navette-js/actions` - Buttons that open modals, confirm, run server code or navigate.
- `@navette-js/support` - Shared utilities: colors, icons, escaping, views, render hooks.
- `@navette-js/database` - Data access with [Knex](https://knexjs.org) and [Objection.js](https://vincit.github.io/objection.js/), and the `DataAdapter` interface that tables and resources read from.
- `@navette-js/wire` - The server-side runtime of the component protocol: state snapshots, signed checksums, method calls, file uploads, CSRF protection, and its Express integration.

## How Navette relates to Filament

Navette follows Filament's API as closely as TypeScript allows, so Filament knowledge transfers directly:

| Filament (PHP) | Navette (TypeScript) |
| --- | --- |
| `TextInput::make('name')->required()` | `TextInput.make('name').required()` |
| `public static function form(Schema $schema): Schema` | `static form(schema: Schema): Schema` |
| Eloquent models | Objection.js models, or any `DataAdapter` |
| Policies and gates | Resource `policy` objects and `panel.authorizeUsing()` |
| `$panel->login()->registration()` | `panel.login().registration()` |
| Closures with injected `$record`, `$get`… | Functions receiving a context object: `({ record, get }) => …` |

The main differences come from the platform: there is no Laravel container, no Eloquent, and no Blade. Data comes from a `DataAdapter` (an Objection.js adapter is included), views are EJS templates, and the application is an Express server that mounts one router per panel.

## Customizing the appearance

Navette ships Filament's design system: Tailwind CSS compiled into semantic classes. You can change colors per panel, offer several themes that users choose from, compile your own Tailwind theme, and target the `fi-` CSS hook classes to override any component. See [Styling](/styling/overview).

## When Navette is a good fit

Navette is a good fit for operational, data-rich applications — admin panels, internal tools, customer portals — when your stack is Node.js. You configure most features in TypeScript. Familiarity with Express, Knex and Objection.js helps when you connect your own data or extend the framework.

To start, follow the [installation guide](/getting-started/installation), then build [your first panel](/getting-started/your-first-panel).
