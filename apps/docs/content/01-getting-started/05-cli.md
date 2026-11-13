---
title: CLI reference
---

## Introduction

Projects created with `npm create navette` include the `navette` command (package `@navette-js/cli`). It runs migrations, creates users, and generates resources, pages, widgets, migrations, custom fields, entries and columns, and view components. Run it from the root of the project:

```bash
npx navette make:resource Post --generate
```

`npx navette` without a command lists the commands and the panels of the project. Every command reads `.env` first, so it uses the same database as the server.

Generators never overwrite an existing file: they stop with an error. Add `--force` to replace the file.

## Commands

| Command | What it does |
| --- | --- |
| `navette migrate` | Runs the pending migrations of `src/migrations` |
| `navette make:migration <name>` | Creates a migration file |
| `navette make:user [--admin]` | Creates a user, with the `admin` role when `--admin` is given |
| `navette make:resource <Name>` | Creates a resource and its model |
| `navette make:page <Name>` | Creates a custom page |
| `navette make:widget <Name>` | Creates a dashboard widget |
| `navette make:field <Name>` | Creates a custom form field in `src/fields` |
| `navette make:entry <Name>` | Creates a custom infolist entry in `src/entries` |
| `navette make:column <Name>` | Creates a custom table column in `src/columns` |
| `navette make:component <name>` | Creates a view component in `src/components`, used as `<x-name>` |

## Running migrations

```bash
npx navette migrate
```

Runs every migration of `src/migrations` that has not run yet, in file name order, and prints their names. The server also runs pending migrations when it starts, so you only need this command to migrate without starting the server (in a deployment script, for example). See [project structure](/getting-started/project-structure#the-database).

## Creating a migration

```bash
npx navette make:migration create_posts_table
```

Creates `src/migrations/<timestamp>_create_posts_table.ts`. When the name has the form `create_<table>_table`, the file already creates that table with an `id`, a `name` column and timestamps; otherwise it contains an empty `up()` function. Edit the file, then restart the server or run `npx navette migrate`.

## Creating a user

```bash
npx navette make:user --admin
```

Asks for a name, an email address and a password — leave the password empty to generate one, which is printed once. You can pass the answers as options, for scripts:

```bash
npx navette make:user --admin --name="Ada Lovelace" --email=ada@example.com --password=a-long-password
```

| Option | Effect |
| --- | --- |
| `--admin` | Gives the user the `admin` role, required to sign in to the generated admin panel |
| `--name=` | Name of the user |
| `--email=` | Email address (must not be used by another user) |
| `--password=` | Password, at least 8 characters |

The password is hashed with scrypt, the email address is marked as verified, and the pending migrations run first.

## Generating a resource

```bash
npx navette make:resource Post
```

Creates two files:

- `src/models/Post.ts`, the Objection.js model of the `posts` table (skipped if the model already exists);
- `src/admin/resources/PostResource.ts`, a resource with a form, a table (rows open the edit page) and a bulk delete action.

Restart the server: the resource is discovered and appears in the navigation, at `/admin/posts`.

| Option | Effect |
| --- | --- |
| `--generate` | Reads the columns of the table and generates the form fields and table columns from them |
| `--table=` | Table name, when it is not the plural of the resource name (`--table=blog_posts`) |
| `--panel=` | Panel to add the resource to: `app` writes to `src/app/resources` (default: `admin`) |
| `--force` | Overwrite the resource file if it exists |

### Generating the form and table from the database

With `--generate`, the command runs the pending migrations, reads the columns of the table, and chooses a field and a column for each one:

| Column type | Form field | Table column |
| --- | --- | --- |
| Boolean (or `tinyint` named `is_…`, `has_…`, `can_…`) | `Toggle` | `IconColumn` with `boolean()` |
| Date | `DatePicker` | `TextColumn` with `date()`, sortable |
| Date and time, timestamp | `DateTimePicker` | `TextColumn` with `dateTime()`, sortable |
| Integer, decimal, float | `TextInput` with `numeric()` | `TextColumn` with `numeric()`, sortable |
| Text, JSON | `Textarea`, full width | `TextColumn` with `limit(50)` |
| Column named `…email…` | `TextInput` with `email()` | `TextColumn`, searchable and sortable |
| Anything else | `TextInput` | `TextColumn`, searchable and sortable |

Columns that are not `nullable` get `required()`. The `id`, `created_at`, `updated_at`, `deleted_at`, `password`, `remember_token` and `email_verified_at` columns are left out of the form; `created_at` is added to the table as a hidden column that the user can show. The table shows at most six columns. A column named `name`, `title`, `label` or `subject` becomes the record title used in breadcrumbs and global search.

The generated code is a starting point: edit the resource to add validation, relationships or filters. See [resources](/resources/overview).

<Aside variant="tip">
A typical flow: `npx navette make:migration create_posts_table`, edit the migration, then `npx navette make:resource Post --generate`.
</Aside>

## Generating a page

```bash
npx navette make:page Settings
```

Creates `src/admin/pages/Settings.ts`, a page at `/admin/settings` with a section to fill. Use `--panel=app` for the user panel. See [custom pages](/resources/custom-pages).

## Generating a widget

```bash
npx navette make:widget SalesChart --type=chart
```

Creates `src/admin/widgets/SalesChart.ts`. The dashboard of the panel displays it after a restart.

| `--type=` | Widget |
| --- | --- |
| `stats` (default) | A stats overview widget: a row of numbers. See [stats overview](/widgets/stats-overview) |
| `chart` | A chart widget. See [charts](/widgets/charts) |
| `table` | A table widget. See [table widgets](/widgets/table-widgets) |

Use `--panel=app` for the user panel.

## Generating a custom field, entry or column

```bash
npx navette make:field RatingInput
npx navette make:entry AudioPlayerEntry
npx navette make:column ProgressColumn
```

| Command | File | Class |
| --- | --- | --- |
| `make:field` | `src/fields/<Name>.ts` | A form field that extends `Field`, with an Alpine.js control bound to its state and a validation rule. See [custom fields](/forms/custom-fields) |
| `make:entry` | `src/entries/<Name>.ts` | An infolist entry that extends `ViewEntry` and prints its state, escaped. See [custom entries](/infolists/custom-entries) |
| `make:column` | `src/columns/<Name>.ts` | A table column that extends `Column` and prints its state, escaped. See [custom columns](/tables/columns/custom-columns) |

The name is converted to PascalCase. These classes are not discovered: import them where you use them, `ProgressColumn.make('progress')`.

## Generating a view component

```bash
npx navette make:component stat-card
```

Creates `src/components/stat-card.ejs`, a component that you can use in any view as `<x-stat-card>`. The generated server registers `src/components` with `views.components()`. A dot in the name is a folder: `make:component forms.hint` creates `src/components/forms/hint.ejs`, used as `<x-forms.hint>`. The name is converted to lowercase words separated by hyphens (`StatCard` becomes `stat-card`). See [creating components](/components/creating-components).
