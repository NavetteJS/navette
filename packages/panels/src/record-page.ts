// Custom resource pages bound to a record (`InteractsWithRecord()`): registered in a resource's
// `relatedPages`, served at `<slug>/{record}/<name>`, they read the record through the resource's adapter (in the current
// tenant, and under the parent records of a nested resource), authorize it on every request, and show the resource's
// breadcrumbs and record sub-navigation.
import { WireError } from '@navette-js/wire';
import type { DataAdapter } from '@navette-js/database';
import type { Page, PanelContext, Resource, SubNavigationItem, User } from './index.ts';

type PageClass = abstract new (...args: any[]) => Page;

/** Members that `InteractsWithRecord()` adds to a page. */
export interface RecordPage {
    /** Key of the record, from the URL: set on display, never writable from the browser. */
    recordKey: string;
    /** The record, reloaded on every request. */
    _record: any;
    readonly resource: typeof Resource;
    getDataAdapter(): DataAdapter;
    /** The record. */
    getRecord(): any;
    getRecordKey(): string | null;
    /** Whether the record is loaded. */
    hasRecord(): boolean;
    /** Title of the record: the resource's `getRecordTitle()` when it has a `recordTitleAttribute`, else its model label. */
    getRecordTitle(): string;
    /** Whether the user may open the page for this record; defaults to the resource policy's `view` ability. */
    canAccessRecord(record: any, user: User | null): boolean | Promise<boolean>;
    /** Label of the page's last breadcrumb: `static breadcrumb`, else the page title. */
    getBreadcrumb(): string;
    getActionMountContext(): Record<string, unknown>;
}
/** Static members that `InteractsWithRecord()` adds to a page class. */
export type RecordPageStatics = { resource: typeof Resource; isRecordPage: true; breadcrumb: string | null; locked: string[] };

/**
 * Binds a custom resource page to a record: `class OrderReceipt extends InteractsWithRecord(Page) { … }`, registered in the
 * resource's `static relatedPages = { receipt: OrderReceipt }` (served at `orders/{record}/receipt`, and accepted by
 * `recordSubNavigation`). The resource is set on registration. `this.getRecord()` is the record, read through the resource's
 * adapter on every request: an unknown record answers 404, a record the user may not view (`canAccessRecord()`) 403.
 */
// The return type is spelled out: the declaration build cannot name an anonymous class with the base's private members.
export function InteractsWithRecord<T extends PageClass>(Base: T): T & (abstract new (...args: any[]) => RecordPage) & RecordPageStatics {
    abstract class RecordPageBase extends Base {
        /** Owner resource: set when the page is registered in its `relatedPages`. */
        static resource: typeof Resource;
        static isRecordPage = true as const;
        /** Label of the last breadcrumb (the page title by default). */
        static breadcrumb: string | null = null;
        static locked = ['recordKey'];
        static shouldRegisterNavigation = false;
        recordKey = '';
        _record: any = null;
        _recordBreadcrumb: { label: string; url: string | null } | null = null;
        get resource(): typeof Resource { return (this.constructor as unknown as RecordPageStatics).resource; }
        getDataAdapter(): DataAdapter { return this.resource.adapter; }
        async mount(params: Record<string, unknown> = {}): Promise<void> {
            this.recordKey = String(params.record ?? '');
            await this.hydrate();
            await (Base.prototype as any).mount?.call(this, params);
        }
        /** The record is reloaded and its access checked on every request (no route model binding). */
        async hydrate(): Promise<void> {
            await (Base.prototype as any).hydrate?.call(this);
            const user = ((this as any)._ctx as PanelContext | null)?.user ?? null;
            this._record = this.recordKey === '' ? null : await this.getDataAdapter().find(this.recordKey);
            if (!this._record) throw new WireError(404, 'Record not found.');
            if (!(await this.canAccessRecord(this._record, user))) throw new WireError(403, 'Forbidden.');
            this._recordBreadcrumb = await recordBreadcrumb(this.resource, this._record, this.recordKey, user, this.getRecordTitle());
        }
        canAccessRecord(record: any, user: User | null): boolean | Promise<boolean> { return this.resource.can('view', user, record); }
        /** Resource pages also need the resource's `viewAny` ability (checked by the panel), then the page's `canAccess()`. */
        protected async isAccessAuthorized(ctx: PanelContext): Promise<boolean> {
            if (!(await (Base.prototype as any).isAccessAuthorized.call(this, ctx))) return false;
            return (this.constructor as unknown as typeof Page).canAccess(ctx.user!);
        }
        getRecord(): any {
            if (!this._record) throw new WireError(404, 'Record not found.');
            return this._record;
        }
        getRecordKey(): string | null { return this.recordKey; }
        hasRecord(): boolean { return this._record !== null && this._record !== undefined; }
        getRecordTitle(): string { return this.resource.recordTitleAttribute ? this.resource.getRecordTitle(this._record) : this.resource.getTitleCaseModelLabel(); }
        getBreadcrumb(): string { return (this.constructor as unknown as RecordPageStatics).breadcrumb ?? this.getTitle(); }
        /** The resource's list, the record (linked to its view or edit page when the user may open it), then this page. */
        getBreadcrumbs(): { label: string; url: string | null }[] {
            return [
                { label: this.resource.getTitleCasePluralModelLabel(), url: this.resource.getUrl() },
                ...(this._recordBreadcrumb ? [this._recordBreadcrumb] : []),
                { label: this.getBreadcrumb(), url: null },
            ];
        }
        getSubNavigation(): SubNavigationItem[] { return this.resource.getRecordSubNavigation(this as any); }
        getActionMountContext(): Record<string, unknown> { return { recordKey: this.recordKey }; }
        protected getActionRecord(): unknown { return this._record; }
        getPageClasses(): string[] { return [...((Base.prototype as any).getPageClasses?.call(this) ?? []), `nv-resource-${this.resource.slug.replace(/\//g, '-')}`, `nv-resource-record-${this.recordKey}`]; }
    }
    return RecordPageBase as any;
}

/** The record's breadcrumb: only with a `recordTitleAttribute`; links to the view page, else the edit page, if the user may open it. */
async function recordBreadcrumb(resource: typeof Resource, record: any, key: string, user: User | null, title: string): Promise<{ label: string; url: string | null } | null> {
    if (!resource.recordTitleAttribute) return null;
    const pages = resource.getPages();
    if ('view' in pages && (await resource.can('view', user, record))) return { label: title, url: resource.getUrl('view', key) };
    if ('edit' in pages && (await resource.can('update', user, record))) return { label: title, url: resource.getUrl('edit', key) };
    return { label: title, url: null };
}

/** Whether a page class was made with `InteractsWithRecord()`. */
export const isRecordPageClass = (PageClass: unknown): boolean => (PageClass as { isRecordPage?: boolean } | null)?.isRecordPage === true;

