---
title: Callouts
---

## Introduction

Callouts are used to draw attention to important information or messages. They are often used for alerts, notices, or tips. You can create a callout using the `Callout` component:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('New version available')
    .description('Navette has been released with exciting new features and improvements.')
    .info()
```

```preview
Callout.make('New version available')
    .description('Navette has been released with exciting new features and improvements.')
    .info()
```

As well as allowing static values, the `make()`, `heading()` and `description()` methods also accept functions, which receive the [context object](/schemas/overview#component-utility-injection). The heading and description are escaped when they are rendered.

## Using status variants

Callouts have built-in status variants that automatically set the appropriate icon, icon color, and background color. You can use the `danger()`, `info()`, `success()`, or `warning()` methods:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Payment successful')
    .description('Your order has been confirmed and is being processed.')
    .success()

Callout.make('Session expiring soon')
    .description('Your session will expire in 5 minutes. Save your work to avoid losing changes.')
    .warning()

Callout.make('Connection failed')
    .description('Unable to connect to the server. Please check your internet connection.')
    .danger()
```

```preview
[
    Callout.make('Payment successful')
        .description('Your order has been confirmed and is being processed.')
        .success(),
    Callout.make('Session expiring soon')
        .description('Your session will expire in 5 minutes. Save your work to avoid losing changes.')
        .warning(),
    Callout.make('Connection failed')
        .description('Unable to connect to the server. Please check your internet connection.')
        .danger(),
]
```

The status is also announced to screen reader users before the heading, for example "Note:" for `info()`.

## Removing the background color

By default, status callouts have a colored background. You can remove the background color while keeping the status icon and icon color by using `color(null)`:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Scheduled maintenance')
    .description('The system will be unavailable on Sunday from 2:00 AM to 4:00 AM.')
    .warning()
    .color(null)
```

```preview
Callout.make('Scheduled maintenance')
    .description('The system will be unavailable on Sunday from 2:00 AM to 4:00 AM.')
    .warning()
    .color(null)
```

## Adding a custom icon

You can add a custom icon to the callout using the `icon()` method. Icons are [Heroicons](/schemas/primes#icon-component) names:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Pro tip')
    .description('You can use keyboard shortcuts to navigate faster.')
    .icon('o-light-bulb')
```

```preview
Callout.make('Pro tip')
    .description('You can use keyboard shortcuts to navigate faster.')
    .icon('o-light-bulb')
```

### Changing the icon color

You can change the icon color using the `iconColor()` method:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Pro tip')
    .description('You can use keyboard shortcuts to navigate faster.')
    .icon('o-light-bulb')
    .iconColor('primary')
```

```preview
Callout.make('Pro tip')
    .description('You can use keyboard shortcuts to navigate faster.')
    .icon('o-light-bulb')
    .iconColor('primary')
```

### Changing the icon size

By default, the icon size is `lg`. You can change it to `sm` or `md` using the `iconSize()` method:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Quick note')
    .description('This callout has a smaller icon.')
    .info()
    .iconSize('sm')
```

```preview
Callout.make('Quick note')
    .description('This callout has a smaller icon.')
    .info()
    .iconSize('sm')
```

## Using a custom background color

You can set a custom background color using the `color()` method:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Pro tip')
    .description('You can use keyboard shortcuts to navigate faster.')
    .color('primary')
    .icon('o-light-bulb')
    .iconColor('primary')
```

```preview
Callout.make('Pro tip')
    .description('You can use keyboard shortcuts to navigate faster.')
    .color('primary')
    .icon('o-light-bulb')
    .iconColor('primary')
```

## Adding actions to the callout footer

You can add [actions](/actions/overview) to the callout footer using the `actions()` method. They are rendered as links:

```ts
import { Action } from '@navette-js/actions';
import { Callout } from '@navette-js/schemas';

Callout.make('Your trial ends in 3 days')
    .description('Upgrade now to keep access to all premium features.')
    .warning()
    .actions([
        Action.make('upgrade')
            .label('Upgrade to Pro')
            .url('/billing'),
        Action.make('compare')
            .label('Compare plans')
            .action(async () => {
                // ...
            }),
    ])
```

```preview
Callout.make('Your trial ends in 3 days')
    .description('Upgrade now to keep access to all premium features.')
    .warning()
    .actions([
        Action.make('upgrade')
            .label('Upgrade to Pro')
            .url('/billing'),
        Action.make('compare')
            .label('Compare plans')
            .action(async () => {}),
    ])
