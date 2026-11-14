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

Instead of a schema, the content may be an EJS view with [UI components](/components/overview): see [rendering a page with a view](/resources/custom-pages#rendering-a-page-with-a-view). Run `npx navette make:page Settings` to generate a page class.

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

For a resource, the label is its plural model label. To change it, set `navigationLabel` on the resource.

A label is escaped. To render HTML in a navigation item or a [navigation group](#grouping-navigation-items), pass an `HtmlString` (from `@navette-js/support`) instead of a string. Never build it from user input without escaping that input yourself:

```ts
import { HtmlString } from '@navette-js/support';

NavigationItem.make(new HtmlString('Reports <span class="fi-badge fi-size-xs">beta</span>'))
```

Tooltips, the `aria-label` of a collapsed sidebar and the group keys remembered by the browser use the label's text, without its tags.

## Customizing a navigation item's icon

To customize the [icon](/styling/icons) of a navigation item, set `navigationIcon`:

```ts
static navigationIcon = 'o-document-text';
```

The sidebar uses outline icons (`o-` prefix) in Navette's own pages; any Heroicon or [registered icon](/styling/icons#using-custom-svgs-as-icons) works.

### Switching navigation item icon when it is active

To use another icon while the item is active, set `activeNavigationIcon` (on a page or a resource), or call `activeIcon()` on a custom `NavigationItem`:

```ts
static navigationIcon = 'o-document-text';
static activeNavigationIcon = 's-document-text';
```

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

On a resource, `navigationBadge`, `navigationBadgeColor` and these methods are declared on the resource itself; they are passed to its list page, which owns the navigation item.

To compute the color from the badge value, define a static `getNavigationBadgeColor(badge)` method on the page or the resource. It receives the value of the badge (from `navigationBadge` or `getNavigationBadge()`):

```ts
export class OrderResource extends Resource {
    static async getNavigationBadge(): Promise<string> {
        return String(await Order.query().where('status', 'new').resultSize());
    }

    static getNavigationBadgeColor(badge: string | number | null): string {
        return Number(badge) > 10 ? 'danger' : 'primary';
    }
}
```

### Badge tooltips

To show a tooltip when the badge is hovered, set `navigationBadgeTooltip`, or define a static `getNavigationBadgeTooltip(badge)` method that receives the badge value:

```ts
static navigationBadgeTooltip = 'The number of new orders';
```

A custom `NavigationItem` takes it with `badgeTooltip()`, which also accepts a function of the badge value.

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

### Collapsing navigation groups by default

`collapsed()` makes a group start collapsed, the first time the user opens the panel. Afterwards, the browser remembers which groups the user collapsed (in `localStorage`, under `filament:sidebar:collapsed_groups`, shared by every panel of the site, as in Filament):

```ts
NavigationGroup.make('Settings').collapsed()
```

### Making navigation groups not collapsible

By default, every group can be collapsed. To change that for all the groups of the panel, use `collapsibleNavigationGroups(false)`; a group that calls `collapsible()` or `collapsed()` stays collapsible:

```ts
panel.collapsibleNavigationGroups(false);
```

### Adding extra HTML attributes to navigation groups

`extraSidebarAttributes()` adds attributes to the group's element in the sidebar, and `extraTopbarAttributes()` to its dropdown in the [top navigation](#using-top-navigation):

```ts
NavigationGroup.make('Shop')
    .extraSidebarAttributes({ class: 'shop-group' })
    .extraTopbarAttributes({ 'data-group': 'shop' })
```

### Registering navigation groups with an enum

The groups may come from an [enum](/advanced/enums): pass the enum to `navigationGroups()`, and one of its cases to `navigationGroup`. The groups are sorted in the order of the cases, and each case gives its label and its icon. The `collapsed` and `collapsible` keys of a case play the role of `collapsed()` and `collapsible()`:

```ts
import { defineEnum } from '@navette-js/support';

export const NavigationArea = defineEnum({
    shop: { label: 'Shop', icon: 'o-shopping-cart' },
    settings: { label: 'Settings', icon: 'o-cog-6-tooth', collapsed: true },
});

panel.navigationGroups(NavigationArea);

export class OrderResource extends Resource {
    static navigationGroup = NavigationArea.from('shop');
}
```

`NavigationGroup.fromEnum(NavigationArea.from('shop'))` builds the group of a case, for instance to give it extra attributes.

### Nesting navigation items

An item may be shown below another item of its group: set `navigationParentItem` to the label of that item, on a page or a resource:

```ts
export class RefundResource extends Resource {
    static navigationGroup = 'Shop';
    static navigationParentItem = 'Orders';
}
```

The child items are shown while their parent, or one of them, is active. A parent item without a URL always shows them. A custom item takes its children with `childItems()`:

```ts
NavigationItem.make('Reports')
    .icon('o-chart-bar')
    .childItems([
        NavigationItem.make('Sales').url('/reports/sales'),
        NavigationItem.make('Returns').url('/reports/returns'),
    ])
```

An item whose parent is not in its group is not shown. In the [top navigation](#using-top-navigation), an item with children forms a list of its own in the group's dropdown.

To gather many pages under a single item with their own sub-navigation, use a [cluster](/panels/clusters).

## Collapsible sidebar on desktop

To make the sidebar collapsible on desktop as well as mobile, you can use `sidebarCollapsibleOnDesktop()`. The collapsed sidebar shows the icons of the items:

```ts
panel.sidebarCollapsibleOnDesktop();
```

To let the user hide the sidebar entirely instead, use `sidebarFullyCollapsibleOnDesktop()`.

## Changing the width of the sidebar

`sidebarWidth()` sets the width of the sidebar (`20rem` by default), and `collapsedSidebarWidth()` its width when it is collapsed to icons (`4.5rem`). They take a CSS length:

```ts
panel
    .sidebarWidth('16rem')
    .collapsedSidebarWidth('5rem');
```

### Navigation group dropdowns in a collapsed sidebar

When the sidebar is collapsed to icons, a [navigation group with an icon](#customizing-navigation-groups) is shown as its icon. Clicking it opens a dropdown listing the group's items, with their own icons and badges; an item with [child items](#nesting-navigation-items) forms a separate list with them. Hovering the icon shows the group's label.

The items of a group without an icon are shown as their icons, with their label in a tooltip.

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

`NavigationItem` also has `badge(value, color)`, `badgeTooltip()`, `activeIcon()` and `isActiveWhen()`, which receives the current path and decides whether the item is active:

```ts
NavigationItem.make('Reports')
    .url('/reports')
    .isActiveWhen((path) => path.startsWith('/reports'))
```

To open the URL in a new tab, pass `true` as the second argument of `url()`, or call `openUrlInNewTab()`:

```ts
NavigationItem.make('Status page')
    .url('https://status.example.com', true)
```

`extraAttributes()` adds HTML attributes to the item's element.

## Conditionally hiding navigation items

An item is hidden from users who may not open its page: the list page of a resource without the `viewAny` ability, a custom page whose `canAccess()` returns `false`. See [authorization](/resources/authorization).

A custom `NavigationItem` is shown or hidden with `visible()` and `hidden()`, which take a boolean or a function evaluated when the navigation is rendered. The function receives `{ user, panel }`. A group whose items are all hidden is not shown:

```ts
NavigationItem.make('Analytics')
    .url('https://analytics.example.com')
    .visible(({ user }) => user?.role === 'admin')
```

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

The position is `'start'` (before the content, the default), `'end'` (after it) or `'top'` (tabs). On small screens, the sub-navigation becomes a dropdown. Items with a `group` are gathered under its label: a column of the sidebar, or a dropdown among the tabs. An item may also have a `badge` and a `badgeColor`. Resources build the sub-navigation of their records for you: see [resource sub-navigation](/resources/overview#resource-sub-navigation).

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

### Customizing the logout item

The `logout` key works the same way. A function receives the default item, an action sending a `POST` request to the logout route, and changes it:

```ts
panel.userMenuItems({
    logout: (action) => action.label('Sign out').icon('m-arrow-left-start-on-rectangle'),
});
```

An action registered under the key replaces the item entirely, for instance to send the user to your own logout page:

```ts
panel.userMenuItems({
    logout: Action.make('logout').label('Sign out').url('/sso/logout').color('danger'),
});
```

The `profile` key also accepts a function.

### Grouping user menu items

The items of one call go into the same list of the dropdown. To separate them into groups, pass a list of groups, each one a list of actions or an object of actions by key. `ActionGroup` items are rendered as a group of their own:

```ts
import { Action, ActionGroup } from '@navette-js/actions';

panel.userMenuItems([
    [
        Action.make('settings').label('Settings').url('/settings'),
        Action.make('billing').label('Billing').url('/billing'),
    ],
    [ActionGroup.make([
        Action.make('help').label('Help').url('/help'),
        Action.make('status').label('Status').url('https://status.example.com').openUrlInNewTab(),
    ])],
]);
```

The logout item stays last.

### Opening a modal or sending a `POST` request from the user menu

Any [action](/actions/overview) can be an item. An action without a URL runs on the server, and may open a [modal](/actions/modals) first: the topbar (or the sidebar, when the menu is there) mounts it as a page mounts its actions. An action with `postToUrl()` sends a `POST` request with the CSRF token to its URL, instead of following a link:

```ts
panel.userMenuItems([
    Action.make('feedback')
        .label('Send feedback')
        .icon('m-chat-bubble-left-right')
        .schema([Textarea.make('message').required()])
        .action(({ data }) => {
            Notification.make().success().title('Thank you').send();
        }),
    Action.make('lockSession')
        .label('Lock session')
        .url('/lock')
        .postToUrl(),
]);
```

Only registered items can be mounted: the browser cannot mount an item that is hidden, or that only has a URL.

### Moving the user menu to the sidebar

```ts
panel.userMenuPosition('sidebar');
```

Every kind of item (links, `POST` items, modal actions, groups) works in both positions. `userMenu(true, 'sidebar')` does the same.

### Disabling the user menu

```ts
panel.userMenu(false);
```

### Disabling the theme switcher

The light, dark and system buttons of the user menu are removed with `themeSwitcher(false)`. The [default theme mode](/styling/overview) still applies:

```ts
panel.themeSwitcher(false);
```

## Building the navigation by hand

To control the whole navigation, pass a function to `navigation()`. It receives a `NavigationBuilder` and `{ user, panel }`, and returns the builder. Registered pages and resources are no longer added by themselves: their `getNavigationItems()` static method gives their items, which keep their hidden state (a page the user may not open is left out):

```ts
import { NavigationBuilder, NavigationGroup, NavigationItem } from '@navette-js/panels';

panel.navigation((builder: NavigationBuilder, { user }) => builder
    .items([...Dashboard.getNavigationItems()])
    .group('Shop', [
        ...OrderResource.getNavigationItems(),
        ...ProductResource.getNavigationItems(),
    ])
    .groups([
        NavigationGroup.make('Links').collapsed().items([
            NavigationItem.make('Status page').url('https://status.example.com', true),
        ]),
    ])
    .when(user?.role === 'admin', (builder) => builder.item(NavigationItem.make('Logs').url('/logs'))));
```

`items()` and `item()` add ungrouped items, `group(label, items, collapsible)` and `groups()` add groups, in the order of the calls.

## Disabling navigation

You may disable navigation entirely by passing `false` to `navigation()`:

```ts
panel.navigation(false);
```

## Replacing the sidebar and the topbar

The sidebar and the topbar are components (`Sidebar` and `Topbar`, exported by `@navette-js/panels`). To change them, extend them and register your class with `sidebarLivewireComponent()` or `topbarLivewireComponent()`. `getViewData()` gives what their view receives:

```ts
import { Sidebar } from '@navette-js/panels';

class CustomSidebar extends Sidebar {
    async getViewData() {
        return { ...(await super.getViewData()), brand: { name: 'Acme', logo: null, darkLogo: null, height: '1.5rem' } };
    }
}

panel.sidebarLivewireComponent(CustomSidebar);
```

### Refreshing the sidebar and the topbar

They render again when they receive the `refresh-sidebar` or `refresh-topbar` event, for instance after a change that affects a badge. Dispatch it from a component on the server, or from the browser:

```ts
this.dispatch('refresh-sidebar');
```

```html
<button x-on:click="$dispatch('refresh-topbar')">Refresh</button>
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

### Showing the navigation hierarchy in breadcrumbs

With `true` as the second argument of `breadcrumbs()`, the breadcrumbs start with the position of the page (or of its resource or cluster) in the navigation: its group and its [parent item](#nesting-navigation-items), followed by the page's own breadcrumbs, or its title when it has none:

```ts
panel.breadcrumbs(true, true);
```

### Disabling breadcrumbs

```ts
panel.breadcrumbs(false);
```
