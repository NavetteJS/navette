// Schemas a panel component accepts uploads for (Filament's `RestrictsFileUploadsToSchemaComponents`): its named
// schemas (`formSchema()`, `infolistSchema()`, `contentSchema()`, any `<name>Schema(schema)` builder) and the forms of
// its mounted actions.
import type { Schema } from '@navette-js/schemas';

/** Methods ending in `Schema` that are not schema builders. */
const NOT_BUILDERS = /^(get|load|fill|apply|call|render|mount|is|has|set|reset|validate|refresh|update|updated|updating|save|make|build|cache|resolve|find|handle|on)[A-Z]|^(fill|apply|get|load|build|make|render|validate|save|reset)Schema$/;

/** Names `<name>` of the `<name>Schema(schema)` builders of a component, along its prototype chain. */
export function schemaBuilderNames(component: object): string[] {
    const names = new Set<string>();
    for (let proto = Object.getPrototypeOf(component); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            const match = /^([a-z][A-Za-z0-9]*)Schema$/.exec(key);
            if (!match || NOT_BUILDERS.test(key)) continue;
            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            if (descriptor && typeof descriptor.value === 'function') names.add(match[1]);
        }
    }
    return [...names];
}

type UploadHost = {
    getSchema(name: string): Schema | Promise<Schema>;
    getMountedActionSchema(index: number): Promise<Schema | null>;
    mountedActions: unknown[];
};

/** Every schema of a panel component that may hold an upload field. A schema that fails to build is skipped. */
export async function fileUploadSchemasOf(component: UploadHost): Promise<Schema[]> {
    const schemas: Schema[] = [];
    for (const name of schemaBuilderNames(component)) {
        try { schemas.push(await component.getSchema(name)); } catch { /* not buildable without more context */ }
    }
    for (let index = 0; index < (component.mountedActions?.length ?? 0); index++) {
        try { const schema = await component.getMountedActionSchema(index); if (schema) schemas.push(schema); } catch { /* action no longer available */ }
    }
    return schemas;
}
