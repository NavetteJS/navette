---
title: Configurable resources and pages
---

## Introduction

Sometimes you need to register the same resource or page several times, with different configurations. For example, an "Orders" resource might appear as both "Active orders" and "Archived orders" in the sidebar, each with its own records, navigation label and URL, while sharing the same resource class.

Configurable resources and pages let you register one class several times in a panel, each time with a unique configuration key and its own options. Each registration gets its own routes, navigation item and URL slug, and the class reads the options of the registration being used to adjust its behavior.

<Aside variant="info">
Configurable resources and pages work in any panel: you do not need to build a plugin to use them. They are especially useful for plugins, which can let their users register their resources and pages with their own options.
</Aside>

## Creating a resource configuration class

To make a resource configurable, you first need a configuration class. It extends `ResourceConfiguration`, and defines the options that can vary between registrations:

```ts
import { ResourceConfiguration } from '@navette-js/panels';

export class OrderResourceConfiguration extends ResourceConfiguration {
    protected _isArchived = false;

    archived(condition = true): this {
        this._isArchived = condition;

        return this;
    }

    isArchived(): boolean {
        return this._isArchived;
    }
}
```

The setters return the configuration for chaining, and the getters read the stored values, like the [options of a plugin](/plugins/panel-plugins#configuring-plugins-per-panel).

`ResourceConfiguration` already has these options, applied to the registration's navigation item and pages:

| Method | Option |
| --- | --- |
| `slug()` | URL slug of the registration (see [URL slugs](#url-slugs)) |
| `navigationLabel()` | Label of the navigation item |
| `navigationIcon()` | Icon of the navigation item |
| `navigationGroup()` | Navigation group |
| `navigationSort()` | Position in the navigation |
| `modelLabel()`, `pluralModelLabel()` | Labels of the records (titles, buttons) |

Each option has a getter, which returns `null` when the option was not set: `getSlug()`, `getNavigationLabel()`, `getNavigationIcon()`, `getNavigationGroup()`, `getNavigationSort()`, `getModelLabel()` and `getPluralModelLabel()`. `getKey()` returns the configuration key given to `make()`, and `getResource()` the resource class it configures.

## Linking the configuration class to a resource

Set the static `configurationClass` property of the resource to its configuration class:

```ts
import { Resource } from '@navette-js/panels';
import { OrderResourceConfiguration } from './OrderResourceConfiguration.ts';

export class OrderResource extends Resource {
    static configurationClass = OrderResourceConfiguration;
    static slug = 'orders';

    // ...
}
```

This enables the static `make()` method of the resource, which creates a configuration that can be registered on a panel. Without `configurationClass`, `make()` throws an error.

## Registering configurations on a panel

Register one or more configurations with `make()`. Each configuration needs a unique key:

```ts
import { OrderResource } from './resources/OrderResource.ts';

panel.resources([
    // "Active orders" configuration
    OrderResource.make('active')
        .navigationLabel('Active orders')
        .navigationGroup('Orders'),
    // "Archived orders" configuration
    OrderResource.make('archived')
        .navigationLabel('Archived orders')
        .navigationGroup('Orders')
        .archived(),
]);
```

Each configured registration gets its own routes and navigation item. The configuration key (`'active'`, `'archived'`) identifies the registration: it may contain letters, digits, `-` and `_`, and two registrations of a class in a panel cannot have the same key.

You may also register the resource class on its own alongside its configurations, as a default registration. This is optional: you may register configurations only.

```ts
panel.resources([
    OrderResource, // Optional default registration
    OrderResource.make('active'),
    OrderResource.make('archived').archived(),
]);
```

<Aside variant="tip">
In a [plugin class](/plugins/panel-plugins#configuring-the-panel-with-a-plugin-class), register configurations in the `register()` method instead. See [using configurable resources in a plugin class](#using-configurable-resources-in-a-plugin-class) for a complete example.
</Aside>

### URL slugs

The resource class registered on its own uses its slug: `/orders`.

A configuration's key is appended to the resource's slug: `OrderResource.make('active')` is served at `/orders/active`, and `OrderResource.make('archived')` at `/orders/archived`. Fixed URLs are matched before URLs with a record, so `/orders/archived` is never taken for the view page of a record "archived".

You may use `slug()` to replace the whole slug of a configuration instead of the `<slug>/<key>` pattern:

```ts
OrderResource.make('archived')
    .slug('order-archive') // served at `/order-archive` instead of `/orders/archived`
    .archived(),
```

Two registrations served at the same URL are refused when the panel is served.

## Using the configuration at runtime

Each registration is served by a subclass of the resource, generated when it is registered, which keeps the resource's name and carries its configuration. Inside your resource class, call `this.getConfiguration()` in a static method to read the configuration of the registration. It returns `null` for the default (unconfigured) registration:

```ts
import { Resource } from '@navette-js/panels';
import { TextColumn, type Table } from '@navette-js/tables';

export class OrderResource extends Resource {
    static configurationClass = OrderResourceConfiguration;

    static table(table: Table): Table {
        const configuration = this.getConfiguration();

        return table
            .columns([TextColumn.make('number'), TextColumn.make('total').money('usd')])
            .modifyQueryUsing((query) => configuration?.isArchived() ? query.whereNotNull('archived_at') : query.whereNull('archived_at'));
    }

    // ...
}
```

`this.hasConfiguration()` is a shorthand to check whether a configuration is active:

```ts
if (this.hasConfiguration()) {
    // Running inside a configured registration
}
```

To change other static properties of a registration, override the configuration's `apply()` method. It receives the registration's class before its pages are built:

```ts
import { Resource, ResourceConfiguration } from '@navette-js/panels';

export class OrderResourceConfiguration extends ResourceConfiguration {
    protected _isArchived = false;

    // ...

    apply(resource: typeof Resource): void {
        super.apply(resource);

        if (this._isArchived) {
            resource.navigationIcon = 'o-archive-box';
            resource.policy = { create: () => false };
        }
    }
}
```

During a request for one of the registration's pages (displaying the page, and its updates from the browser), the resource class itself resolves to that registration: `OrderResource.getConfiguration()` returns its configuration, and `OrderResource.getUrl()` its URLs, even when your code names the class instead of using `this`.

`panel.getResourceConfigurations()` returns the configurations registered on a panel, and `panel.getResourceConfiguration(OrderResource, 'archived')` one of them by key.

## Generating URLs for a specific configuration

To generate the URL of a page of a configured registration, pass the `configuration` option in the fourth argument of `getUrl()`, after the record and the other route parameters:

```ts
// URL of the default (unconfigured) registration
OrderResource.getUrl();

// URL of the "active" configuration
OrderResource.getUrl('index', undefined, {}, { configuration: 'active' });

// URL of a specific page of the "archived" configuration
OrderResource.getUrl('edit', order.id, {}, { configuration: 'archived' });
```

Without the option, `getUrl()` uses the active configuration: inside a configured registration (its pages, its static methods), you only need it to link to another configuration. `configuration: null` targets the default registration.

## Configurable pages

Pages follow the same pattern as resources. The differences are:

- The configuration class extends `PageConfiguration` instead of `ResourceConfiguration`. Besides `slug()`, it has `title()`, `navigationLabel()`, `navigationIcon()`, `navigationGroup()` and `navigationSort()`.
  Their getters are `getSlug()`, `getTitle()`, `getNavigationLabel()`, `getNavigationIcon()`, `getNavigationGroup()` and `getNavigationSort()` (`null` when not set); `getKey()` returns the configuration key and `getPage()` the page class.
- You register configurations with `panel.pages()` instead of `panel.resources()`.
- Pages are components: read the configuration in `mount()` or any other method, with `SettingsPage.getConfiguration()`.

```ts
import { Page, PageConfiguration } from '@navette-js/panels';

export class SettingsPageConfiguration extends PageConfiguration {
    protected _settingsCategory = 'general';

    settingsCategory(category: string): this {
        this._settingsCategory = category;

        return this;
    }

    getSettingsCategory(): string {
        return this._settingsCategory;
    }
}

export class SettingsPage extends Page {
    static configurationClass = SettingsPageConfiguration;
    static slug = 'settings';

    settingsCategory = 'general';

    async mount(): Promise<void> {
        const configuration = SettingsPage.getConfiguration();

        if (configuration) {
            this.settingsCategory = configuration.getSettingsCategory();
        }
    }

    // ...
}
```

```ts
panel.pages([
    SettingsPage.make('general')
        .slug('general-settings')
        .settingsCategory('general'),
    SettingsPage.make('advanced')
        .slug('advanced-settings')
        .settingsCategory('advanced'),
]);
```

A page's `getUrl()` returns its URL in the panel of the current request; the `configuration` option targets a registration:

```ts
SettingsPage.getUrl({}, { configuration: 'advanced' }); // "/admin/advanced-settings"
```

Its first argument fills the parameters of the slug (`{record}`), the other values go to the query string. Outside a request, pass the panel: `SettingsPage.getUrl({}, { panel, configuration: 'advanced' })`.

The page's [plugin walkthrough](/plugins/building-a-panel-plugin#step-4-creating-a-configurable-page) shows a complete configurable page.

## Temporarily switching configuration context

You may use `withConfiguration()` to run code in the context of a specific configuration. This is useful to generate URLs or read the options of a registration other than the active one:

```ts
const archivedUrl = OrderResource.withConfiguration('archived', () => OrderResource.getUrl('index'));
```

Inside the function, `OrderResource.getConfiguration()` returns the `archived` configuration. `withConfiguration()` throws an error when the panel has no configuration with this key.

## Using configurable resources in a plugin class

Here is a complete example of a plugin that lets its users register its resource with their own options:

```ts
import { PanelPlugin, type Panel } from '@navette-js/panels';
import { TaskResource, type TaskResourceConfiguration } from './TaskResource.ts';

export class TasksPlugin extends PanelPlugin {
    protected _taskResourceConfigurations: TaskResourceConfiguration[] = [];

    getId(): string {
        return 'tasks';
    }

    taskResources(configurations: TaskResourceConfiguration[]): this {
        this._taskResourceConfigurations = configurations;

        return this;
    }

    register(panel: Panel): void {
        panel.resources([
            TaskResource,
            ...this._taskResourceConfigurations,
        ]);
    }
}
```

The users of the plugin may then register several task lists:

```ts
import { TaskResource, TasksPlugin } from 'navette-tasks';

panel.plugin(
    TasksPlugin.make()
        .taskResources([
            TaskResource.make('my-tasks').ownedByCurrentUser(),
            TaskResource.make('team-tasks').ownedByCurrentTeam(),
        ]),
);
```
