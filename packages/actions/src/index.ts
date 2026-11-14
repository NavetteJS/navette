// @navette-js/actions — actions: buttons, links, menu items and modal actions.
import { Attributes, HtmlString, cls, e, evaluate, icon, icons, js, loadingIndicator, renderHook, views, type ColorManager, type Lazy, configured, configureUsing } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import type { ComponentContext, Renderable } from '@navette-js/schemas';
import { fileURLToPath } from 'node:url';
import { AuthorizationResponse } from './authorization.ts';
import { addAttributeSet, mergeAttributeSets, mergeIntoRootTag, attributesToHtml, type ExtraAttributes } from './extra-attributes.ts';
export { AuthorizationResponse, isAllowed } from './authorization.ts';
export { mergeIntoRootTag, mergeAttributeSets, attributesToHtml, type ExtraAttributes } from './extra-attributes.ts';

/** Policy abilities required by `authorize('update')` (all) or `authorizeAny([...])` (one). */
type ActionAuthorization = { type: 'all' | 'any'; abilities: string[]; arguments: unknown[] };
const isAbilityAuthorization = (value: unknown): value is ActionAuthorization => typeof value === 'object' && value !== null && !(value instanceof AuthorizationResponse) && Array.isArray((value as ActionAuthorization).abilities);

views.namespace('filament-actions', fileURLToPath(new URL('../views', import.meta.url)));

/** Render hook slots of an action modal. Hooks receive the action as `data.action`. */
export const ActionsRenderHook = {
    MODAL_CUSTOM_CONTENT_AFTER: 'actions::modal.custom-content.after',
    MODAL_CUSTOM_CONTENT_BEFORE: 'actions::modal.custom-content.before',
    MODAL_CUSTOM_CONTENT_FOOTER_AFTER: 'actions::modal.custom-content-footer.after',
    MODAL_CUSTOM_CONTENT_FOOTER_BEFORE: 'actions::modal.custom-content-footer.before',
    MODAL_SCHEMA_AFTER: 'actions::modal.schema.after',
    MODAL_SCHEMA_BEFORE: 'actions::modal.schema.before',
} as const;
let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };
let csrfTokenResolver: ((ctx: ComponentContext) => string | null) | null = null;
/** Gives `postToUrl()` actions the CSRF token of the request (set by the panel router). */
export const useCsrfToken = (resolver: ((ctx: ComponentContext) => string | null) | null) => { csrfTokenResolver = resolver; };
/** `<form>` sending a `POST` request to the URL, with the CSRF token: the markup of a `postToUrl()` action. */
function postForm(url: string, ctx: ComponentContext, formClasses: string[], button: string): string {
    const token = csrfTokenResolver?.(ctx) ?? null;
    return `<form action="${e(url)}" method="post"${formClasses.length ? ` class="${formClasses.join(' ')}"` : ''}>${token !== null ? `<input type="hidden" name="_token" value="${e(token)}" autocomplete="off">` : ''}${button}</form>`;
}

/** Execution context of a mounted action. */
export type ActionCallContext = { livewire: any; record: any; arguments: Record<string, unknown>; data: Record<string, unknown>; /** The action being run. */ action?: Action; /** Form data of the parent action, for an action of its modal footer (changes are kept). */ parentData?: Record<string, unknown>; /** For an action of a form component (affix action...): the component's state. */ state?: unknown; /** For an action of a form component: changes a field of the same form (`set('slug', value)`). */ set?: (name: string, value: unknown) => void; get?: (name: string) => unknown; /** The modal's form, once validated (to save its relationships). */ schema?: any; /** For an action of a schema component: the component (a Repeater for its item actions...). */ component?: any };
/** Message of a bulk notification, from the number of records concerned and the number of selected records. */
export type BulkMessage = string | ((count: number, total: number) => string);

/**
 * Thrown by `action.halt()` (the modal stays open) and `action.cancel()` (the modal closes) to stop an action from one of
 * its hooks. The host component catches it.
 */
export class ActionHalt extends Error {
    readonly closesModal: boolean;
    /** The database transaction of the action (`databaseTransaction()`) is rolled back instead of committed. */
    readonly rollsBackDatabaseTransaction: boolean;
    constructor(closesModal: boolean, rollsBackDatabaseTransaction = false) { super(closesModal ? 'Action cancelled.' : 'Action halted.'); this.closesModal = closesModal; this.rollsBackDatabaseTransaction = rollsBackDatabaseTransaction; }
}

