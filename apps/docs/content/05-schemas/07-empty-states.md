---
title: Empty states
---

## Introduction

You can display an empty state in your schema to communicate that there is no content to show yet, and to guide the user towards the next action. An empty state requires a heading, but can also have a `description()`, [`icon()`](#adding-an-icon-to-the-empty-state) and [`footer()`](#inserting-actions-and-other-components-in-the-footer-of-an-empty-state):

```ts
import { Action } from '@navette-js/actions';
import { EmptyState } from '@navette-js/schemas';

EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .icon('o-user')
    .footer([
        Action.make('createUser')
            .label('Create user')
            .icon('m-plus')
            .url('/admin/users/create'),
    ])
```

```preview
EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .icon('o-user')
    .footer([
        Action.make('createUser')
            .label('Create user')
            .icon('m-plus')
            .url('/admin/users/create'),
    ])
```

As well as allowing static values, the `make()`, `heading()` and `description()` methods also accept functions, which receive the [context object](/schemas/overview#component-utility-injection). The heading and description are escaped when they are rendered.

## Adding an icon to the empty state

You may add an icon to the empty state using the `icon()` method. Icons are [Heroicons](/schemas/primes#icon-component) names:

```ts
import { EmptyState } from '@navette-js/schemas';

EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .icon('o-user')
```

The icon uses the `primary` color by default. You may change it with `iconColor()`, and its size (`lg` by default) with `iconSize()`:

```ts
import { EmptyState } from '@navette-js/schemas';

EmptyState.make('No invoices')
    .icon('o-document-text')
    .iconColor('gray')
    .iconSize('md')
```

```preview
EmptyState.make('No invoices')
    .icon('o-document-text')
    .iconColor('gray')
    .iconSize('md')
```

## Inserting actions and other components in the footer of an empty state

You may insert [actions](/actions/overview) and any other schema component (usually [prime components](/schemas/primes)) into the footer of an empty state by passing an array of components to the `footer()` method:

```ts
import { Action } from '@navette-js/actions';
import { EmptyState, Text } from '@navette-js/schemas';

EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .footer([
        Action.make('createUser')
            .label('Create user')
            .icon('m-plus')
            .action(async ({ livewire }) => {
                // ...
            }),
        Text.make('or import them from a file'),
    ])
```

```preview
EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .footer([
        Action.make('createUser')
            .label('Create user')
            .icon('m-plus')
            .action(async () => {}),
        Text.make('or import them from a file'),
    ])
```

## Removing the empty state container

By default, empty states have a background color, shadow and border. You may remove these styles and just render the content of the empty state without the container using `contained(false)`:

```ts
import { EmptyState } from '@navette-js/schemas';

EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .contained(false)
```

```preview
EmptyState.make('No users yet')
    .description('Get started by creating a new user.')
    .icon('o-user')
    .contained(false)
```

## Using a compact empty state

You may reduce the padding and the size of the empty state with `compact()`:

```ts
import { EmptyState } from '@navette-js/schemas';

EmptyState.make('No comments')
    .compact()
```

```preview
EmptyState.make('No comments')
    .icon('o-chat-bubble-left-right')
    .compact()
```

## Changing the heading level

The heading of an empty state follows the heading level of the schema: it is an `<h2>` element at the root of a schema, and an `<h3>` inside a section with a heading (see [setting the root heading level](/schemas/overview#setting-the-root-heading-level)). You may set the tag yourself using `headingTag()`:

```ts
import { EmptyState } from '@navette-js/schemas';

EmptyState.make('No comments')
    .headingTag('h3')
```
