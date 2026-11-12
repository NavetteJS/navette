---
title: Layouts
---

## Introduction

Navette's grid system allows you to create responsive, multi-column layouts using layout components. Navette provides a set of built-in layout components to help you build these:

- [Grid](#grid-component)
- [Group](#group-component)
- [Flex](#flex-component)
- [Fieldset](#fieldset-component)
- [Fused group](#fused-group-component)
- [Section](/schemas/sections)
- [Tabs](/schemas/tabs)
- [Wizard](/schemas/wizards)
- [Callout](/schemas/callouts)
- [Empty state](/schemas/empty-states)

You may also [create your own custom layout components](/schemas/custom-components#custom-component-classes) to display components however you wish.

## Grid system

Layout components that contain a grid, as well as the `Schema` object itself, have a `columns()` method that you can use in a couple of different ways:

- You can pass a number like `columns(2)`. This number is the number of columns used on the `lg` breakpoint and higher. All smaller devices will have just 1 column.
- You can pass an object, where the key is the breakpoint and the value is the number of columns. For example, `columns({ md: 2, xl: 4 })` will create a 2 column layout on medium devices, and a 4 column layout on extra large devices. The default breakpoint for smaller devices uses 1 column, unless you use a `default` key.

Breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) are the same as Tailwind's, and can be found in the [Tailwind documentation](https://tailwindcss.com/docs/responsive-design#overview).

The `columns()` method is available on `Schema`, `Grid`, `Group`, `Section`, `Fieldset`, `FusedGroup`, `Tab`, `Step` and `UnorderedList`. It only accepts static values.

### Grid column spans

In addition to specifying how many columns a layout component should have, you may also specify how many columns a component should fill within the parent grid, using the `columnSpan()` method. This method accepts a number, a string, or an object of breakpoints and column spans:

- You can pass a number like `columnSpan(2)`. This number is the number of columns that are consumed on the `lg` breakpoint and higher. All smaller devices span just 1 column.
- `columnSpan({ md: 2, xl: 4 })` will make the component fill up to 2 columns on medium devices, and up to 4 columns on extra large devices. Passing an object replaces the default span entirely, so the component spans 1 column on smaller devices unless you add a `default` key.
- `columnSpan('full')` will make the component fill the full width of the parent grid on the `lg` breakpoint and higher, regardless of how many columns there are. All smaller devices span just 1 column.
- `columnSpanFull()` will make the component fill the full width of the parent grid on all devices, regardless of how many columns it has.

The values of a `columnSpan()` object may be functions, which receive the [context object](/schemas/overview#component-utility-injection). For example, a section may take more space on the create page, where a second section is hidden:

```ts
import { Section, type Schema } from '@navette-js/schemas';

schema
    .components([
        Section.make()
            .schema([
                // ...
            ])
            .columnSpan({ lg: ({ record }) => (record === null ? 3 : 2) }),
        Section.make()
            .schema([
                // ...
            ])
            .columnSpan({ lg: 1 })
            .hidden(({ record }) => record === null),
    ])
    .columns(3)
```

```preview
// state: {"title": "Lorem ipsum", "slug": "lorem-ipsum", "status": "published", "author": "Ada Lovelace"}
// viewport: 1100
Grid.make(3).schema([
    Section.make('Content')
        .schema([
            TextInput.make('title'),
            TextInput.make('slug'),
        ])
        .columnSpan({ lg: 2 }),
    Section.make('Meta')
        .schema([
            TextInput.make('status'),
            TextInput.make('author'),
        ])
        .columnSpan({ lg: 1 }),
])
```

### Grid column starts

If you want to start a component in a grid at a specific column, you can use the `columnStart()` method. It accepts a number, which is the column that the component will start on for the `lg` breakpoint and higher. All smaller devices start the component on the first column:

```ts
import { Toggle } from '@navette-js/forms';

Toggle.make('is_active').columnStart(1)
```

```preview
// state: {"name": "Ada Lovelace", "email": "ada@example.com", "is_active": true}
// viewport: 1100
Grid.make(3).schema([
    TextInput.make('name'),
    TextInput.make('email'),
    Toggle.make('is_active').columnStart(1),
])
```

In this example, the toggle always starts a new row of the grid on large devices, even when the previous row has free space.

<Aside variant="warning">
`columnStart()` does not accept an object of breakpoints yet, and `columnOrder()` is not available in Navette yet.
</Aside>

### An example of a responsive grid layout

In this example, we have a schema with a [section](/schemas/sections) layout component. Since sections support the `columns()` method, we can use it to create a responsive grid layout within the section itself.

We pass an object to `columns()` as we want to specify different numbers of columns for different breakpoints. On devices smaller than the `sm` breakpoint, we want to have 1 column, which is default. On devices larger than the `sm` breakpoint, we want to have 3 columns. On devices larger than the `xl` breakpoint, we want to have 6 columns. On devices larger than the `2xl` breakpoint, we want to have 8 columns.

Inside the section, we have a [text input](/forms/text-input). Since all components have a `columnSpan()` method, we can use it to specify how many columns the text input should fill. On devices smaller than the `sm` breakpoint, we want the text input to fill 1 column, which is default. On devices larger than the `sm` breakpoint, we want the text input to fill 2 columns. On devices larger than the `xl` breakpoint, we want the text input to fill 3 columns. On devices larger than the `2xl` breakpoint, we want the text input to fill 4 columns.

```ts
import { TextInput } from '@navette-js/forms';
import { Section } from '@navette-js/schemas';

Section.make()
    .columns({
        sm: 3,
        xl: 6,
        '2xl': 8,
    })
    .schema([
        TextInput.make('name')
            .columnSpan({
                default: 1,
                sm: 2,
                xl: 3,
                '2xl': 4,
            }),
        // ...
    ])
```

```preview
// state: {"name": "Ada Lovelace", "email": "ada@example.com"}
// viewport: 1100
Section.make()
    .columns({
        sm: 3,
        xl: 6,
        '2xl': 8,
    })
    .schema([
        TextInput.make('name')
            .columnSpan({
                default: 1,
                sm: 2,
                xl: 3,
                '2xl': 4,
            }),
        TextInput.make('email'),
    ])
```

## Basic layout components

### Grid component

Layout components with a `columns()` method create a grid, but you also have access to an additional `Grid` component. If you feel that your schema would benefit from an explicit grid syntax with no extra styling, it may be useful to you. Instead of using the `columns()` method, you can pass your column configuration directly to `Grid.make()`:

```ts
import { Grid } from '@navette-js/schemas';

Grid.make({
    default: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 6,
    '2xl': 8,
})
    .schema([
        // ...
    ])
```

```preview
// state: {"first_name": "Ada", "last_name": "Lovelace", "email": "ada@example.com", "phone": "+44 20 7946 0958"}
// viewport: 1100
Grid.make({
    default: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 6,
    '2xl': 8,
})
    .schema([
        TextInput.make('first_name'),
        TextInput.make('last_name'),
        TextInput.make('email'),
        TextInput.make('phone'),
    ])
```

Without an argument, `Grid.make()` creates 2 columns from the `lg` breakpoint.

<Aside variant="warning">
Pass the components of a grid to its `schema()` method, never to `make()`: `Grid.make([...])` ignores the components and creates an empty two-column grid.
</Aside>

### Group component

The `Group` component nests components in a grid without any styling, and has 1 column by default. It is useful to stack several components in one column of a parent grid:

```ts
import { Group, Section } from '@navette-js/schemas';

Group.make([
    Section.make('Content').schema([
        // ...
    ]),
    Section.make('Images').schema([
        // ...
    ]),
])
    .columnSpan({ lg: 2 })
```

You may also pass the components to the `schema()` method of the group, and set its own grid with `columns()`.

### Flex component

The `Flex` component allows you to define layouts with flexible widths, using flexbox. This component does not use Navette's [grid system](#grid-system).

```ts
import { Textarea, TextInput, Toggle } from '@navette-js/forms';
import { Flex, Section } from '@navette-js/schemas';

Flex.make([
    Section.make().schema([
        TextInput.make('title'),
        Textarea.make('content'),
    ]),
    Section.make().schema([
        Toggle.make('is_published'),
        Toggle.make('is_featured'),
    ]).grow(false),
]).from('md')
```

```preview
// state: {"title": "Announcing Navette", "content": "Navette brings Filament's components to Node.js.", "is_published": true, "is_featured": false}
// viewport: 1100
Flex.make([
    Section.make().schema([
        TextInput.make('title'),
        Textarea.make('content'),
    ]),
    Section.make().schema([
        Toggle.make('is_published'),
        Toggle.make('is_featured'),
    ]).grow(false),
]).from('md')
```

In this example, the first section will `grow()` to consume available horizontal space, without affecting the amount of space needed to render the second section. This creates a flexible width sidebar effect.

The `from()` method is used to control the Tailwind breakpoint (`sm`, `md`, `lg`, `xl`, `2xl`) at which the horizontally-split layout should be used. In this example, the horizontally-split layout will be used on medium devices and larger. On smaller devices, the sections will stack on top of each other. The default breakpoint is `sm`.

### Fieldset component

You may want to group fields into a fieldset. Each fieldset has a label, a border, and a two-column grid by default:

```ts
import { Fieldset } from '@navette-js/schemas';

Fieldset.make('Address')
    .columns({
        default: 1,
        md: 2,
        xl: 3,
    })
    .schema([
        // ...
    ])
```

```preview
// state: {"street": "12 Baker Street", "city": "London", "postcode": "NW1 6XE"}
// viewport: 1100
Fieldset.make('Address')
    .columns({
        default: 1,
        md: 2,
        xl: 3,
    })
    .schema([
        TextInput.make('street'),
        TextInput.make('city'),
        TextInput.make('postcode'),
    ])
```

As well as allowing a static label, the `make()` and `label()` methods also accept a function, which receives the [context object](/schemas/overview#component-utility-injection).

### Removing the border from a fieldset

You can remove the container border from a fieldset using the `contained(false)` method:

```ts
import { Fieldset } from '@navette-js/schemas';

Fieldset.make('Address')
    .contained(false)
    .schema([
        // ...
    ])
```

```preview
// state: {"street": "12 Baker Street", "city": "London"}
// viewport: 1100
Fieldset.make('Address')
    .contained(false)
    .schema([
        TextInput.make('street'),
        TextInput.make('city'),
    ])
```

### Hiding the label of a fieldset

You may hide the label of a fieldset visually with `hiddenLabel()`. It is still read by screen readers:

```ts
import { Fieldset } from '@navette-js/schemas';

Fieldset.make('Address')
    .hiddenLabel()
    .schema([
        // ...
    ])
```

You may also display an asterisk after the label using `markAsRequired()`. This is only a visual hint: the fieldset itself is never validated, so mark the fields inside it as `required()`.

### Nesting the state of a fieldset

By default, a fieldset does not change the [state path](/schemas/overview#understanding-state-paths) of its fields. You may use `statePath()` so that the fields live under a key of their own:

```ts
import { TextInput } from '@navette-js/forms';
import { Fieldset } from '@navette-js/schemas';

Fieldset.make('Billing address')
    .statePath('billing_address')
    .schema([
        TextInput.make('street'),
        TextInput.make('city'),
    ])
```

In this example, the fields read and write `data.billing_address.street` and `data.billing_address.city`, so the data of the form contains a `billing_address` object.

### Fused group component

A `FusedGroup` component can be used to "fuse" multiple fields together, with one label for the whole group. Text inputs, selects, date-time pickers and color pickers can be fused together the best. The fields that should be fused are passed to the `make()` method:

```ts
import { Select, TextInput } from '@navette-js/forms';
import { FusedGroup } from '@navette-js/schemas';

FusedGroup.make([
    TextInput.make('city')
        .placeholder('City'),
    Select.make('country')
        .placeholder('Country')
        .options([
            // ...
        ]),
])
```

```preview
// state: {"city": "Lyon", "country": "fr"}
// width: 28rem
FusedGroup.make([
    TextInput.make('city')
        .placeholder('City'),
    Select.make('country')
        .placeholder('Country')
        .options([
            ['fr', 'France'],
            ['de', 'Germany'],
            ['us', 'United States'],
        ]),
])
```

You can add a label above the group of fields using the `label()` method:

```ts
import { FusedGroup } from '@navette-js/schemas';

FusedGroup.make([
    // ...
])
    .label('Location')
```

Each field of the group keeps a label for screen readers only. The first validation error of the fields is displayed below the group. You may also use `hiddenLabel()` and `markAsRequired()`, as on a [fieldset](#hiding-the-label-of-a-fieldset).

By default, each field will have its own row. On mobile devices, this is often the most optimal experience, but on desktop you can use the `columns()` method, the same as for the [grid system](#grid-system), to display the fields horizontally:

```ts
import { FusedGroup } from '@navette-js/schemas';

FusedGroup.make([
    // ...
])
    .label('Location')
    .columns(2)
```

```preview
// state: {"city": "Lyon", "country": "fr"}
// viewport: 1100
FusedGroup.make([
    TextInput.make('city')
        .placeholder('City'),
    Select.make('country')
        .placeholder('Country')
        .options([
            ['fr', 'France'],
            ['de', 'Germany'],
            ['us', 'United States'],
        ]),
])
    .label('Location')
    .columns(2)
```

You can adjust the width of the fields in the grid by passing `columnSpan()` to each field:

```ts
import { Select, TextInput } from '@navette-js/forms';
import { FusedGroup } from '@navette-js/schemas';

FusedGroup.make([
    TextInput.make('city')
        .placeholder('City')
        .columnSpan(2),
    Select.make('country')
        .placeholder('Country')
        .options([
            // ...
        ]),
])
    .label('Location')
    .columns(3)
```

```preview
// state: {"city": "Lyon", "country": "fr"}
// viewport: 1100
FusedGroup.make([
    TextInput.make('city')
        .placeholder('City')
        .columnSpan(2),
    Select.make('country')
        .placeholder('Country')
        .options([
            ['fr', 'France'],
            ['de', 'Germany'],
            ['us', 'United States'],
        ]),
])
    .label('Location')
    .columns(3)
```

<Aside variant="tip">
Give the group a `key()` so that its label and error message are linked to it for assistive technology: `FusedGroup.make([...]).key('location')`.
</Aside>

## Controlling spacing between components

### Reducing space between components

The `dense()` method of the `Schema` object creates a more compact layout by reducing the spacing between its components by 50%:

```ts
import { type Schema } from '@navette-js/schemas';

static infolist(schema: Schema): Schema {
    return schema
        .dense()
        .components([
            // ...
        ]);
}
```

### Removing space between components

The `gap(false)` method of the `Schema` object removes the space between its components.

<Aside variant="warning">
`dense()` and `gap()` are only available on the `Schema` object, not on layout components such as `Fieldset`. Container queries (`gridContainer()` and `@md` breakpoints) are not available in Navette yet.
</Aside>

## Adding extra HTML attributes to a layout component

You can pass extra HTML attributes to some components via the `extraAttributes()` method, which will be merged onto their outer HTML element. The attributes should be represented by an object, where the key is the attribute name and the value is the attribute value:

```ts
import { Fieldset } from '@navette-js/schemas';

Fieldset.make('Address')
    .extraAttributes({ class: 'custom-fieldset-style' })
```

Calling `extraAttributes()` several times merges the attributes.

<Aside variant="warning">
Among layout components, only `Fieldset`, `FusedGroup`, `Callout` and `EmptyState` render extra attributes. `Section`, `Grid`, `Group`, `Flex` and `Tabs` ignore them for now.
</Aside>
