// @navette/forms — port de filament/forms : Field, TextInput, Checkbox, validation côté serveur.
import { Attributes, HtmlString, e, evaluate, icon, js, views, type ColorManager, type Lazy, configured } from '@navette/support';
import { createHash } from 'node:crypto';
import { t } from '@navette/support/i18n';
import { Component, Icon as SchemaIcon, Schema, Text, childSchema, renderInlineItems, slug, type ComponentContext, type InlineItem } from '@navette/schemas';
import { Action } from '@navette/actions';
import { loadingIndicator } from '@navette/support';
import { randomUUID } from 'node:crypto';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

views.namespace('filament-forms', fileURLToPath(new URL('../views', import.meta.url)));
let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };
const asset = (name: string) => views.render('filament-forms::asset', { path: name }).trim();

/** Nombre tel que PHP l'écrit : au-delà des entiers exacts, un flottant à 14 chiffres significatifs (« 1.844674407371E+19 »). */
const phpNumber = (n: number | null): string | number | null => {
    if (n === null || Number.isSafeInteger(n) || Math.abs(n) < 1e15) return n;
    const [mantissa, exponent] = n.toPrecision(14).split('e');
    return `${mantissa.replace(/\.?0+$/, '')}E${exponent}`;
};

type Rule = { name: string; passes: (value: unknown, ctx: ComponentContext) => boolean | Promise<boolean>; message: (attribute: string) => string };
const blank = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const headline = (s: string) => s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ (.)/g, (_, c) => ' ' + c.toLowerCase());

export abstract class Field extends Component {
    protected _label: Lazy<string | null, ComponentContext> = null;
    protected _required: Lazy<boolean, ComponentContext> = false;
    protected _disabled: Lazy<boolean, ComponentContext> = false;
    protected _autofocus = false;
    protected _default: unknown = null;
    protected _rules: Rule[] = [];
    protected _afterStateUpdated: ((ctx: ComponentContext & { set: (name: string, value: unknown) => void }) => unknown) | null = null;
    protected _dehydrated: boolean | null = null;
    protected _hiddenLabel = false;
    protected _helperText: string | null = null;

    constructor(name: string) { super(); this._name = name; }
    hasStatePath(): boolean { return true; }
    getName(): string { return this._name!; }
    getId(): string { return this.getKey()!; }

    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    required(condition: Lazy<boolean, ComponentContext> = true): this { this._required = condition; return this; }
    disabled(condition: Lazy<boolean, ComponentContext> = true): this { this._disabled = condition; return this; }
    autofocus(condition = true): this { this._autofocus = condition; return this; }
    default(value: unknown): this { this._default = value; return this; }
    /** Texte d'aide affiché sous le champ. */
    helperText(text: string | null): this { this._helperText = text; return this; }
    /** Identifiant du texte d'aide, à lier au contrôle par `aria-describedby`. */
    protected getHelperTextId(): string | null { return this._helperText !== null ? `${this.getId()}-helper-text` : null; }
    /** Libellé réservé aux lecteurs d'écran. */
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }

    // --- indication à droite du libellé (port de Concerns\HasHint)
    protected _hint: Lazy<string | HtmlString | null, ComponentContext> = null;
    protected _hintColor: Lazy<string | null, ComponentContext> = null;
    protected _hintIcon: Lazy<string | null, ComponentContext> = null;
    protected _hintIconTooltip: Lazy<string | null, ComponentContext> = null;
    protected _hintActions: Action[] = [];
    /**
     * Indication affichée à droite du libellé (un composant `Text`). Le texte est échappé ; une `HtmlString` de `@navette/support`
     * (`raw('<a href="…">…</a>')`) est insérée telle quelle : n'y placez que des valeurs échappées avec `e()`.
     */
    hint(hint: Lazy<string | HtmlString | null, ComponentContext>): this { this._hint = hint; return this; }
    /** Couleur de l'indication et de son icône (`gray` pour le texte, `primary` pour l'icône par défaut). */
    hintColor(color: Lazy<string | null, ComponentContext>): this { this._hintColor = color; return this; }
    /** Icône d'indication, avec une infobulle facultative (qui sert aussi de nom accessible). */
    hintIcon(name: Lazy<string | null, ComponentContext>, tooltip?: Lazy<string | null, ComponentContext>): this {
        this._hintIcon = name;
        if (arguments.length >= 2) this._hintIconTooltip = tooltip ?? null;
        return this;
    }
    hintIconTooltip(tooltip: Lazy<string | null, ComponentContext>): this { this._hintIconTooltip = tooltip; return this; }
    /** Action affichée après l'indication (en lien, petite taille), montée sur le champ. */
    hintAction(action: Action): this { return this.hintActions([action]); }
    hintActions(actions: Action[]): this { this._hintActions = [...this._hintActions, ...actions]; return this; }
    getHintActions(): Action[] { return this._hintActions; }
    /** Actions que le champ expose au montage (`schemaComponent` = clé du champ) : ici, ses actions d'indication. */
    getActions(): Action[] { return this.getHintActions(); }
    /** Rangée « après le libellé » : indication, icône d'indication et actions d'indication. */
    protected async renderAfterLabel(): Promise<string> {
        const ctx = this.context();
        const hint = await evaluate(this._hint, ctx);
        const color = await evaluate(this._hintColor, ctx);
        const iconName = await evaluate(this._hintIcon, ctx);
        const items: InlineItem[] = [];
        if (hint !== null && hint !== undefined && (hint instanceof HtmlString ? hint.html : hint) !== '') items.push(Text.make(hint).color(color));
        if (iconName) items.push(SchemaIcon.make(iconName).tooltip(await evaluate(this._hintIconTooltip, ctx)).color(color));
        items.push(...this._hintActions);
        if (!items.length) return '';
        // Comme Filament : les composants de la rangée ont le chemin du champ et, pour conteneur, celui du schéma du champ.
        return renderInlineItems(this, items, { alignment: 'end', scope: { path: this.getStatePath(), containerPath: this.container.getStatePath() }, mountKey: this.getKey(), actionView: 'link' });
    }
    /** Exécuté côté serveur quand l'état du champ change (champ `live()`). `set(nom, valeur)` modifie un autre champ du même formulaire. */
    afterStateUpdated(callback: (ctx: ComponentContext & { set: (name: string, value: unknown) => void }) => unknown): this { this._afterStateUpdated = callback; return this; }
    hasAfterStateUpdated(): boolean { return this._afterStateUpdated !== null; }
    async callAfterStateUpdated(set: (name: string, value: unknown) => void): Promise<void> { await this._afterStateUpdated?.({ ...this.context(), set }); }
    /** Force l'inclusion du champ dans les données envoyées, même désactivé (`->disabled()->dehydrated()`). */
    dehydrated(condition = true): this { this._dehydrated = condition; return this; }
    /** Par défaut, un champ désactivé n'est ni validé ni enregistré. */
    async isDehydrated(): Promise<boolean> { return this._dehydrated ?? !(await this.isDisabled()); }
    getDefaultState(): unknown { return typeof this._default === 'function' ? this._default() : this._default; }
    /** Mise en forme de la valeur d'un enregistrement quand elle entre dans le formulaire (hydratation). */
    hydrateState(value: unknown): unknown { return value; }
    rule(rule: Rule): this { this._rules.push(rule); return this; }
    /** Règle `unique` : la valeur ne doit pas exister dans la colonne du même nom ; `ignoreRecord` exclut l'enregistrement en cours d'édition. */
    unique(options: { ignoreRecord?: boolean; column?: string } = {}): this {
        return this.rule({
            name: 'unique',
            passes: async (value, ctx) => {
                const host = ctx.livewire as any;
                const adapter = host.getDataAdapter?.();
                if (!adapter) throw new Error('unique() : le composant hôte ne fournit pas d\'adaptateur de données (getDataAdapter).');
                const ignored = options.ignoreRecord ? (ctx.record ? adapter.getKey(ctx.record) : (host.getRecordKey?.() ?? null)) : null;
                return !(await adapter.exists(options.column ?? this._name!, value, ignored));
            },
            message: (a) => `The ${a} has already been taken.`,
        });
    }

    async getLabel(): Promise<string> { return (await evaluate(this._label, this.context())) ?? headline(this._name!); }
    isRequired(): Promise<boolean> { return evaluate(this._required, this.context()); }
    isDisabled(): Promise<boolean> { return evaluate(this._disabled, this.context()); }
    getErrors(): string[] { return this.livewire._errors[this.getStatePath()] ?? []; }
    hasError(): boolean { return this.getErrors().length > 0; }

    /** Règles de validation : `required` d'abord, puis celles du champ. Les messages sont ceux de Laravel (en). */
    async getValidationRules(): Promise<Rule[]> {
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: (v) => !blank(v) && v !== false, message: (a) => `The ${a} field is required.` });
        return [...rules, ...this._rules];
    }
    async validate(): Promise<string[]> {
        // Comme Filament : un champ non enregistré (`dehydrated(false)` : confirmation, mot de passe actuel) est quand même validé ;
        // seul un champ désactivé (et non forcé par `dehydrated()`) y échappe.
        if ((await this.isDisabled()) && this._dehydrated !== true) return [];
        // Comme Laravel (ConvertEmptyStringsToNull) : une chaîne vide est traitée comme absente.
        const value = this.context().state === '' ? null : this.context().state;
        const attribute = (await this.getLabel()).toLowerCase();
        for (const rule of await this.getValidationRules()) {
            if (rule.name !== 'required' && blank(value)) continue;
            if (!(await rule.passes(value, this.context()))) return [rule.message(attribute)];
        }
        return [];
    }

    /** Port de Field::wrapEmbeddedHtml (enveloppe par défaut). */
    /** Valeur écrite dans les données à enregistrer (les champs composés n'y laissent qu'une ossature, remplie par leurs enfants). */
    dehydrateState(state: unknown): unknown { return state; }
    /** Dernière mise en forme de la valeur enregistrée, une fois les champs enfants dé-hydratés (liste d'éléments d'un Builder). */
    finalizeDehydratedState(state: unknown): unknown { return state; }
    protected async wrap(html: string, options: { labelPrefix?: string; wrapperClass?: string; after?: string; labelAsDiv?: boolean; focusable?: boolean } = {}): Promise<string> {
        const errors = this.getErrors();
        // Champ d'un FusedGroup : enveloppe réduite à un libellé pour lecteurs d'écran (port de plain-field-wrapper).
        if (this.container.getFieldWrapperView?.() === 'filament-forms::plain-field-wrapper') {
            const label = await this.getLabel();
            const labelHtml = label === '' ? '' : options.labelAsDiv ? `<div id="${e(this.getId())}-label" class="fi-fo-field-label fi-sr-only">${e(label)}</div>` : `<label for="${e(this.getId())}" class="fi-fo-field-label fi-sr-only">${e(label)}</label>`;
            return `<div data-field-wrapper class="fi-fo-field">${labelHtml}${options.labelPrefix ?? ''}${html}${options.after ?? ''}</div>`;
        }
        // Texte d'aide : un petit schéma « en ligne » sous le contrôle (port de belowContent).
        if (this._helperText !== null) html += `<div id="${e(this.getHelperTextId()!)}" class="fi-sc fi-inline fi-sc-has-gap fi-sc-dense"><div x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path: this.getStatePath(), containerPath: this.container.getStatePath() }))})"><div class="fi-sc-component"><span class="fi-sc-text">${e(this._helperText)}</span></div></div></div>`;
        return views.render('filament-forms::components.field-wrapper', {
            id: this.getId(), label: await this.getLabel(), required: (await this.isRequired()) && !(await this.isDisabled()),
            labelPrefix: options.labelPrefix ?? '', hiddenLabel: this._hiddenLabel, after: options.after ?? '', afterLabel: this._hiddenLabel ? '' : await this.renderAfterLabel(), labelAsDiv: options.labelAsDiv === true, focusable: options.focusable === true, html, errorMessage: errors[0] ?? null, wrapperClass: options.wrapperClass ?? null,
        });
    }
}

export class TextInput extends Field {
    private _type: string | null = null;
    private _isPassword = false;
    private _isRevealable = false;
    private _autocomplete: string | null = null;
    private _maxLength: number | null = null;
    private _minLength: number | null = null;
    private _placeholder: string | null = null;
    private _numeric: 'decimal' | 'integer' | null = null;
    private _minValue: number | null = null;
    private _maxValue: number | null = null;
    private _prefix: string | null = null;
    private _live: 'live' | 'blur' | null = null;

    static make(name: string): TextInput { return configured(new TextInput(name)); }
    /** Nombre décimal : `type="number"`, `step="any"`. */
    numeric(): this { this._numeric = 'decimal'; return this.rule({ name: 'numeric', passes: (v) => String(v).trim() !== '' && Number.isFinite(Number(v)), message: (a) => `The ${a} field must be a number.` }); }
    /** Nombre entier : `type="number"`, `step="1"`. */
    integer(): this { this._numeric = 'integer'; return this.rule({ name: 'integer', passes: (v) => /^-?\d+$/.test(String(v).trim()), message: (a) => `The ${a} field must be an integer.` }); }
    private _step: number | 'any' | null = null;
    /** Pas de saisie d'un champ numérique (`step`), à la place de celui déduit de `numeric()` ou `integer()`. */
    step(step: number | 'any' | null): this { this._step = step; return this; }
    minValue(value: number): this { this._minValue = value; return this.rule({ name: 'min', passes: (v) => Number(v) >= value, message: (a) => `The ${a} field must be at least ${value}.` }); }
    maxValue(value: number): this { this._maxValue = value; return this.rule({ name: 'max', passes: (v) => Number(v) <= value, message: (a) => `The ${a} field must not be greater than ${value}.` }); }
    /** Libellé affiché avant la zone de saisie (ex. `$`). */
    prefix(label: string | null): this { this._prefix = label; return this; }
    private _suffix: string | null = null;
    /** Libellé affiché après la saisie (« hours », « kg »…). */
    suffix(label: string | null): this { this._suffix = label; return this; }
    /** L'état est envoyé au serveur à chaque frappe, ou à la perte de focus avec `onBlur`. */
    live(options: { onBlur?: boolean } = {}): this { this._live = options.onBlur ? 'blur' : 'live'; return this; }
    type(type: string): this { this._type = type; return this; }
    email(condition = true): this {
        if (condition) { this._type = 'email'; this.rule({ name: 'email', passes: (v) => /^[^\s@]+@[^\s@]+$/.test(String(v)), message: (a) => `The ${a} field must be a valid email address.` }); }
        return this;
    }
    password(condition = true): this { this._isPassword = condition; return this; }
    revealable(condition = true): this { this._isRevealable = condition; return this; }
    /** `true` → "on", `false` → "off", chaîne → telle quelle (comme CanBeAutocompleted). */
    autocomplete(value: string | boolean = true): this { this._autocomplete = value === true ? 'on' : value === false ? 'off' : value; return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Adresse web : champ de type `url`, valeur http(s) valide exigée. */
    private _mask: string | null = null;
    /** Masque de saisie Alpine (`(999) 999-9999`) : guide la frappe dans le navigateur, sans valeur de validation. */
    mask(pattern: string | null): this { this._mask = pattern; return this; }
    /** Numéro de téléphone : chiffres, espaces et ponctuation usuelle. */
    tel(): this { this._type = 'tel'; return this.rule({ name: 'tel', passes: (v) => /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\.\/0-9]*$/.test(String(v)), message: (a) => `The ${a} field format is invalid.` }); }
    email(): this { this._type = 'email'; return this.rule({ name: 'email', passes: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)), message: (a) => `The ${a} field must be a valid email address.` }); }
    url(): this { this._type = 'url'; return this.rule({ name: 'url', passes: (v) => { try { return ['http:', 'https:'].includes(new URL(String(v)).protocol); } catch { return false; } }, message: (a) => `The ${a} field must be a valid URL.` }); }
    maxLength(length: number): this { this._maxLength = length; return this.rule({ name: 'max', passes: (v) => String(v).length <= length, message: (a) => `The ${a} field must not be greater than ${length} characters.` }); }
    minLength(length: number): this { this._minLength = length; return this.rule({ name: 'min', passes: (v) => String(v).length >= length, message: (a) => `The ${a} field must be at least ${length} characters.` }); }

    /** Port de TextInput::toEmbeddedHtml (sans affixes libres, masque ni datalist pour l'instant). */
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const revealable = this._isPassword && this._isRevealable;
        const type = revealable ? 'password' : this._mask !== null ? 'text' : (this._type ?? (this._isPassword ? 'password' : this._numeric ? 'number' : 'text'));
        const model = `wire:model${this._live ? '.live' : ''}${this._live === 'blur' ? '.blur' : ''}`;
        const input = new Attributes()
            .merge({
                'aria-invalid': this.hasError() ? 'true' : null,
                'aria-describedby': this.getHelperTextId(),
                autocomplete: this._autocomplete, autofocus: this._autofocus, disabled: isDisabled, id: this.getId(),
                inputmode: this._numeric === 'decimal' ? 'decimal' : this._numeric === 'integer' ? 'numeric' : null,
                max: phpNumber(this._maxValue), min: phpNumber(this._minValue),
                maxlength: this._maxLength, minlength: this._minLength, placeholder: this._placeholder,
                required: (await this.isRequired()) && !isDisabled, step: this._step ?? (this._numeric === 'decimal' ? 'any' : this._numeric === 'integer' ? 1 : null), type,
                // Comme Filament : les modificateurs (`.live`, `.blur`) s'ajoutent aussi à `wire:model.fill`.
                [revealable ? model.replace('wire:model', 'wire:model.fill') : model]: this.getStatePath(),
                'x-bind:type': revealable ? "isPasswordRevealed ? 'text' : 'password'" : null,
                'x-mask': this._mask,
            })
            .class(['fi-input', { 'fi-revealable': revealable }]);
        const wrapper = new Attributes()
            .merge({
                'x-data': revealable ? 'passwordRevealFormComponent()' : this._mask !== null ? '{}' : null,
                'x-load': revealable ? '' : null,
                'x-load-src': revealable ? views.render('filament-forms::asset', { path: 'text-input/password-reveal' }).trim() : null,
                'x-on:focus-input.stop': "$el.querySelector('input')?.focus()",
            })
            .class(['fi-fo-text-input', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return this.wrap(views.render('filament-forms::components.text-input', {
            input: input.toHtml(), wrapper: wrapper.toHtml(), revealable, prefix: this._prefix, suffix: this._suffix,
            showLabel: t('filament-forms::components.text_input.actions.show_password.label'),
            hideLabel: t('filament-forms::components.text_input.actions.hide_password.label'),
        }));
    }
}

