// Items of the user menu and the tenant menu: actions by key, in one or several groups (rendered as separate lists).
import { Action, ActionGroup } from '@navette-js/actions';

/** A menu item: an action, a group of actions, or a function customizing a default item (`logout: (action) => action.label('Sign out')`). */
export type MenuItem = Action | ActionGroup | ((action: Action) => Action | void);
/** Items by key, a list of actions, or a list of groups (each an object or a list). */
export type MenuItemInput = Record<string, MenuItem> | (Action | ActionGroup)[] | (Record<string, MenuItem> | (Action | ActionGroup)[])[];

const isGroupList = (items: unknown): items is (Record<string, MenuItem> | (Action | ActionGroup)[])[] =>
    Array.isArray(items) && items.length > 0 && items.every((entry) => Array.isArray(entry) || (entry !== null && typeof entry === 'object' && Object.getPrototypeOf(entry) === Object.prototype));

/** The registered items of a menu, in groups. */
export class MenuItemGroups {
    private groups: Map<string, MenuItem>[] = [];
    private anonymous = 0;
    /** Adds items: a list of groups adds groups; anything else goes into the last group (keys already there are replaced). */
    add(items: MenuItemInput): this {
        if (isGroupList(items)) { for (const group of items) this.groups.push(this.entries(group)); return this; }
        if (Array.isArray(items) && !items.length) return this;
        const entries = this.entries(items as Record<string, MenuItem> | (Action | ActionGroup)[]);
        if (!this.groups.length) this.groups.push(new Map());
        const last = this.groups[this.groups.length - 1];
        for (const [key, item] of entries) { for (const group of this.groups) group.delete(key); last.set(key, item); }
        return this;
    }
    private entries(items: Record<string, MenuItem> | (Action | ActionGroup)[]): Map<string, MenuItem> {
        const list: [string, MenuItem][] = Array.isArray(items)
            ? items.map((item) => [item instanceof Action ? item.getName() : `group-${this.anonymous++}`, item])
            : Object.entries(items);
        for (const [key, item] of list) if (!(item instanceof Action) && !(item instanceof ActionGroup) && typeof item !== 'function') throw new Error(`Menu item "${key}": expected an Action, an ActionGroup or a function.`);
        return new Map(list);
    }
    count(): number { return this.groups.filter((group) => group.size).length; }
    /** Every item by key. */
    flat(): Record<string, MenuItem> { return Object.fromEntries(this.groups.flatMap((group) => [...group])); }
    has(key: string): boolean { return this.groups.some((group) => group.has(key)); }
    /**
     * The groups with their actions: functions customize the default item of their key; defaults whose key is not
     * registered go at the start of the first group (`placement: 'start'`) or at the end of the last one.
     */
    resolve(defaults: { key: string; action: Action | null; placement: 'start' | 'end' }[]): [string, Action | ActionGroup][][] {
        const byKey = new Map(defaults.map((entry) => [entry.key, entry.action]));
        const groups = this.groups.filter((group) => group.size).map((group) => [...group].flatMap(([key, item]): [string, Action | ActionGroup][] => {
            if (typeof item !== 'function') return [[key, item]];
            const base = byKey.get(key);
            if (base === null) return [];
            const action = base ?? Action.make(key);
            const result = item(action);
            return [[key, result instanceof Action ? result : action]];
        }));
        for (const { key, action, placement } of defaults) {
            if (!action || this.has(key)) continue;
            if (!groups.length) groups.push([]);
            if (placement === 'start') groups[0].unshift([key, action]);
            else groups[groups.length - 1].push([key, action]);
        }
        return groups.filter((group) => group.length);
    }
}
