// Rich editor toolbars: dropdown groups of tools (`ToolbarButtonGroup`), plugins (`RichContentPlugin`), and the enable / disable
// modifications applied to the toolbar buttons, as Filament's `InteractsWithToolbarButtons`.
import { Attributes, e, icon, js } from '@navette-js/support';
import type { Extensions } from '@tiptap/core';
import type { Action } from '@navette-js/actions';
import type { RichEditorTool } from './rich-editor-tool.ts';

/**
 * Tools of the toolbar shown in a dropdown: `ToolbarButtonGroup.make('Alignment', ['alignStart', 'alignCenter', 'alignEnd'])`.
 * The trigger shows the icon of the first tool (then of the active one), or a fixed `icon()`.
 */
export class ToolbarButtonGroup {
    protected _label: string;
    protected _buttons: string[];
    protected _icon: string | null = null;
    protected _textualButtons = false;
    protected _extraAttributes: Record<string, string> = {};
    protected _resolved: RichEditorTool[] = [];
    constructor(label: string, buttons: string[] = []) { this._label = label; this._buttons = [...buttons]; }
    static make(label: string, buttons: string[] = []): ToolbarButtonGroup { return new this(label, buttons); }
    buttons(buttons: string[]): this { this._buttons = [...buttons]; return this; }
    getButtons(): string[] { return this._buttons; }
    /** Label of the dropdown: its tooltip and accessible name. */
    getName(): string { return this._label; }
    getLabel(): string { return this._label; }
    /** Fixed icon of the trigger (it then no longer follows the active tool). */
    icon(name: string | null): this { this._icon = name; return this; }
    getIcon(): string | null { return this._icon; }
    /** Shows each tool's label next to its icon, in a vertical menu. */
    textualButtons(condition = true): this { this._textualButtons = condition; return this; }
    hasTextualButtons(): boolean { return this._textualButtons; }
    extraAttributes(attributes: Record<string, string>): this { Object.assign(this._extraAttributes, attributes); return this; }
    /** Copy holding only the given buttons. */
    withButtons(buttons: string[]): ToolbarButtonGroup {
        const copy = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as ToolbarButtonGroup;
        copy._buttons = [...buttons];
        copy._extraAttributes = { ...this._extraAttributes };
        return copy;
    }
    /** Finds the tools of the group among the editor's tools (unknown names are skipped). */
    resolve(find: (name: string) => RichEditorTool | null): this { this._resolved = this._buttons.map(find).filter((tool): tool is RichEditorTool => tool !== null); return this; }
    getResolvedButtons(): RichEditorTool[] { return this._resolved; }

    toHtml(): string {
        const tools = this._resolved;
        if (!tools.length) return '';
        const label = this._label;
        const first = tools[0];
        const defaultContent = this._icon ? icon(this._icon) : first.getIconHtml();
        const triggerEffect = `triggerContent = (() => { ${tools.map((tool) => `if (${tool.getActiveExpression()}) return ${js(tool.getIconHtml())};`).join(' ')} return ${js(defaultContent)}; })()`;
        const groupActive = tools.map((tool) => `(${tool.getActiveExpression()})`).join(' || ');
        const trigger = new Attributes(this._extraAttributes).merge({
            type: 'button', tabindex: '-1', 'data-rich-editor-tool': label, 'aria-label': label,
            'x-bind:class': `{ 'fi-active': ${groupActive} }`,
            'x-tooltip': `{ content: ${js(label)}, theme: $store.theme }`,
        }).class(['fi-fo-rich-editor-dropdown-tool-trigger']);
        const textual = this._textualButtons;
        const items = tools.map((tool) => {
            const active = tool.getActiveExpression();
            const toolLabel = tool.getLabel();
            const attributes = new Attributes(tool.getExtraAttributes()).merge({
                tabindex: '-1', type: 'button',
                role: tool.isToggle() ? 'menuitemcheckbox' : 'menuitem',
                'aria-label': toolLabel,
                'aria-checked': tool.isToggle() ? 'false' : null,
                'x-bind:aria-checked': tool.isToggle() ? `(${active}) ? 'true' : 'false'` : null,
                'x-bind:aria-disabled': tool.isDisabledWhenNotActive() ? `!(${active}) ? 'true' : 'false'` : null,
                'x-on:click': `$event.stopPropagation(); if ($el.getAttribute('aria-disabled') === 'true') return; Alpine.$data($el.closest('.fi-dropdown')).closeMenuHierarchy(); ${tool.getJsHandler() ?? ''}`,
                'x-bind:class': `{ 'fi-active': ${tool.hasActiveStyling() ? active : 'false'} }`,
                'x-tooltip': textual ? null : `{ content: ${js(toolLabel)}, theme: $store.theme }`,
            }).class(['fi-dropdown-list-item', 'fi-fo-rich-editor-dropdown-tool-option']);
            return `<button ${attributes.toHtml()}>${tool.getIconHtml()}${textual ? ` <span>${e(toolLabel)}</span>` : ''}</button>`;
        }).join('');
        const chevron = '<svg class="fi-fo-rich-editor-dropdown-tool-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        return `<div x-data="${e(`{ ...filamentDropdown(), triggerContent: ${js(defaultContent)} }`)}" x-effect="${e(triggerEffect)}" class="fi-dropdown fi-fo-rich-editor-dropdown-tool${textual ? ' fi-fo-rich-editor-dropdown-tool-textual' : ''}"><div class="fi-dropdown-trigger" x-on:mousedown="if ($event.button === 0) toggle($event)"><button ${trigger.toHtml()}><span x-html="triggerContent">${defaultContent}</span>${chevron}</button></div><div x-cloak x-ref="panel" x-float.placement.bottom-start.flip="{ offset: 4 }" aria-orientation="${textual ? 'vertical' : 'horizontal'}" x-on:keydown.capture="handleToolbarMenuKeydown($event)" class="fi-dropdown-panel fi-fo-rich-editor-dropdown-tool-panel"><div class="fi-fo-rich-editor-dropdown-tool-menu">${items}</div></div></div>`;
    }
}

