// Extra HTML attributes of actions (`extraAttributes()`, `extraModalWindowAttributes()`, `extraModalOverlayAttributes()`).
import { e } from '@navette-js/support';

/** Attribute name → value. `true` renders the attribute without value; `false`, `null` and `undefined` are skipped. */
export type ExtraAttributes = Record<string, string | number | boolean | null | undefined>;

const NAME = /^[A-Za-z_:@][A-Za-z0-9_:.@-]*$/;

/** Calls of `extraAttributes(attributes, merge)`: without `merge`, a call replaces the previous ones. */
export function addAttributeSet<T>(sets: T[], attributes: T, merge: boolean): T[] { return merge ? [...sets, attributes] : [attributes]; }

/** Merges several attribute sets: `class` and `style` are concatenated, other attributes are replaced. */
export function mergeAttributeSets(sets: ExtraAttributes[]): ExtraAttributes {
    const out: ExtraAttributes = {};
    for (const set of sets) {
        for (const [name, value] of Object.entries(set ?? {})) {
            if (!NAME.test(name)) throw new Error(`Invalid HTML attribute name: ${name}`);
            if (value === null || value === undefined || value === false) continue;
            if ((name === 'class' || name === 'style') && typeof out[name] === 'string' && typeof value === 'string') out[name] = name === 'class' ? `${out[name]} ${value}` : `${String(out[name]).replace(/;\s*$/, '')}; ${value}`;
            else out[name] = value;
        }
    }
    return out;
}

/** The attributes as HTML (` name="value"`, with a leading space), escaped. */
export function attributesToHtml(attributes: ExtraAttributes): string {
    return Object.entries(attributes).map(([name, value]) => (value === true ? ` ${name}` : value === null || value === undefined || value === false ? '' : ` ${name}="${e(value)}"`)).join('');
}

const ROOT_TAG = /^(\s*<)([A-Za-z][A-Za-z0-9-]*)((?:\s+[^\s=>"']+(?:="[^"]*")?)*)(\s*\/?>)/;
const ATTRIBUTE = /\s+([^\s=>"']+)(?:="([^"]*)")?/g;

/**
 * Merges attributes onto the first element of rendered HTML (the outer element of an action): classes are added after the
 * existing ones (without duplicates), a style is appended, any other attribute replaces the element's own. Idempotent.
 */
export function mergeIntoRootTag(html: string, attributes: ExtraAttributes): string {
    const entries = Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && value !== false);
    if (!entries.length) return html;
    const match = ROOT_TAG.exec(html);
    if (!match) return html;
    // Attributes of the element, in order; values stay as rendered (already escaped).
    const existing: [string, string | null][] = [];
    for (const attribute of match[3].matchAll(ATTRIBUTE)) existing.push([attribute[1], attribute[2] ?? null]);
    for (const [name, value] of entries) {
        if (!NAME.test(name)) throw new Error(`Invalid HTML attribute name: ${name}`);
        const index = existing.findIndex(([existingName]) => existingName === name);
        const escaped = value === true ? null : e(value);
        if (name === 'class' && index >= 0) {
            const classes = (existing[index][1] ?? '').split(/\s+/).filter(Boolean);
            for (const token of String(escaped ?? '').split(/\s+/)) if (token && !classes.includes(token)) classes.push(token);
            existing[index] = [name, classes.join(' ')];
        } else if (name === 'style' && index >= 0) {
            const current = (existing[index][1] ?? '').replace(/;\s*$/, '');
            existing[index] = [name, current.includes(String(escaped)) ? current : [current, escaped].filter(Boolean).join('; ')];
        } else if (index >= 0) existing[index] = [name, escaped];
        else existing.push([name, escaped]);
    }
    const tag = `${match[1]}${match[2]}${existing.map(([name, value]) => (value === null ? ` ${name}` : ` ${name}="${value}"`)).join('')}${match[4]}`;
    return tag + html.slice(match[0].length);
}
