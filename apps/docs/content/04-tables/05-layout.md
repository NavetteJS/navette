---
title: Layout
---

## Introduction

Traditional tables are notorious for having bad responsiveness. On mobile, there is only so much flexibility you have when rendering content that is horizontally long. Navette tables scroll horizontally when they overflow, but **on mobile, the user is unable to see much information in a table row at once without scrolling**.

Navette offers two solutions to this problem:

1. **Simple stacking** - Use `stackedOnMobile()` to stack all cells vertically on mobile without changing your column definitions.
2. **Custom layouts** - Use `Split` and `Stack` to control how content appears at each breakpoint.

## Stacking table cells on mobile

The simplest way to make your table responsive is to use the `stackedOnMobile()` method on the table. It converts the traditional horizontal table layout into a vertical card-like layout on mobile screens, while preserving the standard table appearance on larger screens:

```ts
import { TextColumn, type Table } from '@navette-js/tables';

static table(table: Table<Customer>): Table<Customer> {
    return table
        .columns([
            TextColumn.make<Customer>('name').searchable().sortable(),
            TextColumn.make<Customer>('email'),
            TextColumn.make<Customer>('phone'),
            TextColumn.make<Customer>('country'),
        ])
        .stackedOnMobile();
}
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0958", "country": "United Kingdom"}, {"name": "Grace Hopper", "email": "grace@example.com", "phone": "+1 202 555 0143", "country": "United States"}, {"name": "Konrad Zuse", "email": "konrad@example.com", "phone": "+49 30 901820", "country": "Germany"}]
// viewport: 375
new Table()
    .pluralModelLabel('customers')
    .columns([
        TextColumn.make('name').searchable().sortable(),
        TextColumn.make('email'),
        TextColumn.make('phone'),
        TextColumn.make('country'),
    ])
    .stackedOnMobile()
```

On mobile, each row displays as a card with the column label above its value.

## Custom column layouts

`Split` and `Stack` let you define exactly where content appears in a table row, at each responsive breakpoint, without writing HTML or CSS.

As soon as a table contains a layout component, its records are displayed as cards instead of table rows: there is no header row, and sortable columns are offered in a "Sort by" select in the toolbar. Searching, filters, actions, the column manager and selection keep working.

### Allowing columns to stack on mobile

A `Split` component is used to wrap around columns, and allow them to stack on mobile:

```ts
import { ImageColumn, Split, TextColumn } from '@navette-js/tables';

Split.make([
    ImageColumn.make('avatar_url')
        .alt((record) => record.name)
        .circular(),
    TextColumn.make('name')
        .weight('bold')
        .searchable()
        .sortable(),
    TextColumn.make('email'),
])
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "avatar_url": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}, {"name": "Grace Hopper", "email": "grace@example.com", "avatar_url": "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a"}, {"name": "Alan Turing", "email": "alan@example.com", "avatar_url": "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        Split.make([
            ImageColumn.make('avatar_url')
                .alt((record) => record.name)
                .circular(),
            TextColumn.make('name')
                .weight('bold')
                .searchable()
                .sortable(),
            TextColumn.make('email'),
        ]),
    ])
```

By default, columns within a split will appear aside each other all the time. However, you may choose a responsive breakpoint (`sm`, `md`, `lg`, `xl` or `2xl`) where this behavior starts with `from()`. Before this point, the columns will stack on top of each other:

```ts
import { ImageColumn, Split, TextColumn } from '@navette-js/tables';

Split.make([
    ImageColumn.make('avatar_url')
        .alt((record) => record.name)
        .circular(),
    TextColumn.make('name')
        .weight('bold')
        .searchable()
        .sortable(),
    TextColumn.make('email'),
]).from('md')
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "avatar_url": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}, {"name": "Grace Hopper", "email": "grace@example.com", "avatar_url": "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a"}, {"name": "Alan Turing", "email": "alan@example.com", "avatar_url": "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"}]
// viewport: 375
new Table()
    .pluralModelLabel('users')
    .columns([
        Split.make([
            ImageColumn.make('avatar_url')
                .alt((record) => record.name)
                .circular(),
            TextColumn.make('name')
                .weight('bold')
                .searchable()
                .sortable(),
            TextColumn.make('email'),
        ]).from('md'),
    ])
```

In this example, the columns will only appear horizontally aside each other from `md` breakpoint devices onwards.

