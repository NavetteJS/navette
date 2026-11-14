// Field base: label, helper text, hint, content slots, extra attributes, saving options and the field wrapper markup.
// `Field` (index.ts) adds the state shaping and the validation rules.
import { HtmlString, cls, e, evaluate, js, views, type Lazy } from '@navette-js/support';
import { Component, Icon as SchemaIcon, JsContent, Text, renderInlineItems, renderSlot, resolveAttributeEntries, type ComponentContext, type ComponentSlot, type InlineItem } from '@navette-js/schemas';
import type { Action } from '@navette-js/actions';

const headline = (s: string) => s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ (.)/g, (_, c) => ' ' + c.toLowerCase());
/** Text of an HTML label (for validation messages and accessible names). */
const textOf = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').trim();
type AttributeEntry = Record<string, string> | ((ctx: ComponentContext) => Record<string, string>);
export type FieldSlotName = 'aboveLabel' | 'beforeLabel' | 'afterLabel' | 'belowLabel' | 'aboveContent' | 'beforeContent' | 'afterContent' | 'belowContent' | 'aboveErrorMessage' | 'belowErrorMessage';
export type StateCallback = (ctx: ComponentContext) => unknown;
export type ValidationMessage = string | ((attribute: string, ctx: ComponentContext) => string);

export abstract class FieldBase extends Component {
    protected _label: Lazy<string | HtmlString | null, ComponentContext> = null;
    protected _hiddenLabel: Lazy<boolean, ComponentContext> = false;
    protected _helperText: Lazy<string | HtmlString | null, ComponentContext> = null;
    protected _autofocus: Lazy<boolean, ComponentContext> = false;
    protected _default: unknown = null;
    protected _dehydrated: Lazy<boolean, ComponentContext> | null = null;
    protected _validatedWhenNotDehydrated: Lazy<boolean, ComponentContext> = true;
    protected _markedAsRequired: Lazy<boolean, ComponentContext> | null = null;
    protected _validationAttribute: Lazy<string | null, ComponentContext> = null;
    protected _validationMessages: Record<string, ValidationMessage> = {};
    protected _allowHtmlValidationMessages: Lazy<boolean, ComponentContext> = false;
    protected _slots: Partial<Record<FieldSlotName, ComponentSlot>> = {};
    private _extraInputAttributeEntries: AttributeEntry[] = [];
    private _extraFieldWrapperAttributeEntries: AttributeEntry[] = [];
    private _extraAlpineAttributeEntries: AttributeEntry[] = [];
    protected _dehydrateStateUsing: StateCallback | null = null;
    protected _mutateDehydratedStateUsing: StateCallback | null = null;
    protected _beforeStateDehydrated: ((ctx: ComponentContext) => unknown) | null = null;
    protected _mutateStateForValidationUsing: StateCallback | null = null;

    abstract getId(): string;
    abstract isRequired(): Promise<boolean>;

    /** Label: a string, an `HtmlString` or `JsContent` (computed in the browser), or a function returning one. */
    label(label: Lazy<string | HtmlString | null, ComponentContext>): this { this._label = label; return this; }
    /** Keeps the label for screen readers only. */
    hiddenLabel(condition: Lazy<boolean, ComponentContext> = true): this { this._hiddenLabel = condition; return this; }
    async isLabelHidden(): Promise<boolean> { return Boolean(await evaluate(this._hiddenLabel, this.context())); }
    /** Focuses the field when the form is loaded. */
    autofocus(condition: Lazy<boolean, ComponentContext> = true): this { this._autofocus = condition; return this; }
    async isAutofocused(): Promise<boolean> { return Boolean(await evaluate(this._autofocus, this.context())); }
    /** State of the field when the form is filled without a record: a value, or a (synchronous) function of the context. */
    default(value: unknown): this { this._default = value; return this; }
    /** The default value, a function being called with the field context. */
    protected resolvedDefault(): unknown {
        if (typeof this._default !== 'function') return this._default;
        try { return (this._default as (ctx: ComponentContext) => unknown)(this.context()); } catch { return (this._default as () => unknown)(); }
    }
    /** Helper text shown under the field, linked to the control through `aria-describedby`. A function may return it. */
    helperText(text: Lazy<string | HtmlString | null, ComponentContext>): this { this._helperText = text; return this; }
    /** Helper text id, linked to the control through `aria-describedby`. */
    protected getHelperTextId(): string | null { return this._helperText !== null ? `${this.getId()}-helper-text` : null; }
    /** Ids describing the control: the helper text and the validation error. */
    getDescriptionIds(): string[] { return [this.getHelperTextId(), this.hasError() ? `${this.getId()}-error` : null].filter((id): id is string => id !== null); }

