---
title: Custom columns
---

## Introduction

When none of the built-in columns displays your data the way you need, you may render the cell yourself. Navette offers two ways:

- a `ViewColumn`, rendered by a function or an EJS view, for a one-off cell;
- a column class that extends `Column`, which you can reuse across your project, with its own configuration methods.

Both get sorting, searching, labels, alignment, URLs and toggling from the base `Column` class, like the built-in columns.

## Rendering a column with a function

Pass a function to the `view()` method of a `ViewColumn`. It receives an object with the column's `state`, the `record` and the `column` instance, and returns the HTML of the cell. It may be asynchronous:

```ts
import { e } from '@navette-js/support';
import { ViewColumn } from '@navette-js/tables';

ViewColumn.make<Project>('progress')
    .view(({ state, record }) => `<span title="${e(record.name)}">${e(state)}%</span>`)
```

```preview
// records: [{"name": "Website redesign", "progress": 75}, {"name": "Mobile app", "progress": 30}, {"name": "Data migration", "progress": 100}]
new Table()
    .pluralModelLabel('projects')
    .columns([
        TextColumn.make('name'),
        ViewColumn.make('progress')
            .view(({ state, record }) => `<span title="${e(record.name)}">${e(state)}%</span>`),
    ])
```

<Aside variant="danger">
The HTML returned by your function is inserted into the page as it is. Escape every value you insert with `e()` from `@navette-js/support`, especially values that users can edit. Otherwise, a stored value could inject scripts into the page (XSS).
</Aside>

## Rendering a column with an EJS view

You may also pass the name of an EJS view. Register a namespace for your views once, when your application starts, with `views.namespace()`:

```ts
import { fileURLToPath } from 'node:url';
import { views } from '@navette-js/support';

views.namespace('app', fileURLToPath(new URL('./views', import.meta.url)));
```

The view `app::columns.progress` is then the file `views/columns/progress.ejs`:

```ts
import { ViewColumn } from '@navette-js/tables';

ViewColumn.make<Project>('progress')
    .view('app::columns.progress', { unit: 'done' })
```

The second argument of `view()` is extra data passed to the view. The view may use [UI components](/components/overview), such as `<x-badge>`.

### Accessing the state of the column in the view

Inside the view, the [state](/tables/columns/overview#column-content-state) of the column is available as `state`, or by calling `getState()`. Output it with `<%= %>`, which escapes it:

```html
<div class="progress"><%= state %>% <%= unit %></div>
```

<Aside variant="warning">
Use `<%- %>` only for HTML that you built and escaped yourself: it does not escape its value.
</Aside>

### Accessing the record in the view

Inside the view, you may access the current row's record using the `record` variable, or by calling `getRecord()`:

```html
<div role="progressbar" aria-valuenow="<%= state %>" aria-label="<%= record.name %>">
    <%= state %>%
</div>
```

### Accessing the current column instance in the view

Inside the view, you may access the current column instance using `column`. You can call its public methods to read other information:

```html
<span class="sr-only"><%= column.getLabel() %></span>
```

## Creating a custom column class

To reuse a column, extend the `Column` class. Implement `toHtml()`, which receives the record and returns the HTML of the cell, and a static `make()` method:

```ts
import { configured, e } from '@navette-js/support';
import { Column } from '@navette-js/tables';

export class ProgressColumn<R = any> extends Column<R> {
    static make<R = any>(name: string): ProgressColumn<R> {
        return configured(new ProgressColumn<R>(name));
    }

    async toHtml(record: R): Promise<string> {
        const value = Number(await this.getState(record)) || 0;

        return `<progress max="100" value="${e(value)}">${e(value)}%</progress>`;
    }
}
```

`getState()` returns the state of the column, taking [`getStateUsing()`](/tables/columns/overview#setting-the-state-of-a-column) into account. Wrapping the new instance in `configured()` applies the [global settings](/tables/columns/overview#global-settings) registered with `ProgressColumn.configureUsing()`.

The same escaping rules apply: `toHtml()` returns raw HTML.

The CLI generates such a class in `src/columns`, with a `toHtml()` that prints the state escaped. The command never overwrites an existing file, unless you pass `--force`:

```bash
npx navette make:column ProgressColumn
```

### Adding a configuration method to a custom column class

You may add a public method that stores a configuration value and returns the column, then use the value in `toHtml()`:

```ts
import { configured, e } from '@navette-js/support';
import { Column } from '@navette-js/tables';

export class ProgressColumn<R = any> extends Column<R> {
    private _max = 100;

    static make<R = any>(name: string): ProgressColumn<R> {
        return configured(new ProgressColumn<R>(name));
    }

    max(max: number): this {
        this._max = max;

        return this;
    }

    async toHtml(record: R): Promise<string> {
        const value = Number(await this.getState(record)) || 0;

        return `<progress max="${e(this._max)}" value="${e(value)}">${e(value)}</progress>`;
    }
}
```

To pass the configuration value to the column, chain the method:

```ts
import { ProgressColumn } from './columns/ProgressColumn.ts';

ProgressColumn.make('completed_tasks')
    .max(50)
    .label('Progress')
    .sortable()
```

```preview
// records: [{"name": "Website redesign", "completed_tasks": 38}, {"name": "Mobile app", "completed_tasks": 12}, {"name": "Data migration", "completed_tasks": 50}]
class ProgressColumn extends Column {
    _max = 100;

    static make(name) {
        return configured(new ProgressColumn(name));
    }

    max(max) {
        this._max = max;

        return this;
    }

    async toHtml(record) {
        const value = Number(await this.getState(record)) || 0;

        return `<progress max="${e(this._max)}" value="${e(value)}">${e(value)}</progress>`;
    }
}

return new Table()
    .pluralModelLabel('projects')
    .columns([
        TextColumn.make('name'),
        ProgressColumn.make('completed_tasks')
            .max(50)
            .label('Progress')
            .sortable(),
    ])
```

### Allowing functions in a configuration method

To let users configure the column per record, accept a function as well as a value, and call it in `toHtml()` with the record:

```ts
import { configured, e } from '@navette-js/support';
import { Column } from '@navette-js/tables';

export class ProgressColumn<R = any> extends Column<R> {
    private _max: number | ((record: R) => number) = 100;

    static make<R = any>(name: string): ProgressColumn<R> {
        return configured(new ProgressColumn<R>(name));
    }

    max(max: number | ((record: R) => number)): this {
        this._max = max;

        return this;
    }

    getMax(record: R): number {
        return typeof this._max === 'function' ? this._max(record) : this._max;
    }

    async toHtml(record: R): Promise<string> {
        const value = Number(await this.getState(record)) || 0;

        return `<progress max="${e(this.getMax(record))}" value="${e(value)}">${e(value)}</progress>`;
    }
}
```

```ts
ProgressColumn.make<Project>('completed_tasks')
    .max((record) => record.tasks_count)
```

<Aside variant="info">
Custom columns are rendered on the server and are not interactive by themselves. To let users change a value from the table, use an [editable column](/tables/columns/overview#introduction) or a [record action](/tables/actions#record-actions).
</Aside>
