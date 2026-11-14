/**
 * PHP-compatible `json_encode()` flags, for `CodeEntry.jsonFlags()` (Filament's `jsonFlags(JSON_PRETTY_PRINT | ...)`).
 * The values are PHP's, so flags can be combined with `|`.
 */
export const JsonFlags = {
    HEX_TAG: 1,
    HEX_AMP: 2,
    HEX_APOS: 4,
    HEX_QUOT: 8,
    FORCE_OBJECT: 16,
    UNESCAPED_SLASHES: 64,
    PRETTY_PRINT: 128,
    UNESCAPED_UNICODE: 256,
} as const;

const hex = (char: string) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;

function encodeString(value: string, flags: number): string {
    let out = '"';
    for (const char of value) {
        const code = char.codePointAt(0)!;
        if (char === '"') out += flags & JsonFlags.HEX_QUOT ? '\\u0022' : '\\"';
        else if (char === '\\') out += '\\\\';
        else if (char === '/') out += flags & JsonFlags.UNESCAPED_SLASHES ? '/' : '\\/';
        else if (char === '\n') out += '\\n';
        else if (char === '\r') out += '\\r';
        else if (char === '\t') out += '\\t';
        else if (char === '\b') out += '\\b';
        else if (char === '\f') out += '\\f';
        else if (code < 0x20) out += hex(char);
        else if (char === '<' && flags & JsonFlags.HEX_TAG) out += '\\u003C';
        else if (char === '>' && flags & JsonFlags.HEX_TAG) out += '\\u003E';
        else if (char === '&' && flags & JsonFlags.HEX_AMP) out += '\\u0026';
        else if (char === "'" && flags & JsonFlags.HEX_APOS) out += '\\u0027';
        // Lone surrogates are always escaped; other non-ASCII characters unless UNESCAPED_UNICODE.
        else if (code >= 0xd800 && code <= 0xdfff) out += hex(char);
        else if (code > 0x7f && !(flags & JsonFlags.UNESCAPED_UNICODE)) out += char.length === 2 ? hex(char[0]) + hex(char[1]) : hex(char);
        else out += char;
    }
    return `${out}"`;
}

function encode(value: unknown, flags: number, depth: number, seen: Set<object>): string | undefined {
    if (value && typeof value === 'object' && typeof (value as { toJSON?: unknown }).toJSON === 'function') value = (value as { toJSON: () => unknown }).toJSON();
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : '0';
    }
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'string') return encodeString(value, flags);
    if (typeof value !== 'object') return undefined;
    if (seen.has(value)) throw new TypeError('Cannot encode a circular structure as JSON.');
    seen.add(value);
    const pretty = Boolean(flags & JsonFlags.PRETTY_PRINT);
    const indent = pretty ? `\n${'    '.repeat(depth + 1)}` : '';
    const closing = pretty ? `\n${'    '.repeat(depth)}` : '';
    let entries: string[];
    let asObject: boolean;
    if (Array.isArray(value)) {
        asObject = Boolean(flags & JsonFlags.FORCE_OBJECT);
        entries = value.map((item, index) => {
            const encoded = encode(item, flags, depth + 1, seen) ?? 'null';
            return asObject ? `${encodeString(String(index), flags)}:${pretty ? ' ' : ''}${encoded}` : encoded;
        });
    } else {
        asObject = true;
        entries = [];
        for (const [key, item] of Object.entries(value)) {
            const encoded = encode(item, flags, depth + 1, seen);
            if (encoded !== undefined) entries.push(`${encodeString(key, flags)}:${pretty ? ' ' : ''}${encoded}`);
        }
    }
    seen.delete(value);
    const [open, close] = asObject ? ['{', '}'] : ['[', ']'];
    if (!entries.length) return `${open}${close}`;
    return `${open}${indent}${entries.join(`,${indent}`)}${closing}${close}`;
}

/** Encodes a value like PHP's `json_encode($value, $flags)`; `JsonFlags.PRETTY_PRINT` by default, as in Filament. */
export function encodeJson(value: unknown, flags: number = JsonFlags.PRETTY_PRINT): string {
    return encode(value, flags, 0, new Set()) ?? 'null';
}
