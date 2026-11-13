---
title: Sections
---

## Introduction

You may want to separate your fields into sections, each with a heading and description. To do this, you can use a section component:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .schema([
        // ...
    ])
```

```preview
// state: {"hits": 60, "period": 1}
Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
```

As well as allowing static values, the `make()`, `heading()` and `description()` methods also accept functions, which receive the [context object](/schemas/overview#component-utility-injection):

```ts
import { Section } from '@navette-js/schemas';

Section.make(({ operation }) => (operation === 'create' ? 'New limits' : 'Rate limiting'))
    .description(({ record }) => (record === null ? null : 'Changes apply to new requests only'))
```

You can also use a section without a header, which just wraps the components in a simple card:

```ts
import { Section } from '@navette-js/schemas';

Section.make()
    .schema([
        // ...
    ])
```

```preview
// state: {"hits": 60, "period": 1}
Section.make()
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
```

The heading and description are escaped when they are rendered. A section with a heading receives a key derived from it (`rate-limiting` in the first example), which is also used as the `id` of its HTML element. If two sections of the same schema share a heading, give one of them its own `key()`. When the heading is an async function, the section only gets a key if you set one with `key()`.

The heading is an `<h2>` at the root of a schema; the heading of a section nested in another section with a heading is an `<h3>`, and so on. You can change the starting level with the schema's [`rootHeadingLevel()`](/schemas/overview#setting-the-root-heading-level).

## Adding an icon to the section's header

You may add an icon to the section's header using the `icon()` method. Icons are [Heroicons](/schemas/primes#icon-component) names:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .description('The items you have selected for purchase')
    .icon('o-shopping-bag')
    .schema([
        // ...
    ])
```

```preview
// state: {"product": "Mechanical keyboard", "quantity": 2}
Section.make('Cart')
    .description('The items you have selected for purchase')
    .icon('o-shopping-bag')
    .schema([
        TextInput.make('product'),
        TextInput.make('quantity').numeric(),
    ])
```

The icon is gray by default. You may change its color with `iconColor()`, and its size (`lg` by default) with `iconSize()`:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .icon('o-shopping-bag')
    .iconColor('primary')
    .iconSize('md')
```

As well as allowing static values, the `icon()` and `iconColor()` methods also accept functions, which receive the context object.

## Positioning the heading and description aside

You may use the `aside()` method to align the heading and description on the left, and the components inside a card on the right:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .aside()
    .schema([
        // ...
    ])
```

```preview
// state: {"hits": 60, "period": 1}
// viewport: 1100
Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .aside()
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
```

Optionally, you may pass a boolean value to control if the section should be aside or not:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .aside(settings.compactForms)
    .schema([
        // ...
    ])
```

As well as allowing a static value, the `aside()` method also accepts a function, which receives the context object. An aside section cannot be [collapsed](#collapsing-sections).

### Positioning the content before the heading

Use `contentBefore()` with `aside()` to position the content before the heading and description on medium and larger screens:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .aside()
    .contentBefore()
    .schema([
        // ...
    ])
```

You may pass a boolean or a function to `contentBefore()` to control this condition.

## Collapsing sections

Sections may be `collapsible()` to optionally hide long content:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .description('The items you have selected for purchase')
    .schema([
        // ...
    ])
    .collapsible()
```

Your sections may be `collapsed()` by default. A collapsed section is also collapsible:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .description('The items you have selected for purchase')
    .schema([
        // ...
    ])
    .collapsed()
```

```preview
// state: {"product": "Mechanical keyboard", "quantity": 2}
[
    Section.make('Cart')
        .description('The items you have selected for purchase')
        .schema([
            TextInput.make('product'),
            TextInput.make('quantity').numeric(),
        ])
        .collapsed(),
    Section.make('Shipping')
        .schema([
            TextInput.make('address'),
        ])
        .collapsible(),
]
```

Optionally, the `collapsible()` and `collapsed()` methods accept a boolean value, or a function receiving the context object, to control if the section should be collapsible and collapsed or not:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .schema([
        // ...
    ])
    .collapsible(user.isAdmin)
    .collapsed(user.isAdmin)
```

The section is collapsed and expanded in the browser, by clicking its header. Its components are always rendered: a collapsed section only hides them, and the fields inside it are still validated and saved.

A section without a heading can also be collapsible: its header then only holds the collapse button.

### Persisting collapsed sections in the user's browser

You can persist whether a section is collapsed in the browser's local storage using the `persistCollapsed()` method, so it will remain collapsed when the user refreshes the page:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .description('The items you have selected for purchase')
    .schema([
        // ...
    ])
    .collapsible()
    .persistCollapsed()
```

To persist the collapse state, the local storage needs a unique ID to store the state. This ID is the key of the section, which is generated based on its heading. If your section does not have a heading, or if you have multiple sections with the same heading that you do not want to collapse together, you can manually specify the `key()` of that section to prevent an ID conflict:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .description('The items you have selected for purchase')
    .schema([
        // ...
    ])
    .collapsible()
    .persistCollapsed()
    .key('order-cart')
```

Optionally, the `persistCollapsed()` method accepts a boolean value, or a function receiving the context object, to control if the section should persist its collapsed state or not.

The stored state only changes what the browser shows: it is never sent to the server.

## Compact section styling

When nesting sections, you can use a more compact styling:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .schema([
        // ...
    ])
    .compact()
```

