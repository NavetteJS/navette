---
title: Grouping rows
---

## Introduction

You may allow users to group table rows together using a common attribute. This is useful for displaying lots of data in a more organized way.

Groups can be set up using the name of the attribute to group by (e.g. `'status'`), or a `Group` object which allows you to customize the behavior of that grouping (e.g. `Group.make('status').collapsible()`).

Rows are sorted by the group's column first, then by the table's sort, and a header row is displayed before the first row of each group.

## Grouping rows by default

You may want to always group posts by status. To do this, pass the group to the `defaultGroup()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .defaultGroup('status');
}
```

```preview
// records: [{"title": "Introducing Navette", "status": "published"}, {"title": "Building your first panel", "status": "draft"}, {"title": "Ten tips for faster tables", "status": "published"}, {"title": "Migrating from Filament", "status": "reviewing"}, {"title": "Writing custom columns", "status": "draft"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status'),
    ])
    .defaultGroup('status')
```

When the default group is not one of the [groups the user can choose from](#allowing-users-to-choose-between-groupings), it is always applied, and the user cannot change it.

### Setting the default grouping direction

By default, the groups are sorted in ascending order. You may pass `'desc'` as the second argument of `defaultGroup()`:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .defaultGroup('status', 'desc');
}
```

## Allowing users to choose between groupings

You may also allow users to pick between different groupings, by passing them in an array to the `groups()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            'status',
            'category',
        ]);
}
```

```preview
// records: [{"title": "Introducing Navette", "status": "published", "category": "News"}, {"title": "Building your first panel", "status": "draft", "category": "Tutorials"}, {"title": "Ten tips for faster tables", "status": "published", "category": "Tutorials"}, {"title": "Migrating from Filament", "status": "reviewing", "category": "Guides"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('status'),
        TextColumn.make('category'),
    ])
    .groups([
        'status',
        'category',
    ])
```

A grouping selector appears in the toolbar, where the user picks a grouping and its direction. Only the declared groups are accepted, whatever the browser sends.

You can use both `groups()` and `defaultGroup()` together to allow users to choose between different groupings, but have a default grouping set. The default group is then selected when the table opens, and the user can change or remove it:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            'status',
            'category',
        ])
        .defaultGroup('status');
}
```

## Grouping by a related attribute

A group reads its value from the record's attribute with the group's name. To group by an attribute of a related record, add it to the list query of the data adapter as a [computed column](/tables/columns/overview#displaying-data-from-relationships), then pass that column to `column()`:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Task>): Table<Task> {
    return table
        .groups([
            Group.make<Task>('project.name')
                .label('Project')
                .column('project_name'),
        ]);
}
```

The column is used to read the group's value from each record, to sort the rows, and to compute [group summaries](#summarising-groups).

## Setting a grouping label

By default, the label of the grouping will be generated based on the attribute. You may customize it with a `Group` object, using the `label()` method:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            Group.make('author.name')
                .label('Author name')
                .column('author_name'),
        ]);
}
```

## Setting a group title

By default, the title of a group will be the value of the attribute. You may customize it by returning a new title from the `getTitleUsing()` method of a `Group` object. The function receives the first record of the group:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Task>): Table<Task> {
    return table
        .groups([
            Group.make<Task>('status')
                .getTitleUsing((record) => TASK_STATUSES[record.status]?.label ?? record.status),
        ]);
}
```

```preview
// records: [{"title": "Prepare the release notes", "status": "todo"}, {"title": "Review the pull requests", "status": "in_progress"}, {"title": "Update the screenshots", "status": "todo"}, {"title": "Publish the changelog", "status": "done"}]
// In previews, `Group` is the schema layout component: take the table group class from a table.

const TASK_STATUSES = {
    todo: { label: 'To do' },
    in_progress: { label: 'In progress' },
    done: { label: 'Done' },
};

return new Table()
    .pluralModelLabel('tasks')
    .columns([
        TextColumn.make('title'),
    ])
    .defaultGroup(
        TableGroup.make('status')
            .getTitleUsing((record) => TASK_STATUSES[record.status]?.label ?? record.status),
    )
```

`getTitleFromRecordUsing()` is an alias, for code ported from Filament. The title is escaped.

### Disabling the title label prefix

By default, the title is prefixed with the label of the group. To disable this prefix, use the `titlePrefixedWithLabel(false)` method:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            Group.make('status')
                .titlePrefixedWithLabel(false),
        ]);
}
```

