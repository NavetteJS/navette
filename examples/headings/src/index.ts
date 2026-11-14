// Headings: an example standalone plugin for Navette, a schema component usable in any form, infolist or page.
import { readFileSync } from 'node:fs';
import { views } from '@navette-js/support';

views.namespace('headings', new URL('../views', import.meta.url));

const stylesheet = readFileSync(new URL('../resources/headings.css', import.meta.url), 'utf8');

/** The component's stylesheet, as a `<style>` element: add it to a panel with a render hook (`panels::styles.after`). */
export function headingsStylesheet(): string {
    return `<style data-navette-headings>${stylesheet}</style>`;
}

export { Heading } from './Heading.ts';
