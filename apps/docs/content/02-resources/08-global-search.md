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

If you wish to search a relationship's attributes, you may use dot notation. The search matches records whose related record matches, and the relationship is loaded with the results, for their [details](#adding-extra-details-to-global-search-results):

```ts
export class OrderResource extends Resource {
    static globallySearchableAttributes = ['number', 'customer.name'];
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
        Author: record.author?.name,
        Category: record.category?.name,
    };
}
```

The relationships of dot-notation [searchable attributes](#globally-searching-across-multiple-columns) are already loaded. To read another relationship, load it first: `getGlobalSearchResultDetails()` may be `async`, and `loadMissingRelationships()` loads the missing relationships of an Objection record, once per result:

```ts
import { loadMissingRelationships } from '@navette-js/support';

static async getGlobalSearchResultDetails(record: any): Promise<Record<string, unknown>> {
    await loadMissingRelationships(record, ['author.name', 'category.name']);
    return {
        Author: record.author?.name,
        Category: record.category?.name,
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

## Adding actions to global search results

Actions are buttons shown under each result. They open a URL, or dispatch a Livewire event; they are not mounted, so an action needing a modal belongs on the record's pages:

```ts
import { Action } from '@navette-js/actions';
import { Resource } from '@navette-js/panels';

export class PostResource extends Resource {
    static getGlobalSearchResultActions(record: Post): Action[] {
        return [
            Action.make('edit').link().url(this.getUrl('edit', String(record.id))),
        ];
    }
}
```

### Opening URLs from global search actions

You can open a URL, optionally in a new tab:

```ts
Action.make('view')
    .url(PostResource.getUrl('view', String(record.id)))
    .openUrlInNewTab()
```

### Dispatching Livewire events from global search actions

To run code when an action is clicked, dispatch an event, with parameters, to a listener of the page (`static listeners`) or of another component:

```ts
Action.make('quickView')
    .dispatch('quickView', [record.id])
```

The actions are only shown to users allowed to see the result. Hide one with `visible()` or `hidden()`, and check permissions again in the code handling the event: its parameters come from the browser.

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

With these bindings, the suffix reads "⌘+K" on a Mac and "META+K" on Windows and Linux. On another platform, no suffix is shown.

To display your own text instead, use `globalSearchFieldSuffix('Search')`.

`globalSearchFieldSuffix()` also accepts a function, which receives the browser's user agent on every request. `Platform.detect()` tells the platform from it (`Platform.Windows`, `Platform.Mac`, `Platform.Linux` or `Platform.Other`), to write the shortcut the way the user's keyboard shows it:

```ts
import { Platform } from '@navette-js/support';

panel.globalSearchFieldSuffix((userAgent) => {
    switch (Platform.detect(userAgent)) {
        case Platform.Windows:
        case Platform.Linux:
            return 'CTRL+K';
        case Platform.Mac:
            return '⌘K';
        default:
            return null;
    }
});
```

## Authorization

Only the resources whose list the user may see (`viewAny`) are searched, and a result is left out when the user may neither view nor update the record. In a [multi-tenant panel](/panels/tenancy), results come from the current tenant only, and the scope of each adapter applies.

## Excluding a resource from global search

Set the static `isGloballySearchable` property to `false` to leave a resource out of global search, even when it has a title attribute:

```ts
import { Resource } from '@navette-js/panels';

export class AuditLogResource extends Resource {
    static isGloballySearchable = false;
}
```

## Requiring resources to opt in to global search

Every resource with a record title is globally searchable by default. With `globalSearchResourceOptIn()`, the panel only searches the resources that declare `isGloballySearchable` themselves:

```ts
panel.globalSearchResourceOptIn()

export class PostResource extends Resource {
    static isGloballySearchable = true;
}
```

## Customizing the global search results

`getGlobalSearchResults()` returns the results of a resource for a search. Override it to search another way, a search engine for example. Each result has a title, a URL, details and actions:

```ts
import { Resource, type GlobalSearchResult, type User } from '@navette-js/panels';

export class PostResource extends Resource {
    static async getGlobalSearchResults(search: string, user: User | null): Promise<GlobalSearchResult[]> {
        const hits = await searchEngine.search('posts', search, { limit: 10 });
        return hits.map((hit) => ({
            title: hit.title,
            url: this.getUrl('edit', hit.id),
            details: { Author: hit.author },
            actions: [],
            record: hit,
        }));
    }
}
```

The results are shown as they are returned: check there that the user may open each record, as the default implementation does through `getGlobalSearchResultUrl()`.

## Disabling search term splitting

By default, the search term is split into words, and each word must appear in one of the searchable attributes. Set `shouldSplitGlobalSearchTerms` to `false` to match the term as a whole:

```ts
import { Resource } from '@navette-js/panels';

export class ProductResource extends Resource {
    static shouldSplitGlobalSearchTerms = false;
}
```

