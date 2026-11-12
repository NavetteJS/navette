---
title: Empty state
---

## Introduction

The table's "empty state" is rendered when there are no rows in the table: an icon and the heading "No" followed by the plural label of the records, such as "No posts". It is announced to screen readers as a status message. While the table is loading new rows, the icon is replaced by a loading indicator.

## Setting the empty state heading

The heading uses the plural label of the table's records. In a resource, it is the resource's plural model label, which you may set with `static pluralModelLabel`:

```ts
import { Resource } from '@navette-js/panels';

export class PostResource extends Resource {
    static modelLabel = 'post';
    static pluralModelLabel = 'blog posts';

    // ...
}
```

```preview
new Table()
    .pluralModelLabel('blog posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status'),
    ])
```

The heading is then "No blog posts". You may also set the label on the table itself, with `pluralModelLabel()`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .pluralModelLabel('drafts');
}
```

```preview
new Table()
    .pluralModelLabel('drafts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status'),
    ])
```

The plural label is also used by the [summary](/tables/summaries) headings ("All drafts") and as the accessible name of the table when it has no heading.

<Aside variant="warning">
Custom empty state headings, descriptions, icons and actions (`emptyStateHeading()`, `emptyStateDescription()`, `emptyStateIcon()`, `emptyStateActions()`) and custom empty state views are not available yet.
</Aside>
