---
title: Prime components
---

## Introduction

Within Navette schemas, prime components are the most basic building blocks that can be used to insert arbitrary content into a schema, such as text and images. As the name suggests, prime components are not divisible and cannot be made simpler. Navette provides a set of built-in prime components:

- [Text](#text-component)
- [Icon](#icon-component)
- [Image](#image-component)
- [Unordered list](#unordered-list-component)
- [Html](#html-component)

You may also [create your own custom components](/schemas/custom-components) to add your own arbitrary content to a schema.

In this example, prime components are being used to display instructions to the user, a QR code that the user can scan, and a list of recovery codes that the user can save:

```ts
import { Image, Section, Text, UnorderedList, type Schema } from '@navette-js/schemas';

const recoveryCodes = ['tYRnCqNLUx-3QOLNKyDiV', 'cKok2eImKc-oWHHH4VhNe', 'C0ZstEcSSB-nrbyk2pv8z'];

schema.components([
    Text.make('Scan this QR code with your authenticator app:')
        .color('neutral'),
    Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
        .imageHeight('12rem')
        .alignCenter(),
    Section.make().schema([
        Text.make('Please save the following recovery codes in a safe place. They will only be shown once.')
            .weight('bold')
            .color('neutral'),
        UnorderedList.make(recoveryCodes.map((code) => Text.make(code)
            .copyable()
            .fontFamily('mono')
            .size('xs')
            .color('neutral')))
            .size('xs'),
    ]),
])
```

```preview
const recoveryCodes = ['tYRnCqNLUx-3QOLNKyDiV', 'cKok2eImKc-oWHHH4VhNe', 'C0ZstEcSSB-nrbyk2pv8z'];

return [
    Text.make('Scan this QR code with your authenticator app:')
        .color('neutral'),
    Image.make('/assets/navette-icon.svg', 'Navette logo')
        .imageHeight('12rem')
        .alignCenter(),
    Section.make().schema([
        Text.make('Please save the following recovery codes in a safe place. They will only be shown once.')
            .weight('bold')
            .color('neutral'),
        UnorderedList.make(recoveryCodes.map((code) => Text.make(code)
            .copyable()
            .fontFamily('mono')
            .size('xs')
            .color('neutral')))
            .size('xs'),
    ]),
]
```

Although text can be rendered in a schema using an [infolist text entry](/infolists/text-entry), entries are intended to render a label-value detail about a record, and not to render arbitrary text. Prime components are more suitable for this purpose.

Prime component classes are exported by `@navette-js/schemas`. They reside within the schema array of components.

## Text component

Text can be inserted into a schema using the `Text` component. Text content is passed to the `make()` method:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Modifying these permissions may give users access to sensitive information.')
```

```preview
Text.make('Modifying these permissions may give users access to sensitive information.')
```

The content is escaped when it is rendered. As well as allowing a static value, the `make()` and `content()` methods also accept a function, which receives the [context object](/schemas/overview#component-utility-injection).

To render raw HTML content, you can pass an `HtmlString` object, created by `raw()` from `@navette-js/support`:

```ts
import { Text } from '@navette-js/schemas';
import { e, raw } from '@navette-js/support';

Text.make(raw(`<strong>Warning:</strong> modifying the permissions of ${e(user.name)} may give them access to sensitive information.`))
```

```preview
Text.make(raw(`<strong>Warning:</strong> modifying the permissions of ${e('Ada Lovelace')} may give them access to sensitive information.`))
```

<Aside variant="danger">
The content of an `HtmlString` is inserted as is. Escape every value that comes from a user or from the database with `e()`, otherwise your application will be vulnerable to XSS attacks.
</Aside>

### Customizing the text color

You may set a color for the text:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Information')
    .color('info')
```

```preview
Text.make('Information')
    .color('info')
```

### Using a neutral color

By default, the text color is set to `gray`, which is typically fairly dim against its background. You can darken it using the `color('neutral')` method:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Modifying these permissions may give users access to sensitive information.')

Text.make('Modifying these permissions may give users access to sensitive information.')
    .color('neutral')
```

```preview
[
    Text.make('Modifying these permissions may give users access to sensitive information.'),
    Text.make('Modifying these permissions may give users access to sensitive information.')
        .color('neutral'),
]
```

### Displaying as a "badge"

By default, text is quite plain and has no background color. You can make it appear as a "badge" instead using the `badge()` method. A great use case for this is with statuses, where you may want to display a badge with a [color](#customizing-the-text-color) that matches the status:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Warning')
    .color('warning')
    .badge()
```

```preview
Text.make('Warning')
    .color('warning')
    .badge()
```

Optionally, you may pass a boolean value or a function to control if the text should be in a badge or not.

#### Adding an icon to the badge

You may add other things to the badge, like an [icon](#icon-component). You may set its position with `iconPosition('after')` and its size with `iconSize()`:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Warning')
    .color('warning')
    .badge()
    .icon('m-exclamation-triangle')
```

```preview
Text.make('Warning')
    .color('warning')
    .badge()
    .icon('m-exclamation-triangle')
```

### Customizing the text size

Text has a small font size by default, but you may change this to `xs`, `md` or `lg`. For instance, you may make the text larger using `size('lg')`:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Modifying these permissions may give users access to sensitive information.')
    .size('lg')
```

```preview
Text.make('Modifying these permissions may give users access to sensitive information.')
    .size('lg')
```

### Customizing the font weight

Text has a regular font weight by default, but you may change this to any of the following options: `thin`, `extralight`, `light`, `medium`, `semibold`, `bold`, `extrabold` or `black`.

For instance, you may make the font bold using `weight('bold')`:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Modifying these permissions may give users access to sensitive information.')
    .weight('bold')
```

```preview
Text.make('Modifying these permissions may give users access to sensitive information.')
    .weight('bold')
```

### Customizing the font family

You can change the text font family to `sans`, `serif` or `mono`. For instance, you may make the font monospaced using `fontFamily('mono')`:

```ts
import { Text } from '@navette-js/schemas';

Text.make('28o.-AK%D~xh*.:[4"3)zPiC')
    .fontFamily('mono')
```

```preview
Text.make('28o.-AK%D~xh*.:[4"3)zPiC')
    .fontFamily('mono')
```

### Adding a tooltip to the text

You may add a tooltip to the text using the `tooltip()` method:

```ts
import { Text } from '@navette-js/schemas';

Text.make('28o.-AK%D~xh*.:[4"3)zPiC')
    .tooltip('Your secret recovery code')
```

### Allowing the text to be copied to the clipboard

You may make the text copyable, such that clicking on it copies the text to the clipboard, and optionally specify a custom confirmation message and duration in milliseconds:

```ts
import { Text } from '@navette-js/schemas';

Text.make('28o.-AK%D~xh*.:[4"3)zPiC')
    .copyable()
    .copyMessage('Copied!')
    .copyMessageDuration(1500)
```

By default, the content of the text is copied. You may copy another value with `copyableState()`.

<Aside variant="warning">
Browsers only allow copying to the clipboard on secure origins, so this feature only works when the panel is served over HTTPS (or on `localhost`). Using JavaScript to determine the content of the text (`js()`) is not available in Navette yet.
</Aside>

## Icon component

Icons can be inserted into a schema using the `Icon` component. The name of the icon is passed to the `make()` method:

```ts
import { Icon } from '@navette-js/schemas';

Icon.make('o-star')
```

```preview
Icon.make('o-star')
```

Navette includes the [Heroicons](https://heroicons.com) set. An icon name is the Heroicons name, prefixed by its style: `o-` for outline (24px), `s-` for solid (24px), `m-` for mini (20px) and `c-` for micro (16px). For example, `o-star`, `s-star`, `m-star` and `c-star`.

<Aside variant="warning">
Rendering an unknown icon name throws an error. Check the name of an icon before using it, especially when it is computed by a function.
</Aside>

### Providing an accessible label

Icons are hidden from assistive technology by default. When an icon conveys information that is not also available as text, you should provide an accessible label using `extraAttributes()`:

```ts
import { Icon } from '@navette-js/schemas';

Icon.make('o-check-circle')
    .extraAttributes({ 'aria-label': 'Verified' })
```

The icon is exposed to assistive technology as an image with the provided label. You may use `aria-labelledby` instead to reference text elsewhere on the page. A [tooltip](#adding-a-tooltip-to-the-icon) is also used as the accessible label when neither attribute is present.

### Customizing the icon color

The default icon color is `primary`. You may set another color for the icon:

```ts
import { Icon } from '@navette-js/schemas';

Icon.make('o-exclamation-circle')
    .color('danger')
```

```preview
Icon.make('o-exclamation-circle')
    .color('danger')
```

### Customizing the icon size

The default icon size is `md`, but you may customize the size to be either `xs`, `sm`, `lg`, `xl` or `2xl`:

```ts
import { Icon } from '@navette-js/schemas';

Icon.make('o-star')
    .size('lg')
```

```preview
Flex.make(['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((size) => Icon.make('o-star').size(size).grow(false)))
```

### Adding a tooltip to the icon

You may add a tooltip to the icon using the `tooltip()` method:

```ts
import { Icon } from '@navette-js/schemas';

Icon.make('o-exclamation-triangle')
    .tooltip('Warning')
```

## Image component

Images can be inserted into a schema using the `Image` component. The image URL and alt text are passed to the `make()` method:

```ts
import { Image } from '@navette-js/schemas';

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
```

```preview
Image.make('/assets/navette-icon.svg', 'Navette logo')
```

As well as allowing static values, the arguments of the `make()` method also accept functions, which receive the [context object](/schemas/overview#component-utility-injection).

Only URLs of your site (starting with `/`) and `http://` or `https://` URLs are rendered: for any other URL, such as a `javascript:` or `data:` URL, the component renders nothing.

### Customizing the image size

You may customize the image size by passing a `imageWidth()` and `imageHeight()`, or both with `imageSize()`. A number is a size in pixels; a string may use `px`, `rem`, `em`, `%`, `vh` or `vw` units. The default height is `8rem`:

```ts
import { Image } from '@navette-js/schemas';

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .imageWidth('12rem')

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .imageHeight('12rem')

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .imageSize(192)
```

Other values are ignored.

### Aligning the image

You may align the image to the start (left in left-to-right interfaces, right in right-to-left interfaces), center, or end (right in left-to-right interfaces, left in right-to-left interfaces) using the `alignStart()`, `alignCenter()` or `alignEnd()` methods:

```ts
import { Image } from '@navette-js/schemas';

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .alignStart() // This is the default alignment.

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .alignCenter()

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .alignEnd()
```

```preview
[
    Image.make('/assets/navette-icon.svg', 'Navette logo')
        .imageHeight('4rem')
        .alignStart(),
    Image.make('/assets/navette-icon.svg', 'Navette logo')
        .imageHeight('4rem')
        .alignCenter(),
    Image.make('/assets/navette-icon.svg', 'Navette logo')
        .imageHeight('4rem')
        .alignEnd(),
]
```

Alternatively, you may pass `'start'`, `'center'` or `'end'` to the `alignment()` method.

### Adding a tooltip to the image

You may add a tooltip to the image using the `tooltip()` method:

```ts
import { Image } from '@navette-js/schemas';

Image.make('/images/qr.png', 'QR code to scan with an authenticator app')
    .tooltip('Scan this QR code with your authenticator app')
    .alignCenter()
```

## Unordered list component

Unordered lists can be inserted into a schema using the `UnorderedList` component. The list items, comprising plain text or [text components](#text-component), are passed to the `make()` method:

```ts
import { UnorderedList } from '@navette-js/schemas';

UnorderedList.make([
    'Tables',
    'Schemas',
    'Actions',
    'Notifications',
])
```

```preview
UnorderedList.make([
    'Tables',
    'Schemas',
    'Actions',
    'Notifications',
])
```

Text components can be used as list items, which allows you to customize the formatting of each item:

```ts
import { Text, UnorderedList } from '@navette-js/schemas';

UnorderedList.make([
    Text.make('Tables').fontFamily('mono'),
    Text.make('Schemas').fontFamily('mono'),
    Text.make('Actions').fontFamily('mono'),
    Text.make('Notifications').fontFamily('mono'),
])
```

```preview
UnorderedList.make([
    Text.make('Tables').fontFamily('mono'),
    Text.make('Schemas').fontFamily('mono'),
    Text.make('Actions').fontFamily('mono'),
    Text.make('Notifications').fontFamily('mono'),
])
```

The items fill two columns from the `sm` breakpoint, column by column. You may change this with `columns()`, which accepts the same values as the [grid system](/schemas/layouts#grid-system).

### Customizing the bullet size

If you are modifying the text size of the list content, you will probably want to adjust the size of the bullets to match. To do this, you can use the `size()` method. Bullets have a small font size by default, but you may change this to `xs`, `md` or `lg`.

For instance, you may make the bullets larger using `size('lg')`:

```ts
import { Text, UnorderedList } from '@navette-js/schemas';

UnorderedList.make([
    Text.make('Tables').size('lg'),
    Text.make('Schemas').size('lg'),
    Text.make('Actions').size('lg'),
    Text.make('Notifications').size('lg'),
])
    .size('lg')
```

```preview
UnorderedList.make([
    Text.make('Tables').size('lg'),
    Text.make('Schemas').size('lg'),
    Text.make('Actions').size('lg'),
    Text.make('Notifications').size('lg'),
])
    .size('lg')
```

## Html component

The `Html` component inserts a fragment of HTML into the schema. You may pass a string, or a function that receives the [context object](/schemas/overview#component-utility-injection) and returns a string:

```ts
import { Html } from '@navette-js/schemas';
import { e } from '@navette-js/support';

Html.make(({ record }) => `<p>Last synchronized with ${e((record as Store).provider)}.</p>`)
```

```preview
// record: {"provider": "Shopify"}
Html.make(({ record }) => `<p>Last synchronized with ${e(record.provider)}.</p>`)
```

<Aside variant="danger">
The HTML is inserted as is, without any escaping or sanitization. Escape every value that comes from a user or from the database with `e()`, otherwise your application will be vulnerable to XSS attacks.
</Aside>

## Adding extra HTML attributes to a prime component

You can pass extra HTML attributes to the component via the `extraAttributes()` method, which will be merged onto its outer HTML element. The attributes should be represented by an object, where the key is the attribute name and the value is the attribute value:

```ts
import { Text } from '@navette-js/schemas';

Text.make('Modifying these permissions may give users access to sensitive information.')
    .extraAttributes({ class: 'custom-text-style' })
```

Calling `extraAttributes()` several times merges the attributes. The `Html` component does not render extra attributes: write them in its HTML.