```

`footerActions()` is an alias of `actions()`. Calling either of them several times adds the actions to the previous ones.

### Changing the footer actions alignment

By default, actions are aligned to the start. You can change the alignment using the `footerActionsAlignment()` method, passing `'start'`, `'center'`, `'end'` or `'between'`:

```ts
import { Action } from '@navette-js/actions';
import { Callout } from '@navette-js/schemas';

Callout.make('Updates available')
    .description('New features and improvements are ready to install.')
    .info()
    .actions([
        Action.make('install').label('Install now').action(async () => {
            // ...
        }),
        Action.make('later').label('Remind me later').action(async () => {
            // ...
        }),
    ])
    .footerActionsAlignment('end')
```

```preview
Callout.make('Updates available')
    .description('New features and improvements are ready to install.')
    .info()
    .actions([
        Action.make('install').label('Install now').action(async () => {}),
        Action.make('later').label('Remind me later').action(async () => {}),
    ])
    .footerActionsAlignment('end')
```

## Adding custom footer content

You can add custom content to the footer using the `footer()` method. This accepts an array of schema components and actions, and replaces the footer actions:

```ts
import { Action } from '@navette-js/actions';
import { Callout, Text } from '@navette-js/schemas';

Callout.make('Backup complete')
    .description('Your data has been successfully backed up to the cloud.')
    .success()
    .footer([
        Text.make('Last backup: 5 minutes ago')
            .color('gray'),
        Action.make('viewBackups')
            .label('View all backups')
            .url('/backups'),
    ])
```

```preview
Callout.make('Backup complete')
    .description('Your data has been successfully backed up to the cloud.')
    .success()
    .footer([
        Text.make('Last backup: 5 minutes ago')
            .color('gray'),
        Action.make('viewBackups')
            .label('View all backups')
            .url('/backups'),
    ])
```

## Adding control actions to the callout

You can add control [actions](/actions/overview) to the top-right corner of the callout using the `controlActions()` method. For example, you could add a dismiss button that hides the callout. Here, the dismissed state is a public property of a custom page:

```ts
import { Action } from '@navette-js/actions';
import { Page } from '@navette-js/panels';
import { Callout, type Schema } from '@navette-js/schemas';

export class Dashboard extends Page {
    isReleaseCalloutDismissed = false;

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Callout.make('New version available')
                .description('Navette has been released with exciting new features and improvements.')
                .info()
                .controlActions([
                    Action.make('dismiss')
                        .label('Dismiss')
                        .icon('m-x-mark')
                        .iconButton()
                        .color('gray')
                        .action(({ livewire }) => {
                            livewire.isReleaseCalloutDismissed = true;
                        }),
                ])
                .visible(({ livewire }) => !(livewire as Dashboard).isReleaseCalloutDismissed),
        ]);
    }
}
```

```preview
Callout.make('New version available')
    .description('Navette has been released with exciting new features and improvements.')
    .info()
    .controlActions([
        Action.make('dismiss')
            .label('Dismiss')
            .icon('m-x-mark')
            .iconButton()
            .color('gray')
            .action(() => {}),
    ])
```

A control action with `iconButton()` is rendered as an icon button, using its label as its accessible name; other control actions are rendered as small buttons.

## Adding custom control content

You can add custom content to the controls (top-right corner) using the `controls()` method. This accepts an array of schema components and actions:

```ts
import { Action } from '@navette-js/actions';
import { Callout, Text } from '@navette-js/schemas';

Callout.make('Backup complete')
    .description('Your data has been successfully backed up to the cloud.')
    .success()
    .controls([
        Text.make('5 minutes ago').color('gray'),
        Action.make('dismiss')
            .label('Dismiss')
            .icon('m-x-mark')
            .iconButton()
            .color('gray')
            .action(() => {
                // ...
            }),
    ])
```

```preview
Callout.make('Backup complete')
    .description('Your data has been successfully backed up to the cloud.')
    .success()
    .controls([
        Text.make('5 minutes ago'),
        Action.make('dismiss')
            .label('Dismiss')
            .icon('m-x-mark')
            .iconButton()
            .color('gray')
            .action(() => {}),
    ])
```

`controls()` replaces the control actions. Actions are rendered as with `controlActions()`.

## Announcing dynamically revealed callouts

If you reveal a callout dynamically, for example after an action completes, use `extraAttributes()` to make it a live region for assistive technology. Status variants alone do not make a callout a live region:

```ts
import { Callout } from '@navette-js/schemas';

Callout.make('Changes saved')
    .success()
    .extraAttributes({ role: 'status' }) // Use `alert` instead of `status` for urgent messages
```
