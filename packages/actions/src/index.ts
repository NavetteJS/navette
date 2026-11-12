// @navette-js/actions — actions: buttons, links, menu items and modal actions.
import { Attributes, e, evaluate, icon, js, loadingIndicator, renderHook, views, type ColorManager, type Lazy, configured, configureUsing } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import type { ComponentContext, Renderable } from '@navette-js/schemas';
import { fileURLToPath } from 'node:url';

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

/** Execution context of a mounted action. */
export type ActionCallContext = { livewire: any; record: any; arguments: Record<string, unknown>; data: Record<string, unknown> };

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
    private _modalDescription: Lazy<string | null, ActionCallContext> = null;
    private _modalSubmitActionLabel: string | null = null;
    private _modalIcon: string | null = null;
    private _icon: string | null = null;
    private _alpineClick: string | null = null;
    private _keyBindings: string[] = [];
    private _schema: ((schema: any) => any) | null = null;
    private _extraModalFooterActions: Action[] = [];
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
    color(color: string | ((ctx: ComponentContext) => string | Promise<string>)): this { if (typeof color === 'function') this._lazyColor = color; else { this._color = color; this._lazyColor = null; } return this; }
    size(size: string): this { this._size = size; return this; }
    /** Renders a `type="submit"` button that triggers the form's submit method, e.g. `.submit('authenticate')`. */
    submit(form: string | null): this { this._submit = form; return this; }
    hidden(condition: Lazy<boolean, ComponentContext> = true): this { this._hidden = condition; return this; }
    /** Navigation action, rendered as `<a href wire:navigate>`. */
    url(url: string | null | ((ctx: ComponentContext) => string | null)): this { if (typeof url === 'function') this._lazyUrl = url; else { this._url = url; this._lazyUrl = null; } return this; }
    /** A string: host component method called on click (`wire:click`). A function: the action handler, mounted through `mountAction()` (with its modal, if any). */
    action(action: string | ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null): this {
        if (typeof action === 'function') { this._handler = action; this._action = null; } else { this._action = action; this._handler = null; }
        return this;
    }
    icon(name: string | null | ((ctx: ComponentContext) => string | null | Promise<string | null>)): this { if (typeof name === 'function') this._lazyIcon = name; else { this._icon = name; this._lazyIcon = null; } return this; }
    /** Icon used when the action is a table row link. */
    tableIcon(name: string | null): this { this._tableIcon = name; return this; }
    private _iconButton = false;
    /** Icon-only row action; the label becomes the tooltip and accessible name. */
    iconButton(condition = true): this { this._iconButton = condition; return this; }
    /** Icon used when the action is a menu item (ActionGroup). */
    groupedIcon(name: string | null): this { this._groupedIcon = name; return this; }
    requiresConfirmation(condition = true): this { this._requiresConfirmation = condition; return this; }
    modalHeading(heading: Lazy<string | null, ActionCallContext>): this { this._modalHeading = heading; return this; }
    modalDescription(description: Lazy<string | null, ActionCallContext>): this { this._modalDescription = description; return this; }
    modalSubmitActionLabel(label: string | null): this { this._modalSubmitActionLabel = label; return this; }
    modalIcon(name: string | null): this { this._modalIcon = name; return this; }
    private _badge: string | number | null | (() => string | number | null | Promise<string | number | null>) = null;
    private _badgeColor = 'primary';
    /** Badge (counter) shown on the button. */
    badge(badge: string | number | null | (() => string | number | null | Promise<string | number | null>)): this { this._badge = badge; return this; }
    badgeColor(color: string): this { this._badgeColor = color; return this; }
    private _slideOver = false;
    private _hasSubmit = true;
    /** Opens the modal as a slide-over panel. */
    slideOver(condition = true): this { this._slideOver = condition; return this; }
    /** `false`: read-only modal, without a submit button. */
    modalSubmitAction(condition: boolean): this { this._hasSubmit = condition; return this; }
    private _cancelLabel: string | null = null;
    /** Label of the modal's close button ("Cancel" by default). */
    modalCancelActionLabel(label: string | null): this { this._cancelLabel = label; return this; }
    private _tooltip: Lazy<string | null, ComponentContext> = null;
    private _newTab = false;
    /** Tooltip shown on hover. */
    tooltip(text: Lazy<string | null, ComponentContext>): this { this._tooltip = text; return this; }
    /** Opens the action's URL in a new tab. */
    openUrlInNewTab(condition = true): this { this._newTab = condition; return this; }
    private async tooltipAttribute(ctx: ComponentContext): Promise<string> {
        const text = await evaluate(this._tooltip, ctx);
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
     * Item of a panel menu (user menu, tenant menu). Only URL actions are rendered: these menus are not components
     * that can mount actions.
     */
    async toMenuItemHtml(ctx: ComponentContext, options: { navigate?: boolean } = {}): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const href = this.resolveUrl(ctx);
        if (!href || !/^(\/(?!\/)|https?:\/\/)/.test(href)) return '';
        const iconName = await this.getIcon(ctx);
        const colors = this._color !== 'gray' && this._color !== 'primary' ? colorManager.getComponentClasses('dropdown-item', this._color) : [];
        const glyph = iconName ? icon(iconName, { attributes: new Attributes().class(colors.length ? ['fi-color', `fi-color-${this._color}`] : []) }) : '';
        return `<a href="${e(href)}"${this._newTab ? ' target="_blank"' : options.navigate ? ' wire:navigate' : ''} class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')} " role="menuitem" tabindex="-1">${glyph}<span class="fi-dropdown-list-item-label">${e(await this.getLabel(ctx))}</span></a>`;
    }
    /** A computed URL depends on the record, so the host checks it again on mount (`resolveUrl`). */
    isMountable(): boolean { return (this._handler !== null || this._schema !== null) && this._url === null; }
    /** URL of the action in this context; an action with a URL is a link, never a mounted action. */
    resolveUrl(ctx: ComponentContext): string | null { return this._lazyUrl ? this._lazyUrl(ctx) : this._url; }
    hasModal(): boolean { return this._requiresConfirmation || this._schema !== null; }
    /** Form shown in the modal. With a function, the components are rebuilt on every request. */
    schema(components: any[] | ((schema: any) => any), columns: Record<string, number> | number | null = {}): this { this._schema = typeof components === 'function' ? components : () => components; this._schemaColumns = columns; return this; }
    /** Applies the action's form to the host's schema; the function returns either components or the configured schema. */
    applySchema(schema: any): any | null {
        if (!this._schema) return null;
        const result = this._schema(schema);
        return Array.isArray(result) ? schema.columns(this._schemaColumns).components(result) : result;
    }
    /** Extra buttons in the modal footer, after the submit button. */
    extraModalFooterActions(actions: Action[]): this { this._extraModalFooterActions = actions; return this; }
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
    async call(ctx: ActionCallContext): Promise<unknown> {
        if (!this._handler) return null;
        if (this._mutateData) ctx = { ...ctx, data: await this._mutateData(ctx.data ?? {}, ctx) };
        await this._before?.(ctx);
        const result = await this._handler(ctx);
        await this._after?.(ctx);
        return result;
    }

    /** Menu item of a table bulk action. The click goes through the table's Alpine `mountAction()`, which sends the selection. */
    async toGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>): Promise<string> {
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
    async toRecordGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const iconName = this._lazyIcon ? await this._lazyIcon(ctx) : (this._groupedIcon ?? this._icon);
        const expression = e(`mountAction(${js(this.name)}, {}, ${js(context)})`);
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
        if (this._disabled !== false) {
            // Conditionally disabled: this markup is used whether or not the action ends up disabled.
            const disabled = await this.isDisabled(ctx);
            return `<button ${disabled ? 'aria-disabled="true" ' : ''}role="menuitem" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', disabled ? 'fi-disabled' : null, ...colors].filter(Boolean).join(' ')}" wire:click="${expression}" wire:key="${e(wireKey)}">${inner}</button>`;
        }
        if (this._keyBindings.length) {
            return `<button x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" role="menuitem" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', ...colors].join(' ')}" wire:click="${expression}" wire:key="${e(wireKey)}">${inner}</button>`;
        }
        return `<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" wire:click="${expression}" wire:key="${e(wireKey)}" class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')}" role="menuitem" tabindex="-1">${inner}</button>`;
    }

    /** Small link (or icon button) for a table row action. */
    async toLinkHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const iconName = this._lazyIcon ? await this._lazyIcon(ctx) : (this._tableIcon ?? this._icon);
        const raw = `mountAction(${js(this.name)}, {}, ${js(context)})`;
        const label = (await evaluate(this._label, ctx)) ?? this.getDefaultLabel();
        const classes = ['fi-ac-link-action', 'fi-link', 'fi-size-sm', ...(color !== 'gray' ? colorManager.getComponentClasses('link', color) : [])].join(' ');
        if (this._iconButton) {
            const disabled = this._disabled !== false && (await this.isDisabled(ctx));
            const buttonClasses = ['fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-sm', disabled ? 'fi-disabled' : null, ...(color !== 'gray' ? colorManager.getComponentClasses('icon-button', color) : [])].filter(Boolean).join(' ');
            const glyph = iconName ? icon(iconName, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': raw }) }) : '';
            return `<button title="${e(label)}" aria-label="${e(label)}" ${disabled ? 'disabled ' : ''}type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${buttonClasses}"${disabled ? '' : ` wire:click="${e(raw)}"`} wire:key="${e(wireKey)}">${glyph}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': raw }))}</button>`;
        }
        const iconHtml = iconName ? icon(iconName, { size: 'sm', attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': raw }) }) : '';
        const href = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        const tooltip = await this.tooltipAttribute(ctx);
        // Only local or http(s) URLs become links (no `javascript:` or protocol-relative URLs).
        if (href && /^(\/(?!\/)|https?:\/\/)/.test(href)) return `<a href="${e(href)}" ${this._newTab ? 'target="_blank" ' : ''}${tooltip}${this._newTab ? '' : 'wire:navigate '}wire:key="${e(wireKey)}" class="${classes}">${iconName ? icon(iconName, { size: 'sm' }) : ''}<span class="fi-link-label">${e(label)}</span></a>`;
        const keys = this._keyBindings.length ? `x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" ` : '';
        return `<button ${keys}${tooltip}type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${classes}" wire:click="${e(raw)}" wire:key="${e(wireKey)}">${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': raw }), 'sm')}<span class="fi-link-label">${e(label)}</span></button>`;
    }

    /** Modal of a mounted action; `content` is the rendered form, if any. */
    async toModalHtml(ctx: ActionCallContext, index: number, content: string | null = null): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const schemaCtx = { livewire: ctx.livewire, component: null as any, operation: null, record: ctx.record, get: () => undefined, state: undefined };
        const label = (await evaluate(this._label, schemaCtx)) ?? this.getDefaultLabel();
        const color = this._lazyColor ? await this._lazyColor(schemaCtx) : this._color;
        const confirmation = this._requiresConfirmation;
        // A confirmation is centered (md); a form is start-aligned (4xl), except at small widths.
        const width = this._modalWidth ?? (confirmation ? 'md' : '4xl');
        const submitLabel = this._modalSubmitActionLabel ?? t(confirmation ? 'filament-actions::modal.actions.confirm.label' : 'filament-actions::modal.actions.submit.label');
        // Hook order: custom content, schema, content footer, each between its before/after slots.
        const scopes = (ctx.livewire as any).getRenderHookScopes?.() ?? [];
        const hook = (name: string) => renderHook(name, scopes, { action: this });
        const hooked = hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_BEFORE) + hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_AFTER)
            + (content !== null ? hook(ActionsRenderHook.MODAL_SCHEMA_BEFORE) + content + hook(ActionsRenderHook.MODAL_SCHEMA_AFTER) : '')
            + hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE) + hook(ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER);
        if (content !== null || hooked !== '') content = hooked;
        return views.render('filament-actions::modal', {
            slideOver: this._slideOver, content, confirmation, width, alignment: confirmation || ['xs', 'sm'].includes(width) ? 'center' : 'start',
            livewireId: ctx.livewire.id, id: `fi-${ctx.livewire.id}-action-${index}`, index, name: this.name,
            heading: (await evaluate(this._modalHeading, ctx)) ?? label,
            description: (await evaluate(this._modalDescription, ctx)) ?? (this._requiresConfirmation ? t('filament-actions::modal.confirmation') : null),
            iconName: this._modalIcon ?? (this._requiresConfirmation ? 'o-exclamation-triangle' : null), color,
            cancel: await Action.make('cancel').label(this._cancelLabel ?? t('filament-actions::modal.actions.cancel.label')).color('gray').alpineClickHandler('close()').toHtml(schemaCtx),
            // The submit button of a gray action uses the primary color.
            submit: !this._hasSubmit ? '' : (await Action.make('submit').label(submitLabel).color(color === 'gray' ? 'primary' : color).submit('callMountedAction').toHtml(schemaCtx)) + (await Promise.all(this._extraModalFooterActions.map((a) => a.toHtml(schemaCtx)))).join(''),
        });
    }
    alpineClickHandler(handler: string | null): this { this._alpineClick = handler; return this; }
    private _livewireTarget: string | null = null;
    private _iconAfter = false;
    /** Loading indicator target (`wire:target`) when the click is handled in JavaScript. */
    livewireTarget(target: string | null): this { this._livewireTarget = target; return this; }
    /** `'after'` puts the icon (and loading indicator) after the label. */
    iconPosition(position: 'before' | 'after'): this { this._iconAfter = position === 'after'; return this; }
    keyBindings(bindings: string[]): this { this._keyBindings = bindings; return this; }
    getName(): string { return this.name; }

    private _authorize: Lazy<boolean, ComponentContext> = true;
    /** Authorization check, separate from `visible` / `hidden`: when it fails, the action is hidden and the server refuses it. */
    authorize(condition: Lazy<boolean, ComponentContext>): this { this._authorize = condition; return this; }
    async isVisible(ctx: ComponentContext): Promise<boolean> { return !(await evaluate(this._hidden, ctx)) && (await evaluate(this._visible, ctx)) && Boolean(await evaluate(this._authorize, ctx)); }
    visible(condition: Lazy<boolean, ComponentContext> = true): this { this._visible = condition; return this; }
    /** Shown but unusable; the server also refuses to mount it. */
    disabled(condition: Lazy<boolean, ComponentContext> = true): this { this._disabled = condition; return this; }
    async isDisabled(ctx: ComponentContext): Promise<boolean> { return evaluate(this._disabled, ctx); }

    /** Renders the action as a button (or as a link when it has a URL). */
    async toHtml(ctx: ComponentContext, explicitMountContext: Record<string, unknown> | null = null): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const linkUrl = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        if (linkUrl !== null && /^(\/(?!\/)|https?:\/\/)/.test(linkUrl)) {
            const link = new Attributes().class(['fi-ac-btn-action', 'fi-btn', `fi-size-${this._size}`, ...(this._color !== 'gray' ? colorManager.getComponentClasses('button', this._color) : [])]);
            const linkIcon = this._icon ? icon(this._icon) : '';
            const badge = typeof this._badge === 'function' ? await this._badge() : this._badge;
            const badgeHtml = badge !== null && badge !== '' ? `<div class="fi-btn-badge-ctn"><span class="${['fi-color', `fi-color-${this._badgeColor}`, ...colorManager.getComponentClasses('badge', this._badgeColor).filter((c) => !c.startsWith('fi-color')), 'fi-badge', 'fi-size-xs'].join(' ')}">${e(String(badge))}</span></div>` : '';
            return `<a href="${e(linkUrl)}" ${this._newTab ? 'target="_blank" ' : ''}${await this.tooltipAttribute(ctx)}${this._newTab ? '' : 'wire:navigate '}${link.toHtml()}>${linkIcon}${e((await evaluate(this._label, ctx)) ?? this.getDefaultLabel())}${badgeHtml}</a>`;
        }
        const isSubmit = this._submit !== null;
        // Handler action: the click mounts the action on the server, with the host's context (e.g. the record).
        const mountContext = explicitMountContext ?? (ctx.livewire as any)?.getActionMountContext?.() ?? {};
        // Without context, the short form `mountAction('name')` is emitted.
        const mountExpression = this._handler ? (Object.keys(mountContext).length ? `mountAction(${js(this.name)}, {}, ${js(mountContext)})` : `mountAction(${js(this.name)})`) : null;
        const attributes = new Attributes()
            .merge({
                type: isSubmit ? 'submit' : 'button',
                'wire:loading.attr': 'aria-disabled',
                'wire:loading.class': 'fi-disabled',
                'wire:target': this._livewireTarget ?? this._submit,
                'x-bind:disabled': isSubmit ? 'isProcessing' : null,
            })
            .class(['fi-ac-btn-action', 'fi-btn', `fi-size-${this._size}`, ...colorManager.getComponentClasses('button', this._color)])
            .when(this._action, (a) => a.set('wire:click', this._action!))
            .when(mountExpression, (a) => a.set('wire:click', mountExpression!))
            .when(this._alpineClick, (a) => a.set('x-on:click', this._alpineClick!));
        const wireTarget = this._livewireTarget ?? this._submit ?? this._action ?? mountExpression;
        const keyBindings = this._keyBindings.length ? `x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" ` : '';
        return views.render('filament-actions::button', {
            attributes: attributes.toHtml(), isSubmit, keyBindings, iconAfter: this._iconAfter, hasWireLoader: wireTarget !== null,
            label: (await evaluate(this._label, ctx)) ?? this.getDefaultLabel(),
            wireLoader: loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': wireTarget })),
            iconHtml: this._icon ? icon(this._icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': wireTarget }) }) : '',
            formLoader: loadingIndicator(new Attributes({ 'x-cloak': 'x-cloak', 'x-show': 'isProcessing' })),
        });
    }
}

