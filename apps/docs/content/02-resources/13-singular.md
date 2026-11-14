---
title: Singular resources
---

## Introduction

The list page of a resource shows a table of its records. Sometimes there is no need for a table: there is only a single record that the user interacts with. If it doesn't exist yet when the user opens the page, it is created when the form is first saved. If it already exists, it is loaded into the form, and updated when the form is saved.

For example, a CMS might have a `PageResource` for the pages of its website, and a singular resource to edit the "homepage" directly, without finding it in the table. Other examples are the settings of a site, or the profile of the signed-in user.

<Aside variant="tip">
For the profile of the signed-in user, the [profile page](/panels/users) of the panel needs less code.
</Aside>

## Creating a singular resource

A singular resource is a resource with `isSingular`. Its edit page is served at the resource URL, with the resource's navigation item, and it has no list, create or view page:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { RichEditor, TextInput } from '@navette-js/forms';
import { Resource } from '@navette-js/panels';
import type { Schema } from '@navette-js/schemas';

export class HomepageResource extends Resource {
    static slug = 'homepage';
    static modelLabel = 'homepage';
    static navigationIcon = 'o-home';
    static isSingular = true;
    static adapter = new ObjectionAdapter(WebsitePage, {
        modify: (query) => { query.where('is_homepage', true); },
    });

    static getSingularRecordAttributes(): Record<string, unknown> {
        return { is_homepage: true };
    }

    static form(schema: Schema): Schema {
        return schema.components([
            TextInput.make('title').required().maxLength(255),
            RichEditor.make('content'),
        ]);
    }
}
```

- The record is the first one of the resource's adapter: here, the page whose `is_homepage` column is set. The `modify` option of the adapter selects it.
- When there is no such record, the form shows its default values. The first save creates the record with the form data and the attributes returned by `getSingularRecordAttributes()`, which win over the form data.
- Once the record exists, saving updates it. The page looks the record up on every request, so a record created in another tab in the meantime is updated rather than duplicated.

The page title and the navigation label are the resource's `navigationLabel`, or its model label in title case ("Homepage"). The page has a "Save" button, no "Cancel" button and no delete action. Its URL is `HomepageResource.getUrl()`.

## Finding the record

To find the record another way, override `resolveSingularRecord()`. It receives the resource's adapter and returns the record, or `null` when it does not exist yet:

```ts
export class HomepageResource extends Resource {
    // ...

    static async resolveSingularRecord(adapter: DataAdapter): Promise<unknown | null> {
        const { records } = await adapter.paginate({ page: 1, perPage: 1, sort: { column: 'updated_at', direction: 'desc' } });
        return records[0] ?? null;
    }
}
```

In a [multi-tenant panel](/panels/tenancy), the adapter of a resource scoped to the tenant only reads the records of the current tenant: each tenant then has its own singular record, created with its tenant key.

## Customizing the edit page

The page is an [edit page](/resources/editing-records): replace it with your subclass of `EditRecord` in `pages`, and use its hooks. For example, settings stored as JSON in a `payload` column are edited as separate fields:

```ts
import { ObjectionAdapter } from '@navette-js/database';
import { EditRecord, Resource } from '@navette-js/panels';

class EditSiteSettings extends EditRecord {
    protected mutateFormDataBeforeFill(data: Record<string, unknown>): Record<string, unknown> {
        return { ...((data.payload as Record<string, unknown> | null) ?? {}) };
    }

    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> {
        return { payload: data };
    }
}

export class SiteSettingsResource extends Resource {
    static slug = 'site-settings';
    static modelLabel = 'site settings';
    static isSingular = true;
    static pages = { edit: EditSiteSettings };
    static adapter = new ObjectionAdapter(Setting, {
        modify: (query) => { query.where({ group: 'site', name: 'general' }); },
    });

    static getSingularRecordAttributes(): Record<string, unknown> {
        return { group: 'site', name: 'general' };
    }
}
```

`mutateFormDataBeforeFill()` receives an empty object when the record does not exist yet. To create the record yourself, define `handleRecordCreation(data)` on the page: it is called by the first save instead of the adapter's `create()`, and returns the new record.

## Adding a view page

With `hasViewPage`, the resource URL shows the record's [infolist](/resources/viewing-records), with an "Edit" button, and the edit page moves to `<slug>/edit` (`getUrl('edit')`). While the record does not exist yet, the view page shows an empty infolist.

## Authorization

The navigation item and the pages require the `viewAny` ability of the resource's [policy](/resources/authorization). Then the edit page requires `create` while the record does not exist, and `update` on the record once it does, and the view page `view` on the record (`viewAny` is enough while it does not exist). The abilities are checked on every request of the page.
