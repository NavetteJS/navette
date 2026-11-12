---
title: Editing records
---

## Introduction

The edit page of a resource loads a record with the adapter of the resource, fills the [form](/resources/overview#resource-forms) with its values and saves the changes. It is generated from the `EditRecord` class, and answers under `/<slug>/{record}/edit`. To customize it, extend the class and declare your page in the resource:

```ts
import { EditRecord, Resource } from '@navette-js/panels';

class EditTask extends EditRecord {
    // ...
}

export class TaskResource extends Resource {
    static pages = { edit: EditTask };
}
```

The record is read again on every request sent by the page: inside the page, it is available as `this._record`, and its key as `this.recordKey`. The key is locked: the browser cannot change it.

Below the form, the page displays the [relation managers](/resources/managing-relationships) of the resource, in tabs.

## Customizing data before filling the form

You may wish to modify the data from a record before it is filled into the form. To do this, you may define a `mutateFormDataBeforeFill()` method on the edit page class, which receives the attributes of the record and returns the modified version:

```ts
class EditUser extends EditRecord {
    protected mutateFormDataBeforeFill(data: Record<string, unknown>): Record<string, unknown> {
        return { ...data, full_name: `${data.first_name} ${data.last_name}` };
    }
}
```

Only the fields declared in the form receive a value: the other attributes of the record never reach the browser.

## Customizing data before saving

Sometimes, you may wish to modify form data before it is finally saved to the database. Define `mutateFormDataBeforeSave()`, which receives the validated data:

```ts
class EditExpense extends EditRecord {
    protected mutateFormDataBeforeSave(data: Record<string, unknown>): Record<string, unknown> {
        return { ...data, total_amount: totalOf(data.lines) };
    }
}
```

## Customizing the saving process

You can tweak how the record is updated using the `handleRecordUpdate()` method. It receives the current record and the data, and returns the updated record. By default, it calls `update()` on the adapter:

```ts
class EditOrder extends EditRecord {
    protected async handleRecordUpdate(record: any, data: Record<string, unknown>): Promise<any> {
        const { items, ...attributes } = data;
        const order = await this.getDataAdapter().update(this.getDataAdapter().getKey(record), attributes);
        await saveItems(record.id, items);

        return order;
    }
}
```

## Customizing redirects

By default, the user stays on the edit page after saving. To redirect them, override `getRedirectUrl()`, which returns a URL or `null`:

```ts
class EditTask extends EditRecord {
    protected getRedirectUrl(record: any): string | null {
        return this.resource.getUrl();
    }
}
```

The "Cancel" button goes back in the browser history, or to the page the user came from when there is no history. That previous URL is only accepted when it belongs to the same site.

## Customizing the save notification

When the record is successfully updated, a notification is sent to the user. To change its title, override `getSavedNotificationTitle()`. Return `null` to send no notification:

```ts
class EditTask extends EditRecord {
    protected getSavedNotificationTitle(): string | null {
        return 'Task updated';
    }
}
```

## Lifecycle hooks

Hooks may be used to execute code at various points within a page's lifecycle, like before a form is saved:

```ts
class EditTask extends EditRecord {
    protected async beforeSave(data: Record<string, unknown>): Promise<void> {
        // Runs after validation, before the record is saved.
    }

    protected async afterSave(record: any): Promise<void> {
        // Runs after the record is saved.
    }
}
```

The hooks run in this order when the user saves the form:

| Step | Method |
|---|---|
| The form is validated on the server | none: invalid fields stop the process |
| The data is transformed | `mutateFormDataBeforeSave(data)` |
| Before the update | `beforeSave(data)` |
| The record is updated | `handleRecordUpdate(record, data)` |
| After the update | `afterSave(record)` |
| The notification is sent | `getSavedNotificationTitle()` |
| The user is redirected, if a URL is returned | `getRedirectUrl(record)` |

## Halting the saving process

To stop the saving process gracefully, override `save()`, the method called by the "Save changes" button, and return early:

```ts
import { EditRecord, Notification } from '@navette-js/panels';

class EditInvoice extends EditRecord {
    async save(): Promise<void> {
        if (this._record.status === 'paid') {
            Notification.make().warning().title('A paid invoice cannot be changed').send();
            return;
        }

        await super.save();
    }
}
```

## Authorization

The edit page is only available to users who have the `update` ability on the record. The check runs on every request sent by the page, with the record read again from the adapter: a user who loses the right while the page is open cannot save it anymore.

The default header action, `DeleteAction`, requires the `delete` ability. See [authorization](/resources/authorization).

## Custom actions

By default, the header of the edit page contains a [delete action](/resources/deleting-records), plus restore and force-delete actions when the adapter uses soft deletes. To add actions before them, define the static `editHeaderActions()` method on the resource. The record of the page is passed to their closures:

```ts
import { Action } from '@navette-js/actions';

static editHeaderActions = () => [
    Action.make('website')
        .label('Visit website')
        .color('gray')
        .url(({ record }) => record.website)
        .openUrlInNewTab(),
];
```

To replace the header actions entirely, override `getHeaderActions()` in a custom edit page:

```ts
import { DeleteAction, EditRecord, ViewAction } from '@navette-js/panels';

class EditExpense extends EditRecord {
    getHeaderActions() {
        return [ViewAction.make(), DeleteAction.make()];
    }
}
```

An action with a modal is mounted on the page and receives the record as `record`. See [actions](/actions/overview).

## Adding edit pages to resource sub-navigation

When the resource declares a [sub-navigation](/resources/overview#resource-sub-navigation) with `recordSubNavigation`, the edit page displays it, with its own item active:

```ts
static recordSubNavigation = ['view', 'edit', 'comments'];
```

<Aside variant="warning">
A resource has a single edit page: additional Edit pages, and saving a part of the form independently, are not available yet.
</Aside>

## Custom page content

The page renders the schema returned by `contentSchema()`: the form with its buttons, then the relation manager tabs. You may override it, or use the [render hooks](/advanced/render-hooks) of the page, to add content around them.