    // ---------------------------------------------------------------- content slots
    /** Text, components or actions above the label. Strings are escaped. */
    aboveLabel(content: ComponentSlot): this { this._slots.aboveLabel = content; return this; }
    /** Text, components or actions before the label. */
    beforeLabel(content: ComponentSlot): this { this._slots.beforeLabel = content; return this; }
    /** Text, components or actions after the label, aligned to the end (`Schema.start([...])` aligns them to the start). Replaces the hint. */
    afterLabel(content: ComponentSlot): this { this._slots.afterLabel = content; return this; }
    /** Text, components or actions below the label (in the label column, with an inline label). */
    belowLabel(content: ComponentSlot): this { this._slots.belowLabel = content; return this; }
    /** Text, components or actions above the control (in the content column, with an inline label). */
    aboveContent(content: ComponentSlot): this { this._slots.aboveContent = content; return this; }
    /** Text, components or actions before the control, on the same line. */
    beforeContent(content: ComponentSlot): this { this._slots.beforeContent = content; return this; }
    /** Text, components or actions after the control, on the same line, aligned to the end. */
    afterContent(content: ComponentSlot): this { this._slots.afterContent = content; return this; }
    /** Text, components or actions under the control (after the helper text). Strings are escaped. */
    belowContent(content: ComponentSlot): this { this._slots.belowContent = content; return this; }
    /** Text, components or actions above the validation error message (shown only with an error). */
    aboveErrorMessage(content: ComponentSlot): this { this._slots.aboveErrorMessage = content; return this; }
    /** Text, components or actions below the validation error message (shown only with an error). */
    belowErrorMessage(content: ComponentSlot): this { this._slots.belowErrorMessage = content; return this; }

    protected _hint: Lazy<string | HtmlString | null, ComponentContext> = null;
    protected _hintColor: Lazy<string | null, ComponentContext> = null;
    protected _hintIcon: Lazy<string | null, ComponentContext> = null;
    protected _hintIconTooltip: Lazy<string | null, ComponentContext> = null;
    protected _hintActions: Action[] = [];
    /**
     * Hint shown to the right of the label (a `Text` component). The text is escaped; an `HtmlString` from `@navette-js/support`
     * (`raw('<a href="…">…</a>')`) is inserted as is, so only put values escaped with `e()` in it.
     */
    hint(hint: Lazy<string | HtmlString | null, ComponentContext>): this { this._hint = hint; return this; }
    /** Color of the hint and its icon (by default `gray` for the text, `primary` for the icon). */
    hintColor(color: Lazy<string | null, ComponentContext>): this { this._hintColor = color; return this; }
    /** Hint icon, with an optional tooltip (also used as its accessible name). */
    hintIcon(name: Lazy<string | null, ComponentContext>, tooltip?: Lazy<string | null, ComponentContext>): this {
        this._hintIcon = name;
        if (arguments.length >= 2) this._hintIconTooltip = tooltip ?? null;
        return this;
    }
    hintIconTooltip(tooltip: Lazy<string | null, ComponentContext>): this { this._hintIconTooltip = tooltip; return this; }
    /** Action shown after the hint (small link), mounted on the field. */
    hintAction(action: Action): this { return this.hintActions([action]); }
    hintActions(actions: Action[]): this { this._hintActions = [...this._hintActions, ...actions]; return this; }
    getHintActions(): Action[] { return this._hintActions; }
    /** Actions placed in the content slots (functions returning them synchronously included), so that they can be mounted. */
    protected getSlotActions(): Action[] {
        const actions: Action[] = [];
        for (const slot of Object.values(this._slots)) {
            let value: unknown = slot;
            if (typeof value === 'function') {
                try { value = (slot as (ctx: ComponentContext) => unknown)(this.context()); } catch { continue; }
                if (value instanceof Promise) { value.catch(() => {}); continue; }
            }
            if (value && typeof value === 'object' && Array.isArray((value as any).items) && !(value instanceof Component)) value = (value as any).items;
            for (const item of ([] as unknown[]).concat(value ?? [])) {
                if (!item || typeof item !== 'object' || item instanceof Component || item instanceof HtmlString) continue;
                actions.push(...(typeof (item as any).getActions === 'function' ? (item as any).getActions() : [item]));
            }
        }
        return actions;
    }
    /** Actions the field exposes for mounting (`schemaComponent` = field key): its hint actions and the actions of its slots. */
    getActions(): Action[] { return [...this.getHintActions(), ...this.getSlotActions()]; }
    /** Row after the label: the `afterLabel()` slot, or the hint, hint icon and hint actions. */
    protected async renderAfterLabel(): Promise<string> {
        const scope = { path: this.getStatePath(), containerPath: this.container.getStatePath() };
        if (this._slots.afterLabel !== undefined && this._slots.afterLabel !== null) return renderSlot(this, this._slots.afterLabel, this.getKey(), { alignment: 'end', scope });
        const ctx = this.context();
        const hint = await evaluate(this._hint, ctx);
        const color = await evaluate(this._hintColor, ctx);
        const iconName = await evaluate(this._hintIcon, ctx);
        const items: InlineItem[] = [];
        if (hint !== null && hint !== undefined && (hint instanceof HtmlString ? hint.html : hint) !== '') items.push(Text.make(hint).color(color));
        if (iconName) items.push(SchemaIcon.make(iconName).tooltip(await evaluate(this._hintIconTooltip, ctx)).color(color));
        items.push(...this._hintActions);
        if (!items.length) return '';
        // Row components take the field's path, and the field's schema path as their container path.
        return renderInlineItems(this, items, { alignment: 'end', scope, mountKey: this.getKey(), actionView: 'link' });
    }
    protected async renderFieldSlot(name: FieldSlotName): Promise<string> {
        const slot = this._slots[name];
        if (slot === undefined || slot === null) return '';
        return renderSlot(this, slot, this.getKey(), { alignment: name === 'afterContent' ? 'end' : null, scope: { path: this.getStatePath(), containerPath: this.container.getStatePath() } });
    }

