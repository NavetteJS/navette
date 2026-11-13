---
title: Clusters
---

## Introduction

A cluster gathers pages and resources under a single navigation item. Opening it shows its first page, with the other pages of the cluster in a [sub-navigation](/panels/navigation#adding-sub-navigation-to-a-page). The pages of a cluster are served under its URL: `/settings/profile`, `/settings/users`.

Clusters keep a large panel's menu short: the settings of an application, the reference data of a shop…

## Creating a cluster

A cluster is a class extending `Cluster`. It is a page: it takes the same navigation properties (`navigationIcon`, `navigationGroup`, `navigationSort`, `navigationLabel`):

```ts
import { Cluster } from '@navette-js/panels';

export class SettingsCluster extends Cluster {
    static navigationIcon = 'o-cog-6-tooth';
    static navigationSort = 90;
}
```

Its title and its navigation label default to the class name without "Cluster" ("Settings"); its URL segment is the same name in kebab case (`settings`). Set `slug` to change it.

## Adding pages and resources to a cluster

Set `cluster` on a page or a resource, and register it as usual: the cluster is registered with it.

```ts
import { Page, Resource } from '@navette-js/panels';

export class ProfileSettings extends Page {
    static slug = 'profile';
    static cluster = SettingsCluster;
}

export class UserResource extends Resource {
    static slug = 'users';
    static cluster = SettingsCluster;
}

panel.pages([ProfileSettings]).resources([UserResource]);
```

The page is served at `settings/profile` and the resource at `settings/users`: `UserResource.getUrl()` and `panel.getUrl()` take this into account. The menu shows the cluster, active on all of its pages, instead of its pages.

The sub-navigation lists the pages the user may open, sorted by `navigationSort`, and gathered by `navigationGroup`. On a resource, it is shown on the list page; the create, edit and view pages keep their own [record sub-navigation](/resources/overview#resource-sub-navigation). A cluster none of whose pages the user may open is hidden from the menu and answers 403.

## Customizing the sub-navigation position

The sub-navigation is a column before the content by default. Set `subNavigationPosition` on the cluster to change it for all of its pages:

```ts
export class SettingsCluster extends Cluster {
    static subNavigationPosition = 'top' as const;
}
```

A page of the cluster may still set its own. To show no sub-navigation at all, set `shouldRegisterSubNavigation` to `false` on the cluster.

## Customizing the cluster breadcrumb

The breadcrumbs of the cluster's pages start with a link to the cluster, labelled with its title. Change the label with `clusterBreadcrumb`:

```ts
static clusterBreadcrumb = 'Configuration';
```