/** Sélecteur de date natif (`<input type="date">`). Le sélecteur JavaScript de Filament n'est pas encore porté. */
export class DatePicker extends Field {
    private _maxDate: Lazy<string | null, ComponentContext> = null;
    private _minDate: Lazy<string | null, ComponentContext> = null;
    private _live = false;
    static make(name: string): DatePicker { return configured(new DatePicker(name)); }
    private _datePlaceholder: string | null = null;
    /** Texte indicatif (les navigateurs ne l'affichent pas sur un champ `date` natif ; l'attribut est posé comme dans Filament). */
    placeholder(text: string | null): this { this._datePlaceholder = text; return this; }
    /** Envoie l'état au serveur dès qu'il change (`wire:model.live`). */
    live(condition = true): this { this._live = condition; return this; }
    /** Comme Filament : l'état d'un DatePicker est une date `AAAA-MM-JJ`, quelle que soit la précision stockée. */
    hydrateState(value: unknown): unknown { return typeof value === 'string' && value.length > 10 ? value.slice(0, 10) : value; }
    private static resolve(date: string): string { return date === 'today' ? new Date().toISOString().slice(0, 10) : date; }
    private async bound(date: Lazy<string | null, ComponentContext>): Promise<string | null> { const value = await evaluate(date, this.context()); return value ? DatePicker.resolve(value) : null; }
    /** Date la plus tardive acceptée : `'today'`, une date `AAAA-MM-JJ`, ou une fonction du contexte (`({ get }) => get('endDate') || 'today'`). */
    maxDate(date: Lazy<string | null, ComponentContext>): this {
        this._maxDate = date;
        return this.rule({ name: 'before_or_equal', passes: async (v) => { const max = await this.bound(date); return max === null || String(v).slice(0, 10) <= max; }, message: (a) => `The ${a} field must be a date before or equal to ${typeof date === 'string' ? date : 'the maximum date'}.` });
    }
    minDate(date: Lazy<string | null, ComponentContext>): this {
        this._minDate = date;
        return this.rule({ name: 'after_or_equal', passes: async (v) => { const min = await this.bound(date); return min === null || String(v).slice(0, 10) >= min; }, message: (a) => `The ${a} field must be a date after or equal to ${typeof date === 'string' ? date : 'the minimum date'}.` });
    }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const input = new Attributes()
            .merge({
                'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(),
                max: await this.bound(this._maxDate), min: await this.bound(this._minDate), placeholder: this._datePlaceholder,
                required: (await this.isRequired()) && !isDisabled, type: 'date', [this._live ? 'wire:model.live' : 'wire:model']: this.getStatePath(),
            })
            .class(['fi-input']);
        const wrapper = new Attributes()
            .merge({ 'x-on:focus-input.stop': "$el.querySelector('input:not([type=hidden])')?.focus()" })
            .class(['fi-fo-date-time-picker', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><input ${input.toHtml()} /></div></div>`);
    }
}

type Options = [string, string][] | Record<string, string>;
/**
 * Liste déroulante. Native (`<select>`) par défaut ; `searchable()` active le sélecteur JavaScript de Filament,
 * qui interroge le serveur par les méthodes exposées (`getSearchResultsForJs`…).
 */
export class Select extends Field {
    private _options: Options | ((ctx: ComponentContext) => Options | Promise<Options>) = [];
    private _placeholder: string | null = null;
    private _searchable = false;
    private _dynamic: boolean | null = null;
    private _searchOnServer: boolean | null = null;
    private _live = false;
    private _hasNoInitialOptions = false;
    private _multiple = false;
    private _optionLabelsUsing: ((values: string[], ctx: ComponentContext) => Options | Promise<Options>) | null = null;
    private _disableOptionWhen: ((value: string, ctx: ComponentContext) => boolean) | null = null;
    private _searchResultsUsing: ((search: string, ctx: ComponentContext) => Options | Promise<Options>) | null = null;
    private _optionLabelUsing: ((value: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
    static make(name: string): Select { return configured(new Select(name)); }
    /** Résultats de recherche calculés par le serveur à chaque frappe (sans liste d'options préchargée). */
    getSearchResultsUsing(resolver: (search: string, ctx: ComponentContext) => Options | Promise<Options>): this { this._searchResultsUsing = resolver; this._searchable = true; return this; }
    /** Libellé d'une valeur ; sert aussi à valider qu'une valeur choisie par recherche existe bien. */
    getOptionLabelUsing(resolver: (value: string, ctx: ComponentContext) => string | null | Promise<string | null>): this { this._optionLabelUsing = resolver; return this; }
    /** Options fixes, ou fonction (éventuellement asynchrone) évaluée à chaque requête. */
    /** `dynamic: false` : options fournies par une fonction mais fixes pour la durée de la page (annoncées comme statiques au navigateur). */
    /**
     * `dynamic: false` : options fournies par une fonction mais fixes pour la durée de la page.
     * `searchOnServer: false` : la recherche se fait dans le navigateur, parmi les options déjà envoyées (cas d'une liste complète).
     */
    options(options: Options | ((ctx: ComponentContext) => Options | Promise<Options>), config: { dynamic?: boolean; searchOnServer?: boolean } = {}): this { this._options = options; this._dynamic = config.dynamic ?? null; this._searchOnServer = config.searchOnServer ?? null; return this; }
    /** Option non sélectionnable selon le contexte (par exemple déjà choisie dans une autre ligne). */
    disableOptionWhen(condition: (value: string, ctx: ComponentContext) => boolean): this { this._disableOptionWhen = condition; return this; }
    /** L'état est envoyé au serveur dès qu'il change. */
    live(condition = true): this { this._live = condition; return this; }
    placeholder(label: string | null): this { this._placeholder = label; return this; }
    private _selectablePlaceholder = true;
    /** `false` : le sélecteur natif n'a pas d'option vide (port de `selectablePlaceholder()`). */
    selectablePlaceholder(condition = true): this { this._selectablePlaceholder = condition; return this; }
    searchable(condition = true): this { this._searchable = condition; return this; }
    /** Sélection multiple : l'état est une liste de valeurs ; le sélecteur JavaScript est toujours utilisé. */
    multiple(condition = true): this { this._multiple = condition; if (condition) this._searchable = true; return this; }
    isMultiple(): boolean { return this._multiple; }
    /** Libellés de plusieurs valeurs d'un coup (sélection multiple avec recherche serveur) ; sert aussi à valider les valeurs. */
    getOptionLabelsUsing(resolver: (values: string[], ctx: ComponentContext) => Options | Promise<Options>): this { this._optionLabelsUsing = resolver; return this; }
    getDefaultState(): unknown { return this._default ?? (this._multiple ? [] : null); }
    /** Valeurs sélectionnées, nettoyées : des chaînes, sans doublon. */
    private selectedValues(): string[] { const state = this.context().state; return [...new Set((Array.isArray(state) ? state : []).filter((v) => typeof v === 'string' || typeof v === 'number').map(String))]; }
    private async labelsOf(values: string[]): Promise<[string, string][]> {
        if (!values.length) return [];
        const known = this._optionLabelsUsing ? await this._optionLabelsUsing(values, this.context()) : await this.resolveOptions();
        const map = new Map((Array.isArray(known) ? known : Object.entries(known)).map(([value, label]): [string, string] => [String(value), String(label)]));
        return values.filter((value) => map.has(value)).map((value): [string, string] => [value, map.get(value)!]);
    }
    /** Sans effet ici : les options sont toujours chargées avec le formulaire. */
    preload(): this { return this; }
    hydrateState(value: unknown): unknown {
        if (this._multiple) return (Array.isArray(value) ? value : []).map(String);
        return value === null || value === undefined || value === '' ? null : String(value);
    }
    dehydrateState(state: unknown): unknown { return this._multiple ? this.selectedValues() : state; }
    async resolveOptions(): Promise<[string, string][]> {
        const options = typeof this._options === 'function' ? await this._options(this.context()) : this._options;
        return (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]) => [String(value), String(label)]);
    }
    async getValidationRules(): Promise<Rule[]> {
        // Avec une recherche serveur, la valeur est valide si le serveur sait lui donner un libellé ; sinon elle doit figurer dans les options.
        if (this._multiple) return [...(await super.getValidationRules()), { name: 'in', passes: async (v) => { const values = Array.isArray(v) ? v.map(String) : []; return (await this.labelsOf([...new Set(values)])).length === new Set(values).size; }, message: (a) => `The selected ${a} is invalid.` }];
        const passes = async (v: unknown) => (this._searchResultsUsing ? (await this._optionLabelUsing?.(String(v), this.context())) != null : (await this.resolveOptions()).some(([value]) => value === String(v)));
        return [...(await super.getValidationRules()), { name: 'in', passes, message: (a) => `The selected ${a} is invalid.` }];
    }

    // --- méthodes exposées au JavaScript du sélecteur (appelées par callSchemaComponentMethod)
    getExposedMethods(): string[] { return ['getOptionLabel', 'getSearchResultsForJs', 'getOptionsForJs', 'getOptionLabelsForJs']; }
    private static forJs(options: [string, string][]) { return options.map(([value, label]) => ({ label, value, isDisabled: false })); }
    async getOptionsForJs() { return this.withDisabled(Select.forJs(await this.resolveOptions())); }
    private withDisabled<T extends { value: string; isDisabled: boolean }>(options: T[]): T[] {
        if (!this._disableOptionWhen) return options;
        const ctx = this.context();
        return options.map((option) => ({ ...option, isDisabled: this._disableOptionWhen!(option.value, ctx) }));
    }
    async getSearchResultsForJs(search: unknown = '') {
        if (this._searchResultsUsing) {
            const found = await this._searchResultsUsing(String(search ?? '').slice(0, 1000), this.context());
            return Select.forJs((Array.isArray(found) ? found : Object.entries(found)).map(([value, label]): [string, string] => [String(value), String(label)]));
        }
        const needle = String(search ?? '').toLowerCase();
        return Select.forJs((await this.resolveOptions()).filter(([, label]) => label.toLowerCase().includes(needle)));
    }
    async getOptionLabel(): Promise<string | null> {
        const state = this.context().state;
        if (state === null || state === undefined || state === '') return null;
        if (this._optionLabelUsing) return this._optionLabelUsing(String(state), this.context());
        return (await this.resolveOptions()).find(([value]) => value === String(state))?.[1] ?? null;
    }
    async getOptionLabelsForJs(): Promise<unknown[]> { return this._multiple ? (await this.labelsOf(this.selectedValues())).map(([value, label]) => ({ label, value })) : []; }

    // --- création et modification d'une option dans une modale (port de createOptionForm / editOptionForm)
    private _createOptionForm: Component[] | ((schema: Schema) => Component[] | Schema) | null = null;
    private _createOptionUsing: ((data: Record<string, unknown>, ctx: ComponentContext) => string | number | null | Promise<string | number | null>) | null = null;
    private _createOptionModalHeading: string | null = null;
    private _modifyCreateOptionAction: ((action: Action) => Action | void) | null = null;
    private _editOptionForm: Component[] | ((schema: Schema) => Component[] | Schema) | null = null;
    private _updateOptionUsing: ((data: Record<string, unknown>, ctx: ComponentContext) => unknown) | null = null;
    private _fillEditOptionForm: ((ctx: ComponentContext) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null = null;
    private _editOptionModalHeading: string | null = null;
    private _modifyEditOptionAction: ((action: Action) => Action | void) | null = null;
    /**
     * Formulaire de la modale « Create » ouverte par le bouton « + » du champ. Sa validation est faite côté serveur ;
     * `createOptionUsing()` enregistre l'option et rend sa valeur, qui devient l'état du champ (ajoutée à la liste pour un `multiple()`).
     * Les options doivent être fournies par une fonction (`options(() => …)`, ou une recherche serveur) pour que la nouvelle valeur y figure.
     */
    createOptionForm(schema: Component[] | ((schema: Schema) => Component[] | Schema) | null): this { this._createOptionForm = schema; return this; }
    /** Enregistre l'option à partir des données validées de la modale ; rend la valeur (clé) de l'option créée. */
    createOptionUsing(callback: ((data: Record<string, unknown>, ctx: ComponentContext) => string | number | null | Promise<string | number | null>) | null): this { this._createOptionUsing = callback; return this; }
    createOptionModalHeading(heading: string | null): this { this._createOptionModalHeading = heading; return this; }
    /** Personnalise l'action de création (libellé, icône, largeur de modale…). */
    createOptionAction(modify: ((action: Action) => Action | void) | null): this { this._modifyCreateOptionAction = modify; return this; }
    /**
     * Formulaire de la modale « Edit » de l'option sélectionnée (sélection simple seulement). Le champ devient `live()` pour que le bouton
     * apparaisse dès qu'une option est choisie. Préremplissage par `fillEditOptionActionFormUsing()`, enregistrement par `updateOptionUsing()`.
     */
    editOptionForm(schema: Component[] | ((schema: Schema) => Component[] | Schema) | null): this { this._editOptionForm = schema; this._live = true; return this; }
    updateOptionUsing(callback: ((data: Record<string, unknown>, ctx: ComponentContext) => unknown) | null): this { this._updateOptionUsing = callback; return this; }
    /** Données initiales de la modale « Edit » (le contexte donne l'état courant du champ dans `state`). */
    fillEditOptionActionFormUsing(callback: ((ctx: ComponentContext) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null): this { this._fillEditOptionForm = callback; return this; }
    editOptionModalHeading(heading: string | null): this { this._editOptionModalHeading = heading; return this; }
    editOptionAction(modify: ((action: Action) => Action | void) | null): this { this._modifyEditOptionAction = modify; return this; }
    /** Même formulaire pour la création et la modification. */
    manageOptionForm(schema: Component[] | ((schema: Schema) => Component[] | Schema) | null): this { return this.createOptionForm(schema).editOptionForm(schema); }

    private setState(value: unknown): void { writePath(this.livewire as any, this.getStatePath().split('.'), value); }
    private getCreateOptionAction(): Action | null {
        if (!this._createOptionForm) return null;
        const tr = (key: string) => t(`filament-forms::components.select.actions.create_option.${key}`);
        const action = Action.make('createOption').label(tr('label')).icon('m-plus').iconButton().color('gray')
            .hidden(() => this.isDisabled())
            .modalHeading(this._createOptionModalHeading ?? tr('modal.heading'))
            .modalSubmitActionLabel(tr('modal.actions.create.label'))
            .schema(this._createOptionForm as any)
            .action(async ({ data }) => {
                if (!this._createOptionUsing) throw new Error(`Select [${this.getStatePath()}] : createOptionUsing() est requis avec createOptionForm().`);
                const created = await this._createOptionUsing(data, this.context());
                if (created === null || created === undefined || created === '') return;
                this.setState(this._multiple ? [...new Set([...this.selectedValues(), String(created)])] : String(created));
                await this.callAfterStateUpdated((name, value) => writePath(this.livewire as any, [...this.container.getStatePath().split('.').filter(Boolean), ...name.split('.')], value));
            });
        // Sélection multiple : « Create & create another » garde la modale ouverte sur un formulaire vide.
        if (this._multiple) action.extraModalFooterActions([Action.make('createAnother').label(tr('modal.actions.create_another.label')).color('gray').action(`callMountedAction(${js({ another: true })})`)]);
        return this._modifyCreateOptionAction?.(action) ?? action;
    }
    private getEditOptionAction(): Action | null {
        if (!this._editOptionForm || this._multiple) return null;
        const tr = (key: string) => t(`filament-forms::components.select.actions.edit_option.${key}`);
        const filled = () => { const state = this.context().state; return state !== null && state !== undefined && state !== ''; };
        const action = Action.make('editOption').label(tr('label')).icon('m-pencil-square').iconButton().color('gray')
            .hidden(async () => (await this.isDisabled()) || !filled())
            .modalHeading(this._editOptionModalHeading ?? tr('modal.heading'))
            .modalSubmitActionLabel(tr('modal.actions.save.label'))
            .schema(this._editOptionForm as any)
            .fillForm(async () => (await this._fillEditOptionForm?.(this.context())) ?? {})
            .action(async ({ data }) => {
                if (!this._updateOptionUsing) throw new Error(`Select [${this.getStatePath()}] : updateOptionUsing() est requis avec editOptionForm().`);
                await this._updateOptionUsing(data, this.context());
            });
        return this._modifyEditOptionAction?.(action) ?? action;
    }
    /** Actions montées sur le champ : indication, création et modification d'option. */
    getActions(): Action[] { return [...this.getHintActions(), ...[this.getCreateOptionAction(), this.getEditOptionAction()].filter((action): action is Action => action !== null)]; }
    /** Boutons « + » et « modifier » à droite du champ (port des suffixActions de Select). */
    private async suffixHtml(): Promise<string> {
        const ctx = this.context();
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
        const buttons: string[] = [];
        for (const action of [this.getCreateOptionAction(), this.getEditOptionAction()]) {
            if (action && (await action.isVisible(ctx))) buttons.push((await action.toLinkHtml(ctx, context, '')).replace(' wire:key=""', ''));
        }
        return buttons.length ? `<div class="fi-input-wrp-suffix"><div class="fi-input-wrp-actions">${buttons.join('')}</div></div>` : '';
    }

    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const resolved = await this.resolveOptions();
        const suffix = await this.suffixHtml();
        if (this._searchable) {
            const isRequired = (await this.isRequired()) && !isDisabled;
            const after = isRequired ? `<span id="${e(this.getId())}-required" class="fi-sr-only">${e(t('filament-forms::components.select.required_description'))}</span>` : '';
            return this.wrap(await this.toJsHtml(resolved, isDisabled, suffix), { wrapperClass: 'fi-fo-select-wrp', after });
        }
        const select = new Attributes()
            .merge({ 'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(), required: (await this.isRequired()) && !isDisabled, 'wire:key': typeof this._options === 'function' ? `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify(resolved)).digest('hex')}` : null, [this._live ? 'wire:model.live' : 'wire:model']: this.getStatePath() })
            .class(['fi-select-input']);
        const wrapper = new Attributes().merge({ 'x-on:focus-input.stop': "$el.querySelector('select')?.focus()" }).class(['fi-fo-select', 'fi-fo-select-native', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        const options = [this._selectablePlaceholder ? `<option value="">${isDisabled ? '' : e(this._placeholder ?? t('filament-forms::components.select.placeholder'))}</option>` : '', ...resolved.map(([value, label]) => `<option value="${e(value)}">${e(label)}</option>`)].join('');
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><select ${select.toHtml()}>${options}</select></div>${suffix}</div>`, { wrapperClass: 'fi-fo-select-wrp' });
    }

    /** Port du rendu JavaScript de Select::toEmbeddedHtml (sélection simple). */
    private async toJsHtml(options: [string, string][], isDisabled: boolean, suffix = ''): Promise<string> {
        const state = this.context().state;
        const hasState = !this._multiple && state !== null && state !== undefined && state !== '';
        const selected = this._multiple ? await this.labelsOf(this.selectedValues()) : [];
        const isRequired = (await this.isRequired()) && !isDisabled;
        // Champ obligatoire : une consigne pour lecteurs d'écran (« Select an option. ») est liée au sélecteur.
        const describedBy = [isRequired ? `${this.getId()}-required` : null, this.hasError() ? `${this.getId()}-error` : null].filter(Boolean).join(' ') || null;
        const accessibility = JSON.stringify({ 'aria-describedby': describedBy, 'aria-invalid': this.hasError() ? 'true' : null, 'aria-required': isRequired ? 'true' : null });
        const forJs = this.withDisabled(Select.forJs(options));
        // Options « dynamiques » : fournies par une fonction, donc susceptibles de changer d'une requête à l'autre.
        const hasDynamicOptions = this._dynamic ?? typeof this._options === 'function';
        const tr = (key: string, replace: Record<string, string> = {}) => t(`filament-forms::components.select.${key}`, replace);
        const config = `selectFormComponent({
 canOptionLabelsWrap: true,
 canSelectPlaceholder: true,
 clearButtonLabel: ${js(tr('actions.clear.label'))},
 errorMessage: ${js(tr('error_message'))},
 hasDynamicOptions: ${hasDynamicOptions ? 'true' : 'false'},
 hasDynamicSearchResults: ${this._searchResultsUsing || (this._searchOnServer ?? hasDynamicOptions) ? 'true' : 'false'},
 hasInitialNoOptionsMessage: ${this._searchResultsUsing || this._hasNoInitialOptions ? 'false' : 'true'},
 id: ${js(this.getId())},
 initialOptionLabel: ${js(hasState ? await this.getOptionLabel() : null)},
 initialOptionLabels: ${selected.length ? js(selected.map(([value, label]) => ({ label, value, isDisabled: false }))) : '[]'},
 initialState: ${this._multiple ? (selected.length ? js(selected.map(([value]) => value)) : '[]') : js(hasState ? String(state) : null)},
 isAutofocused: ${this._autofocus ? 'true' : 'false'},
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isHtmlAllowed: false,
 isMultiple: ${this._multiple ? 'true' : 'false'},
 isReorderable: false,
 isSearchable: true,
 key: ${js(this.getKey())},
 livewireId: ${js(this.livewire.id)},
 loadingMessage: ${js(tr('loading_message'))},
 maxItems: null,
 maxItemsMessage: ${js(tr('max_items_message', { count: '' }))},
 noOptionsMessage: ${js(tr('no_options_message'))},
 noSearchResultsMessage: ${js(tr('no_search_results_message'))},
 options: ${forJs.length ? js(forJs) : '[]'},
 optionsLimit: 50,
 placeholder: ${js(this._placeholder ?? tr('placeholder'))},
 position: null,
 removeButtonLabel: ${js(tr('actions.remove_option.label'))},
 searchDebounce: 1000,
 searchingMessage: ${js(tr('searching_message'))},
 searchLabel: ${js(tr('search_label'))},
 searchPrompt: ${js(tr('search_prompt'))},
 searchableOptionFields: ${js(['label'])},
 state: $wire.$entangle(${js(this.getStatePath())}, ${this._live ? 'true' : 'false'}),
 statePath: ${js(this.getStatePath())},
 })`;
        const wrapper = new Attributes().merge({ 'x-on:focus-input.stop': "$el.querySelector('.fi-select-input-btn')?.focus()" }).class(['fi-fo-select', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        const key = `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify(forJs)).digest('hex')}`;
        return `<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><div class="fi-hidden" data-select-accessibility="${e(accessibility)}" x-data="{
 isDisabled: ${isDisabled ? 'true' : 'false'},
 init() {
 const container = $el.nextElementSibling
 container.dispatchEvent(
 new CustomEvent('set-select-property', {
 detail: { isDisabled: this.isDisabled },
 }),
 )
 },
 }"></div><div x-load x-load-src="${e(asset('select'))}" x-data="${e(config)}" wire:ignore wire:key="${e(key)}" x-on:set-select-property="$event.detail.isDisabled ? select.disable() : select.enable()" class="fi-select-input"><div x-ref="select"></div></div></div>${suffix}</div>`;
    }
}

/** Colonne d'un Repeater en table : intitulé et largeur. */
export class TableColumn {
    label: string;
    private _width: string | null = null;
    constructor(label: string) { this.label = label; }
    static make(label: string): TableColumn { return configured(new TableColumn(label)); }
    width(width: number | string): this { this._width = typeof width === 'number' ? `${width}px` : width; return this; }
    getWidth(): string | null { return this._width; }
}

const ITEM_KEY = /^[A-Za-z0-9_-]{1,64}$/;
const isItemKey = (key: string) => ITEM_KEY.test(key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
type ItemLink = { label: string; icon: string; url: string };

/**
 * Liste d'éléments répétés, chacun avec les mêmes champs (port de Repeater, affichage en table).
 * L'état est une table `clé d'élément → champs` ; l'ordre des clés est l'ordre d'affichage.
 * Ajout, suppression et déplacement sont des actions du composant, montées avec `schemaComponent`.
 */
export class Repeater extends Field {
    private _schema: () => Field[] = () => [];
    private _columns: TableColumn[] = [];
    private _defaultItems = 0;
    private _maxItems = 500;
    private _itemLinks: ((ctx: { item: Record<string, unknown>; key: string }) => ItemLink | null)[] = [];
    static make(name: string): Repeater { return configured(new Repeater(name)); }
    /** Champs d'un élément : une fonction, appelée pour chaque élément. */
    schema(factory: () => Field[]): this { this._schema = factory; return this; }
    /** Affichage en table, une colonne par champ. */
    table(columns: TableColumn[]): this { this._columns = columns; return this; }
    defaultItems(count: number): this { this._defaultItems = count; return this; }
    maxItems(count: number): this { this._maxItems = count; return this; }
    private _reorderable = true;
    /** Faux : les éléments gardent leur ordre (cas d'une relation sans colonne d'ordre dans Filament). */
    reorderable(condition = true): this { this._reorderable = condition; return this; }
    /** Lien affiché sur chaque ligne (équivalent d'une action d'élément à URL). */
    extraItemLink(resolver: (ctx: { item: Record<string, unknown>; key: string }) => ItemLink | null): this { this._itemLinks.push(resolver); return this; }

    // --- état
    /** Éléments bien formés : les clés viennent du navigateur, seules les clés simples sont retenues. */
    getItems(): Record<string, Record<string, unknown>> {
        const state = this.context().state;
        if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
        return Object.fromEntries(Object.entries(state as Record<string, unknown>).filter(([key, item]) => isItemKey(key) && item !== null && typeof item === 'object' && !Array.isArray(item)).slice(0, this._maxItems)) as Record<string, Record<string, unknown>>;
    }
    private setItems(items: Record<string, Record<string, unknown>>): void { writePath(this.livewire as any, this.getStatePath().split('.'), items); }
    private itemDefaults(): Record<string, unknown> { return Object.fromEntries(this._schema().map((field) => [field.getName(), field.getDefaultState()])); }
    getDefaultState(): unknown { return Object.fromEntries(Array.from({ length: this._defaultItems }, () => [randomUUID(), this.itemDefaults()])); }
    /** Enregistrements d'une relation → éléments `record-<id>`, réduits aux champs déclarés. */
    hydrateState(value: unknown): unknown {
        if (!Array.isArray(value)) return value && typeof value === 'object' ? value : {};
        const fields = this._schema();
        return Object.fromEntries(value.map((row: any) => [`record-${row.id}`, Object.fromEntries(fields.map((field) => [field.getName(), field.hydrateState(row[field.getName()] ?? field.getDefaultState())]))]));
    }
    dehydrateState(): unknown { return Object.fromEntries(Object.keys(this.getItems()).map((key) => [key, {}])); }
    getChildSchemas(): Schema[] {
        const container = this.container;
        return Object.keys(this.getItems()).map((key) => new Schema(container.livewire).key(`${this.getKey()}.${key}`).statePath(`${this.getStatePath()}.${key}`).operation(container.getOperation()).record(container.getRecord()).root(false).components(this._schema()));
    }
    async getValidationRules(): Promise<Rule[]> {
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: () => Object.keys(this.getItems()).length > 0, message: (a) => `The ${a} field is required.` });
        return [...rules, ...this._rules];
    }

    // --- actions du composant
    getActions(): Action[] {
        const move = (offset: number) => ({ arguments: args }: { arguments: Record<string, unknown> }) => {
            const items = this.getItems();
            const keys = Object.keys(items);
            const from = keys.indexOf(String(args.item));
            const to = from + offset;
            if (from < 0 || to < 0 || to >= keys.length) return;
            [keys[from], keys[to]] = [keys[to], keys[from]];
            this.setItems(Object.fromEntries(keys.map((key) => [key, items[key]])));
        };
        return [
            ...this.getHintActions(),
            Action.make('add').action(() => { const items = this.getItems(); if (Object.keys(items).length >= this._maxItems) return; items[randomUUID()] = this.itemDefaults(); this.setItems(items); }),
            Action.make('delete').action(({ arguments: args }) => { const items = this.getItems(); const key = String(args.item); if (!Object.hasOwn(items, key)) return; delete items[key]; this.setItems(items); }),
            Action.make('moveUp').action(move(-1)),
            Action.make('moveDown').action(move(1)),
            // Glisser-déposer : le navigateur envoie le nouvel ordre, accepté seulement si c'est une permutation des clés existantes.
            Action.make('reorder').action(({ arguments: args }) => {
                const items = this.getItems();
                const keys = Object.keys(items);
                const order = Array.isArray(args.items) ? args.items.map(String) : [];
                if (order.length !== keys.length || new Set(order).size !== keys.length || !order.every((key) => Object.hasOwn(items, key))) return;
                this.setItems(Object.fromEntries(order.map((key) => [key, items[key]])));
            }),
        ];
    }

    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const id = this.getId();
        const key = this.getKey()!;
        const livewireKey = this.getLivewireKey() ?? '';
        const items = this.getItems();
        const keys = Object.keys(items);
        const schemas = this.getChildSchemas();
        const tr = (name: string, replace: Record<string, string> = {}) => t(`filament-forms::components.repeater.${name}`, replace);
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: key };
        const expression = (action: string, args: Record<string, unknown> | null) => `mountAction(${js(action)}, ${args ? js(args) : '{}'}, ${js(context)})`;
        const button = 'fi-ac-icon-btn-action fi-icon-btn';
        const loading = (target: string) => `${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': target }))}`;
        const actionIcon = (name: string, target: string) => icon(name, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': target }) });
        const itemLabel = tr('reordering.item');
        const descriptionId = (itemKey: string) => `${id}-item-${createHash('md5').update(itemKey).digest('hex')}`;
        const rows: string[] = [];
        // Comme Filament : pas de colonne de réordonnancement tant qu'il n'y a qu'une ligne.
        const hasReorderColumn = this._reorderable && keys.length > 1;
        for (const [index, itemKey] of keys.entries()) {
            const moveButton = (action: 'moveUp' | 'moveDown', label: string, iconName: string, direction: string, disabled: boolean) => {
                const expr = expression(action, { item: itemKey });
                return `<div x-on:click.stop class="fi-sr-only"><button title="${e(label)}" ${disabled ? 'aria-disabled="true" ' : ''}aria-label="${e(label)}" ${disabled ? 'disabled="disabled" ' : ''}tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${button}${disabled ? ' fi-disabled' : ''} fi-size-sm" data-reorder-hidden="data-reorder-hidden" data-reorder-direction="${direction}" data-reorder-action="${e(expr)}" aria-describedby="${e(descriptionId(itemKey))}" wire:click="${e(expr)}">${actionIcon(iconName, expr)}${loading(expr)}</button></div>`;
            };
            const cells: string[] = [];
            for (const field of schemas[index].getComponents()) cells.push(`<td>${await field.toSchemaHtml(await field.isVisible())}</td>`);
            const links = this._itemLinks.map((resolve) => resolve({ item: items[itemKey], key: itemKey })).filter((link): link is ItemLink => link !== null)
                .map((link) => `<div x-on:click.stop><a href="${e(link.url)}" target="_blank" x-tooltip="{
 content: ${e(js(link.label))},
 theme: $store.theme,
 allowHTML: false,
 }" aria-label="${e(link.label)}" class="${button} fi-size-sm">${icon(link.icon)}</a></div>`);
            const deleteExpr = expression('delete', { item: itemKey });
            rows.push(`<tr wire:key="${e(livewireKey)}.${e(itemKey)}.item" x-sortable-item="${e(itemKey)}">${hasReorderColumn ? `<td><div class="fi-fo-table-repeater-actions"><div x-on:click.stop><button title="${e(tr('actions.reorder.label'))}" aria-label="${e(tr('actions.reorder.label'))}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${button} fi-size-sm" x-sortable-handle="x-sortable-handle">${icon('m-arrows-up-down')}</button></div>${moveButton('moveUp', tr('actions.move_up.label'), 'm-arrow-up', 'up', index === 0)}${moveButton('moveDown', tr('actions.move_down.label'), 'm-arrow-down', 'down', index === keys.length - 1)}</div></td>` : ''}${cells.join('')}<td><div class="fi-fo-table-repeater-actions">${links.join('')}<div x-on:click.stop><button title="${e(tr('actions.delete.label'))}" aria-label="${e(tr('actions.delete.label'))}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="${[button, 'fi-size-sm', ...colorManager.getComponentClasses('icon-button', 'danger')].join(' ')}" wire:click="${e(deleteExpr)}">${actionIcon('m-trash', deleteExpr)}${loading(deleteExpr)}</button></div></div></td></tr>`);
        }
        const head = this._columns.map((column) => `<th scope="col"${column.getWidth() ? ` style="width: ${e(column.getWidth()!)};"` : ''}>${e(column.label)}</th>`).join('');
        const addExpr = expression('add', null);
        const label = await this.getLabel();
        const config = { statePath: this.getStatePath(), schemaComponent: key, moveUpAction: 'moveUp', moveDownAction: 'moveDown', reorderAction: 'reorder', message: tr('reordering.moved'), hasCustomReorderAction: false };
        const descriptions = keys.map((itemKey, index) => `<span class="fi-sr-only" data-reorder-description="${e(itemKey)}" data-reorder-label="${e(itemLabel)}" id="${e(descriptionId(itemKey))}">${e(tr('reordering.position', { label: itemLabel, position: String(index + 1), count: String(keys.length) }))}</span>`).join('');
        const table = `<div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" data-reorder-owner="data-reorder-owner" data-reorder-items="${e(JSON.stringify(keys))}" x-load="x-load" x-load-src="${e(asset('repeater'))}" x-data="repeaterFormComponent(${e(js(config))})" class="fi-fo-table-repeater"><span wire:ignore x-ref="reorderStatus" class="fi-sr-only" role="status" aria-live="polite" aria-atomic="true"></span><table><thead><tr>${hasReorderColumn ? `<th scope="col" class="fi-fo-table-repeater-empty-header-cell"><span class="fi-sr-only">${e(tr('columns.reorder.label'))}</span></th>` : ''}${head}<th scope="col" class="fi-fo-table-repeater-empty-header-cell"><span class="fi-sr-only">${e(tr('columns.actions.label'))}</span></th></tr></thead><tbody x-sortable data-sortable-animation-duration="300" x-on:end.stop="reorder" x-ref="reorderItems">${rows.join('')}</tbody></table>${keys.length < this._maxItems ? `<div class="fi-fo-table-repeater-add"><button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-btn-action fi-btn fi-size-sm" wire:click="${e(addExpr)}">${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': addExpr }), 'sm')}${e(tr('actions.add.label', { label: label.toLowerCase() }))}</button></div>` : ''}${descriptions}</div>`;
        return this.wrap(table, { labelAsDiv: true });
    }
}

