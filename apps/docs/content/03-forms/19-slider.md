---
title: Slider
---

## Introduction

The slider component allows you to drag a handle across a track to select one or more numeric values. Like Filament, Navette uses [noUiSlider](https://refreshless.com/nouislider):

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
```

Like in Filament, a slider is required by default: an empty value fails validation. Use `required(false)` to allow it. Its default value is its minimum value.

## Controlling the range of the slider

The minimum and maximum values that can be selected by the slider are 0 and 100 by default. You can adjust these with the `range()` method, or with `minValue()` and `maxValue()`:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .range(40, 80)
```

The bounds are checked on the server.

### Controlling the step size

By default, users can select any decimal value between the minimum and maximum. You can restrict the values to a specific step size using the `step()` method. A step of `1` requires a whole number; any other step requires a multiple of it, checked on the server:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .range(0, 100)
    .step(10)
```

### Limiting the number of decimal places

If you would rather allow the user to select any decimal value between the minimum and maximum instead of restricting them to a step size, you can define a number of decimal places that their selected values will be rounded to using the `decimalPlaces()` method. The saved value is rounded too:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .range(0, 1)
    .decimalPlaces(2)
```

### Controlling the behavioral padding of the track

By default, users can select any value across the entire length of the track. You can add behavioral padding to the track using the `rangePadding()` method, which ensures that the selected value is always at least a certain distance from the edges of the track. Pass a number for both edges, or `[start, end]`:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .range(0, 100)
    .rangePadding([10, 20])
```

In this example, even though the minimum value is 0 and the maximum value is 100, the user can only select values between 10 and 80. The server applies the same limits.

### Right-to-left tracks

You may make the track go from right to left with `rtl()`.

## Adding multiple values to a slider

If the slider is set to a list of values, the user will be able to drag multiple handles across the track within the allowed range. Set a list as the default value:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('price_range')
    .range(0, 1000)
    .default([200, 800])
```

Each value of the list is validated. Store the list in a JSON column.

## Using a vertical track

You can display the slider as a vertical track instead of a horizontal one using the `vertical()` method. A vertical track goes from top to bottom by default; use `rtl(false)` to make it go from bottom to top:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .vertical()
    .rtl(false)
```

## Adding tooltips to handles

You can add tooltips to the handles of the slider using the `tooltips()` method. The tooltip displays the current value of the handle:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .tooltips()
```

### Custom tooltip formatting

You can use JavaScript to customize the formatting of a tooltip. Pass a `RawJs` object to the `tooltips()` method, containing a JavaScript string expression to use. The current value to format is available in the `$value` variable:

```ts
import { RawJs, Slider } from '@navette-js/forms';

Slider.make('slider')
    .tooltips(RawJs.make('`$${$value.toFixed(2)}`'))
```

<Aside variant="danger">
A `RawJs` expression is inserted in the page as is. Only write it yourself: never build it from a value coming from a user or from the database.
</Aside>

### Controlling tooltips for multiple handles individually

If the slider has multiple values, you can pass a list of booleans or `RawJs` objects to `tooltips()`, one per handle:

```ts
import { RawJs, Slider } from '@navette-js/forms';

Slider.make('slider')
    .default([20, 70])
    .tooltips([true, RawJs.make('`$${$value.toFixed(2)}`')])
```

## Filling a track with color

By default, the track is not filled. You can fill segments of the track using the `fillTrack()` method, passing one boolean per segment. Without argument, it fills the segment before the handle, `[true, false]`:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .default([20, 70])
    .fillTrack([false, true, false])
```

## Adding pips to tracks

You can add pips to the track using the `pips()` method. Pips are small markers, labeled with values:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .pips()
```

`pips()` uses the `range` mode by default, which places pips at the minimum and maximum. You may pass another mode (`steps`, `positions`, `count`, `values`) and a density, or use `pipsMode()` and `pipsDensity()`:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .pips('steps', 5)
```

With the `positions`, `count` and `values` modes, set the positions, count or values with `pipsValues()`:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .pipsMode('values')
    .pipsValues([5, 25, 50, 75, 95])
    .steppedPips()
```

`steppedPips()` rounds the pips to the slider's steps.

### Custom pip label formatting

Similar to tooltips, you can customize the formatting of pip labels by passing a `RawJs` object to `pipsFormatter()`. The value is available in `$value`:

```ts
import { RawJs, Slider } from '@navette-js/forms';

Slider.make('slider')
    .pips()
    .pipsFormatter(RawJs.make('`$${$value.toFixed(2)}`'))
```

### Manually filtering pips

`pipsFilter()` receives a `RawJs` expression of `$value`, which returns the type of pip to display: `-1` for none, `0` for a pip without label, `1` for a large pip, `2` for a small pip:

```ts
import { RawJs, Slider } from '@navette-js/forms';

Slider.make('slider')
    .pips('steps')
    .pipsFilter(RawJs.make('$value % 50 === 0 ? 1 : ($value % 10 === 0 ? 2 : -1)'))
```

## Setting a minimum difference between handles

To set a minimum distance between handles, you can use the `minDifference()` method, passing a number:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .default([20, 70])
    .minDifference(10)
```

## Setting a maximum difference between handles

To set a maximum distance between handles, you can use the `maxDifference()` method, passing a number:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .default([20, 70])
    .maxDifference(40)
```

<Aside variant="warning">
`minDifference()` and `maxDifference()` are only enforced in the browser. If the difference matters, also add a [custom rule](/forms/validation#custom-rules).
</Aside>

## Controlling the general behavior of the slider

The `behavior()` method controls how the user interacts with the track. It accepts a noUiSlider behavior (`tap`, `drag`, `fixed`, `snap`, `unconstrained`, `smooth-steps`…), or a list of them. The default is `tap`; `behavior(null)` disables all behaviors:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .default([20, 70])
    .behavior(['drag', 'smooth-steps'])
```

## Non-linear tracks

You can create a non-linear track with `nonLinearPoints()`, which maps percentages of the track to values:

```ts
import { Slider } from '@navette-js/forms';

Slider.make('slider')
    .range(0, 10000)
    .nonLinearPoints({ '20%': 500, '50%': 4000, '70%': 8000 })
```

## Making the field live

The slider accepts `live()`, `live({ onBlur: true })` and `live({ debounce: 500 })`. See [reactivity](/forms/overview#the-basics-of-reactivity).
