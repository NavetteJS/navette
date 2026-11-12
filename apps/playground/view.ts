import ejs from 'ejs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cache = new Map<string, ejs.TemplateFunction>();
/** Renders an EJS view synchronously; each template is compiled once. */
export function view(name: string, data: Record<string, unknown> = {}): string {
    let fn = cache.get(name);
    if (!fn) {
        const file = fileURLToPath(new URL(`./views/${name}.ejs`, import.meta.url));
        fn = ejs.compile(readFileSync(file, 'utf8'), { filename: file });
        cache.set(name, fn);
    }
    return fn(data);
}