/** Zone de texte multiligne (port de Textarea, sans redimensionnement automatique). */
/** Heure (port de TimePicker, saisie native) : l'état est `HH:MM` avec `seconds(false)`, `HH:MM:SS` sinon. */
export class TimePicker extends Field {
    private _seconds = true;
    static make(name: string): TimePicker { return configured(new TimePicker(name)); }
    seconds(condition = true): this { this._seconds = condition; return this; }
    hydrateState(value: unknown): unknown { return typeof value === 'string' && value.length >= 5 ? value.slice(value.length > 8 ? 11 : 0).slice(0, this._seconds ? 8 : 5) : value; }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const input = new Attributes()
            .merge({
                'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(),
                required: (await this.isRequired()) && !isDisabled, step: this._seconds ? 1 : null, type: 'time', 'wire:model': this.getStatePath(),
            })
            .class(['fi-input']);
        const wrapper = new Attributes()
            .merge({ 'x-on:focus-input.stop': "$el.querySelector('input:not([type=hidden])')?.focus()" })
            .class(['fi-fo-date-time-picker', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><input ${input.toHtml()} /></div></div>`);
    }
}

/** Date et heure (port de DateTimePicker, saisie native `datetime-local`) : l'état enregistré est `AAAA-MM-JJ HH:MM:SS`. */
export class DateTimePicker extends Field {
    private _seconds = true;
    static make(name: string): DateTimePicker { return configured(new DateTimePicker(name)); }
    seconds(condition = true): this { this._seconds = condition; return this; }
    dehydrateState(state: unknown): unknown {
        if (typeof state !== 'string' || state === '') return state === '' ? null : state;
        const value = state.replace('T', ' ');
        return value.length === 16 ? `${value}:00` : value;
    }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const input = new Attributes()
            .merge({
                'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(),
                required: (await this.isRequired()) && !isDisabled, step: this._seconds ? 1 : null, type: 'datetime-local', 'wire:model': this.getStatePath(),
            })
            .class(['fi-input']);
        const wrapper = new Attributes()
            .merge({ 'x-on:focus-input.stop': "$el.querySelector('input:not([type=hidden])')?.focus()" })
            .class(['fi-fo-date-time-picker', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><input ${input.toHtml()} /></div></div>`);
    }
}

