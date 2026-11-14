# Headings for Navette

A heading component for any schema: forms, infolists and page content.

```ts
import { Heading, headingsStylesheet } from 'navette-headings';

Heading.make(2).content('Product information').color('primary');

// Once, for a panel: the component's stylesheet.
panel.renderHook('panels::styles.after', () => headingsStylesheet());
```
