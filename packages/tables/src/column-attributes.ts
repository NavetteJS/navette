// Extra HTML attributes of columns, column groups, cells and images (`extraAttributes()`, `extraCellAttributes()`,
// `extraHeaderAttributes()`, `extraImgAttributes()`). Names are checked and values are escaped: a value coming from a record
// cannot break out of its attribute.
import { e } from '@navette-js/support';

export type ExtraAttributes = Record<string, string | number | boolean | null | undefined>;
/** Extra attributes, or a function of the record (and the state item for images) returning them. */
export type ExtraAttributesSource<R> = ExtraAttributes | ((record: R, state?: unknown) => ExtraAttributes | null | undefined);

/** Attribute names written as is: letters, digits and the characters of Alpine / Livewire directives. */
const ATTRIBUTE_NAME = /^[A-Za-z_@:][A-Za-z0-9_.:@\-]*$/;
/** Event handler attributes would run scripts: never written. */
const isEventHandler = (name: string) => /^on/i.test(name);

/** Merges several attribute sets: classes and styles add up, other attributes are replaced. */
export function mergeExtraAttributes(sets: (ExtraAttributes | null | undefined)[]): ExtraAttributes {
    const merged: ExtraAttributes = {};
    for (const set of sets) {
        if (!set || typeof set !== 'object') continue;
        for (const [name, value] of Object.entries(set)) {
            if (name === 'class' && typeof merged.class === 'string' && typeof value === 'string') merged.class = `${merged.class} ${value}`;
            else if (name === 'style' && typeof merged.style === 'string' && typeof value === 'string') merged.style = `${merged.style.replace(/;?\s*$/, ';')} ${value}`;
            else merged[name] = value;
        }
    }
    return merged;
}

/** Resolves a list of attribute sources for a record (functions are called). */
export function resolveExtraAttributes<R>(sources: ExtraAttributesSource<R>[], record: R, state?: unknown): ExtraAttributes {
    return mergeExtraAttributes(sources.map((source) => (typeof source === 'function' ? source(record, state) : source)));
}

/** Splits attributes into classes, style and the other attributes as HTML (escaped). */
export function splitExtraAttributes(attributes: ExtraAttributes): { classes: string[]; style: string | null; html: string } {
    const classes: string[] = [];
    let style: string | null = null;
    const parts: string[] = [];
    for (const [name, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || value === false) continue;
        if (!ATTRIBUTE_NAME.test(name) || isEventHandler(name)) continue;
        if (name === 'class') { classes.push(...String(value).split(/\s+/).filter(Boolean)); continue; }
        if (name === 'style') { style = String(value); continue; }
        parts.push(value === true ? e(name) : `${e(name)}="${e(String(value))}"`);
    }
    return { classes, style, html: parts.join(' ') };
}

/** Attributes as HTML (with their class and style), for a tag that has none of its own. */
export function extraAttributesHtml(attributes: ExtraAttributes): string {
    const { classes, style, html } = splitExtraAttributes(attributes);
    return [html, classes.length ? `class="${e(classes.join(' '))}"` : '', style ? `style="${e(style)}"` : ''].filter(Boolean).join(' ');
}

/**
 * Adds attributes to the first tag of a rendered fragment: classes are appended to its `class`, a style to its `style`, other
 * attributes replace the tag's own ones.
 */
export function mergeIntoFirstTag(html: string, attributes: ExtraAttributes): string {
    const { classes, style, html: rest } = splitExtraAttributes(attributes);
    if (!classes.length && style === null && rest === '') return html;
    const match = /^(\s*<[A-Za-z][A-Za-z0-9-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)(\s*\/?>)/.exec(html);
    if (!match) return html;
    let own = match[2];
    const overridden = new Set(Object.keys(attributes).filter((name) => name !== 'class' && name !== 'style').map((name) => name.toLowerCase()));
    // Attributes set again by the application replace the column's own ones.
    own = own.replace(/\s+([^\s=>/]+)(="[^"]*")?/g, (whole, name: string) => (overridden.has(name.toLowerCase()) ? '' : whole));
    if (classes.length) {
        if (/\sclass="/.test(own)) own = own.replace(/(\sclass=")([^"]*)"/, (_m, start: string, value: string) => `${start}${value}${value ? ' ' : ''}${e(classes.join(' '))}"`);
        else own += ` class="${e(classes.join(' '))}"`;
    }
    if (style !== null) {
        if (/\sstyle="/.test(own)) own = own.replace(/(\sstyle=")([^"]*)"/, (_m, start: string, value: string) => `${start}${value}${value && !/;\s*$/.test(value) ? ';' : ''} ${e(style)}"`);
        else own += ` style="${e(style)}"`;
    }
    return `${match[1]}${own}${rest ? ` ${rest}` : ''}${match[3]}${html.slice(match[0].length)}`;
}