/** Choix unique en boutons radio (port de Radio). */
export class Radio extends Field {
    private _options: [string, string][] = [];
    private _descriptions: Record<string, string> = {};
    private _inline = false;
    private _live = false;
    static make(name: string): Radio { return configured(new Radio(name)); }
    options(options: Options): this { this._options = (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]) => [String(value), String(label)]); return this; }
    /** Texte d'aide par valeur, sous le libellé de l'option. */
    descriptions(descriptions: Record<string, string>): this { this._descriptions = descriptions; return this; }
    /** Options côte à côte. */
    inline(condition = true): this { this._inline = condition; return this; }
    live(condition = true): this { this._live = condition; return this; }
    async getValidationRules(): Promise<Rule[]> {
        return [...(await super.getValidationRules()), { name: 'in', passes: (v) => this._options.some(([value]) => value === String(v)), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const isRequired = (await this.isRequired()) && !isDisabled;
        const container = new Attributes()
            .merge({ 'aria-describedby': this.hasError() ? `${id}-error` : null, 'aria-labelledby': `${id}-label`, 'aria-required': isRequired ? 'true' : null, role: 'radiogroup' })
            .class(['fi-fo-radio', this._inline ? 'fi-inline' : null]);
        const items = this._options.map(([value, label]) => {
            const input = new Attributes()
                .merge({ type: 'radio', disabled: isDisabled, id: `${id}-${value}`, name: id, required: isRequired, value, [this._live ? 'wire:model.live' : 'wire:model']: this.getStatePath() })
                .class(['fi-radio-input', this.hasError() ? 'fi-invalid' : 'fi-valid']);
            const description = this._descriptions[value] ? `<p class="fi-fo-radio-label-description">${e(this._descriptions[value])}</p>` : '';
            return `<label class="fi-fo-radio-label"><input ${input.toHtml()} /><div class="fi-fo-radio-label-text"><p>${e(label)}</p>${description}</div></label>`;
        });
        return this.wrap(`<div ${container.toHtml()}>${items.join('')}</div>`, { labelAsDiv: true });
    }
}

export class Textarea extends Field {
    private _rows: number | null = null;
    private _maxLength: number | null = null;
    static make(name: string): Textarea { return configured(new Textarea(name)); }
    rows(rows: number): this { this._rows = rows; return this; }
    maxLength(length: number): this { this._maxLength = length; return this.rule({ name: 'max', passes: (v) => String(v).length <= length, message: (a) => `The ${a} field must not be greater than ${length} characters.` }); }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        // Hauteur initiale : 1,5rem par ligne plus la marge intérieure (comme Filament).
        const height = (this._rows ?? 2) * 1.5 + 0.75;
        const textarea = new Attributes().merge({
            'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(), maxlength: this._maxLength,
            required: (await this.isRequired()) && !isDisabled, rows: this._rows, 'wire:model': this.getStatePath(),
        });
        const wrapper = new Attributes().class(['fi-fo-textarea', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><div wire:ignore.self${height !== null ? ` style="height: ${height}rem"` : ''}><textarea x-load x-load-src="${e(asset('textarea'))}" x-data="textareaFormComponent({
 initialHeight: ${height ?? 'null'},
 shouldAutosize: false,
 state: $wire.$entangle(${e(js(this.getStatePath()))}),
 })" x-model="state" ${textarea.toHtml()}></textarea></div></div></div>`, { wrapperClass: 'fi-fo-textarea-wrp' });
    }
}

/** Saisie d'une liste de mots-clés (port de TagsInput) : l'état est un tableau de chaînes. */
export class TagsInput extends Field {
    private _placeholder: string | null = null;
    private _suggestions: string[] = [];
    private _splitKeys: string[] = [];
    static make(name: string): TagsInput { return configured(new TagsInput(name)); }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** Valeurs proposées à la saisie. */
    suggestions(suggestions: string[]): this { this._suggestions = suggestions.map(String).slice(0, 1000); return this; }
    /** Touches qui valident le mot en cours, en plus d'Entrée (`['Tab', ',']`). */
    splitKeys(keys: string[]): this { this._splitKeys = keys; return this; }
    getDefaultState(): unknown { return this._default ?? []; }
    hydrateState(value: unknown): unknown {
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = value === '' ? [] : [value]; } }
        return Array.isArray(value) ? value.filter((tag) => typeof tag === 'string' || typeof tag === 'number').map(String) : [];
    }
    /** Seules des chaînes non vides sont enregistrées, quelle que soit la forme reçue du navigateur. */
    dehydrateState(state: unknown): unknown { return (Array.isArray(state) ? state : []).filter((tag) => typeof tag === 'string' || typeof tag === 'number').map((tag) => String(tag).trim()).filter((tag) => tag !== '').slice(0, 1000); }
    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const label = await this.getLabel();
        const wrapper = new Attributes()
            .merge({ 'aria-label': label, role: 'group', 'x-on:focus-input.stop': "$el.querySelector('input')?.focus()" })
            .class(['fi-fo-tags-input', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        const input = new Attributes()
            .merge({ autocomplete: 'off', disabled: isDisabled, id, list: `${id}-suggestions`, placeholder: this._placeholder ?? t('filament-forms::components.tags_input.placeholder'), type: 'text', 'x-bind': 'input' })
            .class(['fi-input']);
        const badge = ['fi-badge', 'fi-size-md', ...colorManager.getComponentClasses('badge', 'primary')].join(' ');
        const deleteButton = isDisabled ? '' : `<button type="button" x-on:click.stop="deleteTag(tag)" x-bind:aria-label="'${e(t('filament-forms::components.tags_input.actions.delete.label'))}: ' + tag" class="fi-badge-delete-btn"><span aria-hidden="true" class="fi-badge-delete-btn-icon"></span></button>`;
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><div x-load x-load-src="${e(asset('tags-input'))}" x-data="tagsInputFormComponent({
                    state: $wire.$entangle(${e(js(this.getStatePath()))}, false),
                    splitKeys: ${this._splitKeys.length ? e(js(this._splitKeys)) : '[]'},
                    tagAddedMessage: ${e(js(t('filament-forms::components.tags_input.tag_added')))},
                    tagRemovedMessage: ${e(js(t('filament-forms::components.tags_input.tag_removed')))},
                })"><input ${input.toHtml()} /><div x-ref="liveRegion" aria-live="polite" class="fi-sr-only"></div><datalist id="${e(id)}-suggestions">${this._suggestions.map((s) => `<template x-bind:key="${e(js(s))}" x-if="! (state?.includes(${e(js(s))}) ?? true)"><option value="${e(s)}" /></template>`).join('')}</datalist><div wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.${createHash('md5').update(JSON.stringify(this.context().state ?? [])).digest('hex')}"><template x-cloak x-if="state?.length"><div class="fi-fo-tags-input-tags-ctn"><template x-for="(tag, index) in state" x-bind:key="\`\${tag}-\${index}\`"><span class="${badge}"><span class="fi-badge-label-ctn"><span class="fi-badge-label"><span x-text="tag"></span></span></span>${deleteButton}</span></template></div></template></div></div></div></div>`, { wrapperClass: 'fi-fo-tags-input-wrp' });
    }
}

/** Interrupteur (port de Toggle). */
export class Toggle extends Field {
    static make(name: string): Toggle { return configured(new Toggle(name)); }
    getDefaultState(): unknown { return this._default ?? false; }
    hydrateState(value: unknown): unknown { return value === true || value === 1 || value === '1'; }
    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const on = this.context().state === true;
        const colors = colorManager.getComponentClasses('toggle', 'primary').join(' ');
        const button = new Attributes().merge({ 'aria-describedby': this.getHelperTextId(), 'aria-checked': on ? 'true' : 'false', disabled: await this.isDisabled(), id: this.getId(), 'wire:target': this.getStatePath() }).class(['fi-fo-toggle', 'fi-toggle']);
        const knob = '<div><div aria-hidden="true"></div><div aria-hidden="true"></div></div>';
        return this.wrap('', { labelPrefix: `<button x-data="{ state: $wire.$entangle(${e(js(this.getStatePath()))}, false) }" x-bind:aria-checked="state ? 'true' : 'false'" x-on:click="state = ! state" x-bind:class="state ? 'fi-toggle-on ${colors}' : 'fi-toggle-off'"${on ? ' x-cloak' : ''} role="switch" type="button" ${button.toHtml()}>${knob}</button>${on ? `<div x-cloak="inline-flex" wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.placeholder" class="fi-toggle fi-toggle-on fi-hidden ${colors}">${knob}</div>` : ''}` });
    }
}

/** Choix unique présenté en boutons (port de ToggleButtons, sélection simple). */
export class ToggleButtons extends Field {
    private _options: [string, string][] = [];
    private _inline = false;
    private _grouped = false;
    private _colors: Record<string, string> = {};
    private _icons: Record<string, string> = {};
    static make(name: string): ToggleButtons { return configured(new ToggleButtons(name)); }
    private _live = false;
    /** L'état est envoyé au serveur dès qu'il change. */
    live(condition = true): this { this._live = condition; return this; }
    /** Couleur par valeur (ex. celle d'une énumération). */
    colors(colors: Record<string, string>): this { this._colors = colors; return this; }
    /** Icône par valeur. */
    icons(icons: Record<string, string>): this { this._icons = icons; return this; }
    options(options: Options): this { this._options = (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]) => [String(value), String(label)]); return this; }
    /** Boutons côte à côte. */
    inline(condition = true): this { this._inline = condition; return this; }
    /** Boutons accolés en un seul groupe. */
    grouped(condition = true): this { this._grouped = condition; return this; }
    async getValidationRules(): Promise<Rule[]> {
        return [...(await super.getValidationRules()), { name: 'in', passes: (v) => this._options.some(([value]) => value === String(v)), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('Aucun gestionnaire de couleurs : appelez useColorManager().');
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const isRequired = (await this.isRequired()) && !isDisabled;
        const describedBy = [isRequired ? `${id}-required` : null, this.hasError() ? `${id}-error` : null].filter(Boolean).join(' ') || null;
        const container = new Attributes()
            .merge({ 'aria-describedby': describedBy, 'aria-labelledby': `${id}-label`, 'aria-required': isRequired ? 'true' : null, role: 'radiogroup', 'wire:key': `${this.getLivewireKey()}.inputs` })
            .class(['fi-fo-toggle-buttons', this._grouped ? 'fi-btn-group' : null, !this._grouped && this._inline ? 'fi-inline' : null]);
        const manager = colorManager;
        const button = (value: string) => ['fi-btn', this._grouped ? 'fi-btn-group-btn' : null, 'fi-size-md', ...manager.getComponentClasses('button', this._colors[value] ?? 'primary')].filter(Boolean).join(' ');
        const items = this._options.map(([value, label]) => {
            const input = new Attributes().merge({ id: `${id}-${value}`, name: id, type: 'radio', value, [this._live ? 'wire:model.live' : 'wire:model']: this.getStatePath(), disabled: isDisabled, required: isRequired, 'aria-describedby': describedBy }).class(['fi-fo-toggle-buttons-input']);
            const html = `<input ${input.toHtml()} /><label for="${e(`${id}-${value}`)}" class="${button(value)}">${this._icons[value] ? icon(this._icons[value]) : ''}${e(label)}</label>`;
            return this._grouped ? html : `<div class="fi-fo-toggle-buttons-btn-ctn">${html}</div>`;
        });
        const after = isRequired ? `<span id="${e(id)}-required" class="fi-sr-only">${e(t('filament-forms::components.toggle_buttons.required_description'))}</span>` : '';
        return this.wrap(`<div ${container.toHtml()}>${items.join('')}</div>`, { wrapperClass: 'fi-fo-toggle-buttons-wrp', labelAsDiv: true, focusable: true, after });
    }
}

// Schéma TipTap du serveur : les nœuds et marques que l'éditeur de Filament sait produire avec sa barre d'outils par défaut.
// Hors périmètre pour l'instant : grilles, blocs personnalisés, mentions, balises de fusion, couleur de texte, « lead » et « small ».
const RICH_EXTENSIONS = [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'start' }), Subscript, Superscript, Highlight, Image, TableKit];
type RichDocument = { type: 'doc'; content?: unknown[] };
const isRichDocument = (value: unknown): value is RichDocument => !!value && typeof value === 'object' && (value as any).type === 'doc';
const richText = (node: any): string => (typeof node?.text === 'string' ? node.text : '') + (Array.isArray(node?.content) ? node.content.map(richText).join('') : '');
const hasRichContent = (node: any): boolean => node?.type === 'image' || node?.type === 'horizontalRule' || (Array.isArray(node?.content) && node.content.some(hasRichContent));
/** HTML enregistré → document TipTap. L'analyse écarte ce que le schéma ne connaît pas (scripts, attributs d'événement, liens `javascript:`). */
export function richHtmlToDocument(html: string | null | undefined): RichDocument { return generateJSON(html ?? '', RICH_EXTENSIONS) as RichDocument; }
/**
 * Document TipTap → HTML à enregistrer, ou null s'il est vide ou invalide. Le document vient du navigateur :
 * il est rendu puis ré-analysé, pour que seul ce que le schéma accepte soit conservé.
 */
export function richDocumentToHtml(document: unknown): string | null {
    if (!isRichDocument(document)) return null;
    try {
        const clean = generateJSON(generateHTML(document as any, RICH_EXTENSIONS), RICH_EXTENSIONS);
        return richText(clean).trim() === '' && !hasRichContent(clean) ? null : generateHTML(clean, RICH_EXTENSIONS);
    } catch { return null; }
}

/**
 * Éditeur de texte riche (port de RichEditor) : le navigateur travaille sur un document TipTap, la base reçoit du HTML.
 * Le balisage est celui de Filament, repris de l'oracle (vue générée). Non portés : pièces jointes, blocs personnalisés, mentions.
 */
export class RichEditor extends Field {
    static make(name: string): RichEditor { return configured(new RichEditor(name)); }
    hydrateState(value: unknown): unknown { return isRichDocument(value) ? value : richHtmlToDocument(typeof value === 'string' ? value : ''); }
    getDefaultState(): unknown { return richHtmlToDocument(typeof this._default === 'string' ? this._default : ''); }
    dehydrateState(state: unknown): unknown { return richDocumentToHtml(state); }
    async getValidationRules(): Promise<Rule[]> {
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: (value) => richDocumentToHtml(value) !== null, message: (a) => `The ${a} field is required.` });
        return [...rules, ...this._rules];
    }
    getExposedMethods(): string[] { return ['getMentionSearchResultsForJs', 'getMentionLabelsForJs', 'getCustomBlockPreviewsForJs', 'getUploadedFileAttachmentTemporaryUrl', 'saveUploadedFileAttachmentAndGetUrl']; }
    getMentionSearchResultsForJs(): unknown[] { return []; }
    getMentionLabelsForJs(): unknown[] { return []; }
    getCustomBlockPreviewsForJs(): unknown[] { return []; }
    getUploadedFileAttachmentTemporaryUrl(): null { return null; }
    saveUploadedFileAttachmentAndGetUrl(): null { return null; }

    /** Action « lien » de la barre d'outils : une modale (URL, nouvel onglet), puis des commandes renvoyées à l'éditeur du navigateur. */
    getActions(): Action[] {
        const tr = (name: string) => t(`filament-forms::components.rich_editor.actions.link.${name}`);
        const key = this.getKey()!;
        return [
            ...this.getHintActions(),
            Action.make('link').label(tr('label')).modalHeading(tr('modal.heading')).modalWidth('lg')
                .fillForm(({ arguments: args }) => ({ url: typeof args.url === 'string' ? args.url : null, shouldOpenInNewTab: args.shouldOpenInNewTab === true }))
                .schema(() => [
                    TextInput.make('url').label(tr('modal.form.url.label'))
                        // Seules des adresses sans code exécutable sont acceptées.
                        .rule({ name: 'url', passes: (value) => /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(String(value)), message: (a) => `The ${a} field must be a valid URL.` }),
                    Checkbox.make('shouldOpenInNewTab').label(tr('modal.form.should_open_in_new_tab.label')),
                ])
                .action(({ livewire, arguments: args, data }) => {
                    const selection = (args.editorSelection ?? null) as { head?: unknown; anchor?: unknown } | null;
                    const single = selection?.head === selection?.anchor;
                    const url = typeof data.url === 'string' && data.url !== '' ? data.url : null;
                    const commands = [
                        ...(single ? [{ name: 'extendMarkRange', arguments: ['link'] }] : []),
                        url ? { name: 'setLink', arguments: [{ href: url, target: data.shouldOpenInNewTab ? '_blank' : null }] } : { name: 'unsetLink', arguments: [] },
                    ];
                    livewire.dispatch('run-rich-editor-commands', { awaitSchemaComponent: key, livewireId: livewire.id, key, editorSelection: selection, commands });
                }),
        ];
    }

    async toHtml(): Promise<string> {
        return this.wrap(views.render('filament-forms::components.rich-editor', { livewireId: this.livewire.id, key: this.getKey(), statePath: this.getStatePath(), label: await this.getLabel(), js }), { labelAsDiv: true });
    }
}

/** Sélecteur de couleur (port de ColorPicker, format hexadécimal). */
export class ColorPicker extends Field {
    static make(name: string): ColorPicker { return configured(new ColorPicker(name)); }
    /** Format hexadécimal (le seul pris en charge ; présent pour la compatibilité d'API). */
    hex(): this { return this; }
    constructor(name: string) {
        super(name);
        this.rule({ name: 'hex_color', passes: (v) => /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v)), message: (a) => `The ${a} field must be a valid hexadecimal color.` });
    }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const state = this.context().state;
        const id = this.getId();
        const key = this.getLivewireKey() ?? '';
        // Même empreinte que Filament : md5(serialize([$isDisabled])).
        const hash = createHash('md5').update(`a:1:{i:0;b:${isDisabled ? 1 : 0};}`).digest('hex');
        const input = new Attributes().merge({
            'aria-controls': `${id}-panel`, 'aria-expanded': 'false', 'aria-haspopup': 'dialog', 'aria-invalid': this.hasError() ? 'true' : null, autocomplete: 'off',
            disabled: isDisabled, id, required: (await this.isRequired()) && !isDisabled, role: 'combobox', type: 'text', 'x-model': 'state',
        }).class(['fi-input']);
        const wrapper = new Attributes().merge({ 'x-on:focus-input.stop': "$el.querySelector('input')?.focus()" }).class(['fi-fo-color-picker', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><div x-load x-load-src="${e(asset('color-picker'))}" x-data="colorPickerFormComponent({
 isAutofocused: false,
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isLive: false,
 isLiveDebounced: false,
 isLiveOnBlur: false,
 liveDebounce: null,
 state: $wire.$entangle(${e(js(this.getStatePath()))}),
 })" x-on:dropdown-escape="if (isOpen()) { closePanelAndRestoreFocus(); $event.preventDefault() }" x-on:keydown.esc="isOpen() &amp;&amp; $event.stopPropagation()" x-on:focusout="if (isOpen() &amp;&amp; ! $el.contains($event.relatedTarget)) $refs.panel.close()" wire:key="${e(key)}.${hash}" class="fi-input-wrp-content"><input x-on:focus="$refs.panel.open($refs.input)" x-on:keydown.enter.prevent.stop="togglePanelVisibility()" x-ref="input" ${input.toHtml()} /><div aria-hidden="true" class="fi-fo-color-picker-preview my-auto me-3 size-5 shrink-0 rounded-full select-none" x-on:click="togglePanelVisibility()" x-bind:class="{
 'fi-empty': ! state,
 }" x-bind:style="{ 'background-color': state }"></div><div wire:ignore.self wire:key="${e(key)}.panel" x-cloak x-float.placement.bottom-start.offset.flip.shift="{ offset: 8 }" x-ref="panel" id="${e(id)}-panel" role="dialog" aria-label="${e(t('filament-forms::components.color_picker.panel_label'))}" class="fi-fo-color-picker-panel"><hex-color-picker x-ref="picker" color="${e(typeof state === 'string' ? state : '')}" /></div></div></div></div>`);
    }
}

