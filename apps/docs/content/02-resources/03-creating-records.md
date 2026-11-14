---
title: Creating records
---

## Introduction

The create page of a resource displays its [form](/resources/overview#resource-forms) and creates a record with its adapter. It is generated from the `CreateRecord` class. To customize it, extend the class and declare your page in the resource:

```ts
import { CreateRecord, Resource } from '@navette-js/panels';

class CreateTask extends CreateRecord {
    // ...
}

export class TaskResource extends Resource {
    static pages = { create: CreateTask };
}
```

The methods below are protected hooks: the browser cannot call them.

## Customizing data before saving

Sometimes, you may wish to modify form data before it is finally saved to the database. To do this, you may define a `mutateFormDataBeforeCreate()` method on the create page class, which receives the validated data and returns the modified version:

```ts
import { CreateRecord, type PanelContext } from '@navette-js/panels';

class CreateTask extends CreateRecord {
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> {
        // The author is not a form field: the server sets it from the session.
        return { ...data, created_by: (this._ctx as PanelContext).user?.email ?? null };
    }
}
```

`this._ctx` is the context of the current request: `req`, `res`, `panel`, `user` and, in a multi-tenant panel, `tenant`.

## Customizing the creation process

You can tweak how the record is created using the `handleRecordCreation()` method. By default, it calls `create()` on the adapter of the resource:

```ts
class CreateOrder extends CreateRecord {
    protected async handleRecordCreation(data: Record<string, unknown>): Promise<any> {
        const { items, ...attributes } = data;
        const order = await this.getDataAdapter().create(attributes);
        await saveItems(order.id, items);

        return order;
    }
}
```

When the same logic is needed by every way of creating a record (page, modal, import), put it in a [custom adapter](/advanced/data-adapters#saving-data-that-does-not-fit-in-one-row) instead.

## Customizing redirects

By default, after saving the form, the user will be redirected to the View page of the new record if the resource has one and they may view it, otherwise to its Edit page if they may edit it, otherwise to the list.

To change it for every resource of the panel, use `resourceCreatePageRedirect()` with `'index'` (the list), `'view'` or `'edit'`:

```ts
panel.resourceCreatePageRedirect('index');
```

The panel's choice is skipped when the resource has no such page, or when the user may not open it (the `view` or `update` ability of the policy): the default order applies instead.

To change it for one page, override `getRedirectUrl()`, which may be async:

```ts
class CreateTask extends CreateRecord {
    protected getRedirectUrl(record: any): string {
        return this.resource.getUrl();
    }
}
```

## Customizing the save notification

When the record is successfully created, a notification is sent to the user. To change its title, override `getCreatedNotificationTitle()`. Return `null` to send no notification:

```ts
class CreateTask extends CreateRecord {
    protected getCreatedNotificationTitle(): string | null {
        return 'Task created';
    }
}
```

To change the whole notification (its body, icon, actions or duration), override `getCreatedNotification()`, which receives the new record. Return `null` to send no notification:

```ts
import { CreateRecord, Notification } from '@navette-js/panels';

class CreateTask extends CreateRecord {
    protected getCreatedNotification(record: any): Notification | null {
        return Notification.make()
            .success()
            .title('Task created')
            .body(`"${record.title}" has been added to the board.`)
            .duration(3000);
    }
}
```

## Creating another record

The form has a "Create & create another" button, which creates the record and resets the form instead of redirecting.

### Disabling create another

To remove the "Create & create another" button, set the static `canCreateAnother` property of the create page to `false`:

```ts
class CreateTask extends CreateRecord {
    static canCreateAnother = false;
}
```

For a condition computed on each request (the user's role, a setting…), override the `canCreateAnother()` method instead. It also stops the `createAnother` method, which the browser may still call:

```ts
class CreateTask extends CreateRecord {
    canCreateAnother(): boolean {
        return this.panel.getId() === 'admin';
    }
}
```

The buttons under the form are returned by `getFormActions()`. You may also filter "Create & create another" out of them:

```ts
class CreateTask extends CreateRecord {
    getFormActions() {
        return super.getFormActions().filter((action) => action.getName() !== 'createAnother');
    }
}
```

## Lifecycle hooks

Hooks may be used to execute code at various points within a page's lifecycle, like before a form is saved. To set up a hook, create a protected method on the create page class with the name of the hook:

```ts
class CreateTask extends CreateRecord {
    protected async beforeCreate(data: Record<string, unknown>): Promise<void> {
        // Runs after validation, before the record is created.
    }

    protected async afterCreate(record: any): Promise<void> {
        // Runs after the record is created.
        await audit('task.created', record.id);
    }
}
```

The hooks run in this order when the user submits the form:

| Step | Method |
|---|---|
| Before validation | `beforeValidate()` |
| The form is validated on the server | none: invalid fields stop the process |
| After a successful validation | `afterValidate()` |
| The data is transformed | `mutateFormDataBeforeCreate(data)` |
| Before the creation | `beforeCreate(data)` |
| The record is created | `handleRecordCreation(data)` |
| After the creation | `afterCreate(record)` |
| The notification is sent | `getCreatedNotification(record)` (by default from `getCreatedNotificationTitle()`) |
| The user is redirected | `getRedirectUrl(record)` |

When the page opens, `beforeFill()` runs before the form is filled with its defaults, and `afterFill()` after. The edit page runs the same hooks around filling the form with the record.

```ts
import { CreateRecord } from '@navette-js/panels';

class CreatePost extends CreateRecord {
    protected async beforeValidate(): Promise<void> {
        // Runs before the form is validated.
    }

    protected async afterFill(): Promise<void> {
        this.data.published_at ??= new Date().toISOString().slice(0, 10);
    }
}
```

## Halting the creation process

There is no `halt()` method. To stop the creation gracefully, for example after a check that needs the database, override the `create()` method, which is the one called by the submit button, and return early:

```ts
import { CreateRecord, Notification } from '@navette-js/panels';

class CreateProject extends CreateRecord {
    async create(another = false): Promise<void> {
        if (await quotaReached()) {
            Notification.make().danger().title('Project quota reached').send();
            return;
        }

        await super.create(another);
    }
}
```

To reject one value, prefer a validation rule on the field: its message is shown under the field.

## Authorization

The create page, and the "New" button of the list page, are only available to users who have the `create` ability. The ability is checked on every request sent by the page, not only when it is displayed. See [authorization](/resources/authorization).

## Using a wizard

You may easily transform the creation process into a multistep wizard. Override `getSteps()` and return `Step` components from `@navette-js/forms`. The steps replace the form of the resource on this page:

```ts
import { Step } from '@navette-js/forms';
import { CreateRecord } from '@navette-js/panels';

class CreateExpense extends CreateRecord {
    protected getSteps(): Step[] {
        return [
            Step.make('Details').icon('s-information-circle').columns(2).schema([
                // ...
            ]),
            Step.make('Line Items').icon('s-list-bullet').schema([
                // ...
            ]),
            Step.make('Review').icon('s-check-circle').schema([
                // ...
            ]),
        ];
    }
}
```

Each step is validated on the server before the next one. The "Create" button appears on the last step, and "Cancel" on the first. To let the user move freely between the steps, without validation, override `hasSkippableSteps()` to return `true`; to open the wizard on another step, override `getStartStep()` (the first step is `1`).

### Sharing fields between the form schema and wizards

The steps are ordinary schema components. To avoid writing the fields twice, build them in functions shared by `form()` and `getSteps()`, as `apps/demo/resources/ExpenseResource.ts` does:

```ts
const description = () => Textarea.make('description').required().columnSpanFull();

export class ExpenseResource extends Resource {
    static form(schema: Schema): Schema {
        return schema.components([Section.make('Details').schema([description()])]);
    }
}

class CreateExpense extends CreateRecord {
    protected getSteps(): Step[] {
        return [Step.make('Details').schema([description()])];
    }
}
```

## Custom actions

The header of the create page has no actions by default. You may add some by overriding `getHeaderActions()`:

```ts
import { Action } from '@navette-js/actions';

class CreateTask extends CreateRecord {
    getHeaderActions() {
        return [
            Action.make('help').label('Help').color('gray').url('/docs/tasks').openUrlInNewTab(),
        ];
    }
}
```

To create records from a modal on another page, use the [create action](/actions/create).

### Moving the form buttons to the header

The buttons under the form are returned by `getFormActions()`: `getCreateFormAction()`, `getCreateAnotherFormAction()` and `getCancelFormAction()`. To show the create button in the page header instead, return it from `getHeaderActions()` with `formId('form')`, which makes it submit the form from outside, and remove the form buttons:

```ts
class CreateTask extends CreateRecord {
    getHeaderActions() {
        return [this.getCreateFormAction().formId('form')];
    }

    getFormActions() {
        return [];
    }
}
```

## Custom page content

The page renders the schema returned by `contentSchema()`: a form wrapping the resource form and its buttons. You may override it, or use the [render hooks](/advanced/render-hooks) of the page, to add content above or below the form.
