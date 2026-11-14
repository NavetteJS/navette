// Widgets bound to a list page's table (`InteractsWithPageTable()`): any widget class receives the table state of the
// list page it is shown on (search, filters, tab, sort, pagination) and can query exactly the records that table displays.
import type { DataAdapter, ListQuery } from '@navette-js/database';
import { getTableQuery, getTableRecords, type FilterState } from '@navette-js/tables';
import type { ListRecords, Widget } from './index.ts';

/** Table state passed by a list page to its header widgets (`ListRecords.getWidgetData()`). */
export const PAGE_TABLE_STATE_PROPERTIES = ['activeTab', 'paginators', 'tableColumnSearches', 'tableFilters', 'tableRecordsPerPage', 'tableSearch', 'tableSort'];

type WidgetClass = abstract new (...args: any[]) => Widget;

/** Members that `InteractsWithPageTable()` adds to a widget. */
export interface PageTableWidget {
    activeTab: string | null;
    paginators: Record<string, number>;
    tableColumnSearches: Record<string, string>;
    tableFilters: Record<string, FilterState>;
    tableRecordsPerPage: number | 'all';
    tableSearch: string;
    tableSort: string | null;
    getTablePage(): typeof ListRecords;
    getTablePageInstance(): ListRecords;
    getPageTableAdapter(): DataAdapter;
    getPageTableQuery(): Omit<ListQuery, 'page' | 'perPage'>;
    getPageTableRecords(): Promise<unknown[]>;
}
/** Static members that `InteractsWithPageTable()` adds to a widget class. */
export type PageTableWidgetStatics = { reactive: string[]; tablePage: (() => typeof ListRecords) | null };

/**
 * Adds the page table state to a widget class: `class ProductStats extends InteractsWithPageTable(StatsOverviewWidget) { … }`,
 * with `getTablePage()` (or `static tablePage = () => ListProducts`) naming the list page. `getPageTableQuery()` is the table's
 * current query (with the page's search, filters and tab); `getPageTableRecords()` the records of its current page.
 * The state comes from the page, and goes through the same validation as on the page; it does not check each record's
 * `view` policy: keep restrictions in the table's query.
 */
// The return type is spelled out: the declaration build cannot name an anonymous class with the base's private members.
export function InteractsWithPageTable<T extends WidgetClass>(Base: T): T & (abstract new (...args: any[]) => PageTableWidget) & PageTableWidgetStatics {
    abstract class InteractsWithPageTableWidget extends Base {
        static reactive = PAGE_TABLE_STATE_PROPERTIES;
        /** List page whose table is observed (or override `getTablePage()`). */
        static tablePage: (() => typeof ListRecords) | null = null;
        activeTab: string | null = null;
        paginators: Record<string, number> = { page: 1 };
        tableColumnSearches: Record<string, string> = {};
        tableFilters: Record<string, FilterState> = {};
        tableRecordsPerPage: number | 'all' = 10;
        tableSearch = '';
        tableSort: string | null = null;
        getTablePage(): typeof ListRecords {
            const page = (this.constructor as unknown as { tablePage: (() => typeof ListRecords) | null }).tablePage;
            if (!page) throw new Error(`${this.constructor.name}: define getTablePage() or static tablePage.`);
            return page();
        }
        /** An instance of the list page with the received table state, to build its table. */
        getTablePageInstance(): ListRecords {
            const PageClass = this.getTablePage() as unknown as new () => ListRecords;
            const page = new PageClass();
            (page as any)._ctx = (this as any)._ctx;
            for (const property of PAGE_TABLE_STATE_PROPERTIES) (page as any)[property] = (this as any)[property];
            return page;
        }
        /** Data adapter of the page's table. */
        getPageTableAdapter(): DataAdapter { return this.getTablePageInstance().getDataAdapterForTable(); }
        /** The table's current query (search, filters, tab, sort), for `adapter.aggregate()`, `adapter.listKeys()`, `adapter.paginate()`… */
        getPageTableQuery(): Omit<ListQuery, 'page' | 'perPage'> {
            const page = this.getTablePageInstance();
            return getTableQuery(page.getTable(), page as any);
        }
        /** Records of the table's current page. */
        async getPageTableRecords(): Promise<unknown[]> {
            const page = this.getTablePageInstance();
            return (await getTableRecords(page.getTable(), page as any, page.getDataAdapterForTable())).records;
        }
    }
    return InteractsWithPageTableWidget as unknown as T & (abstract new (...args: any[]) => PageTableWidget) & PageTableWidgetStatics;
}
