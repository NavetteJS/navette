// @navette/actions — port de filament/actions : Action (bouton plein, soumission de formulaire) pour commencer.
import { Attributes, e, evaluate, icon, js, loadingIndicator, renderHook, views, type ColorManager, type Lazy, configured, configureUsing } from '@navette/support';
import { t } from '@navette/support/i18n';
import type { ComponentContext, Renderable } from '@navette/schemas';
import { fileURLToPath } from 'node:url';

views.namespace('filament-actions', fileURLToPath(new URL('../views', import.meta.url)));

/** Emplacements de render hook d'une modale d'action — mêmes noms que `Filament\Actions\View\ActionsRenderHook`. Donnée reçue : `data.action`. */
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

/** Contexte d'exécution d'une action montée. */
export type ActionCallContext = { livewire: any; record: any; arguments: Record<string, unknown>; data: Record<string, unknown> };

export class Action implements Renderable {
    /** Réglage par défaut de toutes les instances créées ensuite par `make()` : `TextInput.configureUsing((input) => input.maxLength(255))`. */
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
    /** Une fonction rend la couleur dépendante de l'enregistrement (actions de ligne). */
    color(color: string | ((ctx: ComponentContext) => string | Promise<string>)): this { if (typeof color === 'function') this._lazyColor = color; else { this._color = color; this._lazyColor = null; } return this; }
    size(size: string): this { this._size = size; return this; }
    /** Bouton `type="submit"` qui déclenche la méthode de soumission du formulaire (`->submit('authenticate')`). */
    submit(form: string | null): this { this._submit = form; return this; }
    hidden(condition: Lazy<boolean, ComponentContext> = true): this { this._hidden = condition; return this; }
    /** Action de navigation : rendue en `<a href wire:navigate>`. */
    url(url: string | null | ((ctx: ComponentContext) => string | null)): this { if (typeof url === 'function') this._lazyUrl = url; else { this._url = url; this._lazyUrl = null; } return this; }
    /** Une chaîne : méthode du composant hôte appelée au clic (`wire:click`). Une fonction : traitement de l'action, monté par `mountAction()` (avec modale si elle en a une). */
    action(action: string | ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null): this {
        if (typeof action === 'function') { this._handler = action; this._action = null; } else { this._action = action; this._handler = null; }
        return this;
    }
    icon(name: string | null | ((ctx: ComponentContext) => string | null | Promise<string | null>)): this { if (typeof name === 'function') this._lazyIcon = name; else { this._icon = name; this._lazyIcon = null; } return this; }
    /** Icône quand l'action est un lien de ligne de table. */
    tableIcon(name: string | null): this { this._tableIcon = name; return this; }
    private _iconButton = false;
    /** Action de ligne réduite à son icône ; le libellé devient l'infobulle et le nom accessible (port de `iconButton()`). */
    iconButton(condition = true): this { this._iconButton = condition; return this; }
    /** Icône quand l'action est un élément de menu (ActionGroup). */
    groupedIcon(name: string | null): this { this._groupedIcon = name; return this; }
    requiresConfirmation(condition = true): this { this._requiresConfirmation = condition; return this; }
    modalHeading(heading: Lazy<string | null, ActionCallContext>): this { this._modalHeading = heading; return this; }
    modalDescription(description: Lazy<string | null, ActionCallContext>): this { this._modalDescription = description; return this; }
    modalSubmitActionLabel(label: string | null): this { this._modalSubmitActionLabel = label; return this; }
    modalIcon(name: string | null): this { this._modalIcon = name; return this; }
    private _badge: string | number | null | (() => string | number | null | Promise<string | number | null>) = null;
    private _badgeColor = 'primary';
    /** Pastille affichée sur le bouton (compteur). */
    badge(badge: string | number | null | (() => string | number | null | Promise<string | number | null>)): this { this._badge = badge; return this; }
    badgeColor(color: string): this { this._badgeColor = color; return this; }
    private _slideOver = false;
    private _hasSubmit = true;
    /** Modale en panneau latéral. */
    slideOver(condition = true): this { this._slideOver = condition; return this; }
    /** `false` : modale de consultation, sans bouton de validation. */
    modalSubmitAction(condition: boolean): this { this._hasSubmit = condition; return this; }
    private _cancelLabel: string | null = null;
    /** Libellé du bouton de fermeture de la modale (« Cancel » par défaut). */
    modalCancelActionLabel(label: string | null): this { this._cancelLabel = label; return this; }
    private _tooltip: Lazy<string | null, ComponentContext> = null;
    private _newTab = false;
    /** Infobulle affichée au survol. */
    tooltip(text: Lazy<string | null, ComponentContext>): this { this._tooltip = text; return this; }
    /** Ouvre l'adresse de l'action dans un nouvel onglet. */
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
    /** Couleur de l'icône de la modale ; par défaut celle de l'action. */
    modalIconColor(color: string | null): this { this._modalIconColor = color; return this; }
    getColor(): string { return this._color; }
    async getLabel(ctx: ComponentContext): Promise<string> { return (await evaluate(this._label, ctx)) ?? this.getDefaultLabel(); }
    async getIcon(ctx: ComponentContext): Promise<string | null> { return this._lazyIcon ? this._lazyIcon(ctx) : this._icon; }
    private _sort = 0;
    /** Ordre dans un menu (menu utilisateur, menu du locataire) : négatif, avant le choix du thème ou la liste des locataires. */
    sort(sort: number): this { this._sort = sort; return this; }
    getSort(): number { return this._sort; }
    /**
     * Élément d'un menu du panel (menu utilisateur, menu du locataire) — port de l'action « grouped » à adresse.
     * Seules les actions à adresse y ont leur place : le menu n'est pas un composant qui monte des actions.
     */
    async toMenuItemHtml(ctx: ComponentContext, options: { navigate?: boolean } = {}): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const href = this.resolveUrl(ctx);
        if (!href || !/^(\/(?!\/)|https?:\/\/)/.test(href)) return '';
        const iconName = await this.getIcon(ctx);
        const colors = this._color !== 'gray' && this._color !== 'primary' ? colorManager.getComponentClasses('dropdown-item', this._color) : [];
        const glyph = iconName ? icon(iconName, { attributes: new Attributes().class(colors.length ? ['fi-color', `fi-color-${this._color}`] : []) }) : '';
        return `<a href="${e(href)}"${this._newTab ? ' target="_blank"' : options.navigate ? ' wire:navigate' : ''} class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')} " role="menuitem" tabindex="-1">${glyph}<span class="fi-dropdown-list-item-label">${e(await this.getLabel(ctx))}</span></a>`;
    }
    /** Une adresse calculée ne se connaît qu'avec l'enregistrement : l'hôte la revérifie au montage (`resolveUrl`). */
    isMountable(): boolean { return (this._handler !== null || this._schema !== null) && this._url === null; }
    /** Adresse de l'action dans ce contexte ; une action qui en a une est un lien, jamais une action montée. */
    resolveUrl(ctx: ComponentContext): string | null { return this._lazyUrl ? this._lazyUrl(ctx) : this._url; }
    hasModal(): boolean { return this._requiresConfirmation || this._schema !== null; }
    /** Formulaire affiché dans la modale. Une fonction : les composants sont reconstruits à chaque requête. */
    schema(components: any[] | ((schema: any) => any), columns: Record<string, number> | number | null = {}): this { this._schema = typeof components === 'function' ? components : () => components; this._schemaColumns = columns; return this; }
    /** Applique le formulaire de l'action au schéma fourni par l'hôte : la fonction rend soit des composants, soit le schéma configuré. */
    applySchema(schema: any): any | null {
        if (!this._schema) return null;
        const result = this._schema(schema);
        return Array.isArray(result) ? schema.columns(this._schemaColumns).components(result) : result;
    }
    /** Boutons ajoutés au pied de la modale, entre la validation et l'annulation. */
    extraModalFooterActions(actions: Action[]): this { this._extraModalFooterActions = actions; return this; }
    /** État initial du formulaire (ex. à partir de l'enregistrement). */
    fillForm(resolver: (ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>): this { this._fillForm = resolver; return this; }
    /** Largeur de la modale (`xs` … `7xl`). Par défaut `md` pour une confirmation, `4xl` pour un formulaire. */
    modalWidth(width: string | null): this { this._modalWidth = width; return this; }
    hasSchema(): boolean { return this._schema !== null; }
    async getFormFill(ctx: ActionCallContext): Promise<Record<string, unknown> | null> { return this._fillForm ? this._fillForm(ctx) : null; }
    private getDefaultLabel(): string { return ((s: string) => s.charAt(0).toUpperCase() + s.slice(1))(this.name.replace(/[_-]+/g, ' ')); }
    private _mutateData: ((data: Record<string, unknown>, ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>) | null = null;
    private _before: ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null = null;
    private _after: ((ctx: ActionCallContext) => unknown | Promise<unknown>) | null = null;
    /** Transforme les données validées du formulaire avant le traitement (ajouter l'auteur, normaliser une valeur…). */
    mutateDataUsing(fn: (data: Record<string, unknown>, ctx: ActionCallContext) => Record<string, unknown> | Promise<Record<string, unknown>>): this { this._mutateData = fn; return this; }
    /** Exécuté juste avant le traitement ; lever une erreur l'annule. */
    before(fn: (ctx: ActionCallContext) => unknown | Promise<unknown>): this { this._before = fn; return this; }
    /** Exécuté après un traitement réussi (journal, notification supplémentaire…). */
    after(fn: (ctx: ActionCallContext) => unknown | Promise<unknown>): this { this._after = fn; return this; }
    async call(ctx: ActionCallContext): Promise<unknown> {
        if (!this._handler) return null;
        if (this._mutateData) ctx = { ...ctx, data: await this._mutateData(ctx.data ?? {}, ctx) };
        await this._before?.(ctx);
        const result = await this._handler(ctx);
        await this._after?.(ctx);
        return result;
    }

    /** Élément de menu d'une action groupée de table — port de l'action « grouped » (`fi-ac-grouped-action`). Le clic passe par `filamentTable.mountAction()`, qui envoie la sélection. */
    async toGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const expression = `mountAction(${js(this.name)}, {}, ${js(context)})`;
        const attributes = new Attributes()
            .merge({ role: 'menuitem', tabindex: '-1', type: 'button', 'wire:loading.attr': 'aria-disabled', 'wire:loading.class': 'fi-disabled', 'wire:target': expression })
            .class(['fi-ac-grouped-action', 'fi-dropdown-list-item', ...(this._color !== 'gray' ? colorManager.getComponentClasses('dropdown-item', this._color) : [])])
            .set('x-cloak', 'x-cloak').set('x-show', 'getSelectedRecordsCount()').set('x-on:click', expression);
        const iconHtml = this._icon ? icon(this._icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': expression }).class(this._color !== 'gray' ? ['fi-color', `fi-color-${this._color}`] : []) }) : '';
        return `<button ${attributes.toHtml()}>${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': expression }))}<span class="fi-dropdown-list-item-label">${e((await evaluate(this._label, ctx)) ?? this.getDefaultLabel())}</span></button>`;
    }

    /**
     * Élément de menu d'une action de ligne (dans un ActionGroup) — port de l'action « grouped ».
     * Filament a deux balisages : un chemin court, et la vue Blade dès qu'un raccourci clavier est posé (ordre des classes différent).
     */
    async toRecordGroupedHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const color = this._lazyColor ? await this._lazyColor(ctx) : this._color;
        const iconName = this._lazyIcon ? await this._lazyIcon(ctx) : (this._groupedIcon ?? this._icon);
        const expression = e(`mountAction(${js(this.name)}, {}, ${js(context)})`);
        const colors = color !== 'gray' ? colorManager.getComponentClasses('dropdown-item', color) : [];
        const label = (await evaluate(this._label, ctx)) ?? this.getDefaultLabel();
        const iconHtml = iconName ? icon(iconName, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': `mountAction(${js(this.name)}, {}, ${js(context)})` }).class(color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []) }) : '';
        const inner = `${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': `mountAction(${js(this.name)}, {}, ${js(context)})` }))}<span class="fi-dropdown-list-item-label">${e(label)}</span>`;
        // Action de navigation : un lien, sans montage côté serveur.
        const href = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        if (href) {
            const plainIcon = iconName ? icon(iconName, { attributes: new Attributes().class(color !== 'gray' ? ['fi-color', `fi-color-${color}`] : []) }) : '';
            // Lien externe (nouvel onglet) : pas de navigation Livewire, classes dans l'ordre de Filament.
            if (this._newTab) return `<a href="${e(href)}" target="_blank" role="menuitem" tabindex="-1" wire:key="${e(wireKey)}" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', ...colors].join(' ')}">${plainIcon}<span class="fi-dropdown-list-item-label">${e(label)}</span></a>`;
            return `<a href="${e(href)}" wire:navigate wire:key="${e(wireKey)}" class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')}" role="menuitem" tabindex="-1">${plainIcon}<span class="fi-dropdown-list-item-label">${e(label)}</span></a>`;
        }
        if (this._disabled !== false) {
            // Désactivation conditionnelle : Filament passe alors par sa vue Blade, que l'action soit active ou non (ordre des classes différent).
            const disabled = await this.isDisabled(ctx);
            return `<button ${disabled ? 'aria-disabled="true" ' : ''}role="menuitem" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', disabled ? 'fi-disabled' : null, ...colors].filter(Boolean).join(' ')}" wire:click="${expression}" wire:key="${e(wireKey)}">${inner}</button>`;
        }
        if (this._keyBindings.length) {
            return `<button x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" role="menuitem" tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-grouped-action', 'fi-dropdown-list-item', ...colors].join(' ')}" wire:click="${expression}" wire:key="${e(wireKey)}">${inner}</button>`;
        }
        return `<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" wire:click="${expression}" wire:key="${e(wireKey)}" class="${['fi-dropdown-list-item', 'fi-ac-grouped-action', ...colors].join(' ')}" role="menuitem" tabindex="-1">${inner}</button>`;
    }

    /** Lien d'une action de ligne de table (`fi-ac-link-action`) — port de l'action « link » en petite taille. */
    async toLinkHtml(ctx: ComponentContext, context: Record<string, unknown>, wireKey: string): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
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
        // Action de navigation : un lien vers la page, sans montage côté serveur.
        const href = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        const tooltip = await this.tooltipAttribute(ctx);
        // Seules les adresses locales ou http(s) deviennent des liens.
        if (href && /^(\/(?!\/)|https?:\/\/)/.test(href)) return `<a href="${e(href)}" ${this._newTab ? 'target="_blank" ' : ''}${tooltip}${this._newTab ? '' : 'wire:navigate '}wire:key="${e(wireKey)}" class="${classes}">${iconName ? icon(iconName, { size: 'sm' }) : ''}<span class="fi-link-label">${e(label)}</span></a>`;
        const keys = this._keyBindings.length ? `x-bind:id="$id('key-bindings')" x-mousetrap.global.${this._keyBindings.map((k) => k.replace(/\+/g, '-')).join('.')}="document.getElementById($el.id)?.click()" ` : '';
        return `<button ${keys}${tooltip}type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${classes}" wire:click="${e(raw)}" wire:key="${e(wireKey)}">${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': raw }), 'sm')}<span class="fi-link-label">${e(label)}</span></button>`;
    }

    /** Fenêtre modale d'une action montée — port de filament-actions::action-modal et filament::components.modal (confirmation seulement). */
    async toModalHtml(ctx: ActionCallContext, index: number, content: string | null = null): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const schemaCtx = { livewire: ctx.livewire, component: null as any, operation: null, record: ctx.record, get: () => undefined, state: undefined };
        const label = (await evaluate(this._label, schemaCtx)) ?? this.getDefaultLabel();
        const color = this._lazyColor ? await this._lazyColor(schemaCtx) : this._color;
        const confirmation = this._requiresConfirmation;
        // Comme Filament : une confirmation est centrée (md) ; un formulaire est aligné au début (4xl), sauf en petite largeur.
        const width = this._modalWidth ?? (confirmation ? 'md' : '4xl');
        const submitLabel = this._modalSubmitActionLabel ?? t(confirmation ? 'filament-actions::modal.actions.confirm.label' : 'filament-actions::modal.actions.submit.label');
        // Même ordre que filament-actions::action-modal : contenu libre, schéma, pied de contenu, chacun entre ses deux emplacements.
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
            // Comme Filament : le bouton de validation d'une action grise est en couleur primaire.
            submit: !this._hasSubmit ? '' : (await Action.make('submit').label(submitLabel).color(color === 'gray' ? 'primary' : color).submit('callMountedAction').toHtml(schemaCtx)) + (await Promise.all(this._extraModalFooterActions.map((a) => a.toHtml(schemaCtx)))).join(''),
        });
    }
    alpineClickHandler(handler: string | null): this { this._alpineClick = handler; return this; }
    private _livewireTarget: string | null = null;
    private _iconAfter = false;
    /** Cible de l'indicateur de chargement (`wire:target`), quand le clic est géré par du JavaScript. */
    livewireTarget(target: string | null): this { this._livewireTarget = target; return this; }
    /** Icône (et indicateur de chargement) après le libellé : `'after'`. */
    iconPosition(position: 'before' | 'after'): this { this._iconAfter = position === 'after'; return this; }
    keyBindings(bindings: string[]): this { this._keyBindings = bindings; return this; }
    getName(): string { return this.name; }

    private _authorize: Lazy<boolean, ComponentContext> = true;
    /** Condition d'autorisation, distincte de `visible` / `hidden` : non remplie, l'action est masquée et refusée par le serveur. */
    authorize(condition: Lazy<boolean, ComponentContext>): this { this._authorize = condition; return this; }
    async isVisible(ctx: ComponentContext): Promise<boolean> { return !(await evaluate(this._hidden, ctx)) && (await evaluate(this._visible, ctx)) && Boolean(await evaluate(this._authorize, ctx)); }
    visible(condition: Lazy<boolean, ComponentContext> = true): this { this._visible = condition; return this; }
    /** Action affichée mais inutilisable ; le serveur refuse aussi de la monter. */
    disabled(condition: Lazy<boolean, ComponentContext> = true): this { this._disabled = condition; return this; }
    async isDisabled(ctx: ComponentContext): Promise<boolean> { return evaluate(this._disabled, ctx); }

    /** Bouton plein — port de la vue `filament::components.button` pour une action de soumission. */
    async toHtml(ctx: ComponentContext, explicitMountContext: Record<string, unknown> | null = null): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const linkUrl = this._lazyUrl ? this._lazyUrl(ctx) : this._url;
        if (linkUrl !== null && /^(\/(?!\/)|https?:\/\/)/.test(linkUrl)) {
            const link = new Attributes().class(['fi-ac-btn-action', 'fi-btn', `fi-size-${this._size}`, ...(this._color !== 'gray' ? colorManager.getComponentClasses('button', this._color) : [])]);
            const linkIcon = this._icon ? icon(this._icon) : '';
            const badge = typeof this._badge === 'function' ? await this._badge() : this._badge;
            const badgeHtml = badge !== null && badge !== '' ? `<div class="fi-btn-badge-ctn"><span class="${['fi-color', `fi-color-${this._badgeColor}`, ...colorManager.getComponentClasses('badge', this._badgeColor).filter((c) => !c.startsWith('fi-color')), 'fi-badge', 'fi-size-xs'].join(' ')}">${e(String(badge))}</span></div>` : '';
            return `<a href="${e(linkUrl)}" ${this._newTab ? 'target="_blank" ' : ''}${await this.tooltipAttribute(ctx)}${this._newTab ? '' : 'wire:navigate '}${link.toHtml()}>${linkIcon}${e((await evaluate(this._label, ctx)) ?? this.getDefaultLabel())}${badgeHtml}</a>`;
        }
        const isSubmit = this._submit !== null;
        // Action à traitement : le clic monte l'action côté serveur, avec le contexte fourni par l'hôte (ex. l'enregistrement).
        const mountContext = explicitMountContext ?? (ctx.livewire as any)?.getActionMountContext?.() ?? {};
        // Sans contexte, Filament émet la forme courte `mountAction('nom')`.
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

