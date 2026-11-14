// Relation managers of record pages: registrations with properties (`CommentsManager.make({ status: 'approved' })`), the
// entries of `getRelations()` (a list, or an object whose keys are used in the URL), and the position of the content tab.
import type { PanelContext, RelationGroup, RelationManager } from './index.ts';
import { relationshipNameOf } from './nested-resources.ts';

/** A relation manager with properties of its own, mapped to its public properties (Filament's `RelationManagerConfiguration`). */
export class RelationManagerConfiguration<M extends typeof RelationManager = typeof RelationManager> {
    readonly relationManager: M;
    readonly properties: Record<string, unknown>;
    constructor(relationManager: M, properties: Record<string, unknown> = {}) {
        this.relationManager = relationManager;
        this.properties = properties;
    }
    getRelationManager(): M { return this.relationManager; }
    getProperties(): Record<string, unknown> { return this.properties; }
}

/** An entry of a resource's (or page's) relations: a manager, a manager with properties, or a group of them. */
export type RelationManagerEntry = typeof RelationManager | RelationManagerConfiguration | RelationGroup;
/** Relations of a record page: a list (keys `'0'`, `'1'`…), or an object whose keys name the tabs (`?relation=comments`). */
export type RelationManagerEntries = RelationManagerEntry[] | Record<string, RelationManagerEntry>;

/** Where the content (form or infolist) tab goes among combined relation manager tabs. */
export const ContentTabPosition = { Before: 'before', After: 'after' } as const;
export type ContentTabPosition = (typeof ContentTabPosition)[keyof typeof ContentTabPosition];

/** The entries with their keys, in order. */
export function relationManagerEntries(entries: RelationManagerEntries | null | undefined): [string, RelationManagerEntry][] {
    if (!entries) return [];
    return Array.isArray(entries) ? entries.map((entry, index) => [String(index), entry]) : Object.entries(entries);
}

/** A manager class with the properties it is mounted with. */
export type MountedManager = { manager: typeof RelationManager; properties: Record<string, unknown> };
const isGroup = (entry: unknown): entry is RelationGroup => typeof (entry as any)?.getManagers === 'function';
/** The managers of an entry (one, or those of a group), with their properties. */
export function managersOfEntry(entry: RelationManagerEntry): MountedManager[] {
    const items = isGroup(entry) ? entry.getManagers() : [entry];
    return items.map((item) => (item instanceof RelationManagerConfiguration
        ? { manager: item.relationManager, properties: { ...item.relationManager.getDefaultProperties(), ...item.properties } }
        : { manager: item as typeof RelationManager, properties: (item as typeof RelationManager).getDefaultProperties() }));
}

/**
 * Tab selected by the URL (`?relation=comments`, `?relation=0`, or another key with `static relationManagerQueryStringKey`):
 * an entry key, or the relationship name of one of its managers; `''` for the content tab.
 */
export function relationManagerTabFromQuery(page: { _ctx: unknown; getRelationManagers(): RelationManagerEntries }, queryKey: string | null = 'relation', extraKeys: string[] = []): string | null {
    if (queryKey === null) return null;
    const value = (page._ctx as PanelContext | null)?.req?.query?.[queryKey];
    if (typeof value !== 'string' || value.length > 100) return null;
    const entries = relationManagerEntries(page.getRelationManagers());
    if (value === '' || value === '-1') return '';
    if (entries.some(([key]) => key === value) || extraKeys.includes(value)) return value;
    const found = entries.find(([, entry]) => managersOfEntry(entry).some(({ manager }) => relationshipNameOf(manager as any) === value));
    return found ? found[0] : null;
}
