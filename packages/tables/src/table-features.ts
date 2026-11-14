// Table-level features shared by the Table class and its hosts: column manager state, trigger actions, row loop, modes.
import { AsyncLocalStorage } from 'node:async_hooks';

/** Pagination modes: page numbers and total (`default`), previous / next only (`simple`), or a cursor (`cursor`). */
export const PaginationMode = { Default: 'default', Simple: 'simple', Cursor: 'cursor' } as const;
export type PaginationModeValue = (typeof PaginationMode)[keyof typeof PaginationMode];
/** Where the column manager opens: a dropdown (default) or a modal. */
export const ColumnManagerLayout = { Dropdown: 'dropdown', Modal: 'modal' } as const;
export type ColumnManagerLayoutValue = (typeof ColumnManagerLayout)[keyof typeof ColumnManagerLayout];
/** Where the column manager's "Reset" action goes: next to its heading (default) or in its footer. */
export const ColumnManagerResetActionPosition = { Header: 'header', Footer: 'footer' } as const;
export type ColumnManagerResetActionPositionValue = (typeof ColumnManagerResetActionPosition)[keyof typeof ColumnManagerResetActionPosition];

/** One item of the column manager state: a column, or a column group with its columns. */
export type ColumnState = {
    type: 'column' | 'group'; name: string; label: string; isHidden: boolean; isToggled: boolean; isToggleable: boolean; isToggledHiddenByDefault: boolean | null;
    columns?: ColumnState[];
};

/**
 * Trigger button of a table feature (column manager, reordering), customized with `columnManagerTriggerAction()` or
 * `reorderRecordsTriggerAction()`: label, icon, color, look, and for the column manager its modal.
 */
export class TableTriggerAction {
    private _label: string | null = null;
    private _icon: string | null | undefined = undefined;
    private _color: string | null = null;
    private _view: 'button' | 'link' | 'icon-button' | null = null;
    private _hidden = false;
    private _slideOver = false;
    private _modalHeading: string | null = null;
    private _modalDescription: string | null = null;
    private _modalWidth: string | null = null;
    label(label: string | null): this { this._label = label; return this; }
    icon(icon: string | null): this { this._icon = icon; return this; }
    color(color: string | null): this { this._color = color; return this; }
    /** Labeled button. */
    button(): this { this._view = 'button'; return this; }
    link(): this { this._view = 'link'; return this; }
    /** Icon only, the label becomes the tooltip and accessible name. */
    iconButton(): this { this._view = 'icon-button'; return this; }
    hidden(condition = true): this { this._hidden = condition; return this; }
    visible(condition = true): this { this._hidden = !condition; return this; }
    /** Column manager: opens in a slide-over (a modal, whatever `columnManagerLayout()`). */
    slideOver(condition = true): this { this._slideOver = condition; return this; }
    modalHeading(heading: string | null): this { this._modalHeading = heading; return this; }
    modalDescription(description: string | null): this { this._modalDescription = description; return this; }
    /** Column manager modal width: `xs` to `7xl`, `full`, `screen`. */
    modalWidth(width: string | null): this { this._modalWidth = width !== null && /^(xs|sm|md|lg|xl|[2-7]xl|full|screen|min|max|fit|prose)$/.test(width) ? width : null; return this; }
    isModalSlideOver(): boolean { return this._slideOver; }
    getCustomModalHeading(): string | null { return this._modalHeading; }
    getModalDescription(): string | null { return this._modalDescription; }
    getModalWidth(): string | null { return this._modalWidth; }
    resolve(defaults: { label: string; icon: string | null; color: string; view: 'button' | 'link' | 'icon-button' }) {
        return { label: this._label ?? defaults.label, icon: this._icon === undefined ? defaults.icon : this._icon, color: this._color ?? defaults.color, view: this._view ?? defaults.view, hidden: this._hidden };
    }
}

/** Loop variable of the row being rendered (Filament's `$rowLoop`, Blade's `$loop`). */
export type RowLoop = { index: number; iteration: number; remaining: number; count: number; first: boolean; last: boolean; odd: boolean; even: boolean; depth: number; parent: null };
const rowLoops = new AsyncLocalStorage<RowLoop>();
/** Builds the loop variable of the row at `index` among `count` rows. */
export function makeRowLoop(index: number, count: number): RowLoop {
    const iteration = index + 1;
    return { index, iteration, remaining: count - iteration, count, first: index === 0, last: iteration === count, odd: iteration % 2 === 1, even: iteration % 2 === 0, depth: 1, parent: null };
}
/** Runs `fn` while rendering the row described by `loop`: `getRowLoop()` returns it, column state callbacks receive it. */
export function withRowLoop<T>(loop: RowLoop, fn: () => T): T { return rowLoops.run(loop, fn); }
/** Loop variable of the row being rendered, or `null` outside a table row (in any callback of a column: state, URL, color…). */
export function getRowLoop(): RowLoop | null { return rowLoops.getStore() ?? null; }

