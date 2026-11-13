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


You may also pass a function to `alt()`, which receives the **record** and the **state** (the URL of the image), to give each image its own alt text.

## Customizing the size

The default height of the images is `8rem`. You may customize the size by passing a number of pixels, or a CSS length in `px`, `rem`, `em`, `%`, `vh`, `vw` or `ch`, to `imageHeight()` and `imageWidth()`, or to `imageSize()` to set both:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('header_image')
    .imageWidth(200)

ImageEntry.make('header_image')
    .imageHeight('40px')

ImageEntry.make('author.avatar')
    .imageSize(40)
```

```preview
// record: {"author": {"avatar": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}}
ImageEntry.make('author.avatar')
    .imageHeight('40px')
```

Any other value, such as a number in a string without a unit, is ignored: the size is set in a `style` attribute, so only plain lengths are accepted.

### Square images

You may display the image using a 1:1 aspect ratio:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('author.avatar')
    .imageHeight(40)
    .square()
```

```preview
// record: {"author": {"avatar": "https://picsum.photos/id/64/200/300"}}
ImageEntry.make('author.avatar')
    .imageHeight(40)
    .square()
```

The width of a square image is its height, unless you set a width with `imageWidth()`. Optionally, you may pass a boolean value to control if the image should be square or not.

## Circular images

You may make the image fully rounded, which is useful for rendering avatars:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('author.avatar')
    .imageHeight(40)
    .circular()
```

```preview
// record: {"author": {"avatar": "https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb"}}
ImageEntry.make('author.avatar')
    .imageHeight(40)
    .circular()
```

Like square images, circular images are as wide as they are high. Optionally, you may pass a boolean value to control if the image should be circular or not.

## Adding a default image URL

You can display a placeholder image if one doesn't exist yet, by passing a URL to the `defaultImageUrl()` method:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('header_image')
    .defaultImageUrl('/images/default-header.jpg')
```

```preview
// record: {"header_image": null}
ImageEntry.make('header_image')
    .defaultImageUrl('https://picsum.photos/id/1015/1200/400')
```

The default image is also used in place of a state that is not a valid image URL. You may pass a function, which receives the [context object](/schemas/overview#component-utility-injection). Like the state, the default URL must start with `/`, `http://` or `https://`.

To display text instead of an image when the state is empty, use [`placeholder()`](/infolists/overview#adding-placeholder-text-if-an-entry-is-empty).

## Stacking images

You may display multiple images as a stack of overlapping images by using `stacked()`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
```

```preview
// record: {"colleagues": ["https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb", "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a", "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=dc2626"]}
ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
```

Stacked images are `2.5rem` high by default. Optionally, you may pass a boolean value to control if the images should be stacked or not.

### Customizing the stacked ring width

No ring is displayed by default, but you may add one with a width from `0` to `8`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
    .ring(5)
```

### Customizing the stacked overlap

The default overlap is `2`, but you may customize it to be from `0` to `8`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
    .overlap(4)
```

## Setting a limit

You may limit the maximum number of images you want to display by passing `limit()`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
    .limit(3)
```

### Showing the remaining images count

When you set a limit you may also display the count of remaining images by passing `limitedRemainingText()`:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
    .limit(2)
    .limitedRemainingText()
```

```preview
// record: {"colleagues": ["https://ui-avatars.com/api/?name=Ada+Lovelace&color=FFFFFF&background=2563eb", "https://ui-avatars.com/api/?name=Grace+Hopper&color=FFFFFF&background=16a34a", "https://ui-avatars.com/api/?name=Alan+Turing&color=FFFFFF&background=dc2626", "https://ui-avatars.com/api/?name=Katherine+Johnson&color=FFFFFF&background=9333ea"]}
ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
    .limit(2)
    .limitedRemainingText()
```

Optionally, you may pass a boolean value to control if the remaining text should be displayed or not.

#### Customizing the limited remaining text size

By default, the size of the remaining text is `'sm'`. You can customize this to be `'xs'`, `'md'` or `'lg'` using the second argument:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('colleagues')
    .imageHeight(40)
    .circular()
    .stacked()
    .limit(3)
    .limitedRemainingText(true, 'lg')
```

## Adding extra HTML attributes to the image

You can pass extra HTML attributes to the `<img>` element via the `extraImgAttributes()` method. The attributes should be represented by an object, where the key is the attribute name and the value is the attribute value:

```ts
import { ImageEntry } from '@navette-js/infolists';

ImageEntry.make('logo')
    .extraImgAttributes({
        loading: 'lazy',
        title: 'Company logo',
    })
```

Only safe attributes are kept: `class`, `id`, `title`, `loading`, `decoding`, `fetchpriority`, `referrerpolicy`, `crossorigin`, `width`, `height`, `draggable`, `role`, and `data-*` or `aria-*` attributes. Event handlers (`onerror`…), `style`, `src` and `srcset` are ignored, and the values are escaped. Calling `extraImgAttributes()` several times merges the attributes.

<Aside variant="warning">
Not available in Navette yet: separate remaining text (`limitedRemainingTextSeparate()`) and a different URL for each image.
</Aside>
