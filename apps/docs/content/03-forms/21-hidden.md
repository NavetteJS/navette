---
title: Hidden
---

## Introduction

The hidden component allows you to create a hidden field in your form that holds a value:

```ts
import { Hidden } from '@navette-js/forms';

Hidden.make('token')
```

The field renders an `<input type="hidden">` bound to its state. It has no label, and takes no space in the form's grid.

Please be aware that the value of a hidden field is still editable by the user if they decide to use the browser's developer tools. You should not use this component to store sensitive or read-only information. Validate it like any other field, and recompute on the server any value the user must not change.
