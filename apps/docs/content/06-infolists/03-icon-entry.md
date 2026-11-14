---
title: Icon entry
---

## Introduction

Icon entries render an icon representing the state of the entry. You may pass a map of state values to [Heroicons names](/schemas/primes#icon-component) to the `icon()` method:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('status')
    .icon({
        draft: 'o-pencil',
        reviewing: 'o-clock',
        published: 'o-check-circle',
    })
```

```preview
// record: {"status": "reviewing"}
IconEntry.make('status')
    .icon({
        draft: 'o-pencil',
        reviewing: 'o-clock',
        published: 'o-check-circle',
    })
```

The `icon()` method also accepts a function, which receives the **record** and the **state**, and returns a name or `null` for no icon, or a single name for every value:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('status')
    .icon((record, state) => (state === 'published' ? 'o-check-circle' : 'o-pencil'))
```

When there is no icon for the state, nothing is displayed. If the state is an array, an icon is displayed for each value.

Screen readers announce the state itself, such as "reviewing", or the [tooltip](/infolists/overview#adding-a-tooltip-to-an-entry) when the entry has one.

When the attribute is cast to an [enum](/advanced/enums#enum-icons) on the model, or with `enum()`, the icon and color of each value come from the enum, and screen readers announce its label.

## Customizing the color

You may change the color of the icon, using the `color()` method. Like `icon()`, it accepts a color name, a map of state values to colors, or a function of the record and the state:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('status')
    .icon({
        draft: 'o-pencil',
        reviewing: 'o-clock',
        published: 'o-check-circle',
    })
    .color({
        draft: 'info',
        reviewing: 'warning',
        published: 'success',
    })
```

```preview
// record: {"status": "published"}
IconEntry.make('status')
    .icon({
        draft: 'o-pencil',
        reviewing: 'o-clock',
        published: 'o-check-circle',
    })
    .color({
        draft: 'info',
        reviewing: 'warning',
        published: 'success',
    })
```

Icons are gray by default. The shade of the color is chosen to keep enough contrast with the background, in the light and dark themes.

## Customizing the size

The default icon size is `'lg'`, but you may customize the size to be `'xs'`, `'sm'`, `'md'`, `'xl'` or `'2xl'`:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('status')
    .icon('o-flag')
    .size('md')
```

```preview
// record: {"status": "flagged"}
IconEntry.make('status')
    .icon('o-flag')
    .size('md')
```

The `size()` method also accepts a function of the record and the state.

## Handling booleans

Icon entries can display a check or "X" icon based on the state of the entry, either true or false, using the `boolean()` method:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('is_visible')
    .label('Visibility')
    .boolean()
```

```preview
// record: {"is_visible": true, "is_featured": false}
// viewport: 1100
Grid.make(4).schema([
    IconEntry.make('is_visible').label('Visibility').boolean(),
    IconEntry.make('is_featured').label('Featured').boolean(),
])
```

The check icon is green (`success`) and the "X" icon is red (`danger`). Screen readers announce "Yes" or "No".

The state is true when it is `true`, `1` or `'1'`, as stored by SQL databases. Any other value, such as `'yes'`, is displayed as false. When the state is `null`, nothing is displayed.

Optionally, you may pass a boolean value to the `boolean()` method to control if the icon should be boolean or not.

### Customizing the boolean icons

You may customize the icon representing each state:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('is_featured')
    .boolean()
    .trueIcon('o-check-badge')
    .falseIcon('o-x-mark')
```

```preview
// record: {"is_featured": true, "is_archived": false}
// viewport: 1100
Grid.make(4).schema([
    IconEntry.make('is_featured').trueIcon('o-check-badge').falseIcon('o-x-mark'),
    IconEntry.make('is_archived').trueIcon('o-check-badge').falseIcon('o-x-mark'),
])
```

Pass `false` to display no icon for that state. These methods enable `boolean()`.

### Customizing the boolean colors

You may customize the icon color representing each state:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('is_featured')
    .boolean()
    .trueColor('info')
    .falseColor('warning')
```

```preview
// record: {"is_featured": true, "is_archived": false}
// viewport: 1100
Grid.make(4).schema([
    IconEntry.make('is_featured').trueColor('info').falseColor('warning'),
    IconEntry.make('is_archived').trueColor('info').falseColor('warning'),
])
```

A color or an icon set with `color()` or `icon()` takes precedence over the boolean ones.

## Listing multiple icons

If the state is an array, the icons are displayed side by side. You may display them on separate lines with `listWithLineBreaks()`:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('checks')
    .boolean()
    .listWithLineBreaks()
```

By default, icons wrap to the next line when they exceed the width of the container. You can disable this behavior using `wrap(false)`.
