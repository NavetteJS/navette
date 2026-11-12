---
title: Viewing records
---

## Introduction

A resource may have a View page, a read-only page that displays a record. It is generated from the `ViewRecord` class, and answers under `/<slug>/{record}`.

## Creating a resource with a View page

To add a View page to a resource, set `hasViewPage` to `true`, and describe the page with the static `infolist()` method. It receives a [schema](/schemas/overview) set to two columns, and returns it with [entries](/infolists/overview):

```ts
import { TextEntry } from '@navette-js/infolists';
import { Resource } from '@navette-js/panels';
import { Section, type Schema } from '@navette-js/schemas';

export class ExpenseResource extends Resource {
    static slug = 'hr/expenses';
    static modelLabel = 'expense';
    static recordTitleAttribute = 'expense_number';
    static hasViewPage = true;

    static infolist(schema: Schema): Schema {
        return schema.components([
            Section.make('Expense Details').columns(3).columnSpanFull().schema([
                TextEntry.make('expense_number').copyable(),
                TextEntry.make('total_amount').money('usd'),
                TextEntry.make('submitted_at').dateTime().placeholder('Not submitted'),
                TextEntry.make('description').columnSpanFull(),
            ]),
        ]);
    }
}
```

Once the View page exists:

- a click on a row of the list table opens the View page instead of the edit page;
- the record title in the edit page breadcrumbs links to the View page;
- [global search](/resources/global-search) results lead to the View page when the user may view the record.

The header of the View page contains an "Edit" button, shown to users who may update the record.

<Aside variant="info">
Unlike Filament, Navette does not display a disabled copy of the form when `infolist()` is not defined: the View page always renders the infolist.
</Aside>

## Viewing records in modals

When a resource has no View page (a [simple resource](/resources/overview#simple-modal-resources), for example), `ViewAction` opens the infolist of the resource in a modal instead of following a link:

```ts
import { EditAction, ViewAction } from '@navette-js/panels';

static table(table: Table): Table {
    return table
        .columns([/* ... */])
        .recordActions([ViewAction.make(), EditAction.make()]);
}
```

When the resource has a View page, the same `ViewAction` is a link to that page.

## Customizing the View page

To customize the page, extend `ViewRecord` and declare it in `pages`:

```ts
import { ViewRecord } from '@navette-js/panels';

class ViewExpense extends ViewRecord {
    // ...
}

export class ExpenseResource extends Resource {
    static pages = { view: ViewExpense };
}
```

The record is read again on every request sent by the page: inside the page, it is available as `this._record`, and its key as `this.recordKey`.

## Authorization

The View page is only available to users who have the `viewAny` ability on the resource and the `view` ability on the record. The check runs on every request sent by the page. See [authorization](/resources/authorization).

## Custom actions

The header of the View page contains an "Edit" button by default. To add actions, override `getHeaderActions()` and keep the edit button with `this.editAction()`:

```ts
import { Action } from '@navette-js/actions';
import { Notification, ViewRecord } from '@navette-js/panels';

class ViewLeaveRequest extends ViewRecord {
    getHeaderActions() {
        return [
            Action.make('approve')
                .color('success')
                .requiresConfirmation()
                .visible(({ record }) => record.status === 'pending')
                .action(async ({ record }) => {
                    await LeaveRequestResource.adapter.update(record.id, { status: 'approved' });
                    Notification.make().success().title('Leave request approved').send();
                }),
            this.editAction(),
        ];
    }
}
```

The actions receive the record of the page as `record`. An action that changes data must still check the rights of the user: see [authorizing custom actions](/resources/authorization#authorizing-custom-actions).

## Relation managers on the View page

The [relation managers](/resources/managing-relationships) of the resource are displayed under the infolist, in tabs, like on the edit page. Their own policy decides what the user may do in them.

## Adding view pages to resource sub-navigation

When the resource declares a [sub-navigation](/resources/overview#resource-sub-navigation), include `'view'` to show the View page in it:

```ts
static recordSubNavigation = ['view', 'edit', 'comments'];
```

<Aside variant="warning">
A resource has a single View page: additional View pages, and per-page relation managers, are not available yet.
</Aside>

## Custom page content

The page renders the schema returned by `contentSchema()`: the infolist, then the relation manager tabs. You may override it, or use the [render hooks](/advanced/render-hooks) of the page, to add content around them.