export class Checkbox extends Field {
    static make(name: string): Checkbox { return configured(new Checkbox(name)); }
    getDefaultState(): unknown { return this._default ?? false; }
    async toHtml(): Promise<string> {
        const input = new Attributes()
            .merge({ type: 'checkbox', disabled: await this.isDisabled(), id: this.getId(), required: await this.isRequired(), 'wire:model': this.getStatePath() })
            .class(['fi-checkbox-input', this.hasError() ? 'fi-invalid' : 'fi-valid']);
        return this.wrap('', { labelPrefix: `<input ${input.toHtml()} />` });
    }
}

/** Plusieurs cases à cocher pour une liste de valeurs (port de CheckboxList, sans recherche ni « tout cocher »). */
export class CheckboxList extends Field {
    private _options: [string, string][] = [];
    private _optionColumns: number | null = null;
    static make(name: string): CheckboxList { return configured(new CheckboxList(name)); }
    options(options: Options): this { this._options = (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]) => [String(value), String(label)]); return this; }
    /** Nombre de colonnes sur lesquelles les options se répartissent (à partir de `lg`). */
    columns(columns: number | null): this { this._optionColumns = columns; return this; }
    getDefaultState(): unknown { return this._default ?? []; }
    hydrateState(value: unknown): unknown {
        let list = value;
        if (typeof value === 'string') { try { list = JSON.parse(value); } catch { list = []; } }
        return (Array.isArray(list) ? list : []).map(String);
    }
    /** Seules les valeurs proposées sont retenues, sans doublon, dans l'ordre des options. */
    dehydrateState(state: unknown): unknown {
        const chosen = new Set((Array.isArray(state) ? state : []).map(String));
        return this._options.map(([value]) => value).filter((value) => chosen.has(value));
    }
    async getValidationRules(): Promise<Rule[]> {
        const known = new Set(this._options.map(([value]) => value));
        return [...(await super.getValidationRules()), { name: 'in', passes: (v) => Array.isArray(v) && v.every((value) => known.has(String(value))), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const key = this.getLivewireKey() ?? '';
        const options = this._options.map(([value, label]) => {
            const input = new Attributes().merge({ disabled: isDisabled, type: 'checkbox', value, 'wire:model': this.getStatePath() }).class(['fi-checkbox-input', this.hasError() ? 'fi-invalid' : 'fi-valid']);
            return `<div wire:key="${e(`${key}.options.${value}`)}" class="fi-fo-checkbox-list-option-ctn"><label class="fi-fo-checkbox-list-option"><input ${input.toHtml()} /><div class="fi-fo-checkbox-list-option-text"><span class="fi-fo-checkbox-list-option-label">${e(label)}</span></div></label></div>`;
        });
        const columns = this._optionColumns ?? 1;
        const grid = columns > 1 ? `class="fi-grid fi-grid-direction-col lg:fi-grid-cols fi-fo-checkbox-list-options" style="--cols-lg: ${Math.floor(columns)}; --cols-default: 1;"` : 'class="fi-grid fi-grid-direction-col fi-fo-checkbox-list-options" style="--cols-default: 1;"';
        return this.wrap(`<div role="group" x-load x-load-src="${e(asset('checkbox-list'))}" x-data="checkboxListFormComponent({
 livewireId: ${e(js(this.livewire.id))},
 })" aria-labelledby="${e(this.getId())}-label" class="fi-fo-checkbox-list"><div wire:key="${e(key)}.options" ${grid}>${options.join('')}</div></div>`, { labelAsDiv: true });
    }
}

/** Paires clé / valeur libres, enregistrées comme un objet (port de KeyValue). */
export class KeyValue extends Field {
    private _keyLabel: string | null = null;
    private _valueLabel: string | null = null;
    private _reorderable = false;
    static make(name: string): KeyValue { return configured(new KeyValue(name)); }
    keyLabel(label: string): this { this._keyLabel = label; return this; }
    valueLabel(label: string): this { this._valueLabel = label; return this; }
    reorderable(condition = true): this { this._reorderable = condition; return this; }
    // Dans le formulaire, l'état est une liste de paires `{ key, value }` (ce qu'attend le composant du navigateur, et qui garde l'ordre) ;
    // à l'enregistrement il redevient un objet.
    getDefaultState(): unknown { return KeyValue.toPairs(this._default); }
    private static toPairs(value: unknown): { key: string; value: unknown }[] {
        let object = value;
        if (typeof value === 'string') { try { object = JSON.parse(value); } catch { object = {}; } }
        return object && typeof object === 'object' && !Array.isArray(object) ? Object.entries(object).map(([key, v]) => ({ key, value: v })) : [];
    }
    hydrateState(value: unknown): unknown { return KeyValue.toPairs(value); }
    /** Objet plat de chaînes : clés vides, objets imbriqués et clés dangereuses sont écartés ; 200 paires au plus. */
    dehydrateState(state: unknown): unknown {
        const out: Record<string, string | null> = {};
        if (!Array.isArray(state)) return out;
        for (const pair of state.slice(0, 200)) {
            if (!pair || typeof pair !== 'object' || typeof (pair as any).key !== 'string') continue;
            const value = (pair as any).value;
            const name = ((pair as any).key as string).trim().slice(0, 255);
            if (!name || name === '__proto__' || name === 'constructor' || name === 'prototype') continue;
            out[name] = value === null || value === undefined || typeof value === 'object' ? null : String(value).slice(0, 5000);
        }
        return out;
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const tr = (key: string) => t(`filament-forms::components.key_value.${key}`);
        const keyLabel = this._keyLabel ?? tr('fields.key.label'), valueLabel = this._valueLabel ?? tr('fields.value.label');
        const reordering = { row: tr('reordering.row'), position: tr('reordering.position'), moved: tr('reordering.moved') };
        const key = `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify([keyLabel, valueLabel, this._reorderable])).digest('hex')}`;
        const iconButton = 'type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled"';
        const dangerClasses = ['fi-ac-icon-btn-action', 'fi-icon-btn', 'fi-size-sm', ...(colorManager?.getComponentClasses('icon-button', 'danger') ?? [])].join(' ');
        const reorderCell = this._reorderable ? `<td class="fi-has-action"><span class="fi-sr-only" data-reorder-description x-bind:id="$id('key-value-row') + '-' + row.id" x-text="rowDescription(row, index)"></span><div x-sortable-handle class="fi-fo-key-value-table-row-sortable-handle"><button title="${e(tr('actions.reorder.label'))}" aria-label="${e(tr('actions.reorder.label'))}" ${iconButton} class="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" x-bind:tabindex="rows.length &gt; 1 ? -1 : 0" x-bind:aria-hidden="rows.length &gt; 1 ? 'true' : null">${icon('m-arrows-up-down')}</button></div><div class="fi-sr-only"><button type="button" tabindex="-1" data-reorder-hidden data-reorder-direction="up" x-on:click.stop="moveRow(row.id, index - 1)" x-bind:disabled="index === 0" x-bind:aria-describedby="$id('key-value-row') + '-' + row.id">${e(tr('actions.move_up.label'))}</button><button type="button" tabindex="-1" data-reorder-hidden data-reorder-direction="down" x-on:click.stop="moveRow(row.id, index + 1)" x-bind:disabled="index === rows.length - 1" x-bind:aria-describedby="$id('key-value-row') + '-' + row.id">${e(tr('actions.move_down.label'))}</button></div></td>` : '';
        return this.wrap(`<div aria-labelledby="${e(id)}-label" role="group" class="fi-fo-key-value fi-input-wrp"><div class="fi-input-wrp-content-ctn"><div x-load x-load-src="${e(asset('key-value'))}" x-id="['key-value-row']" x-data="keyValueFormComponent({
 state: $wire.$entangle(${e(js(this.getStatePath()))}, false),
 reordering: ${e(js(reordering))},
 })" wire:ignore wire:key="${e(key)}" class="fi-fo-key-value-table-ctn"><table aria-labelledby="${e(id)}-label" id="${e(id)}" class="fi-fo-key-value-table"><thead><tr>${this._reorderable ? `<th scope="col" x-show="rows.length" class="fi-has-action"><span class="fi-sr-only">${e(tr('columns.reorder.label'))}</span></th>` : ''}<th scope="col">${e(keyLabel)}</th><th scope="col">${e(valueLabel)}</th><th scope="col" x-show="rows.length" class="fi-has-action"><span class="fi-sr-only">${e(tr('columns.actions.label'))}</span></th></tr></thead><tbody${this._reorderable ? ' x-on:end.stop="reorderRows($event)" x-sortable data-sortable-animation-duration="300"' : ''}><template x-bind:key="row.id" x-for="(row, index) in rows"><tr${this._reorderable ? ' x-bind:x-sortable-item="row.id"' : ''}>${reorderCell}<td><input aria-label="${e(keyLabel)}" placeholder="" type="text" x-model="row.key" x-on:input.debounce.500ms="updateState" class="fi-input" /></td><td><input aria-label="${e(valueLabel)}" placeholder="" type="text" x-model="row.value" x-on:input.debounce.500ms="updateState" class="fi-input" /></td><td class="fi-has-action"><div x-on:click="deleteRow(index)"><button title="${e(tr('actions.delete.label'))}" aria-label="${e(tr('actions.delete.label'))}" ${iconButton} class="${dangerClasses}">${icon('m-trash')}</button></div></td></tr></template></tbody></table><span x-ref="reorderStatus" class="fi-sr-only" role="status" aria-live="polite" aria-atomic="true"></span><div x-on:click="addRow" class="fi-fo-key-value-add-action-ctn"><button ${iconButton} class="fi-ac-link-action fi-link fi-size-md"><span class="fi-link-label">${e(tr('actions.add.label'))}</span></button></div></div></div></div>`, { labelAsDiv: true, wrapperClass: 'fi-fo-key-value-wrp' });
    }
}

/** Expression JavaScript écrite par le développeur (formateur d'infobulle d'un Slider…), insérée telle quelle : jamais de donnée utilisateur. */
export class RawJs {
    readonly js: string;
    constructor(js: string) { this.js = js; }
    static make(js: string): RawJs { return new RawJs(js); }
    toString(): string { return this.js; }
}
/** Longueur CSS simple (`10rem`, `300px`, `50%`) ; toute autre valeur est refusée (elle finirait dans un attribut `style`). */
const cssLength = (value: string | null): string | null => (value !== null && /^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test(value.trim()) ? value.trim() : null);
/** Attributs d'accessibilité d'un champ (port de Field::getAccessibilityAttributes) : texte d'aide et message d'erreur. */
function accessibilityOf(field: Field, options: { withInvalid?: boolean } = {}): Record<string, string | null> {
    const ids = [(field as any).getHelperTextId() as string | null, field.hasError() ? `${field.getId()}-error` : null].filter(Boolean);
    return { 'aria-describedby': ids.length ? ids.join(' ') : null, 'aria-invalid': options.withInvalid !== false && field.hasError() ? 'true' : null };
}
type LiveMode = { onBlur: boolean; debounce: number | null } | null;
/** Second argument de `$entangle()` : vrai seulement pour un champ `live()` simple (ni `onBlur`, ni `debounce`), comme Filament. */
const entangleLive = (live: LiveMode) => (live !== null && !live.onBlur && live.debounce === null ? 'true' : 'false');

const MARKDOWN_TOOLBAR: string[][] = [['bold', 'italic', 'strike', 'link'], ['heading'], ['blockquote', 'codeBlock', 'bulletList', 'orderedList'], ['table'], ['undo', 'redo']];
/**
 * Éditeur Markdown (port de MarkdownEditor, éditeur EasyMDE de Filament). L'état est le texte Markdown brut, à nettoyer avant tout
 * affichage en HTML. Non portés : pièces jointes (le bouton `attachFiles` est absent par défaut) ; en lecture seule (`disabled()`),
 * le texte est affiché échappé, sans conversion Markdown.
 */
export class MarkdownEditor extends Field {
    private _toolbarButtons: (string | string[])[] = MARKDOWN_TOOLBAR;
    private _minHeight: string | null = '10rem';
    private _maxHeight: string | null = null;
    private _placeholder: string | null = null;
    private _live: LiveMode = null;
    static make(name: string): MarkdownEditor { return configured(new MarkdownEditor(name)); }
    /** Boutons de la barre d'outils, en groupes (`[['bold', 'italic'], ['undo', 'redo']]`) ou à plat. */
    toolbarButtons(buttons: (string | string[])[]): this { this._toolbarButtons = buttons; return this; }
    /** Retire des boutons ; sans argument, les retire tous. */
    disableToolbarButtons(names: string[] = []): this {
        this._toolbarButtons = names.length ? this._toolbarButtons.map((group) => (Array.isArray(group) ? group.filter((name) => !names.includes(name)) : group)).filter((group) => (Array.isArray(group) ? group.length > 0 : !names.includes(group))) : [];
        return this;
    }
    disableAllToolbarButtons(condition = true): this { if (condition) this._toolbarButtons = []; return this; }
    /** Ajoute des boutons (dans un groupe à part). */
    enableToolbarButtons(names: string[]): this { this._toolbarButtons = [...this._toolbarButtons, names]; return this; }
    getToolbarButtons(): (string | string[])[] { return this._toolbarButtons; }
    hasToolbarButton(name: string): boolean { return this._toolbarButtons.some((group) => (Array.isArray(group) ? group.includes(name) : group === name)); }
    /** Hauteur minimale de la zone d'édition (`10rem` par défaut). */
    minHeight(height: string | null): this { this._minHeight = cssLength(height); return this; }
    maxHeight(height: string | null): this { this._maxHeight = cssLength(height); return this; }
    placeholder(text: string | null): this { this._placeholder = text; return this; }
    /** L'état est envoyé au serveur au fil de la frappe (`debounce` en millisecondes), ou à la perte de focus avec `onBlur`. */
    live(options: { onBlur?: boolean; debounce?: number | null } = {}): this { this._live = { onBlur: options.onBlur === true, debounce: options.debounce ?? null }; return this; }
    maxLength(length: number): this { return this.rule({ name: 'max', passes: (v) => String(v).length <= length, message: (a) => `The ${a} field must not be greater than ${length} characters.` }); }
    minLength(length: number): this { return this.rule({ name: 'min', passes: (v) => String(v).length >= length, message: (a) => `The ${a} field must be at least ${length} characters.` }); }
    hydrateState(value: unknown): unknown { return typeof value === 'string' ? value : null; }
    async getValidationRules(): Promise<Rule[]> {
        return [...(await super.getValidationRules()), { name: 'string', passes: (v) => typeof v === 'string', message: (a) => `The ${a} field must be a string.` }];
    }
    getExposedMethods(): string[] { return ['getUploadedFileAttachmentTemporaryUrl', 'saveUploadedFileAttachmentAndGetUrl']; }
    getUploadedFileAttachmentTemporaryUrl(): null { return null; }
    saveUploadedFileAttachmentAndGetUrl(): null { return null; }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const accessibility = accessibilityOf(this);
        if (await this.isDisabled()) {
            const state = this.context().state;
            const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, 'aria-describedby': accessibility['aria-describedby'], id, role: 'group', tabindex: this._maxHeight ? '0' : null })
                .style([this._minHeight ? `--min-height: ${this._minHeight}` : null, this._maxHeight ? `--max-height: ${this._maxHeight}` : null])
                .class(['fi-fo-markdown-editor', 'fi-disabled', 'fi-prose']);
            const content = typeof state === 'string' && state.trim() !== ''
                ? state.split(/\n{2,}/).map((paragraph) => `<p>${e(paragraph.trim()).replace(/\n/g, '<br />')}</p>`).join('')
                : `<span class="fi-fo-markdown-editor-placeholder">${e(this._placeholder ?? '')}</span>`;
            return this.wrap(`<div ${attributes.toHtml()}>${content}</div>`, { labelAsDiv: true });
        }
        const tr = (key: string) => t(`filament-forms::components.markdown_editor.${key}`);
        const translations = {
            file_attachments_accepted_file_types_message: tr('file_attachments_accepted_file_types_message'),
            file_attachments_max_size_message: tr('file_attachments_max_size_message'),
            tools: Object.fromEntries(['attach_files', 'blockquote', 'bold', 'bullet_list', 'code_block', 'heading', 'italic', 'link', 'ordered_list', 'redo', 'strike', 'table', 'undo'].map((tool) => [tool, tr(`tools.${tool}`)])),
        };
        const config = `markdownEditorFormComponent({
 canAttachFiles: false,
 isLiveDebounced: ${this._live?.debounce !== null && this._live?.debounce !== undefined ? 'true' : 'false'},
 isLiveOnBlur: ${this._live?.onBlur ? 'true' : 'false'},
 label: ${js(await this.getLabel())},
 liveDebounce: ${js(this._live?.debounce ?? null)},
 maxHeight: ${js(this._maxHeight)},
 minHeight: ${js(this._minHeight)},
 placeholder: ${js(this._placeholder)},
 state: $wire.$entangle(${js(this.getStatePath())}, ${entangleLive(this._live)}),
 toolbarButtons: ${js(this._toolbarButtons)},
 translations: ${js(translations)},
 uploadFileAttachmentUsing: async (file, onSuccess, onError) => {
 return onError()
 },
 })`;
        const wrapper = new Attributes().class(['fi-fo-markdown-editor', 'fi-input-wrp', { 'fi-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><div hidden data-field-accessibility ${new Attributes().merge(accessibility).toHtml()}></div><div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" x-load x-load-src="${e(asset('markdown-editor'))}" x-data="${e(config)}" wire:ignore><textarea x-ref="editor" x-cloak></textarea></div></div></div>`, { labelAsDiv: true });
    }
}

const CODE_LANGUAGES = ['cpp', 'css', 'go', 'html', 'java', 'javascript', 'json', 'markdown', 'php', 'python', 'sql', 'xml', 'yaml'];
/** Éditeur de code (port de CodeEditor, CodeMirror de Filament) : coloration selon `language()`, retour à la ligne avec `wrap()`. */
export class CodeEditor extends Field {
    private _language: string | null = null;
    private _canWrap = false;
    private _live: LiveMode = null;
    static make(name: string): CodeEditor { return configured(new CodeEditor(name)); }
    /** Langage : `cpp`, `css`, `go`, `html`, `java`, `javascript`, `json`, `markdown`, `php`, `python`, `sql`, `xml`, `yaml`. */
    language(language: string | null): this {
        if (language !== null && !CODE_LANGUAGES.includes(language)) throw new Error(`CodeEditor : langage inconnu « ${language} ».`);
        this._language = language;
        return this;
    }
    getLanguage(): string | null { return this._language; }
    /**
     * Retour à la ligne des lignes longues (port de `wrap()`). Appelée avec du HTML, c'est l'enveloppe de champ héritée,
     * que le rendu du composant utilise.
     */
    wrap(condition?: any, options?: any): any {
        if (typeof condition === 'string') return super.wrap(condition, options);
        this._canWrap = condition ?? true;
        return this;
    }
    canWrap(): boolean { return this._canWrap; }
    live(options: { onBlur?: boolean; debounce?: number | null } = {}): this { this._live = { onBlur: options.onBlur === true, debounce: options.debounce ?? null }; return this; }
    hydrateState(value: unknown): unknown { return typeof value === 'string' ? value : value === null || value === undefined ? null : JSON.stringify(value); }
    async getValidationRules(): Promise<Rule[]> {
        return [...(await super.getValidationRules()), { name: 'string', passes: (v) => typeof v === 'string', message: (a) => `The ${a} field must be a string.` }];
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const config = `codeEditorFormComponent({
 canWrap: ${this._canWrap ? 'true' : 'false'},
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isLive: ${this._live !== null ? 'true' : 'false'},
 isLiveDebounced: ${this._live?.debounce !== null && this._live?.debounce !== undefined ? 'true' : 'false'},
 isLiveOnBlur: ${this._live?.onBlur ? 'true' : 'false'},
 label: ${js(await this.getLabel())},
 liveDebounce: ${js(this._live?.debounce ?? null)},
 language: ${js(this._language)},
 state: $wire.$entangle(${js(this.getStatePath())}, ${entangleLive(this._live)}),
 })`;
        // Même empreinte que Filament : md5(serialize([$isDisabled, $language])).
        const hash = createHash('md5').update(`a:2:{i:0;b:${isDisabled ? 1 : 0};i:1;${this._language === null ? 'N;' : `s:${this._language.length}:"${this._language}";`}}`).digest('hex');
        const wrapper = new Attributes().class(['fi-fo-code-editor', 'fi-input-wrp', { 'fi-disabled': isDisabled, 'fi-invalid': this.hasError() }]);
        return super.wrap(`<div ${wrapper.toHtml()}><div class="fi-input-wrp-content-ctn"><div hidden data-field-accessibility ${new Attributes().merge(accessibilityOf(this)).toHtml()}></div><div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" x-load x-load-src="${e(asset('code-editor'))}" x-data="${e(config)}" wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.${hash}"><div x-ref="editor" x-cloak></div></div></div></div>`, { labelAsDiv: true });
    }
}

/**
 * Curseur (port de Slider, noUiSlider de Filament) : une valeur, ou plusieurs poignées quand l'état est une liste (`default([20, 70])`).
 * Obligatoire par défaut, comme dans Filament ; les bornes, le pas et le type numérique sont vérifiés côté serveur.
 */
export class Slider extends Field {
    private _minValue = 0;
    private _maxValue = 100;
    private _step: number | null = null;
    private _minDifference: number | null = null;
    private _maxDifference: number | null = null;
    private _rangePadding: number | [number, number] | null = null;
    private _fillTrack: boolean[] | null = null;
    private _vertical = false;
    private _rtl: boolean | null = null;
    private _behavior: string | string[] | null = 'tap';
    private _tooltips: boolean | RawJs | (boolean | RawJs)[] = false;
    private _pipsMode: string | null = null;
    private _pipsDensity: number | null = null;
    private _pipsFormatter: RawJs | null = null;
    private _pipsValues: number | number[] | null = null;
    private _steppedPips = false;
    private _pipsFilter: RawJs | null = null;
    private _nonLinearPoints: Record<string, number | number[]> | null = null;
    private _decimalPlaces: number | null = null;
    private _live: LiveMode = null;
    constructor(name: string) { super(name); this._required = true; }
    static make(name: string): Slider { return configured(new Slider(name)); }
    range(minValue: number, maxValue: number): this { this._minValue = minValue; this._maxValue = maxValue; return this; }
    minValue(value: number): this { this._minValue = value; return this; }
    maxValue(value: number): this { this._maxValue = value; return this; }
    /** Pas entre deux valeurs ; `1` impose un entier, sinon la valeur doit être un multiple du pas. */
    step(step: number | null): this { this._step = step; return this; }
    /** Écart minimal / maximal entre deux poignées. */
    minDifference(difference: number | null): this { this._minDifference = difference; return this; }
    maxDifference(difference: number | null): this { this._maxDifference = difference; return this; }
    /** Marge interdite aux extrémités : un nombre, ou `[début, fin]`. */
    rangePadding(padding: number | [number, number] | null): this { this._rangePadding = padding; return this; }
    /** Segments colorés de la piste, un booléen par segment (`[true, false]` par défaut). */
    fillTrack(fill: boolean[] | null = [true, false]): this { this._fillTrack = fill; return this; }
    vertical(condition = true): this { this._vertical = condition; return this; }
    /** De droite à gauche (de haut en bas pour un curseur vertical, ce qui est le réglage par défaut en vertical). */
    rtl(condition: boolean | null = true): this { this._rtl = condition; return this; }
    /** Comportement de la poignée (`tap`, `drag`, `fixed`, `snap`, `unconstrained`…) ; `null` : aucun. */
    behavior(behavior: string | string[] | null = null): this { this._behavior = behavior; return this; }
    /** Infobulles sur les poignées : booléen, un booléen par poignée, ou `RawJs` qui formate `$value`. */
    tooltips(tooltips: boolean | RawJs | (boolean | RawJs)[] = true): this { this._tooltips = tooltips; return this; }
    /** Graduations : `range` (par défaut), `steps`, `positions`, `count`, `values`. */
    pips(mode: string | null = 'range', density: number | null = null): this { this._pipsMode = mode; this._pipsDensity = density; return this; }
    pipsMode(mode: string | null): this { this._pipsMode = mode; return this; }
    pipsDensity(density: number | null): this { this._pipsDensity = density; return this; }
    /** Formatage des graduations (`RawJs` qui reçoit `$value`). */
    pipsFormatter(formatter: RawJs | null): this { this._pipsFormatter = formatter; return this; }
    pipsValues(values: number | number[] | null): this { this._pipsValues = values; return this; }
    steppedPips(condition = true): this { this._steppedPips = condition; return this; }
    /** Filtre des graduations (`RawJs` qui reçoit `$value`). */
    pipsFilter(filter: RawJs | null): this { this._pipsFilter = filter; return this; }
    /** Échelle non linéaire (`{ '10%': 500, '50%': 4000 }`). */
    nonLinearPoints(points: Record<string, number | number[]> | null): this { this._nonLinearPoints = points; return this; }
    /** Nombre de décimales de la valeur enregistrée. */
    decimalPlaces(places: number | null): this { this._decimalPlaces = places; return this; }
    live(options: { onBlur?: boolean; debounce?: number | null } = {}): this { this._live = { onBlur: options.onBlur === true, debounce: options.debounce ?? null }; return this; }
    getMinValueWithPadding(): number { const padding = this._rangePadding; return this._minValue + (typeof padding === 'number' ? padding : Array.isArray(padding) ? (padding[0] ?? 0) : 0); }
    getMaxValueWithPadding(): number { const padding = this._rangePadding; return this._maxValue - (typeof padding === 'number' ? padding : Array.isArray(padding) ? (padding[1] ?? 0) : 0); }
    isMultiple(): boolean { return Array.isArray(this.context().state); }
    getDefaultState(): unknown { return this._default ?? this._minValue; }
    private cast(value: unknown): unknown {
        if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Number(value)))) return value;
        const number = Number(value);
        return this._decimalPlaces === null ? number : Number(number.toFixed(this._decimalPlaces));
    }
    hydrateState(value: unknown): unknown { return Array.isArray(value) ? value.map((item) => this.cast(item)) : this.cast(value); }
    dehydrateState(state: unknown): unknown { return Array.isArray(state) ? state.map((item) => this.cast(item)) : this.cast(state); }
    async getValidationRules(): Promise<Rule[]> {
        const min = this.getMinValueWithPadding(), max = this.getMaxValueWithPadding(), step = this._step;
        const isNumber = (v: unknown) => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
        const onStep = (v: unknown) => step === null || (step === 1 ? Number.isInteger(Number(v)) : Math.abs(Number(v) / step - Math.round(Number(v) / step)) < 1e-9);
        const each = (test: (v: unknown) => boolean) => (v: unknown) => (Array.isArray(v) ? v.length > 0 && v.every(test) : test(v));
        return [
            ...(await super.getValidationRules()),
            { name: 'numeric', passes: each(isNumber), message: (a) => `The ${a} field must be a number.` },
            { name: 'min', passes: each((v) => Number(v) >= min), message: (a) => `The ${a} field must be at least ${min}.` },
            { name: 'max', passes: each((v) => Number(v) <= max), message: (a) => `The ${a} field must not be greater than ${max}.` },
            { name: step === 1 ? 'integer' : 'multiple_of', passes: each(onStep), message: (a) => (step === 1 ? `The ${a} field must be an integer.` : `The ${a} field must be a multiple of ${step}.`) },
        ];
    }
    /** Port de convertRawJsExpressionsToFormatterObjects : un `RawJs` devient `{ to: ($value) => … }`. */
    private static formatters(value: boolean | RawJs | (boolean | RawJs)[] | null): string {
        if (value instanceof RawJs) return `{ to: ($value) => ${value.js} }`;
        if (Array.isArray(value)) return `[${value.map((item) => Slider.formatters(item)).join(', ')}]`;
        return js(value);
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const hasTooltips = Array.isArray(this._tooltips) ? this._tooltips.some((tooltip) => tooltip !== false) : this._tooltips !== false;
        const behavior = this._behavior === null || (Array.isArray(this._behavior) && !this._behavior.length) ? 'none' : ([] as string[]).concat(this._behavior).join('-');
        const config = `sliderFormComponent({
 arePipsStepped: ${this._steppedPips ? 'true' : 'false'},
 behavior: ${js(behavior)},
 decimalPlaces: ${js(this._decimalPlaces)},
 fillTrack: ${js(this._fillTrack)},
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isRtl: ${(this._rtl ?? this._vertical) ? 'true' : 'false'},
 isVertical: ${this._vertical ? 'true' : 'false'},
 maxDifference: ${js(this._maxDifference)},
 minDifference: ${js(this._minDifference)},
 maxValue: ${js(this._maxValue)},
 minValue: ${js(this._minValue)},
 nonLinearPoints: ${js(this._nonLinearPoints)},
 pipsDensity: ${js(this._pipsDensity)},
 pipsFilter: ${this._pipsFilter ? `($value) => ${this._pipsFilter.js}` : 'null'},
 pipsFormatter: ${Slider.formatters(this._pipsFormatter)},
 pipsMode: ${js(this._pipsMode)},
 pipsValues: ${js(this._pipsValues)},
 rangePadding: ${js(this._rangePadding)},
 state: $wire.$entangle(${js(this.getStatePath())}, ${this._live !== null ? 'true' : 'false'}),
 step: ${js(this._step)},
 tooltips: ${Slider.formatters(this._tooltips)},
 })`;
        const accessibility = accessibilityOf(this, { withInvalid: !this.isMultiple() });
        const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, id, role: 'group', ...this._extraAttributes })
            .class(['fi-fo-slider', { 'fi-fo-slider-has-pips': this._pipsMode !== null, 'fi-fo-slider-has-tooltips': hasTooltips, 'fi-fo-slider-vertical': this._vertical }]);
        // Même empreinte que Filament : md5(serialize([$isDisabled])).
        const hash = createHash('md5').update(`a:1:{i:0;b:${isDisabled ? 1 : 0};}`).digest('hex');
        return this.wrap(`<div hidden data-field-accessibility ${new Attributes().merge(accessibility).toHtml()}></div><div x-load x-load-src="${e(asset('slider'))}" x-data="${e(config)}" wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.${hash}" ${attributes.toHtml()}></div>`, { labelAsDiv: true });
    }
}