    // ---------------------------------------------------------------- extra attributes
    /**
     * Attributes of the field's `<input>`, `<select>` or `<textarea>` (an object, or a synchronous function of the context).
     * They override the field's own attributes (`null` removes one). A later call replaces them, unless `merge`. Never put
     * unescaped user input in them.
     */
    extraInputAttributes(attributes: AttributeEntry, merge = false): this { this._extraInputAttributeEntries = merge ? [...this._extraInputAttributeEntries, attributes] : [attributes]; return this; }
    getExtraInputAttributes(): Record<string, string> { return resolveAttributeEntries(this._extraInputAttributeEntries, this); }
    /** Attributes of the outer element of the field wrapper (label and content). A later call replaces them, unless `merge`. */
    extraFieldWrapperAttributes(attributes: AttributeEntry, merge = false): this { this._extraFieldWrapperAttributeEntries = merge ? [...this._extraFieldWrapperAttributeEntries, attributes] : [attributes]; return this; }
    getExtraFieldWrapperAttributes(): Record<string, string> { return resolveAttributeEntries(this._extraFieldWrapperAttributeEntries, this); }
    /**
     * Alpine.js attributes of the field's control (`{ 'x-on:keydown.enter': '…' }`), merged with its extra input attributes.
     * A later call replaces them, unless `merge`. Never put user input in them.
     */
    extraAlpineAttributes(attributes: AttributeEntry, merge = false): this { this._extraAlpineAttributeEntries = merge ? [...this._extraAlpineAttributeEntries, attributes] : [attributes]; return this; }
    getExtraAlpineAttributes(): Record<string, string> { return resolveAttributeEntries(this._extraAlpineAttributeEntries, this); }
    /** Alpine attributes, then input attributes, as the extra attributes of the control (they override the field's own). */
    protected getExtraControlAttributes(): Record<string, string> {
        const alpine = this.getExtraAlpineAttributes(), input = this.getExtraInputAttributes();
        return { ...alpine, ...input, ...(alpine.class && input.class ? { class: `${input.class} ${alpine.class}` } : {}) };
    }

