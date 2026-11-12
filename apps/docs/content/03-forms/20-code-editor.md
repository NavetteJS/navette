---
title: Code editor
---

## Introduction

The code editor component allows you to write code in a textarea with line numbers. By default, no syntax highlighting is applied. Navette uses [CodeMirror](https://codemirror.net):

```ts
import { CodeEditor } from '@navette-js/forms';

CodeEditor.make('code')
```

The state of the field is a string. When the form is filled, a value that is not a string, such as an object read from a JSON column, is converted to JSON text. On the server, any value that is not a string fails validation.

## Using language syntax highlighting

You may change the language syntax highlighting of the code editor using the `language()` method. The available languages are `cpp`, `css`, `go`, `html`, `java`, `javascript`, `json`, `markdown`, `php`, `python`, `sql`, `xml` and `yaml`:

```ts
import { CodeEditor } from '@navette-js/forms';

CodeEditor.make('code')
    .language('javascript')
```

Passing any other language throws an error when the form is built.

## Allowing lines to wrap

By default, long lines in the code editor will create a horizontal scrollbar. If you would like to allow long lines to wrap instead, you may use the `wrap()` method:

```ts
import { CodeEditor } from '@navette-js/forms';

CodeEditor.make('code')
    .wrap()
```

## Making the field live

The code editor accepts `live()`, `live({ onBlur: true })` and `live({ debounce: 500 })`. See [reactivity](/forms/overview#the-basics-of-reactivity).

<Aside variant="danger">
The code is saved as typed. Never execute it, and escape it when you display it.
</Aside>
