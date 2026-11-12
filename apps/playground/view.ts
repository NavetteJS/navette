import ejs from 'ejs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cache = new Map<string, ejs.TemplateFunction>();
/** Rendu synchrone d'une vue EJS compilée une fois (phase 2 du rendu, ADR 0003). */
export function view(name: string, data: Record<string, unknown> = {}): string {
    let fn = cache.get(name);
    if (!fn) {
        const file = fileURLToPath(new URL(`./views/${name}.ejs`, import.meta.url));
        fn = ejs.compile(readFileSync(file, 'utf8'), { filename: file });
        cache.set(name, fn);
    }
    return fn(data);
}
