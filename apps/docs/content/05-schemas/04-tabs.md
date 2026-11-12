---
title: Tabs
---

## Introduction

Some schemas can be long and complex. You may want to use tabs to reduce the number of components that are visible at once:

```ts
import { Tab, Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        Tab.make('Tab 1')
            .schema([
                // ...
            ]),
        Tab.make('Tab 2')
            .schema([
                // ...
            ]),
        Tab.make('Tab 3')
            .schema([
                // ...
            ]),
    ])
```

```preview
// state: {"name": "Navette", "url": "https://navette.dev"}
Tabs.make('Settings')
    .schema([
        Tab.make('General').schema([
            TextInput.make('name').required(),
            TextInput.make('url').label('URL').url(),
        ]),
        Tab.make('Notifications').schema([
            Toggle.make('email_notifications'),
        ]),
        Tab.make('Security').schema([
            Toggle.make('two_factor').label('Two-factor authentication'),
        ]),
    ])
```

The label passed to `Tabs.make()` is required: it names the group of tabs for screen readers, and is used to build its key. The tabs are passed to the `schema()` method.

All tabs are rendered with the page, and the browser only shows the active one. The fields of every tab belong to the same form: they are all validated and saved together, even when their tab is not active.

<Aside variant="info">
`@navette-js/panels` also exports a `Tab` class, used for the tabs of a resource's list page. When a file needs both, rename one of them on import: `import { Tab as FormTab, Tabs } from '@navette-js/schemas'`.
</Aside>

## Navigating tabs using the keyboard

You can use Tab to enter the tab headers, then the left and right arrow keys to move focus between available tabs. Home and End focus the first and last available tabs. Moving focus does not change the selected tab; press Enter or Space to select it. Press Tab again to continue to the selected panel.

Hidden tabs are skipped. Tab headers are linked to their panels using IDs built from their keys: use distinct labels for separate sets of tabs in the same schema.

## Setting a tab icon

Tabs may have an icon, which you can set using the `icon()` method. Icons are [Heroicons](/schemas/primes#icon-component) names:

```ts
import { Tab, Tabs } from '@navette-js/schemas';

Tabs.make('Employee')
    .schema([
        Tab.make('Personal')
            .icon('m-user')
            .schema([
                // ...
            ]),
        // ...
    ])
```

## Using grid columns within a tab

You may use the `columns()` method to customize the [grid](/schemas/layouts#grid-system) within the tab:

```ts
import { CheckboxList, TextInput } from '@navette-js/forms';
import { Tab, Tabs } from '@navette-js/schemas';

Tabs.make('Employee')
    .schema([
        Tab.make('Personal')
            .icon('m-user')
            .schema([
                TextInput.make('name').required().maxLength(255),
                TextInput.make('email').required().email(),
                CheckboxList.make('skills')
                    .options([['php', 'PHP'], ['typescript', 'TypeScript']])
                    .columnSpanFull(),
            ])
            .columns(2),
        // ...
    ])
    .columnSpanFull()
```

## Hiding a tab

You may hide a tab using the `hidden()` or `visible()` methods, which accept a boolean or a function that receives the [context object](/schemas/overview#component-utility-injection):

```ts
import { Tab } from '@navette-js/schemas';

Tab.make('Review')
    .hiddenOn('create')
    .schema([
        // ...
    ])
```

A hidden tab is not rendered, and the fields inside it are neither validated nor saved.

<Aside variant="warning">
Setting the default active tab (`activeTab()`), tab badges (`badge()`), the icon position, vertical tabs, removing the styled container, disabling scrolling, persisting the current tab (`persistTab()`, `persistTabInQueryString()`) and lazy loading tab content are not available in Navette yet. The first visible tab is always active when the page loads.
</Aside>
