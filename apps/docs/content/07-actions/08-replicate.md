---
title: Replicate action
---

## Introduction

Navette includes an action that is able to replicate records. You may use it like so:

```ts
import { ReplicateAction } from '@navette-js/panels';

ReplicateAction.make()
```

```preview
ReplicateAction.make()
```

The copy receives all the attributes of the record, except its primary key (`id`) and its `created_at` and `updated_at` timestamps, and is saved with the data adapter of the host. A "Replicated" notification is then sent. The action is only visible for records the user is allowed to `replicate` according to the resource policy.

The action is usually placed in the row actions of a table:

```ts
import { ActionGroup } from '@navette-js/actions';
import { DeleteAction, ReplicateAction } from '@navette-js/panels';

table.recordActions([
    ActionGroup.make([
        ReplicateAction.make()
            .requiresConfirmation(),
        DeleteAction.make(),
    ]),
])
```

```preview
ActionGroup.make([
    ReplicateAction.make()
        .requiresConfirmation(),
    DeleteAction.make(),
])
```

By default, the action runs as soon as it is clicked, without a modal. Chain `requiresConfirmation()` to ask for confirmation first: the modal heading is "Replicate" followed by the record title.

## Excluding attributes

The `excludeAttributes()` method is used to instruct the action which columns should be excluded from replication. Pass it the attributes to leave out, in addition to the primary key and timestamps:

```ts
import { ReplicateAction } from '@navette-js/panels';

ReplicateAction.make()
    .excludeAttributes(['completed_at', 'actual_hours', 'sort'])
```

<Aside variant="warning">
The copy is made from the record as read by the data adapter. If your adapter's query adds computed columns (a joined `project_name`, a counted `comments_count`…), exclude them, or the insert will fail on columns that do not exist in the table.
</Aside>

## Lifecycle hooks

You can use the `before()` and `after()` methods to execute code before and after the replication:

```ts
import { ReplicateAction } from '@navette-js/panels';

ReplicateAction.make()
    .before(async ({ record }) => {
        // Runs before the record is replicated.
    })
    .after(async ({ record }) => {
        // Runs after the record is replicated. `record` is the original record.
    })
```

## Customizing the replication process

You can replace the replication with the `action()` method, for example to change attributes of the copy. This replaces the success notification too:

```ts
import { Notification, ReplicateAction } from '@navette-js/panels';

ReplicateAction.make()
    .action(async ({ record }) => {
        // `toJSON()`: records of an `ObjectionAdapter` are Objection models.
        const { id, created_at, updated_at, ...attributes } = record.toJSON();
        await TaskResource.adapter.create({ ...attributes, title: `${attributes.title} (copy)`, status: 'todo' });
        Notification.make().success().title('Task duplicated').send();
    })
```

<Aside variant="warning">
Editing the copy in a modal form before it is saved, customizing the success notification and redirect URL with dedicated methods, accessing the replica in hooks, and halting the replication process are not available yet.
</Aside>
