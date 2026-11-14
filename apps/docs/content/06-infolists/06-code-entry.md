---
title: Code entry
---

## Introduction

The code entry allows you to present a highlighted code snippet in your infolist. It uses [Shiki](https://shiki.style) to highlight the code on the server, with TextMate grammars and VS Code themes:

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

To highlight the code, install the [`shiki`](https://www.npmjs.com/package/shiki) package in your application. Navette does not include it by default, so that you choose its major version yourself (major versions can have different grammars and themes), and so that applications without code entries do not install it. It is loaded the first time a code entry is rendered:

```bash
npm install shiki
```

Without Shiki, the code is displayed in a single color, with the background and text colors of the default themes. The same happens when the grammar or a theme is not one of Shiki's.

## Changing the code's grammar (language)

You may change the grammar (language) of the code using the `grammar()` method. Over 200 grammars are available: see [Shiki's list of languages](https://shiki.style/languages), whose identifiers and aliases are accepted, such as `'php'`, `'json'`, `'javascript'` or `'ts'`. The grammar is also added to the markup as a `language-…` class and a `data-language` attribute. The default grammar is `html`:

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('code')
    .grammar('javascript')
```

<Aside variant="tip">
If your code entry's state is an array or an object, it is automatically converted to an indented JSON string, and the grammar is set to `json`. Like PHP's `json_encode()`, the conversion escapes slashes and non-ASCII characters: `é` is displayed as `é`.
</Aside>

## Changing the code's theme (highlighting)

You may change the theme of the code using the `lightTheme()` and `darkTheme()` methods. Over 50 themes are available: see [Shiki's list of themes](https://shiki.style/themes). They default to `github-light` and `github-dark-high-contrast`. To use the popular Dracula theme in both modes:

```ts
import { CodeEntry } from '@navette-js/infolists';

CodeEntry.make('code')
    .lightTheme('dracula')
    .darkTheme('dracula')
```

```preview
// record: {"code": "const greet = (name) => `Hello, ${name}!`;\n\nconsole.log(greet('Navette'));"}
CodeEntry.make('code')
    .grammar('javascript')
    .lightTheme('dracula')
    .darkTheme('dracula')
```

Both themes are rendered in the markup: each token carries its light color as a `color` style, and its dark color as a `--phiki-dark-color` CSS variable, which the dark mode uses. Switching between light and dark mode does not need another request.

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
