---
title: Overview
---

## Introduction

Schemas let you build user interfaces in TypeScript by combining components for input, display, and layout. A schema is represented by a `Schema` object from `@navette-js/schemas`, and you pass its components to the `components()` method. Components can contain child schemas to create nested layouts.

Navette packages provide you with various components. You can find a full list in the [available components section](#available-components):

- [Form fields](/forms/overview) accept input from the user, for example, a text input, a select, or a checkbox. They come with server-side validation.
- [Infolist entries](/infolists/overview) are components for rendering "description lists". Entries are label-value UI elements that present read-only information like text, icons, and images. The data for an infolist usually comes from a single record.
- [Layout components](/schemas/layouts) are used to structure the components. For example, a grid, tabs, or a multi-step wizard.
- [Prime components](/schemas/primes) are simple components that render basic stand-alone static content, such as text, icons, and images.

## Available components

For building [forms](/forms/overview), Navette includes a set of fields for different data types, documented in the forms section.

For displaying data in a label-value "description list" format, Navette includes [infolist](/infolists/overview) entry components:

- [Text entry](/infolists/text-entry)
- [Icon entry](/infolists/icon-entry)
- [Image entry](/infolists/image-entry)
- [Color entry](/infolists/color-entry)
- [Code entry](/infolists/code-entry)
- [Key-value entry](/infolists/key-value-entry)
- [Repeatable entry](/infolists/repeatable-entry)
- Or, build your own [custom infolist entry](/infolists/custom-entries)

To arrange components into a [layout](/schemas/layouts), Navette includes layout components:

- [Grid and group](/schemas/layouts#grid-component)
- [Flex](/schemas/layouts#flex-component)
- [Fieldset](/schemas/layouts#fieldset-component)
- [Fused group](/schemas/layouts#fused-group-component)
- [Section](/schemas/sections)
- [Tabs](/schemas/tabs)
- [Wizard](/schemas/wizards)
- [Callout](/schemas/callouts)
- [Empty state](/schemas/empty-states)
- Or, build your own [custom layout component](/schemas/custom-components#custom-component-classes)

For displaying arbitrary content, Navette includes [prime](/schemas/primes) components:

- [Text](/schemas/primes#text-component)
- [Icon](/schemas/primes#icon-component)
- [Image](/schemas/primes#image-component)
- [Unordered list](/schemas/primes#unordered-list-component)
- [Html](/schemas/primes#html-component)

You can also insert [action](/actions/overview) buttons into some components, such as the header of a [section](/schemas/sections#inserting-actions-and-other-components-in-the-header-of-a-section), the footer of a [callout](/schemas/callouts#adding-actions-to-the-callout-footer) or of an [empty state](/schemas/empty-states#inserting-actions-and-other-components-in-the-footer-of-an-empty-state).

## An example schema

For example, you may want to build a form with a schema. In a resource, Navette creates the `Schema` object and passes it to the static `form()` method, which returns the schema with the components added:

```ts
import { Checkbox, Select, TextInput } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { Grid, Section, type Schema } from '@navette-js/schemas';

static form(schema: Schema): Schema {
    return schema.components([
        Grid.make(2).schema([
            Section.make('Details').schema([
                TextInput.make('name'),
                Select.make('position').options([
                    ['developer', 'Developer'],
                    ['designer', 'Designer'],
                ]),
                Checkbox.make('is_admin'),
            ]),
            Section.make('Auditing').schema([
                TextEntry.make('created_at').dateTime(),
                TextEntry.make('updated_at').dateTime(),
            ]),
        ]),
    ]);
}
```

```preview
// state: {"name": "Ada Lovelace", "position": "developer", "is_admin": true}
// viewport: 1100
Grid.make(2).schema([
    Section.make('Details').schema([
        TextInput.make('name'),
        Select.make('position').options([
            ['developer', 'Developer'],
            ['designer', 'Designer'],
        ]),
        Checkbox.make('is_admin'),
    ]),
    Section.make('Auditing').schema([
        TextEntry.make('created_at').dateTime().state(() => '2026-03-14 09:30:00'),
        TextEntry.make('updated_at').dateTime().state(() => '2026-11-02 16:45:00'),
    ]),
])
```

[Grid](/schemas/layouts#grid-component) is a layout component that renders multiple components together in a responsive grid. The number of columns in the grid is specified in the `make()` method. The `schema()` method is used to nest components within the grid.

[Section](/schemas/sections) is another layout component that renders multiple components together in a card, with a heading at the top.

[TextInput](/forms/text-input), [Select](/forms/select), and [Checkbox](/forms/checkbox) are form components that accept input from the user.

[TextEntry](/infolists/text-entry) is an infolist component that displays read-only information. In this example, it is used to display the created and updated timestamps of the record. The `dateTime()` method is used to format the timestamps as dates and times.

The schema object is the container for the components and can now be rendered. Rendering the schema renders all the components within it in the correct layout.

## Understanding state paths

Each schema has a state path: the property of the page (or other host component) where the values of its fields live. The form of a resource page uses the `data` state path, so `TextInput.make('name')` reads and writes `data.name`. The values travel between the browser and the server with each request.

Layout components such as `Section`, `Grid` or `Tabs` do not add anything to the state path: a field keeps the same path wherever you place it in the layout. A [fieldset](/schemas/layouts#nesting-the-state-of-a-fieldset) can opt in to nesting the state of its fields under its own path.

Infolists have no state path: their entries read their values from the record of the schema instead.

## Component utility injection

The vast majority of methods used to configure components accept functions as parameters instead of hardcoded values:

```ts
import { Section, Text } from '@navette-js/schemas';

Section.make('Billing')
    .hidden(({ record }) => record === null)
    .columnSpan({ lg: ({ operation }) => (operation === 'edit' ? 2 : 3) })
    .schema([
        Text.make(({ record }) => `Customer #${(record as Customer).id}`),
    ])
```

This alone unlocks many customization possibilities. Navette passes one context object to these functions. You may destructure the properties that you need:

| Property | Description |
| --- | --- |
| `record` | The record of the schema, or `null` (for example, on a create page). |
| `operation` | The current operation: `'create'`, `'edit'` or `'view'` on resource pages, or `null`. |
| `get` | A function that returns the state of another field, relative to the state path of the component's container. |
| `state` | The current state of the component, for components that have a state path. |
| `livewire` | The page (or other host component) that renders the schema. |
| `component` | The current component instance. |

Functions may be `async`: Navette awaits them before rendering.

### Injecting the state of another component

You may retrieve the state (value) of a form field from within a function, using `get`:

```ts
import { TextInput } from '@navette-js/forms';

TextInput.make('company_name')
    .visible(({ get }) => get('type') === 'company')
```

<Aside variant="tip">
Unless a form field is `live()`, the schema will not refresh when the value of the field changes, only when the next user interaction occurs that makes a request to the server. If you need to react to changes in a field's value, it should be `live()`.
</Aside>

### Injecting the current operation

If you're writing a schema for a resource, and you wish to check if a schema is `create`, `edit` or `view`, use `operation`:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Review').hidden(({ operation }) => operation === 'create')

// The same, shorter:
Section.make('Review').hiddenOn('create')
```

`hiddenOn()` and `visibleOn()` accept an operation or an array of operations. When the schema has no operation, `hiddenOn()` never hides the component and `visibleOn()` never shows it.

<Aside variant="info">
You can manually set a schema's operation using the `operation()` method of the `Schema` object.
</Aside>

## Using schemas in pages

### Using schemas in resources

A resource declares its schemas in static methods. Navette creates each `Schema` object, sets its operation and record, and passes it to the method:

- `form()` is used by the create and edit pages, with the `data` state path and a two-column grid by default.
- `infolist()` is used by the [view page](/infolists/overview#using-an-infolist-on-a-view-page), or by the view modal when the resource has no view page.

```ts
import { Resource } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';

export class CategoryResource extends Resource {
    static form(schema: Schema): Schema {
        return schema
            .components([
                Section.make().schema([
                    // ...
                ]),
            ])
            .columns(3);
    }
}
```

### Using schemas in custom pages

The content of a custom page is the schema returned by its `contentSchema()` method:

```ts
import { Page } from '@navette-js/panels';
import { Section, Text, type Schema } from '@navette-js/schemas';

export class ServiceStatus extends Page {
    static slug = 'status';
    static navigationIcon = 'o-signal';

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Database').schema([
                Text.make('All systems are operational.'),
            ]),
        ]);
    }
}
```

A page may host several schemas: each one is a method named after it, followed by `Schema`. `getSchema('settings')` calls `settingsSchema()`, with a fresh `Schema` object whose key is `settings`. The schema named `form` receives the `data` state path. To render another schema inside the content, embed it with `EmbeddedSchema`:

```ts
import { Action } from '@navette-js/actions';
import { TextInput, fillSchema, getSchemaState, validateSchema } from '@navette-js/forms';
import { Page } from '@navette-js/panels';
import { Actions, EmbeddedSchema, Form, type Schema } from '@navette-js/schemas';

export class Settings extends Page {
    static slug = 'settings';
    static callable = ['save'];

    data: Record<string, unknown> = {};

    mount(): void {
        fillSchema(this.getSchema('form'), this.data);
    }

    formSchema(schema: Schema): Schema {
        return schema.components([
            TextInput.make('company_name').required().maxLength(255),
        ]);
    }

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Form.make([EmbeddedSchema.make('form')])
                .id('form')
                .livewireSubmitHandler('save')
                .footer([
                    Actions.make([Action.make('save').label('Save').submit('save')]),
                ]),
        ]);
    }

    async save(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        const data = await getSchemaState(form);
        // ...
    }
}
```

<Aside variant="warning">
Public properties of a page, such as `data`, are sent to the browser and can be modified by it. Always read submitted values through `validateSchema()` and `getSchemaState()`, which validate them on the server and keep only the fields declared by the schema, and authorize the operation in your method.
</Aside>

### Using schemas in action modals

Actions accept a schema for their modal. See the [actions documentation](/actions/overview).

## The schema object

These methods of `Schema` are available when you build or configure a schema:

| Method | Description |
| --- | --- |
| `components([...])` | Sets the components of the schema. `schema([...])` is an alias. |
| `columns(2)` or `columns({ sm: 2, xl: 4 })` | Sets the [grid](/schemas/layouts#grid-system) of the schema. |
| `operation('edit')` | Sets the operation passed to component functions. |
| `record(record)` | Sets the record passed to component functions, and read by infolist entries. |
| `statePath('data')` | Sets the property of the host component where field values live. |
| `key('settings')` | Sets the key of the schema, used to build the keys of its components. |
| `dense()` | Halves the space between components, in this schema and in the layout components inside it. |
| `gap(false)` | Removes the space between components, in this schema and in the layout components inside it. |
| `rootHeadingLevel(3)` | Sets the level of the schema's top-level headings. See [setting the root heading level](#setting-the-root-heading-level). |

## Setting the root heading level

By default, headings in a schema start at level two (`<h2>`), since schemas are usually rendered below a page's level-one heading. If you render a schema elsewhere in the document hierarchy, you can change its root heading level using the `rootHeadingLevel()` method:

```ts
import { Section, type Schema } from '@navette-js/schemas';

static infolist(schema: Schema): Schema {
    return schema
        .rootHeadingLevel(3)
        .components([
            Section.make('Product'), // Rendered as an <h3>
            // ...
        ]);
}
```

In this example, the schema is rendered below a level-two heading, so its headings start at level three. Nested section headings automatically use the next level: a section inside a section with a heading is an `<h4>` here. Beyond level six, headings are rendered as paragraphs. Empty states follow the same levels, unless you set their `headingTag()`.

## Global settings

If you wish to change the default behavior of a component globally, then you can call the static `configureUsing()` method once when your application starts, before any schema is built. You pass it a function to modify each new instance of the component. For example, if you wish to make all section components have [2 columns](/schemas/sections#using-grid-columns-within-a-section) by default, you can do it like so:

```ts
import { Section } from '@navette-js/schemas';

Section.configureUsing((section) => section.columns(2));
```

Of course, you are still able to overwrite this on each component individually:

```ts
import { Section } from '@navette-js/schemas';

Section.make('Notes').columns(1)
```

<Aside variant="warning">
Lazy loading a child schema (`lazyLoaded()`) is not available in Navette yet.
</Aside>
