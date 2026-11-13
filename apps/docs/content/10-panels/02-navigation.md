---
title: Navigation
---

## Introduction

By default, Navette registers a navigation item for each [resource](/resources/overview) and each custom page of the panel. They are displayed in the sidebar, sorted and grouped by the static properties described below. A resource uses the properties of its [list page](/resources/overview#resource-navigation-items), which it fills from its own `navigationIcon`, `navigationGroup`, `navigationSort` and `navigationBadge`.

An item is active when the current URL is its URL; the item of a resource stays active on the create, edit and View pages of that resource.

## Creating a custom page

A custom page is a class that extends `Page`. Its content is a [schema](/schemas/overview), returned by `contentSchema()`:

```ts
import { TextEntry } from '@navette-js/infolists';
import { Page } from '@navette-js/panels';
import { Html, Section, type Schema } from '@navette-js/schemas';
import { e } from '@navette-js/support';

export class StatusPage extends Page {
    static slug = 'status';
    static title = 'Service status';
    static navigationIcon = 'o-signal';

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('Database').schema([
                TextEntry.make('tasks').label('Tasks').state(async () => String(await Task.query().resultSize())),
            ]),
            // Inserted as is: escape everything that does not come from you.
            Html.make(() => `<p>Checked at ${e(new Date().toLocaleString('en-US'))}</p>`),
        ]);
    }
}
```

Register it on the panel with `pages()`. A `Dashboard` is a page too; it displays the widgets of the panel:

```ts
import { Dashboard } from '@navette-js/panels';

panel.pages([Dashboard, StatusPage]);
```

You may also override `getHeading()`, `getBreadcrumbs()`, `getHeaderActions()`, `getHeaderWidgets()` and `getFooterWidgets()` on a page.

A page is a stateful component: its public properties (those whose name does not start with `_`) travel between the browser and the server. Its methods can only be called from the browser if you name them in `callable`:

```ts
class StatusPage extends Page {
    static callable = ['refreshStatus']; // added to the callable methods of Page

    refreshStatus(): void { /* <button wire:click="refreshStatus"> */ }
}
```

Without it, the call is refused (and reported in the console during development). See [security](/advanced/security#restricting-the-methods-callable-from-the-browser).

## Customizing a navigation item's label

By default, the label of the item is the title of the page. To change it, set `navigationLabel`:

```ts
static navigationLabel = 'Status';
```

For a resource, the label is its plural model label. To change it, set `navigationLabel` on a [custom list page](/resources/overview#customizing-resource-pages).

## Customizing a navigation item's icon

To customize the [icon](/styling/icons) of a navigation item, set `navigationIcon`:

```ts
static navigationIcon = 'o-document-text';
```

The sidebar uses outline icons (`o-` prefix) in Navette's own pages; any Heroicon or [registered icon](/styling/icons#using-custom-svgs-as-icons) works.

## Sorting navigation items

By default, navigation items are sorted by their `navigationSort` value, lowest first. Items with the same value keep their order of registration:

```ts
static navigationSort = 2;
```

The `Dashboard` has a sort of `-2`, so it comes first.

## Adding a badge to a navigation item

To add a badge next to the navigation item, set `navigationBadge`, and its color with `navigationBadgeColor` (`primary` by default):

```ts
static navigationBadge = 'New';
static navigationBadgeColor = 'success';
```

To compute the badge every time the navigation is rendered, define a static `getNavigationBadge()` method, which may be asynchronous:

```ts
export class OrderResource extends Resource {
    static async getNavigationBadge(): Promise<string> {
        return String(await Order.query().where('status', 'new').resultSize());
    }
}
```

On a resource, the badge color comes from the list page: set `navigationBadgeColor` on a [custom list page](/resources/overview#customizing-resource-pages).

## Grouping navigation items

You may group navigation items by specifying a `navigationGroup` property:

```ts
static navigationGroup = 'Shop';
```

All items in the same group are displayed together under the same label. Ungrouped items come first. The groups are sorted in the order given to `navigationGroups()` on the panel, followed by the other groups in the order in which they appear:

```ts
panel.navigationGroups(['Shop', 'HR', 'Projects', 'Blog']);
```

Groups are collapsible: the user may collapse a group by clicking its label, and the choice is remembered by the browser.

### Customizing navigation groups

Pass `NavigationGroup` objects to `navigationGroups()` to give a group an icon, or to prevent it from being collapsed:

```ts
import { NavigationGroup, Panel } from '@navette-js/panels';

Panel.make()
    .navigationGroups([
        NavigationGroup.make('Shop').icon('o-shopping-cart'),
        NavigationGroup.make('Blog').collapsible(false),
        'Settings',
    ])
```

As in Filament, the items of a group with an icon are displayed without their own icons.

<Aside variant="warning">
Nested items, clusters, and the dropdown of a group's items when the sidebar is collapsed to icons are not available yet.
</Aside>

## Collapsible sidebar on desktop

To make the sidebar collapsible on desktop as well as mobile, you can use `sidebarCollapsibleOnDesktop()`. The collapsed sidebar shows the icons of the items:

```ts
panel.sidebarCollapsibleOnDesktop();
```

To let the user hide the sidebar entirely instead, use `sidebarFullyCollapsibleOnDesktop()`.

## Registering custom navigation items

To register new navigation items, you can use `navigationItems()`, with `NavigationItem` objects:

```ts
import { NavigationItem } from '@navette-js/panels';

panel.navigationItems([
    NavigationItem.make('Analytics')
        .url('https://analytics.example.com')
        .icon('o-presentation-chart-line')
        .group('Reports')
        .sort(3),
]);
```

`NavigationItem` also has `badge(value, color)` and `isActiveWhen()`, which receives the current path and decides whether the item is active:

```ts
NavigationItem.make('Reports')
    .url('/reports')
    .isActiveWhen((path) => path.startsWith('/reports'))
```

## Conditionally hiding navigation items

An item is hidden from users who may not open its page: the list page of a resource without the `viewAny` ability, a custom page whose `canAccess()` returns `false`. See [authorization](/resources/authorization).

## Disabling resource or page navigation items

To prevent a page from showing up in the navigation, set `shouldRegisterNavigation` to `false`. The page stays reachable by its URL:

```ts
static shouldRegisterNavigation = false;
```

For a resource, set it on a custom list page.

## Using top navigation

By default, Navette uses a sidebar navigation. You may use a top navigation instead, with a dropdown for each group:

```ts
panel.topNavigation();
```

## Adding sub-navigation to a page

A page may display a sub-navigation: a list of links to related pages, rendered as a column next to the content, or as tabs. Return the items from `getSubNavigation()`:

```ts
import { Page, type SubNavigationItem } from '@navette-js/panels';

export class SalesReport extends Page {
    static slug = 'reports/sales';
    static subNavigationPosition = 'top' as const;

    getSubNavigation(): SubNavigationItem[] {
        return [
            { label: 'Sales', icon: 'o-banknotes', url: this.panel.getUrl('reports/sales'), active: true },
            { label: 'Returns', icon: 'o-arrow-uturn-left', url: this.panel.getUrl('reports/returns'), active: false },
        ];
    }
}
```

The position is `'start'` (before the content, the default), `'end'` (after it) or `'top'` (tabs). On small screens, the sub-navigation becomes a dropdown. Resources build the sub-navigation of their records for you: see [resource sub-navigation](/resources/overview#resource-sub-navigation).

## Customizing the user menu

The user menu is in the topbar, or at the bottom of the sidebar when the panel has no topbar. It contains the profile link (when the [profile page](/panels/users#editing-the-profile) is enabled), the light and dark mode switcher, the [theme picker](/styling/overview#offering-themes-to-users), and the logout button.

To add items, pass actions with a URL to `userMenuItems()`:

```ts
import { Action } from '@navette-js/actions';

panel.userMenuItems([
    Action.make('settings')
        .label('Settings')
        .icon('m-cog-6-tooth')
        .url('/settings'),
    Action.make('docs')
        .label('Documentation')
        .icon('m-book-open')
        .url('https://docs.example.com')
        .openUrlInNewTab(),
]);
```

Items are sorted by their `sort()` value. A negative sort places the item above the light and dark mode switcher, next to the profile link. An item is hidden when its `visible()`, `hidden()` or `authorize()` condition says so.

### Customizing the profile link

To replace the profile link, register an item under the `profile` key:

```ts
panel.userMenuItems({
    profile: Action.make('profile').label('My account').icon('m-user-circle').url('/account').sort(-1),
});
```

### Moving the user menu to the sidebar

```ts
panel.userMenuPosition('sidebar');
```

<Aside variant="warning">
Only actions with a URL are rendered in the user menu: actions that open a modal or send a `POST` request are not available there yet. The logout item cannot be replaced.
</Aside>

## Disabling navigation

You may disable navigation entirely by passing `false` to `navigation()`:

```ts
panel.navigation(false);
```

## Disabling the topbar

You may disable the topbar entirely by passing `false` to `topbar()`. The logo, global search, notifications and user menu move to the sidebar:

```ts
panel.topbar(false);
```

## Breadcrumbs

Resource pages display breadcrumbs: the list, the record when the resource has a [record title attribute](/resources/overview#record-titles), and the current page. A custom page has none by default. To add some, override `getBreadcrumbs()`:

```ts
getBreadcrumbs() {
    return [
        { label: 'Reports', url: this.panel.getUrl('reports') },
        { label: 'Sales', url: null },
    ];
}
```
