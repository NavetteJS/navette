// Singular resources: a resource bound to a single record (site settings, the homepage...), managed from one edit page
// (and optionally a view page) at the resource's URL, without a list. If the record does not exist yet, the form shows its
// defaults and the first save creates it. It is a resource option (`static isSingular = true`), so policies, hooks and
// URLs work as on any resource page.
import { WireError } from '@navette-js/wire';
import { can, type EditRecord, type Page, type Resource, type ViewRecord } from './index.ts';

const titleCaseOf = (s: string) => s.split(' ').map((word) => word.replace(/^./, (c) => c.toUpperCase())).join(' ');

/** URL of a singular resource's page: its edit page (`index` and `edit`) or its view page. The record is never in the URL. */
export function singularResourceUrl(resource: typeof Resource, name: string): string {
    const base = resource.panel.getUrl(resource.slug);
    if (!resource.hasViewPage) return base;
    return name === 'view' || name === 'index' ? base : `${base}/edit`;
}

/** Navigation of the page standing for the resource in the menu. */
function navigationStatics(resource: typeof Resource) {
    return {
        navigationIcon: resource.navigationIcon, navigationGroup: resource.navigationGroup, navigationSort: resource.navigationSort, navigationBadge: resource.navigationBadge,
        navigationParentItem: resource.navigationParentItem, navigationLabel: resource.navigationLabel,
        getNavigationBadge: typeof (resource as any).getNavigationBadge === 'function' ? () => (resource as any).getNavigationBadge() : undefined,
    };
}

/** Pages of a singular resource: the edit page, and the view page with `hasViewPage` (then served at the resource URL). */
export function buildSingularResourcePages(resource: typeof Resource, bases: { EditRecord: typeof EditRecord; ViewRecord: typeof ViewRecord }): Record<string, typeof Page> {
    const title = resource.navigationLabel ?? titleCaseOf(resource.modelLabel);
    const EditBase = (resource.pages.edit ?? bases.EditRecord) as any;
    const Edit = class extends EditBase {
        static resource = resource;
        static slug = resource.hasViewPage ? `${resource.slug}/edit` : resource.slug;
        static shouldRegisterNavigation = !resource.hasViewPage;
        static title = EditBase.title ?? title;
        /**
         * The record is looked up on every request (it may have been created since the page was displayed): editing it
         * requires `update`, creating it `create`.
         */
        async hydrate(): Promise<void> {
            const record = (await resource.resolveSingularRecord(this.getDataAdapter())) ?? null;
            this._record = record;
            this.recordKey = record ? this.getDataAdapter().getKey(record) : '';
            if (!(await can(this, record ? 'update' : 'create', record))) throw new WireError(403, 'Forbidden.');
        }
        /** Without a record yet, the first save creates it, with the resource's `getSingularRecordAttributes()`. */
        protected handleRecordUpdate(record: any, data: Record<string, unknown>): Promise<any> {
            if (record) return super.handleRecordUpdate(record, data);
            // A page may define `handleRecordCreation(data)` to create the record itself.
            const create = (this as any).handleRecordCreation;
            return typeof create === 'function' ? create.call(this, data) : this.getDataAdapter().create({ ...data, ...resource.getSingularRecordAttributes() });
        }
        async save(): Promise<void> {
            await super.save();
            if (this._record) this.recordKey = this.getDataAdapter().getKey(this._record);
        }
        getTitle(): string { return (this.constructor as typeof Page).getTitle(); }
        getBreadcrumbs(): { label: string; url: string | null }[] { return []; }
        /** No delete action: the record stands for the resource. */
        getHeaderActions(): any[] { return [...((resource as any).editHeaderActions?.() ?? [])]; }
        /** "Save" only: there is no list to go back to. */
        getFormActions(): any[] { return super.getFormActions().filter((action: any) => action.getName() !== 'cancel'); }
        getPageClasses(): string[] { return ['nv-resource-edit-record-page', `nv-resource-${resource.slug.replace(/\//g, '-')}`]; }
    };
    Object.assign(Edit, navigationStatics(resource));
    if (!resource.hasViewPage) return { edit: Edit as unknown as typeof Page };
    const ViewBase = (resource.pages.view ?? bases.ViewRecord) as any;
    const View = class extends ViewBase {
        static resource = resource;
        static slug = resource.slug;
        static title = ViewBase.title ?? title;
        /** Viewing requires `view` on the record, or `viewAny` while it does not exist. */
        async hydrate(): Promise<void> {
            const record = (await resource.resolveSingularRecord(this.getDataAdapter())) ?? null;
            this._record = record;
            this.recordKey = record ? this.getDataAdapter().getKey(record) : '';
            if (!(await can(this, record ? 'view' : 'viewAny', record))) throw new WireError(403, 'Forbidden.');
        }
        getTitle(): string { return (this.constructor as typeof Page).getTitle(); }
        getBreadcrumbs(): { label: string; url: string | null }[] { return []; }
        getPageClasses(): string[] { return ['nv-resource-view-record-page', `nv-resource-${resource.slug.replace(/\//g, '-')}`]; }
    };
    Object.assign(View, navigationStatics(resource));
    return { edit: Edit as unknown as typeof Page, view: View as unknown as typeof Page };
}
