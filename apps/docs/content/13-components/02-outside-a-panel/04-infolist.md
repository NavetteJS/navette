---
title: Rendering an infolist outside a panel
---

## Introduction

An [infolist](/infolists/overview) shows the data of a record in a component outside a panel. Set up the `Livewire` instance first: see [rendering a form outside a panel](/components/outside-a-panel/form#setting-up-the-components).

## Adding the infolist

Add a method named after the infolist, followed by `Schema`, and give the schema its record:

```ts
import { TextEntry } from '@navette-js/infolists';
import { LivewireComponent } from '@navette-js/panels/livewire';
import type { Schema } from '@navette-js/schemas';
import { WireError } from '@navette-js/wire';

export class ViewProduct extends LivewireComponent {
    static view = new URL('./view-product.ejs', import.meta.url);
    static locked = ['productId'];

    productId = '';
    /** Not public state (it starts with `_`): loaded again on every request. */
    _product: Product | null = null;

    async mount({ product }: Record<string, unknown>): Promise<void> {
        this.productId = String(product);
        await this.hydrate();
    }

    async hydrate(): Promise<void> {
        this._product = (await Product.query().findById(this.productId).withGraphFetched('category')) ?? null;
        if (!this._product) throw new WireError(404, 'Product not found.');
    }

    productInfolistSchema(schema: Schema): Schema {
        return schema.record(this._product).components([
            TextEntry.make('name'),
            TextEntry.make('category.name'),
            TextEntry.make('price').money('usd'),
        ]);
    }
}
```

Render it in the view with `<%- await schema('productInfolist') %>`, and serve the component with the product's key in the route: `app.get('/products/:product', livewire.page(ViewProduct))`.

The record is loaded again on every request from a locked key: the component does not keep the record in its public state, which the browser could change. Check in `hydrate()` that the user may see it.

## Passing data to the infolist

`record()` also accepts a plain object, for data that is not a model:

```ts
officeSchema(schema: Schema): Schema {
    return schema.record({ address: '12 Harbour Street, Brest', hours: 'Monday to Friday' }).components([
        TextEntry.make('address'),
        TextEntry.make('hours'),
    ]);
}
```
