// Rich editor toolbar tools: a button running JavaScript in the editor, or mounting an action of the field.
import { Attributes, e, icon, js } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';

/** Plain description of a tool (the built-in tools are generated from Filament's definitions). */
export type RichEditorToolDefinition = {
    name: string;
    /** Translation key of the label. */
    label?: string;
    jsHandler?: string;
    /** Arguments of the field action mounted on click, as a JavaScript object expression. */
    action?: string;
    toggle?: boolean;
    icon?: string;
    /** Icon alias (`icons.alias()`) that can replace the icon. */
    iconAlias?: string;
    activeKey?: string;
    activeOptions?: Record<string, unknown>;
    activeJsExpression?: string;
    activeStyling?: boolean;
    disabledWhenNotActive?: boolean;
    extraAttributes?: Record<string, string>;
};

/**
 * A toolbar button. `jsHandler()` runs code in the browser, where `$getEditor()` is the TipTap editor;
 * `action()` mounts an action of the field (add it with `RichEditor.registerActions()`), with the editor selection.
 */
export class RichEditorTool {
    protected _name: string;
    protected _label: string | null = null;
    protected _labelKey: string | null = null;
    protected _icon: string | null = null;
    protected _iconAlias: string | null = null;
    protected _jsHandler: string | null = null;
    protected _toggle = false;
    protected _activeKey: string | null = null;
    protected _activeOptions: Record<string, unknown> = {};
    protected _activeJsExpression: string | null = null;
    protected _activeStyling = true;
    protected _disabledWhenNotActive = false;
    protected _hiddenLabel = true;
    protected _extraAttributes: Record<string, string> = {};
    constructor(name: string) { this._name = name; }
    static make(name: string): RichEditorTool { return new this(name); }
    static fromDefinition(definition: RichEditorToolDefinition): RichEditorTool {
        const tool = new this(definition.name);
        tool._labelKey = definition.label ?? null;
        tool._icon = definition.icon ?? null;
        tool._iconAlias = definition.iconAlias ?? null;
        if (definition.jsHandler) tool.jsHandler(definition.jsHandler);
        if (definition.action !== undefined) tool.action(null, definition.action);
        tool._toggle = definition.toggle === true;
        tool._activeKey = definition.activeKey ?? null;
        tool._activeOptions = definition.activeOptions ?? {};
        tool._activeJsExpression = definition.activeJsExpression ?? null;
        tool._activeStyling = definition.activeStyling !== false;
        tool._disabledWhenNotActive = definition.disabledWhenNotActive === true;
        tool._extraAttributes = { ...(definition.extraAttributes ?? {}) };
        return tool;
    }
    getName(): string { return this._name; }
    label(label: string | null): this { this._label = label; this._labelKey = null; return this; }
    getLabel(): string {
        if (this._label !== null) return this._label;
        if (this._labelKey) return t(`navette-forms::${this._labelKey.replace(/^navette-forms::/, '')}`);
        return this._name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
    }
    /** Shows the label next to the icon (by default, it is a tooltip). */
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    /** Icon alias: the icon registered for it with `icons.alias()` replaces `icon()`. */
    iconAlias(alias: string | null): this { this._iconAlias = alias; return this; }
    /** JavaScript run on click: `$getEditor()?.chain().focus().toggleBold().run()`. */
    jsHandler(handler: string | null): this { this._jsHandler = handler; return this; }
    /** Mounts the field action `name` (the tool's name by default) with the editor selection and these arguments (a JavaScript object expression). */
    action(name: string | null = null, argumentsJs: string | null = null): this {
        this._jsHandler = `mountToolAction(${js(name ?? this._name)}, { editorSelection, ...${argumentsJs ?? '{}'} }, $el)`;
        return this;
    }
    /** The button is a toggle (`aria-pressed`). */
    toggle(condition = true): this { this._toggle = condition; return this; }
    /** Node or mark whose presence marks the button as active (its name by default), with its attributes. */
    activeKey(key: string | null): this { this._activeKey = key; return this; }
    activeOptions(options: Record<string, unknown>): this { this._activeOptions = options; return this; }
    /** JavaScript expression telling whether the button is active. */
    activeJsExpression(expression: string | null): this { this._activeJsExpression = expression; return this; }
    activeStyling(condition = true): this { this._activeStyling = condition; return this; }
    disabledWhenNotActive(condition = true): this { this._disabledWhenNotActive = condition; return this; }
    extraAttributes(attributes: Record<string, string>): this { Object.assign(this._extraAttributes, attributes); return this; }
    getExtraAttributes(): Record<string, string> { return { ...this._extraAttributes }; }
    getIcon(): string | null { return this._icon; }
    getIconAlias(): string | null { return this._iconAlias; }
    getJsHandler(): string | null { return this._jsHandler; }
    isToggle(): boolean { return this._toggle; }
    hasActiveStyling(): boolean { return this._activeStyling; }
    isDisabledWhenNotActive(): boolean { return this._disabledWhenNotActive; }
    getActiveKey(): string { return this._activeKey ?? this._name; }
    getActiveOptions(): Record<string, unknown> { return { ...this._activeOptions }; }
    /** JavaScript expression, true while the tool is active (re-evaluated on each editor update). */
    getActiveExpression(): string {
        return this._activeJsExpression
            ? `editorUpdatedAt && (${this._activeJsExpression})`
            : `editorUpdatedAt && $getEditor()?.isActive(${js(this._activeKey ?? this._name)}, ${Object.keys(this._activeOptions).length ? js(this._activeOptions) : '[]'})`;
    }
    getIconHtml(): string { return this._icon ? icon(this._icon, { alias: this._iconAlias ?? undefined }) : ''; }
    toHtml(): string {
        const active = this.getActiveExpression();
        const label = this.getLabel();
        const attributes = new Attributes(this._extraAttributes).merge({
            'data-rich-editor-tool': this._name,
            tabindex: '-1',
            type: 'button',
            'aria-label': label,
            'aria-pressed': this._toggle ? 'false' : null,
            'x-bind:class': `{ 'nv-active': ${this._activeStyling ? active : 'false'} }`,
            'x-bind:aria-pressed': this._toggle ? `(${active}) ? 'true' : 'false'` : null,
            'x-bind:disabled': this._disabledWhenNotActive ? `!(${active})` : null,
            'x-on:click': this._jsHandler,
            'x-tooltip': label && this._hiddenLabel ? `{ content: ${js(label)}, theme: $store.theme }` : null,
        }).class(['nv-fo-rich-editor-tool', { 'nv-fo-rich-editor-tool-with-label': !this._hiddenLabel }]);
        return `<button ${attributes.toHtml()}>${this.getIconHtml()}${this._hiddenLabel ? '' : `<span class="nv-fo-rich-editor-tool-label">${e(label)}</span>`}</button>`;
    }
}
