// Rich content attributes registered on a record (Filament's `HasRichContent`), read by text columns and entries without
// depending on the forms package: any record with `hasRichContentAttribute(name)` and `getRichContentAttribute(name)`.

/** What a column or an entry needs from a registered rich content attribute (`RichContentAttribute` of `@navette-js/forms`). */
export interface RegisteredRichContent {
    toHtml(): Promise<string> | string;
    isEmpty(): boolean;
}

/** The rich content attribute registered on a record under this name, if the record registers one. */
export function getRegisteredRichContent(record: unknown, name: string): RegisteredRichContent | null {
    if (!record || typeof record !== 'object') return null;
    const host = record as { hasRichContentAttribute?: (name: string) => boolean; getRichContentAttribute?: (name: string) => RegisteredRichContent | null };
    if (typeof host.hasRichContentAttribute !== 'function' || typeof host.getRichContentAttribute !== 'function') return null;
    return host.hasRichContentAttribute(name) ? host.getRichContentAttribute(name) ?? null : null;
}

/** HTML of a rendered rich content attribute, sanitized, as the state item of a text column. */
export class RenderedRichContent {
    readonly html: string;
    constructor(html: string) { this.html = html; }
    toString(): string { return this.html; }
}
