// Layout components "teleporting" their fields into a singular relationship of the form's record (`relationship()` on a
// Group, Section, Fieldset…): a has-one or belongs-to relationship of an Objection model, loaded when the form is filled
// and saved (created, updated or deleted) once the record is saved.
import { evaluate, type Lazy } from '@navette-js/support';
import type { Component, ComponentContext, Schema } from './index.ts';
import { readStatePath, writeStatePath } from './component-state.ts';

type Data = Record<string, unknown>;
type DataHook = ((args: { data: Data; record: any; ctx: ComponentContext }) => Data | Promise<Data>) | null;
export type SingularRelationshipOptions = {
    /** Whether the relationship is saved; `false` deletes the related record if it exists. Receives the related `state`. */
    condition?: Lazy<boolean, ComponentContext & { state: Data | null }>;
    /** Related model used to create the record (by default the relationship's related model class). */
    relatedModel?: Lazy<any, ComponentContext>;
};
export type SingularRelationshipConfig = {
    name: string;
    condition: Lazy<boolean, ComponentContext & { state: Data | null }>;
    relatedModel: Lazy<any, ComponentContext>;
    beforeFill: DataHook;
    beforeCreate: DataHook;
    beforeSave: DataHook;
};

export const makeSingularRelationship = (name: string, options: SingularRelationshipOptions = {}): SingularRelationshipConfig => ({
    name, condition: options.condition ?? true, relatedModel: options.relatedModel ?? null, beforeFill: null, beforeCreate: null, beforeSave: null,
});

/** Objection model of the form: the host's data adapter, or the model of the parent relationship layout. */
function ownerModelOf(component: Component): any {
    let parent = component.container.getParentComponent() as any;
    while (parent) {
        const relationship = parent.getSingularRelationship?.() as SingularRelationshipConfig | null | undefined;
        if (relationship) return relationInfoOf(parent).related;
        parent = parent.container?.getParentComponent?.() ?? null;
    }
    const host = component.livewire as any;
    const adapter = host.getDataAdapter?.() ?? host.getDataAdapterForTable?.() ?? host.resource?.adapter ?? null;
    const model = adapter?.model;
    if (typeof model !== 'function' || typeof model.getRelation !== 'function') throw new Error('relationship(): the form has no Objection model to read the relationship from.');
    return model;
}
function relationInfoOf(component: Component): { model: any; relation: any; related: any; isBelongsTo: boolean } {
    const config = (component as any).getSingularRelationship() as SingularRelationshipConfig;
    const model = ownerModelOf(component);
    const relation = model.getRelation(config.name);
    const kind = String(relation?.constructor?.name ?? '');
    if (/Many/.test(kind)) throw new Error(`relationship(): [${config.name}] is not a singular relationship (has-one or belongs-to).`);
    return { model, relation, related: relation.relatedModelClass, isBelongsTo: /BelongsTo/.test(kind) };
}
/** Record the relationship is read from: the record of the form (or of the parent relationship layout). */
async function ownerRecordOf(component: Component, record: any): Promise<any> {
    const parent = component.container.getParentComponent() as any;
    let node = parent;
    while (node) {
        if (node.getSingularRelationship?.()) return node.getRelatedRecord(record);
        node = node.container?.getParentComponent?.() ?? null;
    }
    return record;
}

/** The existing related record, or `null`. */
export async function getRelatedRecord(component: Component, record: any): Promise<any> {
    const owner = await ownerRecordOf(component, record);
    if (!owner) return null;
    const { model } = relationInfoOf(component);
    const config = (component as any).getSingularRelationship() as SingularRelationshipConfig;
    const loaded = owner[config.name];
    if (loaded && typeof loaded === 'object') return loaded;
    const key = owner[model.idColumn];
    if (key === null || key === undefined) return null;
    return (await model.relatedQuery(config.name).for(key).first()) ?? null;
}

/** Flat state components of a schema (fields), with their path relative to the schema. */
function stateComponentsOf(schema: Schema): { component: any; path: string }[] {
    const base = schema.getStatePath();
    return schema.getFlatComponents().filter((c: any) => typeof c.hydrateState === 'function' && c.hasStatePath()).map((component: any) => {
        const full = component.getStatePath();
        return { component, path: base && full.startsWith(`${base}.`) ? full.slice(base.length + 1) : full };
    });
}

/** State of the layout's fields, read from the related record (each field shapes its value with `hydrateState()`). */
export async function loadSingularRelationshipState(component: Component, record: any): Promise<Data> {
    const config = (component as any).getSingularRelationship() as SingularRelationshipConfig;
    const related = await getRelatedRecord(component, record);
    let data: Data = related ? { ...related } : {};
    if (related && config.beforeFill) data = await config.beforeFill({ data, record: related, ctx: component.context() });
    const state: Data = {};
    const [schema] = (component as any).getChildSchemas() as Schema[];
    for (const { component: field, path } of stateComponentsOf(schema)) {
        const value = readStatePath(data, path);
        writeStatePath(state, path, field.hydrateState(value === undefined || value === null ? field.getDefaultState() : value));
    }
    return state;
}

/**
 * Saves the related record: deleted when the condition is false, updated when it exists, created otherwise (a belongs-to
 * relationship then links the record of the form to it). `data` is the dehydrated state of the layout's fields.
 */
export async function saveSingularRelationship(component: Component, record: any, data: Data): Promise<void> {
    const config = (component as any).getSingularRelationship() as SingularRelationshipConfig;
    const owner = await ownerRecordOf(component, record);
    if (!owner) return;
    const ctx = component.context();
    const { model, related: relatedClass, isBelongsTo } = relationInfoOf(component);
    const existing = await getRelatedRecord(component, record);
    const key = owner[model.idColumn];
    if (!(await evaluate(config.condition, { ...ctx, state: data }))) {
        if (!existing) return;
        if (isBelongsTo) await model.relatedQuery(config.name).for(key).unrelate();
        await (existing.constructor?.query ? existing.constructor : relatedClass).query().deleteById(existing[(existing.constructor?.idColumn ?? relatedClass.idColumn)]);
        if (owner[config.name] !== undefined) owner[config.name] = null;
        return;
    }
    if (existing) {
        const values = config.beforeSave ? await config.beforeSave({ data, record: existing, ctx }) : data;
        const target = existing.constructor?.query ? existing.constructor : relatedClass;
        if (Object.keys(values).length) await target.query().findById(existing[target.idColumn]).patch(values);
        Object.assign(existing, values);
        return;
    }
    const values = config.beforeCreate ? await config.beforeCreate({ data, record: null, ctx }) : data;
    const createClass = (await evaluate(config.relatedModel, ctx)) ?? relatedClass;
    if (isBelongsTo) {
        const created = await createClass.query().insertAndFetch(values);
        await model.relatedQuery(config.name).for(key).relate(created[createClass.idColumn]);
        if (owner[config.name] !== undefined) owner[config.name] = created;
        return;
    }
    const created = await model.relatedQuery(config.name).for(key).insert(values);
    if (owner[config.name] !== undefined) owner[config.name] = created;
}
