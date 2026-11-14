// Component tags in EJS views: `<x-name …>…</x-name>`, `<x-name … />` and named slots (`<x-slot name="footer">` or `<x-slot:footer>`),
// compiled to plain EJS before the template itself is compiled.
//
// A component's content is captured from the template's output buffer (`__output`, EJS's own variable): the
// generated code remembers where the content starts, cuts it out once it is rendered, and passes it as the slot.

/** One parsed attribute: `name="text"` (a string), `:name="expression"` (JavaScript) or `name` alone (`true`). */
type Attribute = { name: string; value: string; kind: 'string' | 'expression' | 'flag' };

const NAME = /^[A-Za-z0-9_.:-]+/;

/** Escapes a string for a JavaScript string literal placed inside an EJS tag. */
const literal = (value: string) => JSON.stringify(value).replace(/%>/g, '%\\x3e');

function parseAttributes(source: string, tag: string): Attribute[] {
    const attributes: Attribute[] = [];
    let rest = source.trim();
    while (rest) {
        const match = /^(:?)([A-Za-z_@][\w.:@-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'))?/.exec(rest);
        if (!match) throw new Error(`Invalid attribute in <x-${tag}>: ${rest.slice(0, 40)}`);
        const [whole, bound, name, quoted, double, single] = match;
        const value = double ?? single ?? '';
        attributes.push({ name, value, kind: bound ? 'expression' : quoted === undefined ? 'flag' : 'string' });
        rest = rest.slice(whole.length).trim();
    }
    return attributes;
}

/** JavaScript object literal of a tag's attributes, evaluated in the template's scope. */
function propsExpression(attributes: Attribute[]): string {
    return `{ ${attributes.map((attribute) => `${literal(attribute.name)}: ${attribute.kind === 'expression' ? `(${attribute.value})` : attribute.kind === 'flag' ? 'true' : literal(attribute.value)}`).join(', ')} }`;
}

/** Finds the `>` that ends a tag, skipping quoted attribute values. */
function tagEnd(source: string, from: number): number {
    let quote: string | null = null;
    for (let index = from; index < source.length; index++) {
        const char = source[index];
        if (quote) { if (char === quote) quote = null; } else if (char === '"' || char === "'") quote = char; else if (char === '>') return index;
    }
    return -1;
}

/** Rewrites component tags to EJS. Templates without `<x-` are returned unchanged. */
export function compileComponentTags(source: string, file = 'template'): string {
    if (!source.includes('<x-')) return source;
    let out = '<% var __xs = [], __xn = []; %>';
    const open: { name: string; props: string }[] = [];
    let index = 0;
    const capture = '<% __xs.push(__output.length); %>';
    const cut = 'const __s = __output.slice(__xs.pop()); __output = __output.slice(0, __output.length - __s.length);';
    while (index < source.length) {
        const next = source.indexOf('<', index);
        if (next === -1) { out += source.slice(index); break; }
        out += source.slice(index, next);
        // EJS tags (code, output, comments) are copied as they are: a tag quoted in a comment is not a component.
        if (source.startsWith('<%', next)) {
            const ejsEnd = source.indexOf('%>', next + 2);
            if (ejsEnd === -1) { out += source.slice(next); break; }
            out += source.slice(next, ejsEnd + 2);
            index = ejsEnd + 2;
            continue;
        }
        const closing = source.startsWith('</x-', next);
        if (!closing && !source.startsWith('<x-', next)) { out += '<'; index = next + 1; continue; }
        const nameStart = next + (closing ? 4 : 3);
        const name = NAME.exec(source.slice(nameStart))?.[0];
        if (!name) { out += '<'; index = next + 1; continue; }
        const end = tagEnd(source, nameStart + name.length);
        if (end === -1) throw new Error(`${file}: unclosed tag <x-${name}`);
        const body = source.slice(nameStart + name.length, end);
        index = end + 1;
        if (closing) {
            const current = open.pop();
            const closesSlot = name === 'slot' && current?.name.startsWith('slot');
            if (!current || (current.name !== name && !closesSlot)) throw new Error(`${file}: </x-${name}> does not close ${current ? `<x-${current.name}>` : 'any tag'}`);
            if (name === 'slot' || name.startsWith('slot:')) out += `<% { ${cut} __xn[__xn.length - 1][${current.props}] = __s; } %>`;
            else out += `<% { ${cut} const __n = __xn.pop(); %><%- __component(${literal(name)}, ${current.props}, __s, __n) %><% } %>`;
            continue;
        }
        const selfClosing = body.trimEnd().endsWith('/');
        const attributes = parseAttributes(selfClosing ? body.trimEnd().slice(0, -1) : body, name);
        if (name === 'slot' || name.startsWith('slot:')) {
            const slotName = name.startsWith('slot:') ? name.slice(5) : attributes.find((attribute) => attribute.name === 'name')?.value;
            if (!slotName) throw new Error(`${file}: <x-slot> needs a name`);
            if (!open.length) throw new Error(`${file}: <x-slot name="${slotName}"> must be inside a component`);
            // The slot's own attributes (`<x-slot name="trigger" disabled>`) reach the component as `triggerAttributes`.
            const slotAttributes = attributes.filter((attribute) => attribute.name !== 'name');
            if (slotAttributes.length) out += `<% __xn[__xn.length - 1][${literal(`${slotName}::attributes`)}] = ${propsExpression(slotAttributes)}; %>`;
            if (selfClosing) { out += `<% __xn[__xn.length - 1][${literal(slotName)}] = ''; %>`; continue; }
            open.push({ name, props: literal(slotName) });
            out += capture;
            continue;
        }
        const props = propsExpression(attributes);
        if (selfClosing) { out += `<%- __component(${literal(name)}, ${props}, '', {}) %>`; continue; }
        open.push({ name, props });
        out += `<% __xn.push({}); %>${capture}`;
    }
    if (open.length) throw new Error(`${file}: <x-${open[open.length - 1].name}> is never closed`);
    return out;
}

/** Attribute names that go to the component's attribute bag instead of its props (HTML, Alpine and Livewire attributes). */
export const isHtmlAttribute = (name: string) => /^(class|style|id)$/.test(name) || /^(x-|data-|aria-|wire:|@)/.test(name) || name.includes(':');
/** `icon-position` → `iconPosition`. */
export const camel = (name: string) => name.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