/** Groupe d'actions replié dans un menu déroulant (port de ActionGroup, bouton-icône « ⋮ »). */
export class ActionGroup {
    private actions: Action[];
    constructor(actions: Action[]) { this.actions = actions; }
    static make(actions: Action[]): ActionGroup { return configured(new ActionGroup(actions)); }
    getActions(): Action[] { return this.actions; }
    /** `keyOf` donne la clé `wire:key` de chaque action (elle dépend de l'enregistrement). */
    async toHtml(ctx: ComponentContext, context: Record<string, unknown>, keyOf: (action: Action) => string): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const items: string[] = [];
        for (const action of this.actions) if (await action.isVisible(ctx)) items.push(await action.toRecordGroupedHtml(ctx, context, keyOf(action)));
        if (!items.length) return '';
        const label = e(t('filament-actions::group.trigger.label'));
        return `<div x-data="filamentDropdown" class="fi-dropdown"><div x-on:mousedown="if ($event.button === 0) toggle($event)" class="fi-dropdown-trigger"><button title="${label}" aria-label="${label}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${['fi-ac-icon-btn-group', 'fi-icon-btn', 'fi-size-md', ...colorManager.getComponentClasses('icon-button', 'primary')].join(' ')}">${icon('m-ellipsis-vertical')}</button></div><div x-cloak x-float.placement.bottom-end.flip.teleport.offset="{ offset: 8 }" x-ref="panel" x-transition:enter-start="fi-opacity-0" x-transition:leave-end="fi-opacity-0" role="menu" class="fi-dropdown-panel"><div class="fi-dropdown-list" role="group">${items.join(' ')}</div></div></div>`;
    }
}
