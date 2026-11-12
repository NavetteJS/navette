---
title: What is Navette?
---

## Introduction

**Navette is a framework for building admin panels, dashboards and business software with Node.js and TypeScript.**

You describe your interface in TypeScript — resources, forms, tables, actions, widgets — and Navette renders it on the server. You can build a simple admin panel for one database table, or a complete back office with several panels, teams, dashboards and permissions.

Navette uses a Server-Driven UI approach: interfaces are configuration objects (`TextInput.make('name').required()`, `TextColumn.make('email').searchable()`), and the server turns them into HTML. The browser runs a small client, built on Alpine.js, that sends user interactions back to the server: validating a field, sorting a table, opening a modal. Most features need no custom JavaScript, and you can still write your own components when you need them.

Create a project and start the server in two commands:

```bash
npm create navette@latest my-app
cd my-app && npm run dev
```

See [installation](/getting-started/installation) for the options of `npm create navette`.

<Aside variant="warning">
Navette is in **beta**. Its API may still change between beta releases, and some features are not available yet. Each page of this documentation only describes what Navette really implements.
</Aside>

## Packages

Navette is split into packages:

- `@navette-js/panels` - The panel builder: panels, resources, pages, navigation, authentication, multi-tenancy, dashboards and widgets. Most applications only import from this package and from the component packages below.
- `@navette-js/tables` - Interactive tables with search, sorting, filters, pagination, summaries, grouping, editable columns and a query builder.
- `@navette-js/schemas` - The schema system that every layout is built with: grids, sections, tabs, wizards, callouts, and "prime" components like text and icons.
- `@navette-js/forms` - Form fields built on schemas, from text inputs to rich editors, repeaters and builders, with server-side validation.
- `@navette-js/infolists` - Read-only entries (text, icons, images, colors, code, key-value, repeatable) for "View" pages and modals.
- `@navette-js/actions` - Buttons that open modals, confirm, run server code or navigate.
- `@navette-js/support` - Shared utilities: colors, icons, escaping, views, render hooks.
- `@navette-js/database` - Data access with [Knex](https://knexjs.org) and [Objection.js](https://vincit.github.io/objection.js/), and the `DataAdapter` interface that tables and resources read from.
- `@navette-js/wire` - The server side of the component protocol: state snapshots, signed checksums, method calls, file uploads, CSRF protection, and its Express integration.
- `@navette-js/cli` - The `navette` command of a project: migrations, users, and generators for resources, pages and widgets. See the [CLI reference](/getting-started/cli).
- `create-navette` - The project generator behind `npm create navette`.

## How a Navette application works

A Navette application is an Express server. Each panel is described by a `Panel` object and mounted with `panelRouter()`, which serves its pages, its assets and the endpoint the browser talks to. Resources read and write records through a data adapter — an Objection.js adapter is included, and you can write your own for any other source. Views are rendered server-side.

Interfaces are built from small, chainable objects:

| Concept | Example |
| --- | --- |
| A form field | `TextInput.make('name').required().maxLength(255)` |
| A table column | `TextColumn.make('email').searchable().sortable()` |
| A resource's form | `static form(schema: Schema): Schema` |
| An action | `Action.make('publish').requiresConfirmation().action(...)` |
| A panel | `Panel.make().id('admin').path('admin').login()` |
| A dynamic option | a function receiving a context object: `({ record, get }) => …` |

## Customizing the appearance

Every component renders semantic CSS classes (`fi-btn`, `fi-ta-table`…) on top of a Tailwind CSS design system. You can change colors per panel, offer several themes that users choose from, compile your own Tailwind theme, and target those classes to override any component. See [Styling](/styling/overview).

## When Navette is a good fit

Navette is a good fit for operational, data-rich applications — admin panels, internal tools, customer portals — when your stack is Node.js. You configure most features in TypeScript. Familiarity with Express, Knex and Objection.js helps when you connect your own data or extend the framework.

To start, follow the [installation guide](/getting-started/installation), then build [your first panel](/getting-started/your-first-panel).
