---
title: Rendering a schema outside a panel
---

## Introduction

Any [schema](/schemas/overview) (layout components, text, infolist entries, fields) may be rendered in a component outside a panel. Set up the `Livewire` instance first: see [rendering a form outside a panel](/components/outside-a-panel/form#setting-up-the-components).

## Adding the schema

Add a method named after the schema, followed by `Schema`, which receives the schema, configures it and returns it:

```ts
import { LivewireComponent } from '@navette-js/panels/livewire';
import { Section, Text, type Schema } from '@navette-js/schemas';

export class ViewProduct extends LivewireComponent {
    static view = new URL('./view-product.ejs', import.meta.url);

    productSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Shipping').schema([
                Text.make('Orders placed before noon leave the same day.'),
            ]),
        ]);
    }
}
```

Then render it in the component's view:

```html
<div>
    <%- await schema('product') %>
</div>
```

Without a view, the component renders its `contentSchema()`, followed by the modals of its actions.

If the schema holds [actions](/actions/overview), render the modals once in the view with `<%- await modals() %>`.
