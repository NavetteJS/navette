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

Without `alt()`, the image gets an empty `alt` attribute: screen readers treat it as decorative. When the row is a link, the alt text is also part of the link's accessible name, so set `alt()` whenever the image carries information.

## Customizing the size

The default height of images is `2.5rem` (`2rem` when [stacked](#stacking-images)). You may customize it by passing a CSS length in `rem`, `px`, `em`, `%`, `vh` or `vw`, or a number of pixels, to `imageHeight()`:

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

Any other value is ignored, so that a value cannot inject other CSS into the `style` attribute.

You may also set the width with `imageWidth()`, or both with `imageSize()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('logo')
    .imageWidth(200)

ImageColumn.make('avatar_url')
    .imageSize(48)
```

Without a width, it follows the aspect ratio of the image.

## Square images

You may display the image using a 1:1 aspect ratio:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('avatar_url')
    .imageHeight(40)
    .square()
```

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

## Adding a default image URL

You can display a placeholder image if one doesn't exist yet, by passing a URL to `defaultImageUrl()`. It may also be a function that receives the record:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('avatar_url')
    .defaultImageUrl('/images/default-avatar.png')
```

The same URL rules apply: a path starting with a single `/`, or an `http` or `https` URL.

## Displaying a placeholder

When there is no image and no default image, `placeholder()` displays a text instead:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('avatar_url')
    .placeholder('No avatar')
```

## Displaying multiple images

When the state is an array of URLs, every image is displayed. URLs that are not allowed are skipped.

### Stacking images

You may display multiple images as a stack of overlapping images by using `stacked()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('members')
    .circular()
    .stacked()
```

```preview
// records: [{"name": "Platform", "members": ["https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb", "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a", "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706", "https://ui-avatars.com/api/?name=Linus+T&color=FFFFFF&background=db2777", "https://ui-avatars.com/api/?name=Barbara+L&color=FFFFFF&background=7c3aed"]}, {"name": "Design", "members": ["https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a", "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"]}]
new Table()
    .pluralModelLabel('teams')
    .columns([
        TextColumn.make('name'),
        ImageColumn.make('members').circular().stacked(),
    ])
```

#### Customizing the stacked ring width

A ring separates the stacked images. You may set its width from `0` to `8`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('members')
    .circular()
    .stacked()
    .ring(5)
```

#### Customizing the stacked overlap

The images overlap by `2` by default. You may customize it from `0` to `8`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('members')
    .stacked()
    .overlap(2)
```

### Wrapping multiple images

Images can wrap if they can't fit on one line, by setting `wrap()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('members')
    .circular()
    .stacked()
    .wrap()
```

### Setting a limit

You may limit the maximum number of images you want to display by passing `limit()`:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('members')
    .circular()
    .stacked()
    .limit(3)
```

#### Showing the remaining images count

When you set a limit you may also display the count of remaining images by passing `limitedRemainingText()`. Its second argument sets the size of the text (`xs`, `sm`, `md` or `lg`):

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make('members')
    .circular()
    .stacked()
    .limit(3)
    .limitedRemainingText(true, 'lg')
```

```preview
// records: [{"name": "Platform", "members": ["https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb", "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a", "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706", "https://ui-avatars.com/api/?name=Linus+T&color=FFFFFF&background=db2777", "https://ui-avatars.com/api/?name=Barbara+L&color=FFFFFF&background=7c3aed"]}, {"name": "Design", "members": ["https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a", "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=d97706"]}]
new Table()
    .pluralModelLabel('teams')
    .columns([
        TextColumn.make('name'),
        ImageColumn.make('members').circular().stacked().limit(3).limitedRemainingText(),
    ])
```

## Adding a tooltip

`tooltip()` accepts a text, or a function that receives the record and the image URL:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make<User>('avatar_url')
    .circular()
    .tooltip((record) => record.name)
```

## Adding extra attributes to the images

`extraImgAttributes()` adds HTML attributes to each `<img>` element. It accepts an object, or a function that receives the record and the image URL:

```ts
import { ImageColumn } from '@navette-js/tables';

ImageColumn.make<Product>('photo_url')
    .extraImgAttributes((record) => ({
        loading: 'lazy',
        title: record.name,
    }))
```

Values are escaped. `src`, `srcset` and `alt` cannot be set this way (use the column's state and `alt()`), and event handler attributes such as `onerror` are dropped. Use `extraAttributes()` for the element around the images.