const keyOf = (item: { type: string; name: string }) => `${item.type}:${item.name}`;
/** Items of the column manager state received from the browser, reduced to their known shape. */
function parseItems(state: unknown, depth = 0): { type: 'column' | 'group'; name: string; isToggled: unknown; isToggledHiddenByDefault: unknown; columns?: ReturnType<typeof parseItems> }[] {
    if (!Array.isArray(state)) return [];
    const seen = new Set<string>();
    const items: ReturnType<typeof parseItems> = [];
    for (const raw of state.slice(0, 500)) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const type = item.type === 'group' && depth === 0 ? 'group' : item.type === 'column' || item.type === undefined ? 'column' : null;
        if (type === null || typeof item.name !== 'string' || seen.has(`${type}:${item.name}`)) continue;
        seen.add(`${type}:${item.name}`);
        items.push({ type, name: item.name, isToggled: item.isToggled, isToggledHiddenByDefault: item.isToggledHiddenByDefault, ...(type === 'group' ? { columns: parseItems(item.columns, depth + 1) } : {}) });
    }
    return items;
}
/** An item of the browser's state, with every attribute but `isToggled` taken from the table's declaration (Filament's `syncTableColumnStateItemAttributes()`). */
function syncItem(item: ReturnType<typeof parseItems>[number] | null, declared: ColumnState): ColumnState {
    const synced: ColumnState = { ...declared, columns: undefined };
    delete synced.columns;
    if (!declared.isToggleable) synced.isToggled = true;
    else if (item && typeof item.isToggled === 'boolean') synced.isToggled = item.isToggled;
    // A column that became "hidden by default" after the state was saved takes its new default.
    if (declared.type === 'column' && declared.isToggleable && item && item.isToggledHiddenByDefault === null && typeof declared.isToggledHiddenByDefault === 'boolean') synced.isToggled = !declared.isToggledHiddenByDefault;
    return synced;
}

/**
 * Column manager state from the browser (or the session), checked against the table's declared state: only declared columns
 * and groups are kept, every attribute but `isToggled` comes from the declaration, and a column that is not toggleable stays
 * visible. With `keepOrder` (reorderable columns that were reordered), the received order is kept, new columns are appended;
 * otherwise the declared order applies.
 */
export function syncColumnManagerState(declared: ColumnState[], state: unknown, keepOrder: boolean): ColumnState[] {
    const received = parseItems(state);
    const find = <T extends { type: string; name: string }>(items: T[], item: { type: string; name: string }): T | null => items.find((candidate) => keyOf(candidate) === keyOf(item)) ?? null;
    const group = (declaredGroup: ColumnState, receivedGroup: ReturnType<typeof parseItems>[number] | null): ColumnState => {
        const columns = declaredGroup.columns ?? [];
        const receivedColumns = receivedGroup?.columns ?? [];
        const ordered = keepOrder
            ? [...receivedColumns.map((column) => find(columns, column)).filter((column): column is ColumnState => column !== null), ...columns.filter((column) => !find(receivedColumns, column))]
            : columns;
        return { ...syncItem(receivedGroup, declaredGroup), isToggled: true, columns: ordered.map((column) => syncItem(find(receivedColumns, column), column)) };
    };
    const sync = (item: ColumnState) => { const match = find(received, item); return item.type === 'group' ? group(item, match) : syncItem(match, item); };
    if (!keepOrder) return declared.map(sync);
    const kept = received.map((item) => find(declared, item)).filter((item): item is ColumnState => item !== null);
    return [...kept, ...declared.filter((item) => !find(kept, item))].map(sync);
}

/** Column and group keys in state order, groups followed by their columns (Filament's `flattenTableColumnStateItems()`). */
function flatten(items: ColumnState[]): string[] {
    return items.flatMap((item) => [keyOf(item), ...(item.type === 'group' ? (item.columns ?? []).map((column) => `${keyOf(item)}:${column.name}`) : [])]);
}
/** Whether the state's order differs from the declared order (Filament's `hasReorderedTableColumns()`). */
export function hasReorderedColumns(declared: ColumnState[], state: ColumnState[]): boolean {
    const current = flatten(state);
    const defaults = flatten(declared).filter((key) => current.includes(key));
    return current.join('\n') !== defaults.join('\n');
}
/** Names of the columns in state order (groups expanded). */
export function columnOrderOf(state: ColumnState[]): string[] {
    return state.flatMap((item) => (item.type === 'group' ? (item.columns ?? []).map((column) => column.name) : [item.name]));
}
/** Whether each column is toggled on, by name (columns of groups included). */
export function columnToggleStateOf(state: unknown): Map<string, boolean> {
    const map = new Map<string, boolean>();
    for (const item of parseItems(state)) {
        if (item.type === 'group') { for (const column of item.columns ?? []) if (typeof column.isToggled === 'boolean') map.set(column.name, column.isToggled); }
        else if (typeof item.isToggled === 'boolean') map.set(item.name, item.isToggled);
    }
    return map;
}

/** Default width of the column manager: wider with more grid columns (Filament's `getColumnManagerWidth()`). */
export function defaultColumnManagerWidth(columns: number | Record<string, number | null>): string {
    return ({ 2: '2xl', 3: '4xl', 4: '6xl' } as Record<number, string>)[typeof columns === 'number' ? columns : -1] ?? 'xs';
}

/** Polling intervals accepted by `wire:poll` (`10s`, `500ms`…). */
export function sanitizePollingInterval(interval: string | null): string | null {
    if (interval === null) return null;
    const text = String(interval).trim();
    return /^\d+(\.\d+)?(ms|s)$/.test(text) ? text : null;
}
