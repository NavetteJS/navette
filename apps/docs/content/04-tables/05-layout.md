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

### Controlling column width using a split

Inside a split, columns and components share the available width. To make one take only the space it needs, such as an avatar, use `grow(false)`:

```ts
import { ImageColumn, Split, TextColumn } from '@navette-js/tables';

Split.make([
    ImageColumn.make('avatar_url').circular().grow(false),
    TextColumn.make('name').weight('bold'),
    TextColumn.make('email'),
])
```

### Hiding components responsively

Columns, stacks and splits accept `visibleFrom()` and `hiddenFrom()` with a breakpoint (`sm`, `md`, `lg`, `xl`, `2xl`):

```ts
import { Split, Stack, TextColumn } from '@navette-js/tables';

Split.make([
    TextColumn.make('name'),
    Stack.make([
        TextColumn.make('phone'),
        TextColumn.make('email'),
    ]).visibleFrom('md'),
])
```

### Collapsible content

You may put content behind a toggle button at the bottom of each record. Make a top-level `Panel` (or any layout component) `collapsible()`; it starts collapsed, and `collapsed(false)` shows it open:

```ts
import { Panel, Split, Stack, TextColumn } from '@navette-js/tables';

static table(table: Table<User>): Table<User> {
    return table
        .columns([
            Split.make([
                TextColumn.make('name'),
                TextColumn.make('email'),
            ]),
            Panel.make([
                Stack.make([
                    TextColumn.make('phone'),
                    TextColumn.make('address'),
                ]),
            ]).collapsible(),
        ]);
}
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0101", "avatar_url": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}, {"name": "Grace Hopper", "email": "grace@example.com", "phone": "+1 202 555 0143", "avatar_url": "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a"}, {"name": "Alan Turing", "email": "alan@example.com", "phone": "+44 161 496 0754", "avatar_url": "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        Split.make([
            ImageColumn.make('avatar_url').circular().grow(false),
            TextColumn.make('name').weight('bold'),
        ]),
        Stack.make([
            TextColumn.make('phone'),
            TextColumn.make('email'),
        ]).collapsible(),
    ])
```

Only one top-level component can be collapsible.

### Arranging records into a grid

With a column layout, records are cards. `contentGrid()` arranges them in a grid, with a number of columns per breakpoint:

```ts
import { Stack, TextColumn } from '@navette-js/tables';

static table(table: Table<User>): Table<User> {
    return table
        .columns([
            Stack.make([
                TextColumn.make('name'),
                TextColumn.make('email'),
            ]),
        ])
        .contentGrid({ md: 2, xl: 3 });
}
```

```preview
// records: [{"name": "Ada Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0101", "avatar_url": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}, {"name": "Grace Hopper", "email": "grace@example.com", "phone": "+1 202 555 0143", "avatar_url": "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a"}, {"name": "Alan Turing", "email": "alan@example.com", "phone": "+44 161 496 0754", "avatar_url": "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        Stack.make([
            TextColumn.make('name').weight('bold'),
            TextColumn.make('email'),
            TextColumn.make('phone'),
        ]),
    ])
    .contentGrid({ md: 2, xl: 3 })
```

### Grid layouts

`Grid` arranges columns in a grid inside a record: `Grid.make(2)` has 2 columns from the `lg` breakpoint, and `Grid.make({ default: 1, md: 2 })` sets them per breakpoint. A component spans several grid columns with `columnSpan()` or `columnSpanFull()`:

```ts
import { Grid, Stack, TextColumn } from '@navette-js/tables';

Grid.make({ default: 1, md: 2 })
    .schema([
        TextColumn.make('phone'),
        TextColumn.make('email'),
        Stack.make([TextColumn.make('address')]).columnSpanFull(),
    ])
```

### Rendering your own HTML

`View` renders your own markup in the record: a function returning HTML, or the name of an EJS view (see [custom columns](/tables/columns/custom-columns)) rendered with `record` and `recordKey`:

```ts
import { e } from '@navette-js/support';
import { Split, TextColumn, View } from '@navette-js/tables';

Split.make([
    TextColumn.make('name'),
    View.make<User>(({ record }) => `<span class="my-badge">${e(record.role)}</span>`),
])
```

<Aside variant="danger">
The HTML of a `View` is inserted as it is. Escape record data with `e()` from `@navette-js/support`, or with `<%= %>` in an EJS view.
</Aside>

An EJS view receives more data with `viewData()`, and can render columns inside it with `components()`. The columns given to `components()` are columns of the table like the others (they can be sortable, searchable or toggleable); they are rendered first, and their HTML reaches the view as `children`. The view also receives `getRecord()`:

```ts
import { TextColumn, View } from '@navette-js/tables';

View.make<User>('app::tables.user-card')
    .viewData({ showEmail: true })
    .components([
        TextColumn.make('name').weight('bold'),
        TextColumn.make('email'),
    ])
```

```ejs
<%# views/tables/user-card.ejs %>
<div class="user-card">
    <%- children %>
    <% if (showEmail) { %><a href="mailto:<%= record.email %>"><%= record.email %></a><% } %>
</div>
```

## Grouping column headers

In a traditional table layout, you may also group several columns under a common heading with a `ColumnGroup`. See [grouping columns](/tables/columns/overview#grouping-columns).