    // ---------------------------------------------------------------- saving
    /** Forces the field into the saved data, even when disabled (`.disabled().dehydrated()`); `false` leaves it out. */
    dehydrated(condition: Lazy<boolean, ComponentContext> = true): this { this._dehydrated = condition; return this; }
    /** Same as `dehydrated()`: `saved(false)` leaves the field (and the relationships it saves) out of the saved data. */
    saved(condition: Lazy<boolean, ComponentContext> = true): this { return this.dehydrated(condition); }
    /** By default, a disabled field is neither validated nor saved. */
    async isDehydrated(): Promise<boolean> { return this._dehydrated !== null ? Boolean(await evaluate(this._dehydrated, this.context())) : !(await this.isDisabled()); }
    /** `true` / `false` when `dehydrated()` (or `saved()`) was called, `null` otherwise. */
    async getDehydratedOverride(): Promise<boolean | null> { return this._dehydrated === null ? null : Boolean(await evaluate(this._dehydrated, this.context())); }
    /** `false`: a field that is not saved (`saved(false)`) is not validated either. */
    validatedWhenNotDehydrated(condition: Lazy<boolean, ComponentContext> = true): this { this._validatedWhenNotDehydrated = condition; return this; }
    async isValidatedWhenNotDehydrated(): Promise<boolean> { return Boolean(await evaluate(this._validatedWhenNotDehydrated, this.context())); }
    /** Shapes the state saved for the field: `dehydrateStateUsing(({ state }) => String(state).trim())`. */
    dehydrateStateUsing(callback: StateCallback | null): this { this._dehydrateStateUsing = callback; return this; }
    /** Changes the dehydrated state once the field has shaped it (after `dehydrateStateUsing()`). */
    mutateDehydratedStateUsing(callback: StateCallback | null): this { this._mutateDehydratedStateUsing = callback; return this; }
    /** Runs before the state is dehydrated, when the form is submitted (`component.state()` may change it). */
    beforeStateDehydrated(callback: ((ctx: ComponentContext) => unknown) | null): this { this._beforeStateDehydrated = callback; return this; }
    async callBeforeStateDehydrated(): Promise<void> { if (this._beforeStateDehydrated) await this._beforeStateDehydrated(this.context()); }
    /** Applies `dehydrateStateUsing()` and `mutateDehydratedStateUsing()` to an already shaped state. */
    async applyDehydrationCallbacks(state: unknown): Promise<unknown> {
        if (this._dehydrateStateUsing) state = await this._dehydrateStateUsing({ ...this.context(), state });
        if (this._mutateDehydratedStateUsing) state = await this._mutateDehydratedStateUsing({ ...this.context(), state });
        return state;
    }
    /** Shapes the state once the form is filled: `formatStateUsing(({ state }) => String(state).toUpperCase())` (synchronous). */
    formatStateUsing(callback: ((ctx: ComponentContext) => unknown) | null): this {
        return this.afterStateHydrated(callback === null ? null : (ctx) => { ctx.component.state(callback(ctx)); });
    }
    /** Changes the value checked by the validation rules (the saved value is not changed). */
    mutateStateForValidationUsing(callback: StateCallback | null): this { this._mutateStateForValidationUsing = callback; return this; }

    // ---------------------------------------------------------------- validation messages
    /** Shows (or hides, with `false`) the required asterisk, regardless of `required()`. */
    markAsRequired(condition: Lazy<boolean, ComponentContext> = true): this { this._markedAsRequired = condition; return this; }
    async isMarkedAsRequired(): Promise<boolean> { return this._markedAsRequired !== null ? Boolean(await evaluate(this._markedAsRequired, this.context())) : await this.isRequired(); }
    /** Name of the field in validation messages (the lowercased label by default); a function may return it. */
    validationAttribute(name: Lazy<string | null, ComponentContext>): this { this._validationAttribute = name; return this; }
    async getValidationAttribute(): Promise<string> { return (await evaluate(this._validationAttribute, this.context())) ?? (await this.getLabel()).toLowerCase(); }
    /**
     * Custom messages by rule name (`{ required: 'Tell us your name.', max: 'Too long.' }`); `:attribute` is replaced by the
     * field name. A function receives the attribute and the field context.
     */
    validationMessages(messages: Record<string, ValidationMessage>): this { this._validationMessages = { ...this._validationMessages, ...messages }; return this; }
    /**
     * Renders the validation messages of the field as HTML instead of escaped text (custom rules returning links or lists).
     * Every message of the field, translations included, must then be safe HTML.
     */
    allowHtmlValidationMessages(condition: Lazy<boolean, ComponentContext> = true): this { this._allowHtmlValidationMessages = condition; return this; }
    async areHtmlValidationMessagesAllowed(): Promise<boolean> { return Boolean(await evaluate(this._allowHtmlValidationMessages, this.context())); }