/** Champ caché (port de Hidden) : un `<input type="hidden">` lié à l'état, sans libellé ni place dans la grille. */
export class Hidden extends Field {
    constructor(name: string) { super(name); this._columnSpan = { default: 'hidden' }; }
    static make(name: string): Hidden { return configured(new Hidden(name)); }
    async toHtml(): Promise<string> {
        const attributes = new Attributes().merge({ id: this.getId(), type: 'hidden', 'wire:model': this.getStatePath(), ...this._extraAttributes }).class(['fi-fo-hidden']);
        return `<input ${attributes.toHtml()} />`;
    }
}

/** Code à usage unique (port de OneTimeCodeInput) : une case par chiffre ; l'état est la chaîne de chiffres, de longueur `length()` exactement. */
export class OneTimeCodeInput extends Field {
    private _length = 6;
    private _submitOnCompletion = false;
    private _readOnly = false;
    constructor(name: string) {
        super(name);
        // Comme Filament : `numeric` (et non `integer`, qui refuserait les zéros de tête), puis `digits:<longueur>`.
        this.rule({ name: 'numeric', passes: (v) => /^\d+$/.test(String(v)), message: (a) => `The ${a} field must be a number.` });
        this.rule({ name: 'digits', passes: (v) => new RegExp(`^\\d{${this._length}}$`).test(String(v)), message: (a) => `The ${a} field must be ${this._length} digits.` });
    }
    static make(name: string): OneTimeCodeInput { return configured(new OneTimeCodeInput(name)); }
    /** Nombre de chiffres (6 par défaut). */
    length(length: number): this { this._length = Math.max(1, Math.min(32, Math.floor(length))); return this; }
    getLength(): number { return this._length; }
    /** Soumet le formulaire dès que le dernier chiffre est saisi. */
    submitOnCompletion(condition = true): this { this._submitOnCompletion = condition; return this; }
    readOnly(condition = true): this { this._readOnly = condition; return this; }
    hydrateState(value: unknown): unknown { return value === null || value === undefined ? null : String(value); }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const accessibility = accessibilityOf(this);
        const label = await this.getLabel();
        const container = new Attributes().merge({ ...this._extraAttributes, 'aria-describedby': accessibility['aria-describedby'], 'aria-label': label !== '' ? label : null }).class(['fi-one-time-code-input-ctn']);
        const first = new Attributes().merge({ ...accessibility, autofocus: this._autofocus, disabled: isDisabled, id: this.getId(), readonly: this._readOnly, required: await this.isRequired() }).class(['fi-one-time-code-input-digit']);
        const digit = new Attributes().merge(accessibility);
        const inputs = Array.from({ length: this._length }, (_, index) => (index === 0
            ? `<input autocomplete="one-time-code" inputmode="numeric" type="text" ${first.toHtml()} />`
            : `<input aria-label="${e(t('filament::components/input/one-time-code.aria_label', { position: index + 1, count: this._length }))}" autocomplete="off" inputmode="numeric" type="text" ${digit.toHtml()}${isDisabled ? ' disabled' : ''}${this._readOnly ? ' readonly' : ''} class="fi-one-time-code-input-digit" />`));
        return this.wrap(`<div x-data="${e(`{ code: $wire.$entangle(${js(this.getStatePath())}, false), }`)}"><div x-data="filamentOneTimeCodeInput({ shouldSubmitOnCompletion: ${this._submitOnCompletion ? 'true' : 'false'} })" x-modelable="state" x-model="code" dir="ltr" role="group" ${container.toHtml()}>${inputs.join('')}</div></div>`);
    }
}

