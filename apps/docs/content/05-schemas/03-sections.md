---
title: Sections
---

## Introduction

You may want to separate your fields into sections, each with a heading. To do this, you can use a section component:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .schema([
        // ...
    ])
```

```preview
// state: {"hits": 60, "period": 1}
Section.make('Rate limiting')
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
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

The heading is escaped when it is rendered. A section with a heading receives a key derived from it (`rate-limiting` in the first example), which is also used as the `id` of its HTML element. If two sections of the same schema share a heading, give one of them its own `key()`.

<Aside variant="warning">
Section descriptions (`description()`), header icons (`icon()`), `aside()`, `compact()`, `secondary()` and footer components (`footer()`) are not available in Navette yet. The heading may only be set in `make()`.
</Aside>

## Collapsing sections

Sections may be `collapsible()` to optionally hide long content:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .schema([
        // ...
    ])
    .collapsible()
```

Your sections may be `collapsed()` by default. A collapsed section is also collapsible:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Cart')
    .schema([
        // ...
    ])
    .collapsed()
```

```preview
// state: {"product": "Mechanical keyboard", "quantity": 2}
[
    Section.make('Cart')
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

Optionally, the `collapsible()` and `collapsed()` methods accept a boolean value to control if the section should be collapsible and collapsed or not:

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

Only sections with a heading can be collapsed, since the header holds the collapse button.

<Aside variant="warning">
Persisting the collapsed state of a section in the browser's storage (`persistCollapsed()`) is not available in Navette yet.
</Aside>

## Inserting actions in the header of a section

You may insert [actions](/actions/overview) into the header of a section, after its heading, by passing an array of actions to the `afterHeader()` method:

```ts
import { Action } from '@navette-js/actions';
import { Section } from '@navette-js/schemas';

Section.make('Rate limiting')
    .afterHeader([
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
        Action.make('reset')
            .label('Reset limits')
            .requiresConfirmation(),
    ])
    .schema([
        TextInput.make('hits').numeric(),
        TextInput.make('period').numeric().suffix('minutes'),
    ])
```

The section must have a heading for its header to be rendered.

<Aside variant="warning">
`afterHeader()` only accepts actions in Navette: other schema components, such as prime components, cannot be inserted in the header yet.
</Aside>

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
