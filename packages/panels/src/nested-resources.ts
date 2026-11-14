// Nested resources (Filament's `$parentResource`): a resource served under a record of its parent resource
// (`/projects/{project}/tasks/{record}/edit`), every query scoped to that parent record.
//
// The pages of a nested resource are generated subclasses of the usual record pages. On every request (display and browser
// updates alike) they reload each parent record from the URL key kept in their locked state, through the parent's own
// (scoped) adapter: a key of a record that does not belong to the parent, or that the parent's scope (tenant...) hides,
// answers 404. The page then works on a copy of the resource whose adapter is scoped to the parent record and whose URLs
// carry the parent keys, so the generic pages (form, delete, redirects, breadcrumbs) need no special case.
import type { DataAdapter } from '@navette-js/database';
import type { Table } from '@navette-js/tables';
import { WireError } from '@navette-js/wire';
import type { ManageRelatedRecords, Page, PanelContext, RelationManager, Resource, User } from './index.ts';

const pluralOf = (s: string) => (/[^aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(s) ? s + 'es' : s + 's');
const camelOf = (s: string) => s.trim().replace(/[\s_-]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase());
const snakeOf = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
const kebabOf = (s: string) => snakeOf(s).replace(/_/g, '-');
const titleCaseOf = (s: string) => s.split(' ').map((word) => word.replace(/^./, (c) => c.toUpperCase())).join(' ');
/** A resource, or a function returning it (`() => ProjectResource`) when a circular import would leave it undefined at that point. */
export type ResourceReference = typeof Resource | (() => typeof Resource);
/** The resource of a reference: a resource class is returned as is, a function is called. */
export function resolveResourceReference(reference: ResourceReference | null | undefined): typeof Resource | null {
    if (!reference) return null;
    // A class has a prototype (with `asParent`, inherited from Resource); an arrow function has none.
    return typeof (reference as any).prototype === 'object' && typeof (reference as any).asParent === 'function' ? (reference as typeof Resource) : (reference as () => typeof Resource)();
}
/** Route parameter names that the panel already uses. */
const RESERVED_PARAMETERS = new Set(['record', 'tenant', 'page', 'path']);
/** Longest record key accepted from a URL. */
const MAX_KEY_LENGTH = 255;

/**
 * How a resource is nested in its parent resource: `ProjectResource.asParent().relationship('tasks').inverseRelationship('project')`.
 * Returned by the child resource's `getParentResourceRegistration()`; `static parentResource = ProjectResource` gives the defaults.
 */
export class ParentResourceRegistration {
    private parentResource: typeof Resource;
    private childResource: typeof Resource | null;
    private relationshipName: string | null;
    private inverseRelationshipName: string | null;
    private foreignKeyName: string | null = null;
    private pageName: string | null = null;
    constructor(parentResource: typeof Resource, childResource: typeof Resource | null = null, relationshipName: string | null = null, inverseRelationshipName: string | null = null) {
        this.parentResource = parentResource;
        this.childResource = childResource;
        this.relationshipName = relationshipName;
        this.inverseRelationshipName = inverseRelationshipName;
    }
    /** Relationship of the parent model to the child records (`tasks`): the URL segment of the parent's relation manager. */
    relationship(name: string): this { this.relationshipName = name; return this; }
    /** Relationship of the child model to its parent (`project`): it names the parent's route parameter (`{project}`). */
    inverseRelationship(name: string): this { this.inverseRelationshipName = name; return this; }
    /** Column of the child records holding the parent's key; defaults to the inverse relationship in snake case + `_id` (`project_id`). */
    foreignKey(column: string): this { this.foreignKeyName = column; return this; }
    /** Page of the parent resource listing the child records (a related page's name); defaults to the relationship in kebab case. */
    page(name: string | null): this { this.pageName = name; return this; }
    /** Sets the child resource when the registration was made without it (`ProjectResource.asParent()`). */
    forChild(childResource: typeof Resource): this { this.childResource ??= childResource; return this; }
    getParentResource(): typeof Resource { return this.parentResource; }
    getChildResource(): typeof Resource {
        if (!this.childResource) throw new Error(`${this.parentResource.name}.asParent(): the child resource is not known.`);
        return this.childResource;
    }
    getRelationshipName(): string { return this.relationshipName ?? camelOf(pluralOf(this.getChildResource().modelLabel)); }
    getInverseRelationshipName(): string { return this.inverseRelationshipName ?? camelOf(this.parentResource.modelLabel); }
    getForeignKey(): string { return this.foreignKeyName ?? `${snakeOf(this.getInverseRelationshipName())}_id`; }
    getParentRouteParameterName(): string { return snakeOf(this.getInverseRelationshipName()); }
    getRouteName(): string { return kebabOf(this.getRelationshipName()); }
    getPageName(): string { return this.pageName ?? this.getRouteName(); }
}

/** A resource's nesting in its parent, if it is nested. */
export function parentRegistrationOf(resource: typeof Resource): ParentResourceRegistration | null {
    const registration = (resource as any).getParentResourceRegistration?.() ?? null;
    return registration ? (registration as ParentResourceRegistration).forChild(resource) : null;
}

/** Every level of a resource's nesting, from the outermost parent down to its own parent. */
export function parentChainOf(resource: typeof Resource): ParentResourceRegistration[] {
    const chain: ParentResourceRegistration[] = [];
    const seen = new Set<typeof Resource>([resource]);
    for (let registration = parentRegistrationOf(resource); registration; registration = parentRegistrationOf(registration.getParentResource())) {
        const parent = registration.getParentResource();
        if (seen.has(parent)) throw new Error(`${resource.name}: its parent resources form a cycle.`);
        seen.add(parent);
        const parameter = registration.getParentRouteParameterName();
        if (RESERVED_PARAMETERS.has(parameter) || !/^[a-z][a-z0-9_]*$/.test(parameter)) throw new Error(`${registration.getChildResource().name}: "${parameter}" cannot be the parent's route parameter; choose another inverseRelationship().`);
        if (chain.some((other) => other.getParentRouteParameterName() === parameter)) throw new Error(`${resource.name}: two parent resources use the route parameter "${parameter}".`);
        chain.unshift(registration);
    }
    return chain;
}

/** `adapter.scopedTo(<foreign key>, parentKey)`: the default `Resource.scopeAdapterToParent()`. */
export function scopeAdapterByForeignKey(resource: typeof Resource, adapter: DataAdapter, parentKey: string): DataAdapter {
    const registration = parentRegistrationOf(resource);
    if (!registration) return adapter;
    if (typeof adapter.scopedTo !== 'function') throw new Error(`${resource.name}: its adapter cannot be scoped to the parent record (it has no scopedTo()); define scopeAdapterToParent().`);
    return adapter.scopedTo(registration.getForeignKey(), parentKey);
}

/** Key of a URL parameter: a key, or a record of that resource. */
function keyOf(resource: typeof Resource, value: unknown): string {
    return value !== null && typeof value === 'object' ? resource.adapter.getKey(value) : String(value);
}

/** Path of a resource's records, with `{parameter}` placeholders for its parents' keys: `projects/{project}/tasks`. */
export function nestedRoutePath(resource: typeof Resource): string {
    const chain = parentChainOf(resource);
    if (!chain.length) return resource.slug;
    let path = chain[0].getParentResource().slug;
    for (const registration of chain) path += `/{${registration.getParentRouteParameterName()}}/${registration.getChildResource().slug}`;
    return path;
}

const hasPage = (resource: typeof Resource, name: string) => Object.prototype.hasOwnProperty.call(resource.getPages(), name);

/**
 * URL of a resource page from named parameters (Filament's `getUrl('edit', ['project' => $project, 'record' => $task])`):
 * `record` is the record (or its key), each parent resource's route parameter its record (or key), anything else goes
 * to the query string.
 */
export function resourceUrl(resource: typeof Resource, name: string, parameters: Record<string, unknown>): string {
    const chain = parentChainOf(resource);
    const used = new Set<string>(['record']);
    let path = chain.length ? chain[0].getParentResource().slug : resource.slug;
    for (const registration of chain) {
        const parameter = registration.getParentRouteParameterName();
        const value = parameters[parameter];
        if (value === undefined || value === null || value === '') {
            throw new Error(`${resource.name}.getUrl('${name}'): the "${parameter}" parameter (the ${registration.getParentResource().modelLabel} record or its key) is required.`);
        }
        used.add(parameter);
        path += `/${encodeURIComponent(keyOf(registration.getParentResource(), value))}/${registration.getChildResource().slug}`;
    }
    const rest = Object.fromEntries(Object.entries(parameters).filter(([key, value]) => !used.has(key) && value !== undefined && value !== null));
    // A nested resource has no list: its records are listed on the parent record's page.
    if (name === 'index' && chain.length) return nestedIndexUrl(chain[chain.length - 1], parameters);
    const record = parameters.record;
    const needsRecord = name !== 'index' && name !== 'create';
    if (needsRecord && (record === undefined || record === null || record === '')) throw new Error(`${resource.name}.getUrl('${name}'): the record is required.`);
    const key = needsRecord ? encodeURIComponent(keyOf(resource, record)) : '';
    const suffix = name === 'index' ? '' : name === 'create' ? '/create' : name === 'view' ? `/${key}` : name in resource.relatedPages ? `/${key}/${name}` : `/${key}/edit`;
    const query = new URLSearchParams(Object.entries(rest).map(([key, value]): [string, string] => [key, String(value)])).toString();
    return `${resource.panel.getUrl(path)}${suffix}${query ? `?${query}` : ''}`;
}

/**
 * Where a nested resource's records are listed (breadcrumb, redirect after deletion): the parent's related page named by
 * `page()` if it has one, otherwise its view or edit page with the relation manager tab open (`?relation=tasks`), otherwise its list.
 */
function nestedIndexUrl(registration: ParentResourceRegistration, parameters: Record<string, unknown>): string {
    const parent = registration.getParentResource();
    const parameter = registration.getParentRouteParameterName();
    const { [parameter]: parentRecord, record: _record, ...rest } = parameters;
    const pageName = registration.getPageName();
    if (pageName in parent.relatedPages && hasPage(parent, pageName)) return parent.getUrl(pageName, { ...rest, record: parentRecord });
    for (const name of ['view', 'edit']) if (hasPage(parent, name)) return parent.getUrl(name, { relation: registration.getRelationshipName(), ...rest, record: parentRecord });
    return parent.getUrl('index', rest);
}

/** A parent record of the displayed nested page. */
type ParentRecord = { registration: ParentResourceRegistration; resource: typeof Resource; key: string; record: unknown; parameters: Record<string, string> };

/**
 * The resource as seen from a nested page: its adapter is scoped to the parent record, and its URLs carry the parent keys.
 * Everything else (labels, forms, policies) is the resource's own.
 */
function bindResource(resource: typeof Resource, adapter: DataAdapter, parentParameters: Record<string, string>): typeof Resource {
    const bound = Object.create(resource);
    Object.defineProperties(bound, {
        adapter: { value: adapter },
        getUrl: {
            value: (name: string = 'index', record?: unknown, parameters: Record<string, unknown> = {}) => resource.getUrl(name, record !== null && typeof record === 'object'
                ? { ...parentParameters, ...(record as Record<string, unknown>), ...parameters }
                : { ...parentParameters, ...parameters, ...(record !== undefined && record !== null && record !== '' ? { record } : {}) }),
        },
        can: { value: (ability: string, user: User | null, record: unknown = null) => resource.can(ability, user, record) },
        getPages: { value: () => resource.getPages() },
        getRegisteredPage: { value: (name: string) => resource.getRegisteredPage(name) },
    });
    return bound as typeof Resource;
}

/** Parent keys of a nested page, read from the route parameters on display. */
function parentKeysFrom(resource: typeof Resource, params: Record<string, unknown>): Record<string, string> {
    const keys: Record<string, string> = {};
    for (const registration of parentChainOf(resource)) {
        const parameter = registration.getParentRouteParameterName();
        const value = params[parameter];
        if (typeof value !== 'string' && typeof value !== 'number') throw new WireError(404, 'Record not found.');
        keys[parameter] = String(value);
    }
    return keys;
}

/**
 * Loads the parent records of a nested page, outermost first: each one through its resource's adapter scoped to the record
 * above it, so a key of a record that belongs to another parent is not found (404). Access to every parent resource
 * (`viewAny`) is checked by the page on every request, as in Filament.
 */
async function loadParentRecords(page: any, resource: typeof Resource): Promise<ParentRecord[]> {
    const keys: Record<string, string> = page.parentRecordKeys ?? {};
    const parents: ParentRecord[] = [];
    const parameters: Record<string, string> = {};
    for (const registration of parentChainOf(resource)) {
        const parent = registration.getParentResource();
        const parameter = registration.getParentRouteParameterName();
        const key = keys[parameter];
        if (typeof key !== 'string' || key === '' || key.length > MAX_KEY_LENGTH) throw new WireError(404, 'Record not found.');
        const above = parents[parents.length - 1];
        const adapter = above ? parent.scopeAdapterToParent(parent.adapter, above.key, above.record) : parent.adapter;
        const record = await adapter.find(key);
        if (!record) throw new WireError(404, 'Record not found.');
        parents.push({ registration, resource: parent, key, record, parameters: { ...parameters } });
        parameters[parameter] = key;
    }
    return parents;
}

/** Breadcrumbs of the parent records: each parent's list, then the parent record (linked to its view or edit page if allowed). */
async function parentBreadcrumbs(parents: ParentRecord[], user: User | null): Promise<{ label: string; url: string | null }[]> {
    const crumbs: { label: string; url: string | null }[] = [];
    for (const { resource, key, record, parameters } of parents) {
        crumbs.push({ label: resource.getTitleCasePluralModelLabel(), url: resource.getUrl('index', parameters) });
        const title = resource.recordTitleAttribute ? resource.getRecordTitle(record) : titleCaseOf(resource.modelLabel);
        const url = hasPage(resource, 'view') && (await resource.can('view', user, record)) ? resource.getUrl('view', { ...parameters, record: key })
            : hasPage(resource, 'edit') && (await resource.can('update', user, record)) ? resource.getUrl('edit', { ...parameters, record: key }) : null;
        crumbs.push({ label: title, url });
    }
    return crumbs;
}

/** Resolves the parents of a nested page once per request, then binds the resource to the last one. */
async function resolveNestedPage(page: any, resource: typeof Resource): Promise<void> {
    if (page._parentRecords) return;
    const parents = await loadParentRecords(page, resource);
    const parent = parents[parents.length - 1];
    const parameters = { ...parent.parameters, [parent.registration.getParentRouteParameterName()]: parent.key };
    page._parentRecords = parents;
    page._nestedResource = bindResource(resource, resource.scopeAdapterToParent(resource.adapter, parent.key, parent.record), parameters);
    page._parentBreadcrumbs = await parentBreadcrumbs(parents, (page._ctx as PanelContext | null)?.user ?? null);
}

/** Pages of a nested resource: create, edit, view and related pages, served under the parent record. No list. */
export function buildNestedResourcePages(resource: typeof Resource, bases: { CreateRecord: typeof Page; EditRecord: typeof Page; ViewRecord: typeof Page; ManageRelatedRecords: typeof Page }): Record<string, typeof Page> {
    const base = nestedRoutePath(resource);
    const recordPage = (Base: any, slug: string): typeof Page => {
        const NestedPage = class extends Base {
            static resource = resource;
            static slug = slug;
            static shouldRegisterNavigation = false;
            /** Keys of the parent records, from the URL: set on display, never writable from the browser. */
            static locked = ['parentRecordKeys'];
            parentRecordKeys: Record<string, string> = {};
            _parentRecords: ParentRecord[] | null = null;
            _nestedResource: typeof Resource | null = null;
            _parentBreadcrumbs: { label: string; url: string | null }[] = [];
            get resource(): typeof Resource { return this._nestedResource ?? resource; }
            async mount(params: Record<string, unknown> = {}): Promise<void> {
                this.parentRecordKeys = parentKeysFrom(resource, params);
                await resolveNestedPage(this, resource);
                await super.mount(params);
            }
            /** The parent records are reloaded and checked on every request. */
            async hydrate(): Promise<void> {
                await resolveNestedPage(this, resource);
                await super.hydrate?.();
            }
            /** Every parent resource must be accessible too. */
            protected async isAccessAuthorized(ctx: PanelContext): Promise<boolean> {
                if (!(await super.isAccessAuthorized(ctx))) return false;
                for (const registration of parentChainOf(resource)) if (!(await registration.getParentResource().can('viewAny', ctx.user))) return false;
                return true;
            }
            /** The parent records' breadcrumbs come first: `Projects > Website > Tasks > Edit`. */
            getBreadcrumbs(): { label: string; url: string | null }[] { return [...this._parentBreadcrumbs, ...super.getBreadcrumbs()]; }
            /** The parent records, outermost first. */
            getParentRecords(): unknown[] { return (this._parentRecords ?? []).map((parent) => parent.record); }
            /** The parent record. */
            getParentRecord(): unknown { return this._parentRecords?.[this._parentRecords.length - 1]?.record ?? null; }
        };
        return NestedPage as unknown as typeof Page;
    };
    const pages: Record<string, typeof Page> = {
        create: recordPage((resource.pages.create as any) ?? bases.CreateRecord, `${base}/create`),
        edit: recordPage((resource.pages.edit as any) ?? bases.EditRecord, `${base}/{record}/edit`),
    };
    for (const [name, RelatedPage] of Object.entries(resource.relatedPages)) {
        if ((RelatedPage as any).prototype instanceof bases.ManageRelatedRecords) pages[name] = relatedRecordsPage(RelatedPage as any, resource, `${base}/{record}/${name}`);
        else pages[name] = recordPage(RelatedPage, `${base}/{record}/${name}`);
    }
    if (resource.hasViewPage) pages.view = recordPage((resource.pages.view as any) ?? bases.ViewRecord, `${base}/{record}`);
    return pages;
}

/** A related records page of a nested resource's record: the record must belong to the parent records too. */
function relatedRecordsPage(Base: typeof ManageRelatedRecords, resource: typeof Resource, slug: string): typeof Page {
    const NestedRelatedRecords = class extends (Base as any) {
        static parentResource = resource;
        static slug = slug;
        static shouldRegisterNavigation = false;
        static locked = ['parentRecordKeys'];
        parentRecordKeys: Record<string, string> = {};
        _parentRecords: ParentRecord[] | null = null;
        _nestedResource: typeof Resource | null = null;
        _parentBreadcrumbs: { label: string; url: string | null }[] = [];
        async mount(params: Record<string, unknown> = {}): Promise<void> {
            this.parentRecordKeys = parentKeysFrom(resource, params);
            await super.mount(params);
        }
        async hydrate(): Promise<void> {
            await resolveNestedPage(this, resource);
            // The owner record is looked up among the parent record's records first.
            if (!(await this._nestedResource!.adapter.find(this.recordKey))) throw new WireError(404, 'Record not found.');
            await super.hydrate();
        }
        protected async isAccessAuthorized(ctx: PanelContext): Promise<boolean> {
            if (!(await super.isAccessAuthorized(ctx))) return false;
            for (const registration of parentChainOf(resource)) if (!(await registration.getParentResource().can('viewAny', ctx.user))) return false;
            return true;
        }
        getSubNavigation() { return this._nestedResource!.getRecordSubNavigation(this as any); }
        getBreadcrumbs(): { label: string; url: string | null }[] {
            const owner = this._nestedResource!;
            return [
                ...this._parentBreadcrumbs,
                { label: owner.getTitleCasePluralModelLabel(), url: owner.getUrl() },
                { label: owner.getRecordTitle(this._owner), url: owner.getUrl(owner.hasViewPage ? 'view' : 'edit', this.recordKey) },
                { label: (this.constructor as typeof ManageRelatedRecords).getTitle(), url: null },
            ];
        }
    };
    return NestedRelatedRecords as unknown as typeof Page;
}

// ------------------------------------------------------------------ relation managers and related pages (`relatedResource`)

/** Relationship of a relation manager or related records page: its own, or the one of its related resource's nesting. */
export function relationshipNameOf(manager: { relationship?: string; getRelatedResource?: () => typeof Resource | null }): string {
    if (manager.relationship) return manager.relationship;
    const related = manager.getRelatedResource?.() ?? null;
    return (related ? parentRegistrationOf(related)?.getRelationshipName() : null) ?? manager.relationship ?? '';
}

/** Records of a related resource belonging to an owner record: its adapter scoped to the owner. */
export function relatedResourceAdapter(related: typeof Resource, ownerKey: string): DataAdapter {
    return related.scopeAdapterToParent(related.adapter, ownerKey, null);
}

/**
 * The resource facade of a relation manager (or related records page) with a `relatedResource`: labels and policy come from
 * the related resource, and the create, edit and view actions link to its nested pages when it has them (Filament's
 * `getDefaultActionUrl()`), with the owner record as the parent.
 */
export function withRelatedResource<F extends Record<string, any>>(facade: F, related: typeof Resource | null | undefined, ownerKey: string, parentParameters: Record<string, string> = {}): F {
    if (!related) return facade;
    const registration = parentRegistrationOf(related);
    const parameters = registration ? { ...parentParameters, [registration.getParentRouteParameterName()]: ownerKey } : {};
    const urlOf = (name: string, record?: unknown) => {
        if (!hasPage(related, name)) return null;
        try { return related.getUrl(name, { ...parameters, ...(record !== undefined && record !== null ? { record } : {}) }); } catch { return null; }
    };
    return Object.assign(facade, {
        modelLabel: related.modelLabel,
        recordTitleAttribute: related.recordTitleAttribute,
        hasViewPage: hasPage(related, 'view'),
        can: (ability: string, user: User | null, record: unknown = null) => related.can(ability, user, record),
        getPluralModelLabel: () => related.getPluralModelLabel(),
        getTitleCasePluralModelLabel: () => related.getTitleCasePluralModelLabel(),
        getRecordTitle: (record: unknown) => related.getRecordTitle(record),
        getUrl: (name: string = 'view', record?: unknown) => urlOf(name, record) ?? '',
        /** URL of the related resource's page for an action (`create`, `edit`, `view`), or `null` to keep the modal. */
        getRelatedResourceUrl: (name: string, record?: unknown) => urlOf(name, record),
    });
}

/** Rows of a related resource's table link to its view page, or its edit page, when the table has that row action. */
export function linkRelatedRecords(table: Table, facade: { getRelatedResourceUrl?: (name: string, record?: unknown) => string | null; adapter: DataAdapter }): Table {
    if (typeof facade.getRelatedResourceUrl !== 'function') return table;
    const names = new Set(table.getRecordActions().flatMap((action: any) => (typeof action.getActions === 'function' ? action.getActions() : [action])).map((action: any) => action.getName()));
    const name = ['view', 'edit'].find((candidate) => names.has(candidate) && facade.getRelatedResourceUrl!(candidate, '0') !== null);
    return name ? table.recordUrl((record: unknown) => facade.getRelatedResourceUrl!(name, facade.adapter.getKey(record))) : table;
}
