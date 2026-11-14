// The owner record and the titles of related records, for relation managers and related-records pages
// (Filament's `RelationManager::getOwnerRecord()` and the table's `recordTitle()`).
import type { Resource } from './index.ts';

/** What the helpers need from a relation manager or a `ManageRelatedRecords` page. */
type ManagerClass = {
    recordTitleAttribute: string | null;
    modelLabel: string;
    getRelatedResource(): typeof Resource | null;
};
type ManagerInstance = {
    constructor: Function;
    getTable(): { getRecordTitle(record: any): string | null; hasRecordTitle(): boolean };
    getRecordTitle(record: any): string;
};

/**
 * Title of a related record: the table's `recordTitle()` (or `recordTitleAttribute()`), else the manager's `recordTitleAttribute`,
 * else the related resource's title, else the model label.
 */
export function managerRecordTitle(livewire: ManagerInstance, record: any): string {
    const fromTable = livewire.getTable().getRecordTitle(record);
    if (fromTable !== null) return fromTable;
    const manager = livewire.constructor as unknown as ManagerClass;
    if (manager.recordTitleAttribute) return String(record?.[manager.recordTitleAttribute] ?? '');
    const related = manager.getRelatedResource();
    return related ? related.getRecordTitle(record) : manager.modelLabel;
}

/**
 * Labels of the attach and associate options: the manager's `getRecordTitle()` when it is overridden or the table has a
 * `recordTitle()`; `null` keeps the default labels (the title attribute, else the record key).
 */
export function relatableRecordTitleResolver(livewire: ManagerInstance, defaultMethod: Function): ((record: any) => string) | null {
    if (livewire.getRecordTitle !== defaultMethod) return (record) => livewire.getRecordTitle(record);
    const table = livewire.getTable();
    return table.hasRecordTitle() ? (record) => table.getRecordTitle(record) ?? '' : null;
}

const ownerCache = new WeakMap<object, { key: string; record: Promise<any> }>();

/**
 * The owner record of a relation manager, read through the owner resource's adapter (scoped to the current tenant) once per
 * request, or `null` when the manager has no owner resource or the record does not exist.
 */
export function loadOwnerRecord(livewire: object, ownerResource: typeof Resource | null, ownerKey: string): Promise<any> {
    if (!ownerResource || ownerKey === '') return Promise.resolve(null);
    const cached = ownerCache.get(livewire);
    if (cached && cached.key === ownerKey) return cached.record;
    const record = Promise.resolve(ownerResource.adapter.find(ownerKey)).then((found) => found ?? null);
    ownerCache.set(livewire, { key: ownerKey, record });
    return record;
}
