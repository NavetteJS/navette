// Panels a resource or page class is registered in. One class may be registered in several panels: its URLs, policies and
// authorization then follow the panel of the current request (`getCurrentPanel()`), and `getUrl(..., { panel })` targets another.
import type { Panel } from './index.ts';
import { getCurrentPanel } from './plugins.ts';

const registrations = new WeakMap<Function, Panel[]>();
/** Marks a class registered itself (not only through a parent class). */
const PANELS = Symbol('navette.panels');

/** Records that a resource or page class is registered in a panel (`panel.resources()`, `panel.pages()`). */
export function registerComponentPanel(cls: Function, panel: Panel): void {
    const panels = Object.hasOwn(cls, PANELS) ? registrations.get(cls) ?? [] : [];
    if (!panels.includes(panel)) registrations.set(cls, [...panels, panel]);
    Object.defineProperty(cls, PANELS, { value: true, configurable: true, enumerable: false });
}
/** Panels a class is registered in, in registration order; a subclass that is not registered itself has its parent's. */
export function getComponentPanels(cls: Function): Panel[] {
    for (let current: any = cls; current && current !== Function.prototype; current = Object.getPrototypeOf(current)) {
        if (Object.hasOwn(current, PANELS)) return registrations.get(current) ?? [];
    }
    return [];
}

/**
 * Panel of a class: the current request's panel when the class is registered in it, otherwise the last panel it was
 * registered in (outside a request), otherwise the current panel. `undefined` for a class registered nowhere.
 */
export function resolveComponentPanel(cls: Function): Panel | undefined {
    const panels = getComponentPanels(cls);
    const current = getCurrentPanel();
    if (current && panels.includes(current)) return current;
    return panels[panels.length - 1] ?? current ?? undefined;
}

/** A panel given to `getUrl()`: a panel, or the id of a panel the class is registered in. */
export function findComponentPanel(cls: Function, panel: Panel | string): Panel {
    if (typeof panel !== 'string') return panel;
    const found = getComponentPanels(cls).find((candidate) => candidate.getId() === panel) ?? (getCurrentPanel()?.getId() === panel ? getCurrentPanel()! : undefined);
    if (!found) throw new Error(`${cls.name} is not registered in a panel with the id "${panel}".`);
    return found;
}
