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

By default, after saving the form, the user will be redirected to the Edit page of the new record. To change it, override `getRedirectUrl()`:

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

## Creating another record

The form has a "Create & create another" button, which creates the record and resets the form instead of redirecting.

### Disabling create another

The buttons under the form are returned by `getFormActions()`. To remove "Create & create another", filter it out:

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
| The form is validated on the server | none: invalid fields stop the process |
| The data is transformed | `mutateFormDataBeforeCreate(data)` |
| Before the creation | `beforeCreate(data)` |
| The record is created | `handleRecordCreation(data)` |
| After the creation | `afterCreate(record)` |
| The notification is sent | `getCreatedNotificationTitle()` |
| The user is redirected | `getRedirectUrl(record)` |

<Aside variant="warning">
`beforeFill`, `afterFill`, `beforeValidate` and `afterValidate` are not available yet.
</Aside>

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

## Custom page content

The page renders the schema returned by `contentSchema()`: a form wrapping the resource form and its buttons. You may override it, or use the [render hooks](/advanced/render-hooks) of the page, to add content above or below the form.