```preview
// records: [{"title": "Introducing Navette", "status": "published"}, {"title": "Building your first panel", "status": "draft"}, {"title": "Ten tips for faster tables", "status": "published"}]
// In previews, `Group` is the schema layout component: take the table group class from a table.

return new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
    ])
    .defaultGroup(
        TableGroup.make('status')
            .titlePrefixedWithLabel(false),
    )
```

## Setting a group description

You may also set a description for a group, which will be displayed underneath the group title. To do this, use the `getDescriptionUsing()` method on a `Group` object:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            Group.make<Post>('status')
                .getDescriptionUsing((record) => STATUS_DESCRIPTIONS[record.status] ?? null),
        ]);
}
```

```preview
// records: [{"title": "Introducing Navette", "status": "published"}, {"title": "Building your first panel", "status": "draft"}, {"title": "Ten tips for faster tables", "status": "published"}]
// In previews, `Group` is the schema layout component: take the table group class from a table.

const STATUS_DESCRIPTIONS = {
    draft: 'Posts that are still being written.',
    published: 'Posts visible on the blog.',
};

return new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
    ])
    .defaultGroup(
        TableGroup.make('status')
            .getDescriptionUsing((record) => STATUS_DESCRIPTIONS[record.status] ?? null),
    )
```

`getDescriptionFromRecordUsing()` is an alias.

## Date groups

When using a date-time column as a group, you may want to group by the date only, and ignore the time. To do this, use the `date()` method on a `Group` object:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            Group.make('created_at')
                .date(),
        ]);
}
```

```preview
// records: [{"title": "Introducing Navette", "created_at": "2026-11-09 08:15:00"}, {"title": "Building your first panel", "created_at": "2026-11-09 16:40:00"}, {"title": "Ten tips for faster tables", "created_at": "2026-11-10 11:05:00"}]
// In previews, `Group` is the schema layout component: take the table group class from a table.

return new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
        TextColumn.make('created_at').dateTime(),
    ])
    .defaultGroup(
        TableGroup.make('created_at')
            .date(),
    )
```

The group's title is then the formatted date, such as `Nov 9, 2026`.

## Collapsible groups

You can allow rows inside a group to be collapsed underneath their group title. To enable this, use a `Group` object with the `collapsible()` method:

```ts
import { Group, type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            Group.make('author.name')
                .column('author_name')
                .collapsible(),
        ]);
}
```

```preview
// records: [{"title": "Introducing Navette", "author_name": "Ada Lovelace"}, {"title": "Building your first panel", "author_name": "Grace Hopper"}, {"title": "Ten tips for faster tables", "author_name": "Ada Lovelace"}]
// In previews, `Group` is the schema layout component: take the table group class from a table.

return new Table()
    .pluralModelLabel('posts')
    .columns([
        TextColumn.make('title'),
    ])
    .defaultGroup(
        TableGroup.make('author.name')
            .column('author_name')
            .collapsible(),
    )
```

### Collapsing groups by default

You may choose to collapse groups by default, using the `collapsedGroupsByDefault()` method on the table:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .collapsedGroupsByDefault();
}
```

## Summarising groups

You can use [summaries](/tables/summaries) with groups to display a summary of the records inside a group. This works automatically if you choose to add a summarizer column to your grouped table. Each group's summary covers all the records of the group, even when they span several pages.

### Hiding the grouped rows and showing the summary only

You may hide the rows inside groups and just show the summary of each group using the `groupsOnly()` method. This is beneficial in many reporting scenarios. See [hiding the grouped rows](/tables/summaries#hiding-the-grouped-rows-and-showing-the-summary-only).

## Using the grouping settings dropdown on desktop

By default, the grouping settings dropdown will only be shown on mobile devices. On desktop devices, the grouping settings are in the header of the table. You can enable the dropdown on desktop devices too, using the `groupingSettingsInDropdownOnDesktop()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            // ...
        ])
        .groupingSettingsInDropdownOnDesktop();
}
```

## Hiding the grouping settings

You can hide the grouping settings using the `groupingSettingsHidden()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .defaultGroup('status')
        .groupingSettingsHidden();
}
```

### Hiding the grouping direction setting only

You can hide the grouping direction select interface using the `groupingDirectionSettingHidden()` method:

```ts
import { type Table } from '@navette-js/tables';

static table(table: Table<Post>): Table<Post> {
    return table
        .groups([
            // ...
        ])
        .groupingDirectionSettingHidden();
}
```

<Aside variant="warning">
Custom group keys (`getKeyFromRecordUsing()`), customizing how a group orders, scopes or groups the query, customizing the groups dropdown trigger action and persisting the grouping in the session are not available yet. Grouping is turned off while the user [reorders records](/tables/overview#reordering-records).
</Aside>
