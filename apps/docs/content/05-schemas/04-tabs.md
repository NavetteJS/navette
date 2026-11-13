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

## Setting the default active tab

The first tab will be open by default. You can change the default open tab using the `activeTab()` method:

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
    .activeTab(2)
```

```preview
// state: {"name": "Navette", "email_notifications": true}
Tabs.make('Settings')
    .schema([
        Tab.make('General').schema([
            TextInput.make('name'),
        ]),
        Tab.make('Notifications').schema([
            Toggle.make('email_notifications'),
        ]),
    ])
    .activeTab(2)
```

The number is the position of the tab among the visible tabs, starting at 1. As well as allowing a static value, the `activeTab()` method also accepts a function, which receives the [context object](/schemas/overview#component-utility-injection). An invalid value opens the first tab.

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

### Setting the tab icon position

The icon of the tab may be positioned before or after the label using the `iconPosition()` method:

```ts
import { Tab, Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        Tab.make('Notifications')
            .icon('m-bell')
            .iconPosition('after')
            .schema([
                // ...
            ]),
        // ...
    ])
```

```preview
// state: {"name": "Navette", "email_notifications": true}
Tabs.make('Settings')
    .schema([
        Tab.make('General').icon('m-cog-6-tooth').iconPosition('after').schema([
            TextInput.make('name'),
        ]),
        Tab.make('Notifications').icon('m-bell').iconPosition('after').schema([
            Toggle.make('email_notifications'),
        ]),
    ])
```

## Setting a tab badge

Tabs may have a badge, which you can set using the `badge()` method:

```ts
import { Tab, Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        Tab.make('Notifications')
            .badge(5)
            .schema([
                // ...
            ]),
        // ...
    ])
```

```preview
// state: {"name": "Navette", "email_notifications": true}
Tabs.make('Settings')
    .schema([
        Tab.make('General').schema([
            TextInput.make('name'),
        ]),
        Tab.make('Notifications').badge(5).schema([
            Toggle.make('email_notifications'),
        ]),
        Tab.make('Security').badge('New').badgeColor('success').schema([
            Toggle.make('two_factor'),
        ]),
    ])
```

As well as allowing a static value, the `badge()` method also accepts a function, which receives the context object. A tab whose badge is `null` or an empty string has no badge. The badge is escaped when it is rendered.

If you'd like to change the color for a badge (`primary` by default), you can use the `badgeColor()` method:

```ts
import { Tab, Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        Tab.make('Notifications')
            .badge(5)
            .badgeColor('info')
            .schema([
                // ...
            ]),
        // ...
    ])
```

You may also add an icon to the badge with `badgeIcon()` (and place it after the number with `badgeIconPosition('after')`), and a plain-text tooltip with `badgeTooltip()`:

```ts
import { Tab } from '@navette-js/schemas';

Tab.make('Notifications')
    .badge(5)
    .badgeIcon('m-bell')
    .badgeTooltip('Unread notifications')
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

## Disabling scrollable tabs

Tabs are rendered horizontally by default, and are scrollable when they exceed the available width.

You may disable scrolling using the `scrollable(false)` method:

```ts
import { Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        // ...
    ])
    .scrollable(false)
```

When tabs are not scrollable, the component automatically detects the available width. If not all tabs can fit, a dropdown button will appear. Any tabs that exceed the available width will be grouped inside this dropdown automatically.

The dropdown is a visual presentation of the same tab headers, not a separate menu. Arrow keys, Home, and End navigate all available tabs. Focusing an overflowed tab automatically opens the dropdown and displays that tab's focus indicator. Press Enter or Space to select it; the dropdown remains open while you navigate its tabs. Press Tab to leave the headers and close the dropdown. Escape closes it without changing selection and returns focus to an inline tab, or to the selected panel if every tab is overflowed. You can also click the dropdown button to reveal the overflowed tabs.

## Using vertical tabs

You can render the tabs vertically by using the `vertical()` method:

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
    .vertical()
```

```preview
// state: {"name": "Navette", "email_notifications": true, "two_factor": false}
// viewport: 1100
Tabs.make('Settings')
    .schema([
        Tab.make('General').schema([
            TextInput.make('name'),
        ]),
        Tab.make('Notifications').schema([
            Toggle.make('email_notifications'),
        ]),
        Tab.make('Security').schema([
            Toggle.make('two_factor'),
        ]),
    ])
    .vertical()
```

Optionally, you can pass a boolean value, or a function receiving the context object, to the `vertical()` method to control if the tabs should be rendered vertically or not:

```ts
import { Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        // ...
    ])
    .vertical(settings.verticalTabs)
```

## Removing the styled container

By default, tabs and their content are wrapped in a container styled as a card. You may remove the styled container using `contained(false)`:

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
    .contained(false)
```

```preview
// state: {"name": "Navette", "email_notifications": true}
Tabs.make('Settings')
    .schema([
        Tab.make('General').schema([
            TextInput.make('name'),
        ]),
        Tab.make('Notifications').schema([
            Toggle.make('email_notifications'),
        ]),
    ])
    .contained(false)
```

As well as allowing a static value, the `contained()` method also accepts a function, which receives the context object.

## Persisting the current tab in the user's browser

By default, the current tab is not persisted in the browser's local storage. You can change this behavior using the `persistTab()` method:

```ts
import { Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        // ...
    ])
    .persistTab()
```

The key of the tabs, built from their label, is used as the key in the local storage to store the current tab. If several sets of tabs in your application share a label and should not share their current tab, give them distinct `key()`s:

```ts
import { Tabs } from '@navette-js/schemas';

Tabs.make('Settings')
    .schema([
        // ...
    ])
    .persistTab()
    .key('order-tabs')
```

Optionally, the `persistTab()` method accepts a boolean value, or a function receiving the context object, to control if the active tab should persist or not. A stored tab is only selected when it is still one of the visible tabs; otherwise, the [default active tab](#setting-the-default-active-tab) is opened.

## Persisting the current tab in the URL's query string

By default, the current tab is not persisted in the URL's query string. You can change this behavior using the `persistTabInQueryString()` method:

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
    .persistTabInQueryString()
```

When enabled, the current tab is persisted in the URL's query string using the `tab` key, so a link to the page can open a given tab. The value is the key of the tab, such as `tab-2::data::tab`. You can change the query string key by passing it to the `persistTabInQueryString()` method:

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
    .persistTabInQueryString('settings-tab')
```

A value of the query string that is not the key of a visible tab is ignored, both when the page is rendered and in the browser.

<Aside variant="warning">
Lazy loading tab badges and tabs without content panels are not available in Navette yet. The content of a tab can be [lazy loaded](/schemas/overview#lazy-loading-a-child-schema) with `Tab.make('…').lazyLoaded()`: it loads when the tab is opened.
</Aside>
