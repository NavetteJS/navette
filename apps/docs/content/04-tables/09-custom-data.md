---
title: Custom data
---

## Introduction

Navette's tables do not query a database themselves. A table builds a list query from its state (search, sort, filters, page) and passes it to a **data adapter**, an object that implements the `DataAdapter` interface of `@navette-js/database`. The `ObjectionAdapter` provided by Navette reads an SQL database through Objection and Knex.

You might need to display data that isn't stored in a database, such as a configuration array or the results of an API, or data that is stored, but not accessible through Objection. In such cases, write your own data adapter, and use it wherever an adapter is expected:

```ts
import { Resource, TableWidget } from '@navette-js/panels';

export class CountryResource extends Resource {
    static adapter = new CountriesAdapter(async () => COUNTRIES);
    // ...
}

export class LargestCountries extends TableWidget {
    getDataAdapterForTable() {
        return new CountriesAdapter(async () => COUNTRIES);
    }
    // ...
}
```

Columns work the same way with custom data: the column name is a key of the record object returned by your adapter, and [`getStateUsing()`](/tables/columns/overview#setting-the-state-of-a-column) receives that object.

## Securing custom data

Navette relies on the data adapter to decide which records exist. Your adapter must return only data the current user may access, including any tenant or ownership restrictions, in every method: `paginate()`, `find()`, `listKeys()` and `keysInScope()` alike. Search terms, filters and record selections are client-controlled and must not determine which data the user is authorized to access.

`keysInScope()` is the method Navette uses to check record keys received from the browser, before bulk actions, editable column updates and reordering. Return only the keys of records that the current user can see.

Authorize actions explicitly, with `authorize()` or a [policy](/resources/overview). Permission to display a row does not imply permission to create, update, or delete it. If you use an API credential, its access to the upstream service does not establish the current user's permission to perform an operation.

## Implementing the `DataAdapter` interface

A data adapter implements these methods:

| Method | Purpose |
|---|---|
| `getKey(record)` | The key of a record, as a string. Keys must be unique and stable. |
| `getLabel()` | A name for the records, such as `countries`. |
| `paginate(query)` | One page of records for a list query. |
| `listKeys(query)` | The keys of all the records matching a list query, for "select all". |
| `keysInScope(keys)` | Among keys received from the browser, those of records the adapter can see. |
| `aggregate(query, columns)` | Count, sums, averages, minimums and maximums over a list query, for [summaries](/tables/summaries). |
| `sum(query, columns)` | Sums of columns over a list query. |
| `count()` | The number of records. |
| `find(key)` | One record, or `null`. |
| `create(data)`, `update(key, data)`, `delete(key)`, `deleteMany(keys)` | Writes, used by forms and actions. |
| `exists(column, value, exceptKey)` | Whether another record has this value, for the `unique` validation rule. |
| `supportsSoftDeletes()`, `isTrashed(record)`, `restore(key)`, `forceDelete(key)` | Soft deletes. |

A read-only adapter may refuse writes: return `null` from `update()`, `false` from `delete()`, and throw from `create()`.

### Understanding the list query

`paginate()`, `listKeys()`, `aggregate()` and `sum()` receive a `ListQuery`. Navette fills it only with what the table declares:

| Property | Content |
|---|---|
| `search` | The global search text, or an empty string. |
| `searchColumns` | The search columns of the `searchable()` columns. Each word of `search` must match at least one of them. |
| `columnSearches` | `{ column: text }` for the [individual searches](/tables/columns/overview#searching-individually) that are filled. Each must match. |
| `sort` | `{ column, direction }`: the sort column of a `sortable()` column, or the table's default sort, or `null`. |
| `groupSort` | `{ column, direction }` of the current [group](/tables/grouping), applied before `sort`. |
| `modifiers` | Functions added by filters and tabs, to call with your query object. |
| `trashed` | `'without'`, `'with'` or `'only'`, set by the [trashed filter](/tables/filters/ternary#filtering-soft-deletable-records). |
| `page`, `perPage` | The requested page, from 1, and its size. |

`paginate()` returns a `Page` object: `records`, `total`, `page`, `perPage`, `lastPage`, and `from` and `to`, the positions of the first and last records of the page (from 1), or `null` for an empty page. Clamp `page` between 1 and `lastPage`.

### Sorting

Navette does not sort custom data for you: read `groupSort` and `sort`, and sort your records by them. Sort by the key last, so that records with equal values keep the same order across pages.

### Searching

Apply `search` to `searchColumns` and `columnSearches` yourself. To match `ObjectionAdapter`, split the text into words and ignore case. Columns are only searchable if you mark them `searchable()`; the `column` option of `searchable()` sets the name you receive in `searchColumns`.

### Filters

Filters and list tabs do not know your data source. They add functions to `query.modifiers`, and the adapter calls each of them with a query object of its choice. With `ObjectionAdapter`, it is an Objection query builder.

The built-in [select](/tables/filters/select) and [ternary](/tables/filters/ternary) filters call `where(column, value)` on that object. Give your query object a `where()` method, and they work with your adapter too. A [filter object](/tables/filters/custom#writing-a-filter-object) of your own can call any method your query object provides.

<Aside variant="warning">
[Custom filters](/tables/filters/custom) and the [query builder](/tables/filters/query-builder) write Knex queries: they only work with an SQL adapter.
</Aside>

## Writing an in-memory adapter

The following adapter lists countries from an array, or from any asynchronous source that returns all records at once. It supports searching, sorting, select and ternary filters, summaries and selection, and refuses writes:

```ts
import type { DataAdapter, ListQuery, Page } from '@navette-js/database';

type Country = { code: string; name: string; continent: string; population: number; is_member: boolean };
type ListFilters = Omit<ListQuery, 'page' | 'perPage'>;

/** The object that filters receive: it only knows `where()`. */
class ArrayQuery<R> {
    rows: R[];

    constructor(rows: R[]) {
        this.rows = rows;
    }

    where(column: string, operatorOrValue: unknown, value?: unknown): this {
        const [operator, expected] = value === undefined ? ['=', operatorOrValue] : [String(operatorOrValue), value];
        const normalize = (item: unknown) => (typeof item === 'boolean' ? (item ? 1 : 0) : item);

        this.rows = this.rows.filter((row) => {
            const actual = normalize((row as any)[column]);
            const target = normalize(expected);
            if (operator === '=') return String(actual) === String(target);
            if (operator === '!=') return String(actual) !== String(target);
            if (operator === '>=') return Number(actual) >= Number(target);
            if (operator === '<=') return Number(actual) <= Number(target);
            throw new Error(`Unsupported operator ${operator}`);
        });

        return this;
    }
}

export class CountriesAdapter implements DataAdapter<Country> {
    private load: () => Promise<Country[]>;

    constructor(load: () => Promise<Country[]>) {
        this.load = load;
    }

    /** Records matching the filters and searches of a list query, sorted. */
    private async filter(query: ListFilters): Promise<Country[]> {
        const builder = new ArrayQuery(await this.load());
        for (const modifier of query.modifiers ?? []) modifier(builder);
        let rows = builder.rows;

        const words = (query.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
        const columns = query.searchColumns ?? [];
        if (words.length && columns.length) {
            rows = rows.filter((row) => words.every((word) => columns.some((column) => String((row as any)[column] ?? '').toLowerCase().includes(word))));
        }
        for (const [column, term] of Object.entries(query.columnSearches ?? {})) {
            rows = rows.filter((row) => String((row as any)[column] ?? '').toLowerCase().includes(term.toLowerCase()));
        }

        const sorts = [query.groupSort, query.sort].filter((sort) => sort != null);
        return [...rows].sort((a, b) => {
            for (const { column, direction } of sorts) {
                const left = (a as any)[column];
                const right = (b as any)[column];
                const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''));
                if (result !== 0) return direction === 'desc' ? -result : result;
            }
            return a.code.localeCompare(b.code);
        });
    }

    getKey(record: Country): string { return record.code; }
    getLabel(): string { return 'countries'; }

    async paginate(query: ListQuery): Promise<Page<Country>> {
        const rows = await this.filter(query);
        const perPage = Math.max(1, query.perPage);
        const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
        const page = Math.min(Math.max(1, query.page), lastPage);
        const records = rows.slice((page - 1) * perPage, page * perPage);
        const from = records.length ? (page - 1) * perPage + 1 : null;

        return { records, total: rows.length, page, perPage, lastPage, from, to: from === null ? null : from + records.length - 1 };
    }

    async listKeys(query: ListFilters): Promise<string[]> {
        return (await this.filter(query)).map((row) => row.code);
    }

    async keysInScope(keys: (string | number)[]): Promise<string[]> {
        const known = new Set((await this.load()).map((row) => row.code));
        return keys.map(String).filter((key) => known.has(key));
    }

    async aggregate(query: ListFilters, columns: { sum?: string[]; avg?: string[]; min?: string[]; max?: string[] } = {}) {
        const rows = await this.filter(query);
        const values = (column: string) => rows.map((row) => (row as any)[column]).filter((value) => value !== null && value !== undefined);
        const sum = (column: string) => values(column).reduce((total, value) => total + Number(value), 0);

        return {
            count: rows.length,
            sum: Object.fromEntries((columns.sum ?? []).map((column) => [column, sum(column)])),
            avg: Object.fromEntries((columns.avg ?? []).map((column) => [column, values(column).length ? sum(column) / values(column).length : 0])),
            min: Object.fromEntries((columns.min ?? []).map((column) => [column, values(column).sort()[0] ?? null])),
            max: Object.fromEntries((columns.max ?? []).map((column) => [column, values(column).sort().pop() ?? null])),
        };
    }

    async sum(query: ListFilters, columns: string[]): Promise<Record<string, number>> {
        return (await this.aggregate(query, { sum: columns })).sum;
    }

    async count(): Promise<number> { return (await this.load()).length; }
    async find(key: string | number): Promise<Country | null> { return (await this.load()).find((row) => row.code === String(key)) ?? null; }

    // Read-only source: writes are refused.
    async create(): Promise<Country> { throw new Error('Countries are read-only.'); }
    async update(): Promise<Country | null> { return null; }
    async delete(): Promise<boolean> { return false; }
    async deleteMany(): Promise<number> { return 0; }
    async exists(): Promise<boolean> { return false; }
    supportsSoftDeletes(): boolean { return false; }
    isTrashed(): boolean { return false; }
    async restore(): Promise<boolean> { return false; }
    async forceDelete(): Promise<boolean> { return false; }
}
```

The table is then defined as usual:

```ts
import { SelectFilter, Sum, TernaryFilter, TextColumn, type Table } from '@navette-js/tables';

static table(table: Table<Country>): Table<Country> {
    return table
        .columns([
            TextColumn.make<Country>('name').searchable().sortable(),
            TextColumn.make<Country>('population').label('Population (millions)').numeric().sortable().summarize(Sum.make()),
        ])
        .defaultSort('name')
        .filters([
            SelectFilter.make('continent').options({ africa: 'Africa', america: 'America', asia: 'Asia', europe: 'Europe', oceania: 'Oceania' }),
            TernaryFilter.make('is_member'),
        ])
        .groupedBulkActions([]);
}
```

Because the adapter refuses writes, the example removes the default "Delete" bulk action with `groupedBulkActions([])`. In a resource, also hide the create and edit pages and actions with a [policy](/resources/overview).

<Aside variant="info">
The column names received in `sort`, `searchColumns` and `columnSearches` are the ones you declared in the table, never names chosen by the browser. Still, a filter object can pass any column name to `where()`: if your query object maps column names to something sensitive, such as fields of an API request, accept only known names.
</Aside>

## Using an external API as a table data source

When the data comes from an API that paginates, sorts and searches on its side, translate the list query into a request instead of loading everything. Let filters add parameters to the request through `modifiers`:

```ts
import type { DataAdapter, ListQuery, Page } from '@navette-js/database';

type Product = { id: number; title: string; category: string; price: number };

const SORTABLE = new Set(['title', 'price']);

export class ProductsApiAdapter implements DataAdapter<Product> {
    async paginate(query: ListQuery): Promise<Page<Product>> {
        const params = new URLSearchParams({ limit: String(query.perPage), skip: String((Math.max(1, query.page) - 1) * query.perPage) });
        if (query.search) params.set('q', query.search);
        if (query.sort && SORTABLE.has(query.sort.column)) {
            params.set('sortBy', query.sort.column);
            params.set('order', query.sort.direction);
        }
        // Filters receive the request parameters.
        for (const modifier of query.modifiers ?? []) modifier(params);

        const response = await fetch(`https://api.example.com/products?${params}`, { headers: { authorization: `Bearer ${process.env.PRODUCTS_API_TOKEN}` } });
        if (!response.ok) throw new Error(`Products API error: ${response.status}`);
        const body = (await response.json()) as { products: Product[]; total: number };

        const lastPage = Math.max(1, Math.ceil(body.total / query.perPage));
        const page = Math.min(Math.max(1, query.page), lastPage);
        const from = body.products.length ? (page - 1) * query.perPage + 1 : null;

        return { records: body.products, total: body.total, page, perPage: query.perPage, lastPage, from, to: from === null ? null : from + body.products.length - 1 };
    }

    getKey(record: Product): string { return String(record.id); }
    getLabel(): string { return 'products'; }
    // ... the other methods of `DataAdapter`.
}
```

A filter for this adapter is a [filter object](/tables/filters/custom#writing-a-filter-object) whose modifier sets a request parameter, after checking the value against known options:

```ts
import { type TableFilter } from '@navette-js/tables';

const CATEGORIES: [string, string][] = [['beauty', 'Beauty'], ['furniture', 'Furniture'], ['groceries', 'Groceries']];

export const categoryFilter: TableFilter = {
    name: 'category',
    getLabel: () => 'Category',
    getDefaultState: () => ({ value: null }),
    getFormDefinition: () => ({ placeholder: 'All', options: CATEGORIES }),
    isActive: (state) => CATEGORIES.some(([value]) => value === state.value),
    apply: (query, state) => {
        const category = CATEGORIES.find(([value]) => value === state.value)?.[0];
        if (category) (query.modifiers ??= []).push((params: URLSearchParams) => { params.set('category', category); });
    },
};
```

Implement `find()` with the API's endpoint for a single record, `listKeys()` and `keysInScope()` with requests that return keys, and the write methods with the API's write endpoints, or refuse them. Pagination of the API must be exact: `total` must count every record matching the query.

<Aside variant="warning">
Each render of the table calls `paginate()`, and summaries call `aggregate()` too. Cache the API's responses if they are slow or rate-limited, but never share a cache between users who may see different data.
</Aside>
