---
title: Global search
---

## Introduction

Global search allows you to search across all of your resource records, from anywhere in the app. The field appears in the topbar (or in the sidebar, when the panel has no topbar) as soon as one resource of the panel is searchable.

To enable global search on a resource, set its [record title attribute](/resources/overview#record-titles):

```ts
export class CustomerResource extends Resource {
    static recordTitleAttribute = 'name';
}
```

The results are grouped by resource, under its plural label. Each word typed by the user must appear in at least one searchable column, regardless of case. Each result leads to the record's View page if the user may view it, otherwise to its edit page; on a [simple resource](/resources/overview#simple-modal-resources), it opens the list with the view or edit modal.

## Setting global search result titles

The title of a result is the record title. To change it for global search only, override `getGlobalSearchResultTitle()`:

```ts
static getGlobalSearchResultTitle(record: any): string {
    return `${record.number} (${record.status})`;
}
```

The title is escaped when rendered.

## Globally searching across multiple columns

By default, only the record title attribute is searched. To search other columns, list them in `globallySearchableAttributes`:

```ts
static globallySearchableAttributes = ['name', 'email'];
```

The columns are filtered by the adapter of the resource, so they may include columns computed in its query, like a `customer_name` subquery added by the [`modify` option](/advanced/data-adapters#customizing-the-query):

```ts
export class OrderResource extends Resource {
    static globallySearchableAttributes = ['number', 'customer_name'];
}
```

To exclude a resource that has a record title attribute, set an empty array:

```ts
static globallySearchableAttributes = [];
```

## Adding extra details to global search results

Global search results can display details below their title. Return them from `getGlobalSearchResultDetails()`, as label and value pairs. Empty values are left out:

```ts
static getGlobalSearchResultDetails(record: any): Record<string, unknown> {
    return {
        Author: record.author_name,
        Category: record.category_name,
    };
}
```

## Customizing global search result URLs

To lead a result somewhere else, override `getGlobalSearchResultUrl()`. It receives the record and the user, and returns a URL, or `null` to leave the result out:

```ts
static async getGlobalSearchResultUrl(record: any, user: User | null): Promise<string | null> {
    return (await this.can('update', user, record)) ? this.getUrl('edit', record.id) : null;
}
```

## Limiting the number of global search results

By default, global search returns up to 50 results per resource. Change it with `globalSearchResultsLimit`:

```ts
static globalSearchResultsLimit = 20;
```

## Sorting global search results

The groups of results follow the order in which the resources are registered on the panel. To change it, give resources a `globalSearchSort`: lower numbers come first, and resources without one come last.

```ts
static globalSearchSort = 2;
```

## Disabling global search

To remove the field from a panel, use `globalSearch(false)`:

```ts
panel.globalSearch(false);
```

## Moving the global search to the sidebar

When the panel has a topbar, the field is rendered in it. To put it in the sidebar, use `globalSearchPosition()`:

```ts
panel.globalSearchPosition('sidebar');
```

## Registering global search key bindings

The global search field can be opened using keyboard shortcuts:

```ts
panel.globalSearchKeyBindings(['command+k', 'ctrl+k']);
```

## Configuring the global search debounce

The search is sent 500 milliseconds after the user stops typing. Change the delay with `globalSearchDebounce()`:

```ts
panel.globalSearchDebounce('750ms');
```

## Configuring the global search field suffix

The field can display a suffix. To show the first key binding, written for the user's platform, use `globalSearchFieldKeyBindingSuffix()`:

```ts
panel
    .globalSearchKeyBindings(['command+k', 'ctrl+k'])
    .globalSearchFieldKeyBindingSuffix();
```

With these bindings, the suffix reads "⌘+K" on a Mac and "META+K" on Windows and Linux, like in Filament. On another platform, no suffix is shown.

To display your own text instead, use `globalSearchFieldSuffix('Search')`.

## Authorization

Only the resources whose list the user may see (`viewAny`) are searched, and a result is left out when the user may neither view nor update the record. In a [multi-tenant panel](/panels/tenancy), results come from the current tenant only, and the scope of each adapter applies.

<Aside variant="warning">
Actions on global search results, requiring resources to opt in, and disabling search term splitting are not available yet. The search term is always split into words.
</Aside>
