---
title: Icon entry
---

## Introduction

Icon entries render an icon representing the state of the entry. In Navette, icon entries display booleans:

```ts
import { IconEntry } from '@navette-js/infolists';

IconEntry.make('is_active')
    .boolean()
```

```preview
// record: {"is_active": true}
IconEntry.make('is_active')
    .boolean()
```

<Aside variant="warning">
Choosing the icon from the state with `icon()`, customizing the color (`color()`) and the size (`size()`) of the icon are not available in Navette yet. Without `boolean()`, an icon entry renders nothing. To display a status with an icon, use a [text entry badge with an icon](/infolists/text-entry#adding-an-icon-to-the-badge), or a [custom entry](/infolists/custom-entries).
</Aside>

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

<Aside variant="warning">
Customizing the boolean icons (`trueIcon()`, `falseIcon()`) and colors (`trueColor()`, `falseColor()`) is not available in Navette yet.
</Aside>
