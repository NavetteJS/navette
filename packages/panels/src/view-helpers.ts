// Helpers given to the EJS view of a component (a panel page with `static view`, or a component rendered outside a panel):
// Filament's `{{ $this->form }}`, `{{ $this->table }}`, `{{ $this->deleteAction }}`, `<x-filament-actions::modals />` and
// `@livewire(...)`. Views are rendered as async templates, so each helper is awaited: `<%- await schema('form') %>`.
import { Action, ActionGroup } from '@navette-js/actions';

/** A method of the component named after an action (`deleteAction()` or `delete()`), as Filament resolves `$this->deleteAction`. */
export function actionFromMethod(component: any, name: string): Action | ActionGroup | null {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return null;
    for (const method of [`${name}Action`, name]) {
        if (typeof component[method] !== 'function' || component[method].length > 0) continue;
        // Only the application's own methods: never one of the framework's (`mountAction()`, `callMountedAction()`…).
        if (!isApplicationMethod(component, method)) continue;
        const action = component[method]();
        if ((action instanceof Action || action instanceof ActionGroup) && (action.getName() === name || method === `${name}Action`)) return action;
    }
    return null;
}
/** Whether the method is declared by a class below the framework base class marked with `static isFrameworkBase = true`. */
function isApplicationMethod(component: any, method: string): boolean {
    for (let proto = Object.getPrototypeOf(component); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        if (Object.prototype.hasOwnProperty.call(proto.constructor, 'isFrameworkBase') && proto.constructor.isFrameworkBase === true) return false;
        if (Object.prototype.hasOwnProperty.call(proto, method)) return true;
    }
    return false;
}
/** Every action declared through a method named `<name>Action()` by the application's class (Filament's action methods). */
export function actionsFromMethods(component: any): (Action | ActionGroup)[] {
    const found = new Map<string, Action | ActionGroup>();
    for (let proto = Object.getPrototypeOf(component); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        if (Object.prototype.hasOwnProperty.call(proto.constructor, 'isFrameworkBase') && proto.constructor.isFrameworkBase === true) break;
        for (const method of Object.getOwnPropertyNames(proto)) {
            const match = /^([a-z][A-Za-z0-9_]*)Action$/.exec(method);
            if (!match || found.has(match[1])) continue;
            const action = actionFromMethod(component, match[1]);
            if (action) found.set(match[1], action);
        }
    }
    return [...found.values()];
}

/** The action context of a component outside any schema. */
const actionContext = (component: any, args: Record<string, unknown> = {}) => ({ livewire: component, component: null as any, operation: null, record: component.getActionRecord?.() ?? null, get: () => undefined, state: undefined, arguments: args });

/** Variables of a component view, besides the component itself. */
export function componentViewData(component: any): Record<string, unknown> {
    return {
        /** A schema of the component (`'form'`, `'infolist'`, any `<name>Schema()` method): Filament's `{{ $this->form }}`. */
        schema: async (name = 'form') => {
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || typeof component[`${name}Schema`] !== 'function') throw new Error(`schema('${name}'): the component has no ${name}Schema() method.`);
            return (await component.getSchema(name)).toHtml();
        },
        /** The component's table: Filament's `{{ $this->table }}`. */
        table: async () => {
            if (typeof component.renderTable !== 'function') throw new Error('table(): the component has no table (extend TableComponent).');
            return component.renderTable();
        },
        /**
         * An action button: `action('delete')` renders the action of `deleteAction()` (or `delete()`), or a header action of the
         * page with this name; `action('delete', { post: 1 })` passes arguments, as `{{ ($this->deleteAction)(['post' => 1]) }}`.
         */
        action: async (name: string, args: Record<string, unknown> = {}) => {
            const ctx = actionContext(component, args);
            let action: any = actionFromMethod(component, name);
            if (!action) {
                const candidates = await component.getMountableActions?.(component.getActionMountContext?.() ?? {}) ?? [];
                action = candidates.find((candidate: any) => candidate.getName?.() === name) ?? null;
            }
            if (!action) throw new Error(`action('${name}'): no action with this name on the component.`);
            if (Object.keys(args).length && typeof action.arguments === 'function') action.arguments(args);
            if (!(await action.isVisible(ctx))) return '';
            return action.toHtml(ctx);
        },
        /** The modals of the mounted actions: Filament's `<x-filament-actions::modals />`, once per component. */
        // A table renders the modals itself (with `table()`).
        modals: async () => (typeof component.renderActionModals !== 'function' || component.rendersActionModalsInPage?.() === false ? '' : component.renderActionModals()),
        /** A child component (a widget…), registered in the runtime: Filament's `@livewire(Widget::class, [...])`. */
        livewire: async (child: string | { name?: string; isLazy?: boolean }, params: Record<string, unknown> = {}, key: string | null = null) => {
            const name = typeof child === 'string' ? child : component._runtime?.nameOf(child);
            if (!name || !component._runtime?.has(name)) throw new Error(`livewire(): the component ${typeof child === 'string' ? child : child.name} is not registered.`);
            const lazy = typeof child === 'string' ? false : child.isLazy === true;
            return component.mountChild(name, params, `${component.id}.livewire.${key ?? name}`, { lazy });
        },
    };
}