/**
 * Texte en lecture seule dans un formulaire (port de Placeholder, déprécié dans Filament au profit de TextEntry avec `state()`).
 * Rien n'est enregistré. Une `HtmlString` est insérée telle quelle.
 */
export class Placeholder extends Component {
    private _label: Lazy<string | null, ComponentContext> = null;
    private _content: Lazy<string | number | HtmlString | null, ComponentContext> = null;
    private _hiddenLabel = false;
    constructor(name: string) { super(); this._name = name; }
    static make(name: string): Placeholder { return configured(new Placeholder(name)); }
    hasStatePath(): boolean { return true; }
    label(label: Lazy<string | null, ComponentContext>): this { this._label = label; return this; }
    hiddenLabel(condition = true): this { this._hiddenLabel = condition; return this; }
    content(content: Lazy<string | number | HtmlString | null, ComponentContext>): this { this._content = content; return this; }
    async toHtml(): Promise<string> {
        const ctx = this.context();
        const label = e((await evaluate(this._label, ctx)) ?? headline(this._name!));
        const content = await evaluate(this._content, ctx);
        const html = content instanceof HtmlString ? content.html : e(content);
        const labelCol = this._hiddenLabel ? `<div class="fi-in-entry-label fi-sr-only" role="term">${label}</div>` : `<div class="fi-in-entry-label-col"><div class="fi-in-entry-label-ctn"><div class="fi-in-entry-label" role="term">${label}</div></div></div>`;
        return `<div class="fi-in-entry">${labelCol}<div class="fi-in-entry-content-col"><div class="fi-in-entry-content-ctn" role="definition"><div class="fi-in-entry-content"><div class="fi-in-text-item fi-size-sm fi-in-text fi-wrapped">${html}</div></div></div></div></div>`;
    }
}

// --- état imbriqué : un champ placé dans un groupe à état (ex. `address.city`) se lit et s'écrit à son chemin relatif au schéma
function relativePath(schema: Schema, field: Field): string[] {
    const base = schema.getStatePath();
    const full = field.getStatePath();
    return (base && full.startsWith(`${base}.`) ? full.slice(base.length + 1) : full).split('.');
}
const readPath = (source: any, segments: string[]): unknown => segments.reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), source);
function writePath(target: Record<string, unknown>, segments: string[], value: unknown): void {
    let node: any = target;
    for (const key of segments.slice(0, -1)) { if (node[key] === null || typeof node[key] !== 'object') node[key] = {}; node = node[key]; }
    node[segments[segments.length - 1]] = value;
}

/** Remplit l'état par défaut de tous les champs d'un schéma (équivalent de `$this->form->fill()`). */
export function fillSchema(schema: Schema, target: Record<string, unknown>): void {
    for (const c of schema.getFlatComponents()) if (c instanceof Field) writePath(target, relativePath(schema, c), c.getDefaultState());
}
/** Remplit l'état du formulaire à partir d'un enregistrement, champ par champ (équivalent de `$this->form->fill($record->attributesToArray())`). */
export function fillSchemaFromRecord(schema: Schema, target: Record<string, unknown>, record: Record<string, unknown>): void {
    for (const c of schema.getFlatComponents()) {
        if (!(c instanceof Field)) continue;
        const segments = relativePath(schema, c);
        writePath(target, segments, c.hydrateState(readPath(record, segments) ?? c.getDefaultState()));
    }
}
/** Valide tous les champs visibles d'un schéma ; retourne les erreurs par chemin d'état. */
export async function validateSchema(schema: Schema): Promise<Record<string, string[]>> {
    const errors: Record<string, string[]> = {};
    for (const c of await schema.getVisibleFlatComponents()) {
        if (!(c instanceof Field)) continue;
        const messages = await c.validate();
        if (messages.length) errors[c.getStatePath()] = messages;
    }
    return errors;
}

/** État à enregistrer : seulement les champs déclarés, visibles et « déshydratés » ; une chaîne vide vaut `null` (comme Laravel). */
export async function getSchemaState(schema: Schema): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};
    const fields: Field[] = [];
    for (const c of await schema.getVisibleFlatComponents()) {
        if (!(c instanceof Field) || !(await c.isDehydrated())) continue;
        const state = await c.dehydrateState(c.context().state);
        writePath(data, relativePath(schema, c), state === '' || state === undefined ? null : state);
        fields.push(c);
    }
    // Du plus profond au moins profond : un conteneur voit ses enfants déjà mis en forme.
    for (const c of fields.reverse()) {
        const path = relativePath(schema, c);
        const current = readPath(data, path);
        const final = c.finalizeDehydratedState(current);
        if (final !== current) writePath(data, path, final);
    }
    return data;
}

// ------------------------------------------------------------------ assistant par étapes
type StepHook = (ctx: ComponentContext) => void | Promise<void>;
/** Lancée depuis `beforeValidation` / `afterValidation` d'une étape pour rester sur l'étape courante (équivalent de l'exception `Halt` de Filament). */
export class Halt extends Error { constructor() { super('Halt'); } }

/** Une étape d'un assistant : un titre, une description et une icône facultatives, son propre schéma (port de Wizard\Step). */
export class Step extends Component {
    private children: Component[] = [];
    private _columns: Record<string, number> | number | null = {};
    private label: string;
    private _description: string | null = null;
    private _icon: string | null = null;
    private _completedIcon: string | null = null;
    private _beforeValidation: StepHook | null = null;
    private _afterValidation: StepHook | null = null;
    constructor(label: string) { super(); this.label = label; this._keyName = `${slug(label)}::data::wizard-step`; }
    static make(label: string): Step { return configured(new Step(label)); }
    schema(components: Component[]): this { this.children = components; return this; }
    columns(columns: Record<string, number> | number | null = 2): this { this._columns = columns; return this; }
    description(description: string | null): this { this._description = description; return this; }
    icon(name: string | null): this { this._icon = name; return this; }
    completedIcon(name: string | null): this { this._completedIcon = name; return this; }
    /** Avant la validation de l'étape, au clic sur « Next » ; lever `Halt` pour rester sur l'étape. */
    beforeValidation(callback: StepHook | null): this { this._beforeValidation = callback; return this; }
    /** Après une validation réussie, avant de passer à l'étape suivante ; lever `Halt` pour rester sur l'étape. */
    afterValidation(callback: StepHook | null): this { this._afterValidation = callback; return this; }
    getLabel(): string { return this.label; }
    getDescription(): string | null { return this._description; }
    getIcon(): string | null { return this._icon; }
    getCompletedIcon(): string | null { return this._completedIcon; }
    async callBeforeValidation(): Promise<void> { await this._beforeValidation?.(this.context()); }
    async callAfterValidation(): Promise<void> { await this._afterValidation?.(this.context()); }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children).columns(this._columns)]; }
    async toHtml(): Promise<string> { return this.getChildSchemas()[0].toHtml(); }
    /** Panneau de l'étape : un `<form>` quand l'assistant sait quoi soumettre (Entrée passe à l'étape suivante, ou enregistre à la dernière). */
    async toStepHtml(submitHandler: string | null, hasHeader: boolean): Promise<string> {
        const key = this.getKey()!;
        const tag = submitHandler ? 'form' : 'div';
        const attributes = new Attributes().merge({
            'aria-labelledby': hasHeader ? `${key}-tab` : null,
            'aria-label': hasHeader ? null : this.label,
            id: key,
            role: 'group',
            'x-data': `filamentSchemaComponent(${js(this.getAlpineScopeConfiguration())})`,
        }).class(['fi-sc-wizard-step']);
        return `<${tag} x-bind:tabindex="$el.querySelector('[autofocus]') ? '-1' : '0'" x-bind:class="{
                'fi-active': step === ${e(js(key))},
            }" x-on:expand="
                if (! isStepAccessible(${e(js(key))})) {
                    return
                }

                step = ${e(js(key))}            "${submitHandler ? ` x-on:submit.prevent="isLastStep() ? ${e(submitHandler)} : requestNextStep()"` : ''} x-cloak x-ref="step-${e(key)}" ${attributes.toHtml()}>${await this.toHtml()}${submitHandler ? '<input type="submit" hidden />' : ''}</${tag}>`;
    }
}

/**
 * Assistant par étapes (port de Wizard) : toutes les étapes sont rendues, le navigateur n'affiche que l'étape courante.
 * « Next » valide l'étape courante côté serveur avant d'avancer, sauf si l'assistant est `skippable()`.
 */
export class Wizard extends Component {
    private steps: Step[];
    private _label: string | null = null;
    private _skippable = false;
    private _startStep = 1;
    private _contained = true;
    private _headerHidden = false;
    private _cancelAction: Action | null = null;
    private _submitAction: Action | null = null;
    private _alpineSubmitHandler: string | null = null;
    private _stepQueryStringKey: string | null = null;
    private _modifyNext: ((action: Action) => Action | void) | null = null;
    private _modifyPrevious: ((action: Action) => Action | void) | null = null;
    constructor(steps: Step[] = []) { super(); this.steps = steps; }
    static make(steps: Step[] = []): Wizard { return configured(new Wizard(steps)); }
    schema(steps: Step[]): this { this.steps = steps; return this; }
    label(label: string | null): this { this._label = label; return this; }
    /** Étapes accessibles dans n'importe quel ordre, sans validation au passage. */
    skippable(condition = true): this { this._skippable = condition; return this; }
    /** Étape affichée à l'ouverture (à partir de 1). */
    startOnStep(step: number): this { this._startStep = step; return this; }
    /** Faux : sans carte autour de l'assistant (c'est le cas sur une page de resource). */
    contained(condition = true): this { this._contained = condition; return this; }
    hiddenHeader(condition = true): this { this._headerHidden = condition; return this; }
    /** Action affichée à la place de « Back » sur la première étape. */
    cancelAction(action: Action | null): this { this._cancelAction = action; return this; }
    /** Action affichée à la place de « Next » sur la dernière étape. */
    submitAction(action: Action | null): this { this._submitAction = action; return this; }
    /** Expression Alpine exécutée quand la dernière étape est soumise au clavier (ex. `$wire.create()`). */
    alpineSubmitHandler(handler: string | null): this { this._alpineSubmitHandler = handler; return this; }
    /** Garde l'étape courante dans l'adresse (`?step=…`). */
    persistStepInQueryString(key: string | null = 'step'): this { this._stepQueryStringKey = key; return this; }
    nextAction(modify: ((action: Action) => Action | void) | null): this { this._modifyNext = modify; return this; }
    previousAction(modify: ((action: Action) => Action | void) | null): this { this._modifyPrevious = modify; return this; }

    getKey(): string {
        const statePath = this.container.getStatePath();
        const own = statePath ? `${statePath}::wizard` : 'wizard';
        return `${this.container.getKey()}.${this._label ? `${slug(this._label)}::${own}` : own}`;
    }
    getExposedMethods(): string[] { return ['nextStep', 'previousStep']; }
    /** « Next » redessine le composant : les erreurs de validation de l'étape doivent apparaître. */
    isRenderlessMethod(): boolean { return false; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.steps)]; }
    private getSteps(): Step[] { this.getChildSchemas(); return this.steps; }

    /** Appelée par le navigateur au clic sur « Next » : valide l'étape courante, puis annonce l'étape suivante. */
    async nextStep(currentStepIndex: unknown = null, currentStepKey: unknown = null): Promise<void> {
        const steps = this.getSteps();
        if (!Number.isInteger(currentStepIndex) || (currentStepIndex as number) < 0 || (currentStepIndex as number) >= steps.length - 1) return;
        const current = steps[currentStepIndex as number];
        if (currentStepKey !== null && current.getKey() !== currentStepKey) return;
        const livewire = this.livewire as any;
        if (!this._skippable) {
            try {
                await current.callBeforeValidation();
                const errors = await validateSchema(current.getChildSchemas()[0]);
                livewire._errors = errors;
                if (Object.keys(errors).length) { livewire.dispatch('form-validation-error', { livewireId: livewire.id }); return; }
                await current.callAfterValidation();
            } catch (error) {
                if (error instanceof Halt) return;
                throw error;
            }
        }
        livewire.dispatch('next-wizard-step', { key: this.getKey(), step: steps[(currentStepIndex as number) + 1].getKey(), currentStep: current.getKey() });
    }
    /** Le retour en arrière se fait dans le navigateur ; la méthode existe pour le contrat de Filament. */
    previousStep(): void {}

    async toHtml(): Promise<string> {
        const steps = this.getSteps();
        const key = this.getKey();
        const ctx = this.context();
        const tr = (name: string) => t(`filament-schemas::components.wizard.${name}`);
        const previous = Action.make('previous').label(tr('actions.previous_step.label')).color('gray');
        const previousAction = this._modifyPrevious?.(previous) ?? previous;
        const next = Action.make('next').label(tr('actions.next_step.label')).iconPosition('after');
        if (steps.length > 1) next.livewireTarget(steps.slice(0, -1).map((step, index) => `callSchemaComponentMethod(${js(key)}, 'nextStep', ${js({ currentStepIndex: index, currentStepKey: step.getKey() })})`).join(', '));
        const nextAction = this._modifyNext?.(next) ?? next;
        const [previousDisabled, nextDisabled] = [await previousAction.isDisabled(ctx), await nextAction.isDisabled(ctx)];
        const visibleKeys: string[] = [];
        for (const step of steps) if (await step.isVisible()) visibleKeys.push(step.getKey()!);

        const header: string[] = [];
        steps.forEach((step, index) => {
            const stepKey = step.getKey()!;
            const shown = new Attributes({ 'x-cloak': 'x-cloak', 'x-show': `getStepIndex(step) <= ${index}` });
            const stepIcon = step.getIcon()
                ? icon(step.getIcon()!, { size: 'lg', attributes: shown })
                : `<span x-show="getStepIndex(step) &lt;= ${index}" aria-hidden="true" class="fi-sc-wizard-header-step-number">${String(index + 1).padStart(2, '0')}</span>`;
            header.push(`<li class="fi-sc-wizard-header-step" x-bind:class="{
                                'fi-active': getStepIndex(step) === ${index},
                                'fi-completed': getStepIndex(step) &gt; ${index},
                            }"><button type="button" id="${e(stepKey)}-tab" aria-controls="${e(stepKey)}" x-bind:aria-current="getStepIndex(step) === ${index} ? 'step' : null" x-on:click="step = ${e(js(stepKey))}" x-bind:disabled="! isStepAccessible(${e(js(stepKey))}) || ${previousDisabled ? 'true' : 'false'}" class="fi-sc-wizard-header-step-btn"><div class="fi-sc-wizard-header-step-icon-ctn">${icon(step.getCompletedIcon() ?? 'o-check', { size: 'lg', attributes: new Attributes({ 'x-cloak': 'x-cloak', 'x-show': `getStepIndex(step) > ${index}` }) })}${stepIcon}</div><div class="fi-sc-wizard-header-step-text"><span class="fi-sc-wizard-header-step-label">${e(step.getLabel())}</span>${step.getDescription() ? `<span class="fi-sc-wizard-header-step-description">${e(step.getDescription()!)}</span>` : ''}<span class="fi-sr-only" x-text="getStepIndex(step) &gt; ${index} ? ${e(js(tr('header.step.statuses.completed')))} : (getStepIndex(step) === ${index} ? '' : ${e(js(tr('header.step.statuses.upcoming')))})"></span></div></button>${index < steps.length - 1 ? '<svg fill="none" preserveAspectRatio="none" viewBox="0 0 22 80" aria-hidden="true" class="fi-sc-wizard-header-step-separator"><path d="M0 -2L20 40L0 82" stroke-linejoin="round" stroke="currentcolor" vector-effect="non-scaling-stroke"></path></svg>' : ''}</li>`);
        });
        const panels: string[] = [];
        for (const step of steps) panels.push(await step.toStepHtml(this._alpineSubmitHandler, !this._headerHidden));

        const outer = new Attributes().merge({ id: key }).class(['fi-sc-wizard', { 'fi-contained': this._contained, 'fi-sc-wizard-header-hidden': this._headerHidden }]);
        return `<div x-load x-load-src="${e(views.render('filament-schemas::asset', { path: 'wizard' }).trim())}" x-data="wizardSchemaComponent({
                        isSkippable: ${this._skippable ? 'true' : 'false'},
                        isStepPersistedInQueryString: ${this._stepQueryStringKey ? 'true' : 'false'},
                        livewireId: ${e(js(this.livewire.id))},
                        schemaKey: ${e(js(this.container.getKey().split('.')[0]))},
                        startStep: ${this._startStep},
                        stepQueryStringKey: ${e(js(this._stepQueryStringKey))},
                    })" x-on:next-wizard-step.window="${e(`if ($event.detail.key === ${js(key)}) goToNextStep($event.detail.step, $event.detail.currentStep)`)}" x-on:go-to-wizard-step.window="${e(`$event.detail.key === ${js(key)} && goToStep($event.detail.step)`)}" wire:ignore.self ${outer.toHtml()}><input type="hidden" value="${e(JSON.stringify(visibleKeys))}" x-ref="stepsData" />${this._headerHidden ? '' : `<ol${this._label ? ` aria-label="${e(this._label)}"` : ''} role="list" x-cloak x-ref="header" class="fi-sc-wizard-header">${header.join('')}</ol>`}${panels.join('')}<div x-cloak class="fi-sc-wizard-footer"><div x-cloak${previousDisabled ? '' : ' x-on:click="goToPreviousStep"'} x-show="! isFirstStep()">${await previousAction.toHtml(ctx)}</div><div x-show="isFirstStep()">${this._cancelAction ? await this._cancelAction.toHtml(ctx) : ''}</div><div x-cloak${nextDisabled ? '' : ` x-on:click.capture="if ($el.hasAttribute('aria-disabled')) { $event.preventDefault(); $event.stopImmediatePropagation() }" x-on:click="if (! $el.hasAttribute('aria-disabled')) requestNextStep()"`} x-bind:class="{ 'fi-hidden': isLastStep() }" wire:loading.attr="aria-disabled">${await nextAction.toHtml(ctx)}</div><div x-bind:class="{ 'fi-hidden': ! isLastStep() }">${this._submitAction ? await this._submitAction.toHtml(ctx) : ''}</div></div></div>`;
    }
}