export class Action implements Renderable {
    /** Default setup for every instance created afterwards by `make()`, e.g. `Action.configureUsing((action) => action.size('sm'))`. */
    static configureUsing<T>(this: abstract new (...args: any[]) => T, configure: (instance: T) => void): void { configureUsing(this, configure); }
    private name: string;
    private _label: Lazy<string | null, ComponentContext> = null;
    private _color = 'primary';
    private _size = 'md';
    private _submit: string | null = null;
    private _hidden: Lazy<boolean, ComponentContext> = false;
    private _visible: Lazy<boolean, ComponentContext> = true;
    private _disabled: Lazy<boolean, ComponentContext> = false;
    private _url: string | null = null;
    private _action: string | null = null;
    private _handler: ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null = null;
    private _requiresConfirmation = false;
    private _modalHeading: Lazy<string | null, ActionCallContext> = null;
    private _modalDescription: Lazy<string | HtmlString | null, ActionCallContext> = null;
    private _modalSubmitActionLabel: string | null = null;
    private _lazySubmitLabel: ((ctx: ActionCallContext) => string | null) | null = null;
    private _modalIcon: string | null = null;
    private _icon: string | null = null;
    private _alpineClick: string | null = null;
    private _keyBindings: string[] = [];
    private _schema: ((schema: any, ctx: { arguments: Record<string, unknown> }) => any) | null = null;
    private _extraModalFooterActions: Action[] | ((action: Action) => Action[]) = [];
    private _schemaColumns: Record<string, number> | number | null = {};
    private _fillForm: ((ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>) | null = null;
    private _modalWidth: string | null = null;
    private _lazyUrl: ((ctx: ComponentContext) => string | null) | null = null;
    private _tableIcon: string | null = null;
    private _groupedIcon: string | null = null;
    private _lazyColor: ((ctx: ComponentContext) => string | Promise<string>) | null = null;
    private _lazyIcon: ((ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;

    constructor(name: string) { this.name = name; }
    static make(name: string): Action { return configured(new Action(name)); }
    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    /** Pass a function to make the color depend on the record (row actions). */
    color(color: string | ((ctx: ComponentContext) => string | Promise<string>)): this { this._colorSet = true; if (typeof color === 'function') this._lazyColor = color; else { this._color = color; this._lazyColor = null; } return this; }
    size(size: string): this { this._sizeSet = true; this._size = size; return this; }
    private _colorSet = false;
    private _sizeSet = false;
    /** Color used unless `color()` was called (set by the component that renders the action). */
    defaultColor(color: string): this { if (!this._colorSet) this._color = color; return this; }
    /** Size used unless `size()` was called. */
    defaultSize(size: string): this { if (!this._sizeSet) this._size = size; return this; }
    /** Color in this context (a color function is evaluated). */
    async getResolvedColor(ctx: ComponentContext): Promise<string> { return this._lazyColor ? this._lazyColor(ctx) : this._color; }
    private _arguments: Record<string, unknown> = {};
    /**
     * Arguments sent with the click (`mountAction(name, arguments)`), received by the handler as `arguments`. A component
     * sets them when it renders the action for one of its items (`{ item: key }`); they come back from the browser, so the
     * handler checks them again.
     */
    arguments(args: Record<string, unknown>): this { this._arguments = args; return this; }
    getArguments(): Record<string, unknown> { return this._arguments; }
    /** `mountAction(...)` expression of this action, with its arguments and a mount context. */
    private mountExpressionFor(mountContext: Record<string, unknown>): string {
        const hasArguments = Object.keys(this._arguments).length > 0;
        if (Object.keys(mountContext).length) return `mountAction(${js(this.name)}, ${hasArguments ? js(this._arguments) : '{}'}, ${js(mountContext)})`;
        return hasArguments ? `mountAction(${js(this.name)}, ${js(this._arguments)})` : `mountAction(${js(this.name)})`;
    }
    /** Renders a `type="submit"` button that triggers the form's submit method, e.g. `.submit('authenticate')`. */
    submit(form: string | null): this { this._submit = form; return this; }
    private _formId: string | null = null;
    /** Id of the `<form>` a submit button belongs to when it is rendered outside of it (a page header): `form="<id>"`. */
    formId(id: string | null): this { this._formId = id; return this; }
    getFormId(): string | null { return this._formId; }
    hasFormId(): boolean { return this._formId !== null; }
    canSubmitForm(): boolean { return this._submit !== null; }
    getFormToSubmit(): string | null { return this._submit; }
    hidden(condition: Lazy<boolean, ComponentContext> = true): this { this._hidden = condition; return this; }
    /** Navigation action, rendered as `<a href wire:navigate>`. */
    url(url: string | null | ((ctx: ComponentContext) => string | null)): this { if (typeof url === 'function') this._lazyUrl = url; else { this._url = url; this._lazyUrl = null; } return this; }
    /** A string: host component method called on click (`wire:click`). A function: the action handler, mounted through `mountAction()` (with its modal, if any). */
    /** On click, dispatches a Livewire event (to a listener of the page or of another component), with parameters. */
    dispatch(event: string, params: unknown[] | Record<string, unknown> = []): this { return this.action(`$dispatch(${js(event)}${Array.isArray(params) ? params.map((param) => `, ${js(param)}`).join('') : `, ${js(params)}`})`); }
    action(action: string | ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null): this {
        if (typeof action === 'function') { this._handler = action; this._action = null; } else { this._action = action; this._handler = null; }
        return this;
    }
    icon(name: string | null | ((ctx: ComponentContext) => string | null | Promise<string | null>)): this { if (typeof name === 'function') this._lazyIcon = name; else { this._icon = name; this._lazyIcon = null; } return this; }
    /** Icon used when the action is a table row link. */
    tableIcon(name: string | null): this { this._tableIcon = name; return this; }
    private _iconButton = false;
    /** Icon used when the action is a menu item (ActionGroup). */
    groupedIcon(name: string | null): this { this._groupedIcon = name; return this; }
    requiresConfirmation(condition = true): this { this._requiresConfirmation = condition; return this; }
    modalHeading(heading: Lazy<string | null, ActionCallContext>): this { this._modalHeading = heading; return this; }
    /** Text under the heading; an `HtmlString` is inserted as is (build it from escaped values). */
    modalDescription(description: Lazy<string | HtmlString | null, ActionCallContext>): this { this._modalDescription = description; return this; }
    /** Label of the submit button; a function receives the action context (its arguments…). */
    modalSubmitActionLabel(label: string | null | ((ctx: ActionCallContext) => string | null)): this { if (typeof label === 'function') { this._lazySubmitLabel = label; this._modalSubmitActionLabel = null; } else { this._modalSubmitActionLabel = label; this._lazySubmitLabel = null; } return this; }
    modalIcon(name: string | null): this { this._modalIcon = name; return this; }
    private _badge: string | number | null | (() => string | number | null | Promise<string | number | null>) = null;
    private _badgeColor = 'primary';
    /** Color of the counter set with `badge(value)`. */
    badgeColor(color: string): this { this._badgeColor = color; return this; }
    private _slideOver = false;
    private _hasSubmit = true;
    /** Opens the modal as a slide-over panel. */
    slideOver(condition = true): this { this._slideOver = condition; return this; }
    /** `false`: read-only modal, without a submit button. A function changes the submit button (`(action) => action.label('Send')`). */
    modalSubmitAction(action: boolean | ((action: Action) => Action | false | void)): this {
        if (typeof action === 'function') { this._modalSubmitCustomizer = action; this._hasSubmit = true; } else { this._hasSubmit = action; this._modalSubmitCustomizer = null; }
        return this;
    }
    private _cancelLabel: string | null = null;
    /** Label of the modal's close button ("Cancel" by default). */
    modalCancelActionLabel(label: string | null): this { this._cancelLabel = label; return this; }
    private _tooltip: Lazy<string | null, ComponentContext> = null;
    private _newTab = false;
    /** Tooltip shown on hover. */
    tooltip(text: Lazy<string | null, ComponentContext>): this { this._tooltip = text; return this; }
    /** Opens the action's URL in a new tab. */
    openUrlInNewTab(condition = true): this { this._newTab = condition; return this; }
    private _postToUrl = false;
    /** Sends a `POST` request to the action's URL (a form with the CSRF token) instead of following a link. */
    postToUrl(condition = true): this { this._postToUrl = condition; return this; }
    shouldPostToUrl(): boolean { return this._postToUrl; }
    shouldOpenUrlInNewTab(): boolean { return this._newTab; }
    private async tooltipAttribute(ctx: ComponentContext): Promise<string> {
        const text = await this.getTooltip(ctx);
        return text ? `x-tooltip="${e(`{
 content: ${js(text)},
 theme: $store.theme,
 allowHTML: false,
 }`)}" ` : '';
    }
    private _modalIconColor: string | null = null;
    /** Color of the modal icon; defaults to the action's color. */
    modalIconColor(color: string | null): this { this._modalIconColor = color; return this; }
    getColor(): string { return this._color; }
    async getLabel(ctx: ComponentContext): Promise<string> { return (await evaluate(this._label, ctx)) ?? this.getDefaultLabel(); }
    async getIcon(ctx: ComponentContext): Promise<string | null> { return this._lazyIcon ? this._lazyIcon(ctx) : this._icon; }
    private _sort = 0;
    /** Position in a menu (user menu, tenant menu); negative values go before the theme switcher or the tenant list. */
    sort(sort: number): this { this._sort = sort; return this; }
    getSort(): number { return this._sort; }
    /**
     * Item of a panel menu (user menu, tenant menu): a link, a `postToUrl()` form, or a button mounting the action on the
     * menu's component (its modal opens there). Links only keep http(s) URLs and site paths.
     */
    async toMenuItemHtml(ctx: ComponentContext, options: { navigate?: boolean } = {}): Promise<string> { return this.withExtraAttributes(await this.renderMenuItemHtml(ctx, options), ctx); }
    private async renderMenuItemHtml(ctx: ComponentContext, options: { navigate?: boolean }): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const href = this.resolveUrl(ctx);
        const iconName = await this.getIcon(ctx);
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const colors = color !== 'gray' && color !== 'primary' ? colorManager.getComponentClasses('dropdown-item', color) : [];
        const glyph = iconName ? icon(iconName, { attributes: new Attributes().class(colors.length ? ['fi-color', `fi-color-${color}`] : []) }) : '';
        const label = `<span class="fi-dropdown-list-item-label">${e(await this.getLabel(ctx))}</span>`;
        const tooltip = await this.tooltipAttribute(ctx);
        const disabled = this._disabled !== false && (await this.isDisabled(ctx));
        if (href !== null) {
            if (!/^(\/(?!\/)|https?:\/\/)/.test(href)) return '';
            if (this._postToUrl) return postForm(href, ctx, ['fi-ac-grouped-action'], `<button ${tooltip}role="menuitem" tabindex="-1" type="submit"${disabled ? ' disabled aria-disabled="true"' : ''} class="${cls(['fi-dropdown-list-item', ...colors, { 'fi-disabled': disabled }])}">${glyph}${label}</button>`);
            if (disabled) return `<span ${tooltip}aria-disabled="true" class="${cls(['fi-dropdown-list-item', 'fi-ac-grouped-action', 'fi-disabled', ...colors])}" role="menuitem" tabindex="-1">${glyph}${label}</span>`;
            return `<a href="${e(href)}"${this._newTab ? ' target="_blank"' : options.navigate ? ' wire:navigate' : ''} ${tooltip}class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')} " role="menuitem" tabindex="-1">${glyph}${label}</a>`;
        }
        // A handler or a modal: mounted on the menu's component; a string action is a method or a `$dispatch()`.
        const expression = this._handler || this._schema ? this.mountExpressionFor({}) : this._action;
        if (!expression && !this._alpineClick) return '';
        const target = expression ?? null;
        const attributes = new Attributes({
            type: 'button', role: 'menuitem', tabindex: '-1', 'aria-disabled': disabled ? 'true' : null, disabled: disabled ? true : null,
            'wire:loading.attr': 'aria-disabled', 'wire:loading.class': 'fi-disabled', 'wire:target': target, 'wire:click': disabled ? null : expression, 'x-on:click': disabled ? null : this._alpineClick,
        }).class(['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors, disabled ? 'fi-disabled' : null]);
        return `<button ${tooltip}${attributes.toHtml()}>${glyph}${target ? loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': target })) : ''}${label}</button>`;
    }
    /** A computed URL depends on the record, so the host checks it again on mount (`resolveUrl`). */
    isMountable(): boolean { return (this._handler !== null || this._schema !== null || this.hasModalContentOnly()) && this._url === null; }
    /** A modal without handler nor form (custom content, a heading or description: a help modal…). */
    private hasModalContentOnly(): boolean { return this._handler === null && this._action === null && this._alpineClick === null && this._lazyAlpineClick === null && this._submit === null && this.hasModal(); }
    /** URL of the action in this context; an action with a URL is a link, never a mounted action. */
    resolveUrl(ctx: ComponentContext): string | null { return this._lazyUrl ? this._lazyUrl(ctx) : this._url; }
    /** Whether the action opens a modal: `modal()`, a confirmation, a form, or a custom heading, eyebrow, description or content. */
    hasModal(): boolean {
        if (this._hasModal !== null) return this._hasModal;
        return this._requiresConfirmation || this._schema !== null || this._modalHeading !== null || this._modalEyebrow !== null || this._modalDescription !== null || this._modalContent !== null || this._modalContentFooter !== null;
    }
    /**
     * Form shown in the modal. With a function, the components are rebuilt on every request; it receives the schema and
     * the mounted action's `arguments` (as sent by the browser: check them).
     */
    schema(components: any[] | ((schema: any, ctx: { arguments: Record<string, unknown> }) => any), columns: Record<string, number> | number | null = {}): this { this._schema = typeof components === 'function' ? components : () => components; this._schemaColumns = columns; return this; }
    /** Applies the action's form to the host's schema; the function returns either components or the configured schema. */
    applySchema(schema: any, args: Record<string, unknown> = {}): any | null {
        if (!this._schema) return null;
        const result = this._schema(schema, { arguments: args });
        return Array.isArray(result) ? schema.columns(this._schemaColumns).components(result) : result;
    }
    /**
     * Extra buttons in the modal footer, after the submit button. An action with an `action()` function runs on top of this
     * one (with its own modal, if it has one), and gets this action's form data as `parentData`.
     */
    extraModalFooterActions(actions: Action[] | ((action: Action) => Action[])): this { this._extraModalFooterActions = actions; return this; }
    private _cachedExtraModalFooterActions: Action[] | null = null;
    getExtraModalFooterActions(): Action[] {
        if (typeof this._extraModalFooterActions !== 'function') return this._extraModalFooterActions;
        return (this._cachedExtraModalFooterActions ??= this._extraModalFooterActions(this) ?? []);
    }
    // --- modal behavior
    private _closeByClickingAway = true;
    private _closeByEscaping = true;
    private _closeButton = true;
    private _stickyHeader = false;
    private _stickyFooter = false;
    private _modalAlignment: 'start' | 'center' | null = null;
    private _footerAlignment: 'start' | 'center' | 'end' | null = null;
    private _modalHidden: Lazy<boolean, ActionCallContext> = false;
    private _mountUsing: ((ctx: ActionCallContext) => unknown) | null = null;
    /** `false`: clicking outside the modal does not close it. */
    closeModalByClickingAway(condition = true): this { this._closeByClickingAway = condition; return this; }
    /** `false`: the Escape key does not close the modal. */
    closeModalByEscaping(condition = true): this { this._closeByEscaping = condition; return this; }
    /** `false`: no close button in the modal header. */
    modalCloseButton(condition = true): this { this._closeButton = condition; return this; }
    /** Keeps the modal header visible while its content scrolls. */
    stickyModalHeader(condition = true): this { this._stickyHeader = condition; return this; }
    /** Keeps the modal footer visible while its content scrolls. */
    stickyModalFooter(condition = true): this { this._stickyFooter = condition; return this; }
    modalAlignment(alignment: 'start' | 'center' | null): this { this._modalAlignment = alignment; return this; }
    modalFooterActionsAlignment(alignment: 'start' | 'center' | 'end' | null): this { this._footerAlignment = alignment; return this; }
    private _modalEyebrow: Lazy<string | HtmlString | null, ActionCallContext> = null;
    private _schemaDisabled: Lazy<boolean, ActionCallContext> = false;
    private _modalContent: Lazy<string | HtmlString | null, ActionCallContext> = null;
    private _modalContentFooter: Lazy<string | HtmlString | null, ActionCallContext> = null;
    private _registeredModalActions: Action[] = [];
    private _modalSubmitCustomizer: ((action: Action) => Action | false | void) | null = null;
    private _modalCancelCustomizer: ((action: Action) => Action | false | void) | null = null;
    private _hasCancel = true;
    private _unsavedChangesAlert: Lazy<boolean | null, ActionCallContext> = null;
    private _clickThrough: Lazy<boolean, ActionCallContext> = false;
    private _autofocus: Lazy<boolean, ActionCallContext> = true;
    private _overlayParentActions: Lazy<boolean, ActionCallContext> = false;
    private _cancelParentActions: boolean | string | null = null;
    private _cancelParentActionsOnClose: boolean | string | null = null;
    private _modalWindowAttributes: Lazy<ExtraAttributes, ActionCallContext>[] = [];
    private _modalOverlayAttributes: Lazy<ExtraAttributes, ActionCallContext>[] = [];
    private _slideOverPosition: 'start' | 'end' | null = null;
    private _hasModal: boolean | null = null;
    /** Short line above the modal heading (the operation, when the heading names the record). Escaped, unless an `HtmlString`. */
    modalEyebrow(eyebrow: Lazy<string | HtmlString | null, ActionCallContext>): this { this._modalEyebrow = eyebrow; return this; }
    /** Every field of the modal form is disabled (read-only modal); their values are not submitted. */
    disabledSchema(condition: Lazy<boolean, ActionCallContext> = true): this { this._schemaDisabled = condition; return this; }
    async isSchemaDisabled(ctx: ActionCallContext): Promise<boolean> { return Boolean(await evaluate(this._schemaDisabled, ctx)); }
    /** Whether `disabledSchema()` was called (its condition is then evaluated). */
    hasDisabledSchemaCondition(): boolean { return this._schemaDisabled !== false; }
    /**
     * Custom content above the modal form. A string is escaped; an `HtmlString` (a rendered view…) is inserted as is: build
     * it from escaped values. A function receives the action context (`ctx.action.renderModalAction(name, ctx)` renders an
     * action of `registerModalActions()`).
     */
    modalContent(content: Lazy<string | HtmlString | null, ActionCallContext>): this { this._modalContent = content; return this; }
    /** Custom content below the modal form; same rules as `modalContent()`. */
    modalContentFooter(content: Lazy<string | HtmlString | null, ActionCallContext>): this { this._modalContentFooter = content; return this; }
    /**
     * Actions rendered inside the custom modal content (`renderModalAction()`): they are mounted on top of this one, like
     * extra footer actions.
     */
    registerModalActions(actions: Action[]): this { this._registeredModalActions = [...this._registeredModalActions, ...actions]; return this; }
    /** The modal's actions: extra footer actions and registered modal actions. */
    getModalActions(): Action[] { return [...this.getExtraModalFooterActions(), ...this._registeredModalActions]; }
    private _modalActionMountContext: Record<string, unknown> | null = null;
    private _parentMountContext: Record<string, unknown> | null = null;
    /** An action of the modal, set up to be mounted on top of this one while the modal renders. */
    getModalAction(name: string): Action | null {
        const action = this.getModalActions().find((a) => a.getName() === name) ?? null;
        if (action && this._modalActionMountContext) action._parentMountContext = this._modalActionMountContext;
        return action;
    }
    /** Renders an action of `registerModalActions()` (call it from `modalContent()`). */
    async renderModalAction(name: string, ctx: ActionCallContext): Promise<string> {
        const action = this.getModalAction(name);
        if (!action) return '';
        const schemaCtx = { livewire: ctx.livewire, component: null as any, operation: null, record: ctx.record, get: () => undefined, state: undefined };
        return (await action.isVisible(schemaCtx)) ? action.toHtml(schemaCtx) : '';
    }
    /** `false` removes the cancel button; a function changes it (`(action) => action.label('Close')`). */
    modalCancelAction(action: boolean | ((action: Action) => Action | false | void)): this {
        if (typeof action === 'function') { this._modalCancelCustomizer = action; this._hasCancel = true; } else { this._hasCancel = action; this._modalCancelCustomizer = null; }
        return this;
    }
    /** A modal footer button that submits the modal with these arguments (merged into the handler's `arguments`), e.g. "Create & create another". */
    makeModalSubmitAction(name: string, args: Record<string, unknown> = {}): Action { return Action.make(name).button().color('gray').action(`callMountedAction(${js(args)})`); }
    /**
     * Warns before leaving the page while this modal is open (panels with `unsavedChangesAlerts()`). On by default, except
     * for a `disabledSchema()`.
     */
    unsavedChangesAlert(condition: Lazy<boolean | null, ActionCallContext> = true): this { this._unsavedChangesAlert = condition; return this; }
    async hasUnsavedChangesAlert(ctx: ActionCallContext): Promise<boolean> { const value = await evaluate(this._unsavedChangesAlert, ctx); return value ?? !(await this.isSchemaDisabled(ctx)); }
    /** The page behind the modal stays usable: no backdrop, no scroll lock; clicking away no longer closes the modal. */
    modalClickThrough(condition: Lazy<boolean, ActionCallContext> = true): this { this._clickThrough = condition; return this; }
    /** `false`: the first focusable element of the modal is not focused when it opens. */
    modalAutofocus(condition: Lazy<boolean, ActionCallContext> = true): this { this._autofocus = condition; return this; }
    /** This action's modal opens on top of its parent's, which stays visible, instead of replacing it. */
    overlayParentActions(condition: Lazy<boolean, ActionCallContext> = true): this { this._overlayParentActions = condition; return this; }
    async shouldOverlayParentActions(ctx: ActionCallContext): Promise<boolean> { return Boolean(await evaluate(this._overlayParentActions, ctx)); }
    /** Whether `overlayParentActions()` was called (its condition is then evaluated). */
    hasOverlayParentActionsCondition(): boolean { return this._overlayParentActions !== false; }
    /** Once this (child) action has run, its parent actions are cancelled too: all of them, or up to (and including) the named one. */
    cancelParentActions(toAction: boolean | string | null = true): this { this._cancelParentActions = toAction; return this; }
    /** Closing this (child) action's modal also cancels its parent actions: all of them, or up to (and including) the named one. */
    cancelParentActionsOnClose(toAction: boolean | string | null = true): this { this._cancelParentActionsOnClose = toAction; return this; }
    shouldCancelAllParentActions(): boolean { return this._cancelParentActions === true; }
    getParentActionToCancelTo(): string | null { return typeof this._cancelParentActions === 'string' ? this._cancelParentActions : null; }
    getParentActionsToCancelOnClose(): boolean | string { return typeof this._cancelParentActionsOnClose === 'string' ? this._cancelParentActionsOnClose : this._cancelParentActionsOnClose === true; }
    /** Attributes of the modal window (`class` is added to its classes). `merge: true` keeps the attributes of previous calls. */
    extraModalWindowAttributes(attributes: Lazy<ExtraAttributes, ActionCallContext>, merge = false): this { this._modalWindowAttributes = addAttributeSet(this._modalWindowAttributes, attributes, merge); return this; }
    /** Attributes of the modal's backdrop. `merge: true` keeps the attributes of previous calls. */
    extraModalOverlayAttributes(attributes: Lazy<ExtraAttributes, ActionCallContext>, merge = false): this { this._modalOverlayAttributes = addAttributeSet(this._modalOverlayAttributes, attributes, merge); return this; }
    /** Side a slide-over enters from: `end` (default, right in left-to-right languages) or `start`. */
    slideOverPosition(position: 'start' | 'end' | null): this { this._slideOverPosition = position === 'start' || position === 'end' ? position : null; return this; }
    /** `true`: the action has a modal (no need to infer it); `false`: never. */
    modal(condition: boolean | null = true): this { this._hasModal = condition; return this; }
    // --- rate limiting
    private _rateLimit: Lazy<number | null, ActionCallContext> = null;
    private _rateLimitedNotification: ((notification: any, ctx: ActionCallContext & { seconds: number; minutes: number }) => any) | null | undefined = undefined;
    private _rateLimitedNotificationTitle: string | ((ctx: ActionCallContext & { seconds: number; minutes: number }) => string | null) | null = null;
    /**
     * Attempts per minute, per IP address, page class and action (with its arguments and record). Over the limit, the action
     * does not run and a notification is sent. Checked on the server when the action runs (on submit, for a modal).
     */
    rateLimit(maxAttempts: Lazy<number | null, ActionCallContext>): this { this._rateLimit = maxAttempts; return this; }
    async getRateLimit(ctx: ActionCallContext): Promise<number | null> { const value = await evaluate(this._rateLimit, ctx); return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null; }
    /** Customizes the notification sent over the rate limit (`ctx.seconds` until available); `null` sends none. */
    rateLimitedNotification(customize: ((notification: any, ctx: ActionCallContext & { seconds: number; minutes: number }) => any) | null): this { this._rateLimitedNotification = customize; return this; }
    getRateLimitedNotificationCustomizer(): ((notification: any, ctx: ActionCallContext & { seconds: number; minutes: number }) => any) | null | undefined { return this._rateLimitedNotification; }
    /** Title of the rate limited notification ("Too many attempts" by default). */
    rateLimitedNotificationTitle(title: string | ((ctx: ActionCallContext & { seconds: number; minutes: number }) => string | null) | null): this { this._rateLimitedNotificationTitle = title; return this; }
    getRateLimitedNotificationTitle(ctx: ActionCallContext & { seconds: number; minutes: number }): string | null { const title = this._rateLimitedNotificationTitle; return typeof title === 'function' ? title(ctx) : title; }
    // --- database transactions
    private _databaseTransaction: Lazy<boolean, ActionCallContext> | null = null;
    /**
     * Runs the action (from `before()` to `after()`) in a database transaction of the host's data adapter, rolled back when it
     * throws. `halt()` / `cancel()` commit, unless called with `true`. Defaults to the panel's `databaseTransactions()`.
     */
    databaseTransaction(condition: Lazy<boolean, ActionCallContext> | null = true): this { this._databaseTransaction = condition; return this; }
    /** `null` when not set on the action (the host's default applies). */
    async hasDatabaseTransactions(ctx: ActionCallContext): Promise<boolean | null> { return this._databaseTransaction === null ? null : Boolean(await evaluate(this._databaseTransaction, ctx)); }
    // --- extra HTML attributes
    private _extraAttributes: Lazy<ExtraAttributes, ComponentContext>[] = [];
    /** Attributes merged onto the action's outer element (`class` is added to its classes). `merge: true` keeps the attributes of previous calls. */
    extraAttributes(attributes: Lazy<ExtraAttributes, ComponentContext>, merge = false): this { this._extraAttributes = addAttributeSet(this._extraAttributes, attributes, merge); return this; }
    async getExtraAttributes(ctx: ComponentContext): Promise<ExtraAttributes> { return mergeAttributeSets(await Promise.all(this._extraAttributes.map((set) => evaluate(set, ctx)))); }
    private async withExtraAttributes(html: string, ctx: ComponentContext): Promise<string> { return this._extraAttributes.length ? mergeIntoRootTag(html, await this.getExtraAttributes(ctx)) : html; }
    private _steps: any[] | null = null;
    /** Builds the wizard of `steps()`: registered by `@navette-js/forms`, which owns the `Wizard` component. */
    static stepsRenderer: ((steps: any[], submit: Action, cancel: Action) => any) | null = null;
    /**
     * Turns the modal form into a wizard: each step is validated before the next one, and the last step submits the action.
     * `steps` are `Step` components of `@navette-js/forms`.
     */
    steps(steps: any[] | null): this {
        this._steps = steps;
        this._schema = steps === null ? null : (schema: any) => {
            if (!Action.stepsRenderer) throw new Error('Action.steps() needs @navette-js/forms to be loaded.');
            const submitLabel = this._modalSubmitActionLabel ?? t('filament-actions::modal.actions.submit.label');
            const submit = Action.make('submit').label(submitLabel).color(this._color === 'gray' ? 'primary' : this._color).submit('callMountedAction');
            const cancel = Action.make('cancel').label(this._cancelLabel ?? t('filament-actions::modal.actions.cancel.label')).color('gray').alpineClickHandler('close()');
            const wizard = Action.stepsRenderer(steps, submit, cancel);
            if (this._skippableSteps) wizard.skippable();
            return schema.components([this._modifyWizard?.(wizard) ?? wizard]);
        };
        return this;
    }
    private _modifyWizard: ((wizard: any) => any) | null = null;
    /** Changes the wizard built by `steps()` (`(wizard) => wizard.hiddenHeader()`). */
    modifyWizardUsing(callback: ((wizard: any) => any) | null): this { this._modifyWizard = callback; return this; }
    isWizard(): boolean { return this._steps !== null; }
    /** Runs the action without its modal (e.g. no confirmation for some records). */
    modalHidden(condition: Lazy<boolean, ActionCallContext> = true): this { this._modalHidden = condition; return this; }
    async isModalHidden(ctx: ActionCallContext): Promise<boolean> { return Boolean(await evaluate(this._modalHidden, ctx)); }
    /** Runs when the action is mounted, after the form is filled: `ctx.data` is the form state, which you may change. */
    mountUsing(callback: ((ctx: ActionCallContext) => unknown) | null): this { this._mountUsing = callback; return this; }
    async runMountUsing(ctx: ActionCallContext): Promise<void> { await this._mountUsing?.(ctx); }
    /** Initial form state (e.g. from the record). */
    fillForm(resolver: (ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>): this { this._fillForm = resolver; return this; }
    /** Modal width (`xs` … `7xl`). Defaults to `md` for a confirmation and `4xl` for a form. */
    modalWidth(width: string | null): this { this._modalWidth = width; return this; }
    hasSchema(): boolean { return this._schema !== null; }
    async getFormFill(ctx: ActionCallContext): Promise<Record<string, unknown> | null> { return this._fillForm ? this._fillForm(ctx) : null; }
    private getDefaultLabel(): string { return ((s: string) => s.charAt(0).toUpperCase() + s.slice(1))(this.name.replace(/[_-]+/g, ' ')); }
    private _mutateData: ((data: Record<string, unknown>, ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>) | null = null;
    private _before: ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null = null;
    private _after: ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null = null;
    /** Transforms the validated form data before the handler runs (add the author, normalize a value…). */
    mutateDataUsing(fn: (data: Record<string, unknown>, ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>): this { this._mutateData = fn; return this; }
    /** Runs right before the handler; throwing cancels the action. */
    before(fn: (ctx: ActionCallContext) => unknown | Promise<unknown>): this { this._before = fn; return this; }
    /** Runs after the handler succeeds (logging, extra notification…). */
    after(fn: (ctx: ActionCallContext) => unknown | Promise<unknown>): this { this._after = fn; return this; }
    // --- bulk actions
    private _individualAuthorization: string | ((record: any, ctx: ActionCallContext) => boolean | Promise<boolean>) | null = null;
    private _chunkSize = 100;
    private _deselectAfterCompletion = false;
    private _successNotificationTitle: string | null = null;
    private _failureNotificationTitle: BulkMessage | null = null;
    private _missingAuthorizationMessage: BulkMessage | null = null;
    private _missingProcessingMessage: BulkMessage | null = null;
    /**
     * Bulk action: each selected record must pass this policy ability (or function), otherwise it is skipped and counted in the
     * failure notification. Used by `processSelectedRecords()` of the table's page.
     */
    authorizeIndividualRecords(ability: string | ((record: any, ctx: ActionCallContext) => boolean | Promise<boolean>) | null): this { this._individualAuthorization = ability; return this; }
    getIndividualRecordsAuthorization(): string | ((record: any, ctx: ActionCallContext) => boolean | Promise<boolean>) | null { return this._individualAuthorization; }
    /** Number of selected records loaded at a time by `processSelectedRecords()` (100 by default). */
    chunkSelectedRecords(size: number): this { this._chunkSize = Math.max(1, Math.floor(size)); return this; }
    getSelectedRecordsChunkSize(): number { return this._chunkSize; }
    /** Clears the table selection once the bulk action has run. */
    deselectRecordsAfterCompletion(condition = true): this { this._deselectAfterCompletion = condition; return this; }
    shouldDeselectRecordsAfterCompletion(): boolean { return this._deselectAfterCompletion; }
    /** Notification sent when every selected record was processed. */
    successNotificationTitle(title: string | null): this { this._successNotificationTitle = title; return this; }
    getSuccessNotificationTitle(): string | null { return this._successNotificationTitle; }
    /** Notification title when some records failed: receives the number of processed records and the number selected. */
    failureNotificationTitle(title: BulkMessage | null): this { this._failureNotificationTitle = title; return this; }
    getFailureNotificationTitle(success: number, total: number): string | null { const title = this._failureNotificationTitle; return typeof title === 'function' ? title(success, total) : title; }
    /** Body line for records skipped by `authorizeIndividualRecords()`: receives their number and the number selected. */
    missingBulkAuthorizationFailureNotificationMessage(message: BulkMessage | null): this { this._missingAuthorizationMessage = message; return this; }
    getMissingBulkAuthorizationFailureNotificationMessage(count: number, total: number): string | null { const message = this._missingAuthorizationMessage; return typeof message === 'function' ? message(count, total) : message; }
    /** Body line for records whose processing failed: receives their number and the number selected. */
    missingBulkProcessingFailureNotificationMessage(message: BulkMessage | null): this { this._missingProcessingMessage = message; return this; }
    getMissingBulkProcessingFailureNotificationMessage(count: number, total: number): string | null { const message = this._missingProcessingMessage; return typeof message === 'function' ? message(count, total) : message; }

    // --- selected table records (Filament's `accessSelectedRecords()`)
    private _accessSelectedRecords = false;
    private _bulk = false;
    private _fetchSelectedRecords = true;
    private _selectionHost: any = null;
    private _selection = { total: 0, successful: 0, withoutMessage: 0, messages: new Map<string, { message: BulkMessage | null; count: number }>(), notified: false, used: false };
    /**
     * A table action (header, toolbar or row action) that works on the selected records: its click sends the table's selection,
     * and its handler reads it with `getSelectedRecords()` or `getSelectedRecordsQuery()`. The selection is checked again on the
     * server (records the table can show, selectable, within `maxSelectableRecords()`).
     */
    accessSelectedRecords(condition = true): this { this._accessSelectedRecords = condition; return this; }
    canAccessSelectedRecords(): boolean { return this._accessSelectedRecords || this._bulk; }
    /** Marks a bulk action (set by the table for the actions of its bulk menus): it always accesses the selected records. */
    bulk(condition = true): this { this._bulk = condition; return this; }
    isBulk(): boolean { return this._bulk; }
    /**
     * `false`: `getSelectedRecords()` returns the selected keys instead of loading the records (faster for large selections);
     * prebuilt bulk actions then process the selected keys in one query, without `authorizeIndividualRecords()` checks or
     * per-record adapter hooks.
     */
    fetchSelectedRecords(condition = true): this { this._fetchSelectedRecords = condition; return this; }
    shouldFetchSelectedRecords(): boolean { return this._fetchSelectedRecords; }
    private selectionHost(method: string): any {
        if (!this.canAccessSelectedRecords()) throw new Error(`The action [${this.name}] is attempting to access the selected records from the table, but it is not using [accessSelectedRecords()], so they are not available.`);
        const host = this._selectionHost;
        if (!host || typeof host[method] !== 'function') throw new Error(`The action [${this.name}] is not running in a table: no selected records.`);
        return host;
    }
    /**
     * The selected records (or their keys with `fetchSelectedRecords(false)`), loaded by `chunkSelectedRecords()` chunks. Counts the
     * total for the failure notification of `reportBulkProcessingFailure()`.
     */
    async getSelectedRecords(): Promise<any[]> {
        const records: any[] = await this.selectionHost('getSelectedTableRecords').getSelectedTableRecords(this._fetchSelectedRecords, this._chunkSize);
        this._selection.total = records.length;
        this._selection.successful = records.length;
        this._selection.used = true;
        return records;
    }
    /**
     * Hands a query of the selected records (an Objection query builder with `ObjectionAdapter`) to `use`, and returns its result,
     * e.g. `await action.getSelectedRecordsQuery((query) => query.patch({ status: 'archived' }))` for one update of all of them.
     * (An Objection query runs when awaited: it is passed to a function instead of being returned.)
     */
    async getSelectedRecordsQuery<T>(use: (query: any) => T | Promise<T>): Promise<T> { return this.selectionHost('useSelectedTableRecordsQuery').useSelectedTableRecordsQuery(use); }
    /**
     * Reports that one selected record could not be processed. `key` groups failures sharing a `message` (a text, or a function of
     * the number of such failures and of the selected records); without a key, `missingBulkProcessingFailureNotificationMessage()` is used.
     */
    reportBulkProcessingFailure(key: string | null = null, message: BulkMessage | null = null): void {
        if (key !== null && key !== '') { const previous = this._selection.messages.get(key); this._selection.messages.set(key, { message, count: (previous?.count ?? 0) + 1 }); }
        else this._selection.withoutMessage++;
        this._selection.successful = Math.max(0, this._selection.successful - 1);
        this._selection.used = true;
    }
    /** Reports that no selected record could be processed. */
    reportCompleteBulkProcessingFailure(key: string | null = null, message: BulkMessage | null = null): void {
        if (key !== null && key !== '') this._selection.messages.set(key, { message, count: this._selection.total });
        else this._selection.withoutMessage += this._selection.total;
        this._selection.successful = 0;
        this._selection.used = true;
    }
    /** Reports how many selected records were processed: the others count as failures without message. */
    reportBulkProcessingSuccessfulRecordsCount(count: number): void {
        this._selection.withoutMessage = Math.max(0, this._selection.successful - count);
        this._selection.successful = Math.max(0, Math.floor(count));
        this._selection.used = true;
    }
    getTotalSelectedRecordsCount(): number { return this._selection.total; }
    getSuccessfulSelectedRecordsCount(): number { return this._selection.successful; }
    /** Failures reported without a key. */
    getBulkProcessingFailureWithoutMessageCount(): number { return this._selection.withoutMessage; }
    /** Messages of the failures reported with a key and a message. */
    getBulkProcessingFailureMessages(): string[] {
        return [...this._selection.messages.values()].flatMap(({ message, count }) => { const text = typeof message === 'function' ? message(count, this._selection.total) : message; return text ? [text] : []; });
    }
    /** Whether the handler used the selection (`getSelectedRecords()` or a report), so the host sends the outcome notification. */
    hasSelectedRecordsOutcome(): boolean { return this._selection.used && !this._selection.notified; }
    /** Set by the host once it has sent the success or failure notification of the selection. */
    markSelectedRecordsOutcomeNotified(): void { this._selection.notified = true; }
    /** Starts a selection run (used by the host's `processSelectedRecords()`). */
    startSelectedRecordsRun(total: number): void { this._selection = { total, successful: total, withoutMessage: 0, messages: new Map(), notified: false, used: true }; }

    // --- outcome of single actions
    private _successNotification: ((notification: any, ctx: ActionCallContext) => any) | null = null;
    private _successRedirectUrl: string | ((ctx: ActionCallContext & Record<string, unknown>) => string | null | Promise<string | null>) | null = null;
    private _preserveData: string[] | ((data: Record<string, unknown>) => Record<string, unknown>) | null = null;
    /**
     * Customizes the success notification of a prebuilt action: the function receives the notification and returns it (changed)
     * or `null` to send nothing.
     */
    successNotification(customize: ((notification: any, ctx: ActionCallContext) => any) | null): this { this._successNotification = customize; return this; }
    getSuccessNotificationCustomizer(): ((notification: any, ctx: ActionCallContext) => any) | null { return this._successNotification; }
    /** Where a prebuilt action redirects after success: a URL, or a function of the context (record, replica...). */
    successRedirectUrl(url: string | ((ctx: ActionCallContext & Record<string, unknown>) => string | null | Promise<string | null>) | null): this { this._successRedirectUrl = url; return this; }
    async getSuccessRedirectUrl(ctx: ActionCallContext & Record<string, unknown>): Promise<string | null> { return typeof this._successRedirectUrl === 'function' ? this._successRedirectUrl(ctx) : this._successRedirectUrl; }
    /** "Create & create another": fields kept in the new form (names, or a function returning the data to keep). */
    preserveFormDataWhenCreatingAnother(fields: string[] | ((data: Record<string, unknown>) => Record<string, unknown>) | null): this { this._preserveData = fields; return this; }
    getDataPreservedForAnother(data: Record<string, unknown>): Record<string, unknown> {
        if (!this._preserveData) return {};
        if (typeof this._preserveData === 'function') return this._preserveData(data) ?? {};
        return Object.fromEntries(this._preserveData.filter((field) => Object.hasOwn(data, field)).map((field) => [field, data[field]]));
    }

    // --- failure outcome, selected records, form lifecycle hooks, wizard (Filament's CanNotify, CanRedirect,
    // CanFetchSelectedRecords, HasLifecycleHooks and HasWizard)
    private _failureNotification: ((notification: any, ctx: ActionCallContext & Record<string, unknown>) => any) | null = null;
    private _failureNotificationDisabled = false;
    private _failureRedirectUrl: string | ((ctx: ActionCallContext & Record<string, unknown>) => string | null | Promise<string | null>) | null = null;
    private _formHooks: Partial<Record<'beforeFormFilled' | 'afterFormFilled' | 'beforeFormValidated' | 'afterFormValidated', (ctx: ActionCallContext) => unknown>> = {};
    private _skippableSteps = false;
    /**
     * Customizes the failure notification (a prebuilt action that could not process its record, a bulk action with failed
     * records): the function receives the notification and the context, with `successCount`, `failureCount`, `totalCount` and
     * `isAll` for a bulk action, and returns it (changed). `null` sends no failure notification.
     */
    failureNotification(customize: ((notification: any, ctx: ActionCallContext & Record<string, unknown>) => any) | null): this { this._failureNotification = customize; this._failureNotificationDisabled = customize === null; return this; }
    getFailureNotificationCustomizer(): ((notification: any, ctx: ActionCallContext & Record<string, unknown>) => any) | null { return this._failureNotification; }
    isFailureNotificationDisabled(): boolean { return this._failureNotificationDisabled; }
    /** Where a prebuilt action redirects after a failure: a URL, or a function of the context. */
    failureRedirectUrl(url: string | ((ctx: ActionCallContext & Record<string, unknown>) => string | null | Promise<string | null>) | null): this { this._failureRedirectUrl = url; return this; }
    async getFailureRedirectUrl(ctx: ActionCallContext & Record<string, unknown>): Promise<string | null> { return typeof this._failureRedirectUrl === 'function' ? this._failureRedirectUrl(ctx) : this._failureRedirectUrl; }
    /** Runs when the action is mounted, before its modal form is filled (defaults and `fillForm()`). */
    beforeFormFilled(callback: ((ctx: ActionCallContext) => unknown) | null): this { return this.formHook('beforeFormFilled', callback); }
    /** Runs when the action is mounted, after its modal form is filled. */
    afterFormFilled(callback: ((ctx: ActionCallContext) => unknown) | null): this { return this.formHook('afterFormFilled', callback); }
    /** Runs when the modal is submitted, before its form is validated; `action.halt()` keeps the modal open. */
    beforeFormValidated(callback: ((ctx: ActionCallContext) => unknown) | null): this { return this.formHook('beforeFormValidated', callback); }
    /** Runs when the modal is submitted, once its form is valid, before `mutateDataUsing()` and `before()`. */
    afterFormValidated(callback: ((ctx: ActionCallContext) => unknown) | null): this { return this.formHook('afterFormValidated', callback); }
    private formHook(name: 'beforeFormFilled' | 'afterFormFilled' | 'beforeFormValidated' | 'afterFormValidated', callback: ((ctx: ActionCallContext) => unknown) | null): this { if (callback) this._formHooks[name] = callback; else delete this._formHooks[name]; return this; }
    /** @internal Runs a form lifecycle hook (called by the host component). */
    async callFormHook(name: 'beforeFormFilled' | 'afterFormFilled' | 'beforeFormValidated' | 'afterFormValidated', ctx: ActionCallContext): Promise<void> { await this._formHooks[name]?.({ ...ctx, action: this }); }
    /** With `steps()`: the steps can be visited in any order, without validating each one first (the form is still validated on submit). */
    skippableSteps(condition = true): this { this._skippableSteps = condition; return this; }
    isWizardSkippable(): boolean { return this._skippableSteps; }
    /** Stops the action from one of its hooks; the modal stays open. `true` rolls back its database transaction. */
    halt(shouldRollBackDatabaseTransaction = false): never { throw new ActionHalt(false, shouldRollBackDatabaseTransaction); }
    /** Stops the action from one of its hooks and closes the modal. `true` rolls back its database transaction. */
    cancel(shouldRollBackDatabaseTransaction = false): never { throw new ActionHalt(true, shouldRollBackDatabaseTransaction); }

    async call(ctx: ActionCallContext): Promise<unknown> {
        if (!this._handler) return null;
        ctx = { ...ctx, action: this };
        // The selection is read through the component running the action.
        this._selectionHost = ctx.livewire ?? null;
        this._selection = { total: 0, successful: 0, withoutMessage: 0, messages: new Map(), notified: false, used: false };
        if (this._mutateData) ctx = { ...ctx, data: await this._mutateData(ctx.data ?? {}, ctx) };
        await this._before?.(ctx);
        const result = await this._handler(ctx);
        await this._after?.(ctx);
        // Success or failure notification of the selected records, sent by the table's component.
        if (this.hasSelectedRecordsOutcome()) await (ctx.livewire as any)?.notifySelectedRecordsOutcome?.(this);
        return result;
    }

    /**
     * Attribute of the click that mounts the action: `x-on:click` for an action using `accessSelectedRecords()` (the table's Alpine
     * `mountAction()` sends the selection along), `wire:click` otherwise.
     */
    private clickAttribute(): string { return this._accessSelectedRecords ? 'x-on:click' : 'wire:click'; }

    /** Menu item of a table bulk action. The click goes through the table's Alpine `mountAction()`, which sends the selection. */
    async toGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>): Promise<string> { return this.withExtraAttributes(await this.renderGroupedHtml(ctx, context), ctx); }
    private async renderGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const expression = `mountAction(${js(this.name)}, {}, ${js(context)})`;
        const attributes = new Attributes()
            .merge({ role: 'menuitem', tabindex: '-1', type: 'button', 'wire:loading.attr': 'aria-disabled', 'wire:loading.class': 'fi-disabled', 'wire:target': expression })
            .class(['fi-ac-grouped-action', 'fi-dropdown-list-item', ...(this._color !== 'gray' ? colorManager.getComponentClasses('dropdown-item', this._color) : [])])
            .set('x-cloak', 'x-cloak').set('x-show', 'getSelectedRecordsCount()').set('x-on:click', expression);
        const iconHtml = this._icon ? icon(this._icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': expression }).class(this._color !== 'gray' ? ['fi-color', `fi-color-${this._color}`] : []) }) : '';
        return `<button ${attributes.toHtml()}>${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': expression }))}<span class="fi-dropdown-list-item-label">${e((await evaluate(this._label, ctx)) ?? this.getDefaultLabel())}</span></button>`;
    }

    /**
     * Menu item of a row action inside an ActionGroup. Disabled-capable and key-bound items use a different class order
     * than plain items; front-end CSS and tests rely on the exact markup.
     */
    async toRecordGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> { return this.withExtraAttributes(await this.renderRecordGroupedHtml(ctx, context, wireKey), ctx); }
    private async renderRecordGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const iconName = this._lazyIcon ? await this._lazyIcon(ctx) : (this._groupedIcon ?? this._icon);
        const alpineClick = await this.resolveAlpineClick(ctx);
        const click = alpineClick ? `x-on:click="${e(alpineClick)}"` : `${this.clickAttribute()}="${e(`mountAction(${js(this.name)}, {}, ${js(context)})`)}"`;
        const colors = color !== 'gray' ? colorManager.getComponentClasses('dropdown-item', color) : [];
        const label = (await evaluate(this._label, ctx)) ?? this.getDefaultLabel();
        const iconHtml = iconName ? icon(iconName, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': `mountAction(${js(this.name)}, {}, ${js(context)})` }).class(color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []) }) : '';
        const inner = `${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': `mountAction(${js(this.name)}, {}, ${js(context)})` }))}<span class="fi-dropdown-list-item-label">${e(label)}</span>`;
        // Navigation action: a plain link, nothing is mounted on the server.
        const href = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        if (href) {
            const plainIcon = iconName ? icon(iconName, { attributes: new Attributes().class(color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []) }) : '';
            // New-tab link: no `wire:navigate`.
            if (this._newTab) return `<a href="${e(href)}" target="_blank" role="menuitem" tabindex="-1" wire:key="${e(wireKey)}" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', ...colors].join(' ')}">${plainIcon}<span class="fi-dropdown-list-item-label">${e(label)}</span></a>`;
            return `<a href="${e(href)}" wire:navigate wire:key="${e(wireKey)}" class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')}" role="menuitem" tabindex="-1">${plainIcon}<span class="fi-dropdown-list-item-label">${e(label)}</span></a>`;
        }
        if (this.canBeDisabled()) {
            // Conditionally disabled: this markup is used whether or not the action ends up disabled.
            const disabled = await this.isDisabled(ctx);
            const tooltip = disabled ? await this.tooltipAttribute(ctx) : '';
            return `<button ${tooltip}${disabled ? 'aria-disabled="true" ' : ''}role="menuitem" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', disabled ? 'fi-disabled' : null, ...colors].filter(Boolean).join(' ')}" ${click} wire:key="${e(wireKey)}">${inner}</button>`;
        }
        if (this._keyBindings.length) {
            return `<button x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" role="menuitem" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', ...colors].join(' ')}" ${click} wire:key="${e(wireKey)}">${inner}</button>`;
        }
        return `<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" ${click} wire:key="${e(wireKey)}" class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')}" role="menuitem" tabindex="-1">${inner}</button>`;
    }

    /** Small link (or icon button) for a table row action. */
    async toLinkHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> { return this.withExtraAttributes(await this.renderLinkHtml(ctx, context, wireKey), ctx); }
    private async renderLinkHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        // `button()`, `badge()`, `outlined()` or `labeledFrom()` in a table row: rendered like a header action.
        if (this._view === 'button' || this._view === 'badge' || this._outlined || this._labeledFrom) return this.toHtml(ctx, context);
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const iconName = this._lazyIcon ? await this._lazyIcon(ctx) : (this._tableIcon ?? this._icon);
        const raw = `mountAction(${js(this.name)}, {}, ${js(context)})`;
        const label = (await evaluate(this._label, ctx)) ?? this.getDefaultLabel();
        const classes = ['fi-ac-link-action', 'fi-link', 'fi-size-sm', ...(color !== 'gray' ? colorManager.getComponentClasses('link', color) : [])].join(' ');
        if (this._iconButton) {
            const disabled = this.canBeDisabled() && (await this.isDisabled(ctx));
            const buttonClasses = ['fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-sm', disabled ? 'fi-disabled' : null, ...(color !== 'gray' ? colorManager.getComponentClasses('icon-button', color) : [])].filter(Boolean).join(' ');
            const glyph = iconName ? icon(iconName, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': raw }) }) : '';
            return `<button title="${e(label)}" aria-label="${e(label)}" ${disabled ? 'disabled ' : ''}type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${buttonClasses}"${disabled ? '' : ` ${this.clickAttribute()}="${e(raw)}"`} wire:key="${e(wireKey)}">${glyph}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': raw }))}</button>`;
        }
        const iconHtml = iconName ? icon(iconName, { size: 'sm', attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': raw }) }) : '';
        const href = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        const tooltip = await this.tooltipAttribute(ctx);
        const alpineClick = await this.resolveAlpineClick(ctx);
        const linkDisabled = this.canBeDisabled() && (await this.isDisabled(ctx));
        // Only local or http(s) URLs become links (no `javascript:` or protocol-relative URLs).
        if (href && /^(\/(?!\/)|https?:\/\/)/.test(href)) return `<a href="${e(href)}" ${this._newTab ? 'target="_blank" ' : ''}${tooltip}${this._newTab ? '' : 'wire:navigate '}wire:key="${e(wireKey)}" class="${classes}">${iconName ? icon(iconName, { size: 'sm' }) : ''}<span class="fi-link-label">${e(label)}</span></a>`;
        const keys = this._keyBindings.length ? `x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" ` : '';
        // Disabled: no click (a tooltip still shows), `disabled` when there is no tooltip.
        const rowClick = linkDisabled ? '' : alpineClick ? ` x-on:click="${e(alpineClick)}"` : ` ${this.clickAttribute()}="${e(raw)}"`;
        return `<button ${keys}${tooltip}${linkDisabled ? `aria-disabled="true" ${tooltip ? '' : 'disabled '}` : ''}type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${linkDisabled ? `${classes} fi-disabled` : classes}"${rowClick} wire:key="${e(wireKey)}">${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': raw }), 'sm')}<span class="fi-link-label">${e(label)}</span></button>`;
    }

    /** Modal of a mounted action; `content` is the rendered form, if any. */
    async toModalHtml(ctx: ActionCallContext, index: number, content: string | null = null, mountContext: Record<string, unknown> = {}): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        ctx = { ...ctx, action: this };
        const schemaCtx = { livewire: ctx.livewire, component: null as any, operation: null, record: ctx.record, get: (() => undefined) as unknown as ComponentContext['get'], state: undefined };
        const label = (await evaluate(this._label, schemaCtx)) ?? this.getDefaultLabel();
        const color = this._lazyColor ? await this._lazyColor(schemaCtx) : this._color;
        const confirmation = this._requiresConfirmation;
        // A confirmation is centered (md); a form is start-aligned (4xl), except at small widths.
        const width = this._modalWidth ?? (confirmation ? 'md' : '4xl');
        const submitLabel = this._lazySubmitLabel?.(ctx) ?? this._modalSubmitActionLabel ?? t(confirmation ? 'filament-actions::modal.actions.confirm.label' : 'filament-actions::modal.actions.submit.label');
        // Actions of the modal (footer, custom content) are mounted on top of this one, with its context.
        const childContext = { ...mountContext, parentAction: index };
        this._modalActionMountContext = childContext;
        const customContent = async (value: Lazy<string | HtmlString | null, ActionCallContext>) => {
            const resolved = await evaluate(value, ctx);
            return resolved === null || resolved === undefined || resolved === '' ? '' : resolved instanceof HtmlString ? resolved.html : e(resolved);
        };
        // Hook order: custom content, schema, content footer, each between its before/after slots.
        const scopes = (ctx.livewire as any).getRenderHookScopes?.() ?? [];
        const hook = (name: string) => renderHook(name, scopes, { action: this });
        let hooked: string;
        try {
            hooked = hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_BEFORE) + (await customContent(this._modalContent)) + hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_AFTER)
                + (content !== null ? hook(ActionsRenderHook.MODAL_SCHEMA_BEFORE) + content + hook(ActionsRenderHook.MODAL_SCHEMA_AFTER) : '')
                + hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE) + (await customContent(this._modalContentFooter)) + hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER);
        } finally { this._modalActionMountContext = null; }
        if (content !== null || hooked !== '') content = hooked;
        // Footer: submit, extra actions, cancel (reversed when centered, as in Filament).
        const footerAlignment = this._footerAlignment ?? (confirmation ? 'center' : 'start');
        const footer: string[] = [];
        if (this._hasSubmit) {
            let submit: Action | false | void = Action.make('submit').label(submitLabel).color(color === 'gray' ? 'primary' : color).submit('callMountedAction');
            submit = this._modalSubmitCustomizer ? (this._modalSubmitCustomizer(submit) ?? submit) : submit;
            if (submit) footer.push(await submit.toHtml(schemaCtx));
        }
        for (const action of this.getExtraModalFooterActions()) {
            if (!(await action.isVisible(schemaCtx))) continue;
            footer.push(action.isMountable() ? await action.toHtml(schemaCtx, childContext) : await action.toHtml(schemaCtx));
        }
        if (this._hasCancel) {
            let cancel: Action | false | void = Action.make('cancel').label(this._cancelLabel ?? t('filament-actions::modal.actions.cancel.label')).color('gray').alpineClickHandler('close()');
            cancel = this._modalCancelCustomizer ? (this._modalCancelCustomizer(cancel) ?? cancel) : cancel;
            if (cancel) footer.push(await cancel.toHtml(schemaCtx));
        }
        if (footerAlignment === 'center') footer.reverse();
        const clickThrough = Boolean(await evaluate(this._clickThrough, ctx));
        const icon = this._modalIcon ?? (this._requiresConfirmation ? icons.resolve('actions::modal.confirmation') ?? 'o-exclamation-triangle' : null);
        const eyebrow = await evaluate(this._modalEyebrow, ctx);
        return views.render('filament-actions::modal', {
            // A wizard has its own buttons (back, next, submit): the modal has no footer.
            hasFooter: !this.isWizard() && footer.length > 0,
            closeByClickingAway: this._closeByClickingAway && !clickThrough, closeByEscaping: this._closeByEscaping, closeButton: this._closeButton, stickyHeader: this._stickyHeader, stickyFooter: this._stickyFooter,
            clickThrough, autofocus: Boolean(await evaluate(this._autofocus, ctx)),
            slideOverPosition: this._slideOverPosition ?? 'end',
            windowAttributes: mergeAttributeSets(await Promise.all(this._modalWindowAttributes.map((set) => evaluate(set, ctx)))),
            overlayAttributes: mergeAttributeSets(await Promise.all(this._modalOverlayAttributes.map((set) => evaluate(set, ctx)))),
            attributesToHtml,
            footerAlignment, footer: footer.join(''),
            slideOver: this._slideOver, content, confirmation, width, alignment: this._modalAlignment ?? (confirmation || ['xs', 'sm'].includes(width) ? 'center' : 'start'),
            livewireId: ctx.livewire.id, id: `fi-${ctx.livewire.id}-action-${index}`, index, name: this.name,
            heading: (await evaluate(this._modalHeading, ctx)) ?? label,
            eyebrow: eyebrow === null || eyebrow === undefined || eyebrow === '' ? null : eyebrow,
            description: (await evaluate(this._modalDescription, ctx)) ?? (this._requiresConfirmation ? t('filament-actions::modal.confirmation') : null),
            iconName: icon, color: this._modalIconColor ?? color ?? 'primary',
            // Closing the modal unmounts the action (and its parents, with `cancelParentActionsOnClose()`).
            cancelParentActionsOnClose: this.getParentActionsToCancelOnClose(),
        });
    }
    /**
     * JavaScript (Alpine) run on click, instead of a request to the server: e.g. `close()` in a modal. Never build it from
     * user input.
     */
    alpineClickHandler(handler: string | null): this { this._alpineClick = handler; this._lazyAlpineClick = null; return this; }
    private _lazyAlpineClick: ((ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
    /**
     * Runs JavaScript in the browser on click, without any request: no modal, no server code. In a schema, `$get()` and
     * `$set()` read and change its fields. Never build the string from user input (it is executed as code); a value read
     * with `$get()` is data and is safe to use as a string.
     */
    actionJs(action: string | null | ((ctx: ComponentContext) => string | null | Promise<string | null>)): this {
        if (typeof action === 'function') { this._lazyAlpineClick = action; this._alpineClick = null; } else this.alpineClickHandler(action);
        return this;
    }
    private async resolveAlpineClick(ctx: ComponentContext): Promise<string | null> { return this._lazyAlpineClick ? this._lazyAlpineClick(ctx) : this._alpineClick; }
    private _livewireTarget: string | null = null;
    private _iconAfter = false;
    /** Loading indicator target (`wire:target`) when the click is handled in JavaScript. */
    livewireTarget(target: string | null): this { this._livewireTarget = target; return this; }
    /** `'after'` puts the icon (and loading indicator) after the label. */
    iconPosition(position: 'before' | 'after'): this { this._iconAfter = position === 'after'; return this; }
    keyBindings(bindings: string[]): this { this._keyBindings = bindings; return this; }
    getName(): string { return this.name; }

    // --- authorization (Filament's `CanBeAuthorized`)
    private _authorization: ActionAuthorization | Lazy<boolean | AuthorizationResponse, ComponentContext> | null = null;
    private _authorizationMessage: Lazy<string | null, ComponentContext> = null;
    private _authorizationTooltip: Lazy<boolean, ComponentContext> = false;
    private _authorizationNotification: Lazy<boolean, ComponentContext> = false;
    private _unauthorizedNotification: ((notification: any, ctx: ActionCallContext & { response: AuthorizationResponse }) => any) | null | undefined = undefined;
    private _unauthorizedNotificationTitle: string | ((ctx: ActionCallContext & { response: AuthorizationResponse }) => string | null) | null = null;
    /**
     * Authorization check, separate from `visible` / `hidden`: when it fails, the action is hidden and the server refuses it.
     * A string (or a list of strings, all required) is a policy ability of the host (resource, relation manager), checked
     * with the action's record; a function returns a boolean or an `AuthorizationResponse`.
     */
    authorize(abilities: string | string[] | Lazy<boolean | AuthorizationResponse, ComponentContext>, args: unknown[] = []): this {
        this._authorization = typeof abilities === 'string' || Array.isArray(abilities) ? { type: 'all', abilities: [abilities].flat(), arguments: args } : abilities;
        return this;
    }
    /** Policy abilities of which one is enough. */
    authorizeAny(abilities: string | string[], args: unknown[] = []): this { this._authorization = { type: 'any', abilities: [abilities].flat(), arguments: args }; return this; }
    /** Message used when the authorization is denied without one (plain `false`): it keeps the action visible for `authorizationTooltip()` / `authorizationNotification()`. */
    authorizationMessage(message: Lazy<string | null, ComponentContext>): this { this._authorizationMessage = message; return this; }
    /** Unauthorized: the action is shown disabled, with the denial message as its tooltip (hidden when there is no message). */
    authorizationTooltip(condition: Lazy<boolean, ComponentContext> = true): this { this._authorizationTooltip = condition; return this; }
    /** Unauthorized: the action stays clickable, and clicking it sends a notification with the denial message (hidden when there is no message). */
    authorizationNotification(condition: Lazy<boolean, ComponentContext> = true): this { this._authorizationNotification = condition; return this; }
    /** Customizes the notification of `authorizationNotification()`; `null` sends none. */
    unauthorizedNotification(customize: ((notification: any, ctx: ActionCallContext & { response: AuthorizationResponse }) => any) | null): this { this._unauthorizedNotification = customize; return this; }
    unauthorizedNotificationTitle(title: string | ((ctx: ActionCallContext & { response: AuthorizationResponse }) => string | null) | null): this { this._unauthorizedNotificationTitle = title; return this; }
    getUnauthorizedNotificationCustomizer(): ((notification: any, ctx: ActionCallContext & { response: AuthorizationResponse }) => any) | null | undefined { return this._unauthorizedNotification; }
    getUnauthorizedNotificationTitle(ctx: ActionCallContext & { response: AuthorizationResponse }): string | null { const title = this._unauthorizedNotificationTitle; return typeof title === 'function' ? title(ctx) : title; }
    hasAuthorization(): boolean { return this._authorization !== null || this._authorizationMessage !== null || this._authorizationTooltip !== false || this._authorizationNotification !== false; }
    async getAuthorizationMessage(ctx: ComponentContext): Promise<string | null> { return evaluate(this._authorizationMessage, ctx); }
    async hasAuthorizationTooltip(ctx: ComponentContext): Promise<boolean> { return Boolean(await evaluate(this._authorizationTooltip, ctx)); }
    async hasAuthorizationNotification(ctx: ComponentContext): Promise<boolean> { return Boolean(await evaluate(this._authorizationNotification, ctx)); }
    /** The authorization decision in this context. Abilities are checked by the host (`inspectActionAbility()`); a host that cannot check them denies. */
    async getAuthorizationResponse(ctx: ComponentContext): Promise<AuthorizationResponse> {
        const authorization = this._authorization;
        if (authorization === null) return AuthorizationResponse.allow();
        if (!isAbilityAuthorization(authorization)) return AuthorizationResponse.from(await evaluate(authorization, ctx));
        const inspect = (ctx.livewire as any)?.inspectActionAbility;
        let firstDenied: AuthorizationResponse | null = null;
        for (const ability of authorization.abilities) {
            const response = typeof inspect === 'function' ? AuthorizationResponse.from(await inspect.call(ctx.livewire, ability, ctx.record ?? null, authorization.arguments)) : AuthorizationResponse.deny();
            if (authorization.type === 'any') { if (response.allowed()) return response; firstDenied ??= response; }
            else if (response.denied()) return response;
        }
        return authorization.type === 'any' ? (firstDenied ?? AuthorizationResponse.deny()) : AuthorizationResponse.allow();
    }
    /** The decision, a denial carrying `authorizationMessage()` when one is set. */
    async getAuthorizationResponseWithMessage(ctx: ComponentContext): Promise<AuthorizationResponse> {
        const response = await this.getAuthorizationResponse(ctx);
        if (response.allowed()) return response;
        const message = await this.getAuthorizationMessage(ctx);
        return message ? response.withMessage(message) : response;
    }
    async isAuthorized(ctx: ComponentContext): Promise<boolean> { return (await this.getAuthorizationResponse(ctx)).allowed(); }
    /** Authorized, or kept visible by `authorizationTooltip()` / `authorizationNotification()` because the denial has a message. */
    async isAuthorizedOrNotHiddenWhenUnauthorized(ctx: ComponentContext): Promise<boolean> {
        if (!(await this.hasAuthorizationTooltip(ctx)) && !(await this.hasAuthorizationNotification(ctx))) return this.isAuthorized(ctx);
        const response = await this.getAuthorizationResponseWithMessage(ctx);
        return response.allowed() || Boolean(response.message());
    }
    async isVisible(ctx: ComponentContext): Promise<boolean> { return !(await evaluate(this._hidden, ctx)) && (await evaluate(this._visible, ctx)) && (await this.isAuthorizedOrNotHiddenWhenUnauthorized(ctx)); }
    visible(condition: Lazy<boolean, ComponentContext> = true): this { this._visible = condition; return this; }
    /** Shown but unusable; the server also refuses to mount it. */
    disabled(condition: Lazy<boolean, ComponentContext> = true): this { this._disabled = condition; return this; }
    /** Disabled by `disabled()`, or unauthorized with `authorizationTooltip()`. */
    async isDisabled(ctx: ComponentContext): Promise<boolean> {
        if (await evaluate(this._disabled, ctx)) return true;
        if (await this.hasAuthorizationNotification(ctx)) return false;
        if (!(await this.hasAuthorizationTooltip(ctx))) return false;
        return !(await this.isAuthorized(ctx));
    }
    /** Whether the action may render as disabled (its markup then carries the disabled state). */
    private canBeDisabled(): boolean { return this._disabled !== false || this._authorizationTooltip !== false; }
    /** The tooltip; unauthorized with `authorizationTooltip()`, the denial message. */
    async getTooltip(ctx: ComponentContext): Promise<string | null> {
        if (await this.hasAuthorizationTooltip(ctx)) {
            const response = await this.getAuthorizationResponseWithMessage(ctx);
            if (response.denied() && response.message()) return response.message();
        }
        return evaluate(this._tooltip, ctx);
    }

    private _view: 'button' | 'link' | 'icon-button' | 'badge' | null = null;
    private _labeledFrom: string | null = null;
    private _outlined = false;
    /** Trigger style, instead of the one chosen by the location of the action. */
    button(): this { this._view = 'button'; return this; }
    link(): this { this._view = 'link'; return this; }
    /** Icon only: the label becomes the tooltip and accessible name. */
    iconButton(condition = true): this { this._iconButton = condition; this._view = condition ? 'icon-button' : null; return this; }
    badge(badge?: string | number | null | (() => string | number | null | Promise<string | number | null>)): this {
        // `badge()` without argument: badge trigger style; with a value: a counter on the button.
        if (arguments.length === 0) { this._view = 'badge'; return this; }
        this._badge = badge ?? null;
        return this;
    }
    /** Icon button on small screens, labeled button from this breakpoint up (`sm`, `md`, `lg`, `xl`, `2xl`). */
    labeledFrom(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | null): this { this._labeledFrom = breakpoint !== null && ['sm', 'md', 'lg', 'xl', '2xl'].includes(breakpoint) ? breakpoint : null; return this; }
    /** Outlined button. */
    outlined(condition = true): this { this._outlined = condition; return this; }
    getView(): 'button' | 'link' | 'icon-button' | 'badge' | null { return this._view; }
    /** Markup of a link, icon button or badge trigger; `attributes` carries the click (or href) behavior. */
    private async styledTriggerHtml(ctx: ComponentContext, view: 'link' | 'icon-button' | 'badge', attributes: string, tag: 'button' | 'a', wireTarget: string | null, disabled = false): Promise<string> {
        const label = (await evaluate(this._label, ctx)) ?? this.getDefaultLabel();
        const iconName = this._lazyIcon ? await this._lazyIcon(ctx) : this._icon;
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const colors = (component: 'link' | 'icon-button' | 'badge') => (color !== 'gray' ? colorManager!.getComponentClasses(component, color) : []);
        const loader = tag === 'button' && wireTarget ? loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': wireTarget })) : '';
        const glyph = iconName ? icon(iconName, { attributes: tag === 'button' && wireTarget ? new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': wireTarget }) : undefined }) : '';
        const tooltip = await this.tooltipAttribute(ctx);
        // Disabled: with a tooltip, the element must still receive the pointer, so it loses its click instead of being `disabled`.
        if (disabled) attributes = `${tooltip ? stripClickAttributes(attributes) : `${attributes}${tag === 'button' ? ' disabled' : ''}`} aria-disabled="true"`;
        const state = disabled ? 'fi-disabled' : null;
        if (view === 'icon-button') return `<${tag} title="${e(label)}" aria-label="${e(label)}" ${tooltip}${attributes} class="${cls(['fi-ac-icon-btn-action', 'fi-icon-btn', state, `fi-size-${this._size}`, ...colors('icon-button')])}">${glyph}${loader}</${tag}>`;
        if (view === 'badge') return `<${tag} ${tooltip}${attributes} class="${cls(['fi-ac-badge-action', 'fi-badge', state, `fi-size-${this._size}`, ...colors('badge')])}">${glyph}${loader}<span class="fi-badge-label-ctn"><span class="fi-badge-label">${e(label)}</span></span></${tag}>`;
        return `<${tag} ${tooltip}${attributes} class="${cls(['fi-ac-link-action', 'fi-link', state, `fi-size-${this._size}`, ...colors('link')])}">${glyph}${loader}<span class="fi-link-label">${e(label)}</span></${tag}>`;
    }

    /** Renders the action as a button (or as a link when it has a URL), with its extra attributes. */
    async toHtml(ctx: ComponentContext, explicitMountContext: Record<string, unknown> | null = null): Promise<string> { return this.withExtraAttributes(await this.renderHtml(ctx, explicitMountContext), ctx); }
    private async renderHtml(ctx: ComponentContext, explicitMountContext: Record<string, unknown> | null): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const linkUrl = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        const alpineClick = await this.resolveAlpineClick(ctx);
        const disabled = this.canBeDisabled() && (await this.isDisabled(ctx));
        // An action of a modal's custom content is mounted on top of the modal's action.
        explicitMountContext ??= this._parentMountContext;
        // Explicit trigger styles (link, icon button, badge), and the icon button / labeled button pair of `labeledFrom()`.
        if (this._submit === null && (this._view === 'link' || this._view === 'icon-button' || this._view === 'badge' || this._labeledFrom)) {
            const safeUrl = linkUrl !== null && /^(\/(?!\/)|https?:\/\/)/.test(linkUrl) ? linkUrl : null;
            const mountContext = explicitMountContext ?? (ctx.livewire as any)?.getActionMountContext?.() ?? {};
            // JavaScript click handler (`actionJs()`): nothing is sent to the server.
            const mountExpression = (this._handler || this.hasModalContentOnly()) && !alpineClick ? this.mountExpressionFor(mountContext) : null;
            const wireClick = alpineClick ? null : (mountExpression ?? this._action);
            const click = safeUrl ? `href="${e(safeUrl)}" ${this._newTab ? 'target="_blank" ' : 'wire:navigate '}` : `type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" ${alpineClick ? `x-on:click="${e(alpineClick)}" ` : ''}${wireClick ? `${mountExpression ? this.clickAttribute() : 'wire:click'}="${e(wireClick)}" ` : ''}`;
            const tag = safeUrl ? 'a' : 'button';
            const target = this._livewireTarget ?? wireClick;
            if (this._labeledFrom) {
                const iconButton = (await this.styledTriggerHtml(ctx, 'icon-button', click.trim(), tag, target, disabled)).replace('class="fi-ac-icon-btn-action', `class="${this._labeledFrom}:fi-hidden fi-ac-icon-btn-action`);
                const previousView = this._view, previousLabeled = this._labeledFrom;
                this._view = null; this._labeledFrom = null;
                try {
                    const labeled = (await this.toHtml(ctx, explicitMountContext)).replace(/class="([^"]*\bfi-btn\b[^"]*)"/, (_match, classes: string) => `class="${classes} fi-hidden ${previousLabeled}:fi-inline-grid"`);
                    return iconButton + labeled;
                } finally { this._view = previousView; this._labeledFrom = previousLabeled; }
            }
            return this.styledTriggerHtml(ctx, this._view as 'link' | 'icon-button' | 'badge', click.trim(), tag, target, disabled);
        }
        if (linkUrl !== null && this._postToUrl && /^(\/(?!\/)|https?:\/\/)/.test(linkUrl)) {
            const classes = cls(['fi-ac-btn-action', 'fi-btn', `fi-size-${this._size}`, ...(this._outlined ? ['fi-outlined', ...colorManager.getComponentClasses('button-outlined', this._color)] : this._color !== 'gray' ? colorManager.getComponentClasses('button', this._color) : [])]);
            return postForm(linkUrl, ctx, [], `<button type="submit" ${await this.tooltipAttribute(ctx)}class="${classes}">${this._icon ? icon(this._icon) : ''}${e((await evaluate(this._label, ctx)) ?? this.getDefaultLabel())}</button>`);
        }
        const tooltip = await this.tooltipAttribute(ctx);
        if (linkUrl !== null && /^(\/(?!\/)|https?:\/\/)/.test(linkUrl)) {
            const link = new Attributes().class(['fi-ac-btn-action', 'fi-btn', { 'fi-disabled': disabled }, `fi-size-${this._size}`, ...(this._color !== 'gray' ? colorManager.getComponentClasses('button', this._color) : [])]);
            const linkIcon = this._icon ? icon(this._icon) : '';
            const badge = typeof this._badge === 'function' ? await this._badge() : this._badge;
            const badgeHtml = badge !== null && badge !== '' ? `<div class="fi-btn-badge-ctn"><span class="${['fi-color', `fi-color-${this._badgeColor}`, ...colorManager.getComponentClasses('badge', this._badgeColor).filter((c) => !c.startsWith('fi-color')), 'fi-badge', 'fi-size-xs'].join(' ')}">${e(String(badge))}</span></div>` : '';
            // Disabled with a tooltip: no link, but still focusable for the tooltip.
            const linkOff = disabled && tooltip !== '';
            const href = linkOff ? 'tabindex="0" ' : `href="${e(linkUrl)}" ${this._newTab ? 'target="_blank" ' : ''}`;
            return `<a ${href}${tooltip}${this._newTab || linkOff ? '' : 'wire:navigate '}${disabled ? 'aria-disabled="true" ' : ''}${link.toHtml()}>${linkIcon}${e((await evaluate(this._label, ctx)) ?? this.getDefaultLabel())}${badgeHtml}</a>`;
        }
        const isSubmit = this._submit !== null;
        // Handler action: the click mounts the action on the server, with the host's context (e.g. the record).
        const mountContext = explicitMountContext ?? (ctx.livewire as any)?.getActionMountContext?.() ?? {};
        // Without context, the short form `mountAction('name')` is emitted; a JavaScript click handler sends nothing.
        const mountExpression = (this._handler || this.hasModalContentOnly()) && !alpineClick ? this.mountExpressionFor(mountContext) : null;
        const wireClick = alpineClick ? null : (mountExpression ?? this._action);
        // Disabled with a tooltip: the button keeps the pointer for the tooltip but loses its click.
        const clickable = !(disabled && tooltip !== '');
        const attributes = new Attributes()
            .merge({
                'aria-disabled': disabled ? 'true' : null,
                disabled: disabled && tooltip === '' ? 'disabled' : null,
                type: isSubmit ? 'submit' : 'button',
                form: isSubmit ? this._formId : null,
                'wire:loading.attr': 'aria-disabled',
                'wire:loading.class': 'fi-disabled',
                'wire:target': this._livewireTarget ?? this._submit ?? (this._accessSelectedRecords && mountExpression ? mountExpression : null),
                'x-bind:disabled': isSubmit ? 'isProcessing' : null,
            })
            .class(['fi-ac-btn-action', 'fi-btn', { 'fi-disabled': disabled }, `fi-size-${this._size}`, ...(this._outlined ? ['fi-outlined', ...colorManager.getComponentClasses('button-outlined', this._color)] : colorManager.getComponentClasses('button', this._color))])
            .when(clickable && wireClick, (a) => a.set(mountExpression ? this.clickAttribute() : 'wire:click', wireClick!))
            .when(clickable && alpineClick, (a) => a.set('x-on:click', alpineClick!));
        const wireTarget = this._livewireTarget ?? this._submit ?? wireClick;
        const keyBindings = this._keyBindings.length ? `x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" ` : '';
        return views.render('filament-actions::button', {
            attributes: attributes.toHtml(), isSubmit, keyBindings: keyBindings + tooltip, iconAfter: this._iconAfter, hasWireLoader: wireTarget !== null,
            label: (await evaluate(this._label, ctx)) ?? this.getDefaultLabel(),
            wireLoader: loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': wireTarget })),
            iconHtml: this._icon ? icon(this._icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': wireTarget }) }) : '',
            formLoader: loadingIndicator(new Attributes({ 'x-cloak': 'x-cloak', 'x-show': 'isProcessing' })),
        });
    }
}

/** Removes the click behavior (href, `x-on:`, `wire:click`, `wire:navigate`) from rendered attributes. */
function stripClickAttributes(attributes: string): string {
    return attributes.replace(/\s*(?:href|x-on:[^\s=]+|wire:click[^\s=]*|wire:navigate)(?:="[^"]*")?/g, '').trim();
}

/** Group of actions collapsed into a dropdown behind a "⋮" icon button. */
/**
 * Actions in a dropdown menu ("⋮" icon button by default). A nested group with `dropdown(false)` is shown as a section of
 * the menu, separated by a divider. `buttonGroup()` shows the actions side by side instead.
 */
export class ActionGroup {
    private actions: (Action | ActionGroup)[];
    private _label: string | null = null;
    private _icon: string | null = null;
    private _color = 'primary';
    private _size = 'md';
    private _tooltip: string | null = null;
    private _view: 'icon-button' | 'button' | 'link' = 'icon-button';
    private _dropdown = true;
    private _buttonGroup = false;
    private _placement: string | null = null;
    private _width: string | null = null;
    private _offset: number | null = null;
    private _maxHeight: string | null = null;
    private _hidden: Lazy<boolean, ComponentContext> = false;
    constructor(actions: (Action | ActionGroup)[]) { this.actions = actions; }
    static make(actions: (Action | ActionGroup)[]): ActionGroup { return configured(new ActionGroup(actions)); }
    /** Every action of the group, nested groups included. */
    getActions(): Action[] { return this.actions.flatMap((action) => (action instanceof ActionGroup ? action.getActions() : [action])); }
    getName(): string { return 'group'; }
    /** A group is never mounted: its actions are. */
    isMountable(): boolean { return false; }
    label(label: string | null): this { this._label = label; return this; }
    icon(icon: string): this { this._icon = icon; return this; }
    color(color: string): this { this._color = color; return this; }
    size(size: string): this { this._size = size; return this; }
    tooltip(tooltip: string | null): this { this._tooltip = tooltip; return this; }
    /** Labeled button trigger. */
    button(): this { this._view = 'button'; return this; }
    link(): this { this._view = 'link'; return this; }
    iconButton(): this { this._view = 'icon-button'; return this; }
    /** `false`: inside another group, the actions form a section of its menu (with a divider). */
    dropdown(condition = true): this { this._dropdown = condition; return this; }
    hasDropdown(): boolean { return this._dropdown; }
    /** The actions side by side, as a group of buttons. */
    buttonGroup(condition = true): this { this._buttonGroup = condition; return this; }
    private _flip = true;
    /** Menu placement: `bottom-start`, `bottom-end`, `top-start`... (`bottom-end` in tables). */
    dropdownPlacement(placement: string | null): this { this._placement = placement !== null && (/^(top|bottom|left|right)(-(start|end))?$/.test(placement) || placement === 'auto-placement') ? placement : null; return this; }
    /** Places the menu on the side with the most space, instead of a fixed placement that flips when there is no room. */
    dropdownAutoPlacement(): this { this._placement = 'auto-placement'; this._flip = false; return this; }
    /** `false`: the menu keeps its placement even without room for it. */
    dropdownFlip(condition = true): this { this._flip = condition; return this; }
    /** Menu width: `xs` to `7xl`. */
    dropdownWidth(width: string | null): this { this._width = width !== null && /^(xs|sm|md|lg|xl|[2-7]xl)$/.test(width) ? width : null; return this; }
    /** Distance between the trigger and the menu, in pixels (8 by default). */
    dropdownOffset(offset: number | null): this { this._offset = offset !== null && Number.isFinite(offset) ? Math.max(0, Math.round(offset)) : null; return this; }
    /** Maximum height of the menu, as a CSS length; it scrolls beyond. */
    maxHeight(height: string | null): this { this._maxHeight = height !== null && /^[0-9.]+(px|rem|em|vh|%)$/.test(height) ? height : null; return this; }
    /** Filament's name of `maxHeight()`. */
    dropdownMaxHeight(height: string | null): this { return this.maxHeight(height); }
    hidden(condition: Lazy<boolean, ComponentContext> = true): this { this._hidden = condition; return this; }
    visible(condition: Lazy<boolean, ComponentContext> = true): this { return this.hidden(typeof condition === 'function' ? async (ctx) => !(await condition(ctx)) : !condition); }
    async isVisible(ctx: ComponentContext): Promise<boolean> {
        if (await evaluate(this._hidden, ctx)) return false;
        for (const action of this.actions) if (await action.isVisible(ctx)) return true;
        return false;
    }
    private triggerHtml(): string {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const label = this._label ?? t('filament-actions::group.trigger.label');
        const tooltip = this._tooltip ? ` x-tooltip="${e(`{ content: ${js(this._tooltip)}, theme: $store.theme, allowHTML: false }`)}"` : '';
        const colors = (component: 'icon-button' | 'button' | 'link') => (this._color !== 'gray' || component === 'icon-button' ? colorManager!.getComponentClasses(component, this._color) : []);
        if (this._view === 'button') return `<button${tooltip} type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${cls(['fi-ac-btn-group', 'fi-btn', `fi-size-${this._size}`, ...colors('button')])}">${icon(this._icon ?? icons.resolve('actions::action-group') ?? 'm-ellipsis-vertical')}${e(label)}</button>`;
        if (this._view === 'link') return `<button${tooltip} type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${cls(['fi-ac-link-group', 'fi-link', `fi-size-${this._size}`, ...colors('link')])}">${icon(this._icon ?? icons.resolve('actions::action-group') ?? 'm-ellipsis-vertical')}<span class="fi-link-label">${e(label)}</span></button>`;
        return `<button title="${e(label)}" aria-label="${e(label)}"${tooltip} type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-icon-btn-group', 'fi-icon-btn', `fi-size-${this._size}`, ...colors('icon-button')].join(' ')}">${icon(this._icon ?? icons.resolve('actions::action-group') ?? 'm-ellipsis-vertical')}</button>`;
    }
    /** Menu items of the visible actions, one list per section (nested groups without dropdown). */
    private async itemLists(ctx: ComponentContext, context: Record<string, unknown>, keyOf: (action: Action) => string): Promise<string[][]> {
        const lists: string[][] = [];
        let current: string[] = [];
        for (const action of this.actions) {
            if (action instanceof ActionGroup && !action.hasDropdown()) {
                if (!(await action.isVisible(ctx))) continue;
                if (current.length) { lists.push(current); current = []; }
                lists.push(...(await action.itemLists(ctx, context, keyOf)));
                continue;
            }
            if (!(await action.isVisible(ctx))) continue;
            current.push(action instanceof ActionGroup ? await action.toHtml(ctx, context, keyOf) : await action.toRecordGroupedHtml(ctx, context, keyOf(action)));
        }
        if (current.length) lists.push(current);
        return lists.filter((list) => list.length);
    }
    /** `keyOf` returns each action's `wire:key` (it depends on the record in a table). */
    async toHtml(ctx: ComponentContext, explicitContext: Record<string, unknown> | null = null, keyOf: (action: Action) => string = (action) => `actions.${action.getName()}`): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        if (await evaluate(this._hidden, ctx)) return '';
        const context = explicitContext ?? (ctx.livewire as any)?.getActionMountContext?.() ?? {};
        if (this._buttonGroup) {
            const buttons: string[] = [];
            for (const action of this.getActions()) if (await action.isVisible(ctx)) buttons.push(await action.toHtml(ctx, explicitContext));
            return buttons.length ? `<div class="fi-btn-group">${buttons.join('')}</div>` : '';
        }
        const lists = await this.itemLists(ctx, context, keyOf);
        if (!lists.length) return '';
        const panelClasses = cls(['fi-dropdown-panel', this._width ? `fi-width-${this._width}` : null, { 'fi-scrollable': this._maxHeight !== null }]);
        const style = this._maxHeight ? ` style="max-height: ${this._maxHeight}"` : '';
        return `<div x-data="filamentDropdown" class="fi-dropdown"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger">${this.triggerHtml()}</div><div x-cloak x-float.placement.${this._placement ?? 'bottom-end'}${this._flip ? '.flip' : ''}.teleport.offset="{ offset: ${this._offset ?? 8} }" x-ref="panel" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" role="menu" class="${panelClasses}"${style}>${lists.map((items) => `<div class="fi-dropdown-list" role="group">${items.join(' ')}</div>`).join('')}</div></div>`;
    }
}