    /** Label as text (an HTML label is reduced to its text; `JsContent` falls back to the field name). */
    async getLabel(): Promise<string> {
        const label = await evaluate(this._label, this.context());
        if (label instanceof JsContent) return headline(this._name!);
        if (label instanceof HtmlString) return textOf(label.html);
        return label ?? headline(this._name!);
    }
    /** Label as HTML: escaped text, or the HTML of an `HtmlString` / `JsContent`. */
    async getLabelHtml(): Promise<string> {
        const label = await evaluate(this._label, this.context());
        return label instanceof HtmlString ? label.html : e(label ?? headline(this._name!));
    }
    getErrors(): string[] { return this.livewire._errors[this.getStatePath()] ?? []; }
    hasError(): boolean { return this.getErrors().length > 0; }

    /** Wraps the control in the field wrapper: label column (slots, hint), content column (slots, helper text, error). */
    protected async wrap(html: string, options: { labelPrefix?: string; wrapperClass?: string; after?: string; labelAsDiv?: boolean; focusable?: boolean } = {}): Promise<string> {
        const errors = this.getErrors();
        // FusedGroup field: the wrapper is reduced to a screen-reader label.
        if (this.container.getFieldWrapperView?.() === 'filament-forms::plain-field-wrapper') {
            const label = await this.getLabel();
            const labelHtml = label === '' ? '' : options.labelAsDiv ? `<div id="${e(this.getId())}-label" class="fi-fo-field-label fi-sr-only">${e(label)}</div>` : `<label for="${e(this.getId())}" class="fi-fo-field-label fi-sr-only">${e(label)}</label>`;
            return `<div data-field-wrapper class="fi-fo-field">${labelHtml}${options.labelPrefix ?? ''}${html}${options.after ?? ''}</div>`;
        }
        // Helper text: a small inline schema under the control.
        let below = '';
        const helperText = await evaluate(this._helperText, this.context());
        if (helperText !== null && helperText !== undefined && helperText !== '') below += `<div id="${e(this.getHelperTextId()!)}" class="fi-sc fi-inline fi-sc-has-gap fi-sc-dense"><div x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path: this.getStatePath(), containerPath: this.container.getStatePath() }))})"><div class="fi-sc-component"><span class="fi-sc-text">${helperText instanceof HtmlString ? helperText.html : e(helperText)}</span></div></div></div>`;
        below += await this.renderFieldSlot('belowContent');
        const hasError = errors.length > 0;
        const hasInlineLabel = await this.hasInlineLabel();
        const extraWrapper = this.getExtraFieldWrapperAttributes();
        const { class: extraClass = null, ...extraWrapperAttributes } = extraWrapper;
        const wrapperAttributes = Object.entries(extraWrapperAttributes).filter(([name, value]) => name !== 'data-field-wrapper' && value !== null && value !== undefined).map(([name, value]) => ` ${name}="${String(value).replace(/"/g, '&quot;')}"`).join('');
        return views.render('filament-forms::components.field-wrapper', {
            id: this.getId(), label: await this.getLabelHtml(), required: (await this.isMarkedAsRequired()) && !(await this.isDisabled()),
            labelPrefix: options.labelPrefix ?? '', hiddenLabel: await this.isLabelHidden(), after: options.after ?? '', afterLabel: await this.renderAfterLabel(), labelAsDiv: options.labelAsDiv === true, focusable: options.focusable === true, html, errorMessage: errors[0] ?? null, wrapperClass: cls([options.wrapperClass ?? null, 'fi-fo-field', { 'fi-fo-field-has-inline-label': hasInlineLabel }, extraClass]),
            wrapperAttributes, hasInlineLabel, belowContent: below,
            aboveLabel: await this.renderFieldSlot('aboveLabel'), beforeLabel: await this.renderFieldSlot('beforeLabel'), belowLabel: await this.renderFieldSlot('belowLabel'),
            aboveContent: await this.renderFieldSlot('aboveContent'), beforeContent: await this.renderFieldSlot('beforeContent'), afterContent: await this.renderFieldSlot('afterContent'),
            hasBeforeContent: this._slots.beforeContent !== undefined && this._slots.beforeContent !== null, hasAfterContent: this._slots.afterContent !== undefined && this._slots.afterContent !== null, hasAboveContent: this._slots.aboveContent !== undefined && this._slots.aboveContent !== null,
            aboveErrorMessage: hasError ? await this.renderFieldSlot('aboveErrorMessage') : '', belowErrorMessage: hasError ? await this.renderFieldSlot('belowErrorMessage') : '',
            htmlErrorMessages: hasError && (await this.areHtmlValidationMessagesAllowed()),
        });
    }
}