// ------------------------------------------------------------------ téléversement de fichiers
/** Fichier temporaire reçu par le runtime (voir @navette/wire). */
export type TemporaryUpload = { id: string; path: string; name: string; type: string; size: number; extension: string };
export type UploadedFileInfo = { name: string; size: number; type: string; url: string };
/** Élément de l'état enregistré quand le champ ne stocke pas lui-même (`storeFiles(false)`) : fichier déjà enregistré, ou fichier temporaire à traiter. */
export type FileUploadEntry = { key: string } | { file: TemporaryUpload };
/** Où vont les fichiers une fois le formulaire enregistré. */
export interface FileStorage {
    /** Enregistre un fichier temporaire et rend sa clé (chemin relatif). */
    store(file: TemporaryUpload, directory: string | null): Promise<string>;
    info(key: string): Promise<UploadedFileInfo | null>;
}
/** Stockage sur le disque local, servi sous une adresse publique. Le nom du fichier est aléatoire, son extension vient du type détecté. */
export class LocalFileStorage implements FileStorage {
    private root: string;
    private baseUrl: string;
    constructor(root: string, baseUrl: string) { this.root = root; this.baseUrl = baseUrl.replace(/\/$/, ''); }
    private resolve(key: string): string | null {
        if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,250}$/.test(key) || key.split('/').some((part) => part === '..' || part === '.')) return null;
        return nodePath.join(this.root, ...key.split('/'));
    }
    async store(file: TemporaryUpload, directory: string | null): Promise<string> {
        const key = [directory, `${randomUUID()}.${file.extension}`].filter(Boolean).join('/');
        const target = this.resolve(key);
        if (!target) throw new Error('Dossier de téléversement invalide.');
        mkdirSync(nodePath.dirname(target), { recursive: true });
        copyFileSync(file.path, target);
        writeFileSync(`${target}.meta.json`, JSON.stringify({ name: file.name, type: file.type }));
        return key;
    }
    async info(key: string): Promise<UploadedFileInfo | null> {
        const target = this.resolve(key);
        if (!target || !existsSync(target)) return null;
        let meta: { name?: string; type?: string } = {};
        try { meta = JSON.parse(readFileSync(`${target}.meta.json`, 'utf8')); } catch { /* fichier déposé sans métadonnées */ }
        return { name: meta.name ?? nodePath.basename(key), size: statSync(target).size, type: meta.type ?? 'application/octet-stream', url: `${this.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}` };
    }
}

/**
 * Téléversement de fichiers (port de FileUpload, rendu FilePond de Filament).
 * État : `{ <clé de fichier>: <clé enregistrée> | 'livewire-file:<id temporaire>' }`. Une clé enregistrée n'est acceptée du navigateur
 * que si elle figure déjà dans l'enregistrement en cours d'édition : on ne peut pas s'attribuer le fichier d'un autre.
 */
export class FileUpload extends Field {
    /** Stockage par défaut de l'application. */
    static storage: FileStorage | null = null;
    private _multiple = false;
    private _maxFiles: number | null = null;
    private _maxSize: number | null = null;
    private _reorderable = false;
    private _acceptedFileTypes: string[] | null = null;
    private _directory: string | null = null;
    private _storeFiles = true;
    private _storage: FileStorage | null = null;
    private _getUploadedFileUsing: ((key: string, ctx: ComponentContext) => UploadedFileInfo | null | Promise<UploadedFileInfo | null>) | null = null;
    static make(name: string): FileUpload { return configured(new FileUpload(name)); }
    multiple(condition = true): this { this._multiple = condition; return this; }
    maxFiles(count: number | null): this { this._maxFiles = count; return this; }
    /** Taille maximale d'un fichier, en kilo-octets. */
    maxSize(kilobytes: number | null): this { this._maxSize = kilobytes; return this; }
    reorderable(condition = true): this { this._reorderable = condition; return this; }
    /** Types MIME acceptés (`image/jpeg`, `image/*`…), vérifiés sur le contenu du fichier reçu. */
    acceptedFileTypes(types: string[] | null): this { this._acceptedFileTypes = types; return this; }
    image(): this { return this.acceptedFileTypes(['image/*']); }
    directory(directory: string | null): this { this._directory = directory; return this; }
    storage(storage: FileStorage): this { this._storage = storage; return this; }
    /** `false` : le champ n'enregistre rien lui-même ; les données reçoivent des `FileUploadEntry`, à traiter par l'adaptateur (médias). */
    storeFiles(condition = true): this { this._storeFiles = condition; return this; }
    /** Informations d'un fichier déjà enregistré (nom, taille, type, adresse), quand elles ne viennent pas du stockage. */
    getUploadedFileUsing(resolver: (key: string, ctx: ComponentContext) => UploadedFileInfo | null | Promise<UploadedFileInfo | null>): this { this._getUploadedFileUsing = resolver; return this; }

    getDefaultState(): unknown { return {}; }
    hydrateState(value: unknown): unknown {
        const keys = Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : typeof value === 'object' ? Object.values(value as object) : [value];
        return Object.fromEntries(keys.filter((key) => typeof key === 'string' || typeof key === 'number').map((key) => [randomUUID(), String(key)]));
    }
    private get uploads(): { resolve(value: unknown): TemporaryUpload | null; remove(id: string): void } | null { return (this.livewire as any)._runtime?.uploads ?? null; }
    private getStorage(): FileStorage | null { return this._storage ?? FileUpload.storage; }
    /** Entrées de l'état, nettoyées : clé de fichier sûre, valeur chaîne. */
    private entries(): [string, string][] {
        const state = this.context().state;
        if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
        return Object.entries(state as Record<string, unknown>).filter(([key, value]) => /^[A-Za-z0-9-]{1,64}$/.test(key) && typeof value === 'string').map(([key, value]): [string, string] => [key, value as string]).slice(0, 100);
    }
    /** Clés enregistrées que l'enregistrement en cours possède déjà : les seules qu'on accepte de relire depuis le navigateur. */
    private originalKeys(): Set<string> {
        const record = this.container.getRecord() as Record<string, unknown> | null;
        return new Set(Object.values(this.hydrateState(record?.[this.getName()]) as Record<string, string>));
    }
    private isTemporary(value: string): boolean { return value.startsWith('livewire-file:'); }

    // --- méthodes exposées au JavaScript du champ
    getExposedMethods(): string[] { return ['deleteUploadedFile', 'removeUploadedFile', 'reorderUploadedFiles', 'getUploadedFiles']; }
    async getUploadedFiles(): Promise<Record<string, UploadedFileInfo | null>> {
        const original = this.originalKeys();
        const files: Record<string, UploadedFileInfo | null> = {};
        for (const [fileKey, value] of this.entries()) {
            if (this.isTemporary(value) || !original.has(value)) { files[fileKey] = null; continue; }
            const info = this._getUploadedFileUsing ? await this._getUploadedFileUsing(value, this.context()) : await this.getStorage()?.info(value);
            // Seules des adresses locales ou http(s) partent vers le navigateur.
            files[fileKey] = info && /^(\/(?!\/)|https?:\/\/)/.test(info.url) ? info : null;
        }
        return files;
    }
    private writeState(entries: [string, string][]): void { writePath(this.livewire as any, this.getStatePath().split('.'), Object.fromEntries(entries)); }
    /** Retire un fichier du champ. Le fichier enregistré n'est supprimé qu'à l'enregistrement du formulaire, par l'application. */
    removeUploadedFile(fileKey: unknown): void {
        const removed = this.entries().find(([key]) => key === fileKey);
        if (removed && this.isTemporary(removed[1])) this.uploads?.remove(removed[1].slice('livewire-file:'.length));
        this.writeState(this.entries().filter(([key]) => key !== fileKey));
    }
    deleteUploadedFile(fileKey: unknown): void { this.removeUploadedFile(fileKey); }
    reorderUploadedFiles(fileKeys: unknown): void {
        if (!this._reorderable || !Array.isArray(fileKeys)) return;
        const entries = new Map(this.entries());
        const ordered = fileKeys.map(String).filter((key) => entries.has(key));
        this.writeState([...ordered.map((key): [string, string] => [key, entries.get(key)!]), ...[...entries].filter(([key]) => !ordered.includes(key))]);
    }

    async getValidationRules(): Promise<Rule[]> {
        const entries = () => this.entries();
        const temporary = () => entries().filter(([, value]) => this.isTemporary(value)).map(([, value]) => this.uploads?.resolve(value) ?? null);
        const accepts = (type: string) => (this._acceptedFileTypes ?? []).some((accepted) => accepted === type || (accepted.endsWith('/*') && type.startsWith(accepted.slice(0, -1))));
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: () => entries().length > 0, message: (a) => `The ${a} field is required.` });
        rules.push({ name: 'file', passes: () => temporary().every((file) => file !== null), message: (a) => `The ${a} field must be a file.` });
        if (!this._multiple) rules.push({ name: 'max_files', passes: () => entries().length <= 1, message: (a) => `The ${a} field must not have more than 1 items.` });
        if (this._maxFiles !== null) rules.push({ name: 'max_files', passes: () => entries().length <= this._maxFiles!, message: (a) => `The ${a} field must not have more than ${this._maxFiles} items.` });
        if (this._acceptedFileTypes) rules.push({ name: 'mimetypes', passes: () => temporary().every((file) => file !== null && accepts(file.type)), message: (a) => `The ${a} field must be a file of type: ${this._acceptedFileTypes!.join(', ')}.` });
        if (this._maxSize !== null) rules.push({ name: 'max', passes: () => temporary().every((file) => file !== null && file.size <= this._maxSize! * 1024), message: (a) => `The ${a} field must not be greater than ${this._maxSize} kilobytes.` });
        return rules;
    }
    /** La validation porte sur l'état entier, même vide (un champ obligatoire sans fichier doit échouer). */
    async validate(): Promise<string[]> {
        if (!(await this.isDehydrated())) return [];
        const attribute = (await this.getLabel()).toLowerCase();
        for (const rule of await this.getValidationRules()) if (!(await rule.passes(this.context().state, this.context()))) return [rule.message(attribute)];
        return [];
    }
    /** À l'enregistrement : les fichiers temporaires sont stockés, les clés existantes non reconnues sont écartées. */
    async dehydrateState(): Promise<unknown> {
        const original = this.originalKeys();
        const out: (string | FileUploadEntry)[] = [];
        for (const [, value] of this.entries()) {
            if (this.isTemporary(value)) {
                const file = this.uploads?.resolve(value);
                if (!file) continue;
                if (!this._storeFiles) { out.push({ file }); continue; }
                const storage = this.getStorage();
                if (!storage) throw new Error('FileUpload : aucun stockage configuré (FileUpload.storage).');
                out.push(await storage.store(file, this._directory));
                this.uploads?.remove(file.id);
            } else if (original.has(value)) out.push(this._storeFiles ? value : { key: value });
        }
        return this._multiple ? out : (out[0] ?? null);
    }

    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const id = this.getId();
        const label = (await this.getLabel()).toLowerCase();
        const tr = (key: string) => t(`filament-forms::components.file_upload.${key}`);
        const config = `fileUploadFormComponent({
 acceptedFileTypes: ${this._acceptedFileTypes ? js(this._acceptedFileTypes) : 'null'},
 automaticallyCropImagesAspectRatio: null,
 automaticallyOpenImageEditorForAspectRatio: null,
 automaticallyResizeImagesMode: null,
 automaticallyResizeImagesHeight: null,
 automaticallyResizeImagesWidth: null,
 canEditSvgs: true,
 confirmSvgEditingMessage: ${js(tr('editor.svg.messages.confirmation'))},
 disabledSvgEditingMessage: ${js(tr('editor.svg.messages.disabled'))},
 hasCircleCropper: false,
 hasImageEditor: false,
 imageEditorEmptyFillColor: null,
 imageEditorMode: 1,
 imageEditorViewportHeight: null,
 imageEditorViewportWidth: null,
 imagePreviewHeight: null,
 isAvatar: false,
 isDeletable: true,
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isDownloadable: false,
 isImageEditorExplicitlyEnabled: false,
 isMultiple: ${this._multiple ? 'true' : 'false'},
 isOpenable: false,
 isPasteable: true,
 isPreviewable: true,
 isReorderable: ${this._reorderable ? 'true' : 'false'},
 isSvgEditingConfirmed: false,
 itemPanelAspectRatio: null,
 loadingIndicatorPosition: 'right',
 locale: 'en',
 maxFiles: ${this._maxFiles ?? 'null'},
 maxFilesValidationMessage: ${this._maxFiles !== null ? js(`The ${label} field must not have more than ${this._maxFiles} items.`) : 'null'},
 maxParallelUploads: null,
 maxSize: ${this._maxSize !== null ? js(`${this._maxSize}KB`) : 'null'},
 mimeTypeMap: [],
 minSize: null,
 panelAspectRatio: null,
 panelLayout: 'compact',
 placeholder: null,
 removeUploadedFileButtonPosition: 'left',
 shouldAppendFiles: false,
 shouldAutomaticallyUpscaleImagesWhenResizing: true,
 shouldOrientImageFromExif: true,
 shouldTransformImage: false,
 state: $wire.$entangle(${js(this.getStatePath())}, false),
 statePath: ${js(this.getStatePath())},
 uploadButtonPosition: 'right',
 uploadingMessage: ${js(t('filament::components/button.messages.uploading_file'))},
 downloadActionLabel: ${js(tr('actions.download.label'))},
 openActionLabel: ${js(tr('actions.open.label'))},
 uploadProgressIndicatorPosition: 'right',
 })`;
        const key = `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify([this._acceptedFileTypes, this._maxFiles, this._multiple, isDisabled])).digest('hex')}`;
        const input = new Attributes().merge({ 'x-ref': 'input', 'aria-labelledby': `${id}-label`, disabled: isDisabled, multiple: this._multiple ? 'multiple' : null, type: 'file' });
        return this.wrap(`<div hidden data-field-accessibility data-preserve-filepond-description></div><div x-load x-load-src="${e(asset('file-upload'))}" x-data="${e(config)}" wire:ignore wire:key="${e(key)}" aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" class="fi-fo-file-upload fi-align-start"><div class="fi-fo-file-upload-input-ctn"><input ${input.toHtml()} /></div><div x-show="error" x-text="error" x-cloak role="alert" class="fi-fo-file-upload-error-message"></div></div>`, { labelAsDiv: true });
    }
}