/** Group of actions collapsed into a dropdown behind a "⋮" icon button. */
export class ActionGroup {
    private actions: Action[];
    constructor(actions: Action[]) { this.actions = actions; }
    static make(actions: Action[]): ActionGroup { return configured(new ActionGroup(actions)); }
    getActions(): Action[] { return this.actions; }
    /** `keyOf` returns each action's `wire:key` (it depends on the record). */
    async toHtml(ctx: ComponentContext, context: Record<string, unknown>, keyOf: (action: Action) => string): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager() first.');
        const items: string[] = [];
        for (const action of this.actions) if (await action.isVisible(ctx)) items.push(await action.toRecordGroupedHtml(ctx, context, keyOf(action)));
        if (!items.length) return '';
        const label = e(t('filament-actions::group.trigger.label'));
        return `<div x-data="filamentDropdown" class="fi-dropdown"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger"><button title="${label}" aria-label="${label}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-icon-btn-group', 'fi-icon-btn', 'fi-size-md', ...colorManager.getComponentClasses('icon-button', 'primary')].join(' ')}">${icon('m-ellipsis-vertical')}</button></div><div x-cloak x-float.placement.bottom-end.flip.teleport.offset="{ offset: 8 }" x-ref="panel" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" role="menu" class="fi-dropdown-panel"><div class="fi-dropdown-list" role="group">${items.join(' ')}</div></div></div>`;
    }
}