### Stacking within a split

Inside a split, you may stack multiple columns on top of each other vertically. This allows you to display more data inside fewer columns on desktop:

```ts
import { Split, Stack, TextColumn, type Table } from '@navette-js/tables';

static table(table: Table<Author>): Table<Author> {
    return table
        .columns([
            Split.make<Author>([
                Stack.make<Author>([
                    TextColumn.make<Author>('name').searchable().sortable().weight('medium'),
                    TextColumn.make<Author>('email').label('Email address').searchable().sortable().color('gray'),
                ]).space(),
                Stack.make<Author>([
                    TextColumn.make<Author>('github_handle').icon(() => 'm-code-bracket').label('GitHub handle'),
                    TextColumn.make<Author>('twitter_handle').icon(() => 'm-at-symbol'),
                ]).space(2),
            ]).from('md'),
        ]);
}
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "github_handle": "ada-lovelace", "twitter_handle": "@ada"}, {"name": "Grace Hopper", "email": "grace@example.com", "github_handle": "ghopper", "twitter_handle": "@gracehopper"}, {"name": "Alan Turing", "email": "alan@example.com", "github_handle": "aturing", "twitter_handle": "@alanturing"}]
// viewport: 1100
new Table()
    .pluralModelLabel('authors')
    .columns([
        Split.make([
            Stack.make([
                TextColumn.make('name').searchable().sortable().weight('medium'),
                TextColumn.make('email').label('Email address').searchable().sortable().color('gray'),
            ]).space(),
            Stack.make([
                TextColumn.make('github_handle').icon(() => 'm-code-bracket').label('GitHub handle'),
                TextColumn.make('twitter_handle').icon(() => 'm-at-symbol'),
            ]).space(2),
        ]).from('md'),
    ])
```

Columns keep their label for sorting and for the column manager, even though the label is not displayed in a card.

#### Aligning stacked content

By default, columns within a stack are aligned to the start. You may choose to align columns within a stack to the `center` or `end`:

```ts
import { Stack, TextColumn } from '@navette-js/tables';

Stack.make([
    TextColumn.make('phone').icon(() => 'm-phone'),
    TextColumn.make('email').icon(() => 'm-envelope'),
]).alignment('end')
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0958"}, {"name": "Grace Hopper", "email": "grace@example.com", "phone": "+1 202 555 0143"}, {"name": "Konrad Zuse", "email": "konrad@example.com", "phone": "+49 30 901820"}]
// viewport: 1100
new Table()
    .pluralModelLabel('customers')
    .columns([
        Split.make([
            TextColumn.make('name').weight('bold'),
            Stack.make([
                TextColumn.make('phone').icon(() => 'm-phone'),
                TextColumn.make('email').icon(() => 'm-envelope'),
            ]).alignment('end'),
        ]),
    ])
```

#### Spacing stacked content

By default, stacked content has no vertical padding between columns. To add some, you may use the `space()` method, which accepts either `1`, `2`, or `3`, for a small, medium or large gap. Without an argument, `space()` uses `1`:

```ts
import { Stack, TextColumn } from '@navette-js/tables';

Stack.make([
    TextColumn.make('phone').icon(() => 'm-phone'),
    TextColumn.make('email').icon(() => 'm-envelope'),
]).space(1)
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0958"}, {"name": "Grace Hopper", "email": "grace@example.com", "phone": "+1 202 555 0143"}, {"name": "Konrad Zuse", "email": "konrad@example.com", "phone": "+49 30 901820"}]
// viewport: 1100
new Table()
    .pluralModelLabel('customers')
    .columns([
        Split.make([
            TextColumn.make('name').weight('bold'),
            Stack.make([
                TextColumn.make('phone').icon(() => 'm-phone'),
                TextColumn.make('email').icon(() => 'm-envelope'),
            ]).space(1),
        ]),
    ])
```

<Aside variant="warning">
`grow()`, `visibleFrom()` and `hiddenFrom()` on columns and stacks, grid layouts (`Grid`), collapsible content (`Panel`), arranging records into a grid (`contentGrid()`) and custom HTML layouts (`View`) are not available yet.
</Aside>

## Grouping column headers

In a traditional table layout, you may also group several columns under a common heading with a `ColumnGroup`. See [grouping columns](/tables/columns/overview#grouping-columns).
