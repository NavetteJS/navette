---
title: Code entry
---

## Introduction

The code entry allows you to present a code snippet in your infolist, in a monospaced block that keeps its line breaks and indentation:

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('code')
    .grammar('php')
```

```preview
// record: {"code": "<?php\n\nfunction greet(string $name): string\n{\n    return \"Hello, {$name}!\";\n}"}
CodeEntry.make('code')
    .grammar('php')
```

The code is escaped when it is rendered.

<Aside variant="warning">
Syntax highlighting is not available yet: the code is displayed in a single color. No server-side highlighter needs to be installed.
</Aside>

## Changing the code's grammar (language)

You may set the grammar (language) of the code using the `grammar()` method, such as `'php'`, `'json'` or `'javascript'`. It is added to the markup as a `language-…` class and a `data-language` attribute, which you may use in your own CSS or JavaScript. The default grammar is `html`:

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('code')
    .grammar('javascript')
```

<Aside variant="tip">
If your code entry's state is an array or an object, it is automatically converted to an indented JSON string, and the grammar is set to `json`. Like PHP's `json_encode()`, the conversion escapes slashes and non-ASCII characters: `é` is displayed as `é`.
</Aside>

## Changing the code's theme (highlighting)

You may set the names of the light and dark themes with the `lightTheme()` and `darkTheme()` methods. They default to `github-light` and `github-dark-high-contrast`:

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('code')
    .lightTheme('dracula')
    .darkTheme('dracula')
```

Since there is no highlighter yet, the theme names are only added to the markup as classes: the colors of the block stay those of the default themes, and setting a theme removes them. Style the classes yourself in your CSS.

## Adding placeholder text if the code is empty

You may display placeholder text when the state is empty, using `placeholder()`:

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('payload')
    .placeholder('No payload')
```

```preview
// record: {"payload": null}
CodeEntry.make('payload')
    .placeholder('No payload')
```

## Allowing the code to be copied to the clipboard

You may make the code copyable, such that clicking on it copies the code to the clipboard, and optionally specify a custom confirmation message and duration in milliseconds. This feature only works when the panel is served over HTTPS (or on `localhost`):

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('code')
    .copyable()
    .copyMessage('Copied!')
    .copyMessageDuration(1500)
```

Optionally, you may pass a boolean value to control if the code should be copyable or not.
