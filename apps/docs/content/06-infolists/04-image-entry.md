---
title: Image entry
---

## Introduction

Infolists can render images, based on the URL in the state of the entry:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('header_image')
```

```preview
// record: {"header_image": "https://picsum.photos/id/1018/1200/400"}
ImageEntry.make('header_image')
```

The state must be a URL of your site, starting with `/`, such as `/storage/posts/header.jpg`, or an absolute `http://` or `https://` URL, such as `https://example.com/images/header.jpg`. Any other value, such as a `javascript:` or `data:` URL, is not rendered.

If the state is an array of URLs, every image is rendered.

## Displaying uploaded files

A [file upload](/forms/file-upload) field stores the key of each file, which is a path relative to its storage, such as `posts/4281246003439.jpg`. Since the image entry needs a URL, use `state()` to build the public URL of the file. For example, with files served under `/storage`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('header_image')
    .state(({ record }) => {
        const key = (record as Post).header_image;

        return key ? `/storage/${key.split('/').map(encodeURIComponent).join('/')}` : null;
    })
```

<Aside variant="warning">
Storage disks (`disk()`), visibility and temporary URLs are not available on the image entry in Navette yet: the entry only renders URLs.
</Aside>

## Setting the alt text

You should set descriptive alt text on your images so that screen reader users understand what each image shows. Use the `alt()` method:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('header_image')
    .alt('Article header image')
```

```preview
// record: {"header_image": "https://picsum.photos/id/1018/1200/400"}
ImageEntry.make('header_image')
    .alt('Article header image')
```

If you do not set any alt text, the image is rendered with an empty `alt` attribute, which marks it as decorative for assistive technology. The same alt text is used for every image of the entry.

## Customizing the size

The default height of the images is `8rem`. You may customize it by passing a CSS length in `px`, `rem` or `em` to `imageHeight()`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('author.avatar')
    .imageHeight('40px')
```

```preview
// record: {"author": {"avatar": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}}
ImageEntry.make('author.avatar')
    .imageHeight('40px')
```

Any other value, including a number without a unit, is ignored.

<Aside variant="warning">
`imageWidth()`, `imageSize()` and `square()` are not available on the image entry in Navette yet.
</Aside>

## Circular images

You may make the image fully rounded, which is useful for rendering avatars:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('author.avatar')
    .imageHeight('40px')
    .circular()
```

```preview
// record: {"author": {"avatar": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}}
ImageEntry.make('author.avatar')
    .imageHeight('40px')
    .circular()
```

Optionally, you may pass a boolean value to control if the image should be circular or not.

<Aside variant="warning">
Default image URLs, stacked images, limiting the number of images and extra HTML attributes are not available on the image entry in Navette yet.
</Aside>
