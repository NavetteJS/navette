---
title: Custom pages
---

## Introduction

Navette generates the pages of a resource, but you are not limited to them. There are three ways to add your own screens to a resource:

- replace a generated page with a subclass, through the `pages` property ([customizing resource pages](/resources/overview#customizing-resource-pages));
- add a page of related records, through `relatedPages` ([relation pages](/resources/managing-relationships#relation-pages));
- register a free [page](/panels/navigation#creating-a-custom-page) whose URL contains the record key, as described below.

## Using a resource record

A page of a panel may have parameters in its slug, written in braces. The router passes them to `mount()`, and copies each one into the public property of the same name:

```ts
import { Page, type PanelContext } from '@navette-js/panels';
import { WireError } from '@navette-js/wire';
import { TextEntry } from '@navette-js/infolists';
import { Section, type Schema } from '@navette-js/schemas';

export class OrderReceipt extends Page {
    static slug = 'shop/orders/{record}/receipt';
    static title = 'Receipt';
    static shouldRegisterNavigation = false;
    static locked = ['record'];

    record = '';
    _order: any = null;

    // Runs on every request of the page: read the record again and check the rights.
    async hydrate(): Promise<void> {
        const user = (this._ctx as PanelContext).user;
        this._order = await OrderResource.adapter.find(this.record);
        if (!this._order) throw new WireError(404, 'Not Found');
        if (!(await OrderResource.can('view', user, this._order))) throw new WireError(403, 'Forbidden');
    }

    async mount(): Promise<void> {
        await this.hydrate();
    }

    getHeading(): string {
        return `Receipt for ${this._order.number}`;
    }

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make().schema([
                TextEntry.make('number').state(() => this._order.number),
                TextEntry.make('total').state(() => this._order.total_price).money('usd'),
            ]),
        ]);
    }
}
```

Register it on the panel, then link to it from the resource, for example with a row action:

```ts
panel.pages([OrderReceipt]);

Action.make('receipt').url(({ record }) => panel.getUrl(`shop/orders/${record.id}/receipt`))
```

This page is not attached to the resource: Navette only checks its `canAccess()` method. Reading the record through the resource adapter keeps the scope of the resource (and of the current tenant), and checking the resource policy in `hydrate()`, which runs on every request sent by the page, keeps a forged request away from records the user may not view. A WireError with status 404 or 403 thrown while the page is displayed answers with that status.

Properties whose name starts with `_` stay on the server; `locked` keeps the browser from changing `record`.

<Aside variant="warning">
A free page cannot appear in the record sub-navigation of a resource (`recordSubNavigation` only accepts the View, Edit and related-records pages).
</Aside>
