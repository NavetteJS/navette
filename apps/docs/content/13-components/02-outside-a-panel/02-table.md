---
title: Rendering a table outside a panel
---

## Introduction

A table component shows a [table](/tables/overview) in your own application, outside any panel: search, sorting, filters, pagination, the column manager, record and bulk actions all work as in a panel. Set up the `Livewire` instance first: see [rendering a form outside a panel](/components/outside-a-panel/form#setting-up-the-components).

## Adding the table

Extend `TableComponent`, configure the table in `table()`, and return the data adapter of its records from `getDataAdapterForTable()`:

```ts
import { Action } from '@navette-js/actions';
import { ObjectionAdapter } from '@navette-js/database';
import { Notification } from '@navette-js/panels';
import { TableComponent } from '@navette-js/panels/livewire';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';
import { Product } from '../models/Product.ts';

export class ListProducts extends TableComponent {
    table(table: Table): Table {
        return table
            .columns([
                TextColumn.make('name').searchable().sortable(),
                TextColumn.make('price').money('usd').sortable(),
            ])
            .filters([
                SelectFilter.make('category').options({ lamps: 'Lamps', desks: 'Desks' }),
            ])
            .recordActions([
                Action.make('reserve').requiresConfirmation().action(({ record }) => {
                    Notification.make().success().title(`Reserved ${(record as Product).name}`).send();
                }),
            ]);
    }

    getDataAdapterForTable() {
        return new ObjectionAdapter(Product, { modify: (query) => { query.where('is_visible', true); } });
    }
}
```

Register it, and serve it as a page or embed it in yours:

```ts
livewire.components([ListProducts]);
app.get('/products', livewire.page(ListProducts));
```

Without a view, the component renders the table. With a view (`static view`), render it with `table()`; the modals of its actions come with it:

```html
<div>
    <h2>Our products</h2>

    <%- await table() %>
</div>
```

The adapter decides which records the table can show, select and act on: scope it to what the user may see. Record actions find their record through the same adapter, so a forged record key outside its scope is refused.

A table component has no default actions: no edit link and no delete bulk action. Declare the ones you need. It may also host forms and actions, like a `LivewireComponent`.

## Generating a table component

```bash
npx navette make:livewire-table ListProducts Product --generate
```

The CLI creates the component in `src/livewire`. With `--generate`, the columns come from the model's table (`--table=` names another table).

## Testing a table component

```ts
import { livewire as test } from '@navette-js/panels/testing';

await test(ListProducts, {}, { panel: livewire.panel, user: null })
    .searchTable('Lamp')
    .assertCanSeeTableRecords([lamp])
    .callTableAction('reserve', lamp)
    .assertNotified('Reserved Lamp');
```

See [testing tables](/testing/tables).
