// Components outside any panel (`@navette-js/panels/livewire`): a contact form, a product table and a page of the application
// embedding the table, served by plain Express routes under `/outside`. Mounted by server.ts with the lab (NAVETTE_NO_LAB
// turns both off), so the pages compared with reference screenshots are unchanged.
import express, { type Router } from 'express';
import { Action } from '@navette-js/actions';
import { Model, ObjectionAdapter } from '@navette-js/database';
import { fillSchema, getSchemaState, Select, Textarea, TextInput, validateSchema } from '@navette-js/forms';
import { TextEntry } from '@navette-js/infolists';
import { Notification } from '@navette-js/panels';
import { Livewire, LivewireComponent, TableComponent } from '@navette-js/panels/livewire';
import { Section, type Schema } from '@navette-js/schemas';
import { Color, e } from '@navette-js/support';
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';

class OutsideProduct extends Model { static tableName = 'products'; declare id: number; declare name: string; declare sku: string | null; declare qty: number; declare price: number | null; declare is_visible: number; }

/** Messages received by the contact form (in memory: the demo database is not changed). */
export const contactMessages: Record<string, unknown>[] = [];

/** A form rendered in a component view, outside any panel. */
export class ContactForm extends LivewireComponent {
    static title = 'Contact us';
    static callable = ['send'];
    static view = new URL('./contact-form.ejs', import.meta.url);
    data: Record<string, unknown> = {};
    mount(): void { fillSchema(this.getSchema('form'), this.data); }
    formSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Your message').description('We answer within two working days.').schema([
                TextInput.make('name').required().maxLength(100),
                TextInput.make('email').email().required(),
                Select.make('topic').options({ order: 'An order', product: 'A product', other: 'Something else' }).default('order').required(),
                Textarea.make('message').required().minLength(10),
            ]),
        ]);
    }
    /** An infolist next to the form. */
    officeSchema(schema: Schema): Schema {
        return schema.record({ address: '12 Harbour Street, Brest', hours: 'Monday to Friday, 9:00–17:00' }).components([TextEntry.make('address'), TextEntry.make('hours')]);
    }
    /** An action with a modal form, rendered by `action('newsletter')`. */
    newsletterAction(): Action {
        return Action.make('newsletter').label('Subscribe to the newsletter').color('gray').icon('o-envelope')
            .modalHeading('Newsletter').modalDescription('One email a month, no more.')
            .schema([TextInput.make('address').label('Email address').email().required()])
            .action(({ data }) => { Notification.make().success().title(`Subscribed ${String(data.address)}`).send(); });
    }
    async send(): Promise<void> {
        const form = this.getSchema('form');
        this._errors = await validateSchema(form);
        if (Object.keys(this._errors).length) return;
        contactMessages.push(await getSchemaState(form));
        fillSchema(form, (this.data = {}));
        Notification.make().success().title('Message sent').body('Thank you, we will get back to you soon.').send();
    }
}

/** A table rendered in a component, outside any panel. */
export class ProductCatalog extends TableComponent {
    static title = 'Catalog';
    table(table: Table): Table {
        return table
            .heading('Catalog')
            .columns([
                TextColumn.make<OutsideProduct>('name').searchable().sortable(),
                TextColumn.make<OutsideProduct>('sku').label('SKU'),
                TextColumn.make<OutsideProduct>('qty').label('In stock').numeric().sortable(),
                TextColumn.make<OutsideProduct>('price').money('usd').sortable(),
            ])
            .filters([SelectFilter.make('stock').label('Stock').options({ low: 'Low stock', ok: 'In stock' }).query((query, data) => { if (data.value === 'low') query.where('qty', '<', 10); else if (data.value === 'ok') query.where('qty', '>=', 10); })])
            .defaultSort('name')
            .recordActions([
                Action.make('reserve').label('Reserve').icon('o-bookmark')
                    .requiresConfirmation().modalDescription(({ record }) => `Reserve one ${(record as OutsideProduct).name}?`)
                    .action(({ record }) => { Notification.make().success().title(`Reserved ${(record as OutsideProduct).name}`).send(); }),
            ]);
    }
    getDataAdapterForTable() { return new ObjectionAdapter(OutsideProduct, { modify: (query) => { query.where('is_visible', 1); } }); }
}

/** The routes of the demo: the two components as full pages, and an application page embedding the catalog. */
export function outsidePanel(key: string): Router {
    const livewire = new Livewire({ key, path: '_outside', colors: { primary: Color.Teal } });
    livewire.components([ContactForm, ProductCatalog]);
    const router = express.Router();
    router.use(livewire.router());
    router.get('/outside/contact', livewire.page(ContactForm));
    router.get('/outside/catalog', livewire.page(ProductCatalog));
    // A page of the application with its own layout: the component is one part of it.
    router.get('/outside/shop', async (req, res) => {
        const catalog = await livewire.mount('product-catalog', {}, req, res);
        res.send(`<!DOCTYPE html>
<html lang="en" class="fi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e('Shop — outside any panel')}</title>
${livewire.styles(req, res)}
</head>
<body class="nv-body" style="padding: 2rem;">
<header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
    <h1 class="nv-header-heading" data-test="shop-heading">Our shop</h1>
    <a href="/outside/contact" class="nv-link">Contact us</a>
</header>
${catalog}
${await livewire.notifications(req, res)}
${livewire.scripts(req, res)}
</body>
</html>`);
    });
    return router;
}
