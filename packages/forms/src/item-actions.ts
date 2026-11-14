// Customizable actions of list fields (Repeater, Builder, KeyValue, CheckboxList), as Filament's `addAction(fn)`,
// `deleteAction(fn)`... A field builds each action with its defaults, then passes it to the developer's function.
import { Action } from '@navette-js/actions';
import { icons, type ColorManager } from '@navette-js/support';
import type { ComponentContext } from '@navette-js/schemas';

/** Function changing a field action: it receives the action and returns it (or nothing, after changing it in place). */
export type ActionModifier = ((action: Action) => Action | void) | null;

/** The action changed by the developer's function, if any. */
export function modifyAction(action: Action, modify: ActionModifier | undefined): Action {
    if (!modify) return action;
    const result = modify(action);
    return result instanceof Action ? result : action;
}

/** What the field needs to render one of its actions with its own markup. */
export type ResolvedAction = { visible: boolean; disabled: boolean; label: string; icon: string | null; color: string };

/** Visibility, label, icon and color of an action, in the context of one item (`arguments`). */
export async function resolveAction(action: Action, ctx: ComponentContext, args: Record<string, unknown> = {}): Promise<ResolvedAction> {
    const itemCtx = { ...ctx, arguments: args } as ComponentContext;
    return {
        visible: await action.isVisible(itemCtx),
        disabled: Boolean(await action.isDisabled(itemCtx)),
        label: await action.getLabel(itemCtx),
        icon: await action.getIcon(itemCtx),
        color: await action.getResolvedColor(itemCtx),
    };
}

/**
 * Color classes of a rendered action: the field's usual classes for its default color (so the markup stays the one of
 * Filament), the color manager's classes otherwise.
 */
export function colorClassesOf(colors: ColorManager | null, component: string, color: string, defaultColor: string, defaultClasses: string[]): string[] {
    if (color === defaultColor) return defaultClasses;
    return colors && color !== 'gray' ? colors.getComponentClasses(component as any, color) : (colors?.getComponentClasses(component as any, 'gray') ?? []);
}

/** Extra item actions, as Filament prepares them: gray small icon buttons unless they say otherwise. */
export function prepareExtraItemAction(action: Action): Action {
    action.defaultColor('gray').defaultSize('sm');
    if (action.getView() === null) action.iconButton();
    return action;
}

/** Default icons of the field actions, by component and action (Filament's `FormsIconAlias` names). */
const FIELD_ACTION_ICONS = {
    repeater: { clone: 'm-square-2-stack', collapse: 'm-chevron-up', delete: 'm-trash', expand: 'm-chevron-down', 'move-down': 'm-arrow-down', 'move-up': 'm-arrow-up', reorder: 'm-arrows-up-down' },
    builder: { clone: 'm-square-2-stack', collapse: 'm-chevron-up', delete: 'm-trash', edit: 'm-cog-6-tooth', expand: 'm-chevron-down', 'move-down': 'm-arrow-down', 'move-up': 'm-arrow-up', reorder: 'm-arrows-up-down' },
    'key-value': { delete: 'm-trash', reorder: 'm-arrows-up-down' },
} as const;
type FieldActionIcons = typeof FIELD_ACTION_ICONS;
/**
 * Icon of a field action: the one registered for its alias (`forms::components.repeater.actions.delete`, see
 * `icons.alias()`), else the default.
 */
export function fieldActionIcon<C extends keyof FieldActionIcons>(component: C, action: keyof FieldActionIcons[C] & string): string {
    return icons.resolve(`forms::components.${component}.actions.${action}`) ?? (FIELD_ACTION_ICONS[component] as Record<string, string>)[action];
}

/** Context for evaluating an item action (its `arguments` carry the item key). */
export const itemContext = (ctx: ComponentContext, args: Record<string, unknown>) => ({ ...ctx, arguments: args }) as ComponentContext;
