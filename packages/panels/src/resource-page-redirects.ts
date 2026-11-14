// Where resource create and edit pages send the user after creating or saving a record (the defaults,
// and the panel's `resourceCreatePageRedirect()` and `resourceEditPageRedirect()`).
import type { Resource } from './index.ts';

/** A resource page name (`'index'`, `'view'`, `'edit'`), a function returning one, or `null` for the default. */
export type ResourcePageRedirect = string | null | (() => string | null);

export const evaluatePageRedirect = (redirect: ResourcePageRedirect): string | null => {
    const page = typeof redirect === 'function' ? redirect() : redirect;
    return typeof page === 'string' && page !== '' ? page : null;
};

type RecordFormPage = {
    resource: typeof Resource;
    panel: { getResourceCreatePageRedirect(): string | null; getResourceEditPageRedirect(): string | null };
    getDataAdapter(): { getKey(record: any): string };
    _ctx: unknown;
};

const userOf = (page: RecordFormPage) => (page._ctx as { user?: any } | null)?.user ?? null;

/** Whether the resource has this page and, for the record's view and edit pages, the user may open it. */
async function canRedirectTo(page: RecordFormPage, name: string, record: unknown): Promise<boolean> {
    const resource = page.resource;
    if (!(name in resource.getPages())) return false;
    if (name === 'view') return resource.can('view', userOf(page), record);
    if (name === 'edit') return resource.can('update', userOf(page), record);
    return true;
}

const urlOf = (page: RecordFormPage, name: string, record: unknown): string =>
    name === 'index' ? page.resource.getUrl() : page.resource.getUrl(name, page.getDataAdapter().getKey(record));

/** After creating: the panel's choice, else the view page, else the edit page, else the list. */
export async function createPageRedirectUrl(page: RecordFormPage, record: unknown): Promise<string> {
    const preferred = page.panel.getResourceCreatePageRedirect();
    for (const name of [...(preferred ? [preferred] : []), 'view', 'edit']) {
        if (await canRedirectTo(page, name, record)) return urlOf(page, name, record);
    }
    return page.resource.getUrl();
}

/** After saving: the panel's choice; else stay (`null`) while the user may still edit the record; else the view page, else the list. */
export async function editPageRedirectUrl(page: RecordFormPage, record: unknown): Promise<string | null> {
    const preferred = page.panel.getResourceEditPageRedirect();
    if (preferred && (await canRedirectTo(page, preferred, record))) return urlOf(page, preferred, record);
    if (await page.resource.can('update', userOf(page), record)) return null;
    if (await canRedirectTo(page, 'view', record)) return urlOf(page, 'view', record);
    return page.resource.getUrl();
}