/**
 * A rich editor plugin: TipTap extensions for the server schema (sanitizing and rendering) and for the browser, toolbar tools,
 * and the actions those tools mount. Pass it to `RichEditor.plugins()` and `RichContentRenderer.plugins()`.
 */
export interface RichContentPlugin {
    /** Server-side TipTap extensions (Filament's `getTipTapPhpExtensions()`): the nodes and marks kept when the content is saved. */
    getTipTapServerExtensions(): Extensions;
    /** URLs of browser ES modules exporting a TipTap extension (or an array of them). */
    getTipTapJsExtensions(): string[];
    getEditorTools(): RichEditorTool[];
    getEditorActions(): Action[];
    /** Optional (`HasToolbarButtons`): buttons added to the toolbar, as in `enableToolbarButtons()`. */
    getEnabledToolbarButtons?(): ToolbarItems;
    /** Optional (`HasToolbarButtons`): buttons removed from the toolbar, as in `disableToolbarButtons()`. */
    getDisabledToolbarButtons?(): string[];
}

/** A toolbar entry: a tool name, a dropdown group, or a group of them. */
export type ToolbarItem = string | ToolbarButtonGroup;
export type ToolbarItems = (ToolbarItem | ToolbarItem[])[];
export type ToolbarModification = { type: 'disableAll' } | { type: 'disable'; buttons: string[] } | { type: 'enable'; buttons: ToolbarItems };

const hasButton = (items: ToolbarItems, button: string): boolean => items.some((item) => (Array.isArray(item) ? hasButton(item, button) : typeof item === 'string' ? item === button : item.getButtons().includes(button)));
const withoutButtons = (item: ToolbarItem, disabled: string[]): ToolbarItem | null => {
    if (typeof item === 'string') return disabled.includes(item) ? null : item;
    const buttons = item.getButtons().filter((button) => !disabled.includes(button));
    return buttons.length ? (buttons.length === item.getButtons().length ? item : item.withButtons(buttons)) : null;
};

/**
 * Applies the modifications in order (plugins first, then the field's own), then groups the buttons: consecutive single
 * entries form one group, arrays are groups of their own.
 */
export function applyToolbarModifications(buttons: ToolbarItems, modifications: ToolbarModification[]): ToolbarItem[][] {
    let items = buttons;
    for (const modification of modifications) {
        if (modification.type === 'disableAll') items = [];
        else if (modification.type === 'disable') {
            items = items.flatMap((item): (ToolbarItem | ToolbarItem[])[] => {
                if (!Array.isArray(item)) { const kept = withoutButtons(item, modification.buttons); return kept === null ? [] : [kept]; }
                const group = item.map((entry) => withoutButtons(entry, modification.buttons)).filter((entry): entry is ToolbarItem => entry !== null);
                return group.length ? [group] : [];
            });
        } else {
            const added = [...items];
            for (const item of modification.buttons) {
                if (Array.isArray(item)) {
                    const group: ToolbarItem[] = [];
                    for (const entry of item) if (typeof entry !== 'string' || (!hasButton(added, entry) && !group.includes(entry))) group.push(entry);
                    if (group.length) added.push(group);
                } else if (typeof item !== 'string' || !hasButton(added, item)) added.push(item);
            }
            items = added;
        }
    }
    const toolbar: ToolbarItem[][] = [];
    let pending: ToolbarItem[] = [];
    for (const item of items) {
        if (!Array.isArray(item)) { pending.push(item); continue; }
        if (pending.length) { toolbar.push(pending); pending = []; }
        if (item.length) toolbar.push(item);
    }
    if (pending.length) toolbar.push(pending);
    return toolbar;
}
/** Names of the tools of toolbar entries (inside dropdown groups too). */
export function toolbarButtonNames(items: ToolbarItems): string[] { return items.flatMap((item) => (Array.isArray(item) ? toolbarButtonNames(item) : typeof item === 'string' ? [item] : item.getButtons())); }
