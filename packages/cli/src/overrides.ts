// Overridable generators: a project changes the files the CLI generates in `navette.generators.ts`, at its root. Its default
// export maps a generator name to a function receiving the generated files (path → content) and the command's context, and
// returning the files to write (it may change their content, rename them, add or drop some):
//
//     export default {
//         resource(files, { model }) {
//             return Object.fromEntries(Object.entries(files).map(([path, content]) => [path, content.replace("'o-rectangle-stack'", "'o-document-text'")]));
//         },
//     };
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GeneratedFiles } from './panel-generators.ts';

/** Generator names, as used in `navette.generators.ts`. */
export const GENERATORS = ['resource', 'page', 'resource-page', 'widget', 'resource-widget', 'panel', 'cluster', 'relation-manager', 'theme', 'migration', 'field', 'entry', 'column', 'schema-component', 'component', 'plugin'] as const;
export type GeneratorName = (typeof GENERATORS)[number];
/** A replacement of a generator: receives the default files and returns those to write. */
export type GeneratorOverride = (files: GeneratedFiles, context: Record<string, unknown>) => GeneratedFiles | Promise<GeneratedFiles>;
export type GeneratorOverrides = Partial<Record<GeneratorName, GeneratorOverride>>;

/** Applies the project's override of a generator, if any. Paths outside the project, or absolute ones, are refused. */
export async function applyGeneratorOverrides(root: string, generator: string, files: GeneratedFiles, context: Record<string, unknown> = {}): Promise<GeneratedFiles> {
    const file = ['navette.generators.ts', 'navette.generators.js', 'navette.generators.mjs'].map((name) => join(root, name)).find((candidate) => existsSync(candidate));
    if (!file) return files;
    const overrides = ((await import(pathToFileURL(file).href)).default ?? {}) as Record<string, GeneratorOverride | undefined>;
    const override = overrides[generator];
    if (typeof override !== 'function') return files;
    const result = await override({ ...files }, context);
    if (!result || typeof result !== 'object') throw new Error(`navette.generators: "${generator}" must return the files to write.`);
    for (const [path, content] of Object.entries(result)) {
        if (typeof content !== 'string') throw new Error(`navette.generators: "${generator}" returned a non-string content for ${path}.`);
        if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes('..')) throw new Error(`navette.generators: "${generator}" returned a path outside the project: ${path}`);
    }
    return result;
}