```preview
// state: {"hits": 60, "period": 1}
Section.make('Rate limiting')
    .description('Prevent abuse by limiting the number of requests per period')
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
    .compact()
```

Optionally, the `compact()` method accepts a boolean value, or a function receiving the context object, to control if the section should be compact or not.

## Secondary section styling

By default, sections have a contrasting background color, which makes them stand out against a gray background. Secondary styling gives the section a less contrasting background, so it is usually slightly darker. This is a better styling when the background color behind the section is the same color as the default section background color, for example when a section is nested inside another section. Secondary sections can be created using the `secondary()` method:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Notes')
    .schema([
        // ...
    ])
    .secondary()
    .compact()
```

```preview
// state: {"notes": "Deliver after 6pm."}
Section.make('Order')
    .schema([
        Section.make('Notes')
            .schema([
                Textarea.make('notes'),
            ])
            .secondary()
            .compact(),
    ])
```

Optionally, the `secondary()` method accepts a boolean value, or a function receiving the context object, to control if the section should be secondary or not.

## Removing the styled container

By default, a section is a card. You may remove the card with `contained(false)`, keeping the header and the content:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .contained(false)
    .schema([
        // ...
    ])
```

## Inserting actions and other components in the header of a section

You may insert [actions](/actions/overview) and any other schema component (usually [prime components](/schemas/primes)) into the header of a section, after its heading, by passing an array of components to the `afterHeader()` method:

```ts
import { Action } from '@navette-js/actions';
import { Section, Text } from '@navette-js/schemas';

Section.make('Rate limiting')
    .afterHeader([
        Text.make('Beta').badge().color('warning'),
        Action.make('reset')
            .label('Reset limits')
            .requiresConfirmation()
            .action(async ({ record }) => {
                // ...
            }),
    ])
    .schema([
        // ...
    ])
```

```preview
// state: {"hits": 60, "period": 1}
Section.make('Rate limiting')
    .afterHeader([
        Text.make('Beta').badge().color('warning'),
        Action.make('reset')
            .label('Reset limits')
            .requiresConfirmation(),
    ])
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
```

If you only need actions, you may also pass them to `headerActions()`. `afterHeader()` replaces the header actions.

## Inserting actions and other components in the footer of a section

You may insert actions and any other schema component into the footer of a section by passing an array of components to the `footer()` method:

```ts
import { Action } from '@navette-js/actions';
import { Section, Text } from '@navette-js/schemas';

Section.make('Rate limiting')
    .schema([
        // ...
    ])
    .footer([
        Text.make('Changes apply to new requests only.').color('gray'),
        Action.make('test')
            .label('Send a test request')
            .action(async () => {
                // ...
            }),
    ])
```

```preview
// state: {"hits": 60, "period": 1}
Section.make('Rate limiting')
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
    .footer([
        Text.make('Changes apply to new requests only.'),
        Action.make('test').label('Send a test request'),
    ])
```

If you only need actions, you may pass them to `footerActions()` instead, and align them with `footerActionsAlignment()` (`start` by default, `center`, `end` or `between`):

```ts
import { Action } from '@navette-js/actions';
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .schema([
        // ...
    ])
    .footerActions([
        Action.make('test'),
    ])
    .footerActionsAlignment('end')
```

`footer()` replaces the footer actions. The footer is rendered inside the content of the section, so it is hidden when the section is collapsed.

## Using grid columns within a section

You may use the `columns()` method to easily create a [grid](/schemas/layouts#grid-system) within the section:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Heading')
    .schema([
        // ...
    ])
    .columns(2)
```

```preview
// state: {"first_name": "Ada", "last_name": "Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0958"}
// viewport: 1100
Section.make('Heading')
    .schema([
        TextInput.make('first_name'),
        TextInput.make('last_name'),
        TextInput.make('email'),
        TextInput.make('phone'),
    ])
    .columns(2)
```

For example, the details of an expense may be displayed in three columns, with longer text spanning the full width:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Section } from '@navette-js/schemas';

Section.make('Expense Details')
    .columns(3)
    .columnSpanFull()
    .schema([
        TextEntry.make('expense_number').copyable(),
        TextEntry.make('employee.name').label('Employee'),
        TextEntry.make('total_amount').money('usd'),
        TextEntry.make('description').columnSpanFull(),
    ])
```

```preview
// record: {"expense_number": "EXP-2026-0042", "employee": {"name": "Ada Lovelace"}, "total_amount": 1249.5, "description": "Flights and hotel for the Node.js conference in Amsterdam, including two nights of accommodation."}
// viewport: 1100
Section.make('Expense Details')
    .columns(3)
    .columnSpanFull()
    .schema([
        TextEntry.make('expense_number').copyable(),
        TextEntry.make('employee.name').label('Employee'),
        TextEntry.make('total_amount').money('usd'),
        TextEntry.make('description').columnSpanFull(),
    ])
```

## Lazy loading the content of a section

If a section contains components that are expensive to render, `lazyLoaded()` renders a loading indicator first, and the content when the section enters the viewport. A collapsed section loads its content when it is expanded:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Statistics')
    .schema([
        // …
    ])
    .collapsed()
    .lazyLoaded()
```

See [lazy loading a child schema](/schemas/overview#lazy-loading-a-child-schema).
