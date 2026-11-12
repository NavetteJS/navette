---
title: Image column
---

## Introduction

Tables can render images, based on the URL in the state of the column:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('avatar_url')
```

```preview
// records: [{"name": "Ada Lovelace", "avatar_url": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}, {"name": "Grace Hopper", "avatar_url": "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a"}, {"name": "Alan Turing", "avatar_url": "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        ImageColumn.make('avatar_url'),
        TextColumn.make('name'),
    ])
```

The state must be a URL: a path on your site starting with a single `/` (such as `/storage/avatars/42.jpg`), or an absolute `http` or `https` URL. Any other value, including a relative path, renders an empty cell.

Images are usually stored somewhere else than in the column itself. Build the URL with `getStateUsing()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make<Product>('image')
    .getStateUsing(({ record }) => (record.image_path ? `/storage/${encodeURI(record.image_path)}` : null))
```

<Aside variant="warning">
Storage disks (`disk()`, `visibility()`) and temporary URLs are not available in image columns: the state is used as the image URL as it is. Make sure the URL points to a file the user may see.
</Aside>

## Setting the alt text

You should set descriptive alt text on your images so that screen reader users understand what each image shows. Pass a function that receives the record to `alt()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make<Product>('image')
    .getStateUsing(({ record }) => record.image_url)
    .alt((record) => record.name)
```

<Aside variant="warning">
Without `alt()`, the image is rendered without an `alt` attribute, and screen readers may announce its URL. When the row is a link, the alt text is also part of the link's accessible name. Always set `alt()`, and return an empty string for a purely decorative image.
</Aside>

## Customizing the size

The default height of images is `2.5rem`. You may customize it by passing a CSS length in `rem`, `px` or `em` to `imageHeight()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('header_image')
    .imageHeight('4rem')
```

```preview
// records: [{"title": "Mountain lake at dawn", "header_image": "https://picsum.photos/id/1018/600/300"}, {"title": "Forest trail", "header_image": "https://picsum.photos/id/1043/600/300"}, {"title": "City lights", "header_image": "https://picsum.photos/id/1067/600/300"}]
new Table()
    .pluralModelLabel('posts')
    .columns([
        ImageColumn.make('header_image').imageHeight('4rem'),
        TextColumn.make('title'),
    ])
```

Any other value is ignored. The width follows the aspect ratio of the image.

## Circular images

You may make the image fully rounded, which is useful for rendering avatars:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('avatar_url')
    .circular()
```

```preview
// records: [{"name": "Ada Lovelace", "avatar_url": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}, {"name": "Grace Hopper", "avatar_url": "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a"}, {"name": "Alan Turing", "avatar_url": "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"}]
new Table()
    .pluralModelLabel('users')
    .columns([
        ImageColumn.make('avatar_url').circular(),
        TextColumn.make('name'),
    ])
```

Optionally, you may pass a boolean value to control if the image should be circular or not:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('avatar_url')
    .circular(settings.roundAvatars)
```

<Aside variant="warning">
Image widths, square images, default image URLs, stacked images, limits and wrapping of multiple images are not available yet.
</Aside>
