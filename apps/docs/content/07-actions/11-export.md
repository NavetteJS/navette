---
title: Export action
---

## Introduction

Navette includes an action that exports records to a CSV file. The user picks the columns in a modal, and gets a notification with a download link:

```ts
import { ExportAction } from '@navette-js/panels';
import { type Table } from '@navette-js/tables';
import { ProductExporter } from './ProductExporter.ts';

static table(table: Table<Product>): Table<Product> {
    return table
        .headerActions([
            ExportAction.make()
                .exporter(ProductExporter),
        ]);
}
```

The export follows the table: its filters, search and sort apply. `ExportBulkAction` exports the selected records instead:

```ts
import { ExportBulkAction } from '@navette-js/panels';
import { BulkActionGroup, type Table } from '@navette-js/tables';

static table(table: Table<Product>): Table<Product> {
    return table
        .toolbarActions([
            BulkActionGroup.make([
                ExportBulkAction.make().exporter(ProductExporter),
            ]),
        ]);
}
```

The file is built during the request: there is no queue. Large exports are refused (see [limiting the number of rows](#limiting-the-number-of-rows)).

## Creating an exporter

An exporter lists the columns of the file:

```ts
import { ExportColumn, Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getColumns(): ExportColumn[] {
        return [
            ExportColumn.make('sku').label('SKU'),
            ExportColumn.make('name'),
            ExportColumn.make('price').formatStateUsing((price) => Number(price).toFixed(2)),
            ExportColumn.make('brand.name').label('Brand'),
        ];
    }
}
```

A column reads the attribute with its name; a name with dots reads a loaded relationship (`brand.name`). `state()` computes the value yourself, and `formatStateUsing()` formats it:

```ts
import { ExportColumn } from '@navette-js/panels';

ExportColumn.make('full_name')
    .state((record) => `${record.first_name} ${record.last_name}`)
```

### Disabling a column by default

`enabledByDefault(false)` leaves a column unchecked in the modal.

### Disabling the column selection

`columnMapping(false)` removes the column checkboxes: every column is exported, and the modal only asks for confirmation.

## Modifying the export query

`modifyQuery()` changes the query of the exported records, for example to load relationships:

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static modifyQuery(query: any): void {
        query.withGraphFetched('brand');
    }
}
```

## Customizing the file name and the notification

```ts
import { Exporter } from '@navette-js/panels';

export class ProductExporter extends Exporter {
    static getFileName(count: number): string {
        return `products-${new Date().toISOString().slice(0, 10)}`;
    }

    static getCompletedNotificationBody(count: number): string {
        return `Your product export has completed and ${count} rows exported.`;
    }
}
```

## Limiting the number of rows

An export of more than 10,000 rows is refused with a notification. Change the limit with `maxRows()`; it cannot exceed 100,000:

```ts
import { ExportAction } from '@navette-js/panels';

ExportAction.make()
    .exporter(ProductExporter)
    .maxRows(50000)
```

## Downloading the file

The file is kept by the panel for 24 hours, and only the user who exported it can download it. By default it is kept in memory: it is lost when the server restarts and is not shared between server processes. Give the panel your own `DownloadStore` with `downloads()` to change the retention:

```ts
import { DownloadStore, Panel } from '@navette-js/panels';

Panel.make()
    .downloads(new DownloadStore({ ttl: 60 * 60 * 1000, maxFiles: 100 }))
```

## Security

- The action is authorized with the `viewAny` ability of the resource's policy. Only the records of the table's query are exported: [scope your data adapter](/tables/filters/overview#security) to restrict what a user can see.
- Only the declared columns can be exported, whatever the browser sends.
- Cells starting with `=`, `+`, `-`, `@`, a tab or a carriage return (except numbers) are prefixed with `'`, so that spreadsheet software does not run them as formulas.

<Aside variant="warning">
Excel (XLSX) files, queued exports and export history are not available yet.
</Aside>
