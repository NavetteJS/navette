# Third-party notices

Navette is an independent project, not affiliated with or endorsed by the Filament, Livewire or Heroicons projects. It reuses the following works, each under its own license; the full license texts ship next to the files they cover.

| Work | Used for | License | License file |
|---|---|---|---|
| [Filament](https://github.com/filamentphp/filament) © Filament | HTML markup derived from its Blade views, compiled CSS and JavaScript (`@navette-js/panels/dist/filament`), English translations (`@navette-js/support/data`), image editor icons (`@navette-js/support/icons/filament`) | MIT | `packages/panels/dist/FILAMENT-LICENSE.md`, `packages/support/icons/filament/LICENSE.md` |
| [Livewire](https://github.com/livewire/livewire) © Caleb Porzio | Client script `livewire.js` (`@navette-js/wire/vendor`); the server runtime follows its protocol | MIT | `packages/wire/vendor/LIVEWIRE-LICENSE.md` |
| [Heroicons](https://github.com/tailwindlabs/heroicons) | SVG icons (`@navette-js/support/icons`) | MIT | `packages/support/icons/HEROICONS-LICENSE.md` |
| [QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) © Project Nayuki | Structure of the QR Code encoder (`@navette-js/panels`, `qr-code.ts`) | MIT | header of `packages/panels/src/qr-code.ts` |
| [Inter](https://github.com/rsms/inter) © The Inter Project Authors | Default font files (`@navette-js/panels/dist/filament/fonts`) | SIL Open Font License 1.1 | `packages/panels/dist/filament/fonts/INTER-LICENSE.txt` |

Runtime dependencies installed from npm (Express, Knex, Objection, better-sqlite3, Tiptap, EJS, Busboy…) keep their own licenses.
