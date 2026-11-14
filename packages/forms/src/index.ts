// @navette-js/forms — form fields (Field, TextInput, Select, Checkbox…) and server-side validation.
import { Attributes, HtmlString, cls, e, evaluate, icon, icons, isEnum, js, sanitizeHtml, views, type ColorManager, type Enum, type Lazy, configured } from '@navette-js/support';
import { createHash } from 'node:crypto';
import { t } from '@navette-js/support/i18n';
import { Component, LayoutComponent, loadSingularRelationshipState, saveSingularRelationship, withStateSource, Icon as SchemaIcon, Schema, Text, childSchema, debounceMilliseconds, jsFieldHtml, normalizeRendererConfiguration, renderInlineItems, renderSlot, slug, type ComponentContext, type ComponentSlot, type InlineItem, type JsFieldBindingConfiguration, type JsFieldConfiguration, type JsRenderer } from '@navette-js/schemas';
import { Action, ActionHalt } from '@navette-js/actions';
import { FieldBase } from './field-base.ts';
export { FieldBase, type FieldSlotName, type StateCallback, type ValidationMessage } from './field-base.ts';
import { colorClassesOf, fieldActionIcon, itemContext, modifyAction, prepareExtraItemAction, resolveAction, type ActionModifier, type ResolvedAction } from './item-actions.ts';
export { modifyAction, type ActionModifier } from './item-actions.ts';
export type { JsFieldProps, JsFieldRenderer, JsonValue, JsRendererContext, JsRendererInstance, JsRendererUtilities, Snapshot } from '@navette-js/schemas';
import { loadingIndicator, NavetteTimezone } from '@navette-js/support';
import { randomUUID } from 'node:crypto';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
import { RICH_CONTENT_EXTENSIONS, SizedImage, customRichContentExtensions, registerTextColors, RichContentRenderer, sanitizeCssColor, TextColor, textColorsForJs, MentionProvider, type CustomBlockClass } from './rich-content.ts';
export { CustomBlockNode, GridColumnNode, GridNode, LeadNode, MentionNode, MentionProvider, MergeTagNode, registerRichContentExtensions, RichContentCustomBlock, RichContentRenderer, sanitizeCssColor, SizedImage, SmallMark, TextColor, TextColorMark, type CustomBlockClass } from './rich-content.ts';
import { RichEditorTool } from './rich-editor-tool.ts';
import { getTableSelectDataAdapter, isTableSelectKey, registerTableSelectDefinition, requireTableSelectDriver, writeTableSelectState, type TableConfiguration, type TableSelectDefinition, type TableSelectOptions, type TableSelectRelationship } from './table-select.ts';
export { RichEditorTool, type RichEditorToolDefinition } from './rich-editor-tool.ts';
import { applyToolbarModifications, toolbarButtonNames, type RichContentPlugin, type ToolbarItem, type ToolbarItems, type ToolbarModification } from './rich-editor-toolbar.ts';
export { ToolbarButtonGroup, type RichContentPlugin, type ToolbarItem, type ToolbarItems } from './rich-editor-toolbar.ts';
import { attachmentIdsOf, attachmentUrl, eachImage, type AttachmentsVisibility } from './rich-editor-attachments.ts';
import { saveContentToRecord, type FileAttachmentContext, type FileAttachmentProvider } from './file-attachment-provider.ts';
import { getRichContentAttribute } from './rich-content-attribute.ts';
export type { AttachmentsVisibility } from './rich-editor-attachments.ts';
import { MarkdownFaker, RichContentFaker, type ContentFakerOptions, type RichContentFakerOptions } from './content-faker.ts';
export { ContentFaker, FakeValues, MarkdownFaker, RichContentFaker, type ContentFakerOptions, type RichContentFakerOptions, type CanGenerateFakeConfiguration } from './content-faker.ts';
import { RICH_EDITOR_TOOL_DEFINITIONS } from './rich-editor-tools.ts';
export { RICH_EDITOR_TOOL_DEFINITIONS } from './rich-editor-tools.ts';
import { TableKit } from '@tiptap/extension-table';
import { generateText, type Extensions } from '@tiptap/core';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import { constants as fsConstants, closeSync, copyFileSync, existsSync, linkSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { mapLazy, safeFileUrl } from './file-upload-support.ts';
import { containedFile, deleteContainedFile, isStoredFileKey, serveContainedFiles, type LocalFileStorageOptions } from './file-storage.ts';
export type { FileRequest, FileResponse, LocalFileStorageOptions } from './file-storage.ts';
import { signedFileUrl, temporaryFileUrlExpiry, type FileUrlStorage } from '@navette-js/support';
export { safeFileUrl } from './file-upload-support.ts';
export { MorphToSelect, MorphToSelectType, type MorphModel } from './morph-to-select.ts';
export { saveContentToRecord, StorageFileAttachmentProvider, type FileAttachmentContext, type FileAttachmentProvider } from './file-attachment-provider.ts';
export { getRichContentAttribute, InteractsWithRichContent, RichContentAttribute, type HasRichContent } from './rich-content-attribute.ts';
export { acceptsFileUploads, findFileUploadComponent, isFileUploadForSchemas } from './upload-targets.ts';
import { applyDisableOptionsWhenSelectedInSiblingRepeaterItems, applyFixIndistinctState, applyLazyItemSchema, ensureItemsCanBeProcessed, generateItemKey, rawItemCount, type ItemKeyGenerator } from './repeater-items.ts';
export { generateItemKey, getParentRepeaterItem, ItemsProcessingLimitError, siblingDistinctRules, type ItemKeyGenerator } from './repeater-items.ts';

views.namespace('navette-forms', fileURLToPath(new URL('../views', import.meta.url)));
let colorManager: ColorManager | null = null;
export const useColorManager = (manager: ColorManager) => { colorManager = manager; };
const asset = (name: string) => views.render('navette-forms::asset', { path: name }).trim();

/** Number for an HTML attribute: beyond exact integers, a float with 14 significant digits (`1.844674407371E+19`). */
const phpNumber = (n: number | null): string | number | null => {
    if (n === null || Number.isSafeInteger(n) || Math.abs(n) < 1e15) return n;
    const [mantissa, exponent] = n.toPrecision(14).split('e');
    return `${mantissa.replace(/\.?0+$/, '')}E${exponent}`;
};

import { isBlank as blank, stringRule, parseRegex, reportFailedRule, type Rule } from './rules.ts';
export type { Rule } from './rules.ts';
export { recordFailedRules, stringRule } from './rules.ts';
const headline = (s: string) => s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ (.)/g, (_, c) => ' ' + c.toLowerCase());

export abstract class Field extends FieldBase {
    protected _required: Lazy<boolean, ComponentContext> = false;
    protected _rules: Rule[] = [];

    constructor(name: string) { super(); this._name = name; }
    /** `wire:model` directive of the field, with its live modifiers (`wire:model.live.debounce.500`). */
    protected wireModel(): string { return this.applyStateBindingModifiers('wire:model'); }
    /** Second `$entangle()` argument: whether the binding is live (`isOptimisticallyLive: false`: only a plain `live()`). */
    /** Extra Alpine attributes, as HTML (` name="value"`), for a control rendered by a JavaScript component. */
    protected extraAlpineHtml(): string { const html = new Attributes(this.getExtraAlpineAttributes()).toHtml(); return html ? ` ${html}` : ''; }
    /** Extra Alpine and input attributes, as HTML, for a control whose root element is the JavaScript component. */
    protected extraControlHtml(): string { const html = new Attributes(this.getExtraControlAttributes()).toHtml(); return html ? ` ${html}` : ''; }
    protected entangleLive(isOptimisticallyLive = true): boolean { return this.getStateBindingModifiers({ withBlur: false, withDebounce: false, isOptimisticallyLive }).includes('live'); }
    hasStatePath(): boolean { return true; }
    getName(): string { return this._name!; }
    getId(): string { return this.getKey()!; }

    required(condition: Lazy<boolean, ComponentContext> = true): this { this._required = condition; return this; }

    getDefaultState(): unknown { return this.resolvedDefault(); }
    /** Shapes a record value as it enters the form (hydration). */
    hydrateState(value: unknown): unknown { return value; }
    /** Adds a rule: an object `{ name, passes, message }`, or a Laravel-style string (`'max:255'`, `'regex:/^[a-z]+$/'`). */
    rule(rule: Rule | string, condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this {
        if (typeof rule === 'string') {
            const spec = rule;
            // Built now, so that an unknown or malformed rule fails when the form is declared.
            const probe = stringRule(spec, { numeric: false, name: this._name ?? '' });
            if (!probe) return this;
            const build = () => stringRule(spec, { numeric: this.hasNumericValidation(), name: this._name ?? '' })!;
            rule = { name: probe.name, implicit: probe.implicit, passes: (value, ctx) => build().passes(value, ctx), message: (attribute) => build().message(attribute) };
        }
        if (condition === false) return this;
        if (condition === true) { this._rules.push(rule); return this; }
        const inner = rule;
        this._rules.push({ ...inner, passes: async (value, ctx) => !(await condition(ctx)) || inner.passes(value, ctx) });
        return this;
    }
    /** Several rules at once: `rules(['required', 'max:255'])` or `rules('required|max:255')`. */
    rules(rules: (Rule | string)[] | string, condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this {
        for (const rule of typeof rules === 'string' ? rules.split('|').filter((item) => item.trim() !== '') : rules) this.rule(rule, condition);
        return this;
    }
    /** Value checked by the rules (a subclass may trim it, for instance). */
    protected stateForValidation(state: unknown): unknown { return state; }
    /** Sizes (`min`, `max`, `size`, `between`) compare the number, not the text length. */
    protected hasNumericValidation(): boolean { return false; }
    protected _loadStateFromRelationships: ((record: any, ctx: ComponentContext) => unknown) | null = null;
    protected _saveRelationships: ((args: { record: any; state: unknown; ctx: ComponentContext }) => void | Promise<void>) | null = null;
    /** Fills the field from the record's relationships (after the record's own values): `(record, ctx) => state`. */
    loadStateFromRelationshipsUsing(callback: ((record: any, ctx: ComponentContext) => unknown) | null): this { this._loadStateFromRelationships = callback; return this; }
    /** Saves the field into the record's relationships, once the record is created or updated. Such a field is not in the saved data. */
    saveRelationshipsUsing(callback: ((args: { record: any; state: unknown; ctx: ComponentContext }) => void | Promise<void>) | null): this { this._saveRelationships = callback; return this; }
    /** Whether the field saves itself through `saveRelationshipsUsing()` (and is then left out of the saved data). */
    async savesRelationships(): Promise<boolean> { return this._saveRelationships !== null; }
    async loadStateFromRelationships(record: any): Promise<{ state: unknown } | null> { return this._loadStateFromRelationships ? { state: await this._loadStateFromRelationships(record, this.context()) } : null; }
    async saveRelationships(record: any): Promise<void> { if (this._saveRelationships) await this._saveRelationships({ record, state: await this.dehydrateState(this.context().state), ctx: this.context() }); }
    /**
     * Adds a Laravel-style rule with parameters. A parameter may be a function of the field context: the rule is then built at validation time with the evaluated parameters (a list result is spread).
     */
    private stringRuleWith(name: string, parameters: Lazy<unknown, ComponentContext>[] = []): this {
        if (!parameters.some((parameter) => typeof parameter === 'function')) return this.rule(parameters.length ? `${name}:${parameters.map(String).join(',')}` : name);
        const options = () => ({ numeric: this.hasNumericValidation(), name: this._name ?? '' });
        const probe = stringRule(`${name}:${parameters.map(() => '0').join(',')}`, options());
        let last: Rule | null = null;
        return this.rule({
            name: probe?.name ?? name,
            implicit: probe?.implicit,
            passes: async (value, ctx) => {
                const values = (await Promise.all(parameters.map((parameter) => evaluate(parameter as Lazy<unknown, ComponentContext>, ctx)))).flat();
                last = stringRule(values.length ? `${name}:${values.map(String).join(',')}` : name, options());
                return last === null || last.passes(value, ctx);
            },
            message: (attribute) => last?.message(attribute) ?? '',
        });
    }
    /** The value must match the pattern (a RegExp, or a `/pattern/flags` string). */
    regex(pattern: Lazy<RegExp | string, ComponentContext>): this { return this.rule({ name: 'regex', passes: async (v, ctx) => { const resolved = await evaluate(pattern, ctx); const re = typeof resolved === 'string' ? parseRegex(resolved) : resolved; re.lastIndex = 0; return re.test(String(v)); }, message: (a) => `The ${a} field format is invalid.` }); }
    notRegex(pattern: Lazy<RegExp | string, ComponentContext>): this { return this.rule({ name: 'not_regex', passes: async (v, ctx) => { const resolved = await evaluate(pattern, ctx); const re = typeof resolved === 'string' ? parseRegex(resolved) : resolved; re.lastIndex = 0; return !re.test(String(v)); }, message: (a) => `The ${a} field format is invalid.` }); }
    alpha(): this { return this.stringRuleWith('alpha'); }
    alphaDash(): this { return this.stringRuleWith('alpha_dash'); }
    alphaNum(): this { return this.stringRuleWith('alpha_num'); }
    ascii(): this { return this.stringRuleWith('ascii'); }
    uuid(): this { return this.stringRuleWith('uuid'); }
    ulid(): this { return this.stringRuleWith('ulid'); }
    json(): this { return this.stringRuleWith('json'); }
    ip(): this { return this.stringRuleWith('ip'); }
    ipv4(): this { return this.stringRuleWith('ipv4'); }
    ipv6(): this { return this.stringRuleWith('ipv6'); }
    macAddress(): this { return this.stringRuleWith('mac_address'); }
    hexColor(): this { return this.stringRuleWith('hex_color'); }
    multipleOf(value: Lazy<number, ComponentContext>): this { return this.stringRuleWith('multiple_of', [value]); }
    /** The value must be one of these (a list, or the values of an enum-like object). */
    in(values: Lazy<readonly (string | number)[] | Record<string, string | number> | Enum<string | number>, ComponentContext>): this { return this.rule({ name: 'in', passes: async (v, ctx) => { const list = await evaluate(values, ctx); const allowed = (isEnum(list) ? list.values() : Array.isArray(list) ? list : Object.values(list)).map(String); return (Array.isArray(v) ? v : [v]).every((item) => allowed.includes(String(item))); }, message: (a) => `The selected ${a} is invalid.` }); }
    notIn(values: Lazy<readonly (string | number)[], ComponentContext>): this { return this.rule({ name: 'not_in', passes: async (v, ctx) => { const denied = (await evaluate(values, ctx)).map(String); return (Array.isArray(v) ? v : [v]).every((item) => !denied.includes(String(item))); }, message: (a) => `The selected ${a} is invalid.` }); }
    /** `in()` with the values of an enum (`defineEnum()`, `nativeEnum()`) or of an enum-like object. */
    enum(values: Lazy<Record<string, string | number> | Enum<string | number>, ComponentContext>): this { return this.in(values); }
    startsWith(prefixes: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('starts_with', [prefixes].flat()); }
    endsWith(suffixes: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('ends_with', [suffixes].flat()); }
    doesntStartWith(prefixes: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('doesnt_start_with', [prefixes].flat()); }
    doesntEndWith(suffixes: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('doesnt_end_with', [suffixes].flat()); }
    /** The field must equal `<name>_confirmation` (or the given field) of the same form. */
    confirmed(field: string | null = null): this { return this.rule(field ? `confirmed:${field}` : 'confirmed'); }
    same(field: Lazy<string, ComponentContext>): this { return this.stringRuleWith('same', [field]); }
    different(field: Lazy<string, ComponentContext>): this { return this.stringRuleWith('different', [field]); }
    /** Compares with a number or another field of the same form. */
    gt(fieldOrValue: Lazy<string | number, ComponentContext>): this { return this.stringRuleWith('gt', [fieldOrValue]); }
    gte(fieldOrValue: Lazy<string | number, ComponentContext>): this { return this.stringRuleWith('gte', [fieldOrValue]); }
    lt(fieldOrValue: Lazy<string | number, ComponentContext>): this { return this.stringRuleWith('lt', [fieldOrValue]); }
    lte(fieldOrValue: Lazy<string | number, ComponentContext>): this { return this.stringRuleWith('lte', [fieldOrValue]); }
    /** No duplicates in a list value (tags, multiple select, checkbox list). */
    distinct(): this { return this.stringRuleWith('distinct'); }
    /** Required when another field of the form has one of these values (`requiredIf('type', 'company')`). */
    requiredIf(field: Lazy<string, ComponentContext>, values: Lazy<unknown, ComponentContext>): this { return this.stringRuleWith('required_if', [field, ...[values].flat()]); }
    requiredUnless(field: Lazy<string, ComponentContext>, values: Lazy<unknown, ComponentContext>): this { return this.stringRuleWith('required_unless', [field, ...[values].flat()]); }
    requiredIfAccepted(field: Lazy<string, ComponentContext>): this { return this.stringRuleWith('required_if_accepted', [field]); }
    requiredWith(fields: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('required_with', [fields].flat()); }
    requiredWithAll(fields: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('required_with_all', [fields].flat()); }
    requiredWithout(fields: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('required_without', [fields].flat()); }
    requiredWithoutAll(fields: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('required_without_all', [fields].flat()); }
    prohibited(condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this { return this.conditionalRule('prohibited', condition); }
    prohibitedIf(field: Lazy<string, ComponentContext>, values: Lazy<unknown, ComponentContext>): this { return this.stringRuleWith('prohibited_if', [field, ...[values].flat()]); }
    prohibitedUnless(field: Lazy<string, ComponentContext>, values: Lazy<unknown, ComponentContext>): this { return this.stringRuleWith('prohibited_unless', [field, ...[values].flat()]); }
    prohibits(fields: Lazy<string | string[], ComponentContext>): this { return this.stringRuleWith('prohibits', [fields].flat()); }
    /** Rule applied while `condition` holds (a boolean, or a function of the field context). */
    private conditionalRule(name: string, condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>)): this { return condition === false ? this : this.rule(name, condition); }
    /** The value must be a URL whose host has a DNS A or AAAA record. */
    activeUrl(condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this { return this.conditionalRule('active_url', condition); }
    /** The value must be a string. */
    string(condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this { return this.conditionalRule('string', condition); }
    /** The value must not be empty (it is always present in a form, so this is the same as `required()` without the asterisk). */
    filled(condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this { return this.conditionalRule('filled', condition); }
    /** The value may be empty: the opposite of `required()` (`nullable(false)` makes the field required). */
    nullable(condition: Lazy<boolean, ComponentContext> = true): this { return this.required(async (ctx) => !(await evaluate(condition, ctx))); }
    /** The value must be "yes", "on", 1, "1", true or "true" (terms of service). */
    accepted(condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this { return this.conditionalRule('accepted', condition); }
    /** The value must be "no", "off", 0, "0", false or "false". */
    declined(condition: boolean | ((ctx: ComponentContext) => boolean | Promise<boolean>) = true): this { return this.conditionalRule('declined', condition); }
    /** Required when another field of the form is declined. */
    requiredIfDeclined(field: Lazy<string, ComponentContext>): this { return this.stringRuleWith('required_if_declined', [field]); }
    /**
     * The value must be a date after a date (`'2024-01-01'`, `'today'`, `'tomorrow'`) or after the value of another field
     * (`after('start_date')`, relative to the container: `'../start_date'`, or absolute with `'/data.start_date'`).
     */
    after(date: Lazy<string, ComponentContext>): this { return this.dateComparisonRule('after', date); }
    afterOrEqual(date: Lazy<string, ComponentContext>): this { return this.dateComparisonRule('after_or_equal', date); }
    before(date: Lazy<string, ComponentContext>): this { return this.dateComparisonRule('before', date); }
    beforeOrEqual(date: Lazy<string, ComponentContext>): this { return this.dateComparisonRule('before_or_equal', date); }
    private dateComparisonRule(name: string, date: Lazy<string, ComponentContext>): this {
        const build = async (ctx: ComponentContext) => { const value = await evaluate(date, ctx); return value ? stringRule(`${name}:${value}`, { numeric: false, name: this._name ?? '' }) : null; };
        return this.rule({ name, passes: async (value, ctx) => (await build(ctx))?.passes(value, ctx) ?? true, message: (attribute) => `The ${attribute} field must be a date ${({ after: 'after', after_or_equal: 'after or equal to', before: 'before', before_or_equal: 'before or equal to' } as Record<string, string>)[name]} ${typeof date === 'string' ? date.replace(/^[./]+/, '').replace(/_/g, ' ') : 'the given date'}.` });
    }
    protected _uniqueIgnoresRecordByDefault: Lazy<boolean, ComponentContext> = true;
    /** Whether `unique()` ignores the record being edited when `ignoreRecord` is not given (`true` by default). */
    uniqueValidationIgnoresRecordByDefault(condition: Lazy<boolean, ComponentContext> = true): this { this._uniqueIgnoresRecordByDefault = condition; return this; }
    async shouldUniqueValidationIgnoreRecordByDefault(): Promise<boolean> { return Boolean(await evaluate(this._uniqueIgnoresRecordByDefault, this.context())); }
    /**
     * The value must exist in the database, applying the model's scopes (tenant, soft deletes, `modifyQueryUsing`): `model`
     * is an Objection model (the form's model by default), `adapter` a data adapter whose scopes apply (`new ObjectionAdapter(Category).scopedTo('team_id', id)`;
     * the form's adapter by default), `column` the column (the field name by default).
     */
    scopedExists(options: { model?: Lazy<any, ComponentContext>; adapter?: Lazy<any, ComponentContext>; column?: Lazy<string | null, ComponentContext>; modifyQueryUsing?: ((query: any, ctx: ComponentContext) => unknown) | null } = {}): this {
        return this.rule({
            name: 'exists',
            passes: async (value, ctx) => {
                const { model, query: makeQuery } = await scopedQueryOf(ctx, options.model ?? null, 'with', options.adapter ?? null);
                const column = (await evaluate(options.column ?? null, ctx)) ?? this._name!;
                const values = Array.isArray(value) ? value : [value];
                for (const item of values) {
                    const query = makeQuery().where(`${model.tableName}.${column}`, item as any);
                    const modified = options.modifyQueryUsing ? ((await options.modifyQueryUsing(query, ctx)) ?? query) : query;
                    if ((await (modified as any).resultSize()) === 0) return false;
                }
                return true;
            },
            message: (a) => `The selected ${a} is invalid.`,
        });
    }
    /**
     * The value must not exist in the database, applying the model's scopes (`modifyQueryUsing` may change the query): the
     * record being edited is ignored unless `ignoreRecord: false`; `ignorable` ignores another record.
     */
    scopedUnique(options: { model?: Lazy<any, ComponentContext>; adapter?: Lazy<any, ComponentContext>; column?: Lazy<string | null, ComponentContext>; ignorable?: Lazy<any, ComponentContext>; ignoreRecord?: boolean | null; modifyQueryUsing?: ((query: any, ctx: ComponentContext) => unknown) | null } = {}): this {
        return this.rule({
            name: 'unique',
            passes: async (value, ctx) => {
                const { model, query: makeQuery } = await scopedQueryOf(ctx, options.model ?? null, 'without', options.adapter ?? null);
                const column = (await evaluate(options.column ?? null, ctx)) ?? this._name!;
                const ignoreRecord = options.ignoreRecord ?? (await this.shouldUniqueValidationIgnoreRecordByDefault());
                const ignorable = ignoreRecord && !options.ignorable ? ctx.record : await evaluate(options.ignorable ?? null, ctx);
                const query = makeQuery().where(`${model.tableName}.${column}`, value as any);
                const key = ignorable && typeof ignorable === 'object' ? (ignorable as any)[model.idColumn] : ignorable;
                if (key !== null && key !== undefined) query.whereNot(`${model.tableName}.${model.idColumn}`, key);
                const modified = options.modifyQueryUsing ? ((await options.modifyQueryUsing(query, ctx)) ?? query) : query;
                return (await (modified as any).resultSize()) === 0;
            },
            message: (a) => `The ${a} has already been taken.`,
        });
    }
    /**
     * The value must exist: in a column of the host's data adapter (`exists()`, `exists({ column })`), in another adapter
     * (`exists({ adapter: new ObjectionAdapter(Brand), column: 'id' })`), or according to a function.
     */
    exists(check: { adapter?: { exists(column: string, value: unknown, exceptKey?: string | number | null): Promise<boolean> }; column?: string } | ((value: unknown, ctx: ComponentContext) => boolean | Promise<boolean>) = {}): this {
        return this.rule({
            name: 'exists',
            passes: async (value, ctx) => {
                if (typeof check === 'function') return check(value, ctx);
                const adapter = check.adapter ?? (ctx.livewire as any).getDataAdapter?.();
                if (!adapter) throw new Error('exists(): no data adapter (pass one with { adapter }).');
                for (const item of Array.isArray(value) ? value : [value]) if (!(await adapter.exists(check.column ?? this._name!, item, null))) return false;
                return true;
            },
            message: (a) => `The selected ${a} is invalid.`,
        });
    }
    /**
     * `unique` rule: the value must not exist in the column of the same name (`column`), in the host's data adapter or another
     * one (`adapter`). The record being edited is ignored, unless `ignoreRecord: false`; `ignorable` ignores another record
     * (or key). Like Laravel's rule, it does not apply the adapter's scopes: see `scopedUnique()`.
     */
    unique(options: { ignoreRecord?: boolean | null; column?: Lazy<string | null, ComponentContext>; adapter?: { exists(column: string, value: unknown, exceptKey?: string | number | null): Promise<boolean>; getKey?(record: any): string } | null; ignorable?: Lazy<unknown, ComponentContext> } = {}): this {
        return this.rule({
            name: 'unique',
            passes: async (value, ctx) => {
                const host = ctx.livewire as any;
                const adapter = options.adapter ?? host.getDataAdapter?.();
                if (!adapter) throw new Error('unique(): the host component provides no data adapter (getDataAdapter).');
                const ignoreRecord = options.ignoreRecord ?? (await this.shouldUniqueValidationIgnoreRecordByDefault());
                const ignorable = await evaluate(options.ignorable ?? null, ctx);
                const keyOf = (record: unknown) => (record && typeof record === 'object' ? (adapter.getKey ? adapter.getKey(record) : String((record as any).id)) : (record as string | number));
                const ignored = ignorable !== null && ignorable !== undefined ? keyOf(ignorable) : ignoreRecord ? (ctx.record ? keyOf(ctx.record) : (host.getRecordKey?.() ?? null)) : null;
                return !(await adapter.exists((await evaluate(options.column ?? null, ctx)) ?? this._name!, value, ignored));
            },
            message: (a) => `The ${a} has already been taken.`,
        });
    }


    isRequired(): Promise<boolean> { return evaluate(this._required, this.context()); }

    /** Validation rules: `required` first, then the field's own. */
    async getValidationRules(): Promise<Rule[]> {
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: (v) => !blank(v) && v !== false, message: (a) => `The ${a} field is required.` });
        return [...rules, ...this._rules];
    }
    async validate(): Promise<string[]> {
        // A field that is not saved (`dehydrated(false)`: confirmation, current password) is still validated;
        // only a disabled field (not forced by `dehydrated()`) is skipped.
        const dehydrated = await this.getDehydratedOverride();
        if ((await this.isDisabled()) && dehydrated !== true) return [];
        // `saved(false)` + `validatedWhenNotDehydrated(false)`: not validated either.
        if (dehydrated === false && !(await this.isValidatedWhenNotDehydrated())) return [];
        // An empty string is treated as missing.
        let raw = this.stateForValidation(this.context().state);
        if (this._mutateStateForValidationUsing) raw = await this._mutateStateForValidationUsing({ ...this.context(), state: raw });
        const value = raw === '' ? null : raw;
        const attribute = await this.getValidationAttribute();
        for (const rule of await this.getValidationRules()) {
            if (rule.name !== 'required' && !rule.implicit && blank(value)) continue;
            if (!(await rule.passes(value, this.context()))) {
                reportFailedRule(this.getStatePath(), rule.name);
                const custom = this._validationMessages[rule.name];
                return [custom === undefined ? rule.message(attribute) : typeof custom === 'function' ? custom(attribute, this.context()) : custom.replace(/:attribute/g, attribute)];
            }
        }
        return [];
    }

    /** Value written to the data to save (composite fields only leave a skeleton, filled by their children). */
    dehydrateState(state: unknown): unknown { return state; }
    /** Final shaping of the saved value, once child fields are dehydrated (e.g. a Builder's item list). */
    finalizeDehydratedState(state: unknown): unknown { return state; }
}

// Records picked from a table (inline or in a modal): see ./table-select.ts.
export { getTableSelectDataAdapter, getTableSelectDefinition, useTableSelectDriver, type TableConfiguration, type TableSelectDefinition, type TableSelectDriver } from './table-select.ts';
/** Shared by both fields: table configuration, relationship, selection rules and saving. */
export abstract class TableSelectField extends Field {
    protected _tableConfiguration: Lazy<TableConfiguration | null, ComponentContext> = null;
    protected _tableArguments: Lazy<Record<string, unknown>, ComponentContext> = {};
    protected _relationship: TableSelectRelationship | null = null;
    protected _multiple = false;
    protected _maxItems: number | null = null;
    protected _minItems: number | null = null;
    /** Definition handed down by a `ModalTableSelect` to the `TableSelect` of its modal. */
    protected _definition: TableSelectDefinition | null = null;

    /** The table's configuration (see `TableConfiguration`), or a function returning it. */
    tableConfiguration(configuration: Lazy<TableConfiguration | null, ComponentContext>): this { this._tableConfiguration = configuration; return this; }
    async getTableConfiguration(): Promise<TableConfiguration> {
        // A class is a function too: one with `configure()` (or a resource's `table()`) is the configuration itself.
        const value = this._tableConfiguration as any;
        const isConfiguration = value && (typeof value.configure === 'function' || typeof value.table === 'function');
        const configuration: TableConfiguration | null = isConfiguration ? value : await evaluate(this._tableConfiguration, this.context());
        if (!configuration) throw new Error('The [tableConfiguration()] method must be set when using a [TableSelect] component.');
        if (typeof configuration.name !== 'string' || configuration.name === '') throw new Error('A table configuration needs a name (use a class, or an object with a `name`).');
        if (typeof configuration.configure !== 'function' && typeof configuration.table !== 'function') throw new Error(`Table configuration [${configuration.name}] does not have a [configure(table)] method.`);
        return configuration;
    }
    /** Values passed to the table configuration, read there with `table.getArguments()`. They must be JSON values. */
    tableArguments(args: Lazy<Record<string, unknown>, ComponentContext>): this { this._tableArguments = args; return this; }
    async getTableArguments(): Promise<Record<string, unknown>> {
        const args = await evaluate(this._tableArguments, this.context());
        return args && typeof args === 'object' ? JSON.parse(JSON.stringify(args)) : {};
    }
    /** Several records can be selected: the state is a list of keys. */
    multiple(condition = true): this { this._multiple = condition; return this; }
    isMultiple(): boolean { return this._multiple; }
    /** Maximum (and minimum) number of selected records, checked on the server. */
    maxItems(count: Lazy<number | null, ComponentContext>): this { return this.setLazy('_maxItems', count); }
    minItems(count: Lazy<number | null, ComponentContext>): this { return this.setLazy('_minItems', count); }
    getMaxItems(): number | null { return this._maxItems; }
    getMinItems(): number | null { return this._minItems; }
    /** @internal Uses another field's table definition (the `TableSelect` of a `ModalTableSelect`). */
    useDefinition(definition: TableSelectDefinition | null): this { this._definition = definition; return this; }
    getRelationshipName(): string | null { return this._relationship?.name ?? null; }
    hasRelationship(): boolean { return this._relationship !== null; }

    protected relationInfo() {
        const spec = this._relationship!;
        const host = this.context().livewire as any;
        const adapter = host.getDataAdapter?.() ?? host.getDataAdapterForTable?.() ?? host.resource?.adapter ?? null;
        const model = spec.model ?? adapter?.model;
        if (typeof model !== 'function' || typeof model.getRelation !== 'function') throw new Error('relationship(): the form has no Objection model; pass it with the `model` option.');
        const relation = model.getRelation(spec.name);
        const related = relation.relatedModelClass;
        const isMany = /ManyToMany/.test(relation.constructor?.name ?? '') || typeof relation.joinTable === 'string';
        return { model, related, isMany };
    }
    /** The table's definition, registered so that the table child component finds it again. */
    async getDefinition(): Promise<TableSelectDefinition> {
        if (this._definition) return this._definition;
        const configuration = await this.getTableConfiguration();
        const related = this._relationship ? this.relationInfo().related : null;
        const owner = (this.context().livewire as any)?.constructor?.name ?? '';
        const fingerprint = [owner, this.getName(), this._relationship?.name ?? '', related?.tableName ?? ''].join('|');
        const id = `${configuration.name}.${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`;
        const definition: TableSelectDefinition = { id, configuration, model: related, modifiers: this._relationship?.modify ? [this._relationship.modify] : [] };
        registerTableSelectDefinition(definition);
        return definition;
    }
    /** Selected keys: unique strings, whatever the state holds. */
    selectedValues(): string[] {
        const state = this.context().state;
        return [...new Set((Array.isArray(state) ? state : [state]).filter(isTableSelectKey).map(String))];
    }
    /** The selected keys the table allows (adapter and tenant scope, table and relationship queries, selectable records). */
    async getSelectableValues(values: string[] = this.selectedValues()): Promise<string[]> {
        if (!values.length) return [];
        return requireTableSelectDriver().selectableKeys(await this.getDefinition(), await this.getTableArguments(), values.slice(0, 1000));
    }
    getDefaultState(): unknown { return this.resolvedDefault() ?? (this._multiple ? [] : null); }
    hydrateState(value: unknown): unknown {
        if (this._multiple) return (Array.isArray(value) ? value : []).filter(isTableSelectKey).map(String);
        return isTableSelectKey(value) ? String(value) : null;
    }
    dehydrateState(state: unknown): unknown { return this._multiple ? this.selectedValues() : isTableSelectKey(state) ? state : null; }
    async getValidationRules(): Promise<Rule[]> {
        const count = (value: unknown) => (Array.isArray(value) ? new Set(value.filter(isTableSelectKey).map(String)).size : 0);
        const rules: Rule[] = [];
        if (this._multiple && this._minItems !== null) rules.push({ name: 'min', passes: (v) => count(v) >= this._minItems!, message: (a) => `The ${a} field must have at least ${this._minItems} items.` });
        if (this._multiple && this._maxItems !== null) rules.push({ name: 'max', passes: (v) => count(v) <= this._maxItems!, message: (a) => `The ${a} field must not have more than ${this._maxItems} items.` });
        // Keys come from the browser: each one must be a record of the table's own query.
        rules.push({
            name: 'in',
            passes: async (v) => {
                const values = Array.isArray(v) ? v : [v];
                if (!this._multiple && Array.isArray(v)) return false;
                if (!values.every(isTableSelectKey)) return false;
                const unique = [...new Set(values.map(String))];
                if (unique.length > 1000) return false;
                return (await this.getSelectableValues(unique)).length === unique.length;
            },
            message: (a) => `The selected ${a} is invalid.`,
        });
        return [...(await super.getValidationRules()), ...rules];
    }
    private isManyRelationship(): boolean { return this._relationship !== null && this.relationInfo().isMany; }
    async savesRelationships(): Promise<boolean> { return (await super.savesRelationships()) || this.isManyRelationship(); }
    async loadStateFromRelationships(record: any): Promise<{ state: unknown } | null> {
        if (!this.isManyRelationship()) return super.loadStateFromRelationships(record);
        const { model, related } = this.relationInfo();
        const rows = await model.relatedQuery(this._relationship!.name).for(record[model.idColumn]).clearSelect().select(`${related.tableName}.${related.idColumn} as __key`);
        return { state: rows.map((row: any) => String(row.__key)) };
    }
    /** Many-to-many: links the selected records the table allows, and unlinks the others. */
    async saveRelationships(record: any): Promise<void> {
        if (!this.isManyRelationship()) return super.saveRelationships(record);
        const { model, related } = this.relationInfo();
        const key = record[model.idColumn];
        const desired = new Set(await this.getSelectableValues());
        const current = (await this.loadStateFromRelationships(record))!.state as string[];
        const removed = current.filter((value) => !desired.has(value));
        if (removed.length) await model.relatedQuery(this._relationship!.name).for(key).unrelate().whereIn(`${related.tableName}.${related.idColumn}`, removed);
        for (const value of desired) if (!current.includes(value)) await model.relatedQuery(this._relationship!.name).for(key).relate(related.idColumn === 'id' && /^\d+$/.test(value) ? Number(value) : value);
        await super.saveRelationships(record);
    }
    async getLabel(): Promise<string> {
        // Label from the relationship name (`relationship('category')` → "Category"), like a Select.
        if (this._label === null && this._relationship) {
            const name = this._relationship.name.split('.')[0].replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
        return super.getLabel();
    }
    protected setState(value: unknown): void { writeTableSelectState(this.livewire as any, this.getStatePath(), value); }
}

/**
 * A table embedded in the form, with a checkbox on each row: the state is the selected key (or keys, with `multiple()`).
 * Searching, filtering and paging happen in the table's own child component; selected keys are checked on the server
 * against the table's query when the form is validated.
 */
export class TableSelect extends TableSelectField {
    static make(name: string): TableSelect { return configured(new TableSelect(name)); }
    /**
     * Records of a relationship of the form's model: a belongs-to relationship (the field is the foreign key), or a
     * many-to-many one with `multiple()` (the field saves the links once the record is saved). `modifyQueryUsing(query)`
     * restricts the records shown and accepted.
     */
    relationship(name: string, modifyQueryUsing: ((query: any) => unknown) | null = null, options: { model?: any } = {}): this {
        this._relationship = { name, title: null, modify: modifyQueryUsing, model: options.model ?? null };
        return this;
    }
    async toHtml(): Promise<string> {
        const host = this.livewire as any;
        const componentName = host.getTableSelectComponentName?.();
        if (typeof componentName !== 'string' || typeof host.mountChild !== 'function') throw new Error('TableSelect must be rendered by a panel page.');
        const definition = await this.getDefinition();
        const statePath = this.getStatePath();
        const state = this._multiple ? this.selectedValues() : (this.selectedValues()[0] ?? null);
        const child = await host.mountChild(componentName, {
            definition: definition.id,
            isDisabled: await this.isDisabled(),
            isMultiple: this._multiple,
            maxSelectableRecords: this._multiple ? this._maxItems : 1,
            tableArguments: await this.getTableArguments(),
            state,
        }, this.getLivewireKey(), { model: { property: 'state', outer: statePath, directive: this.wireModel() } });
        const id = this.getId();
        const describedBy = this.hasError() ? `${id}-error` : null;
        const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, id, role: 'group', 'aria-describedby': describedBy });
        return this.wrap(`<div ${attributes.toHtml()}>${child}</div>`, { labelAsDiv: true });
    }
}

/**
 * Shows the selected records' labels, and a "Select" button opening the table in a slide-over, where the user checks
 * one record (or several, with `multiple()`). Labels come from the relationship's title attribute, or from
 * `getOptionLabelFromRecordUsing()`.
 */
export class ModalTableSelect extends TableSelectField {
    private _placeholder: string | null = null;
    private _hasBadges: boolean | null = null;
    private _badgeColor: Lazy<string | null, ComponentContext> = null;
    private _optionLabelFromRecord: ((record: any, ctx: ComponentContext) => string | Promise<string>) | null = null;
    private _optionLabelUsing: ((value: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
    private _optionLabelsUsing: ((values: string[], ctx: ComponentContext) => TableSelectOptions | Promise<TableSelectOptions>) | null = null;
    private _modifySelectAction: ((action: Action, ctx: ComponentContext) => Action | void) | null = null;
    private _modifyTableSelect: ((select: TableSelect, ctx: ComponentContext) => TableSelect | void) | null = null;
    static make(name: string): ModalTableSelect { return configured(new ModalTableSelect(name)); }
    /**
     * Records of a relationship of the form's model: a belongs-to relationship (the field is the foreign key), or a
     * many-to-many one with `multiple()`. `titleAttribute` is the column shown as the label of a selected record;
     * `modifyQueryUsing(query)` restricts the records shown and accepted.
     */
    relationship(name: string, titleAttribute: string | null = null, modifyQueryUsing: ((query: any) => unknown) | null = null, options: { model?: any } = {}): this {
        this._relationship = { name, title: titleAttribute, modify: modifyQueryUsing, model: options.model ?? null };
        return this;
    }
    /** Text shown when nothing is selected. */
    placeholder(placeholder: Lazy<string | null, ComponentContext>): this { return this.setLazy('_placeholder', placeholder); }
    /** Labels in badges (by default with `multiple()` only). */
    badge(condition: Lazy<boolean | null, ComponentContext> = true): this { return this.setLazy('_hasBadges', condition); }
    hasBadges(): boolean { return this._hasBadges ?? this._multiple; }
    badgeColor(color: Lazy<string | null, ComponentContext>): this { this._badgeColor = color; return this; }
    /** Label of a selected record, from the record (`(record) => \`${record.name} (${record.slug})\``). */
    getOptionLabelFromRecordUsing(callback: ((record: any, ctx: ComponentContext) => string | Promise<string>) | null): this { this._optionLabelFromRecord = callback; return this; }
    /** Label of the selected key (single selection), instead of reading the record. */
    getOptionLabelUsing(callback: ((value: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null): this { this._optionLabelUsing = callback; return this; }
    /** Labels of the selected keys (`multiple()`): `[key, label]` pairs or an object. */
    getOptionLabelsUsing(callback: ((values: string[], ctx: ComponentContext) => TableSelectOptions | Promise<TableSelectOptions>) | null): this { this._optionLabelsUsing = callback; return this; }
    /** Customizes the "Select" action: label, modal heading, submit label, width… */
    selectAction(callback: ((action: Action, ctx: ComponentContext) => Action | void) | null): this { this._modifySelectAction = callback; return this; }
    /** Customizes the `TableSelect` shown in the modal. */
    tableSelect(callback: ((select: TableSelect, ctx: ComponentContext) => TableSelect | void) | null): this { this._modifyTableSelect = callback; return this; }

    /** Labels of keys: `[key, label]`, in the order of `values`; keys without a record are left out. */
    private async labelsOf(values: string[]): Promise<[string, string][]> {
        if (!values.length) return [];
        const ctx = this.context();
        let known: [string, string][];
        if (this._multiple && this._optionLabelsUsing) {
            const labels = await this._optionLabelsUsing(values, ctx);
            known = (Array.isArray(labels) ? labels : Object.entries(labels)).map(([value, label]): [string, string] => [String(value), String(label)]);
        } else if (!this._multiple && this._optionLabelUsing) {
            const label = await this._optionLabelUsing(values[0], ctx);
            known = label === null || label === undefined ? [] : [[values[0], String(label)]];
        } else if (this._relationship || this._optionLabelFromRecord) {
            const definition = await this.getDefinition();
            const adapter = getTableSelectDataAdapter(definition);
            const title = this._relationship?.title ?? null;
            known = [];
            for (const record of await requireTableSelectDriver().findRecords(definition, values)) {
                const label = this._optionLabelFromRecord ? await this._optionLabelFromRecord(record, ctx) : title !== null ? record?.[title] : adapter.getKey(record);
                known.push([adapter.getKey(record), String(label ?? adapter.getKey(record))]);
            }
        } else {
            known = values.map((value): [string, string] => [value, value]);
        }
        const map = new Map(known);
        return values.filter((value) => map.has(value)).map((value): [string, string] => [value, map.get(value)!]);
    }
    /** Label of the selected record (single selection). */
    async getOptionLabel(): Promise<string | null> {
        const [value] = this.selectedValues();
        return value === undefined ? null : ((await this.labelsOf([value]))[0]?.[1] ?? value);
    }
    /** Labels of the selected records (`multiple()`), by key. */
    async getOptionLabels(): Promise<[string, string][]> {
        const values = this.selectedValues();
        const labels = new Map(await this.labelsOf(values));
        return values.map((value): [string, string] => [value, labels.get(value) ?? value]);
    }

    /** The `TableSelect` of the modal: same table, relationship and limits. */
    async getTableSelect(): Promise<TableSelect> {
        const select = TableSelect.make('selection').label(await this.getLabel()).hiddenLabel()
            .tableConfiguration(await this.getTableConfiguration())
            .tableArguments(await this.getTableArguments())
            .multiple(this._multiple).maxItems(this._maxItems).minItems(this._minItems)
            .useDefinition(await this.getDefinition());
        return this._modifyTableSelect?.(select, this.context()) ?? select;
    }
    /** Actions mounted on the field: its hint actions and the "Select" action. */
    getActions(): Action[] { return [...this.getHintActions(), this.getSelectAction()]; }
    /** "Select" button: opens the table in a slide-over; its submit button copies the selection into the field. */
    getSelectAction(): Action {
        const blank = this.selectedValues().length === 0;
        const action = Action.make('select')
            .label(t('navette-forms::components.modal_table_select.actions.select.label'))
            .slideOver()
            .modalHeading(() => this.getLabel())
            .modalSubmitActionLabel(t('navette-forms::components.modal_table_select.actions.select.actions.select.label'))
            .icon('m-pencil-square')
            .iconPosition('after')
            .hidden(() => this.isDisabled())
            .fillForm(() => ({ selection: this._multiple ? this.selectedValues() : (this.selectedValues()[0] ?? null) }))
            .schema(async (schema: any) => schema.components([await this.getTableSelect()]))
            .action(async ({ data }) => {
                const selection = data.selection;
                this.setState(this._multiple ? (Array.isArray(selection) ? [...new Set(selection.filter(isTableSelectKey).map(String))] : []) : isTableSelectKey(selection) ? String(selection) : null);
                await this.callAfterStateUpdated();
            });
        if (this._multiple || blank) action.link(); else action.iconButton();
        return this._modifySelectAction?.(action, this.context()) ?? action;
    }

    private badgeHtml(label: string, color: string | null): string {
        const colors = colorManager?.getComponentClasses('badge', color ?? 'primary') ?? [];
        return `<span class="${['nv-badge', 'nv-size-md', ...colors].join(' ')}"><span class="nv-badge-label-ctn"><span class="nv-badge-label">${e(label)}</span></span></span>`;
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const isMultiple = this._multiple;
        const hasBadges = this.hasBadges();
        const badgeColor = await evaluate(this._badgeColor, this.context());
        const optionLabel = isMultiple ? null : await this.getOptionLabel();
        const optionLabels = isMultiple ? await this.getOptionLabels() : [];
        const describedBy = this.hasError() ? `${id}-error` : null;
        const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, id, role: 'group', 'aria-describedby': describedBy })
            .class(['nv-fo-modal-table-select', { 'nv-fo-modal-table-select-disabled': isDisabled, 'nv-fo-modal-table-select-multiple': isMultiple }]);
        let content = '';
        if ((!isMultiple && optionLabel !== null && optionLabel !== '') || (isMultiple && optionLabels.length)) {
            if (isMultiple && hasBadges) content = `<div class="nv-fo-modal-table-select-badges-ctn">${optionLabels.map(([, label]) => this.badgeHtml(label, badgeColor)).join('')}</div>`;
            else if (hasBadges) content = `<div>${this.badgeHtml(optionLabel!, badgeColor)}</div>`;
            else if (isMultiple) content = `<div>${optionLabels.map(([, label]) => e(label)).join(', ')}</div>`;
            else content = `<div>${e(optionLabel!)}</div>`;
        } else if (this._placeholder !== null && this._placeholder !== '') {
            content = `<div class="nv-fo-modal-table-select-placeholder">${e(this._placeholder)}</div>`;
        }
        if (!isDisabled) {
            const ctx = this.context();
            const action = this.getSelectAction();
            const mountContext = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
            if (await action.isVisible(ctx)) content += `<div>${await action.toHtml(ctx, mountContext)}</div>`;
        }
        return this.wrap(`<div ${attributes.toHtml()}>${content}</div>`, { labelAsDiv: true });
    }
}

/** Characters to strip from a state: one string, several, or a function of the field context. */
export type StripCharacters = string | string[] | ((ctx: ComponentContext) => string | string[] | null) | null;
const stripCharactersOf = (field: Field, characters: StripCharacters): string[] => {
    const value = typeof characters === 'function' ? characters(field.context()) : characters;
    return (Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]).map(String).filter((character) => character !== '');
};
/** Removes the characters from a string state (or from each string of a list). */
const stripFromState = (state: unknown, characters: string[]): unknown => {
    if (!characters.length) return state;
    const strip = (value: unknown) => (typeof value === 'string' ? characters.reduce((text, character) => text.split(character).join(''), value) : value);
    return Array.isArray(state) ? state.map(strip) : strip(state);
};

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

    static make(name: string): TextInput { return configured(new TextInput(name)); }
    protected hasNumericValidation(): boolean { return this._numeric !== null; }
    /** Decimal number: `type="number"`, `step="any"`. */
    numeric(): this { this._numeric = 'decimal'; return this.rule({ name: 'numeric', passes: (v) => String(v).trim() !== '' && Number.isFinite(Number(v)), message: (a) => `The ${a} field must be a number.` }); }
    /** Integer: `type="number"`, `step="1"`. */
    integer(): this { this._numeric = 'integer'; return this.rule({ name: 'integer', passes: (v) => /^-?\d+$/.test(String(v).trim()), message: (a) => `The ${a} field must be an integer.` }); }
    private _step: number | 'any' | null = null;
    /** Input `step` of a numeric field, overriding the one implied by `numeric()` or `integer()`. */
    step(step: Lazy<number | 'any' | null, ComponentContext>): this { return this.setLazy('_step', step); }
    /** Minimum value (`min` attribute and rule); a function may return it. */
    minValue(value: Lazy<number | null, ComponentContext>): this { let last: number | null = null; this.setLazy('_minValue', value); return this.rule({ name: 'min', passes: (v, ctx) => { last = (ctx.component as any)._minValue as number | null; return last === null || Number(v) >= last; }, message: (a) => `The ${a} field must be at least ${last}.` }); }
    /** Maximum value (`max` attribute and rule); a function may return it. */
    maxValue(value: Lazy<number | null, ComponentContext>): this { let last: number | null = null; this.setLazy('_maxValue', value); return this.rule({ name: 'max', passes: (v, ctx) => { last = (ctx.component as any)._maxValue as number | null; return last === null || Number(v) <= last; }, message: (a) => `The ${a} field must not be greater than ${last}.` }); }
    /** Label shown before the input (e.g. `$`); `isInline`: inside the input instead of a separate box. */
    prefix(label: Lazy<string | null, ComponentContext>, isInline = false): this { this._prefixInline = isInline; return this.setLazy('_prefix', label); }
    private _suffix: string | null = null;
    /** Label shown after the input ("hours", "kg"…). */
    suffix(label: Lazy<string | null, ComponentContext>, isInline = false): this { this._suffixInline = isInline; return this.setLazy('_suffix', label); }
    private _prefixInline = false;
    private _suffixInline = false;
    private _prefixIcon: string | null = null;
    private _suffixIcon: string | null = null;
    private _prefixIconColor: string | null = null;
    private _suffixIconColor: string | null = null;
    private _prefixActions: Action[] = [];
    private _suffixActions: Action[] = [];
    prefixIcon(icon: Lazy<string | null, ComponentContext>, isInline = false): this { this._prefixInline = isInline; return this.setLazy('_prefixIcon', icon); }
    suffixIcon(icon: Lazy<string | null, ComponentContext>, isInline = false): this { this._suffixInline = isInline; return this.setLazy('_suffixIcon', icon); }
    prefixIconColor(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_prefixIconColor', color); }
    suffixIconColor(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_suffixIconColor', color); }
    /**
     * Icon button before the input, running an action. The action gets the field's `state`, and `set(name, value)` to change a
     * field of the same form.
     */
    prefixAction(action: Action, isInline = false): this { this._prefixActions = [...this._prefixActions, action]; this._prefixInline = isInline; return this; }
    prefixActions(actions: Action[]): this { this._prefixActions = actions; return this; }
    suffixAction(action: Action, isInline = false): this { this._suffixActions = [...this._suffixActions, action]; this._suffixInline = isInline; return this; }
    suffixActions(actions: Action[]): this { this._suffixActions = actions; return this; }
    /** Affix actions, mounted through the schema component. */
    getActions(): Action[] { return [...this.getHintActions(), ...this._prefixActions, ...this._suffixActions]; }
    /** Exact length: `minlength` and `maxlength`, and the matching rule. */
    length(length: Lazy<number | null, ComponentContext>): this { this.minLength(length); this.maxLength(length); return this; }
    private _datalist: string[] = [];
    /** Suggestions offered by the browser while typing (`<datalist>`). */
    datalist(options: Lazy<string[], ComponentContext>): this { return this.setLazy('_datalist', options, (list) => (list ?? []).map(String)); }
    private _readOnly = false;
    /** The value is shown and sent, but cannot be changed (`readonly`). */
    readOnly(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_readOnly', condition, Boolean); }
    private _copyable: { message: string | null; duration: number } | null = null;
    /** A button after the input copies its value (the browser only allows it on HTTPS or `localhost`). */
    copyable(condition: Lazy<boolean, ComponentContext> = true, copyMessage: string | null = null, copyMessageDuration = 2000): this { return this.setLazy('_copyable', condition, (on) => (on ? { message: copyMessage, duration: copyMessageDuration } : null)); }
    private _trim = false;
    /** Removes the spaces around the value before it is validated and saved. */
    trim(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_trim', condition); }
    private _stripCharacters: StripCharacters = null;
    /** Characters removed from the value before it is validated and saved (e.g. the `,` of a `$money` mask). */
    stripCharacters(characters: StripCharacters): this { this._stripCharacters = characters; return this; }
    getStripCharacters(): string[] { return stripCharactersOf(this, this._stripCharacters); }
    hydrateState(value: unknown): unknown { value = stripFromState(value, this.getStripCharacters()); return this._trim && typeof value === 'string' ? value.trim() : value; }
    /** `trim()`: the submitted value is trimmed before it is validated and saved. */
    protected stateForValidation(state: unknown): unknown { state = stripFromState(state, this.getStripCharacters()); return this._trim && typeof state === 'string' ? state.trim() : state; }
    dehydrateState(state: unknown): unknown { state = stripFromState(state, this.getStripCharacters()); return this._trim && typeof state === 'string' ? state.trim() : state; }
    private _inputMode: string | null = null;
    private _autocapitalize: string | null = null;
    /** Virtual keyboard: `none`, `text`, `decimal`, `numeric`, `tel`, `search`, `email` or `url`. */
    inputMode(mode: Lazy<string | null, ComponentContext>): this { return this.setLazy('_inputMode', mode); }
    /** `none`, `sentences`, `words` or `characters` (`true` / `false` for `on` / `off`). */
    autocapitalize(mode: Lazy<string | boolean | null, ComponentContext> = true): this { return this.setLazy('_autocapitalize', mode, (value) => (value === true ? 'on' : value === false ? 'off' : value)); }
    type(type: Lazy<string | null, ComponentContext>): this { return this.setLazy('_type', type); }
    password(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_isPassword', condition, Boolean); }
    revealable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_isRevealable', condition, Boolean); }
    /** `true` → "on", `false` → "off", a string as is. */
    autocomplete(value: Lazy<string | boolean | null, ComponentContext> = true): this { return this.setLazy('_autocomplete', value, (item) => (item === true ? 'on' : item === false ? 'off' : item)); }
    placeholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_placeholder', text); }
    private _mask: Lazy<string | RawJs | null, ComponentContext> = null;
    /**
     * Alpine input mask: a pattern (`(999) 999-9999`), or a `RawJs` expression evaluated in the browser on every keystroke
     * (`RawJs.make('$money($input)')`, rendered as `x-mask:dynamic`). It guides typing only, with no validation value.
     */
    mask(pattern: Lazy<string | RawJs | null, ComponentContext>): this { this._mask = pattern; return this; }
    async getMask(): Promise<string | RawJs | null> { const mask = await evaluate(this._mask, this.context()); return mask === '' || mask === undefined ? null : mask; }
    private _telRegex: Lazy<string | RegExp | null, ComponentContext> = null;
    /** Pattern a `tel()` value must match on the server (a RegExp, or a `/pattern/flags` string). */
    telRegex(regex: Lazy<string | RegExp | null, ComponentContext>): this { this._telRegex = regex; return this; }
    async getTelRegex(): Promise<RegExp> {
        const regex = await evaluate(this._telRegex, this.context());
        return regex instanceof RegExp ? regex : regex ? parseRegex(regex) : /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\.\/0-9]*$/;
    }
    /** Phone number: `tel` input type, validated against `telRegex()` (digits, spaces and common punctuation by default). */
    tel(condition = true): this {
        if (!condition) return this;
        this._type = 'tel';
        return this.rule({ name: 'tel', passes: async (v) => { const regex = await this.getTelRegex(); regex.lastIndex = 0; return regex.test(String(v)); }, message: (a) => `The ${a} field format is invalid.` });
    }
    email(condition = true): this {
        if (!condition) { if (this._type === 'email') this._type = null; this._rules = this._rules.filter((rule) => rule.name !== 'email'); return this; }
        this._type = 'email'; return this.rule({ name: 'email', passes: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)), message: (a) => `The ${a} field must be a valid email address.` }); }
    /** Web address: `url` input type, a valid http(s) value is required. */
    url(): this { this._type = 'url'; return this.rule({ name: 'url', passes: (v) => { try { return ['http:', 'https:'].includes(new URL(String(v)).protocol); } catch { return false; } }, message: (a) => `The ${a} field must be a valid URL.` }); }
    /** Maximum length (`maxlength` attribute and rule); a function may return it. */
    maxLength(length: Lazy<number | null, ComponentContext>): this { let last: number | null = null; this.setLazy('_maxLength', length); return this.rule({ name: 'max', passes: (v, ctx) => { last = (ctx.component as any)._maxLength as number | null; return last === null || String(v).length <= last; }, message: (a) => `The ${a} field must not be greater than ${last} characters.` }); }
    /** Minimum length (`minlength` attribute and rule); a function may return it. */
    minLength(length: Lazy<number | null, ComponentContext>): this { let last: number | null = null; this.setLazy('_minLength', length); return this.rule({ name: 'min', passes: (v, ctx) => { last = (ctx.component as any)._minLength as number | null; return last === null || String(v).length >= last; }, message: (a) => `The ${a} field must be at least ${last} characters.` }); }

    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const revealable = this._isPassword && this._isRevealable;
        // Affixes: label, icon and actions (only visible actions, mounted through this component).
        const ctx = this.context();
        const key = this.getKey();
        const visibleActions = async (actions: Action[]) => { const html: string[] = []; for (const action of actions) if (await action.isVisible(ctx)) html.push(await action.iconButton().size('sm').toHtml(ctx, { schemaComponent: key })); return html; };
        const prefixActions = await visibleActions(this._prefixActions);
        const copyLabel = t('navette-forms::components.text_input.actions.copy.label');
        const copyMessage = this._copyable?.message ?? t('navette-forms::components.text_input.actions.copy.message');
        const suffixActions = [...(await visibleActions(this._suffixActions)), ...(this._copyable ? [`<button title="${e(copyLabel)}" aria-label="${e(copyLabel)}" type="button" class="nv-ac-icon-btn-action nv-icon-btn nv-size-sm" x-on:click="${e(`window.navigator.clipboard.writeText($el.closest('.nv-input-wrp').querySelector('input').value)\n$tooltip(${js(copyMessage)}, { theme: $store.theme, timeout: ${this._copyable.duration} })`)}">${icon('m-clipboard-document-list', { alias: 'forms::components.text-input.actions.copy' })}</button>`] : [])];
        const hasPrefix = this._prefix !== null || this._prefixIcon !== null || prefixActions.length > 0;
        const hasSuffix = this._suffix !== null || this._suffixIcon !== null || suffixActions.length > 0;
        const mask = await this.getMask();
        const type = revealable ? 'password' : mask !== null ? 'text' : (this._type ?? (this._isPassword ? 'password' : this._numeric ? 'number' : 'text'));
        const model = this.wireModel();
        const alpineAttributes = this.getExtraAlpineAttributes();
        const input = new Attributes(this.getExtraControlAttributes())
            .merge({
                'aria-invalid': this.hasError() ? 'true' : null,
                'aria-describedby': this.getHelperTextId(),
                autocomplete: this._autocomplete, autofocus: await this.isAutofocused(), disabled: isDisabled, id: this.getId(),
                autocapitalize: this._autocapitalize,
                inputmode: this._inputMode ?? (this._numeric === 'decimal' ? 'decimal' : this._numeric === 'integer' ? 'numeric' : null),
                list: this._datalist.length && !isDisabled && !this._readOnly ? `${this.getId()}-list` : null,
                readonly: this._readOnly,
                max: phpNumber(this._maxValue), min: phpNumber(this._minValue),
                maxlength: this._maxLength, minlength: this._minLength, placeholder: this._placeholder,
                required: (await this.isRequired()) && !isDisabled && !this._readOnly, step: this._step ?? (this._numeric === 'decimal' ? 'any' : this._numeric === 'integer' ? 1 : null), type,
                // Modifiers (`.live`, `.blur`) also apply to `wire:model.fill`.
                [revealable ? model.replace('wire:model', 'wire:model.fill') : model]: this.getStatePath(),
                'x-bind:type': revealable ? "isPasswordRevealed ? 'text' : 'password'" : null,
                [mask instanceof RawJs ? 'x-mask:dynamic' : 'x-mask']: mask === null ? null : String(mask),
            })
            .class(['nv-input', { 'nv-input-has-inline-prefix': this._prefixInline && hasPrefix, 'nv-input-has-inline-suffix': this._suffixInline && hasSuffix, 'nv-revealable': revealable }]);
        const wrapper = new Attributes()
            .merge({
                'x-data': revealable ? 'passwordRevealFormComponent()' : mask !== null || Object.keys(alpineAttributes).length ? '{}' : null,
                'x-load': revealable ? '' : null,
                'x-load-src': revealable ? views.render('navette-forms::asset', { path: 'text-input/password-reveal' }).trim() : null,
                'x-on:focus-input.stop': "$el.querySelector('input')?.focus()",
            })
            .class(['nv-fo-text-input', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        return this.wrap(views.render('navette-forms::components.text-input', {
            input: input.toHtml(), wrapper: wrapper.toHtml(), revealable, prefix: this._prefix, suffix: this._suffix,
            prefixIcon: this._prefixIcon ? icon(this._prefixIcon, { attributes: new Attributes().class(this._prefixIconColor && this._prefixIconColor !== 'gray' ? ['nv-color', `nv-color-${this._prefixIconColor}`] : []) }) : '',
            suffixIcon: this._suffixIcon ? icon(this._suffixIcon, { attributes: new Attributes().class(this._suffixIconColor && this._suffixIconColor !== 'gray' ? ['nv-color', `nv-color-${this._suffixIconColor}`] : []) }) : '',
            prefixActions, suffixActions, hasPrefix, hasSuffix, prefixInline: this._prefixInline, suffixInline: this._suffixInline,
            datalist: this._datalist.length && !isDisabled && !this._readOnly ? { id: `${this.getId()}-list`, options: this._datalist } : null,
            showLabel: t('navette-forms::components.text_input.actions.show_password.label'),
            hideLabel: t('navette-forms::components.text_input.actions.hide_password.label'),
        }));
    }
}

type Options = [string, string][] | Record<string, string>;
/** `[value, label]` pairs of options given as pairs, as `{ value: label }` or as an enum. */
const optionPairs = (options: Options | Enum<string | number>): [string, string][] => (isEnum(options) ? options.options() : (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]));
/** Options, possibly grouped: `{ 'In process': { draft: 'Draft', reviewing: 'Reviewing' }, Reviewed: { … } }`. */
type GroupedOptions = Options | Record<string, string | Record<string, string>> | [string, string | [string, string][]][];
type OptionGroup = { label: string; options: [string, string][] };
const flattenOptions = (groups: (OptionGroup | [string, string])[]): [string, string][] => groups.flatMap((item) => (Array.isArray(item) ? [item] : item.options));
function normalizeOptions(options: GroupedOptions): (OptionGroup | [string, string])[] {
    const entries: [string, unknown][] = Array.isArray(options) ? options as [string, unknown][] : Object.entries(options);
    return entries.map(([key, value]): OptionGroup | [string, string] => {
        if (value !== null && typeof value === 'object') return { label: String(key), options: (Array.isArray(value) ? value as [string, string][] : Object.entries(value as Record<string, string>)).map(([v, l]): [string, string] => [String(v), String(l)]) };
        return [String(key), String(value)];
    });
}
/**
 * Query of a model for `scopedExists()` / `scopedUnique()`: the given data adapter, or else the form's, applies its scopes
 * (tenant, column scopes, `modify`, soft deletes); an explicit model is queried as is.
 */
async function scopedQueryOf(ctx: ComponentContext, explicit: Lazy<any, ComponentContext>, trashed: 'with' | 'without', explicitAdapter: Lazy<any, ComponentContext> = null): Promise<{ model: any; query: () => any }> {
    const model = await evaluate(explicit, ctx);
    if (model) return { model, query: () => model.query() };
    const adapter = (await evaluate(explicitAdapter, ctx)) ?? (ctx.livewire as any).getDataAdapter?.();
    if (adapter && typeof adapter.scopedQuery === 'function' && adapter.model) return { model: adapter.model, query: () => adapter.scopedQuery(trashed) };
    const formModel = modelOfForm(ctx, null);
    return { model: formModel, query: () => formModel.query() };
}
/** Objection model of the form (the host's data adapter), for relationships. */
function modelOfForm(ctx: ComponentContext, explicit: any): any {
    if (explicit) return explicit;
    const host = ctx.livewire as any;
    const adapter = host.getDataAdapter?.() ?? host.getDataAdapterForTable?.() ?? host.resource?.adapter ?? null;
    const model = adapter?.model;
    if (typeof model !== 'function' || typeof model.getRelation !== 'function') throw new Error('relationship(): the form has no Objection model; pass it with relationship(name, title, modify, { model }).');
    return model;
}
/**
 * Copy of a component and of the components it holds (layout children, item schemas), so that each repeated item gets its own
 * instances: components keep a reference to their container.
 */
export function cloneComponentTree<T extends Component>(component: T): T {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(component)), component) as T;
    for (const [property, value] of Object.entries(copy)) {
        if (value instanceof Component) (copy as any)[property] = cloneComponentTree(value);
        else if (Array.isArray(value) && value.length && value.every((item) => item instanceof Component)) (copy as any)[property] = value.map((item) => cloneComponentTree(item));
    }
    return copy;
}
/** Prefix or suffix of an input wrapper: actions, icon and label (escaped). */
function inputAffixHtml(side: 'prefix' | 'suffix', options: { label: string | null; icon: string; actions: string[]; inline: boolean }): string {
    if (options.label === null && !options.icon && !options.actions.length) return '';
    const label = options.label !== null ? `<span class="nv-input-wrp-label">${e(options.label)}</span>` : '';
    const actions = options.actions.length ? `<div class="nv-input-wrp-actions">${options.actions.join('')}</div>` : '';
    const focus = options.label !== null || options.icon ? ` x-on:click="if (! $event.target.closest('.nv-input-wrp-actions')) $dispatch('focus-input')"` : '';
    const classes = cls([`nv-input-wrp-${side}`, side === 'prefix' ? 'nv-input-wrp-prefix-has-content' : null, { 'nv-inline': options.inline, [`nv-input-wrp-${side}-has-label`]: options.label !== null }]);
    return `<div${focus} class="${classes}">${side === 'prefix' ? actions + options.icon + label : label + options.icon + actions}</div>`;
}
/**
 * Dropdown. Native (`<select>`) by default; `searchable()` switches to the JavaScript select,
 * which queries the server through the exposed methods (`getSearchResultsForJs`…).
 */
export class Select extends Field {
    private _options: GroupedOptions | Enum<string | number> | ((ctx: ComponentContext) => GroupedOptions | Enum<string | number> | Promise<GroupedOptions | Enum<string | number>>) = [];
    private _placeholder: string | null = null;
    private _searchable = false;
    private _native = true;
    private _allowHtml = false;
    private _maxItems: number | null = null;
    private _minItems: number | null = null;
    private _optionsLimit = 50;
    private _searchDebounce = 1000;
    private _messages: { loading?: string; noSearchResults?: string; searchPrompt?: string; searching?: string; noOptions?: string } = {};
    private _relationship: { name: string; title: string | null; modify: ((query: any, search?: string) => unknown) | null; model: any; ignoreRecord: boolean } | null = null;
    private _searchColumns: string[] | null = null;
    private _optionLabelFromRecord: ((record: any, ctx: ComponentContext) => string | null) | null = null;
    private _selectedRecordUsing: ((ctx: ComponentContext) => unknown) | null = null;
    private _pivotData: Lazy<Record<string, unknown> | null, ComponentContext> = null;
    private _reorderable: Lazy<boolean, ComponentContext> = false;
    private _wrapOptionLabels: Lazy<boolean, ComponentContext> = true;
    private _modifyManageOptionActions: ((action: Action) => Action | void) | null = null;
    private _affixes: { prefix: string | null; suffix: string | null; prefixIcon: string | null; suffixIcon: string | null; prefixIconColor: string | null; suffixIconColor: string | null; prefixActions: Action[]; suffixActions: Action[]; prefixInline: boolean; suffixInline: boolean } = { prefix: null, suffix: null, prefixIcon: null, suffixIcon: null, prefixIconColor: null, suffixIconColor: null, prefixActions: [], suffixActions: [], prefixInline: false, suffixInline: false };
    private _dynamic: boolean | null = null;
    private _searchOnServer: boolean | null = null;
    private _hasNoInitialOptions = false;
    private _multiple = false;
    private _optionLabelsUsing: ((values: string[], ctx: ComponentContext) => Options | Promise<Options>) | null = null;
    private _disableOptionWhen: ((value: string, ctx: ComponentContext) => boolean) | null = null;
    private _searchResultsUsing: ((search: string, ctx: ComponentContext) => Options | Promise<Options>) | null = null;
    private _optionLabelUsing: ((value: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
    static make(name: string): Select { return configured(new Select(name)); }
    /** Inside a Repeater or Builder: `distinct()` across the items, `live()`, and the same value is removed from the other items when it changes. */
    fixIndistinctState(condition: Lazy<boolean, ComponentContext> = true): this { return applyFixIndistinctState(this, condition); }
    /** Inside a Repeater or Builder: options picked in another item are disabled (with `distinct()` validation and `live()`). */
    disableOptionsWhenSelectedInSiblingRepeaterItems(): this { return applyDisableOptionsWhenSelectedInSiblingRepeaterItems(this); }
    /** Search results computed by the server on every keystroke (no preloaded option list). */
    getSearchResultsUsing(resolver: (search: string, ctx: ComponentContext) => Options | Promise<Options>): this { this._searchResultsUsing = resolver; this._searchable = true; return this; }
    /** Label of a value; also used to validate that a searched value exists. */
    getOptionLabelUsing(resolver: (value: string, ctx: ComponentContext) => string | null | Promise<string | null>): this { this._optionLabelUsing = resolver; return this; }
    /**
     * Fixed options, or a (possibly async) function evaluated on every request.
     * `dynamic: false`: options come from a function but stay fixed for the page's lifetime (announced as static to the browser).
     * `searchOnServer: false`: search runs in the browser, among the options already sent (for a complete list).
     */
    options(options: GroupedOptions | Enum<string | number> | ((ctx: ComponentContext) => GroupedOptions | Enum<string | number> | Promise<GroupedOptions | Enum<string | number>>), config: { dynamic?: boolean; searchOnServer?: boolean } = {}): this { this._options = options; this._dynamic = config.dynamic ?? null; this._searchOnServer = config.searchOnServer ?? null; return this; }
    /** "Yes" / "No" options, saved as `1` / `0`. */
    boolean(trueLabel: string | null = null, falseLabel: string | null = null, placeholder: string | null = null): this {
        this._options = [['1', trueLabel ?? t('navette-forms::components.select.boolean.true')], ['0', falseLabel ?? t('navette-forms::components.select.boolean.false')]];
        if (placeholder !== null) this._placeholder = placeholder;
        return this;
    }
    /** `false`: the JavaScript select, even without search. */
    native(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_native', condition); }
    /** Option labels are HTML (sanitized on the server; JavaScript select only). */
    allowHtml(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_allowHtml', condition); }
    /** Maximum (and minimum) number of selected items of a multiple select, checked on the server. */
    maxItems(count: Lazy<number | null, ComponentContext>): this { return this.setLazy('_maxItems', count); }
    minItems(count: Lazy<number | null, ComponentContext>): this { return this.setLazy('_minItems', count); }
    /** Number of options shown at once in the JavaScript select (50 by default). */
    optionsLimit(limit: Lazy<number, ComponentContext>): this { return this.setLazy('_optionsLimit', limit, (value) => Math.max(1, Math.floor(value))); }
    searchDebounce(ms: Lazy<number, ComponentContext>): this { return this.setLazy('_searchDebounce', ms, (value) => Math.max(0, Math.floor(Number(value) || 0))); }
    loadingMessage(message: Lazy<string, ComponentContext>): this { return this.setLazy('_messages.loading', message); }
    noSearchResultsMessage(message: Lazy<string, ComponentContext>): this { return this.setLazy('_messages.noSearchResults', message); }
    searchPrompt(message: Lazy<string, ComponentContext>): this { return this.setLazy('_messages.searchPrompt', message); }
    searchingMessage(message: Lazy<string, ComponentContext>): this { return this.setLazy('_messages.searching', message); }
    noOptionsMessage(message: Lazy<string, ComponentContext>): this { return this.setLazy('_messages.noOptions', message); }
    prefix(label: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.prefixInline = isInline; return this.setLazy('_affixes.prefix', label); }
    suffix(label: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.suffixInline = isInline; return this.setLazy('_affixes.suffix', label); }
    prefixIcon(name: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.prefixInline = isInline; return this.setLazy('_affixes.prefixIcon', name); }
    suffixIcon(name: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.suffixInline = isInline; return this.setLazy('_affixes.suffixIcon', name); }
    prefixIconColor(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_affixes.prefixIconColor', color); }
    suffixIconColor(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_affixes.suffixIconColor', color); }
    prefixAction(action: Action, isInline = false): this { this._affixes.prefixActions = [...this._affixes.prefixActions, action]; this._affixes.prefixInline = isInline; return this; }
    suffixAction(action: Action, isInline = false): this { this._affixes.suffixActions = [...this._affixes.suffixActions, action]; this._affixes.suffixInline = isInline; return this; }
    prefixActions(actions: Action[]): this { this._affixes.prefixActions = actions; return this; }
    suffixActions(actions: Action[]): this { this._affixes.suffixActions = actions; return this; }
    /**
     * Options from a relationship of the form's model (Objection `relationMappings`): a belongs-to relationship (the field is the
     * foreign key, `Select.make('author_id').relationship('author', 'name')`), or a many-to-many one with `multiple()` (the field is
     * named after the relationship, and saves the links once the record is saved). `modifyQueryUsing(query, search)` scopes the
     * options; picked keys outside that scope are rejected. With `searchable()`, the options are searched on the server.
     */
    relationship(name: string, titleAttribute: string | null = null, modifyQueryUsing: ((query: any, search?: string) => unknown) | null = null, options: { model?: any; ignoreRecord?: boolean } = {}): this {
        this._relationship = { name, title: titleAttribute, modify: modifyQueryUsing, model: options.model ?? null, ignoreRecord: options.ignoreRecord === true };
        return this;
    }
    /** Label of a related record computed from the whole record (`(record) => record.first_name + ' ' + record.last_name`). Escaped unless `allowHtml()`. */
    getOptionLabelFromRecordUsing(callback: ((record: any, ctx: ComponentContext) => string | null) | null): this { this._optionLabelFromRecord = callback; return this; }
    hasOptionLabelFromRecordUsingCallback(): boolean { return this._optionLabelFromRecord !== null; }
    /** Columns of the related table searched by `searchable([...])` (the title column by default). */
    getSearchColumns(): string[] | null { return this._searchColumns ?? (this._relationship?.title ? [this._relationship.title] : null); }
    /**
     * Extra pivot columns written when a record is linked by a many-to-many relationship (`multiple()`), e.g.
     * `{ primary: true }` or a function of the field context. Declare them in the relation's `join.through.extra`.
     */
    pivotData(data: Lazy<Record<string, unknown> | null, ComponentContext>): this { this._pivotData = data; return this; }
    async getPivotData(): Promise<Record<string, unknown>> { return (await evaluate(this._pivotData, this.context())) ?? {}; }
    /** Multiple selection: the selected options can be reordered by drag and drop (the state keeps their order). */
    reorderable(condition: Lazy<boolean, ComponentContext> = true): this { this._reorderable = condition; return this; }
    async isReorderable(): Promise<boolean> { return Boolean(await evaluate(this._reorderable, this.context())); }
    /** `false`: long option labels are truncated on one line instead of wrapping (JavaScript select). */
    wrapOptionLabels(condition: Lazy<boolean, ComponentContext> = true): this { this._wrapOptionLabels = condition; return this; }
    async canOptionLabelsWrap(): Promise<boolean> { return Boolean(await evaluate(this._wrapOptionLabels, this.context())); }
    /** Record of the selected option (single selection); set by `relationship()`, or by `getSelectedRecordUsing()`. */
    getSelectedRecordUsing(callback: ((ctx: ComponentContext) => unknown) | null): this { this._selectedRecordUsing = callback; return this; }
    /** The related record of the current state (single selection), or `null`. Only records allowed by the relationship's query are returned. */
    async getSelectedRecord(): Promise<any> {
        const ctx = this.context();
        if (this._selectedRecordUsing) return (await this._selectedRecordUsing(ctx)) ?? null;
        if (!this._relationship || this._multiple) return null;
        const state = ctx.state;
        if (state === null || state === undefined || state === '' || typeof state === 'object') return null;
        const { related, id } = this.relationInfo();
        const query = related.query();
        this._relationship.modify?.(query, undefined);
        return (await query.where(id, String(state)).first()) ?? null;
    }
    /** Customizes both the "Create" and "Edit" option actions (before `createOptionAction()` / `editOptionAction()`). */
    manageOptionActions(modify: ((action: Action) => Action | void) | null): this { this._modifyManageOptionActions = modify; return this; }
    private relationInfo() {
        const ctx = this.context();
        const model = modelOfForm(ctx, this._relationship!.model);
        const relation = model.getRelation(this._relationship!.name);
        const related = relation.relatedModelClass;
        const id = `${related.tableName}.${related.idColumn}`;
        const title = `${related.tableName}.${this._relationship!.title ?? related.idColumn}`;
        const isMany = /ManyToMany/.test(relation.constructor?.name ?? '') || typeof relation.joinTable === 'string';
        return { model, relation, related, id, title, isMany };
    }
    /**
     * Options of the relationship: all of them, a search, or the given keys. With `relationship(…, { ignoreRecord: true })`, the
     * record being edited is left out, except when only labelling keys (`forLabels`).
     */
    private async relationshipOptions(search: string | null, keys: string[] | null, limit = 1000, forLabels = false): Promise<[string, string][]> {
        const { related, id, title } = this.relationInfo();
        const query = related.query();
        this._relationship!.modify?.(query, search ?? undefined);
        if (keys !== null) { if (!keys.length) return []; query.whereIn(id, keys.slice(0, 1000)); }
        const record = this.container.getRecord() as any;
        if (this._relationship!.ignoreRecord && !forLabels && record && record[related.idColumn] !== undefined && record[related.idColumn] !== null) query.whereNot(id, record[related.idColumn]);
        if (search) {
            // Several columns are searched with OR (`searchable(['name', 'email'])`); only plain column names are used.
            const columns = (this.getSearchColumns() ?? [related.idColumn]).filter((column) => /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(column));
            const term = `%${search.slice(0, 255)}%`;
            query.where((builder: any) => { for (const column of columns) builder.orWhere(column.includes('.') ? column : `${related.tableName}.${column}`, 'like', term); });
        }
        if (this._optionLabelFromRecord) {
            const rows = await query.limit(limit);
            const ctx = this.context();
            return rows.map((row: any): [string, string] => [String(row[related.idColumn]), String(this._optionLabelFromRecord!(row, ctx) ?? row[related.idColumn])]);
        }
        const rows = await query.clearSelect().select({ __key: id, __title: title }).orderBy(title).limit(limit);
        return rows.map((row: any): [string, string] => [String(row.__key), String(row.__title ?? row.__key)]);
    }
    private isManyRelationship(): boolean { return this._relationship !== null && this.relationInfo().isMany; }
    async savesRelationships(): Promise<boolean> { return (await super.savesRelationships()) || this.isManyRelationship(); }
    async loadStateFromRelationships(record: any): Promise<{ state: unknown } | null> {
        if (!this.isManyRelationship()) return super.loadStateFromRelationships(record);
        const { model, related } = this.relationInfo();
        const rows = await model.relatedQuery(this._relationship!.name).for(record[model.idColumn]).clearSelect().select(`${related.tableName}.${related.idColumn} as __key`);
        return { state: rows.map((row: any) => String(row.__key)) };
    }
    /** Many-to-many: links the picked records and unlinks the others (only keys allowed by the relationship's query). */
    async saveRelationships(record: any): Promise<void> {
        if (!this.isManyRelationship()) return super.saveRelationships(record);
        const { model, related } = this.relationInfo();
        const key = record[model.idColumn];
        const desired = new Set((await this.relationshipOptions(null, this.selectedValues())).map(([value]) => value));
        const current = ((await this.loadStateFromRelationships(record))!.state as string[]);
        const removed = current.filter((value) => !desired.has(value));
        if (removed.length) await model.relatedQuery(this._relationship!.name).for(key).unrelate().whereIn(`${related.tableName}.${related.idColumn}`, removed);
        const pivot = await this.getPivotData();
        for (const value of desired) {
            if (current.includes(value)) continue;
            const id = related.idColumn === 'id' && /^\d+$/.test(value) ? Number(value) : value;
            await model.relatedQuery(this._relationship!.name).for(key).relate(Object.keys(pivot).length ? { [related.idColumn]: id, ...pivot } : id);
        }
        await super.saveRelationships(record);
    }
    /** Disables an option depending on the context (e.g. already picked in another row). */
    disableOptionWhen(condition: (value: string, ctx: ComponentContext) => boolean): this { this._disableOptionWhen = condition; return this; }
    /** Sends the state to the server as soon as it changes. */
    placeholder(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_placeholder', label); }
    private _selectablePlaceholder = true;
    /** `false`: the native select has no empty option. */
    selectablePlaceholder(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_selectablePlaceholder', condition); }
    /** Search field in the JavaScript select; a list of columns (`['name', 'email']`) searches those columns of a relationship. */
    searchable(condition: boolean | string[] = true): this { this._searchColumns = Array.isArray(condition) ? condition : null; this._searchable = Array.isArray(condition) || condition; return this; }
    /** Multiple selection: the state is a list of values; always uses the JavaScript select. */
    multiple(condition = true): this { this._multiple = condition; if (condition) this._searchable = true; return this; }
    isMultiple(): boolean { return this._multiple; }
    /** Labels of several values at once (multiple selection with server search); also used to validate the values. */
    getOptionLabelsUsing(resolver: (values: string[], ctx: ComponentContext) => Options | Promise<Options>): this { this._optionLabelsUsing = resolver; return this; }
    getDefaultState(): unknown { return this.resolvedDefault() ?? (this._multiple ? [] : null); }
    /** Sanitized selected values: unique strings. */
    private selectedValues(): string[] { const state = this.context().state; return [...new Set((Array.isArray(state) ? state : []).filter((v) => typeof v === 'string' || typeof v === 'number').map(String))]; }
    private async labelsOf(values: string[], forLabels = false): Promise<[string, string][]> {
        if (!values.length) return [];
        const known = this._relationship ? await this.relationshipOptions(null, values, 1000, forLabels) : this._optionLabelsUsing ? await this._optionLabelsUsing(values, this.context()) : await this.resolveOptions();
        const map = new Map((Array.isArray(known) ? known : Object.entries(known)).map(([value, label]): [string, string] => [String(value), String(label)]));
        return values.filter((value) => map.has(value)).map((value): [string, string] => [value, map.get(value)!]);
    }
    private _preload = false;
    /** Relationship with `searchable()`: loads the options with the form, instead of on search only. Other options are always loaded. */
    preload(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_preload', condition); }
    hydrateState(value: unknown): unknown {
        if (this._multiple) return (Array.isArray(value) ? value : []).map(String);
        return value === null || value === undefined || value === '' ? null : String(value);
    }
    dehydrateState(state: unknown): unknown { return this._multiple ? this.selectedValues() : state; }
    /** Options with their groups (labels sanitized when `allowHtml()`). */
    async resolveGroupedOptions(): Promise<(OptionGroup | [string, string])[]> {
        if (this._relationship) return this._searchable && !this._preload ? [] : this.relationshipOptions(null, null);
        const options = typeof this._options === 'function' ? await this._options(this.context()) : this._options;
        const groups = normalizeOptions(isEnum(options) ? options.options() : options);
        if (!this._allowHtml) return groups;
        const clean = ([value, label]: [string, string]): [string, string] => [value, sanitizeHtml(label)];
        return groups.map((item) => (Array.isArray(item) ? clean(item) : { label: item.label, options: item.options.map(clean) }));
    }
    async resolveOptions(): Promise<[string, string][]> { return flattenOptions(await this.resolveGroupedOptions()); }
    private itemCountRules(): Rule[] {
        const count = (v: unknown) => (Array.isArray(v) ? new Set(v.map(String)).size : 0);
        return [
            ...(this._minItems !== null ? [{ name: 'min', passes: (v: unknown) => count(v) >= this._minItems!, message: (a: string) => `The ${a} field must have at least ${this._minItems} items.` }] : []),
            ...(this._maxItems !== null ? [{ name: 'max', passes: (v: unknown) => count(v) <= this._maxItems!, message: (a: string) => `The ${a} field must not have more than ${this._maxItems} items.` }] : []),
        ];
    }
    async getValidationRules(): Promise<Rule[]> {
        // With server search, a value is valid if the server can label it; otherwise it must be among the options.
        if (this._multiple) return [...(await super.getValidationRules()), ...this.itemCountRules(), { name: 'in', passes: async (v) => { const values = Array.isArray(v) ? v.map(String) : []; return (await this.labelsOf([...new Set(values)])).length === new Set(values).size; }, message: (a) => `The selected ${a} is invalid.` }];
        const passes = async (v: unknown) => (this._relationship ? (await this.relationshipOptions(null, [String(v)])).length === 1 : this._searchResultsUsing ? (await this._optionLabelUsing?.(String(v), this.context())) != null : (await this.resolveOptions()).some(([value]) => value === String(v)));
        return [...(await super.getValidationRules()), { name: 'in', passes, message: (a) => `The selected ${a} is invalid.` }];
    }

    // Methods exposed to the select's JavaScript (called through callSchemaComponentMethod).
    getExposedMethods(): string[] { return ['getOptionLabel', 'getSearchResultsForJs', 'getOptionsForJs', 'getOptionLabelsForJs']; }
    private static forJs(options: [string, string][]) { return options.map(([value, label]) => ({ label, value, isDisabled: false })); }
    private groupsForJs(groups: (OptionGroup | [string, string])[]): unknown[] {
        return groups.map((item) => (Array.isArray(item) ? this.withDisabled(Select.forJs([item]))[0] : { label: item.label, options: this.withDisabled(Select.forJs(item.options)) }));
    }
    async getOptionsForJs() { return this.groupsForJs(await this.resolveGroupedOptions()); }
    private withDisabled<T extends { value: string; isDisabled: boolean }>(options: T[]): T[] {
        if (!this._disableOptionWhen) return options;
        const ctx = this.context();
        return options.map((option) => ({ ...option, isDisabled: this._disableOptionWhen!(option.value, ctx) }));
    }
    async getSearchResultsForJs(search: unknown = '') {
        if (this._relationship) return this.withDisabled(Select.forJs(await this.relationshipOptions(String(search ?? '').slice(0, 1000), null, this._optionsLimit)));
        if (this._searchResultsUsing) {
            const found = await this._searchResultsUsing(String(search ?? '').slice(0, 1000), this.context());
            return Select.forJs((Array.isArray(found) ? found : Object.entries(found)).map(([value, label]): [string, string] => [String(value), String(label)]));
        }
        const needle = String(search ?? '').toLowerCase();
        return this.withDisabled(Select.forJs((await this.resolveOptions()).filter(([, label]) => label.toLowerCase().includes(needle))));
    }
    async getOptionLabel(): Promise<string | null> {
        const state = this.context().state;
        if (state === null || state === undefined || state === '') return null;
        if (this._relationship) return (await this.relationshipOptions(null, [String(state)], 1000, true))[0]?.[1] ?? null;
        if (this._optionLabelUsing) return this._optionLabelUsing(String(state), this.context());
        return (await this.resolveOptions()).find(([value]) => value === String(state))?.[1] ?? null;
    }
    async getOptionLabelsForJs(): Promise<unknown[]> { return this._multiple ? (await this.labelsOf(this.selectedValues(), true)).map(([value, label]) => ({ label, value })) : []; }

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
     * Form of the "Create" modal opened by the field's "+" button, validated on the server.
     * `createOptionUsing()` saves the option and returns its value, which becomes the field state (appended for `multiple()`).
     * Options must come from a function (`options(() => …)`, or server search) for the new value to appear.
     */
    createOptionForm(schema: Component[] | ((schema: Schema) => Component[] | Schema) | null): this { this._createOptionForm = schema; return this; }
    /** Saves the option from the validated modal data; returns the value (key) of the created option. */
    createOptionUsing(callback: ((data: Record<string, unknown>, ctx: ComponentContext) => string | number | null | Promise<string | number | null>) | null): this { this._createOptionUsing = callback; return this; }
    createOptionModalHeading(heading: Lazy<string | null, ComponentContext>): this { return this.setLazy('_createOptionModalHeading', heading); }
    /** Customizes the create action (label, icon, modal width…). */
    createOptionAction(modify: ((action: Action) => Action | void) | null): this { this._modifyCreateOptionAction = modify; return this; }
    /**
     * Form of the "Edit" modal for the selected option (single selection only). The field becomes `live()` so the button
     * appears as soon as an option is picked. Filled by `fillEditOptionActionFormUsing()`, saved by `updateOptionUsing()`.
     */
    editOptionForm(schema: Component[] | ((schema: Schema) => Component[] | Schema) | null): this { this._editOptionForm = schema; if (this._isLive === null) this.live(); return this; }
    updateOptionUsing(callback: ((data: Record<string, unknown>, ctx: ComponentContext) => unknown) | null): this { this._updateOptionUsing = callback; return this; }
    /** Initial data of the "Edit" modal (the context carries the current field state in `state`). */
    fillEditOptionActionFormUsing(callback: ((ctx: ComponentContext) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null): this { this._fillEditOptionForm = callback; return this; }
    editOptionModalHeading(heading: Lazy<string | null, ComponentContext>): this { return this.setLazy('_editOptionModalHeading', heading); }
    editOptionAction(modify: ((action: Action) => Action | void) | null): this { this._modifyEditOptionAction = modify; return this; }
    /** Same form for creating and editing. */
    manageOptionForm(schema: Component[] | ((schema: Schema) => Component[] | Schema) | null): this { return this.createOptionForm(schema).editOptionForm(schema); }

    private setState(value: unknown): void { writePath(this.livewire as any, this.getStatePath().split('.'), value); }
    private getCreateOptionAction(): Action | null {
        if (!this._createOptionForm) return null;
        const tr = (key: string) => t(`navette-forms::components.select.actions.create_option.${key}`);
        const action = Action.make('createOption').label(tr('label')).icon(icons.resolve('forms::components.select.actions.create-option') ?? 'm-plus').iconButton().color('gray')
            .hidden(() => this.isDisabled())
            .modalHeading(this._createOptionModalHeading ?? tr('modal.heading'))
            .modalSubmitActionLabel(tr('modal.actions.create.label'))
            .schema(this._createOptionForm as any)
            .action(async ({ data }) => {
                let created: string | number | null;
                if (this._createOptionUsing) created = await this._createOptionUsing(data, this.context());
                else if (this._relationship) { const { related } = this.relationInfo(); const record = await related.query().insert(data); created = record[related.idColumn]; }
                else throw new Error(`Select [${this.getStatePath()}]: createOptionUsing() is required with createOptionForm().`);
                if (created === null || created === undefined || created === '') return;
                this.setState(this._multiple ? [...new Set([...this.selectedValues(), String(created)])] : String(created));
                await this.callAfterStateUpdated();
            });
        // Multiple selection: "Create & create another" keeps the modal open on an empty form.
        if (this._multiple) action.extraModalFooterActions([Action.make('createAnother').label(tr('modal.actions.create_another.label')).color('gray').action(`callMountedAction(${js({ another: true })})`)]);
        const managed = this._modifyManageOptionActions?.(action) ?? action;
        return this._modifyCreateOptionAction?.(managed) ?? managed;
    }
    private getEditOptionAction(): Action | null {
        if (!this._editOptionForm || this._multiple) return null;
        const tr = (key: string) => t(`navette-forms::components.select.actions.edit_option.${key}`);
        const filled = () => { const state = this.context().state; return state !== null && state !== undefined && state !== ''; };
        const action = Action.make('editOption').label(tr('label')).icon(icons.resolve('forms::components.select.actions.edit-option') ?? 'm-pencil-square').iconButton().color('gray')
            .hidden(async () => (await this.isDisabled()) || !filled())
            .modalHeading(this._editOptionModalHeading ?? tr('modal.heading'))
            .modalSubmitActionLabel(tr('modal.actions.save.label'))
            .schema(this._editOptionForm as any)
            // With a relationship, the selected record (found through the relationship's query) fills the form and is updated.
            .fillForm(async () => (this._fillEditOptionForm ? await this._fillEditOptionForm(this.context()) : this._relationship ? { ...((await this.getSelectedRecord()) ?? {}) } : null) ?? {})
            .action(async ({ data }) => {
                if (this._updateOptionUsing) { await this._updateOptionUsing(data, this.context()); return; }
                if (!this._relationship) throw new Error(`Select [${this.getStatePath()}]: updateOptionUsing() is required with editOptionForm().`);
                const record = await this.getSelectedRecord();
                if (!record) throw new ActionHalt(true);
                const { related } = this.relationInfo();
                await related.query().findById(record[related.idColumn]).patch(data);
            });
        const managed = this._modifyManageOptionActions?.(action) ?? action;
        return this._modifyEditOptionAction?.(managed) ?? managed;
    }
    /** Actions mounted on the field: hint, create option and edit option. */
    getActions(): Action[] { return [...this.getHintActions(), ...this._affixes.prefixActions, ...this._affixes.suffixActions, ...[this.getCreateOptionAction(), this.getEditOptionAction()].filter((action): action is Action => action !== null)]; }
    private affixIcon(name: string | null, color: string | null): string { return name ? icon(name, { attributes: new Attributes().class(color && color !== 'gray' ? ['nv-color', `nv-color-${color}`] : []) }) : ''; }
    private async affixActionsHtml(actions: Action[]): Promise<string[]> {
        const ctx = this.context();
        const html: string[] = [];
        for (const action of actions) if (await action.isVisible(ctx)) html.push(await action.iconButton().size('sm').toHtml(ctx, { schemaComponent: this.getKey() }));
        return html;
    }
    private async prefixHtml(): Promise<string> {
        const a = this._affixes;
        return inputAffixHtml('prefix', { label: a.prefix, icon: this.affixIcon(a.prefixIcon, a.prefixIconColor), actions: await this.affixActionsHtml(a.prefixActions), inline: a.prefixInline });
    }
    /** Suffix: label, icon, actions, then the "+" and "edit" buttons. */
    private async suffixHtml(): Promise<string> {
        const ctx = this.context();
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: this.getKey() };
        const buttons: string[] = await this.affixActionsHtml(this._affixes.suffixActions);
        for (const action of [this.getCreateOptionAction(), this.getEditOptionAction()]) {
            if (action && (await action.isVisible(ctx))) buttons.push((await action.toLinkHtml(ctx, context, '')).replace(' wire:key=""', ''));
        }
        const a = this._affixes;
        return inputAffixHtml('suffix', { label: a.suffix, icon: this.affixIcon(a.suffixIcon, a.suffixIconColor), actions: buttons, inline: a.suffixInline });
    }

    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const grouped = await this.resolveGroupedOptions();
        const resolved = flattenOptions(grouped);
        const suffix = await this.suffixHtml();
        const prefix = await this.prefixHtml();
        if (this._searchable || this._multiple || !this._native || this._allowHtml) {
            const isRequired = (await this.isRequired()) && !isDisabled;
            const after = isRequired ? `<span id="${e(this.getId())}-required" class="nv-sr-only">${e(t('navette-forms::components.select.required_description'))}</span>` : '';
            return this.wrap(await this.toJsHtml(grouped, isDisabled, suffix, prefix), { wrapperClass: 'nv-fo-select-wrp', after });
        }
        const select = new Attributes(this.getExtraControlAttributes())
            .merge({ 'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(), required: (await this.isRequired()) && !isDisabled, 'wire:key': typeof this._options === 'function' ? `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify(resolved)).digest('hex')}` : null, [this.wireModel()]: this.getStatePath() })
            .class(['nv-select-input']);
        const wrapper = new Attributes().merge({ 'x-on:focus-input.stop': "$el.querySelector('select')?.focus()" }).class(['nv-fo-select', 'nv-fo-select-native', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        const option = ([value, label]: [string, string]) => `<option value="${e(value)}"${this._disableOptionWhen?.(value, this.context()) ? ' disabled' : ''}>${e(label)}</option>`;
        const options = [this._selectablePlaceholder ? `<option value="">${isDisabled ? '' : e(this._placeholder ?? t('navette-forms::components.select.placeholder'))}</option>` : '', ...grouped.map((item) => (Array.isArray(item) ? option(item) : `<optgroup label="${e(item.label)}">${item.options.map(option).join('')}</optgroup>`))].join('');
        return this.wrap(`<div ${wrapper.toHtml()}>${prefix}<div class="nv-input-wrp-content-ctn"><select ${select.toHtml()}>${options}</select></div>${suffix}</div>`, { wrapperClass: 'nv-fo-select-wrp' });
    }

    /** JavaScript select rendering. */
    private async toJsHtml(grouped: (OptionGroup | [string, string])[], isDisabled: boolean, suffix = '', prefix = ''): Promise<string> {
        const state = this.context().state;
        const hasState = !this._multiple && state !== null && state !== undefined && state !== '';
        const selected = this._multiple ? await this.labelsOf(this.selectedValues(), true) : [];
        const isRequired = (await this.isRequired()) && !isDisabled;
        // Required field: a screen-reader instruction ("Select an option.") is linked to the select.
        const describedBy = [isRequired ? `${this.getId()}-required` : null, this.hasError() ? `${this.getId()}-error` : null].filter(Boolean).join(' ') || null;
        const accessibility = JSON.stringify({ 'aria-describedby': describedBy, 'aria-invalid': this.hasError() ? 'true' : null, 'aria-required': isRequired ? 'true' : null });
        const forJs = this.groupsForJs(grouped);
        // Dynamic options come from a function, so they may change between requests.
        const hasDynamicOptions = this._dynamic ?? typeof this._options === 'function';
        const tr = (key: string, replace: Record<string, string> = {}) => t(`navette-forms::components.select.${key}`, replace);
        const config = `selectFormComponent({
 canOptionLabelsWrap: ${(await this.canOptionLabelsWrap()) ? 'true' : 'false'},
 canSelectPlaceholder: true,
 clearButtonLabel: ${js(tr('actions.clear.label'))},
 errorMessage: ${js(tr('error_message'))},
 hasDynamicOptions: ${hasDynamicOptions ? 'true' : 'false'},
 hasDynamicSearchResults: ${this._searchResultsUsing || (this._relationship && this._searchable) || (this._searchOnServer ?? hasDynamicOptions) ? 'true' : 'false'},
 hasInitialNoOptionsMessage: ${this._searchResultsUsing || (this._relationship && this._searchable && !this._preload) || this._hasNoInitialOptions ? 'false' : 'true'},
 id: ${js(this.getId())},
 initialOptionLabel: ${js(hasState ? await this.getOptionLabel() : null)},
 initialOptionLabels: ${selected.length ? js(selected.map(([value, label]) => ({ label, value, isDisabled: false }))) : '[]'},
 initialState: ${this._multiple ? (selected.length ? js(selected.map(([value]) => value)) : '[]') : js(hasState ? String(state) : null)},
 isAutofocused: ${(await this.isAutofocused()) ? 'true' : 'false'},
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isHtmlAllowed: ${this._allowHtml ? 'true' : 'false'},
 isMultiple: ${this._multiple ? 'true' : 'false'},
 isReorderable: ${this._multiple && (await this.isReorderable()) ? 'true' : 'false'},
 isSearchable: ${this._searchable ? 'true' : 'false'},
 key: ${js(this.getKey())},
 livewireId: ${js(this.livewire.id)},
 loadingMessage: ${js(this._messages.loading ?? tr('loading_message'))},
 maxItems: ${this._maxItems ?? 'null'},
 maxItemsMessage: ${js(tr('max_items_message', { count: String(this._maxItems ?? '') }))},
 noOptionsMessage: ${js(this._messages.noOptions ?? tr('no_options_message'))},
 noSearchResultsMessage: ${js(this._messages.noSearchResults ?? tr('no_search_results_message'))},
 options: ${forJs.length ? js(forJs) : '[]'},
 optionsLimit: ${this._optionsLimit},
 placeholder: ${js(this._placeholder ?? tr('placeholder'))},
 position: null,
 removeButtonLabel: ${js(tr('actions.remove_option.label'))},
 searchDebounce: ${this._searchDebounce},
 searchingMessage: ${js(this._messages.searching ?? tr('searching_message'))},
 searchLabel: ${js(tr('search_label'))},
 searchPrompt: ${js(this._messages.searchPrompt ?? tr('search_prompt'))},
 searchableOptionFields: ${js(['label'])},
 state: $wire.$entangle(${js(this.getStatePath())}, ${this.entangleLive() ? 'true' : 'false'}),
 statePath: ${js(this.getStatePath())},
 })`;
        const wrapper = new Attributes().merge({ 'x-on:focus-input.stop': "$el.querySelector('.nv-select-input-btn')?.focus()" }).class(['nv-fo-select', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        const key = `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify(forJs)).digest('hex')}`;
        return `<div ${wrapper.toHtml()}>${prefix}<div class="nv-input-wrp-content-ctn"><div class="nv-hidden" data-select-accessibility="${e(accessibility)}" x-data="{
 isDisabled: ${isDisabled ? 'true' : 'false'},
 init() {
 const container = $el.nextElementSibling
 container.dispatchEvent(
 new CustomEvent('set-select-property', {
 detail: { isDisabled: this.isDisabled },
 }),
 )
 },
 }"></div><div x-load x-load-src="${e(asset('select'))}"${this.extraControlHtml()} x-data="${e(config)}" wire:ignore wire:key="${e(key)}" x-on:set-select-property="$event.detail.isDisabled ? select.disable() : select.enable()" class="nv-select-input"><div x-ref="select"></div></div></div>${suffix}</div>`;
    }
}

/** Column of a table Repeater: header label, width, alignment. */
export class TableColumn {
    label: string;
    private _width: string | null = null;
    private _hiddenHeaderLabel = false;
    private _markedAsRequired = false;
    private _wrapHeader = false;
    private _alignment: 'start' | 'center' | 'end' | 'left' | 'right' | 'justify' | 'between' | null = null;
    private _verticalAlignment: 'start' | 'center' | 'end' | null = null;
    constructor(label: string) { this.label = label; }
    static make(label: string): TableColumn { return configured(new TableColumn(label)); }
    getLabel(): string { return this.label; }
    width(width: number | string | null): this { this._width = typeof width === 'number' ? `${width}px` : width; return this; }
    getWidth(): string | null { return this._width; }
    /** Keeps the header label for screen readers only. */
    hiddenHeaderLabel(condition = true): this { this._hiddenHeaderLabel = condition; return this; }
    isHeaderLabelHidden(): boolean { return this._hiddenHeaderLabel; }
    /** Red asterisk after the header label. */
    markAsRequired(condition = true): this { this._markedAsRequired = condition; return this; }
    isMarkedAsRequired(): boolean { return this._markedAsRequired; }
    /** Lets the header label wrap on several lines. */
    wrapHeader(condition = true): this { this._wrapHeader = condition; return this; }
    canHeaderWrap(): boolean { return this._wrapHeader; }
    /** Horizontal alignment of the header label. */
    alignment(alignment: 'start' | 'center' | 'end' | 'left' | 'right' | 'justify' | 'between' | null): this { this._alignment = alignment; return this; }
    getAlignment(): string | null { return this._alignment; }
    /** Vertical alignment of the column's cells. */
    verticalAlignment(alignment: 'start' | 'center' | 'end' | null): this { this._verticalAlignment = alignment; return this; }
    getVerticalAlignment(): string | null { return this._verticalAlignment; }
}

const ITEM_KEY = /^[A-Za-z0-9_-]{1,64}$/;
const isItemKey = (key: string) => ITEM_KEY.test(key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
type ItemLink = { label: string; icon: string; url: string };
type RepeaterActionName = 'add' | 'addBetween' | 'clone' | 'delete' | 'moveUp' | 'moveDown' | 'reorder' | 'collapse' | 'expand' | 'collapseAll' | 'expandAll';

/**
 * List of repeated items sharing the same fields: stacked cards (default), a table (`table()`), or one field per item (`simple()`).
 * The state is a map `item key → fields`; key order is display order.
 * Add, delete, clone and move are component actions, mounted with `schemaComponent`.
 */
export class Repeater extends Field {
    private _schema: () => Component[] = () => [];
    private _columns: TableColumn[] = [];
    private _defaultItems = 0;
    private _maxItems = 500;
    private _minItems: number | null = null;
    private _itemLinks: ((ctx: { item: Record<string, unknown>; key: string }) => ItemLink | null)[] = [];
    private _simple: Field | null = null;
    private _grid: Record<string, number> | number | null = null;
    private _collapsible = false;
    private _collapsed = false;
    private _persistCollapsed = false;
    private _cloneable = false;
    private _addable = true;
    private _deletable = true;
    private _reorderableWithButtons = false;
    private _itemLabel: ((ctx: { state: Record<string, unknown>; key: string; index: number }) => string | null) | string | null = null;
    private _itemNumbers = false;
    private _truncateItemLabel = true;
    private _headingTag = 'h4';
    private _addActionLabel: string | null = null;
    private _addActionAlignment: 'start' | 'center' | 'end' | null = null;
    private _labelBetweenItems: string | null = null;
    private _itemHeaders = true;
    private _relationship: { name: string; modify: ((query: any) => unknown) | null; modifyRecords: ((records: any[], ctx: ComponentContext) => any[] | null | undefined | Promise<any[] | null | undefined>) | null; orderColumn: string | null; model: any } | null = null;
    private _itemKeyGenerator: ItemKeyGenerator = null;
    private _maxItemsForProcessing: number | null = null;
    private _compact: Lazy<boolean, ComponentContext> = false;
    private _schemaTemplate: Schema | null = null;
    private _relationshipHooks: {
        beforeFill?: ((ctx: ComponentContext & { data: Record<string, unknown> }) => Record<string, unknown> | Promise<Record<string, unknown>>) | null;
        beforeCreate?: ((ctx: ComponentContext & { data: Record<string, unknown> }) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null;
        beforeSave?: ((ctx: ComponentContext & { data: Record<string, unknown>; record: any }) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null;
        afterCreate?: ((ctx: ComponentContext & { data: Record<string, unknown>; record: any }) => unknown) | null;
        afterUpdate?: ((ctx: ComponentContext & { data: Record<string, unknown>; record: any }) => unknown) | null;
        afterDelete?: ((ctx: ComponentContext & { record: any }) => unknown) | null;
    } = {};
    static make(name: string): Repeater { return configured(new Repeater(name)); }
    /**
     * Item components: a function called for each item, a list (copied for each item), or a `Schema` holding them; a schema
     * with `lazyLoaded()` renders each item's content when the item enters the viewport.
     */
    schema(factory: (() => Component[]) | Component[] | Schema): this {
        this._schemaTemplate = factory instanceof Schema ? factory : null;
        const components = factory instanceof Schema ? () => factory.getComponents() : Array.isArray(factory) ? () => factory : null;
        this._schema = components ? () => components().map(cloneComponentTree) : factory as () => Component[];
        return this;
    }
    /**
     * Key of new items: `null` (default) a random UUID, `false` numeric keys (`0`, `1`…), or a function returning the key.
     * Keys of related records (`record-<id>`) are not affected.
     */
    generateUuidUsing(generator: ItemKeyGenerator): this { this._itemKeyGenerator = generator; return this; }
    /** A new item key (see `generateUuidUsing()`), different from the keys already used. */
    generateUuid(existingKeys: Iterable<string> = Object.keys(this.getItems())): string { return generateItemKey(this._itemKeyGenerator, existingKeys); }
    /**
     * Tests: every repeater made afterwards uses numeric item keys (`0`, `1`, `2`…) instead of UUIDs, so its state can be
     * asserted. Returns a function that restores UUIDs.
     */
    private static activeFakes = 0;
    static fake(): () => void {
        const undo = Repeater.configureUsing((repeater: Repeater) => { repeater.generateUuidUsing(false); });
        Repeater.activeFakes++;
        let undone = false;
        return () => { if (undone) return; undone = true; Repeater.activeFakes--; undo(); };
    }
    /** Whether `fake()` is active (item keys are sequential numbers). */
    static isFake(): boolean { return Repeater.activeFakes > 0; }
    /**
     * Refuses (HTTP 413) a state holding more items than this, before building their schemas: a safety net against a browser
     * sending a huge list. Nothing is truncated; `null` (default) turns it off. `maxItems()` stays the validation limit.
     */
    maxItemsForProcessing(count: number | null): this { this._maxItemsForProcessing = count; return this; }
    getMaxItemsForProcessing(): number | null { return this._maxItemsForProcessing; }
    /** Table repeater: tighter cells, to fit more data. */
    compact(condition: Lazy<boolean, ComponentContext> = true): this { this._compact = condition; return this; }
    async isCompact(): Promise<boolean> { return Boolean(await evaluate(this._compact, this.context())); }
    /** Table display, one column per field. */
    table(columns: TableColumn[]): this { this._columns = columns; return this; }
    isTable(): boolean { return this._columns.length > 0; }
    /**
     * One field per item, without a card: the state is saved as a list of values (`['a@example.com', 'b@example.com']`).
     * The field is cloned for each item.
     */
    simple(field: Field | null): this { this._simple = field; return this; }
    defaultItems(count: number): this { this._defaultItems = count; return this; }
    maxItems(count: Lazy<number, ComponentContext>): this { return this.setLazy('_maxItems', count); }
    /** Minimum number of items, checked on the server. */
    minItems(count: Lazy<number | null, ComponentContext>): this { return this.setLazy('_minItems', count); }
    private _reorderable = true;
    /** `false`: items keep their order (e.g. a relationship without an order column). */
    reorderable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_reorderable', condition); }
    private _dragAndDrop = true;
    /** Move up / move down buttons in each item header, besides drag and drop. */
    reorderableWithButtons(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_reorderableWithButtons', condition); }
    /** `false`: no drag and drop (buttons may still reorder, with `reorderableWithButtons()`). */
    reorderableWithDragAndDrop(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_dragAndDrop', condition); }
    /** Reordering is off with `reorderable(false)`, and for a relationship without `orderColumn()` (the order could not be saved). */
    private isReorderable(): boolean { return this._reorderable && !(this._relationship !== null && this._relationship.orderColumn === null && this._orderColumnPending === null); }
    private canDrag(): boolean { return this.isReorderable() && this._dragAndDrop; }
    private canMove(): boolean { return this.isReorderable() && (this._dragAndDrop || this._reorderableWithButtons); }
    /** Link shown on each row (an item action pointing to a URL). */
    extraItemLink(resolver: (ctx: { item: Record<string, unknown>; key: string }) => ItemLink | null): this { this._itemLinks.push(resolver); return this; }
    /** Items laid out in a grid (`2`, or `{ md: 2, xl: 3 }`). */
    grid(columns: Record<string, number> | number | null = 2): this { this._grid = columns; return this; }
    /** Items can be collapsed from their header; `collapsed()` collapses them on load. */
    collapsible(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_collapsible', condition); }
    collapsed(condition = true): this { this._collapsed = condition; if (condition) this._collapsible = true; return this; }
    /** Keeps each item's collapsed state in the browser (local storage). */
    persistCollapsed(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_persistCollapsed', condition); }
    cloneable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_cloneable', condition); }
    /** `false`: no "Add" button (and adding is refused on the server). */
    addable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_addable', condition); }
    /** `false`: no delete button (and deleting is refused on the server). */
    deletable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_deletable', condition); }
    /** Item header label: a string, or a function of the item's state (`({ state }) => state.name ?? null`). Escaped. */
    itemLabel(label: ((ctx: { state: Record<string, unknown>; key: string; index: number }) => string | null) | string | null): this { this._itemLabel = label; return this; }
    /** Item number after the label. */
    itemNumbers(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_itemNumbers', condition); }
    truncateItemLabel(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_truncateItemLabel', condition); }
    /** `false`: items have no header (and so no buttons): only their fields. */
    itemHeaders(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_itemHeaders', condition); }
    addActionLabel(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_addActionLabel', label); }
    addActionAlignment(alignment: 'start' | 'center' | 'end' | null): this { this._addActionAlignment = alignment; return this; }
    labelBetweenItems(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_labelBetweenItems', label); }
    /**
     * Items are the records of a has-many relationship of the form's model (Objection `relationMappings`): loaded when the form is
     * filled, then created, updated and deleted once the record is saved. `orderColumn()` saves the items' order.
     */
    relationship(name: string | null = null, modifyQueryUsing: ((query: any) => unknown) | null = null, options: { model?: any; modifyRecordsUsing?: ((records: any[], ctx: ComponentContext) => any[] | null | undefined | Promise<any[] | null | undefined>) | null } = {}): this {
        this._relationship = { name: name ?? this._name!, modify: modifyQueryUsing, modifyRecords: options.modifyRecordsUsing ?? null, orderColumn: this._relationship?.orderColumn ?? null, model: options.model ?? null };
        return this;
    }
    /** Changes a related record's data before it fills an item: `({ data }) => data`. */
    mutateRelationshipDataBeforeFillUsing(callback: ((ctx: ComponentContext & { data: Record<string, unknown> }) => Record<string, unknown> | Promise<Record<string, unknown>>) | null): this { this._relationshipHooks.beforeFill = callback; return this; }
    /** Changes a new item's data before its record is created: `({ data }) => data`, or `null` to skip creating it. */
    mutateRelationshipDataBeforeCreateUsing(callback: ((ctx: ComponentContext & { data: Record<string, unknown> }) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null): this { this._relationshipHooks.beforeCreate = callback; return this; }
    /** Changes an existing item's data before its record is saved: `({ data, record }) => data`, or `null` to leave it as is. */
    mutateRelationshipDataBeforeSaveUsing(callback: ((ctx: ComponentContext & { data: Record<string, unknown>; record: any }) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>) | null): this { this._relationshipHooks.beforeSave = callback; return this; }
    /** Runs after a related record is created for a new item: `({ data, record }) => …`. */
    afterCreate(callback: ((ctx: ComponentContext & { data: Record<string, unknown>; record: any }) => unknown) | null): this { this._relationshipHooks.afterCreate = callback; return this; }
    /** Runs after an item's related record is updated: `({ data, record }) => …`. */
    afterUpdate(callback: ((ctx: ComponentContext & { data: Record<string, unknown>; record: any }) => unknown) | null): this { this._relationshipHooks.afterUpdate = callback; return this; }
    /** Runs after the record of a removed item is deleted (the `record` object still holds its attributes): `({ record }) => …`. */
    afterDelete(callback: ((ctx: ComponentContext & { record: any }) => unknown) | null): this { this._relationshipHooks.afterDelete = callback; return this; }
    orderColumn(column: string | null = 'sort'): this { if (this._relationship) this._relationship.orderColumn = column; else this._orderColumnPending = column; return this; }
    private _orderColumnPending: string | null = null;

    private itemComponents(): Component[] {
        if (this._simple) return [(cloneComponentTree(this._simple) as Field).hiddenLabel()];
        return this._schema();
    }
    private itemFields(): Field[] { return this.itemComponents().filter((component): component is Field => component instanceof Field); }
    /** Well-formed items only: keys come from the browser, so only simple keys are kept. */
    getItems(): Record<string, Record<string, unknown>> {
        const state = this.context().state;
        if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
        ensureItemsCanBeProcessed(rawItemCount(state), this._maxItemsForProcessing);
        return Object.fromEntries(Object.entries(state as Record<string, unknown>).filter(([key, item]) => isItemKey(key) && item !== null && typeof item === 'object' && !Array.isArray(item)).slice(0, this._maxItems)) as Record<string, Record<string, unknown>>;
    }
    private setItems(items: Record<string, Record<string, unknown>>): void { writePath(this.livewire as any, this.getStatePath().split('.'), items); }
    private itemDefaults(): Record<string, unknown> {
        const data: Record<string, unknown> = {};
        fillSchema(new Schema(this.container.livewire).statePath('').components(this.itemComponents()), data);
        return data;
    }
    getDefaultState(): unknown {
        const items: Record<string, Record<string, unknown>> = {};
        for (let index = 0; index < this._defaultItems; index++) items[this.generateUuid(Object.keys(items))] = this.itemDefaults();
        return items;
    }
    /** A list (records → `record-<id>` items; simple values → one-field items) or a keyed map, limited to the declared fields. */
    hydrateState(value: unknown): unknown {
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
        ensureItemsCanBeProcessed(rawItemCount(value), this._maxItemsForProcessing);
        if (!Array.isArray(value)) return value && typeof value === 'object' ? value : {};
        const fields = this.itemFields();
        const items: Record<string, Record<string, unknown>> = {};
        for (const row of value.slice(0, this._maxItems) as any[]) {
            if (this._simple) { items[this.generateUuid(Object.keys(items))] = { [this._simple.getName()!]: this._simple.hydrateState(row) }; continue; }
            const key = row && typeof row === 'object' && row.id !== undefined && row.id !== null ? `record-${row.id}` : this.generateUuid(Object.keys(items));
            items[key] = Object.fromEntries(fields.map((field) => [field.getName(), field.hydrateState(row?.[field.getName()!] ?? field.getDefaultState())]));
        }
        return items;
    }
    dehydrateState(): unknown { return Object.fromEntries(Object.keys(this.getItems()).map((key) => [key, {}])); }
    /** Simple repeater: saved as a list of values. */
    finalizeDehydratedState(state: unknown): unknown {
        if (!this._simple || !state || typeof state !== 'object' || Array.isArray(state)) return state;
        const name = this._simple.getName()!;
        return Object.values(state as Record<string, Record<string, unknown>>).map((item) => item?.[name] ?? null);
    }
    getChildSchemas(): Schema[] {
        const container = this.container;
        return Object.keys(this.getItems()).map((key) => {
            const schema = new Schema(container.livewire).key(`${this.getKey()}.${key}`).statePath(`${this.getStatePath()}.${key}`).operation(container.getOperation()).record(container.getRecord()).root(false).parentComponent(this).columns((this as any)._childColumns ?? 1).components(this.itemComponents());
            return this.isTable() ? schema : applyLazyItemSchema(schema, this, this._schemaTemplate);
        });
    }
    private _childColumns: Record<string, number> | number | null = null;
    /** Grid columns inside each item. */
    columns(columns: Record<string, number> | number | null): this { this._childColumns = columns; return this; }
    async getValidationRules(): Promise<Rule[]> {
        const rules: Rule[] = [];
        const count = () => Object.keys(this.getItems()).length;
        if (await this.isRequired()) rules.push({ name: 'required', passes: () => count() > 0, message: (a) => `The ${a} field is required.` });
        if (this._minItems !== null) rules.push({ name: 'min', implicit: true, passes: () => count() >= this._minItems!, message: (a) => `The ${a} field must have at least ${this._minItems} items.` });
        rules.push({ name: 'max', implicit: true, passes: () => count() <= this._maxItems, message: (a) => `The ${a} field must not have more than ${this._maxItems} items.` });
        return [...rules, ...this._rules];
    }

    // ---- relationship
    private relationInfo() {
        const model = modelOfForm(this.context(), this._relationship!.model);
        const relation = model.getRelation(this._relationship!.name);
        return { model, relation, related: relation.relatedModelClass };
    }
    async savesRelationships(): Promise<boolean> { return (await super.savesRelationships()) || this._relationship !== null; }
    private relatedQuery(record: any) {
        const { model } = this.relationInfo();
        const query = model.relatedQuery(this._relationship!.name).for(record[model.idColumn]);
        this._relationship!.modify?.(query);
        return query;
    }
    /** Related records of the owner, ordered, then filtered by `modifyRecordsUsing` (only these items are updated or deleted). */
    private async existingRecords(record: any): Promise<any[]> {
        const { related } = this.relationInfo();
        const query = this.relatedQuery(record);
        if (this._relationship!.orderColumn) query.orderBy(`${related.tableName}.${this._relationship!.orderColumn}`);
        const rows: any[] = await query;
        return this._relationship!.modifyRecords ? ((await this._relationship!.modifyRecords(rows, this.context())) ?? rows) : rows;
    }
    async loadStateFromRelationships(record: any): Promise<{ state: unknown } | null> {
        if (!this._relationship) return super.loadStateFromRelationships(record);
        if (this._orderColumnPending !== null) { this._relationship.orderColumn = this._orderColumnPending; this._orderColumnPending = null; }
        const { related } = this.relationInfo();
        const rows = (await this.existingRecords(record)).slice(0, this._maxItems);
        const fill = this._relationshipHooks.beforeFill;
        const state: Record<string, unknown>[] = [];
        for (const row of rows) {
            const data = fill ? await fill({ ...this.context(), data: { ...row } }) : { ...row };
            state.push({ ...data, id: row[related.idColumn] });
        }
        return { state };
    }
    /** Creates, updates and deletes the related records; only records of this owner (and query) are touched. */
    async saveRelationships(record: any): Promise<void> {
        if (!this._relationship) return super.saveRelationships(record);
        if (this._orderColumnPending !== null) { this._relationship.orderColumn = this._orderColumnPending; this._orderColumnPending = null; }
        const { related } = this.relationInfo();
        const hooks = this._relationshipHooks;
        const existing = new Map((await this.existingRecords(record)).map((row: any) => [String(row[related.idColumn]), row]));
        const keys = Object.keys(this.getItems());
        // The records of removed items are deleted first, one by one, so that `afterDelete()` runs for each.
        const kept = new Set(keys.filter((key) => key.startsWith('record-')).map((key) => key.slice('record-'.length)).filter((id) => existing.has(id)));
        const removed = [...existing.keys()].filter((id) => !kept.has(id));
        if (removed.length) {
            if (hooks.afterDelete) {
                for (const id of removed) { const row = existing.get(id); await related.query().deleteById(row[related.idColumn]); await hooks.afterDelete({ ...this.context(), record: row }); }
            } else await related.query().whereIn(related.idColumn, removed.map((id) => existing.get(id)[related.idColumn])).delete();
        }
        const schemas = this.getChildSchemas();
        let order = 1;
        for (const [index, key] of keys.entries()) {
            let data: Record<string, unknown> | null = await getSchemaState(schemas[index]);
            if (this._relationship.orderColumn) data[this._relationship.orderColumn] = order++;
            const id = key.startsWith('record-') ? key.slice('record-'.length) : null;
            if (id !== null && kept.has(id)) {
                const row = existing.get(id);
                if (hooks.beforeSave) data = await hooks.beforeSave({ ...this.context(), data, record: row });
                if (data === null || data === undefined) continue;
                await related.query().findById(row[related.idColumn]).patch(data);
                await hooks.afterUpdate?.({ ...this.context(), data, record: Object.assign(row, data) });
            } else {
                if (hooks.beforeCreate) data = await hooks.beforeCreate({ ...this.context(), data });
                if (data === null || data === undefined) continue;
                const created = await this.relatedQuery(record).insert(data);
                await hooks.afterCreate?.({ ...this.context(), data, record: created });
            }
        }
    }

    // ---- actions
    private _actionModifiers: Partial<Record<RepeaterActionName, ActionModifier>> = {};
    private _extraItemActions: Action[] = [];
    private _addBetweenLabel: string | null = null;
    /** Customizes the "Add" button (label, icon, color, confirmation modal...). */
    addAction(modify: ActionModifier): this { this._actionModifiers.add = modify; return this; }
    /**
     * "Insert between" button between two items, hidden by default: make it visible with `(action) => action.visible()`
     * (or pass `true`). The new item is inserted after the item whose key is sent as `afterItem`.
     */
    addBetweenAction(modify: ActionModifier | boolean = true): this { this._actionModifiers.addBetween = typeof modify === 'boolean' ? (modify ? (action) => action.visible() : null) : modify; return this; }
    addBetweenActionLabel(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_addBetweenLabel', label); }
    cloneAction(modify: ActionModifier): this { this._actionModifiers.clone = modify; return this; }
    deleteAction(modify: ActionModifier): this { this._actionModifiers.delete = modify; return this; }
    moveUpAction(modify: ActionModifier): this { this._actionModifiers.moveUp = modify; return this; }
    moveDownAction(modify: ActionModifier): this { this._actionModifiers.moveDown = modify; return this; }
    /** Drag and drop: the action runs when a drag changes the order (it may require a confirmation). */
    reorderAction(modify: ActionModifier): this { this._actionModifiers.reorder = modify; return this; }
    /** Collapse / expand buttons (handled in the browser: label, icon and color only, no modal). */
    collapseAction(modify: ActionModifier): this { this._actionModifiers.collapse = modify; return this; }
    expandAction(modify: ActionModifier): this { this._actionModifiers.expand = modify; return this; }
    collapseAllAction(modify: ActionModifier): this { this._actionModifiers.collapseAll = modify; return this; }
    expandAllAction(modify: ActionModifier): this { this._actionModifiers.expandAll = modify; return this; }
    /**
     * Actions added to each item's header. They receive the item key as `arguments.item`, checked on the server (an unknown
     * key is refused), and the repeater as `component`: `component.getItemState(arguments.item)` validates the item.
     */
    extraItemActions(actions: Action[]): this { this._extraItemActions.push(...actions); return this; }
    getExtraItemActions(): Action[] { return this._extraItemActions.map(prepareExtraItemAction); }
    /** Raw state of an item (unvalidated), or `null` for an unknown key. */
    getRawItemState(key: unknown): Record<string, unknown> | null { const items = this.getItems(); return typeof key === 'string' && Object.hasOwn(items, key) ? items[key] : null; }
    private itemSchema(key: unknown): Schema | null { const keys = Object.keys(this.getItems()); const index = typeof key === 'string' ? keys.indexOf(key) : -1; return index < 0 ? null : this.getChildSchemas()[index]; }
    /** State of an item as it would be saved, without validating it. */
    async getItemStateSnapshot(key: unknown): Promise<Record<string, unknown> | null> { const schema = this.itemSchema(key); return schema ? getSchemaState(schema) : null; }
    /**
     * Validated state of an item. If the item is invalid, its errors are shown in the form and the running action is
     * cancelled (its modal closes).
     */
    async getItemState(key: unknown): Promise<Record<string, unknown>> {
        const schema = this.itemSchema(key);
        if (!schema) throw new ActionHalt(true);
        const errors = await validateSchema(schema);
        if (Object.keys(errors).length) { Object.assign(((this.livewire as any)._errors ??= {}), errors); throw new ActionHalt(true); }
        return getSchemaState(schema);
    }
    /** Item actions receive keys from the browser: an action about an item needs an existing item. */
    authorizeActionArguments(name: string, args: Record<string, unknown>): boolean {
        const items = this.getItems();
        const has = (key: unknown) => typeof key === 'string' && Object.hasOwn(items, key);
        if (name === 'addBetween') return has(args.afterItem);
        if (['delete', 'clone', 'moveUp', 'moveDown'].includes(name) || this._extraItemActions.some((action) => action.getName() === name)) return has(args.item);
        return true;
    }
    private repeaterAction(name: RepeaterActionName): Action {
        const tr = (key: string, replace: Record<string, string> = {}) => t(`navette-forms::components.repeater.actions.${key}`, replace);
        const insertAfter = (items: Record<string, Record<string, unknown>>, after: string, key: string, item: Record<string, unknown>) => Object.fromEntries(Object.entries(items).flatMap(([k, v]) => (k === after ? [[k, v], [key, item]] : [[k, v]])));
        const move = (offset: number) => ({ arguments: args }: { arguments: Record<string, unknown> }) => {
            if (!this.canMove()) return;
            const items = this.getItems();
            const keys = Object.keys(items);
            const from = keys.indexOf(String(args.item));
            const to = from + offset;
            if (from < 0 || to < 0 || to >= keys.length) return;
            [keys[from], keys[to]] = [keys[to], keys[from]];
            this.setItems(Object.fromEntries(keys.map((key) => [key, items[key]])));
        };
        let action: Action;
        switch (name) {
            case 'add': action = Action.make('add').label(async () => this._addActionLabel ?? tr('add.label', { label: String((await this.getLabel()) ?? '').toLowerCase() })).color('gray').size('sm')
                .action(() => { const items = this.getItems(); if (!this._addable || Object.keys(items).length >= this._maxItems) return; items[this.generateUuid(Object.keys(items))] = this.itemDefaults(); this.setItems(items); }); break;
            case 'addBetween': action = Action.make('addBetween').label(() => this._addBetweenLabel ?? tr('add_between.label')).color('gray').size('sm').visible(false)
                .action(({ arguments: args }) => {
                    const items = this.getItems();
                    if (!this._addable || Object.keys(items).length >= this._maxItems || typeof args.afterItem !== 'string' || !Object.hasOwn(items, args.afterItem)) return;
                    this.setItems(insertAfter(items, args.afterItem, this.generateUuid(Object.keys(items)), this.itemDefaults()));
                }); break;
            case 'delete': action = Action.make('delete').label(tr('delete.label')).icon(fieldActionIcon('repeater', 'delete')).color('danger').iconButton().size('sm')
                .action(({ arguments: args }) => { const items = this.getItems(); const key = String(args.item); if (!this._deletable || !Object.hasOwn(items, key)) return; delete items[key]; this.setItems(items); }); break;
            case 'clone': action = Action.make('clone').label(tr('clone.label')).icon(fieldActionIcon('repeater', 'clone')).color('gray').iconButton().size('sm')
                .action(({ arguments: args }) => {
                    const items = this.getItems();
                    const key = String(args.item);
                    if (!this._cloneable || !Object.hasOwn(items, key) || Object.keys(items).length >= this._maxItems) return;
                    this.setItems(insertAfter(items, key, this.generateUuid(Object.keys(items)), JSON.parse(JSON.stringify(items[key]))));
                }); break;
            case 'moveUp': action = Action.make('moveUp').label(tr('move_up.label')).icon(fieldActionIcon('repeater', 'move-up')).color('gray').iconButton().size('sm').action(move(-1)); break;
            case 'moveDown': action = Action.make('moveDown').label(tr('move_down.label')).icon(fieldActionIcon('repeater', 'move-down')).color('gray').iconButton().size('sm').action(move(1)); break;
            // Drag and drop: the browser sends the new order, only accepted if it is a permutation of the existing keys.
            case 'reorder': action = Action.make('reorder').label(tr('reorder.label')).icon(fieldActionIcon('repeater', 'reorder')).color('gray').iconButton().size('sm')
                .action(({ arguments: args }) => {
                    if (!this.canDrag()) return;
                    const items = this.getItems();
                    const keys = Object.keys(items);
                    const order = Array.isArray(args.items) ? args.items.map(String) : [];
                    if (order.length !== keys.length || new Set(order).size !== keys.length || !order.every((key) => Object.hasOwn(items, key))) return;
                    this.setItems(Object.fromEntries(order.map((key) => [key, items[key]])));
                }); break;
            case 'collapse': action = Action.make('collapse').label(tr('collapse.label')).icon(fieldActionIcon('repeater', 'collapse')).color('gray').iconButton().size('sm'); break;
            case 'expand': action = Action.make('expand').label(tr('expand.label')).icon(fieldActionIcon('repeater', 'expand')).color('gray').iconButton().size('sm'); break;
            case 'collapseAll': action = Action.make('collapseAll').label(tr('collapse_all.label')).color('gray').link().size('sm'); break;
            case 'expandAll': action = Action.make('expandAll').label(tr('expand_all.label')).color('gray').link().size('sm'); break;
        }
        // The guards (`addable()`, `maxItems()`, `reorderable()`…) may be functions: the handler sees their evaluated values.
        const handler = (action as any)._handler as ((ctx: any) => unknown) | null;
        if (handler) action.action((ctx) => this.withLazyProperties(async () => handler(ctx)));
        return modifyAction(action, this._actionModifiers[name]);
    }

    getActions(): Action[] {
        return [
            ...this.getHintActions(),
            ...(['add', 'addBetween', 'delete', 'clone', 'moveUp', 'moveDown', 'reorder'] as const).map((name) => this.repeaterAction(name)),
            ...this.getExtraItemActions(),
        ];
    }

    private async itemLabelOf(key: string, index: number, item: Record<string, unknown>): Promise<string | null> {
        const label = typeof this._itemLabel === 'function' ? await this._itemLabel({ state: item, key, index }) : this._itemLabel;
        return label === null || label === undefined || label === '' ? null : String(label);
    }

    /** The actions resolved for rendering, and the markup helpers shared by the three layouts. */
    private async renderKit() {
        const key = this.getKey()!;
        const ctx = this.context();
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: key };
        const expression = (action: string, args: Record<string, unknown> | null) => `mountAction(${js(action)}, ${args ? js(args) : '{}'}, ${js(context)})`;
        const actions = Object.fromEntries((['add', 'addBetween', 'delete', 'clone', 'moveUp', 'moveDown', 'reorder', 'collapse', 'expand', 'collapseAll', 'expandAll'] as const).map((name) => [name, this.repeaterAction(name)])) as Record<RepeaterActionName, Action>;
        const resolve = (name: RepeaterActionName, args: Record<string, unknown> = {}) => resolveAction(actions[name], ctx, args);
        const extraItemActions = this.getExtraItemActions();
        /** Extra item actions of an item, each in its `<li>` (or `wrap`). */
        const extraHtml = async (itemKey: string, wrap: (html: string) => string = (html) => `<li x-on:click.stop>${html}</li>`) => {
            const html: string[] = [];
            for (const action of extraItemActions) {
                const args = { item: itemKey };
                action.arguments(args);
                if (await action.isVisible(itemContext(ctx, args))) html.push(wrap(await action.toHtml(itemContext(ctx, args), context)));
            }
            return html;
        };
        /** "Add" (and "Insert between") button: a small gray button, with the action's icon and color if changed. */
        const addButton = (resolved: ResolvedAction, expr: string) => {
            const iconHtml = resolved.icon ? icon(resolved.icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': expr }) }) : '';
            return `<button type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="${cls(['nv-ac-btn-action', 'nv-btn', 'nv-size-sm', ...colorClassesOf(colorManager, 'button', resolved.color, 'gray', [])])}" wire:click="${e(expr)}">${iconHtml}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': expr }), 'sm')}${e(resolved.label)}</button>`;
        };
        return { key, ctx, context, expression, actions, resolve, extraHtml, addButton, hasCustomReorderAction: Boolean(this._actionModifiers.reorder) };
    }

    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager().');
        if (this.isTable()) return this.toTableHtml();
        const id = this.getId();
        const key = this.getKey()!;
        const items = this.getItems();
        const keys = Object.keys(items);
        const schemas = this.getChildSchemas();
        const tr = (name: string, replace: Record<string, string> = {}) => t(`navette-forms::components.repeater.${name}`, replace);
        const kit = await this.renderKit();
        const { expression, resolve } = kit;
        const descriptionId = (itemKey: string) => `${id}-item-${createHash('md5').update(itemKey).digest('hex')}`;
        const danger = colorManager.getComponentClasses('icon-button', 'danger');
        const gray = colorManager.getComponentClasses('icon-button', 'gray');
        const button = (options: { label: string; icon: string; expression: string | null; colors?: string[]; disabled?: boolean; extra?: string }) => {
            const loading = options.expression ? `${icon(options.icon, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': options.expression }) })}${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': options.expression }))}` : icon(options.icon);
            return `<button title="${e(options.label)}"${options.disabled ? ' aria-disabled="true"' : ''} aria-label="${e(options.label)}"${options.disabled ? ' disabled="disabled"' : ''} type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="${cls(['nv-ac-icon-btn-action', 'nv-icon-btn', { 'nv-disabled': options.disabled === true }, 'nv-size-sm', ...(options.colors ?? [])])}"${options.extra ?? ''}${options.expression ? ` wire:click="${e(options.expression)}"` : ''}>${loading}</button>`;
        };
        const colorsOf = (resolved: ResolvedAction, defaultColor: string, defaultClasses: string[]) => colorClassesOf(colorManager, 'icon-button', resolved.color, defaultColor, defaultClasses);
        const reorder = await resolve('reorder');
        const showReorder = this.canDrag() && keys.length > 1 && reorder.visible;
        const reorderHandle = showReorder ? `<li x-on:click.stop>${button({ label: reorder.label, icon: reorder.icon ?? fieldActionIcon('repeater', 'reorder'), expression: null, colors: colorsOf(reorder, 'gray', []), extra: ' x-sortable-handle="x-sortable-handle"' })}</li>` : '';
        const collapse = await resolve('collapse'), expand = await resolve('expand');
        const rows: string[] = [];
        for (const [index, itemKey] of keys.entries()) {
            const isFirst = index === 0, isLast = index === keys.length - 1;
            const args = { item: itemKey };
            const moveButton = async (action: 'moveUp' | 'moveDown', fallbackIcon: string, direction: string, disabled: boolean) => {
                const resolved = await resolve(action, args);
                if (!resolved.visible) return '';
                const expr = expression(action, args);
                return `<li x-on:click.stop${this._reorderableWithButtons ? '' : ' class="nv-sr-only"'}>${button({ label: resolved.label, icon: resolved.icon ?? fallbackIcon, expression: expr, disabled: disabled || resolved.disabled, colors: colorsOf(resolved, 'gray', []), extra: `${this._reorderableWithButtons ? '' : ' tabindex="-1"'} data-reorder-hidden="data-reorder-hidden" data-reorder-direction="${direction}" data-reorder-action="${e(expr)}" aria-describedby="${e(descriptionId(itemKey))}"` })}</li>`;
            };
            const moves = this.canMove() && keys.length > 1 ? [await moveButton('moveUp', fieldActionIcon('repeater', 'move-up'), 'up', isFirst), await moveButton('moveDown', fieldActionIcon('repeater', 'move-down'), 'down', isLast)].filter(Boolean) : [];
            const clone = await resolve('clone', args), del = await resolve('delete', args);
            const cloneButton = this._cloneable && clone.visible ? [`<li x-on:click.stop>${button({ label: clone.label, icon: clone.icon ?? fieldActionIcon('repeater', 'clone'), expression: expression('clone', args), colors: colorsOf(clone, 'gray', gray), disabled: clone.disabled })}</li>`] : [];
            const deleteButton = this._deletable && del.visible ? [`<li x-on:click.stop>${button({ label: del.label, icon: del.icon ?? fieldActionIcon('repeater', 'delete'), expression: expression('delete', args), colors: colorsOf(del, 'danger', danger), disabled: del.disabled })}</li>`] : [];
            const extra = await kit.extraHtml(itemKey);
            const content = await schemas[index].toHtml();
            if (this._simple) {
                const actions = [...(showReorder ? [reorderHandle] : []), ...moves, ...extra, ...cloneButton, ...deleteButton];
                rows.push(`<li wire:key="${e(this.getLivewireKey() ?? '')}.${e(itemKey)}.item" x-sortable-item="${e(itemKey)}" class="nv-fo-simple-repeater-item"><div class="nv-fo-simple-repeater-item-content">${content}</div>${actions.length ? `<ul class="nv-fo-simple-repeater-item-actions">${actions.join('')}</ul>` : ''}</li>`);
            } else {
                const label = await this.itemLabelOf(itemKey, index, items[itemKey]);
                const start = [...(showReorder ? [reorderHandle] : []), ...moves];
                const links = this._itemLinks.map((resolveLink) => resolveLink({ item: items[itemKey], key: itemKey })).filter((link): link is ItemLink => link !== null && safeFileUrl(link.url) !== null)
                    .map((link) => `<li x-on:click.stop><a href="${e(link.url)}" target="_blank" rel="noopener" aria-label="${e(link.label)}" title="${e(link.label)}" class="${cls(['nv-ac-icon-btn-action', 'nv-icon-btn', 'nv-size-sm', ...gray])}">${icon(link.icon)}</a></li>`);
                const end = [
                    ...links,
                    ...extra,
                    ...cloneButton,
                    ...deleteButton,
                    ...(this._collapsible ? [`<li class="nv-fo-repeater-item-header-collapsible-actions" x-on:click.stop="toggleCollapsed"><div class="nv-fo-repeater-item-header-collapse-action">${button({ label: collapse.label, icon: collapse.icon ?? fieldActionIcon('repeater', 'collapse'), expression: null, colors: colorsOf(collapse, 'gray', gray) })}</div><div class="nv-fo-repeater-item-header-expand-action">${button({ label: expand.label, icon: expand.icon ?? fieldActionIcon('repeater', 'expand'), expression: null, colors: colorsOf(expand, 'gray', gray) })}</div></li>`] : []),
                ];
                const hasHeader = this._itemHeaders && (start.length > 0 || label !== null || end.length > 0);
                const header = hasHeader ? `<div${this._collapsible ? ' x-on:click.stop="toggleCollapsed"' : ''} class="nv-fo-repeater-item-header">${start.length ? `<ul class="nv-fo-repeater-item-header-start-actions">${start.join('')}</ul>` : ''}${label !== null ? `<${this._headingTag} class="${cls(['nv-fo-repeater-item-header-label', { 'nv-truncated': this._truncateItemLabel }])}">${e(label)}${this._itemNumbers ? ` ${index + 1}` : ''}</${this._headingTag}>` : ''}${end.length ? `<ul class="nv-fo-repeater-item-header-end-actions">${end.join('')}</ul>` : ''}</div>` : '';
                const itemConfig = { isCollapsed: this._collapsed, collapseKey: this._persistCollapsed ? `navette:repeater:collapsed:${key}-${itemKey}` : null };
                rows.push(`<li wire:ignore.self wire:key="${e(this.getLivewireKey() ?? '')}.${e(itemKey)}.item" x-data="item(${e(js(itemConfig))})" x-on:repeater-expand.window="expandFromEvent" x-on:repeater-collapse.window="collapseFromEvent" x-on:expand="expand" x-sortable-item="${e(itemKey)}" class="${cls(['nv-fo-repeater-item', { 'nv-fo-repeater-item-has-header': hasHeader }])}" x-bind:class="itemClasses">${header}<div x-show="! isCollapsed" class="nv-fo-repeater-item-content">${content}</div></li>`);
            }
            if (!isLast) rows.push(await this.betweenItemsHtml(itemKey, kit, this._simple ? 'nv-fo-simple-repeater' : 'nv-fo-repeater'));
        }
        const prefix = this._simple ? 'nv-fo-simple-repeater' : 'nv-fo-repeater';
        const gridAttributes = this._grid !== null ? new Attributes().grid(this._grid as any).toHtml() : '';
        const gridClass = /class="([^"]*)"/.exec(gridAttributes)?.[1] ?? '';
        const gridStyle = /style="([^"]*)"/.exec(gridAttributes)?.[1] ?? null;
        const list = keys.length ? `<ul x-sortable${gridStyle ? ` style="${gridStyle}"` : ''} data-sortable-animation-duration="300" x-on:end.stop="reorder" x-ref="reorderItems" class="${cls([gridClass, `${prefix}-items`])}">${rows.join('')}</ul>` : '';
        const add = await resolve('add');
        const addHtml = this._addable && add.visible && keys.length < this._maxItems ? `<div class="${cls([`${prefix}-add`, this._addActionAlignment ? `nv-align-${this._addActionAlignment}` : null])}">${kit.addButton(add, expression('add', null))}</div>` : '';
        const collapseAll = await resolve('collapseAll'), expandAll = await resolve('expandAll');
        const link = (resolved: ResolvedAction, click: string) => (resolved.visible ? `<span x-on:click="${click}"><button type="button" class="${cls(['nv-ac-link-action', 'nv-link', 'nv-size-sm', ...colorManager!.getComponentClasses('link', resolved.color)])}">${resolved.icon ? icon(resolved.icon, { size: 'sm' }) : ''}<span class="nv-link-label">${e(resolved.label)}</span></button></span>` : '');
        const collapseLinks = this._collapsible && !this._simple ? link(collapseAll, 'collapseAll') + link(expandAll, 'expandAll') : '';
        const collapseAllHtml = collapseLinks ? `<div class="${cls(['nv-fo-repeater-actions', { 'nv-hidden': keys.length < 2 }])}">${collapseLinks}</div>` : '';
        const itemLabel = tr('reordering.item');
        const descriptions = keys.map((itemKey, index) => `<span class="nv-sr-only" data-reorder-description="${e(itemKey)}" data-reorder-label="${e(itemLabel)}" id="${e(descriptionId(itemKey))}">${e(tr('reordering.position', { label: itemLabel, position: String(index + 1), count: String(keys.length) }))}</span>`).join('');
        const config = { statePath: this.getStatePath(), schemaComponent: key, moveUpAction: 'moveUp', moveDownAction: 'moveDown', reorderAction: 'reorder', message: tr('reordering.moved'), hasCustomReorderAction: kit.hasCustomReorderAction };
        const html = `<div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" data-reorder-owner="data-reorder-owner" data-reorder-items="${e(JSON.stringify(keys))}" x-load="x-load" x-load-src="${e(asset('repeater'))}" x-data="repeaterFormComponent(${e(js(config))})" class="${cls([prefix, { 'nv-collapsible': this._collapsible && !this._simple }])}"><span wire:ignore x-ref="reorderStatus" class="nv-sr-only" role="status" aria-live="polite" aria-atomic="true"></span>${collapseAllHtml}${list}${addHtml}${descriptions}</div>`;
        return this.wrap(html, { labelAsDiv: true });
    }

    /** Between two items: the "Insert between" button when it is visible, else the label between items, if any. */
    private async betweenItemsHtml(afterItem: string, kit: Awaited<ReturnType<Repeater['renderKit']>>, prefix: string): Promise<string> {
        const args = { afterItem };
        const addBetween = await kit.resolve('addBetween', args);
        if (this._addable && addBetween.visible && Object.keys(this.getItems()).length < this._maxItems) return `<li class="nv-fo-repeater-add-between-items-ctn"><div class="nv-fo-repeater-add-between-items">${kit.addButton(addBetween, kit.expression('addBetween', args))}</div></li>`;
        if (this._labelBetweenItems && prefix === 'nv-fo-repeater') return `<li class="nv-fo-repeater-label-between-items-ctn"><div class="nv-fo-repeater-label-between-items-divider-before"></div><span class="nv-fo-repeater-label-between-items">${e(this._labelBetweenItems)}</span><div class="nv-fo-repeater-label-between-items-divider-after"></div></li>`;
        return '';
    }

    private async toTableHtml(): Promise<string> {
        const id = this.getId();
        const key = this.getKey()!;
        const livewireKey = this.getLivewireKey() ?? '';
        const items = this.getItems();
        const keys = Object.keys(items);
        const schemas = this.getChildSchemas();
        const tr = (name: string, replace: Record<string, string> = {}) => t(`navette-forms::components.repeater.${name}`, replace);
        const kit = await this.renderKit();
        const { expression, resolve } = kit;
        const button = 'nv-ac-icon-btn-action nv-icon-btn';
        const loading = (target: string) => `${loadingIndicator(new Attributes({ 'wire:loading.delay.default': '', 'wire:target': target }))}`;
        const actionIcon = (name: string, target: string) => icon(name, { attributes: new Attributes({ 'wire:loading.remove.delay.default': '1', 'wire:target': target }) });
        const itemLabel = tr('reordering.item');
        const descriptionId = (itemKey: string) => `${id}-item-${createHash('md5').update(itemKey).digest('hex')}`;
        const rows: string[] = [];
        const reorder = await resolve('reorder');
        // No reorder column while there is only one row.
        const hasReorderColumn = this.canDrag() && keys.length > 1 && reorder.visible;
        for (const [index, itemKey] of keys.entries()) {
            const args = { item: itemKey };
            const moveButton = async (action: 'moveUp' | 'moveDown', fallbackIcon: string, direction: string, disabled: boolean) => {
                const resolved = await resolve(action, args);
                if (!resolved.visible) return '';
                disabled = disabled || resolved.disabled;
                const expr = expression(action, args);
                return `<div x-on:click.stop class="nv-sr-only"><button title="${e(resolved.label)}" ${disabled ? 'aria-disabled="true" ' : ''}aria-label="${e(resolved.label)}" ${disabled ? 'disabled="disabled" ' : ''}tabindex="-1" type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="${button}${disabled ? ' nv-disabled' : ''} nv-size-sm" data-reorder-hidden="data-reorder-hidden" data-reorder-direction="${direction}" data-reorder-action="${e(expr)}" aria-describedby="${e(descriptionId(itemKey))}" wire:click="${e(expr)}">${actionIcon(resolved.icon ?? fallbackIcon, expr)}${loading(expr)}</button></div>`;
            };
            const cells: string[] = [];
            for (const [column, field] of schemas[index].getComponents().entries()) {
                const verticalAlignment = this._columns[column]?.getVerticalAlignment();
                cells.push(`<td${verticalAlignment ? ` class="nv-vertical-align-${verticalAlignment}"` : ''}>${await field.toSchemaHtml(await field.isVisible())}</td>`);
            }
            // Only local or http(s) URLs: a link built from item data cannot become a `javascript:` URL.
            const links = this._itemLinks.map((resolveLink) => resolveLink({ item: items[itemKey], key: itemKey })).filter((link): link is ItemLink => link !== null && safeFileUrl(link.url) !== null)
                .map((link) => `<div x-on:click.stop><a href="${e(link.url)}" target="_blank" x-tooltip="{
 content: ${e(js(link.label))},
 theme: $store.theme,
 allowHTML: false,
 }" aria-label="${e(link.label)}" class="${button} nv-size-sm">${icon(link.icon)}</a></div>`);
            const extra = await kit.extraHtml(itemKey, (html) => `<div x-on:click.stop>${html}</div>`);
            const del = await resolve('delete', args);
            const deleteExpr = expression('delete', args);
            const reorderCell = hasReorderColumn ? `<td><div class="nv-fo-table-repeater-actions"><div x-on:click.stop><button title="${e(reorder.label)}" aria-label="${e(reorder.label)}" type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="${button} nv-size-sm" x-sortable-handle="x-sortable-handle">${icon(reorder.icon ?? fieldActionIcon('repeater', 'reorder'))}</button></div>${await moveButton('moveUp', fieldActionIcon('repeater', 'move-up'), 'up', index === 0)}${await moveButton('moveDown', fieldActionIcon('repeater', 'move-down'), 'down', index === keys.length - 1)}</div></td>` : '';
            const deleteButton = this._deletable && del.visible ? `<div x-on:click.stop><button title="${e(del.label)}" aria-label="${e(del.label)}" ${del.disabled ? 'disabled="disabled" ' : ''}type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled" class="${[button, 'nv-size-sm', ...colorClassesOf(colorManager, 'icon-button', del.color, 'danger', colorManager!.getComponentClasses('icon-button', 'danger'))].join(' ')}" wire:click="${e(deleteExpr)}">${actionIcon(del.icon ?? fieldActionIcon('repeater', 'delete'), deleteExpr)}${loading(deleteExpr)}</button></div>` : '';
            rows.push(`<tr wire:key="${e(livewireKey)}.${e(itemKey)}.item" x-sortable-item="${e(itemKey)}">${reorderCell}${cells.join('')}<td><div class="nv-fo-table-repeater-actions">${links.join('')}${extra.join('')}${deleteButton}</div></td></tr>`);
        }
        const head = this._columns.map((column) => {
            const classes = cls([{ 'nv-wrapped': column.canHeaderWrap() }, column.getAlignment() ? `nv-align-${column.getAlignment()}` : null]);
            const label = column.isHeaderLabelHidden() ? `<span class="nv-sr-only">${e(column.getLabel())}</span>` : `${e(column.getLabel())}${column.isMarkedAsRequired() ? '<sup class="nv-fo-table-repeater-header-required-mark">*</sup>' : ''}`;
            return `<th scope="col"${classes ? ` class="${classes}"` : ''}${column.getWidth() ? ` style="width: ${e(column.getWidth()!)};"` : ''}>${label}</th>`;
        }).join('');
        const add = await resolve('add');
        const config = { statePath: this.getStatePath(), schemaComponent: key, moveUpAction: 'moveUp', moveDownAction: 'moveDown', reorderAction: 'reorder', message: tr('reordering.moved'), hasCustomReorderAction: kit.hasCustomReorderAction };
        const descriptions = keys.map((itemKey, index) => `<span class="nv-sr-only" data-reorder-description="${e(itemKey)}" data-reorder-label="${e(itemLabel)}" id="${e(descriptionId(itemKey))}">${e(tr('reordering.position', { label: itemLabel, position: String(index + 1), count: String(keys.length) }))}</span>`).join('');
        const table = `<div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" data-reorder-owner="data-reorder-owner" data-reorder-items="${e(JSON.stringify(keys))}" x-load="x-load" x-load-src="${e(asset('repeater'))}" x-data="repeaterFormComponent(${e(js(config))})" class="${cls(['nv-fo-table-repeater', { 'nv-compact': await this.isCompact() }])}"><span wire:ignore x-ref="reorderStatus" class="nv-sr-only" role="status" aria-live="polite" aria-atomic="true"></span><table><thead><tr>${hasReorderColumn ? `<th scope="col" class="nv-fo-table-repeater-empty-header-cell"><span class="nv-sr-only">${e(tr('columns.reorder.label'))}</span></th>` : ''}${head}<th scope="col" class="nv-fo-table-repeater-empty-header-cell"><span class="nv-sr-only">${e(tr('columns.actions.label'))}</span></th></tr></thead><tbody x-sortable data-sortable-animation-duration="300" x-on:end.stop="reorder" x-ref="reorderItems">${rows.join('')}</tbody></table>${this._addable && add.visible && keys.length < this._maxItems ? `<div class="nv-fo-table-repeater-add">${kit.addButton(add, expression('add', null))}</div>` : ''}${descriptions}</div>`;
        return this.wrap(table, { labelAsDiv: true });
    }
}

/** PHP date format (`M j, Y H:i`) to day.js (`MMM D, YYYY HH:mm`). Escaped characters (`\at`) become literals. */
export function phpDateFormatToDayjs(format: string): string {
    const tokens: Record<string, string> = { d: 'DD', D: 'ddd', j: 'D', l: 'dddd', N: 'd', w: 'd', S: '', F: 'MMMM', m: 'MM', M: 'MMM', n: 'M', Y: 'YYYY', y: 'YY', a: 'a', A: 'A', g: 'h', G: 'H', h: 'hh', H: 'HH', i: 'mm', s: 'ss', v: 'SSS', e: 'z', T: 'z', P: 'Z', O: 'ZZ', U: 'X' };
    let out = '';
    for (let index = 0; index < format.length; index++) {
        const char = format[index];
        if (char === '\\' && index + 1 < format.length) { out += `[${format[++index]}]`; continue; }
        out += Object.hasOwn(tokens, char) ? tokens[char] : /[a-zA-Z]/.test(char) ? `[${char}]` : char;
    }
    return out;
}
const pad = (n: number, size = 2) => String(n).padStart(size, '0');
/** `YYYY-MM-DD HH:MM:SS` of a wall-clock time in a time zone, from a UTC instant. */
function formatInZone(date: Date, timeZone: string): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
/** UTC instant of a wall-clock `YYYY-MM-DD HH:MM:SS` in a time zone. */
function zonedToUtc(value: string, timeZone: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
    if (!match) return null;
    const asUtc = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] ?? 0));
    // Offset of the zone at that moment (twice, to settle around DST changes).
    let guess = asUtc;
    for (let i = 0; i < 2; i++) { const shown = Date.parse(formatInZone(new Date(guess), timeZone).replace(' ', 'T') + 'Z'); guess = asUtc - (shown - guess); }
    return new Date(guess);
}
/** Normalizes a date-like value to `YYYY-MM-DD HH:MM:SS` (or null). */
function normalizeDateTime(value: unknown): string | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
    if (typeof value !== 'string' || value === '') return null;
    const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
    if (match) return `${match[1]} ${match[2] ?? '00'}:${match[3] ?? '00'}:${match[4] ?? '00'}`;
    const time = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    return time ? `1970-01-01 ${time[1]}:${time[2]}:${time[3] ?? '00'}` : null;
}

type DateLimit = Lazy<string | null, ComponentContext>;
/**
 * Base of the date, time and date-time pickers: native browser input by default, or a JavaScript picker with
 * `native(false)` (display format, disabled dates, first day of the week, locale). Limits and disabled dates are checked on the server.
 */
abstract class TemporalField extends Field {
    protected abstract hasDate(): boolean;
    protected abstract hasTime(): boolean;
    protected _seconds = true;
    protected _native = true;
    protected _maxDate: DateLimit = null;
    protected _minDate: DateLimit = null;
    protected _displayFormat: string | null = null;
    protected _format: string | null = null;
    protected _firstDayOfWeek = 1;
    protected _disabledDates: Lazy<string[], ComponentContext> = [];
    protected _closeOnDateSelection = false;
    protected _locale: string | null = null;
    protected _timezone: string | null = null;
    protected _hoursStep = 1;
    protected _minutesStep = 1;
    protected _secondsStep = 1;
    protected _defaultFocusedDate: string | null = null;
    protected _temporalPlaceholder: string | null = null;
    seconds(condition = true): this { this._seconds = condition; return this; }
    hasSeconds(): boolean { return this.hasTime() && this._seconds; }
    /** `false`: a JavaScript picker instead of the browser's native input. */
    native(condition = true): this { this._native = condition; return this; }
    isNative(): boolean { return this._native; }
    /** Display format of the JavaScript picker, in PHP's notation (`'d/m/Y'`, `'M j, Y H:i'`). */
    displayFormat(format: Lazy<string | null, ComponentContext>): this { return this.setLazy('_displayFormat', format); }
    /** Format of the saved value, in PHP's notation (`'Y-m-d'` by default for dates, `'Y-m-d H:i:s'` with a time). */
    format(format: Lazy<string | null, ComponentContext>): this { return this.setLazy('_format', format); }
    /** First day of the week in the JavaScript picker: 0 (Sunday) to 6. */
    firstDayOfWeek(day: Lazy<number, ComponentContext>): this { return this.setLazy('_firstDayOfWeek', day, (value) => Math.min(6, Math.max(0, Math.floor(Number(value) || 0)))); }
    weekStartsOnMonday(): this { return this.firstDayOfWeek(1); }
    weekStartsOnSunday(): this { return this.firstDayOfWeek(0); }
    /** Dates that cannot be picked (`YYYY-MM-DD`), also rejected on the server. */
    disabledDates(dates: Lazy<string[], ComponentContext>): this { this._disabledDates = dates; return this; }
    closeOnDateSelection(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_closeOnDateSelection', condition, Boolean); }
    /** Locale of the JavaScript picker's month and day names (`'fr'`). */
    locale(locale: Lazy<string | null, ComponentContext>): this { return this.setLazy('_locale', locale); }
    /** Shows and edits the value in this time zone, while it is saved in UTC (date-time pickers). */
    timezone(timezone: string | null): this { if (timezone !== null) new Intl.DateTimeFormat('en', { timeZone: timezone }); this._timezone = timezone; return this; }
    /**
     * Time zone the value is shown and entered in when the field has a date and a time: `timezone()`, else the global
     * `NavetteTimezone.get()`; `null` when neither is set (the value is shown as stored, in UTC).
     */
    getTimezone(): string | null { return this._timezone ?? (NavetteTimezone.isConfigured() ? NavetteTimezone.get() : null); }
    hoursStep(step: Lazy<number, ComponentContext>): this { return this.setLazy('_hoursStep', step); }
    minutesStep(step: Lazy<number, ComponentContext>): this { return this.setLazy('_minutesStep', step); }
    secondsStep(step: Lazy<number, ComponentContext>): this { return this.setLazy('_secondsStep', step); }
    /** Date focused when the JavaScript picker opens on an empty field. */
    defaultFocusedDate(date: Lazy<string | null, ComponentContext>): this { return this.setLazy('_defaultFocusedDate', date); }
    placeholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_temporalPlaceholder', text); }
    protected _dateOverride: boolean | null = null;
    protected _timeOverride: boolean | null = null;
    /** `false`: no date part (a date-time picker becomes a time picker). Only plain booleans change the picker's shape. */
    date(condition = true): this { this._dateOverride = condition; return this; }
    /** `false`: no time part (a date-time picker becomes a date picker). */
    time(condition = true): this { this._timeOverride = condition; return this; }
    protected _readOnly: Lazy<boolean, ComponentContext> = false;
    /** The value is shown and sent, but cannot be changed (`readonly`; the JavaScript picker does not open). */
    readOnly(condition: Lazy<boolean, ComponentContext> = true): this { this._readOnly = condition; return this; }
    async isReadOnly(): Promise<boolean> { return Boolean(await evaluate(this._readOnly, this.context())); }
    protected _datalist: Lazy<string[], ComponentContext> = [];
    /** Suggestions offered by the browser (`<datalist>`, native picker only), e.g. `['09:00', '12:00']` for a time picker. */
    datalist(options: Lazy<string[], ComponentContext>): this { this._datalist = options; return this; }
    protected _affixes: { prefix: Lazy<string | null, ComponentContext>; suffix: Lazy<string | null, ComponentContext>; prefixIcon: Lazy<string | null, ComponentContext>; suffixIcon: Lazy<string | null, ComponentContext>; prefixIconColor: string | null; suffixIconColor: string | null; prefixActions: Action[]; suffixActions: Action[]; prefixInline: boolean; suffixInline: boolean } = { prefix: null, suffix: null, prefixIcon: null, suffixIcon: null, prefixIconColor: null, suffixIconColor: null, prefixActions: [], suffixActions: [], prefixInline: false, suffixInline: false };
    /** Label shown before the input; `isInline`: inside the input instead of a separate box. */
    prefix(label: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.prefix = label; this._affixes.prefixInline = isInline; return this; }
    suffix(label: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.suffix = label; this._affixes.suffixInline = isInline; return this; }
    prefixIcon(name: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.prefixIcon = name; this._affixes.prefixInline = isInline; return this; }
    suffixIcon(name: Lazy<string | null, ComponentContext>, isInline = false): this { this._affixes.suffixIcon = name; this._affixes.suffixInline = isInline; return this; }
    prefixIconColor(color: string | null): this { this._affixes.prefixIconColor = color; return this; }
    suffixIconColor(color: string | null): this { this._affixes.suffixIconColor = color; return this; }
    /** Icon button before the input, running an action (mounted on the field). */
    prefixAction(action: Action, isInline = false): this { this._affixes.prefixActions = [...this._affixes.prefixActions, action]; this._affixes.prefixInline = isInline; return this; }
    suffixAction(action: Action, isInline = false): this { this._affixes.suffixActions = [...this._affixes.suffixActions, action]; this._affixes.suffixInline = isInline; return this; }
    prefixActions(actions: Action[]): this { this._affixes.prefixActions = actions; return this; }
    suffixActions(actions: Action[]): this { this._affixes.suffixActions = actions; return this; }
    getActions(): Action[] { return [...this.getHintActions(), ...this._affixes.prefixActions, ...this._affixes.suffixActions]; }
    /** Prefix and suffix markup, and whether the input has an inline prefix / suffix. */
    protected async affixesHtml(): Promise<{ prefix: string; suffix: string; inlinePrefix: boolean; inlineSuffix: boolean }> {
        const ctx = this.context();
        const a = this._affixes;
        const actionsHtml = async (actions: Action[]) => { const html: string[] = []; for (const action of actions) if (await action.isVisible(ctx)) html.push(await action.iconButton().size('sm').toHtml(ctx, { schemaComponent: this.getKey() })); return html; };
        const iconHtml = (name: string | null, color: string | null) => (name ? icon(name, { attributes: new Attributes().class(color && color !== 'gray' ? ['nv-color', `nv-color-${color}`] : []) }) : '');
        const prefixLabel = await evaluate(a.prefix, ctx), suffixLabel = await evaluate(a.suffix, ctx);
        const prefixIconName = await evaluate(a.prefixIcon, ctx), suffixIconName = await evaluate(a.suffixIcon, ctx);
        const prefix = inputAffixHtml('prefix', { label: prefixLabel ?? null, icon: iconHtml(prefixIconName ?? null, a.prefixIconColor), actions: await actionsHtml(a.prefixActions), inline: a.prefixInline });
        const suffix = inputAffixHtml('suffix', { label: suffixLabel ?? null, icon: iconHtml(suffixIconName ?? null, a.suffixIconColor), actions: await actionsHtml(a.suffixActions), inline: a.suffixInline });
        // The input's inline classes count every declared affix action, visible or not.
        const inlinePrefix = a.prefixInline && (a.prefixActions.length > 0 || Boolean(prefixIconName) || (prefixLabel !== null && prefixLabel !== undefined && prefixLabel !== ''));
        const inlineSuffix = a.suffixInline && (a.suffixActions.length > 0 || Boolean(suffixIconName) || (suffixLabel !== null && suffixLabel !== undefined && suffixLabel !== ''));
        return { prefix, suffix, inlinePrefix, inlineSuffix };
    }

    private static resolveLimit(date: string): string {
        const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
        return date === 'today' ? day(0) : date === 'tomorrow' ? day(1) : date === 'yesterday' ? day(-1) : date;
    }
    protected async limit(date: DateLimit): Promise<string | null> { const value = await evaluate(date, this.context()); return value ? TemporalField.resolveLimit(String(value)) : null; }
    /** Latest accepted date: `'today'`, a date, or a context function (`({ get }) => get('ends_at')`). */
    maxDate(date: DateLimit): this {
        this._maxDate = date;
        return this.rule({ name: 'before_or_equal', passes: async (v) => { const max = await this.limit(date); return max === null || this.comparable(v) <= this.comparable(max); }, message: (a) => `The ${a} field must be a date before or equal to ${typeof date === 'string' ? date : 'the maximum date'}.` });
    }
    minDate(date: DateLimit): this {
        this._minDate = date;
        return this.rule({ name: 'after_or_equal', passes: async (v) => { const min = await this.limit(date); return min === null || this.comparable(v) >= this.comparable(min); }, message: (a) => `The ${a} field must be a date after or equal to ${typeof date === 'string' ? date : 'the minimum date'}.` });
    }
    /** Comparable string of a value: the date only for date pickers, the time only for time pickers. */
    private comparable(value: unknown): string {
        const normalized = normalizeDateTime(this.toUtc(value)) ?? String(value);
        if (!this.hasTime()) return normalized.slice(0, 10);
        if (!this.hasDate()) return normalized.slice(11, this._seconds ? 19 : 16);
        return normalized;
    }
    async getValidationRules(): Promise<Rule[]> {
        const rules = await super.getValidationRules();
        if (!this.hasDate()) return rules;
        return [...rules,
            { name: 'date', passes: (v) => normalizeDateTime(v) !== null && !Number.isNaN(Date.parse(normalizeDateTime(v)!.replace(' ', 'T') + 'Z')), message: (a) => `The ${a} field must be a valid date.` },
            { name: 'not_in', passes: async (v) => { const disabled = (await evaluate(this._disabledDates, this.context())) ?? []; return !disabled.includes(String(normalizeDateTime(this.toUtc(v)) ?? '').slice(0, 10)); }, message: (a) => `The selected ${a} is invalid.` },
        ];
    }
    /** Record value to form state, shown in the field's time zone. */
    hydrateState(value: unknown): unknown {
        const normalized = normalizeDateTime(value);
        if (normalized === null) return value === undefined ? null : value === '' ? null : typeof value === 'string' ? value : null;
        let local = normalized;
        const zone = this.getTimezone();
        if (zone && this.hasDate() && this.hasTime()) local = formatInZone(new Date(normalized.replace(' ', 'T') + 'Z'), zone);
        return this.stateOf(local);
    }
    /** Form state as the input expects it. */
    protected stateOf(local: string): string {
        if (!this._native) return this.hasDate() ? local : `${new Date().toISOString().slice(0, 10)} ${local.slice(11)}`;
        if (!this.hasTime()) return local.slice(0, 10);
        if (!this.hasDate()) return local.slice(11, this._seconds ? 19 : 16);
        return local.slice(0, this._seconds ? 19 : 16);
    }
    /** Wall-clock value of the field's time zone to UTC. */
    private toUtc(value: unknown): unknown {
        const zone = this.getTimezone();
        if (!zone || !this.hasDate() || !this.hasTime() || typeof value !== 'string') return value;
        const instant = zonedToUtc(value, zone);
        return instant ? normalizeDateTime(instant) : value;
    }
    /** Saved value: in UTC, in `format()` (or the default format). */
    dehydrateState(state: unknown): unknown {
        if (state === '' || state === null || state === undefined) return null;
        const normalized = normalizeDateTime(this.toUtc(typeof state === 'string' ? state.replace('T', ' ') : state));
        if (normalized === null) return state;
        if (this._format) return formatPhpDate(normalized, this._format);
        if (!this.hasTime()) return normalized.slice(0, 10);
        if (!this.hasDate()) return normalized.slice(11, this._seconds ? 19 : 16);
        return normalized;
    }
    protected defaultDisplayFormat(): string {
        if (!this.hasTime()) return 'M j, Y';
        const time = this._seconds ? 'H:i:s' : 'H:i';
        return this.hasDate() ? `M j, Y ${time}` : time;
    }
    protected nativeType(): string { return !this.hasTime() ? 'date' : !this.hasDate() ? 'time' : 'datetime-local'; }

    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const min = await this.limit(this._minDate), max = await this.limit(this._maxDate);
        const wrapper = new Attributes()
            .merge({ 'x-on:focus-input.stop': "$el.querySelector('input:not([type=hidden])')?.focus()" })
            .class(['nv-fo-date-time-picker', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        const model = this.wireModel();
        const isReadOnly = await this.isReadOnly();
        const affixes = await this.affixesHtml();
        if (this._native) {
            const limit = (value: string | null) => (value === null ? null : !this.hasTime() ? value.slice(0, 10) : !this.hasDate() ? (value.length > 8 ? value.slice(11) : value) : value.replace(' ', 'T'));
            const datalist = !isDisabled && !isReadOnly ? ((await evaluate(this._datalist, this.context())) ?? []).map(String) : [];
            const input = new Attributes(this.getExtraControlAttributes())
                .merge({
                    'aria-invalid': this.hasError() ? 'true' : null, disabled: isDisabled, id: this.getId(),
                    list: datalist.length ? `${this.getId()}-list` : null,
                    max: limit(max), min: limit(min), placeholder: this._temporalPlaceholder, readonly: isReadOnly,
                    required: (await this.isRequired()) && !isDisabled && !isReadOnly, step: this.hasTime() && this._seconds ? 1 : null, type: this.nativeType(), [model]: this.getStatePath(),
                })
                .class(['nv-input', { 'nv-input-has-inline-prefix': affixes.inlinePrefix, 'nv-input-has-inline-suffix': affixes.inlineSuffix }]);
            const datalistHtml = datalist.length ? `<datalist id="${e(this.getId())}-list">${datalist.map((option) => `<option value="${e(option)}" />`).join('')}</datalist>` : '';
            return this.wrap(`<div ${wrapper.toHtml()}>${affixes.prefix}<div class="nv-input-wrp-content-ctn"><input ${input.toHtml()} />${datalistHtml}</div>${affixes.suffix}</div>`);
        }
        const id = this.getId();
        const hasDate = this.hasDate(), hasTime = this.hasTime(), hasSeconds = this.hasSeconds();
        const disabledDates = (await evaluate(this._disabledDates, this.context())) ?? [];
        const jsLimit = (value: string | null) => (value === null ? '' : normalizeDateTime(value.length <= 8 ? `1970-01-01 ${value}` : value) ?? value);
        const livewireKey = this.getLivewireKey() ?? '';
        const label = await this.getLabel();
        const tr = (key: string) => t(`navette-forms::components.date_time_picker.${key}`);
        const describedBy = [this.getHelperTextId(), this.hasError() ? `${id}-error` : null].filter(Boolean).join(' ') || null;
        const trigger = new Attributes(this.getExtraInputAttributes()).merge({ 'aria-describedby': describedBy, 'aria-invalid': this.hasError() ? 'true' : null, 'aria-controls': `${id}-panel`, 'aria-expanded': 'false', 'aria-haspopup': 'dialog', disabled: isDisabled, id, placeholder: this._temporalPlaceholder, role: 'combobox', type: 'text' }).class(['nv-fo-date-time-picker-trigger', 'nv-fo-date-time-picker-display-text-input']);
        const config = `dateTimePickerFormComponent({
 defaultFocusedDate: ${js(this._defaultFocusedDate)},
 displayFormat: ${js(phpDateFormatToDayjs(this._displayFormat ?? this.defaultDisplayFormat()))},
 firstDayOfWeek: ${this._firstDayOfWeek},
 hasDate: ${hasDate ? 'true' : 'false'},
 isAutofocused: ${(await this.isAutofocused()) && !isDisabled && !isReadOnly ? 'true' : 'false'},
 locale: ${js(this._locale ?? 'en')},
 shouldCloseOnDateSelection: ${this._closeOnDateSelection ? 'true' : 'false'},
 state: $wire.$entangle(${js(this.getStatePath())}${this.entangleLive() ? ', true' : ''}),
 })`;
        const keyHash = createHash('md5').update(JSON.stringify([disabledDates, isDisabled, max, min, hasDate, hasTime, hasSeconds, ...(isReadOnly ? ['readOnly'] : [])])).digest('hex');
        const events = hasDate
            ? ` x-on:dropdown-escape="if (isOpen()) { closePanel(true); $event.preventDefault() }" x-on:focusout="handleFocusOut($event)" x-on:keydown.escape="if (isOpen()) { $event.preventDefault(); $event.stopPropagation(); closePanel(true) }" x-on:click.outside="isOpen() &amp;&amp; closePanel()" x-on:livewire:navigating.window="closePanel()"`
            : ` x-on:dropdown-escape="if (isOpen()) { $refs.panel.close(); $refs.button.focus(); $event.preventDefault() }" x-on:focusout="if (isOpen() &amp;&amp; ! $el.contains($event.relatedTarget)) $refs.panel.close()" x-on:keydown.esc="isOpen() &amp;&amp; $event.stopPropagation()"`;
        const buttonEvents = isDisabled || isReadOnly ? (!hasDate ? ' x-on:keydown.enter.prevent.stop="if (false) { isOpen() ? selectDate() : togglePanelVisibility() }"' : '') : [
            !hasDate ? ' x-on:keydown.enter.prevent.stop="if (true) { isOpen() ? selectDate() : togglePanelVisibility() }"' : '',
            ' x-on:click="togglePanelVisibility()"',
            hasDate ? ' x-on:keydown="handleTriggerKeydown($event)" x-bind:aria-expanded="isPanelOpen.toString()"' : ' x-on:keydown.arrow-left.prevent.stop="focusPreviousDay()" x-on:keydown.arrow-right.prevent.stop="focusNextDay()" x-on:keydown.arrow-up.prevent.stop="focusPreviousWeek()" x-on:keydown.arrow-down.prevent.stop="focusNextWeek()"',
            ' x-on:keydown.backspace.prevent.stop="clearState()" x-on:keydown.clear.prevent.stop="clearState()" x-on:keydown.delete.prevent.stop="clearState()"',
        ].join('');
        const calendar = hasDate ? `<div class="nv-fo-date-time-picker-panel-header"><select aria-label="${e(tr('month_select.label'))}" x-model="focusedMonth" class="nv-fo-date-time-picker-month-select"><template x-for="(month, index) in months"><option x-bind:value="index" x-text="month"></option></template></select><input type="number" inputmode="numeric" aria-label="${e(tr('year_input.label'))}" x-model.debounce="focusedYear" class="nv-fo-date-time-picker-year-input" /></div><div aria-live="polite" aria-atomic="true" x-text="getCalendarLabel()" class="nv-fo-date-time-picker-calendar-description"></div><div x-ref="calendar" role="grid" tabindex="-1" x-bind:aria-label="getCalendarLabel()" x-on:keydown="handleCalendarKeydown($event)" class="nv-fo-date-time-picker-calendar"><div role="row" class="nv-fo-date-time-picker-calendar-header"><template x-for="(day, index) in dayLabels" x-bind:key="index"><div role="columnheader" x-bind:aria-label="fullDayLabels[index]" x-text="day" class="nv-fo-date-time-picker-calendar-header-day"></div></template></div><template x-for="(week, weekIndex) in weeksInFocusedMonth" x-bind:key="weekIndex"><div role="row" class="nv-fo-date-time-picker-calendar-week"><template x-for="(day, dayIndex) in week" x-bind:key="day ?? ('empty-' + dayIndex)"><div role="gridcell" x-text="day" x-bind:data-date="day ? focusedDate.date(day).format('YYYY-MM-DD') : null" x-bind:aria-label="day ? getDayLabel(day) : null" x-bind:aria-selected="day &amp;&amp; dayIsSelected(day) ? 'true' : 'false'" x-bind:aria-current="day &amp;&amp; dayIsToday(day) ? 'date' : null" x-bind:aria-disabled="day &amp;&amp; dayIsDisabled(day) ? 'true' : 'false'" x-bind:tabindex="day ? (focusedDate.date() === day ? 0 : -1) : null" x-on:focus="day &amp;&amp; setFocusedDay(day)" x-on:click="if (day) { $el.focus(); selectDate(day) }" x-bind:class="{ 'nv-fo-date-time-picker-calendar-day': day, 'nv-fo-date-time-picker-calendar-day-today': day &amp;&amp; dayIsToday(day), 'nv-focused': day &amp;&amp; focusedDate.date() === day, 'nv-selected': day &amp;&amp; dayIsSelected(day), 'nv-disabled': day &amp;&amp; dayIsDisabled(day) }"></div></template></div></template></div>` : '';
        const timeInput = (max: number, step: number, label: string, model: string) => `<input max="${max}" min="0" step="${step}" type="number" inputmode="numeric" aria-label="${e(label)}" x-on:blur="checkTimeInputValidity" x-on:invalid="timeInputInvalid" x-model.debounce="${model}" />`;
        const time = hasTime ? `<div class="nv-fo-date-time-picker-time-inputs">${timeInput(23, this._hoursStep, tr('hour_input.label'), 'hour')}<span class="nv-fo-date-time-picker-time-input-separator">:</span>${timeInput(59, this._minutesStep, tr('minute_input.label'), 'minute')}${hasSeconds ? `<span class="nv-fo-date-time-picker-time-input-separator">:</span>${timeInput(59, this._secondsStep, tr('second_input.label'), 'second')}` : ''}</div>` : '';
        const picker = `<div hidden data-field-accessibility${describedBy ? ` aria-describedby="${e(describedBy)}"` : ''}${this.hasError() ? ' aria-invalid="true"' : ''}></div><div x-load x-load-src="${e(asset('date-time-picker'))}"${this.extraAlpineHtml()} x-data="${e(config)}" wire:ignore wire:key="${e(livewireKey)}.${keyHash}"${events}><input x-ref="maxDate" type="hidden" value="${e(jsLimit(max))}" /><input x-ref="minDate" type="hidden" value="${e(jsLimit(min))}" /><input x-ref="disabledDates" type="hidden" value="${e(JSON.stringify(disabledDates))}" /><input x-ref="button"${buttonEvents} readonly wire:key="${e(livewireKey)}.display-text" x-model="displayText" ${trigger.toHtml()} /><div x-ref="panel" id="${e(id)}-panel" role="dialog" aria-label="${e(label)}" x-cloak${hasDate ? ' x-show="isPanelOpen"' : ' x-float.placement.bottom-start.offset.flip.shift="{ offset: 8 }"'} wire:ignore wire:key="${e(livewireKey)}.panel" class="nv-fo-date-time-picker-panel">${calendar}${time}</div></div>`;
        return this.wrap(`<div ${wrapper.toHtml()}>${affixes.prefix}<div class="nv-input-wrp-content-ctn">${picker}</div>${affixes.suffix}</div>`);
    }
}

/** Formats `YYYY-MM-DD HH:MM:SS` with a PHP date format (the usual tokens). */
function formatPhpDate(value: string, format: string): string {
    const [date, time] = value.split(' ');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second] = (time ?? '00:00:00').split(':').map(Number);
    const tokens: Record<string, () => string> = {
        Y: () => String(year), y: () => pad(year % 100), m: () => pad(month), n: () => String(month), d: () => pad(day), j: () => String(day),
        H: () => pad(hour), G: () => String(hour), h: () => pad(hour % 12 || 12), g: () => String(hour % 12 || 12), i: () => pad(minute), s: () => pad(second),
        A: () => (hour < 12 ? 'AM' : 'PM'), a: () => (hour < 12 ? 'am' : 'pm'), U: () => String(Date.UTC(year, month - 1, day, hour, minute, second) / 1000),
    };
    let out = '';
    for (let index = 0; index < format.length; index++) {
        const char = format[index];
        if (char === '\\' && index + 1 < format.length) { out += format[++index]; continue; }
        out += Object.hasOwn(tokens, char) ? tokens[char]() : char;
    }
    return out;
}

/** Date picker: native `<input type="date">` by default; the saved state is `YYYY-MM-DD`. */
export class DatePicker extends TemporalField {
    static make(name: string): DatePicker { return configured(new DatePicker(name)); }
    protected hasDate(): boolean { return this._dateOverride !== false; }
    protected hasTime(): boolean { return this._timeOverride === true; }
}

/** Time picker: native `<input type="time">` by default; the state is `HH:MM:SS` (`HH:MM` with `seconds(false)`). */
export class TimePicker extends TemporalField {
    static make(name: string): TimePicker { return configured(new TimePicker(name)); }
    protected hasDate(): boolean { return this._dateOverride === true; }
    protected hasTime(): boolean { return this._timeOverride !== false; }
}

/** Date-time picker: native `datetime-local` input by default; the saved state is `YYYY-MM-DD HH:MM:SS`. */
export class DateTimePicker extends TemporalField {
    static make(name: string): DateTimePicker { return configured(new DateTimePicker(name)); }
    protected hasDate(): boolean { return this._dateOverride !== false; }
    protected hasTime(): boolean { return this._timeOverride !== false; }
}

/** Single choice as radio buttons. */
export class Radio extends Field {
    private _options: [string, string][] = [];
    private _descriptions: Record<string, string> = {};
    private _inline = false;
    static make(name: string): Radio { return configured(new Radio(name)); }
    /** Inside a Repeater or Builder: `distinct()` across the items, `live()`, and the same value is removed from the other items when it changes. */
    fixIndistinctState(condition: Lazy<boolean, ComponentContext> = true): this { return applyFixIndistinctState(this, condition); }
    /** Inside a Repeater or Builder: options picked in another item are disabled (with `distinct()` validation and `live()`). */
    disableOptionsWhenSelectedInSiblingRepeaterItems(): this { return applyDisableOptionsWhenSelectedInSiblingRepeaterItems(this); }
    /** Options as pairs, `{ value: label }`, or an enum (its descriptions are used unless `descriptions()` sets others). */
    options(options: Options | Enum<string | number>): this { this._options = optionPairs(options); if (isEnum(options) && !Object.keys(this._descriptions).length) this._descriptions = options.descriptions(); return this; }
    /** Helper text per value, under the option label. */
    descriptions(descriptions: Lazy<Record<string, string>, ComponentContext>): this { return this.setLazy('_descriptions', descriptions, (value) => value ?? {}); }
    /** Options side by side. */
    inline(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_inline', condition, Boolean); }
    private _disableOptionWhen: ((value: string, label: string) => boolean) | null = null;
    /** Options that cannot be picked; they are refused on the server too. */
    disableOptionWhen(condition: ((value: string, label: string) => boolean) | null): this { this._disableOptionWhen = condition; return this; }
    isOptionDisabled(value: string, label: string): boolean { return this._disableOptionWhen ? this._disableOptionWhen(value, label) : false; }
    /** "Yes" (`1`) and "No" (`0`) options. */
    boolean(trueLabel: string | null = null, falseLabel: string | null = null): this {
        return this.options([['1', trueLabel ?? t('navette-forms::components.radio.boolean.true')], ['0', falseLabel ?? t('navette-forms::components.radio.boolean.false')]]);
    }
    async getValidationRules(): Promise<Rule[]> {
        return [...(await super.getValidationRules()), { name: 'in', passes: (v) => this._options.some(([value, label]) => value === String(v) && !this.isOptionDisabled(value, label)), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const isRequired = (await this.isRequired()) && !isDisabled;
        const container = new Attributes()
            .merge({ 'aria-describedby': this.hasError() ? `${id}-error` : null, 'aria-labelledby': `${id}-label`, 'aria-required': isRequired ? 'true' : null, role: 'radiogroup' })
            .class(['nv-fo-radio', this._inline ? 'nv-inline' : null]);
        const items = this._options.map(([value, label]) => {
            const input = new Attributes(this.getExtraInputAttributes())
                .merge({ type: 'radio', disabled: isDisabled || this.isOptionDisabled(value, label), id: `${id}-${value}`, name: id, required: isRequired, value, [this.wireModel()]: this.getStatePath() })
                .class(['nv-radio-input', this.hasError() ? 'nv-invalid' : 'nv-valid']);
            const description = this._descriptions[value] ? `<p class="nv-fo-radio-label-description">${e(this._descriptions[value])}</p>` : '';
            return `<label class="nv-fo-radio-label"><input ${input.toHtml()} /><div class="nv-fo-radio-label-text"><p>${e(label)}</p>${description}</div></label>`;
        });
        return this.wrap(`<div ${container.toHtml()}>${items.join('')}</div>`, { labelAsDiv: true });
    }
}

export class Textarea extends Field {
    private _rows: number | null = null;
    private _maxLength: number | null = null;
    static make(name: string): Textarea { return configured(new Textarea(name)); }
    rows(rows: Lazy<number | null, ComponentContext>): this { return this.setLazy('_rows', rows); }
    maxLength(length: Lazy<number | null, ComponentContext>): this { let last: number | null = null; this.setLazy('_maxLength', length); return this.rule({ name: 'max', passes: (v, ctx) => { last = (ctx.component as any)._maxLength as number | null; return last === null || String(v).length <= last; }, message: (a) => `The ${a} field must not be greater than ${last} characters.` }); }
    private _minLength: number | null = null;
    private _placeholder: string | null = null;
    private _readOnly = false;
    private _autosize = false;
    private _grammarly = true;
    private _trim = false;
    minLength(length: Lazy<number | null, ComponentContext>): this { let last: number | null = null; this.setLazy('_minLength', length); return this.rule({ name: 'min', passes: (v, ctx) => { last = (ctx.component as any)._minLength as number | null; return last === null || String(v).length >= last; }, message: (a) => `The ${a} field must be at least ${last} characters.` }); }
    /** Exact length. */
    length(length: Lazy<number | null, ComponentContext>): this { this.minLength(length); return this.maxLength(length); }
    placeholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_placeholder', text); }
    readOnly(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_readOnly', condition, Boolean); }
    /** The textarea grows with its content. */
    autosize(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_autosize', condition, Boolean); }
    /** Stops the Grammarly extension from analyzing the content. */
    disableGrammarly(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_grammarly', condition, (value) => !value); }
    /** Removes the spaces around the value before it is validated and saved. */
    trim(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_trim', condition); }
    private _stripCharacters: StripCharacters = null;
    /** Characters removed from the value before it is validated and saved. */
    stripCharacters(characters: StripCharacters): this { this._stripCharacters = characters; return this; }
    getStripCharacters(): string[] { return stripCharactersOf(this, this._stripCharacters); }
    hydrateState(value: unknown): unknown { value = stripFromState(value, this.getStripCharacters()); return this._trim && typeof value === 'string' ? value.trim() : value; }
    /** `trim()`: the submitted value is trimmed before it is validated and saved. */
    protected stateForValidation(state: unknown): unknown { state = stripFromState(state, this.getStripCharacters()); return this._trim && typeof state === 'string' ? state.trim() : state; }
    dehydrateState(state: unknown): unknown { state = stripFromState(state, this.getStripCharacters()); return this._trim && typeof state === 'string' ? state.trim() : state; }
    private _cols: Lazy<number | null, ComponentContext> = null;
    /** Width of the textarea, in characters (`cols` attribute). */
    cols(cols: Lazy<number | null, ComponentContext>): this { this._cols = cols; return this; }
    async getCols(): Promise<number | null> { const cols = await evaluate(this._cols, this.context()); return cols === null || cols === undefined || !Number.isFinite(Number(cols)) ? null : Math.floor(Number(cols)); }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        // Initial height: 1.5rem per row plus padding.
        const height = (this._rows ?? 2) * 1.5 + 0.75;
        const textarea = new Attributes(this.getExtraControlAttributes()).merge({
            'aria-invalid': this.hasError() ? 'true' : null, 'data-gramm': this._grammarly ? null : 'false', 'data-gramm_editor': this._grammarly ? null : 'false', 'data-enable-grammarly': this._grammarly ? null : 'false',
            cols: await this.getCols(), disabled: isDisabled, id: this.getId(), maxlength: this._maxLength, minlength: this._minLength, placeholder: this._placeholder, readonly: this._readOnly,
            required: (await this.isRequired()) && !isDisabled && !this._readOnly, rows: this._rows, [this.wireModel()]: this.getStatePath(),
        });
        const wrapper = new Attributes().class(['nv-fo-textarea', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="nv-input-wrp-content-ctn"><div wire:ignore.self${height !== null ? ` style="height: ${height}rem"` : ''}><textarea x-load x-load-src="${e(asset('textarea'))}" x-data="textareaFormComponent({
 initialHeight: ${height ?? 'null'},
 shouldAutosize: ${this._autosize ? 'true' : 'false'},
 state: $wire.$entangle(${e(js(this.getStatePath()))}),
 })" x-model="state" ${textarea.toHtml()}></textarea></div></div></div>`, { wrapperClass: 'nv-fo-textarea-wrp' });
    }
}

/** Tag list input: the state is an array of strings. */
export class TagsInput extends Field {
    private _placeholder: string | null = null;
    private _suggestions: string[] = [];
    private _splitKeys: string[] = [];
    static make(name: string): TagsInput { return configured(new TagsInput(name)); }
    placeholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_placeholder', text); }
    /** Values suggested while typing. */
    suggestions(suggestions: Lazy<string[], ComponentContext>): this { return this.setLazy('_suggestions', suggestions, (list) => (list ?? []).map(String).slice(0, 1000)); }
    /** Keys that confirm the current tag, besides Enter (`['Tab', ',']`). */
    splitKeys(keys: Lazy<string[], ComponentContext>): this { return this.setLazy('_splitKeys', keys, (list) => list ?? []); }
    private _separator: string | null = null;
    private _tagPrefix: string | null = null;
    private _tagSuffix: string | null = null;
    private _reorderable = false;
    private _tagColor: string | null = null;
    private _tagRules: Rule[] = [];
    /** Saves the tags as one string joined with this separator (`'a,b,c'`) instead of a list. */
    separator(separator: string | null = ','): this { this._separator = separator; return this; }
    /** Text shown before / after each tag (not saved). */
    tagPrefix(prefix: Lazy<string | null, ComponentContext>): this { return this.setLazy('_tagPrefix', prefix); }
    tagSuffix(suffix: Lazy<string | null, ComponentContext>): this { return this.setLazy('_tagSuffix', suffix); }
    /** Tags can be reordered by dragging. */
    reorderable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_reorderable', condition); }
    /** Badge color of the tags (`primary` by default). */
    color(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_tagColor', color); }
    /** Rules applied to each tag (e.g. a maximum length); the message names the tag. */
    nestedRecursiveRules(rules: (Rule | string)[]): this { this._tagRules = rules.map((rule) => (typeof rule === 'string' ? stringRule(rule, { numeric: false, name: this._name ?? '' }) : rule)).filter((rule): rule is Rule => rule !== null); return this; }
    getDefaultState(): unknown { return this.resolvedDefault() ?? []; }
    hydrateState(value: unknown): unknown {
        if (typeof value === 'string' && this._separator !== null) value = value === '' ? [] : value.split(this._separator);
        else if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = value === '' ? [] : [value]; } }
        return Array.isArray(value) ? (stripFromState(value.filter((tag) => typeof tag === 'string' || typeof tag === 'number').map((tag) => String(tag).trim()), this.getStripCharacters()) as string[]).filter((tag) => tag !== '') : [];
    }
    private _stripCharacters: StripCharacters = null;
    /** Characters removed from each tag before it is validated and saved. */
    stripCharacters(characters: StripCharacters): this { this._stripCharacters = characters; return this; }
    getStripCharacters(): string[] { return stripCharactersOf(this, this._stripCharacters); }
    protected stateForValidation(state: unknown): unknown { return stripFromState(state, this.getStripCharacters()); }
    /** Only non-empty strings are saved, whatever shape the browser sends (joined with the separator, if any). */
    dehydrateState(state: unknown): unknown {
        const tags = (stripFromState((Array.isArray(state) ? state : []).filter((tag) => typeof tag === 'string' || typeof tag === 'number').map((tag) => String(tag).trim()), this.getStripCharacters()) as string[]).filter((tag) => tag !== '').slice(0, 1000);
        return this._separator !== null ? tags.join(this._separator) : tags;
    }
    async getValidationRules(): Promise<Rule[]> {
        if (!this._tagRules.length) return super.getValidationRules();
        return [...(await super.getValidationRules()), ...this._tagRules.map((rule): Rule => ({
            ...rule,
            passes: async (value: unknown, ctx: any) => { for (const tag of Array.isArray(value) ? value : []) if (!(await rule.passes(tag, ctx))) return false; return true; },
        }))];
    }
    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager().');
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const label = await this.getLabel();
        const wrapper = new Attributes()
            .merge({ 'aria-label': label, role: 'group', 'x-on:focus-input.stop': "$el.querySelector('input')?.focus()" })
            .class(['nv-fo-tags-input', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        const input = new Attributes(this.getExtraInputAttributes())
            .merge({ autocomplete: 'off', disabled: isDisabled, id, list: `${id}-suggestions`, placeholder: this._placeholder ?? t('navette-forms::components.tags_input.placeholder'), type: 'text', 'x-bind': 'input' })
            .class(['nv-input']);
        const badge = ['nv-badge', 'nv-size-md', ...colorManager.getComponentClasses('badge', this._tagColor ?? 'primary'), this._reorderable && !isDisabled ? 'nv-reorderable' : null].filter(Boolean).join(' ');
        const reorderable = this._reorderable && !isDisabled;
        const deleteButton = isDisabled ? '' : `<button type="button" x-on:click.stop="deleteTag(tag)" x-bind:aria-label="'${e(t('navette-forms::components.tags_input.actions.delete.label'))}: ' + tag" class="nv-badge-delete-btn"><span aria-hidden="true" class="nv-badge-delete-btn-icon"></span></button>`;
        return this.wrap(`<div ${wrapper.toHtml()}><div class="nv-input-wrp-content-ctn"><div x-load x-load-src="${e(asset('tags-input'))}"${this.extraAlpineHtml()} x-data="tagsInputFormComponent({
                    state: $wire.$entangle(${e(js(this.getStatePath()))}, ${this.entangleLive() ? 'true' : 'false'}),
                    splitKeys: ${this._splitKeys.length ? e(js(this._splitKeys)) : '[]'},
                    tagAddedMessage: ${e(js(t('navette-forms::components.tags_input.tag_added')))},
                    tagRemovedMessage: ${e(js(t('navette-forms::components.tags_input.tag_removed')))},
                })"><input ${input.toHtml()} /><div x-ref="liveRegion" aria-live="polite" class="nv-sr-only"></div><datalist id="${e(id)}-suggestions">${this._suggestions.map((s) => `<template x-bind:key="${e(js(s))}" x-if="! (state?.includes(${e(js(s))}) ?? true)"><option value="${e(s)}" /></template>`).join('')}</datalist><div wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.${createHash('md5').update(JSON.stringify(this.context().state ?? [])).digest('hex')}"><template x-cloak x-if="state?.length"><div${reorderable ? ' x-on:end.stop="reorderTags($event)" x-sortable data-sortable-animation-duration="300"' : ''} class="nv-fo-tags-input-tags-ctn"><template x-for="(tag, index) in state" x-bind:key="\`\${tag}-\${index}\`"><span${reorderable ? ' x-bind:x-sortable-item="index" x-sortable-handle' : ''} class="${badge}"><span class="nv-badge-label-ctn"><span class="nv-badge-label">${e(this._tagPrefix ?? '')}<span x-text="tag"></span>${e(this._tagSuffix ?? '')}</span></span>${deleteButton}</span></template></div></template></div></div></div></div>`, { wrapperClass: 'nv-fo-tags-input-wrp' });
    }
}

/** On/off switch. */
export class Toggle extends Field {
    static make(name: string): Toggle { return configured(new Toggle(name)); }
    /** Inside a Repeater or Builder: `distinct()` across the items, `live()`, and the same value is removed from the other items when it changes. */
    fixIndistinctState(condition: Lazy<boolean, ComponentContext> = true): this { return applyFixIndistinctState(this, condition); }
    getDefaultState(): unknown { return this.resolvedDefault() ?? false; }
    hydrateState(value: unknown): unknown { return value === true || value === 1 || value === '1'; }
    private _onIcon: string | null = null;
    private _offIcon: string | null = null;
    private _onColor: string | null = null;
    private _offColor: string | null = null;
    private _inline = true;
    /** Icons inside the switch's knob. */
    onIcon(icon: Lazy<string | null, ComponentContext>): this { return this.setLazy('_onIcon', icon); }
    offIcon(icon: Lazy<string | null, ComponentContext>): this { return this.setLazy('_offIcon', icon); }
    /** Colors when on (`primary` by default) and off (`gray`). */
    onColor(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_onColor', color); }
    offColor(color: Lazy<string | null, ComponentContext>): this { return this.setLazy('_offColor', color); }
    /** `false`: the label goes above the switch instead of beside it. */
    inline(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_inline', condition, Boolean); }
    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager().');
        const on = this.context().state === true;
        const colors = colorManager.getComponentClasses('toggle', this._onColor ?? 'primary').join(' ');
        const offColors = this._offColor && this._offColor !== 'gray' ? ` ${colorManager.getComponentClasses('toggle', this._offColor).join(' ')}` : '';
        const onIconHtml = this._onIcon ? icon(this._onIcon, { size: 'xs' }) : '';
        const offIconHtml = this._offIcon ? icon(this._offIcon, { size: 'xs' }) : '';
        const button = new Attributes(this.getExtraAlpineAttributes()).merge({ 'aria-describedby': this.getHelperTextId(), 'aria-checked': on ? 'true' : 'false', disabled: await this.isDisabled(), id: this.getId(), 'wire:target': this.getStatePath() }).class(['nv-fo-toggle', 'nv-toggle']);
        const knob = `<div><div aria-hidden="true">${offIconHtml}</div><div aria-hidden="true">${onIconHtml}</div></div>`;
        const placeholderKnob = `<div><div aria-hidden="true"></div><div aria-hidden="true">${onIconHtml}</div></div>`;
        const control = `<button x-data="{ state: $wire.$entangle(${e(js(this.getStatePath()))}, ${this.entangleLive() ? 'true' : 'false'}) }" x-bind:aria-checked="state ? 'true' : 'false'" x-on:click="state = ! state" x-bind:class="state ? 'nv-toggle-on ${colors}' : 'nv-toggle-off${offColors}'"${on ? ' x-cloak' : ''} role="switch" type="button" ${button.toHtml()}>${knob}</button>${on ? `<div x-cloak="inline-flex" wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.placeholder" class="nv-toggle nv-toggle-on nv-hidden ${colors}">${placeholderKnob}</div>` : ''}`;
        return this._inline ? this.wrap('', { labelPrefix: control }) : this.wrap(control);
    }
}

/** Single choice shown as buttons. */
export class ToggleButtons extends Field {
    private _options: [string, string][] = [];
    private _inline = false;
    private _grouped = false;
    private _colors: Record<string, string> = {};
    private _icons: Record<string, string> = {};
    static make(name: string): ToggleButtons { return configured(new ToggleButtons(name)); }
    /** Inside a Repeater or Builder: `distinct()` across the items, `live()`, and the same value is removed from the other items when it changes. */
    fixIndistinctState(condition: Lazy<boolean, ComponentContext> = true): this { return applyFixIndistinctState(this, condition); }
    /** Inside a Repeater or Builder: options picked in another item are disabled (with `distinct()` validation and `live()`). */
    disableOptionsWhenSelectedInSiblingRepeaterItems(): this { return applyDisableOptionsWhenSelectedInSiblingRepeaterItems(this); }
    /** Sends the state to the server as soon as it changes. */
    /** Color per value (e.g. from an enum). */
    colors(colors: Lazy<Record<string, string>, ComponentContext>): this { return this.setLazy('_colors', colors, (value) => value ?? {}); }
    /** Icon per value. */
    icons(icons: Lazy<Record<string, string>, ComponentContext>): this { return this.setLazy('_icons', icons, (value) => value ?? {}); }
    /** Options as pairs, `{ value: label }`, or an enum (its colors and icons are used unless `colors()` / `icons()` set others). */
    options(options: Options | Enum<string | number>): this {
        this._options = optionPairs(options);
        if (isEnum(options)) {
            if (!Object.keys(this._colors).length) this._colors = options.colors();
            if (!Object.keys(this._icons).length) this._icons = options.icons();
        }
        return this;
    }
    /** Buttons side by side. */
    inline(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_inline', condition, Boolean); }
    /** Buttons joined into a single group. */
    grouped(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_grouped', condition, Boolean); }
    private _multiple = false;
    private _tooltips: Record<string, string> = {};
    private _size: string | null = null;
    private _labelsHidden = false;
    private _fullWidth = false;
    private _columns: number | null = null;
    private _disableOptionWhen: ((value: string, label: string) => boolean) | null = null;
    /** Several buttons can be selected: the state is a list of values. */
    multiple(condition = true): this { this._multiple = condition; return this; }
    /** Tooltip per value. */
    tooltips(tooltips: Lazy<Record<string, string>, ComponentContext>): this { return this.setLazy('_tooltips', tooltips, (value) => value ?? {}); }
    /** Button size: `xs`, `sm`, `md` (default), `lg` or `xl`. */
    size(size: Lazy<'xs' | 'sm' | 'md' | 'lg' | 'xl' | null, ComponentContext>): this { return this.setLazy('_size', size); }
    /** Icons only: the labels stay for screen readers. */
    hiddenButtonLabels(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_labelsHidden', condition, Boolean); }
    /** Buttons stretch to the width of the field. */
    fullWidth(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_fullWidth', condition, Boolean); }
    /** Number of columns the buttons are spread over (from `lg`), when not inline. */
    columns(columns: Lazy<number | null, ComponentContext>): this { return this.setLazy('_columns', columns); }
    private _gridDirection: Lazy<GridDirection | null, ComponentContext> = null;
    /** `'row'`: buttons fill the grid row by row (left to right), instead of column by column (top to bottom, the default). */
    gridDirection(direction: Lazy<GridDirection | null, ComponentContext>): this { this._gridDirection = direction; return this; }
    /** Options that cannot be selected; they are refused on the server too. */
    disableOptionWhen(condition: ((value: string, label: string) => boolean) | null): this { this._disableOptionWhen = condition; return this; }
    isOptionDisabled(value: string, label: string): boolean { return this._disableOptionWhen ? this._disableOptionWhen(value, label) : false; }
    /** "Yes" (`1`) and "No" (`0`) buttons, green and red, with check and cross icons. */
    boolean(trueLabel: string | null = null, falseLabel: string | null = null): this {
        this.options([['1', trueLabel ?? t('navette-forms::components.toggle_buttons.boolean.true')], ['0', falseLabel ?? t('navette-forms::components.toggle_buttons.boolean.false')]]);
        this._colors = { 1: 'success', 0: 'danger', ...this._colors };
        this._icons = { 1: icons.resolve('forms::components.toggle-buttons.boolean.true') ?? 'o-check', 0: icons.resolve('forms::components.toggle-buttons.boolean.false') ?? 'o-x-mark', ...this._icons };
        return this;
    }
    getDefaultState(): unknown { return this.resolvedDefault() ?? (this._multiple ? [] : null); }
    hydrateState(value: unknown): unknown {
        if (!this._multiple) return value;
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = value === '' ? [] : [value]; } }
        return (Array.isArray(value) ? value : []).map(String);
    }
    /** Multiple: only offered values, in option order. */
    dehydrateState(state: unknown): unknown {
        if (!this._multiple) return state;
        const chosen = new Set((Array.isArray(state) ? state : []).map(String));
        return this._options.map(([value]) => value).filter((value) => chosen.has(value));
    }
    async getValidationRules(): Promise<Rule[]> {
        const allowed = (v: unknown) => this._options.some(([value, label]) => value === String(v) && !this.isOptionDisabled(value, label));
        return [...(await super.getValidationRules()), { name: 'in', passes: (v) => (this._multiple ? Array.isArray(v) && v.every(allowed) : allowed(v)), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(): Promise<string> {
        if (!colorManager) throw new Error('No color manager: call useColorManager().');
        const id = this.getId();
        const isDisabled = await this.isDisabled();
        const isRequired = (await this.isRequired()) && !isDisabled;
        const describedBy = [isRequired ? `${id}-required` : null, this.hasError() ? `${id}-error` : null].filter(Boolean).join(' ') || null;
        const container = new Attributes()
            .merge({ 'aria-describedby': describedBy, 'aria-labelledby': `${id}-label`, 'aria-required': isRequired ? 'true' : null, role: 'radiogroup', 'wire:key': `${this.getLivewireKey()}.inputs` })
            .class(['nv-fo-toggle-buttons', this._grouped ? 'nv-btn-group' : null, !this._grouped && this._inline ? 'nv-inline' : null, { 'nv-width-full': this._fullWidth }]);
        if (this._multiple) container.merge({ role: 'group', 'aria-required': null });
        const grid = !this._grouped && !this._inline && this._columns && this._columns > 1 ? ` ${optionsGridAttributes(this._columns, await evaluate(this._gridDirection, this.context()), null)}` : '';
        const manager = colorManager;
        const button = (value: string, disabled: boolean) => ['nv-btn', this._grouped ? 'nv-btn-group-btn' : null, `nv-size-${this._size ?? 'md'}`, disabled ? 'nv-disabled' : null, ...manager.getComponentClasses('button', this._colors[value] ?? 'primary')].filter(Boolean).join(' ');
        const items = this._options.map(([value, label]) => {
            const optionDisabled = this.isOptionDisabled(value, label);
            const input = new Attributes(this.getExtraInputAttributes()).merge({ id: `${id}-${value}`, name: this._multiple ? null : id, type: this._multiple ? 'checkbox' : 'radio', value, [this.wireModel()]: this.getStatePath(), disabled: isDisabled || optionDisabled, 'aria-label': this._labelsHidden ? label : null, required: isRequired && !this._multiple && !optionDisabled, 'aria-describedby': describedBy }).class(['nv-fo-toggle-buttons-input']);
            const tooltip = this._tooltips[value] ? ` x-tooltip="${e(`{ content: ${js(this._tooltips[value])}, theme: $store.theme, allowHTML: false }`)}"` : '';
            const iconSize = this._size === 'xs' || this._size === 'sm' ? 'sm' : undefined;
            const html = `<input ${input.toHtml()} /><label for="${e(`${id}-${value}`)}"${tooltip}${this._labelsHidden ? ` aria-label="${e(label)}"` : ''} class="${button(value, optionDisabled)}">${this._icons[value] ? icon(this._icons[value], iconSize ? { size: iconSize } : {}) : ''}${this._labelsHidden ? '' : e(label)}</label>`;
            return this._grouped ? html : `<div class="nv-fo-toggle-buttons-btn-ctn">${html}</div>`;
        });
        const after = isRequired ? `<span id="${e(id)}-required" class="nv-sr-only">${e(t('navette-forms::components.toggle_buttons.required_description'))}</span>` : '';
        return this.wrap(`<div ${container.toHtml()}>${grid ? `<div${grid}>${items.join('')}</div>` : items.join('')}</div>`, { wrapperClass: 'nv-fo-toggle-buttons-wrp', labelAsDiv: true, focusable: true, after });
    }
}

// Server-side TipTap schema: the nodes and marks the rich editor can produce, and the extensions your application registers.
/** Options of the server schema of one editor or renderer: allowed link protocols, extensions of its plugins. */
export type RichSchemaOptions = { linkProtocols?: string[] | null; extensions?: Extensions };
/** Link protocols allowed by default (TipTap's list). */
export const DEFAULT_LINK_PROTOCOLS = ['http', 'https', 'ftp', 'ftps', 'mailto', 'tel', 'callto', 'sms', 'cid', 'xmpp'];
/** A link is kept if it has no scheme (`/page`, `#anchor`) or one of the allowed protocols. */
export function isAllowedLinkUrl(url: unknown, protocols: string[] = DEFAULT_LINK_PROTOCOLS): boolean {
    if (typeof url !== 'string') return false;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url.replace(/[\s\u0000-\u001f]/g, ''));
    return !scheme || protocols.some((protocol) => protocol.toLowerCase() === scheme[1].toLowerCase());
}
const richExtensions = (options: RichSchemaOptions = {}) => [
    options.linkProtocols ? StarterKit.configure({ link: { protocols: options.linkProtocols, isAllowedUri: (url: string) => isAllowedLinkUrl(url, options.linkProtocols!) } }) : StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'start' }), Subscript, Superscript, Highlight, SizedImage, TableKit, ...RICH_CONTENT_EXTENSIONS, ...customRichContentExtensions, ...(options.extensions ?? []),
];
type RichDocument = { type: 'doc'; content?: unknown[] };
const isRichDocument = (value: unknown): value is RichDocument => !!value && typeof value === 'object' && (value as any).type === 'doc';
const richText = (node: any): string => (typeof node?.text === 'string' ? node.text : '') + (Array.isArray(node?.content) ? node.content.map(richText).join('') : '');
const hasRichContent = (node: any): boolean => ['image', 'horizontalRule', 'mergeTag', 'mention', 'customBlock', 'details'].includes(node?.type) || (Array.isArray(node?.content) && node.content.some(hasRichContent));
/** Stored HTML → TipTap document. Parsing drops anything the schema does not know (scripts, event attributes, `javascript:` links). */
export function richHtmlToDocument(html: string | null | undefined, options: RichSchemaOptions = {}): RichDocument { return generateJSON(html ?? '', richExtensions(options)) as RichDocument; }
/**
 * TipTap document → HTML to save, or null if empty or invalid. The document comes from the browser,
 * so it is rendered then re-parsed to keep only what the schema accepts.
 */
/** HTML of a document already sanitized (`RichContentRenderer`): no re-parsing. */
export function renderRichDocument(document: unknown, options: RichSchemaOptions = {}): string { return generateHTML(document as any, richExtensions(options)); }
/** Plain text of a document: blocks separated by blank lines. */
export function richDocumentToText(document: unknown, options: RichSchemaOptions = {}): string { return isRichDocument(document) ? generateText(document as any, richExtensions(options), { blockSeparator: '\n\n' }).trim() : ''; }
export function richDocumentToHtml(document: unknown, options: RichSchemaOptions = {}): string | null {
    if (!isRichDocument(document)) return null;
    try {
        const extensions = richExtensions(options);
        const clean = generateJSON(generateHTML(document as any, extensions), extensions);
        return richText(clean).trim() === '' && !hasRichContent(clean) ? null : generateHTML(clean, extensions);
    } catch { return null; }
}

/**
 * Rich text editor: the browser works on a TipTap document, the database receives HTML (or the JSON document with `json()`).
 */
/**
 * Stores a file uploaded by an editor (`componentFileAttachments.<state path>[.<id>]`): type checked on the file's content, size,
 * then stored; the reference is consumed. Returns the public URL (local or http(s) only).
 */
async function storeEditorAttachment(field: Field, id: string | null, options: { storage: FileStorage | null; directory: string | null; types: string[]; maxSize: number }): Promise<string | null> {
    if (!options.storage) return null;
    const livewire = field.livewire as any;
    const segments = field.getStatePath().split('.');
    const holder = readPath(livewire.componentFileAttachments ?? {}, id === null ? segments.slice(0, -1) : segments) as Record<string, unknown> | undefined;
    const name = id ?? segments[segments.length - 1];
    if (!holder || typeof holder !== 'object' || !Object.hasOwn(holder, name)) return null;
    const uploads = livewire._runtime?.uploads;
    const file = uploads?.resolve(holder[name]) as TemporaryUpload | null;
    delete holder[name];
    if (!file || !options.types.includes(file.type) || file.size > options.maxSize * 1024) return null;
    const key = await options.storage.store(file, options.directory);
    uploads.remove(file.id);
    const info = await options.storage.info(key);
    return info ? safeFileUrl(info.url) : null;
}
/** Tools of the rich editor's toolbar, in their default groups. */
export const RICH_EDITOR_TOOLS = [['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'link'], ['h2', 'h3'], ['alignStart', 'alignCenter', 'alignEnd'], ['blockquote', 'codeBlock', 'bulletList', 'orderedList'], ['table', 'attachFiles'], ['undo', 'redo']];
/** The editor selection sent by the browser with a toolbar action. */
const selectionOf = (args: Record<string, unknown>) => (args.editorSelection ?? null) as { head?: unknown; anchor?: unknown; type?: string } | null;
const BUILT_IN_TOOLS = new Map(RICH_EDITOR_TOOL_DEFINITIONS.map((definition) => [definition.name, definition]));
/** Custom blocks of an editor: a list, or groups of blocks by label. */
export type CustomBlocks = CustomBlockClass[] | Record<string, CustomBlockClass[]>;

/**
 * Rich text editor (TipTap): the browser works on a document, the database receives HTML (or JSON with `json()`).
 * Besides the starter kit: text colors, merge tags, mentions, custom blocks, columns, resizable images, and your own
 * tools and TipTap extensions.
 */
export class RichEditor extends Field {
    private _toolbar: ToolbarItems | null = null;
    private _toolbarModifications: ToolbarModification[] = [];
    private _floatingToolbars: Record<string, ToolbarItem[]> | null = null;
    private _plugins: RichContentPlugin[] = [];
    private _linkProtocols: string[] | null = null;
    private _minHeight: Lazy<string | null, ComponentContext> = '10rem';
    private _maxHeight: Lazy<string | null, ComponentContext> = null;
    private _stickyPanels: Lazy<boolean, ComponentContext> = false;
    private _stickyOffset: Lazy<string | null, ComponentContext> = null;
    private _uploadingFileMessage: string | null = null;
    private _attachmentsVisibility: Lazy<AttachmentsVisibility, ComponentContext> = 'public';
    private _getFileAttachmentUrlUsing: ((file: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
    private _saveUploadedFileAttachmentUsing: ((file: TemporaryUpload, ctx: ComponentContext) => string | null | Promise<string | null>) | null = null;
    private _preventAttachmentTampering: Lazy<boolean, ComponentContext> = true;
    private _allowFileAttachmentPathUsing: ((file: string, ctx: ComponentContext) => boolean | Promise<boolean>) | null = null;
    private _json = false;
    private _richPlaceholder: string | null = null;
    private _attachmentsStorage: FileStorage | null = null;
    private _attachmentsDirectory: string | null = null;
    private _attachmentTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    private _attachmentMaxSize = 12288;
    private _customTools: RichEditorTool[] = [];
    private _textColors: Record<string, TextColor> | null = null;
    private _customTextColors = false;
    private _mergeTags: Record<string, string> = {};
    private _noMergeTagResults: string | null = null;
    private _mentions: MentionProvider[] = [];
    private _customBlocks: CustomBlocks = [];
    private _minimalCustomBlockControls = false;
    private _customBlocksGrid = false;
    private _searchableCustomBlocks = false;
    private _activePanel: string | null = null;
    private _stickyToolbar = false;
    private _resizableImages = false;
    private _jsExtensions: string[] = [];
    private _editorActions: Action[] = [];
    private _attachmentProvider: FileAttachmentProvider | null = null;
    private _attachmentsVisibilitySet = false;
    /** Record created by the form, while the editor saves its content to it (`saveRelationships()`). */
    private _createdRecord: unknown = null;
    private _contentAttributeApplied = false;
    static make(name: string): RichEditor { return configured(new RichEditor(name)); }
    /**
     * Fake rich content for seeders and tests: chain blocks, then `toHtml()`, `toArray()` or `toValue()`. With `editor`, its
     * merge tags, mentions, custom blocks, text colors, plugins, link protocols and JSON mode are used; `seed` makes the output
     * reproducible.
     */
    static fake(options: RichContentFakerOptions = {}): RichContentFaker { return RichContentFaker.make(options); }
    /**
     * Toolbar tools, by group (`[['bold', 'italic', 'link'], ['h2', 'h3'], ['undo', 'redo']]`); see `RICH_EDITOR_TOOLS` and
     * `RICH_EDITOR_TOOL_DEFINITIONS`. A group may hold dropdowns: `[ToolbarButtonGroup.make('Alignment', ['alignStart', 'alignEnd'])]`.
     */
    toolbarButtons(groups: ToolbarItems | null): this {
        this._toolbar = groups;
        this._toolbarModifications = [];
        this.assertKnownTools(groups ?? []);
        return this;
    }
    private assertKnownTools(items: ToolbarItems): void {
        const unknown = toolbarButtonNames(items).filter((tool) => !this.findTool(tool));
        if (unknown.length) throw new Error(`RichEditor: unknown toolbar buttons ${unknown.join(', ')} (available: ${[...BUILT_IN_TOOLS.keys(), ...this._customTools.map((tool) => tool.getName())].join(', ')}).`);
    }
    /** Removes buttons (also inside dropdown groups); with no argument, removes them all. */
    disableToolbarButtons(tools: string[] = []): this { this._toolbarModifications.push(tools.length ? { type: 'disable', buttons: tools } : { type: 'disableAll' }); return this; }
    disableAllToolbarButtons(condition = true): this { if (condition) this._toolbarModifications.push({ type: 'disableAll' }); return this; }
    /** Adds buttons (or groups, as arrays) after the current ones; buttons already in the toolbar are skipped. */
    enableToolbarButtons(tools: ToolbarItems = []): this { this.assertKnownTools(tools); this._toolbarModifications.push({ type: 'enable', buttons: tools }); return this; }
    /** Whether the toolbar holds a tool (or every tool of a list). */
    hasToolbarButton(button: string | string[]): boolean { const names = toolbarButtonNames(this.getToolbarButtons()); return [button].flat().every((name) => names.includes(name)); }
    /**
     * Toolbars shown next to the cursor while it is inside a node: `{ paragraph: ['bold', 'italic'], table: ['tableAddRowAfter'] }`.
     * The default shows the table and grid tools inside tables and grids. `null` restores it, `{}` removes them.
     */
    floatingToolbars(toolbars: Record<string, ToolbarItem[]> | null): this {
        this._floatingToolbars = toolbars;
        this.assertKnownTools(Object.values(toolbars ?? {}).flat());
        return this;
    }
    getFloatingToolbars(): Record<string, ToolbarItem[]> {
        return this._floatingToolbars ?? {
            grid: ['gridAddColumnBefore', 'gridAddColumnAfter', 'gridDeleteColumn', 'gridDelete'],
            table: ['tableAddColumnBefore', 'tableAddColumnAfter', 'tableDeleteColumn', 'tableAddRowBefore', 'tableAddRowAfter', 'tableDeleteRow', 'tableMergeCells', 'tableSplitCell', 'tableToggleHeaderRow', 'tableToggleHeaderCell', 'tableDelete'],
        };
    }
    /** Minimum height of the content (a CSS length, `10rem` by default; `null`: the intrinsic `3rem`). */
    minHeight(height: Lazy<string | null, ComponentContext>): this { this._minHeight = height; return this; }
    /** Maximum height of the content: beyond it, the content scrolls (`null`: no limit). */
    maxHeight(height: Lazy<string | null, ComponentContext>): this { this._maxHeight = height; return this; }
    getMinHeight(): Promise<string | null> { return evaluate(this._minHeight, this.context()); }
    getMaxHeight(): Promise<string | null> { return evaluate(this._maxHeight, this.context()); }
    /** Keeps the custom blocks and merge tags panels visible while scrolling (when they are beside the content). */
    stickyPanels(condition: Lazy<boolean, ComponentContext> = true): this { this._stickyPanels = condition; return this; }
    hasStickyPanels(): Promise<boolean> { return evaluate(this._stickyPanels, this.context()).then(Boolean); }
    /** Distance from the top of the viewport of the sticky toolbar and panels (a CSS length; `null`: automatic). */
    stickyOffset(offset: Lazy<string | null, ComponentContext>): this { this._stickyOffset = offset; return this; }
    getStickyOffset(): Promise<string | null> { return evaluate(this._stickyOffset, this.context()); }
    /** Protocols allowed in links (`http`, `https`, `ftp`, `ftps`, `mailto`, `tel`, `callto`, `sms`, `cid`, `xmpp` by default). Checked on the server. */
    linkProtocols(protocols: string[] | null): this { this._linkProtocols = protocols === null ? null : protocols.map((protocol) => protocol.toLowerCase().replace(/:$/, '')).filter((protocol) => /^[a-z][a-z0-9+.-]*$/.test(protocol)); return this; }
    getLinkProtocols(): string[] { this.applyContentAttribute(); return this._linkProtocols ?? DEFAULT_LINK_PROTOCOLS; }
    /** Plugins: TipTap extensions (server and browser), toolbar tools and their actions. */
    plugins(plugins: RichContentPlugin[]): this { this._plugins = [...this._plugins, ...plugins]; return this; }
    getPlugins(): RichContentPlugin[] { this.applyContentAttribute(); return this._plugins; }
    isJson(): boolean { this.applyContentAttribute(); return this._json; }
    getMergeTags(): Record<string, string> { this.applyContentAttribute(); return { ...this._mergeTags }; }
    getMentionProviders(): MentionProvider[] { this.applyContentAttribute(); return [...this._mentions]; }
    /** Custom blocks of the editor, ungrouped. */
    getCustomBlocks(): CustomBlockClass[] { return this.blockGroups().flatMap(([, blocks]) => blocks); }
    /** Storage HTML of a document, sanitized by this editor's schema (used by `RichEditor.fake({ editor })`). */
    async dehydrateRichDocument(document: unknown): Promise<string | null> { return richDocumentToHtml(document, this.schemaOptions()); }
    /** A renderer configured like this editor: custom blocks, mentions, plugins, link protocols and attachments. */
    getRenderer(content: unknown): RichContentRenderer {
        this.applyContentAttribute();
        return RichContentRenderer.make(content).fileAttachmentProvider(this._attachmentProvider, this.attachmentRecord(), this.getName()).customBlocks(this.getCustomBlocks()).mentions(this._mentions).plugins(this._plugins).linkProtocols(this._linkProtocols)
            .fileAttachmentsStorage(this.attachmentsStorage()).fileAttachmentsVisibility(typeof this._attachmentsVisibility === 'function' ? 'public' : this._attachmentsVisibility).getFileAttachmentUrlUsing(this._getFileAttachmentUrlUsing ? (file) => this._getFileAttachmentUrlUsing!(file, this.context()) : null);
    }
    /** Rendered HTML of a document, as `getRenderer()` renders it. */
    async renderRichDocument(document: unknown): Promise<string> { return this.getRenderer(document).toHtml(); }
    /** Server schema of this editor: link protocols and plugin extensions. */
    /**
     * Options left unset default to the rich content attribute the record registers under the field's name
     * (`registerRichContent()` of `InteractsWithRichContent`); plugins are added to the editor's.
     */
    private applyContentAttribute(): void {
        if (this._contentAttributeApplied || !this.container) return;
        const record = this.container.getRecord();
        if (!record) return;
        this._contentAttributeApplied = true;
        const attribute = getRichContentAttribute(record, this.getName());
        if (!attribute) return;
        if (!this.blockGroups().some(([, blocks]) => blocks.length) && attribute.customBlocksValue) this._customBlocks = attribute.customBlocksValue;
        if (!Object.keys(this._mergeTags).length && attribute.mergeTagsValue) this._mergeTags = attribute.getMergeTagLabels();
        if (!this._mentions.length && attribute.mentionsValue) this._mentions = [...attribute.mentionsValue];
        if (attribute.pluginsValue.length) this._plugins = [...attribute.pluginsValue.filter((plugin) => !this._plugins.includes(plugin)), ...this._plugins];
        if (this._linkProtocols === null && attribute.linkProtocolsValue) this.linkProtocols(attribute.linkProtocolsValue);
        if (this._json === false && attribute.jsonValue) this._json = true;
        if (this._textColors === null && attribute.textColorsValue) this.textColors(attribute.textColorsValue);
        if (!this._customTextColors && attribute.customTextColorsValue) this._customTextColors = true;
        if (this._attachmentsStorage === null && attribute.fileAttachmentsStorageValue) this._attachmentsStorage = attribute.fileAttachmentsStorageValue;
        if (this._attachmentProvider === null && attribute.fileAttachmentProviderValue) this._attachmentProvider = attribute.fileAttachmentProviderValue;
        const visibility = attribute.getFileAttachmentsVisibility();
        if (!this._attachmentsVisibilitySet && visibility) this._attachmentsVisibility = visibility;
    }
    context(): ComponentContext { this.applyContentAttribute(); return super.context(); }
    private schemaOptions(): RichSchemaOptions { this.applyContentAttribute(); return { linkProtocols: this._linkProtocols, extensions: this._plugins.flatMap((plugin) => plugin.getTipTapServerExtensions()) }; }
    /** Message shown while an image uploads. */
    uploadingFileMessage(message: string | null): this { this._uploadingFileMessage = message; return this; }
    getUploadingFileMessage(): string { return this._uploadingFileMessage ?? t('navette-forms::components.rich_editor.uploading_file_message'); }
    /** Your own toolbar buttons (or replacements of built-in ones, by name); place them with `toolbarButtons()`. */
    tools(tools: RichEditorTool[]): this { this._customTools = [...this._customTools.filter((tool) => !tools.some((other) => other.getName() === tool.getName())), ...tools]; return this; }
    /** Actions mounted by your tools (`RichEditorTool.make('x').action()`), run with the editor selection in `arguments.editorSelection`. */
    editorActions(actions: Action[]): this { this._editorActions = [...this._editorActions, ...actions]; return this; }
    /** Browser TipTap extensions: URLs of ES modules exporting an extension (or an array of them). Register their server side with `registerRichContentExtensions()`. */
    extensions(urls: string[]): this { this._jsExtensions = [...this._jsExtensions, ...urls]; return this; }
    /** Saves the content as the editor's JSON document instead of HTML. */
    json(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_json', condition); }
    placeholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_richPlaceholder', text); }
    /** Where files attached in the editor are stored (`FileUpload.storage` by default); without storage, attaching is off. */
    fileAttachmentsStorage(storage: FileStorage | null): this { this._attachmentsStorage = storage; return this; }
    fileAttachmentsDirectory(directory: Lazy<string | null, ComponentContext>): this { return this.setLazy('_attachmentsDirectory', directory); }
    /** Accepted types of attached files, checked on the file's content (images only: they are inserted as images). */
    fileAttachmentsAcceptedFileTypes(types: string[]): this { this._attachmentTypes = types.filter((type) => type.startsWith('image/') && type !== 'image/svg+xml'); return this; }
    /** Maximum size of attached files, in kilobytes. */
    fileAttachmentsMaxSize(kilobytes: Lazy<number, ComponentContext>): this { return this.setLazy('_attachmentMaxSize', kilobytes); }
    /** Text colors offered by the `textColor` tool (the Tailwind palette by default): `{ brand: TextColor.make('Brand', '#0ea5e9', '#38bdf8') }`. */
    textColors(colors: Record<string, TextColor> | null): this { this._textColors = colors; if (colors) registerTextColors(colors); return this; }
    getTextColors(): Record<string, TextColor> { this.applyContentAttribute(); return this._textColors ?? TextColor.getDefaults(); }
    /** Lets users pick any color, besides the listed ones. */
    customTextColors(condition = true): this { this._customTextColors = condition; return this; }
    /** Merge tags users insert (`mergeTags` tool and `{{` in the text), replaced by values when the content is rendered: `['name', 'today']` or `{ name: 'Name' }`. */
    mergeTags(tags: string[] | Record<string, string>): this { this._mergeTags = Array.isArray(tags) ? Object.fromEntries(tags.map((tag) => [tag, tag])) : { ...tags }; return this; }
    noMergeTagSearchResultsMessage(message: Lazy<string | null, ComponentContext>): this { return this.setLazy('_noMergeTagResults', message); }
    /** Mentions: `[MentionProvider.make('@').items({ 1: 'Ada' })]`. */
    mentions(providers: MentionProvider[]): this { this._mentions = providers; return this; }
    /** Custom blocks (`customBlocks` tool), as a list or grouped by label. */
    customBlocks(blocks: CustomBlocks): this { this._customBlocks = blocks; return this; }
    minimalCustomBlockControls(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_minimalCustomBlockControls', condition); }
    /** Shows the blocks of the panel in a grid. */
    customBlocksGrid(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_customBlocksGrid', condition); }
    /** Adds a search field to the blocks panel. */
    searchableCustomBlocks(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_searchableCustomBlocks', condition); }
    /** Panel open when the editor loads (`customBlocks`, `mergeTags`). */
    activePanel(panel: Lazy<string | null, ComponentContext>): this { return this.setLazy('_activePanel', panel); }
    /** Keeps the toolbar visible while scrolling the content. */
    stickyToolbar(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_stickyToolbar', condition); }
    /** Lets users resize images with handles; the size is saved on the image. */
    resizableImages(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_resizableImages', condition); }
    private attachmentsStorage(): FileStorage | null { return this._attachmentsStorage ?? FileUpload.storage; }
    /** A tool by name: plugin tools first (the last plugin wins), then `tools()`, then the built-in ones. */
    private findTool(name: string): RichEditorTool | null {
        const plugin = this._plugins.flatMap((item) => item.getEditorTools()).reverse().find((tool) => tool.getName() === name);
        if (plugin) return plugin;
        const custom = this._customTools.find((tool) => tool.getName() === name);
        if (custom) return custom;
        const definition = BUILT_IN_TOOLS.get(name);
        return definition ? RichEditorTool.fromDefinition(definition) : null;
    }
    /** Default toolbar: `customBlocks` and `mergeTags` join the table group when they are used. */
    getDefaultToolbarButtons(): ToolbarItems {
        return [...RICH_EDITOR_TOOLS.slice(0, 4), ['table', 'attachFiles', ...(this.blockGroups().some(([, blocks]) => blocks.length) ? ['customBlocks'] : []), ...(Object.keys(this._mergeTags).length ? ['mergeTags'] : [])], ...RICH_EDITOR_TOOLS.slice(5)];
    }
    /** Toolbar groups after the plugins' and the field's modifications; `attachFiles` needs a storage. */
    getToolbarButtons(): ToolbarItem[][] {
        const pluginModifications: ToolbarModification[] = this._plugins.flatMap((plugin): ToolbarModification[] => [
            ...(plugin.getEnabledToolbarButtons?.()?.length ? [{ type: 'enable' as const, buttons: plugin.getEnabledToolbarButtons!() }] : []),
            ...(plugin.getDisabledToolbarButtons?.()?.length ? [{ type: 'disable' as const, buttons: plugin.getDisabledToolbarButtons!() }] : []),
        ]);
        this.applyContentAttribute();
        const disabled: ToolbarModification[] = this.attachmentsStorage() === null && this._attachmentProvider === null ? [{ type: 'disable', buttons: ['attachFiles'] }] : [];
        return applyToolbarModifications(this._toolbar ?? this.getDefaultToolbarButtons(), [...pluginModifications, ...this._toolbarModifications, ...disabled]);
    }
    private toolGroups(): string[][] { return this.getToolbarButtons().map((group) => toolbarButtonNames(group)); }
    /** HTML of a toolbar entry: a tool, or a dropdown group of tools. */
    private toolbarItemHtml(item: ToolbarItem): string {
        if (typeof item !== 'string') return item.resolve((name) => this.findTool(name)).toHtml();
        const tool = this.findTool(item);
        if (!tool) throw new Error(`RichEditor: toolbar button [${item}] cannot be found.`);
        return tool.toHtml();
    }
    private blockGroups(): [string, CustomBlockClass[]][] { if (!this._contentAttributeApplied) this.applyContentAttribute(); return Array.isArray(this._customBlocks) ? [['', this._customBlocks]] : Object.entries(this._customBlocks); }
    getCustomBlock(id: unknown): CustomBlockClass | null { return this.blockGroups().flatMap(([, blocks]) => blocks).find((block) => block.getId() === id) ?? null; }
    hydrateState(value: unknown): unknown {
        if (typeof value === 'string' && value.trim().startsWith('{')) { try { const parsed = JSON.parse(value); if (isRichDocument(parsed)) return parsed; } catch { /* HTML */ } }
        return isRichDocument(value) ? value : richHtmlToDocument(typeof value === 'string' ? value : '', this.schemaOptions());
    }
    getDefaultState(): unknown { const value = this.resolvedDefault(); return richHtmlToDocument(typeof value === 'string' ? value : '', this.schemaOptions()); }
    /**
     * HTML (sanitized by the editor's schema), or the JSON document with `json()` (normalized through the same schema).
     * Images uploaded in the editor are stored first (their `data-id` becomes the stored key); private images keep no URL.
     */
    async dehydrateState(state: unknown): Promise<unknown> {
        const document = await this.saveFileAttachments(state);
        const provider = this.getFileAttachmentProvider();
        // Attachments removed from the content are deleted by the provider.
        if (provider && !this.waitsForRecord()) await provider.cleanUpFileAttachments(await attachmentIdsOf(document), { ...(await this.attachmentContext()), previousIds: await this.getOriginalFileAttachmentPaths() });
        const html = richDocumentToHtml(document, this.schemaOptions());
        if (html === null) return null;
        const isPrivate = (await this.getFileAttachmentsVisibility()) === 'private';
        if (!isPrivate && !this._json) return html;
        const clean = richHtmlToDocument(html, this.schemaOptions());
        if (isPrivate) await eachImage(clean, (node) => { if (node.attrs?.id) node.attrs.src = null; });
        return this._json ? clean : renderRichDocument(clean, this.schemaOptions());
    }
    async getValidationRules(): Promise<Rule[]> {
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: (value) => richDocumentToHtml(value, this.schemaOptions()) !== null, message: (a) => `The ${a} field is required.` });
        // A `data-id` the record does not hold (and that is not a new upload) would point to someone else's file.
        if (await evaluate(this._preventAttachmentTampering, this.context())) rules.push({
            name: 'tampered', implicit: false,
            passes: async (value) => {
                const original = await this.getOriginalFileAttachmentPaths();
                for (const id of await attachmentIdsOf(value)) if (!this.getUploadedFileAttachment(id) && !(await this.isFileAttachmentPathAuthorized(id, original))) return false;
                return true;
            },
            message: (a) => t('navette-forms::validation.tampered_file_path', { attribute: a }),
        });
        return [...rules, ...this._rules];
    }

    // ---- file attachments
    /** `private`: images get a temporary signed URL when the content is loaded or rendered, and none is saved (only `data-id`). */
    fileAttachmentsVisibility(visibility: Lazy<AttachmentsVisibility, ComponentContext>): this { this._attachmentsVisibility = visibility; this._attachmentsVisibilitySet = true; return this; }
    async getFileAttachmentsVisibility(): Promise<AttachmentsVisibility> {
        const ctx = this.context();
        const visibility = !this._attachmentsVisibilitySet && this._attachmentProvider?.getDefaultFileAttachmentVisibility?.() ? this._attachmentProvider.getDefaultFileAttachmentVisibility() : await evaluate(this._attachmentsVisibility, ctx);
        return visibility === 'private' ? 'private' : 'public';
    }
    /**
     * Record-aware storage of the attached images: it stores each upload for the record, gives the URL of the ids it manages
     * for that record only, and deletes the attachments removed from the content when it is saved. See `StorageFileAttachmentProvider`. Used instead of `fileAttachmentsStorage()`.
     */
    fileAttachmentProvider(provider: FileAttachmentProvider | null): this { this._attachmentProvider = provider; return this; }
    getFileAttachmentProvider(): FileAttachmentProvider | null { this.applyContentAttribute(); return this._attachmentProvider; }
    /** Record the attachments belong to: the edited record, or the one just created while the content is saved to it. */
    private attachmentRecord(): unknown { return this._createdRecord ?? (this.container ? this.container.getRecord() : null) ?? null; }
    private async attachmentContext(): Promise<FileAttachmentContext> { return { record: this.attachmentRecord(), attribute: this.getName(), visibility: await this.getFileAttachmentsVisibility() }; }
    /** Whether the provider needs the record and the form is creating it: the content is then saved once the record exists. */
    private waitsForRecord(): boolean { return Boolean(this.getFileAttachmentProvider()?.isExistingRecordRequiredToSaveNewFileAttachments()) && !this.attachmentRecord(); }
    async savesRelationships(): Promise<boolean> { return (await super.savesRelationships()) || this.waitsForRecord(); }
    /** After the record is created (provider requiring it): stores the uploads for it, then writes the content into it. */
    async saveRelationships(record: any): Promise<void> {
        if (!this.waitsForRecord() || !record) return super.saveRelationships(record);
        this._createdRecord = record;
        try {
            const content = await this.dehydrateState(this.context().state);
            await saveContentToRecord(this._attachmentProvider!, record, this.getName(), content);
        } finally { this._createdRecord = null; }
    }
    /** URL of a stored attachment (its `data-id`), instead of the storage's (temporary) URL. */
    getFileAttachmentUrlUsing(callback: ((file: string, ctx: ComponentContext) => string | null | Promise<string | null>) | null): this { this._getFileAttachmentUrlUsing = callback; return this; }
    /** Stores an uploaded image yourself, returning its key (saved in `data-id`). */
    saveUploadedFileAttachmentUsing(callback: ((file: TemporaryUpload, ctx: ComponentContext) => string | null | Promise<string | null>) | null): this { this._saveUploadedFileAttachmentUsing = callback; return this; }
    /**
     * Rejects content whose images reference a `data-id` the record does not already hold (new uploads always pass), so that a
     * forged request cannot reference another record's file. On by default; `allowFilePathUsing` approves other ids.
     */
    preventFileAttachmentPathTampering(condition: Lazy<boolean, ComponentContext> = true, allowFilePathUsing: ((file: string, ctx: ComponentContext) => boolean | Promise<boolean>) | null = null): this {
        this._preventAttachmentTampering = condition;
        this._allowFileAttachmentPathUsing = allowFilePathUsing;
        return this;
    }
    shouldPreventFileAttachmentPathTampering(): Promise<boolean> { return evaluate(this._preventAttachmentTampering, this.context()).then(Boolean); }
    /** `data-id` values of the images of the record's saved content. */
    async getOriginalFileAttachmentPaths(): Promise<string[]> {
        const record = this.container.getRecord() as Record<string, unknown> | null;
        const original = record && typeof record === 'object' ? record[this.getName()] : null;
        if (original === null || original === undefined || original === '') return [];
        return attachmentIdsOf(this.hydrateState(original));
    }
    async isFileAttachmentPathAuthorized(file: string, original?: string[]): Promise<boolean> {
        if ((original ?? (await this.getOriginalFileAttachmentPaths())).includes(file)) return true;
        return this._allowFileAttachmentPathUsing !== null && (await this._allowFileAttachmentPathUsing(file, this.context())) === true;
    }
    /** URL of a stored attachment: `getFileAttachmentUrlUsing()`, else the storage's URL (a temporary one for private images). */
    async getFileAttachmentUrl(file: string): Promise<string | null> {
        if (this._getFileAttachmentUrlUsing) return safeFileUrl(await this._getFileAttachmentUrlUsing(file, this.context()));
        const provider = this.getFileAttachmentProvider();
        if (provider) return safeFileUrl(await provider.getFileAttachmentUrl(file, await this.attachmentContext()));
        return attachmentUrl(this.attachmentsStorage(), await this.getFileAttachmentsVisibility(), file);
    }
    /** Holder of the editor's uploads: `componentFileAttachments.<state path>`. */
    private attachmentsHolder(): Record<string, unknown> | null {
        const holder = readPath((this.livewire as any).componentFileAttachments ?? {}, this.getStatePath().split('.'));
        return holder && typeof holder === 'object' && !Array.isArray(holder) ? holder as Record<string, unknown> : null;
    }
    /** The temporary file uploaded under this id, if it is valid (type read from its content, size); not consumed. */
    getUploadedFileAttachment(id: unknown): TemporaryUpload | null {
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
        const holder = this.attachmentsHolder();
        if (!holder || !Object.hasOwn(holder, id)) return null;
        const file = ((this.livewire as any)._runtime?.uploads?.resolve(holder[id]) ?? null) as TemporaryUpload | null;
        return file && this._attachmentTypes.includes(file.type) && file.size <= this._attachmentMaxSize * 1024 ? file : null;
    }
    /** Stores an uploaded image (`saveUploadedFileAttachmentUsing()`, else the storage) and returns its key. */
    async saveUploadedFileAttachment(file: TemporaryUpload): Promise<string | null> {
        if (this._saveUploadedFileAttachmentUsing) return (await this._saveUploadedFileAttachmentUsing(file, this.context())) ?? null;
        const provider = this.getFileAttachmentProvider();
        if (provider && this.waitsForRecord()) return null;
        const storage = this.attachmentsStorage();
        if (!provider && !storage) return null;
        const key = provider ? await provider.saveUploadedFileAttachment(file, await this.attachmentContext()) : await storage!.store(file, this._attachmentsDirectory);
        if (key === null) return null;
        (this.livewire as any)._runtime?.uploads?.remove(file.id);
        return key;
    }
    /**
     * Stores the images uploaded in the document: each `data-id` naming an upload becomes the stored key, with its URL.
     * The field state is updated, so saving twice stores once.
     */
    async saveFileAttachments(state: unknown = this.context().state): Promise<unknown> {
        if (!isRichDocument(state)) return state;
        const holder = this.attachmentsHolder();
        if (!holder) return state;
        const document = JSON.parse(JSON.stringify(state));
        let changed = false;
        await eachImage(document, async (node) => {
            const id = node.attrs?.id;
            const upload = this.getUploadedFileAttachment(id);
            if (!upload) return;
            const key = await this.saveUploadedFileAttachment(upload);
            delete holder[id];
            if (key === null) return;
            node.attrs = { ...node.attrs, id: key, src: await this.getFileAttachmentUrl(key) };
            changed = true;
        });
        if (!changed) return state;
        writePath(this.livewire as any, this.getStatePath().split('.'), document);
        return document;
    }
    /**
     * Gives the images of the state their URL when they have none (content loaded from the record: private images are saved
     * without one). Only ids the record holds, or that `allowFilePathUsing` approves, get a URL.
     */
    private async loadFileAttachmentUrls(): Promise<void> {
        const state = this.context().state;
        if (!isRichDocument(state)) return;
        const prevent = await this.shouldPreventFileAttachmentPathTampering();
        const original = prevent ? await this.getOriginalFileAttachmentPaths() : [];
        let changed = false;
        const document = JSON.parse(JSON.stringify(state));
        await eachImage(document, async (node) => {
            const id = node.attrs?.id;
            if (typeof id !== 'string' || id === '' || node.attrs?.src) return;
            if (prevent && !(await this.isFileAttachmentPathAuthorized(id, original))) return;
            const url = await this.getFileAttachmentUrl(id);
            if (url) { node.attrs = { ...node.attrs, src: url }; changed = true; }
        });
        if (changed) writePath(this.livewire as any, this.getStatePath().split('.'), document);
    }
    getExposedMethods(): string[] { return ['getMentionSearchResultsForJs', 'getMentionLabelsForJs', 'getCustomBlockPreviewsForJs', 'getUploadedFileAttachmentTemporaryUrl', 'saveUploadedFileAttachmentAndGetUrl']; }
    private mentionProvider(char: unknown): MentionProvider | null { return this._mentions.find((provider) => provider.getTriggerCharacter() === char) ?? this._mentions[0] ?? null; }
    /** Mention search, for the editor's JavaScript: `[{ id, label }]`. */
    async getMentionSearchResultsForJs(search: unknown = '', triggerCharacter: unknown = '@'): Promise<{ id: string; label: string }[]> {
        const provider = this.mentionProvider(triggerCharacter ?? '@');
        if (!provider || (await this.isDisabled())) return [];
        return Object.entries(await provider.getSearchResults(typeof search === 'string' ? search.slice(0, 200) : '')).slice(0, 50).map(([id, label]) => ({ id, label }));
    }
    /** Current labels of mentioned ids, by trigger character. */
    async getMentionLabelsForJs(mentions: unknown = []): Promise<Record<string, Record<string, string>>> {
        const byChar = new Map<string, string[]>();
        for (const mention of Array.isArray(mentions) ? mentions.slice(0, 500) : []) {
            const char = String((mention as any)?.triggerCharacter ?? '@'), id = (mention as any)?.id;
            if (id === null || id === undefined) continue;
            byChar.set(char, [...(byChar.get(char) ?? []), String(id)]);
        }
        const labels: Record<string, Record<string, string>> = {};
        for (const [char, ids] of byChar) { const provider = this.mentionProvider(char); if (provider) labels[char] = await provider.getLabels(ids); }
        return labels;
    }
    /** Previews of inserted blocks, for the editor's JavaScript. */
    getCustomBlockPreviewsForJs(customBlocks: unknown = []): { key: number; label: string; preview: string; shouldApplyProseStylingToPreview: boolean }[] {
        const previews: { key: number; label: string; preview: string; shouldApplyProseStylingToPreview: boolean }[] = [];
        for (const item of Array.isArray(customBlocks) ? customBlocks.slice(0, 200) : []) {
            const block = this.getCustomBlock((item as any)?.id);
            const config = (item as any)?.config && typeof (item as any).config === 'object' && !Array.isArray((item as any).config) ? (item as any).config : {};
            if (!block || !Number.isInteger((item as any)?.key)) continue;
            previews.push({ key: (item as any).key, label: block.getPreviewLabel(config), preview: Buffer.from(block.toPreviewHtml(config) ?? '').toString('base64'), shouldApplyProseStylingToPreview: block.shouldApplyProseStylingToPreview(config) });
        }
        return previews;
    }
    /**
     * Temporary URL of a file the editor just uploaded, shown until the form is saved: the file is checked (type from its content,
     * size) but not stored yet. It is stored when the form is saved (and left in the temporary store otherwise).
     */
    async getUploadedFileAttachmentTemporaryUrl(args: unknown = {}): Promise<string | null> {
        // The editor's JavaScript sends `{ attachment }`, passed as a positional argument by `callSchemaComponentMethod()`.
        const id = typeof args === 'string' ? args : (args as any)?.attachment;
        if (!this.attachmentsStorage() && !this._saveUploadedFileAttachmentUsing && !this.getFileAttachmentProvider()) return null;
        if (!this.toolGroups().flat().includes('attachFiles') || (await this.isDisabled())) return null;
        const file = this.getUploadedFileAttachment(id);
        const runtime = (this.livewire as any)._runtime;
        return file ? (runtime?.uploads?.temporaryUrl?.(file.id, runtime.uploadPrefix ?? '/livewire') ?? null) : null;
    }
    /** Stores the file just uploaded to `componentFileAttachments.<state path>` and returns its URL (no `data-id` flow). */
    async saveUploadedFileAttachmentAndGetUrl(args: unknown = {}): Promise<string | null> {
        const id = String((typeof args === 'string' ? args : (args as any)?.attachment) ?? '');
        const provider = this.getFileAttachmentProvider();
        if (provider) {
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !this.toolGroups().flat().includes('attachFiles') || (await this.isDisabled()) || this.waitsForRecord()) return null;
            const file = this.getUploadedFileAttachment(id);
            if (!file) return null;
            const key = await this.saveUploadedFileAttachment(file);
            const holder = this.attachmentsHolder();
            if (holder) delete holder[id];
            return key === null ? null : this.getFileAttachmentUrl(key);
        }
        const storage = this.attachmentsStorage();
        if (!storage || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || !this.toolGroups().flat().includes('attachFiles') || (await this.isDisabled())) return null;
        return storeEditorAttachment(this, id, { storage, directory: this._attachmentsDirectory, types: this._attachmentTypes, maxSize: this._attachmentMaxSize });
    }

    /** Sends commands to the editor in the browser (after an action), on the given selection. */
    runCommands(livewire: any, commands: { name: string; arguments?: unknown[] }[], editorSelection: unknown = null): void {
        const key = this.getKey()!;
        livewire.dispatch('run-rich-editor-commands', { awaitSchemaComponent: key, livewireId: livewire.id, key, editorSelection, commands: commands.map((command) => ({ name: command.name, arguments: command.arguments ?? [] })) });
    }
    /** Toolbar actions: link, text color, custom block, and the ones of `editorActions()`. */
    getActions(): Action[] {
        const tr = (name: string) => t(`navette-forms::components.rich_editor.actions.link.${name}`);
        return [
            ...this.getHintActions(),
            Action.make('link').label(tr('label')).modalHeading(tr('modal.heading')).modalWidth('lg')
                .fillForm(({ arguments: args }) => ({ url: typeof args.url === 'string' ? args.url : null, shouldOpenInNewTab: args.shouldOpenInNewTab === true }))
                .schema(() => [
                    TextInput.make('url').label(tr('modal.form.url.label'))
                        // Only the allowed protocols (`linkProtocols()`), or a local path or anchor: a URL cannot execute code.
                        .rule({ name: 'url', passes: (value) => /^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(String(value)) && isAllowedLinkUrl(String(value), this.getLinkProtocols()) && (!/^https?:/i.test(String(value)) || /^https?:\/\/[^/?#\s]/i.test(String(value))), message: (a) => `The ${a} field must be a valid URL.` }),
                    Checkbox.make('shouldOpenInNewTab').label(tr('modal.form.should_open_in_new_tab.label')),
                ])
                .action(({ livewire, arguments: args, data }) => {
                    const selection = selectionOf(args);
                    const single = selection?.head === selection?.anchor;
                    const url = typeof data.url === 'string' && data.url !== '' ? data.url : null;
                    this.runCommands(livewire, [
                        ...(single ? [{ name: 'extendMarkRange', arguments: ['link'] }] : []),
                        url ? { name: 'setLink', arguments: [{ href: url, target: data.shouldOpenInNewTab ? '_blank' : null }] } : { name: 'unsetLink' },
                    ], selection);
                }),
            this.textColorAction(),
            this.customBlockAction(),
            ...this._editorActions,
            ...this._plugins.flatMap((plugin) => plugin.getEditorActions()),
        ];
    }
    private textColorAction(): Action {
        const tr = (name: string) => t(`navette-forms::components.rich_editor.actions.text_color.${name}`);
        return Action.make('textColor').label(tr('label')).modalHeading(tr('modal.heading')).modalWidth('lg')
            .fillForm(({ arguments: args }) => {
                const color = typeof args.color === 'string' ? args.color : null;
                if (!color) return {};
                const known = Object.hasOwn(this.getTextColors(), color);
                return { color: known ? color : null, customColor: this._customTextColors && !known ? color : null };
            })
            .schema(() => {
                const options = Object.fromEntries(Object.entries(this.getTextColors()).map(([name, color]) => [name, `<div class="nv-fo-rich-editor-text-color-select-option"><div class="nv-fo-rich-editor-text-color-select-option-preview" style="--color: ${e(sanitizeCssColor(color.getColor()) ?? '')}; --dark-color: ${e(sanitizeCssColor(color.getDarkColor()) ?? '')}"></div><div>${e(color.getLabel() ?? name)}</div></div>`]));
                return [
                    ...(Object.keys(options).length ? [Select.make('color').label(tr('modal.form.color.label')).options(options).allowHtml().native(false).live()] : []),
                    ...(this._customTextColors ? [ColorPicker.make('customColor').label(tr('modal.form.custom_color.label')).visible(({ get }) => !get('color'))] : []),
                ];
            })
            .action(({ livewire, arguments: args, data }) => {
                const selection = selectionOf(args);
                const single = selection?.head === selection?.anchor;
                const picked = typeof data.color === 'string' && Object.hasOwn(this.getTextColors(), data.color) ? data.color : this._customTextColors ? sanitizeCssColor(data.customColor) : null;
                this.runCommands(livewire, picked
                    ? [...(single ? [{ name: 'extendMarkRange', arguments: ['textColor'] }] : []), { name: 'setTextColor', arguments: [{ color: picked }] }]
                    : [...(single ? [{ name: 'extendMarkRange', arguments: ['textColor'] }] : []), { name: 'unsetTextColor' }], selection);
            });
    }
    /** Modal of a custom block, built from the block class named in the arguments (`id`): insert or edit. */
    private customBlockAction(): Action {
        const blockOf = (args: Record<string, unknown> | undefined) => this.getCustomBlock(args?.id);
        const configured = (args: Record<string, unknown> | undefined): Action | null => { const block = blockOf(args); return block ? block.configureEditorAction(Action.make('customBlock')) : null; };
        const argumentsOf = (livewire: any) => livewire?.mountedActions?.find?.((mounted: any) => mounted.name === 'customBlock')?.arguments ?? {};
        return Action.make('customBlock').modalWidth('lg')
            .modalHeading(({ arguments: args }) => blockOf(args)?.getLabel() ?? null)
            .modalSubmitActionLabel(({ arguments: args }) => t(`navette-forms::components.rich_editor.actions.custom_block.modal.actions.${args.mode === 'edit' ? 'save' : 'insert'}.label`))
            .modalHidden(async (ctx) => { const action = configured(ctx.arguments); return !action || (await action.isModalHidden(ctx)); })
            .fillForm(({ arguments: args }) => (args.config && typeof args.config === 'object' && !Array.isArray(args.config) ? args.config as Record<string, unknown> : {}))
            .schema((schema: any) => configured(argumentsOf(schema.livewire))?.applySchema(schema) ?? schema.components([]))
            .action(({ livewire, arguments: args, data }) => {
                const block = blockOf(args);
                if (!block) return;
                const config = data ?? {};
                const content = { type: 'customBlock', attrs: { config, id: block.getId(), label: block.getPreviewLabel(config), preview: Buffer.from(block.toPreviewHtml(config) ?? '').toString('base64'), shouldApplyProseStylingToPreview: block.shouldApplyProseStylingToPreview(config) } };
                const selection = { ...(selectionOf(args) ?? {}) } as { head?: number; anchor?: number; type?: string };
                if (args.dragPosition !== undefined && args.dragPosition !== null) { this.runCommands(livewire, [{ name: 'insertContentAt', arguments: [args.dragPosition, content] }]); return; }
                if (selection.type === 'node' && args.mode === 'insert') { this.runCommands(livewire, [{ name: 'insertContentAt', arguments: [Number(selection.anchor ?? -1) + 1, content] }]); return; }
                if (args.mode === 'edit' && selection.type !== 'node') { selection.type = 'node'; selection.anchor = Number(selection.anchor ?? 1) - 1; delete selection.head; }
                this.runCommands(livewire, [{ name: 'insertContent', arguments: [content] }], selection);
            });
    }

    private customBlocksPanelHtml(key: string): string {
        const searchable = this._searchableCustomBlocks;
        const groups = this.blockGroups();
        const allLabels = groups.flatMap(([label, blocks]) => [label, ...blocks.map((block) => block.getLabel())]).filter(Boolean);
        const parts: string[] = [];
        if (searchable) parts.push(`<div class="nv-fo-rich-editor-custom-blocks-search">${icon('m-magnifying-glass')}<input type="search" x-model="customBlockSearch" x-on:keydown.enter.prevent aria-label="${e(t('navette-forms::components.rich_editor.custom_blocks.search_label'))}" placeholder="${e(t('navette-forms::components.rich_editor.custom_blocks.search_prompt'))}" class="nv-fo-rich-editor-custom-blocks-search-input" /></div>`);
        const list = groups.map(([groupLabel, blocks]) => {
            const groupLabels = [groupLabel, ...blocks.map((block) => block.getLabel())];
            const show = (labels: string[]) => (searchable ? ` x-show="${e(`matchesCustomBlockSearch(${js(labels)})`)}"` : '');
            const header = groupLabel ? `<h4${show(groupLabels)} class="nv-fo-rich-editor-custom-blocks-group-header">${e(groupLabel)}</h4>` : '';
            const buttons = blocks.map((block) => {
                const id = block.getId();
                const blockIcon = block.getIcon();
                return `<button draggable="true" type="button" data-block-id="${e(id)}" x-data="{ isLoading: false }"${show([groupLabel, block.getLabel()])} x-on:click="${e(`isLoading = true\n$wire.mountAction('customBlock', { editorSelection, id: ${js(id)}, mode: 'insert' }, { schemaComponent: ${js(key)} })`)}" x-on:dragstart="${e(`$event.dataTransfer.setData('customBlock', ${js(id)})`)}" x-on:open-modal.window="isLoading = false" x-on:run-rich-editor-commands.window="isLoading = false" class="nv-fo-rich-editor-custom-block-btn">${blockIcon ? `<span x-show="! isLoading" class="nv-fo-rich-editor-custom-block-icon">${icon(blockIcon)}</span>` : ''}${loadingIndicator(new Attributes({ 'x-show': 'isLoading', 'x-cloak': '' }))}<span>${e(block.getLabel())}</span></button>`;
            }).join('');
            return `${header}<div${show(groupLabels)} class="${cls(['nv-fo-rich-editor-custom-blocks-list', { 'nv-fo-rich-editor-custom-blocks-grid': this._customBlocksGrid }])}">${buttons}</div>`;
        }).join('');
        const noResults = searchable ? `<p x-show="${e(`! matchesCustomBlockSearch(${js(allLabels)})`)}" x-cloak role="status" class="nv-fo-rich-editor-custom-blocks-no-results">${e(t('navette-forms::components.rich_editor.custom_blocks.no_search_results_message'))}</p>` : '';
        return `${parts.join('')}<div class="nv-fo-rich-editor-custom-blocks-ctn">${list}${noResults}</div>`;
    }
    private mergeTagsPanelHtml(): string {
        return Object.entries(this._mergeTags).map(([id, label]) => `<button draggable="true" type="button" x-on:click="${e(`insertMergeTag(${js(id)})`)}" x-on:dragstart="${e(`$event.dataTransfer.setData('mergeTag', ${js(id)})`)}" class="nv-fo-rich-editor-merge-tag-btn"><span data-type="mergeTag" data-id="${e(id)}">${e(label)}</span></button>`).join('');
    }

    async toHtml(): Promise<string> {
        const key = this.getKey()!;
        await this.loadFileAttachmentUrls();
        let html = views.render('navette-forms::components.rich-editor', { livewireId: this.livewire.id, key, statePath: this.getStatePath(), label: await this.getLabel(), js });
        // Toolbar: the configured groups, each tool (or dropdown of tools) rendered from its definition.
        const toolbarStart = html.indexOf('data-rich-editor-toolbar="main"');
        if (toolbarStart >= 0) {
            const open = html.indexOf('>', toolbarStart) + 1;
            // The toolbar ends right before the "uploading file" message.
            const message = html.indexOf('x-show="isUploadingFile"', open);
            const close = message < 0 ? -1 : html.lastIndexOf('<div', message);
            if (close < 0) throw new Error('RichEditor: unexpected view markup (toolbar end not found).');
            const body = html.slice(open, close);
            const groups = this.getToolbarButtons().map((group) => `<div class="nv-fo-rich-editor-toolbar-group">${group.map((item) => this.toolbarItemHtml(item)).join('')}</div>`).join('');
            const endOfToolbar = body.lastIndexOf('</div>');
            html = html.slice(0, open) + groups + body.slice(endOfToolbar) + html.slice(close);
            if (this._stickyToolbar) html = html.replace('class="nv-fo-rich-editor-toolbar "', 'class="nv-fo-rich-editor-toolbar nv-fo-rich-editor-sticky-toolbar"');
        }
        // Floating toolbars: one per node name, inside the content (none when disabled).
        const floatingToolbars = (await this.isDisabled()) ? {} : this.getFloatingToolbars();
        const contentStart = html.indexOf('<div x-ref="editor" class="nv-fo-rich-editor-content nv-prose">');
        const panelsStart = html.indexOf('x-show="isPanelActive()"');
        if (contentStart >= 0 && panelsStart >= 0) {
            const open = html.indexOf('>', contentStart) + 1;
            const close = html.lastIndexOf('</div>', html.lastIndexOf('<div', panelsStart));
            const toolbarLabel = e(t('navette-forms::components.rich_editor.toolbar.label'));
            const toolbars = Object.entries(floatingToolbars).map(([node, items]) => `<div x-ref="floatingToolbar::${e(node)}" class="nv-fo-rich-editor-floating-toolbar nv-not-prose" data-rich-editor-toolbar role="toolbar" aria-label="${toolbarLabel}">${items.map((item) => this.toolbarItemHtml(item)).join('')}</div>`).join('');
            html = html.slice(0, open) + toolbars + html.slice(close);
        }
        if (await this.hasStickyPanels()) html = html.replace('class="nv-fo-rich-editor-panels "', 'class="nv-fo-rich-editor-panels nv-fo-rich-editor-sticky-panels"');
        // Height and sticky offset: CSS variables of the wrapper.
        const [minHeight, maxHeight, stickyOffset] = [await this.getMinHeight(), await this.getMaxHeight(), await this.getStickyOffset()];
        const style = [minHeight ? `--min-height: ${minHeight}` : null, maxHeight ? `--max-height: ${maxHeight}` : null, stickyOffset ? `--rich-editor-sticky-offset: ${stickyOffset}` : null].filter(Boolean).join('; ');
        html = html.replace('style="--min-height: 10rem;" ', () => (style ? `style="${e(style)};" ` : ''));
        const uploadingMessage = this.getUploadingFileMessage();
        html = html.replace('<span>Uploading file...</span>', () => `<span>${e(uploadingMessage)}</span>`)
            .replace(/uploadingFileMessage: '[^']*',/, () => `uploadingFileMessage: ${js(uploadingMessage)},`)
            .replace(/floatingToolbars: JSON\.parse\('[^']*'\),/, () => `floatingToolbars: ${js(Object.keys(floatingToolbars).length ? Object.fromEntries(Object.entries(floatingToolbars).map(([node, items]) => [node, toolbarButtonNames(items)])) : [])},`)
            .replace(/linkProtocols: JSON\.parse\('[^']*'\),/, () => `linkProtocols: ${js(this.getLinkProtocols())},`);
        // Panels: custom blocks and merge tags.
        const blocksStart = html.indexOf('<div class="nv-fo-rich-editor-custom-blocks-ctn">');
        if (blocksStart >= 0) {
            const blocksEnd = html.indexOf('</div>', blocksStart) + '</div>'.length;
            html = html.slice(0, blocksStart) + this.customBlocksPanelHtml(key) + html.slice(blocksEnd);
        }
        const tagsStart = html.indexOf('<div class="nv-fo-rich-editor-merge-tags-list">');
        if (tagsStart >= 0) {
            const open = html.indexOf('>', tagsStart) + 1;
            html = html.slice(0, open) + this.mergeTagsPanelHtml() + html.slice(html.indexOf('</div>', open));
        }
        const attach = this.toolGroups().flat().includes('attachFiles');
        const mentions = await Promise.all(this._mentions.map((provider) => provider.toJs()));
        html = html.replace('canAttachFiles: true,', `canAttachFiles: ${attach ? 'true' : 'false'},`)
            .replace('maxFileSize: 12288,', `maxFileSize: ${this._attachmentMaxSize},`)
            .replace(/maxFileSizeValidationMessage: '[^']*',/, () => `maxFileSizeValidationMessage: ${js(`Uploaded files must not be greater than ${this._attachmentMaxSize} kilobytes.`)},`)
            .replace(/acceptedFileTypes: JSON\.parse\('[^']*'\),/, () => `acceptedFileTypes: ${js(this._attachmentTypes)},`)
            .replace(/acceptedFileTypesValidationMessage: '[^']*',/, () => `acceptedFileTypesValidationMessage: ${js(`Uploaded files must be of type: ${this._attachmentTypes.join(', ')}.`)},`)
            .replace('activePanel: null,', () => `activePanel: ${js(this._activePanel)},`)
            .replace('extensions: [],', () => `extensions: ${js([...this._jsExtensions, ...this._plugins.flatMap((plugin) => plugin.getTipTapJsExtensions())])},`)
            .replace('hasResizableImages: false,', `hasResizableImages: ${this._resizableImages ? 'true' : 'false'},`)
            .replace('hasMinimalCustomBlockControls: false,', `hasMinimalCustomBlockControls: ${this._minimalCustomBlockControls ? 'true' : 'false'},`)
            .replace('hasStickyToolbar: false,', `hasStickyToolbar: ${this._stickyToolbar ? 'true' : 'false'},`)
            .replace('mentions: [],', () => `mentions: ${js(mentions)},`)
            .replace('mergeTags: [],', () => `mergeTags: ${js(Object.keys(this._mergeTags).length ? this._mergeTags : [])},`)
            .replace(/noMergeTagSearchResultsMessage: '[^']*',/, () => `noMergeTagSearchResultsMessage: ${js(this._noMergeTagResults ?? t('navette-forms::components.rich_editor.no_merge_tag_search_results_message'))},`)
            .replace(/textColors: JSON\.parse\('[^']*'\),/, () => `textColors: ${js(textColorsForJs(this.getTextColors()))},`)
            .replace('placeholder: null,', `placeholder: ${js(this._richPlaceholder)},`)
            .replace('isLiveOnBlur: false,', `isLiveOnBlur: ${this.isLiveOnBlur() ? 'true' : 'false'},`)
            .replace('isLiveDebounced: false,', `isLiveDebounced: ${this.getLiveDebounce() !== null ? 'true' : 'false'},`)
            .replace('liveDebounce: null,', () => `liveDebounce: ${js(debounceMilliseconds(this.getLiveDebounce()))},`)
            .replace('            x-load\n', () => `            x-load${this.extraControlHtml()}\n`)
            .replace(/state: \$wire\.\$entangle\(('[^']*'), false\)/, (_m, path) => `state: $wire.$entangle(${path}, ${this.entangleLive(false) ? 'true' : 'false'})`);
        return this.wrap(html, { labelAsDiv: true });
    }
}

/** Color picker (hex format). */
export class ColorPicker extends Field {
    static make(name: string): ColorPicker { return configured(new ColorPicker(name)); }
    private _format: 'hex' | 'rgb' | 'rgba' | 'hsl' = 'hex';
    /** Color format of the state: `#ff0000` (default), `rgb(255, 0, 0)`, `rgba(255, 0, 0, 1)` or `hsl(0, 100%, 50%)`. */
    format(format: 'hex' | 'rgb' | 'rgba' | 'hsl'): this { this._format = format; return this; }
    hex(): this { return this.format('hex'); }
    rgb(): this { return this.format('rgb'); }
    rgba(): this { return this.format('rgba'); }
    hsl(): this { return this.format('hsl'); }
    async getValidationRules(): Promise<Rule[]> {
        const patterns = {
            hex: /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
            rgb: /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
            rgba: /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/,
            hsl: /^hsl\(\s*\d{1,3}(\.\d+)?\s*,\s*\d{1,3}(\.\d+)?%\s*,\s*\d{1,3}(\.\d+)?%\s*\)$/,
        };
        const pattern = patterns[this._format];
        return [...(await super.getValidationRules()), { name: this._format === 'hex' ? 'hex_color' : 'regex', passes: (v) => pattern.test(String(v)), message: (a) => (this._format === 'hex' ? `The ${a} field must be a valid hexadecimal color.` : `The ${a} field format is invalid.`) }];
    }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const state = this.context().state;
        const id = this.getId();
        const key = this.getLivewireKey() ?? '';
        // Key hash over the serialized `[isDisabled]` options.
        const hash = createHash('md5').update(`a:1:{i:0;b:${isDisabled ? 1 : 0};}`).digest('hex');
        const input = new Attributes(this.getExtraInputAttributes()).merge({
            'aria-controls': `${id}-panel`, 'aria-expanded': 'false', 'aria-haspopup': 'dialog', 'aria-invalid': this.hasError() ? 'true' : null, autocomplete: 'off',
            disabled: isDisabled, id, required: (await this.isRequired()) && !isDisabled, role: 'combobox', type: 'text', 'x-model': 'state',
        }).class(['nv-input']);
        const wrapper = new Attributes().merge({ 'x-on:focus-input.stop': "$el.querySelector('input')?.focus()" }).class(['nv-fo-color-picker', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="nv-input-wrp-content-ctn"><div x-load x-load-src="${e(asset('color-picker'))}"${this.extraAlpineHtml()} x-data="colorPickerFormComponent({
 isAutofocused: false,
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isLive: false,
 isLiveDebounced: false,
 isLiveOnBlur: false,
 liveDebounce: null,
 state: $wire.$entangle(${e(js(this.getStatePath()))}${this.entangleLive() ? ', true' : ''}),
 })" x-on:dropdown-escape="if (isOpen()) { closePanelAndRestoreFocus(); $event.preventDefault() }" x-on:keydown.esc="isOpen() &amp;&amp; $event.stopPropagation()" x-on:focusout="if (isOpen() &amp;&amp; ! $el.contains($event.relatedTarget)) $refs.panel.close()" wire:key="${e(key)}.${hash}" class="nv-input-wrp-content"><input x-on:focus="$refs.panel.open($refs.input)" x-on:keydown.enter.prevent.stop="togglePanelVisibility()" x-ref="input" ${input.toHtml()} /><div aria-hidden="true" class="nv-fo-color-picker-preview my-auto me-3 size-5 shrink-0 rounded-full select-none" x-on:click="togglePanelVisibility()" x-bind:class="{
 'nv-empty': ! state,
 }" x-bind:style="{ 'background-color': state }"></div><div wire:ignore.self wire:key="${e(key)}.panel" x-cloak x-float.placement.bottom-start.offset.flip.shift="{ offset: 8 }" x-ref="panel" id="${e(id)}-panel" role="dialog" aria-label="${e(t('navette-forms::components.color_picker.panel_label'))}" class="nv-fo-color-picker-panel"><${({ hex: 'hex', rgb: 'rgb-string', rgba: 'rgba-string', hsl: 'hsl-string' })[this._format]}-color-picker x-ref="picker" color="${e(typeof state === 'string' ? state : '')}" /></div></div></div></div>`);
    }
}

export class Checkbox extends Field {
    private _inline = true;
    static make(name: string): Checkbox { return configured(new Checkbox(name)); }
    /** Inside a Repeater or Builder: `distinct()` across the items, `live()`, and the same value is removed from the other items when it changes. */
    fixIndistinctState(condition: Lazy<boolean, ComponentContext> = true): this { return applyFixIndistinctState(this, condition); }
    getDefaultState(): unknown { return this.resolvedDefault() ?? false; }
    /** `false`: the label goes above the checkbox instead of beside it. */
    inline(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_inline', condition, Boolean); }
    async toHtml(): Promise<string> {
        const input = new Attributes(this.getExtraInputAttributes())
            .merge({ type: 'checkbox', disabled: await this.isDisabled(), id: this.getId(), required: await this.isRequired(), [this.wireModel()]: this.getStatePath() })
            .class(['nv-checkbox-input', this.hasError() ? 'nv-invalid' : 'nv-valid']);
        return this._inline ? this.wrap('', { labelPrefix: `<input ${input.toHtml()} />` }) : this.wrap(`<input ${input.toHtml()} />`);
    }
}

/** Checkboxes for a list of values: static options or a many-to-many relationship, with search and bulk toggling. */
/** Order in which options fill a grid: `'column'` (top to bottom, then the next column) or `'row'` (left to right). */
export type GridDirection = 'row' | 'column';
/** `class` and `style` of an options grid with `columns` columns from `lg`. */
function optionsGridAttributes(columns: number | null, direction: GridDirection | null, extraClass: string | null): string {
    const count = columns && columns > 1 ? Math.floor(columns) : null;
    const isColumn = direction !== 'row';
    const value = (n: number) => (isColumn ? String(n) : `repeat(${n}, minmax(0, 1fr))`);
    const classes = cls(['nv-grid', { 'nv-grid-direction-col': isColumn, 'lg:nv-grid-cols': count !== null }, extraClass]);
    return `class="${classes}" style="${count !== null ? `--cols-lg: ${value(count)}; ` : ''}--cols-default: ${value(1)};"`;
}

export class CheckboxList extends Field {
    private _options: [string, string][] = [];
    private _optionColumns: number | null = null;
    static make(name: string): CheckboxList { return configured(new CheckboxList(name)); }
    /** Inside a Repeater or Builder: `distinct()` across the items, `live()`, and the same value is removed from the other items when it changes. */
    fixIndistinctState(condition: Lazy<boolean, ComponentContext> = true): this { return applyFixIndistinctState(this, condition); }
    /** Inside a Repeater or Builder: options picked in another item are disabled (with `distinct()` validation and `live()`). */
    disableOptionsWhenSelectedInSiblingRepeaterItems(): this { return applyDisableOptionsWhenSelectedInSiblingRepeaterItems(this); }
    /** Options as pairs, `{ value: label }`, or an enum (its descriptions are used unless `descriptions()` sets others). */
    options(options: Options | Enum<string | number>): this { this._options = optionPairs(options); if (isEnum(options) && !Object.keys(this._descriptions).length) this._descriptions = options.descriptions(); return this; }
    /** Number of columns the options are spread over (from `lg`). */
    columns(columns: Lazy<number | null, ComponentContext>): this { return this.setLazy('_optionColumns', columns); }
    private _gridDirection: Lazy<GridDirection | null, ComponentContext> = null;
    /** `'row'`: options fill the grid row by row (left to right), instead of column by column (top to bottom, the default). */
    gridDirection(direction: Lazy<GridDirection | null, ComponentContext>): this { this._gridDirection = direction; return this; }
    private _descriptions: Record<string, string> = {};
    private _searchable = false;
    private _bulkToggleable = false;
    private _disableOptionWhen: ((value: string, label: string) => boolean) | null = null;
    private _allowHtml = false;
    private _searchDebounce = 1000;
    private _relationship: { name: string; title: string | null; modify: ((query: any) => unknown) | null; model: any } | null = null;
    private _optionLabelFromRecord: ((record: any) => string) | null = null;
    private _optionDescriptionFromRecord: ((record: any) => string | null) | null = null;
    private _pivotData: Record<string, unknown> | (() => Record<string, unknown>) | null = null;
    private _modifySelectAll: ActionModifier = null;
    private _modifyDeselectAll: ActionModifier = null;
    /** Helper text per value, under the option label. */
    descriptions(descriptions: Lazy<Record<string, string>, ComponentContext>): this { return this.setLazy('_descriptions', descriptions, (value) => value ?? {}); }
    /** A search field filters the options in the browser. */
    searchable(condition = true): this { this._searchable = condition; return this; }
    private _searchPrompt = 'Search';
    private _noSearchResultsMessage = 'No search results.';
    searchPrompt(prompt: Lazy<string, ComponentContext>): this { return this.setLazy('_searchPrompt', prompt); }
    noSearchResultsMessage(message: Lazy<string, ComponentContext>): this { return this.setLazy('_noSearchResultsMessage', message); }
    /** Milliseconds to wait after typing before filtering the options (1000 by default). */
    searchDebounce(milliseconds: Lazy<number, ComponentContext>): this { return this.setLazy('_searchDebounce', milliseconds, (value) => Math.max(0, Math.floor(Number(value) || 0))); }
    /** "Select all" / "Deselect all" links. */
    bulkToggleable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_bulkToggleable', condition); }
    /** Customizes the "Select all" link (label, icon, color; it is handled in the browser, so it has no modal). */
    selectAllAction(modify: ActionModifier): this { this._modifySelectAll = modify; return this; }
    /** Customizes the "Deselect all" link. */
    deselectAllAction(modify: ActionModifier): this { this._modifyDeselectAll = modify; return this; }
    getSelectAllAction(): Action { return modifyAction(Action.make('selectAll').label(t('navette-forms::components.checkbox_list.actions.select_all.label')).link().size('sm'), this._modifySelectAll); }
    getDeselectAllAction(): Action { return modifyAction(Action.make('deselectAll').label(t('navette-forms::components.checkbox_list.actions.deselect_all.label')).link().size('sm'), this._modifyDeselectAll); }
    /** Option labels are HTML, cleaned with the HTML sanitizer (as rich content). Leave it off for labels that come from users. */
    allowHtml(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_allowHtml', condition); }
    /** Options that cannot be checked; they are refused on the server too. */
    disableOptionWhen(condition: ((value: string, label: string) => boolean) | null): this { this._disableOptionWhen = condition; return this; }
    isOptionDisabled(value: string, label: string): boolean { return this._disableOptionWhen ? this._disableOptionWhen(value, label) : false; }
    /**
     * Options from a many-to-many relationship of the form's model (Objection `relationMappings`): the related records
     * (`titleAttribute` is the label column), checked when linked to the record. The links are saved once the record is
     * saved; only records allowed by `modifyQueryUsing(query)` can be linked. The name defaults to the field's name.
     */
    relationship(name: string | null = null, titleAttribute: string | null = null, modifyQueryUsing: ((query: any) => unknown) | null = null, options: { model?: any } = {}): this {
        this._relationship = { name: name ?? this._name!, title: titleAttribute, modify: modifyQueryUsing, model: options.model ?? null };
        return this;
    }
    /** Label of a related record, computed from the whole record (instead of the title column). Escaped unless `allowHtml()`. */
    getOptionLabelFromRecordUsing(callback: ((record: any) => string) | null): this { this._optionLabelFromRecord = callback; return this; }
    /** Description of a related record, under its label. */
    getOptionDescriptionFromRecordUsing(callback: ((record: any) => string | null) | null): this { this._optionDescriptionFromRecord = callback; return this; }
    /** Extra pivot columns written when a record is linked (declare them in the relation's `join.through.extra`). */
    pivotData(data: Record<string, unknown> | (() => Record<string, unknown>) | null): this { this._pivotData = data; return this; }
    private relationInfo() {
        const model = modelOfForm(this.context(), this._relationship!.model);
        const relation = model.getRelation(this._relationship!.name);
        const related = relation.relatedModelClass;
        return { model, related, id: `${related.tableName}.${related.idColumn}`, title: this._relationship!.title ? `${related.tableName}.${this._relationship!.title}` : null };
    }
    /** Related records offered as options (at most 1000), with their labels and descriptions. */
    private async relationshipOptions(): Promise<{ options: [string, string][]; descriptions: Record<string, string> }> {
        const { related, id, title } = this.relationInfo();
        const query = related.query();
        this._relationship!.modify?.(query);
        const rows = await query.orderBy(title ?? id).limit(1000);
        const descriptions: Record<string, string> = {};
        const options = rows.map((row: any): [string, string] => {
            const value = String(row[related.idColumn]);
            const description = this._optionDescriptionFromRecord?.(row);
            if (description !== null && description !== undefined && description !== '') descriptions[value] = String(description);
            const label = this._optionLabelFromRecord ? this._optionLabelFromRecord(row) : this._relationship!.title ? row[this._relationship!.title] : value;
            return [value, String(label ?? value)];
        });
        return { options, descriptions };
    }
    private _resolved: { options: [string, string][]; descriptions: Record<string, string> } | null = null;
    /** Options and descriptions: the static ones, or the relationship's (queried once per instance). */
    async getResolvedOptions(): Promise<{ options: [string, string][]; descriptions: Record<string, string> }> {
        if (!this._relationship) return { options: this._options, descriptions: this._descriptions };
        return (this._resolved ??= { ...(await this.relationshipOptions()) });
    }
    async savesRelationships(): Promise<boolean> { return (await super.savesRelationships()) || this._relationship !== null; }
    async loadStateFromRelationships(record: any): Promise<{ state: unknown } | null> {
        if (!this._relationship) return super.loadStateFromRelationships(record);
        const { model, related } = this.relationInfo();
        const rows = await model.relatedQuery(this._relationship.name).for(record[model.idColumn]).clearSelect().select(`${related.tableName}.${related.idColumn} as __key`);
        return { state: rows.map((row: any) => String(row.__key)) };
    }
    /** Links the checked records and unlinks the others; only enabled options of the relationship's query can be linked. */
    async saveRelationships(record: any): Promise<void> {
        if (!this._relationship) return super.saveRelationships(record);
        const { model, related } = this.relationInfo();
        const key = record[model.idColumn];
        const desired = (await this.dehydrateState(this.context().state)) as string[];
        const current = (await this.loadStateFromRelationships(record))!.state as string[];
        const removed = current.filter((value) => !desired.includes(value));
        if (removed.length) await model.relatedQuery(this._relationship.name).for(key).unrelate().whereIn(`${related.tableName}.${related.idColumn}`, removed);
        const pivot = typeof this._pivotData === 'function' ? this._pivotData() : this._pivotData;
        for (const value of desired) {
            if (current.includes(value)) continue;
            const id = related.idColumn === 'id' && /^\d+$/.test(value) ? Number(value) : value;
            await model.relatedQuery(this._relationship.name).for(key).relate(pivot ? { [related.idColumn]: id, ...pivot } : id);
        }
        await super.saveRelationships(record);
    }
    getDefaultState(): unknown { return this.resolvedDefault() ?? []; }
    hydrateState(value: unknown): unknown {
        let list = value;
        if (typeof value === 'string') { try { list = JSON.parse(value); } catch { list = []; } }
        return (Array.isArray(list) ? list : []).map(String);
    }
    /** Only offered values are kept, without duplicates, in option order. */
    async dehydrateState(state: unknown): Promise<unknown> {
        const chosen = new Set((Array.isArray(state) ? state : []).map(String));
        const { options } = await this.getResolvedOptions();
        return options.filter(([value, label]) => chosen.has(value) && !(this._relationship && this.isOptionDisabled(value, label))).map(([value]) => value);
    }
    async getValidationRules(): Promise<Rule[]> {
        // A disabled option cannot be checked, even by a forged request.
        const { options } = await this.getResolvedOptions();
        const known = new Set(options.filter(([value, label]) => !this.isOptionDisabled(value, label)).map(([value]) => value));
        return [...(await super.getValidationRules()), { name: 'in', passes: (v) => Array.isArray(v) && v.every((value) => known.has(String(value))), message: (a) => `The selected ${a} is invalid.` }];
    }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const key = this.getLivewireKey() ?? '';
        const { options: resolvedOptions, descriptions } = await this.getResolvedOptions();
        const options = resolvedOptions.map(([value, label]) => {
            const input = new Attributes(this.getExtraInputAttributes()).merge({ disabled: isDisabled || this.isOptionDisabled(value, label), type: 'checkbox', value, [this.wireModel()]: this.getStatePath(), 'x-on:change': this._bulkToggleable ? 'checkIfAllCheckboxesAreChecked()' : null }).class(['nv-checkbox-input', this.hasError() ? 'nv-invalid' : 'nv-valid']);
            const description = descriptions[value] ? `<p class="nv-fo-checkbox-list-option-description">${e(descriptions[value])}</p>` : '';
            return `<div wire:key="${e(`${key}.options.${value}`)}"${this._searchable ? ' x-show="matchesSearch($el)"' : ''} class="nv-fo-checkbox-list-option-ctn"><label class="nv-fo-checkbox-list-option"><input ${input.toHtml()} /><div class="nv-fo-checkbox-list-option-text"><span class="nv-fo-checkbox-list-option-label">${this._allowHtml ? sanitizeHtml(label) : e(label)}</span>${description}</div></label></div>`;
        });
        const grid = optionsGridAttributes(this._optionColumns, await evaluate(this._gridDirection, this.context()), 'nv-fo-checkbox-list-options');
        const searchPrompt = this._searchPrompt;
        const search = this._searchable ? `<div class="nv-input-wrp nv-fo-checkbox-list-search-input-wrp"><div class="nv-input-wrp-prefix nv-input-wrp-prefix-has-content nv-inline">${icon('m-magnifying-glass', { alias: 'forms::components.checkbox-list.search-field' })}</div><div class="nv-input-wrp-content-ctn"><input aria-label="${e(searchPrompt)}" placeholder="${e(searchPrompt)}" type="search" x-model.debounce.${this._searchDebounce}="search" class="nv-input nv-input-has-inline-prefix" /></div></div>` : '';
        const ctx = this.context();
        const link = (resolved: ResolvedAction) => `<button type="button" class="nv-ac-link-action nv-link nv-size-sm ${colorClassesOf(colorManager, 'link', resolved.color, 'primary', colorManager ? colorManager.getComponentClasses('link', 'primary') : []).join(' ')}">${resolved.icon ? icon(resolved.icon, { size: 'sm' }) : ''}<span class="nv-link-label">${e(resolved.label)}</span></button>`;
        const selectAll = await resolveAction(this.getSelectAllAction(), ctx), deselectAll = await resolveAction(this.getDeselectAllAction(), ctx);
        const bulkLinks = (selectAll.visible ? `<span x-show="! areAllCheckboxesChecked" x-on:click="toggleAllCheckboxes()" wire:key="${e(key)}.actions.select-all">${link(selectAll)}</span>` : '') + (deselectAll.visible ? `<span x-show="areAllCheckboxesChecked" x-on:click="toggleAllCheckboxes()" wire:key="${e(key)}.actions.deselect-all">${link(deselectAll)}</span>` : '');
        const bulk = this._bulkToggleable && !isDisabled && resolvedOptions.length && bulkLinks ? `<div x-cloak class="nv-fo-checkbox-list-actions" wire:key="${e(key)}.actions">${bulkLinks}</div>` : '';
        const noResults = this._searchable ? `<div x-cloak x-show="search && ! visibleCheckboxListOptions.length" role="status" aria-live="polite" class="nv-fo-checkbox-list-no-search-results-message">${e(this._noSearchResultsMessage)}</div>` : '';
        return this.wrap(`<div role="group" x-load x-load-src="${e(asset('checkbox-list'))}"${this.extraAlpineHtml()} x-data="checkboxListFormComponent({
 livewireId: ${e(js(this.livewire.id))},
 })" aria-labelledby="${e(this.getId())}-label" class="nv-fo-checkbox-list">${search}${bulk}<div wire:key="${e(key)}.options"${this._searchable ? ' x-show="visibleCheckboxListOptions.length"' : ''} ${grid}>${options.join('')}</div>${noResults}</div>`, { labelAsDiv: true });
    }
}

/** Free-form key/value pairs, saved as an object. */
export class KeyValue extends Field {
    private _keyLabel: string | null = null;
    private _valueLabel: string | null = null;
    private _reorderable = false;
    static make(name: string): KeyValue { return configured(new KeyValue(name)); }
    keyLabel(label: Lazy<string, ComponentContext>): this { return this.setLazy('_keyLabel', label); }
    valueLabel(label: Lazy<string, ComponentContext>): this { return this.setLazy('_valueLabel', label); }
    reorderable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_reorderable', condition); }
    private _addable = true;
    private _deletable = true;
    private _editableKeys = true;
    private _editableValues = true;
    private _keyPlaceholder: string | null = null;
    private _valuePlaceholder: string | null = null;
    private _addLabel: string | null = null;
    private _deleteLabel: string | null = null;
    /** `false`: no "Add row" button. */
    addable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_addable', condition); }
    /** `false`: rows cannot be deleted. */
    deletable(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_deletable', condition); }
    /** `false`: keys cannot be changed. The server keeps the saved keys. */
    editableKeys(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_editableKeys', condition); }
    /** `false`: values cannot be changed. */
    editableValues(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_editableValues', condition); }
    keyPlaceholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_keyPlaceholder', text); }
    valuePlaceholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_valuePlaceholder', text); }
    addActionLabel(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_addLabel', label); }
    deleteActionLabel(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_deleteLabel', label); }
    private _reorderLabel: string | null = null;
    reorderActionLabel(label: Lazy<string | null, ComponentContext>): this { return this.setLazy('_reorderLabel', label); }
    private _modifyAdd: ActionModifier = null;
    private _modifyDelete: ActionModifier = null;
    private _modifyReorder: ActionModifier = null;
    /** Customizes the "Add row" link (label, icon, color). Rows are added in the browser: the action has no modal. */
    addAction(modify: ActionModifier): this { this._modifyAdd = modify; return this; }
    /** Customizes each row's delete button (handled in the browser: no modal). */
    deleteAction(modify: ActionModifier): this { this._modifyDelete = modify; return this; }
    /** Customizes each row's drag handle. */
    reorderAction(modify: ActionModifier): this { this._modifyReorder = modify; return this; }
    getAddAction(): Action { return modifyAction(Action.make('add').label(this._addLabel ?? t('navette-forms::components.key_value.actions.add.label')).color('gray').link(), this._modifyAdd); }
    getDeleteAction(): Action { return modifyAction(Action.make('delete').label(this._deleteLabel ?? t('navette-forms::components.key_value.actions.delete.label')).icon(fieldActionIcon('key-value', 'delete')).color('danger').iconButton().size('sm'), this._modifyDelete); }
    getReorderAction(): Action { return modifyAction(Action.make('reorder').label(this._reorderLabel ?? t('navette-forms::components.key_value.actions.reorder.label')).icon(fieldActionIcon('key-value', 'reorder')).color('gray').iconButton().size('sm'), this._modifyReorder); }
    // In the form, the state is a list of `{ key, value }` pairs (what the browser component expects, and it keeps order);
    // it becomes an object again when saved.
    getDefaultState(): unknown { return KeyValue.toPairs(this.resolvedDefault()); }
    private static toPairs(value: unknown): { key: string; value: unknown }[] {
        let object = value;
        if (typeof value === 'string') { try { object = JSON.parse(value); } catch { object = {}; } }
        return object && typeof object === 'object' && !Array.isArray(object) ? Object.entries(object).map(([key, v]) => ({ key, value: v })) : [];
    }
    private _originalValue: unknown = null;
    hydrateState(value: unknown): unknown { this._originalValue = value; return KeyValue.toPairs(value); }
    /** Flat object of strings: empty keys, nested objects and dangerous keys are dropped; 200 pairs at most. */
    dehydrateState(state: unknown): unknown {
        const out: Record<string, string | null> = {};
        // Restrictions set on the field are enforced on the server: a forged state cannot add, delete or edit what the UI forbids.
        // The saved value: the one hydrated by this instance, else the record's (fields are rebuilt on every request), else the default.
        const record = this.context().record as Record<string, unknown> | null;
        const saved = KeyValue.toPairs(this._originalValue ?? (record && typeof record === 'object' ? record[this._name!] : null) ?? this.resolvedDefault());
        if (!this._addable || !this._deletable || !this._editableKeys || !this._editableValues) {
            const received = Array.isArray(state) ? state.filter((pair: any) => pair && typeof pair === 'object' && typeof pair.key === 'string') : [];
            const byKey = new Map(received.map((pair: any) => [String(pair.key).trim(), pair]));
            let rows: { key: string; value: unknown }[] = this._editableKeys ? received.map((pair: any) => ({ key: String(pair.key), value: pair.value })) : saved.map((pair, index) => ({ key: pair.key, value: (received[index] as any)?.value ?? pair.value }));
            if (!this._editableValues) rows = rows.map((row) => ({ ...row, value: saved.find((pair) => pair.key === row.key)?.value ?? null }));
            if (!this._addable) rows = rows.filter((row) => saved.some((pair) => pair.key === row.key));
            if (!this._deletable) for (const pair of saved) if (!rows.some((row) => row.key === pair.key)) rows.push({ key: pair.key, value: byKey.get(pair.key)?.value ?? pair.value });
            state = rows;
        }
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
        const tr = (key: string) => t(`navette-forms::components.key_value.${key}`);
        const keyLabel = this._keyLabel ?? tr('fields.key.label'), valueLabel = this._valueLabel ?? tr('fields.value.label');
        const reordering = { row: tr('reordering.row'), position: tr('reordering.position'), moved: tr('reordering.moved') };
        const key = `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify([keyLabel, valueLabel, this._reorderable])).digest('hex')}`;
        const iconButton = 'type="button" wire:loading.attr="aria-disabled" wire:loading.class="nv-disabled"';
        const ctx = this.context();
        const add = await resolveAction(this.getAddAction(), ctx), del = await resolveAction(this.getDeleteAction(), ctx), reorder = await resolveAction(this.getReorderAction(), ctx);
        const deletable = this._deletable && del.visible, addable = this._addable && add.visible, reorderable = this._reorderable && reorder.visible;
        const dangerClasses = ['nv-ac-icon-btn-action', 'nv-icon-btn', 'nv-size-sm', ...colorClassesOf(colorManager, 'icon-button', del.color, 'danger', colorManager?.getComponentClasses('icon-button', 'danger') ?? [])].join(' ');
        const reorderCell = reorderable ? `<td class="nv-has-action"><span class="nv-sr-only" data-reorder-description x-bind:id="$id('key-value-row') + '-' + row.id" x-text="rowDescription(row, index)"></span><div x-sortable-handle class="nv-fo-key-value-table-row-sortable-handle"><button title="${e(reorder.label)}" aria-label="${e(reorder.label)}" ${iconButton} class="${cls(['nv-ac-icon-btn-action', 'nv-icon-btn', 'nv-size-sm', ...colorClassesOf(colorManager, 'icon-button', reorder.color, 'gray', [])])}" x-bind:tabindex="rows.length &gt; 1 ? -1 : 0" x-bind:aria-hidden="rows.length &gt; 1 ? 'true' : null">${icon(reorder.icon ?? fieldActionIcon('key-value', 'reorder'))}</button></div><div class="nv-sr-only"><button type="button" tabindex="-1" data-reorder-hidden data-reorder-direction="up" x-on:click.stop="moveRow(row.id, index - 1)" x-bind:disabled="index === 0" x-bind:aria-describedby="$id('key-value-row') + '-' + row.id">${e(tr('actions.move_up.label'))}</button><button type="button" tabindex="-1" data-reorder-hidden data-reorder-direction="down" x-on:click.stop="moveRow(row.id, index + 1)" x-bind:disabled="index === rows.length - 1" x-bind:aria-describedby="$id('key-value-row') + '-' + row.id">${e(tr('actions.move_down.label'))}</button></div></td>` : '';
        return this.wrap(`<div aria-labelledby="${e(id)}-label" role="group" class="nv-fo-key-value nv-input-wrp"><div class="nv-input-wrp-content-ctn"><div x-load x-load-src="${e(asset('key-value'))}"${this.extraAlpineHtml()} x-id="['key-value-row']" x-data="keyValueFormComponent({
 state: $wire.$entangle(${e(js(this.getStatePath()))}, ${this.entangleLive() ? 'true' : 'false'}),
 reordering: ${e(js(reordering))},
 })" wire:ignore wire:key="${e(key)}" class="nv-fo-key-value-table-ctn"><table aria-labelledby="${e(id)}-label" id="${e(id)}" class="nv-fo-key-value-table"><thead><tr>${reorderable ? `<th scope="col" x-show="rows.length" class="nv-has-action"><span class="nv-sr-only">${e(tr('columns.reorder.label'))}</span></th>` : ''}<th scope="col">${e(keyLabel)}</th><th scope="col">${e(valueLabel)}</th>${deletable ? `<th scope="col" x-show="rows.length" class="nv-has-action"><span class="nv-sr-only">${e(tr('columns.actions.label'))}</span></th>` : ''}</tr></thead><tbody${reorderable ? ' x-on:end.stop="reorderRows($event)" x-sortable data-sortable-animation-duration="300"' : ''}><template x-bind:key="row.id" x-for="(row, index) in rows"><tr${reorderable ? ' x-bind:x-sortable-item="row.id"' : ''}>${reorderCell}<td><input aria-label="${e(keyLabel)}" placeholder="${e(this._keyPlaceholder ?? '')}" ${this._editableKeys ? '' : 'disabled '}type="text" x-model="row.key" x-on:input.debounce.500ms="updateState" class="nv-input" /></td><td><input aria-label="${e(valueLabel)}" placeholder="${e(this._valuePlaceholder ?? '')}" ${this._editableValues ? '' : 'disabled '}type="text" x-model="row.value" x-on:input.debounce.500ms="updateState" class="nv-input" /></td>${deletable ? `<td class="nv-has-action"><div x-on:click="deleteRow(index)"><button title="${e(del.label)}" aria-label="${e(del.label)}" ${iconButton} class="${dangerClasses}">${icon(del.icon ?? fieldActionIcon('key-value', 'delete'))}</button></div></td>` : ''}</tr></template></tbody></table><span x-ref="reorderStatus" class="nv-sr-only" role="status" aria-live="polite" aria-atomic="true"></span>${addable ? `<div x-on:click="addRow" class="nv-fo-key-value-add-action-ctn"><button ${iconButton} class="${cls(['nv-ac-link-action', 'nv-link', 'nv-size-md', ...colorClassesOf(colorManager, 'link', add.color, 'gray', [])])}">${add.icon ? icon(add.icon, { size: 'sm' }) : ''}<span class="nv-link-label">${e(add.label)}</span></button></div>` : ''}</div></div></div>`, { labelAsDiv: true, wrapperClass: 'nv-fo-key-value-wrp' });
    }
}

/** Developer-written JavaScript expression (e.g. a Slider tooltip formatter), inserted as is: never put user data in it. */
export class RawJs {
    readonly js: string;
    constructor(js: string) { this.js = js; }
    static make(js: string): RawJs { return new RawJs(js); }
    toString(): string { return this.js; }
}
/** Simple CSS length (`10rem`, `300px`, `50%`); anything else is rejected, since it ends up in a `style` attribute. */
const cssLength = (value: string | null): string | null => (value !== null && /^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test(value.trim()) ? value.trim() : null);
/** Field accessibility attributes: helper text and error message. */
function accessibilityOf(field: Field, options: { withInvalid?: boolean } = {}): Record<string, string | null> {
    const ids = [(field as any).getHelperTextId() as string | null, field.hasError() ? `${field.getId()}-error` : null].filter(Boolean);
    return { 'aria-describedby': ids.length ? ids.join(' ') : null, 'aria-invalid': options.withInvalid !== false && field.hasError() ? 'true' : null };
}

const MARKDOWN_TOOLBAR: string[][] = [['bold', 'italic', 'strike', 'link'], ['heading'], ['blockquote', 'codeBlock', 'bulletList', 'orderedList'], ['table', 'attachFiles'], ['undo', 'redo']];
/**
 * Markdown editor (EasyMDE). The state is raw Markdown text, to sanitize before any HTML display.
 * Files can be attached (images, stored on upload) when a storage is set (`fileAttachmentsStorage()` or `FileUpload.storage`); when read-only (`disabled()`),
 * the text is shown escaped, without Markdown conversion.
 */
export class MarkdownEditor extends Field {
    private _toolbarButtons: (string | string[])[] = MARKDOWN_TOOLBAR;
    private _minHeight: string | null = '10rem';
    private _maxHeight: string | null = null;
    private _placeholder: string | null = null;
    static make(name: string): MarkdownEditor { return configured(new MarkdownEditor(name)); }
    /** Fake Markdown for seeders and tests: chain blocks, then `toString()`; `seed` makes it reproducible. */
    static fake(options: ContentFakerOptions = {}): MarkdownFaker { return MarkdownFaker.make(options); }
    /** Toolbar buttons, grouped (`[['bold', 'italic'], ['undo', 'redo']]`) or flat. */
    toolbarButtons(buttons: (string | string[])[]): this { this._toolbarButtons = buttons; return this; }
    /** Removes buttons; with no argument, removes them all. */
    disableToolbarButtons(names: string[] = []): this {
        this._toolbarButtons = names.length ? this._toolbarButtons.map((group) => (Array.isArray(group) ? group.filter((name) => !names.includes(name)) : group)).filter((group) => (Array.isArray(group) ? group.length > 0 : !names.includes(group))) : [];
        return this;
    }
    disableAllToolbarButtons(condition = true): this { if (condition) this._toolbarButtons = []; return this; }
    /** Adds buttons (in a separate group). */
    enableToolbarButtons(names: string[]): this { this._toolbarButtons = [...this._toolbarButtons, names]; return this; }
    getToolbarButtons(): (string | string[])[] { return this._toolbarButtons; }
    hasToolbarButton(name: string): boolean { return this._toolbarButtons.some((group) => (Array.isArray(group) ? group.includes(name) : group === name)); }
    /** Minimum height of the editing area (`10rem` by default). */
    minHeight(height: Lazy<string | null, ComponentContext>): this { return this.setLazy('_minHeight', height, cssLength); }
    maxHeight(height: Lazy<string | null, ComponentContext>): this { return this.setLazy('_maxHeight', height, cssLength); }
    placeholder(text: Lazy<string | null, ComponentContext>): this { return this.setLazy('_placeholder', text); }
    /** Sends the state to the server while typing (`debounce` in milliseconds), or on blur with `onBlur`. */
    maxLength(length: Lazy<number, ComponentContext>): this { let last: number | null = null; return this.rule({ name: 'max', passes: async (v, ctx) => { last = await evaluate(length, ctx); return String(v).length <= last; }, message: (a) => `The ${a} field must not be greater than ${last} characters.` }); }
    minLength(length: Lazy<number, ComponentContext>): this { let last: number | null = null; return this.rule({ name: 'min', passes: async (v, ctx) => { last = await evaluate(length, ctx); return String(v).length >= last; }, message: (a) => `The ${a} field must be at least ${last} characters.` }); }
    hydrateState(value: unknown): unknown { return typeof value === 'string' ? value : null; }
    async getValidationRules(): Promise<Rule[]> {
        return [...(await super.getValidationRules()), { name: 'string', passes: (v) => typeof v === 'string', message: (a) => `The ${a} field must be a string.` }];
    }
    private _attachmentsStorage: FileStorage | null = null;
    private _attachmentsDirectory: string | null = null;
    private _attachmentTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    private _attachmentMaxSize = 12288;
    /** Where attached files are stored (`FileUpload.storage` by default); without storage, the "Attach files" button is hidden. */
    fileAttachmentsStorage(storage: FileStorage | null): this { this._attachmentsStorage = storage; return this; }
    fileAttachmentsDirectory(directory: Lazy<string | null, ComponentContext>): this { return this.setLazy('_attachmentsDirectory', directory); }
    /** Accepted types of attached files (images), checked on the file's content. */
    fileAttachmentsAcceptedFileTypes(types: string[]): this { this._attachmentTypes = types.filter((type) => type.startsWith('image/') && type !== 'image/svg+xml'); return this; }
    /** Maximum size of attached files, in kilobytes. */
    fileAttachmentsMaxSize(kilobytes: Lazy<number, ComponentContext>): this { return this.setLazy('_attachmentMaxSize', kilobytes); }
    private canAttachFiles(): boolean { return this.hasToolbarButton('attachFiles') && (this._attachmentsStorage ?? FileUpload.storage) !== null; }
    private visibleToolbar(): (string | string[])[] {
        if (this.canAttachFiles()) return this._toolbarButtons;
        return this._toolbarButtons.map((group) => (Array.isArray(group) ? group.filter((name) => name !== 'attachFiles') : group)).filter((group) => (Array.isArray(group) ? group.length > 0 : group !== 'attachFiles'));
    }
    getExposedMethods(): string[] { return ['getUploadedFileAttachmentTemporaryUrl', 'saveUploadedFileAttachmentAndGetUrl']; }
    getUploadedFileAttachmentTemporaryUrl(): null { return null; }
    /** Stores the file just uploaded to `componentFileAttachments.<state path>` and returns its URL. */
    async saveUploadedFileAttachmentAndGetUrl(): Promise<string | null> {
        if (!this.canAttachFiles() || (await this.isDisabled())) return null;
        return storeEditorAttachment(this, null, { storage: this._attachmentsStorage ?? FileUpload.storage, directory: this._attachmentsDirectory, types: this._attachmentTypes, maxSize: this._attachmentMaxSize });
    }
    async toHtml(): Promise<string> {
        const id = this.getId();
        const accessibility = accessibilityOf(this);
        if (await this.isDisabled()) {
            const state = this.context().state;
            const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, 'aria-describedby': accessibility['aria-describedby'], id, role: 'group', tabindex: this._maxHeight ? '0' : null })
                .style([this._minHeight ? `--min-height: ${this._minHeight}` : null, this._maxHeight ? `--max-height: ${this._maxHeight}` : null])
                .class(['nv-fo-markdown-editor', 'nv-disabled', 'nv-prose']);
            const content = typeof state === 'string' && state.trim() !== ''
                ? state.split(/\n{2,}/).map((paragraph) => `<p>${e(paragraph.trim()).replace(/\n/g, '<br />')}</p>`).join('')
                : `<span class="nv-fo-markdown-editor-placeholder">${e(this._placeholder ?? '')}</span>`;
            return this.wrap(`<div ${attributes.toHtml()}>${content}</div>`, { labelAsDiv: true });
        }
        const tr = (key: string) => t(`navette-forms::components.markdown_editor.${key}`);
        const translations = {
            file_attachments_accepted_file_types_message: tr('file_attachments_accepted_file_types_message'),
            file_attachments_max_size_message: tr('file_attachments_max_size_message'),
            tools: Object.fromEntries(['attach_files', 'blockquote', 'bold', 'bullet_list', 'code_block', 'heading', 'italic', 'link', 'ordered_list', 'redo', 'strike', 'table', 'undo'].map((tool) => [tool, tr(`tools.${tool}`)])),
        };
        const config = `markdownEditorFormComponent({
 canAttachFiles: ${this.canAttachFiles() ? 'true' : 'false'},
 isLiveDebounced: ${this.getLiveDebounce() !== null ? 'true' : 'false'},
 isLiveOnBlur: ${this.isLiveOnBlur() ? 'true' : 'false'},
 label: ${js(await this.getLabel())},
 liveDebounce: ${js(debounceMilliseconds(this.getLiveDebounce()))},
 maxHeight: ${js(this._maxHeight)},
 minHeight: ${js(this._minHeight)},
 placeholder: ${js(this._placeholder)},
 state: $wire.$entangle(${js(this.getStatePath())}, ${this.entangleLive(false) ? 'true' : 'false'}),
 toolbarButtons: ${js(this.visibleToolbar())},
 translations: ${js(translations)},
 uploadFileAttachmentUsing: async (file, onSuccess, onError) => {
 const acceptedTypes = ${js(this._attachmentTypes)}
 if (acceptedTypes && ! acceptedTypes.includes(file.type)) {
 return onError(${js(tr('file_attachments_accepted_file_types_message').replace(':values', this._attachmentTypes.join(', ')))})
 }
 const maxSize = ${js(this._attachmentMaxSize)}
 if (maxSize && file.size > +maxSize * 1024) {
 return onError(${js(tr('file_attachments_max_size_message').replace(':max', String(this._attachmentMaxSize)))})
 }
 $wire.upload(${js(`componentFileAttachments.${this.getStatePath()}`)}, file, () => {
 $saveUploadedFileAttachmentAndGetUrl()
 .then((url) => {
 if (! url) {
 return onError()
 }
 onSuccess(url)
 })
 })
 },
 })`;
        const wrapper = new Attributes().class(['nv-fo-markdown-editor', 'nv-input-wrp', { 'nv-invalid': this.hasError() }]);
        return this.wrap(`<div ${wrapper.toHtml()}><div class="nv-input-wrp-content-ctn"><div hidden data-field-accessibility ${new Attributes().merge(accessibility).toHtml()}></div><div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" x-load x-load-src="${e(asset('markdown-editor'))}"${this.extraAlpineHtml()} x-data="${e(config)}" wire:ignore><textarea x-ref="editor" x-cloak></textarea></div></div></div>`, { labelAsDiv: true });
    }
}

const CODE_LANGUAGES = ['cpp', 'css', 'go', 'html', 'java', 'javascript', 'json', 'markdown', 'php', 'python', 'sql', 'xml', 'yaml'];
/** Code editor (CodeMirror): highlighting from `language()`, line wrapping with `wrap()`. */
export class CodeEditor extends Field {
    private _language: string | null = null;
    private _canWrap = false;
    static make(name: string): CodeEditor { return configured(new CodeEditor(name)); }
    /** Language: `cpp`, `css`, `go`, `html`, `java`, `javascript`, `json`, `markdown`, `php`, `python`, `sql`, `xml`, `yaml`. */
    language(language: Lazy<string | null, ComponentContext>): this {
        return this.setLazy('_language', language, (value) => {
            if (value !== null && !CODE_LANGUAGES.includes(value)) throw new Error(`CodeEditor: unknown language "${value}".`);
            return value;
        });
    }
    getLanguage(): string | null { return this._language; }
    /**
     * Wraps long lines. Called with an HTML string, it is the inherited field wrapper,
     * which the component's rendering uses.
     */
    wrap(condition?: any, options?: any): any {
        if (typeof condition === 'string') return super.wrap(condition, options);
        this._canWrap = condition ?? true;
        return this;
    }
    canWrap(): boolean { return this._canWrap; }
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
 isLive: ${this.isLive() ? 'true' : 'false'},
 isLiveDebounced: ${this.getLiveDebounce() !== null ? 'true' : 'false'},
 isLiveOnBlur: ${this.isLiveOnBlur() ? 'true' : 'false'},
 label: ${js(await this.getLabel())},
 liveDebounce: ${js(debounceMilliseconds(this.getLiveDebounce()))},
 language: ${js(this._language)},
 state: $wire.$entangle(${js(this.getStatePath())}, ${this.entangleLive(false) ? 'true' : 'false'}),
 })`;
        // Key hash over the serialized `[isDisabled, language]` options.
        const hash = createHash('md5').update(`a:2:{i:0;b:${isDisabled ? 1 : 0};i:1;${this._language === null ? 'N;' : `s:${this._language.length}:"${this._language}";`}}`).digest('hex');
        const wrapper = new Attributes().class(['nv-fo-code-editor', 'nv-input-wrp', { 'nv-disabled': isDisabled, 'nv-invalid': this.hasError() }]);
        return super.wrap(`<div ${wrapper.toHtml()}><div class="nv-input-wrp-content-ctn"><div hidden data-field-accessibility ${new Attributes().merge(accessibilityOf(this)).toHtml()}></div><div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" x-load x-load-src="${e(asset('code-editor'))}"${this.extraAlpineHtml()} x-data="${e(config)}" wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.${hash}"><div x-ref="editor" x-cloak></div></div></div></div>`, { labelAsDiv: true });
    }
}

/**
 * Slider (noUiSlider): one value, or several handles when the state is a list (`default([20, 70])`).
 * Required by default; bounds, step and numeric type are checked on the server.
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
    constructor(name: string) { super(name); this._required = true; }
    static make(name: string): Slider { return configured(new Slider(name)); }
    range(minValue: number, maxValue: number): this { this._minValue = minValue; this._maxValue = maxValue; return this; }
    minValue(value: number): this { this._minValue = value; return this; }
    maxValue(value: number): this { this._maxValue = value; return this; }
    /** Step between values; `1` requires an integer, otherwise the value must be a multiple of the step. */
    step(step: Lazy<number | null, ComponentContext>): this { return this.setLazy('_step', step); }
    /** Minimum / maximum gap between two handles. */
    minDifference(difference: Lazy<number | null, ComponentContext>): this { return this.setLazy('_minDifference', difference); }
    maxDifference(difference: Lazy<number | null, ComponentContext>): this { return this.setLazy('_maxDifference', difference); }
    /** Forbidden margin at the ends: a number, or `[start, end]`. */
    rangePadding(padding: number | [number, number] | null): this { this._rangePadding = padding; return this; }
    /** Colored track segments, one boolean per segment (`[true, false]` by default). */
    fillTrack(fill: boolean[] | null = [true, false]): this { this._fillTrack = fill; return this; }
    vertical(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_vertical', condition); }
    /** Right to left (top to bottom for a vertical slider, the default when vertical). */
    rtl(condition: Lazy<boolean | null, ComponentContext> = true): this { return this.setLazy('_rtl', condition); }
    /** Handle behavior (`tap`, `drag`, `fixed`, `snap`, `unconstrained`…); `null`: none. */
    behavior(behavior: string | string[] | null = null): this { this._behavior = behavior; return this; }
    /** Handle tooltips: a boolean, one boolean per handle, or a `RawJs` formatting `$value`. */
    tooltips(tooltips: boolean | RawJs | (boolean | RawJs)[] = true): this { this._tooltips = tooltips; return this; }
    /** Pips: `range` (default), `steps`, `positions`, `count`, `values`. */
    pips(mode: string | null = 'range', density: number | null = null): this { this._pipsMode = mode; this._pipsDensity = density; return this; }
    pipsMode(mode: Lazy<string | null, ComponentContext>): this { return this.setLazy('_pipsMode', mode); }
    pipsDensity(density: Lazy<number | null, ComponentContext>): this { return this.setLazy('_pipsDensity', density); }
    /** Pip formatter (a `RawJs` receiving `$value`). */
    pipsFormatter(formatter: RawJs | null): this { this._pipsFormatter = formatter; return this; }
    pipsValues(values: number | number[] | null): this { this._pipsValues = values; return this; }
    steppedPips(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_steppedPips', condition); }
    /** Pip filter (a `RawJs` receiving `$value`). */
    pipsFilter(filter: RawJs | null): this { this._pipsFilter = filter; return this; }
    /** Non-linear scale (`{ '10%': 500, '50%': 4000 }`). */
    nonLinearPoints(points: Record<string, number | number[]> | null): this { this._nonLinearPoints = points; return this; }
    /** Decimal places of the saved value. */
    decimalPlaces(places: number | null): this { this._decimalPlaces = places; return this; }
    getMinValueWithPadding(): number { const padding = this._rangePadding; return this._minValue + (typeof padding === 'number' ? padding : Array.isArray(padding) ? (padding[0] ?? 0) : 0); }
    getMaxValueWithPadding(): number { const padding = this._rangePadding; return this._maxValue - (typeof padding === 'number' ? padding : Array.isArray(padding) ? (padding[1] ?? 0) : 0); }
    isMultiple(): boolean { return Array.isArray(this.context().state); }
    getDefaultState(): unknown { return this.resolvedDefault() ?? this._minValue; }
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
    /** A `RawJs` becomes a `{ to: ($value) => … }` formatter object. */
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
 state: $wire.$entangle(${js(this.getStatePath())}, ${this.entangleLive() ? 'true' : 'false'}),
 step: ${js(this._step)},
 tooltips: ${Slider.formatters(this._tooltips)},
 })`;
        const accessibility = accessibilityOf(this, { withInvalid: !this.isMultiple() });
        const attributes = new Attributes().merge({ 'aria-labelledby': `${id}-label`, id, role: 'group', ...this._extraAttributes })
            .class(['nv-fo-slider', { 'nv-fo-slider-has-pips': this._pipsMode !== null, 'nv-fo-slider-has-tooltips': hasTooltips, 'nv-fo-slider-vertical': this._vertical }]);
        // Key hash over the serialized `[isDisabled]` options.
        const hash = createHash('md5').update(`a:1:{i:0;b:${isDisabled ? 1 : 0};}`).digest('hex');
        return this.wrap(`<div hidden data-field-accessibility ${new Attributes().merge(accessibility).toHtml()}></div><div x-load x-load-src="${e(asset('slider'))}"${this.extraAlpineHtml()} x-data="${e(config)}" wire:ignore wire:key="${e(this.getLivewireKey() ?? '')}.${hash}" ${attributes.toHtml()}></div>`, { labelAsDiv: true });
    }
}

/**
 * Field whose control is rendered in the browser by a JavaScript module that the application brings (React, Vue, Svelte or
 * plain DOM code), with two-way binding to the field state. The module default-exports a mount function
 * `({ host, props, utilities }) => ({ update(props), destroy() })`; `props` holds the value, `onChange()`, `onBlur()` and the
 * input settings (`id`, `isDisabled`, `isInvalid`…). Extend it and override `getRenderer()` to build a reusable field.
 */
export class JsField extends Field {
    protected _renderer: Lazy<JsRenderer | null, ComponentContext> = null;
    protected _rendererConfiguration: Lazy<Record<string, unknown> | null, ComponentContext> = null;
    protected _readOnly: Lazy<boolean, ComponentContext> = false;

    static make(name: string): JsField { return configured(new JsField(name)); }
    /** URL of the ES module (resolved against the page URL), or a trusted `RawJs` function expression. Never from user input. */
    renderer(renderer: Lazy<JsRenderer | null, ComponentContext>): this { this._renderer = renderer; return this; }
    async getRenderer(): Promise<JsRenderer | null> { return (await evaluate(this._renderer, this.context())) ?? null; }
    /** JSON-serializable values passed to the renderer as `props.configuration` (sent to the browser: no secrets). */
    rendererConfiguration(configuration: Lazy<Record<string, unknown> | null, ComponentContext>): this { this._rendererConfiguration = configuration; return this; }
    async getRendererConfiguration(): Promise<Record<string, unknown>> { return normalizeRendererConfiguration(await evaluate(this._rendererConfiguration, this.context())); }
    /** Read-only input (`props.isReadOnly`): the value is still validated and saved, so check it on the server. */
    readOnly(condition: Lazy<boolean, ComponentContext> = true): this { this._readOnly = condition; return this; }
    async isReadOnly(): Promise<boolean> { return Boolean(await evaluate(this._readOnly, this.context())); }
    /**
     * Sends the edits to the server: on each change, after `props.onBlur()` (`{ onBlur: true }`), or once the user pauses
     * (`{ debounce: 500 }` or `'500ms'`). `false` turns it off.
     */
    /** When edits are sent to the server, passed to the renderer's props (`isLive`, `isLiveOnBlur`, `debounce`). */
    getBindingConfiguration(): JsFieldBindingConfiguration {
        const isLiveOnBlur = this.isLiveOnBlur();
        return { isLive: this.isLive(), isLiveOnBlur, debounce: isLiveOnBlur ? null : debounceMilliseconds(this.getLiveDebounce()) };
    }
    /** Ids of the helper text and validation error, for the control's `aria-describedby`. */
    getDescriptionIds(): string[] {
        if (this.container.getFieldWrapperView?.() === 'navette-forms::plain-field-wrapper') return [];
        return [this.getHelperTextId(), this.hasError() ? `${this.getId()}-error` : null].filter((id): id is string => id !== null);
    }
    async getFieldConfiguration(): Promise<JsFieldConfiguration> {
        return { id: this.getId(), ariaDescribedBy: this.getDescriptionIds().join(' '), isDisabled: await this.isDisabled(), isReadOnly: await this.isReadOnly(), isRequired: await this.isRequired(), isInvalid: this.hasError() };
    }
    async toHtml(): Promise<string> {
        return this.wrap(jsFieldHtml({
            livewireKey: this.getLivewireKey(),
            statePath: this.getStatePath(),
            assetUrl: asset('js-field'),
            renderer: await this.getRenderer(),
            rendererConfiguration: await this.getRendererConfiguration(),
            fieldConfiguration: await this.getFieldConfiguration(),
            bindingConfiguration: this.getBindingConfiguration(),
            extraAttributes: new Attributes().merge(this._extraAttributes).toHtml(),
            failedToLoadMessage: t('navette-forms::components.js_field.failed_to_load'),
        }));
    }
}

/** Hidden field: an `<input type="hidden">` bound to the state, with no label or grid slot. */
export class Hidden extends Field {
    constructor(name: string) { super(name); this._columnSpan = { default: 'hidden' }; }
    static make(name: string): Hidden { return configured(new Hidden(name)); }
    async toHtml(): Promise<string> {
        const attributes = new Attributes().merge({ id: this.getId(), type: 'hidden', [this.wireModel()]: this.getStatePath(), ...this._extraAttributes }).class(['nv-fo-hidden']);
        return `<input ${attributes.toHtml()} />`;
    }
}

/** One-time code: one box per digit; the state is a digit string of exactly `length()` characters. */
export class OneTimeCodeInput extends Field {
    private _length = 6;
    private _submitOnCompletion = false;
    private _readOnly = false;
    constructor(name: string) {
        super(name);
        // `numeric` rather than `integer`, which would reject leading zeros; then `digits:<length>`.
        this.rule({ name: 'numeric', passes: (v) => /^\d+$/.test(String(v)), message: (a) => `The ${a} field must be a number.` });
        this.rule({ name: 'digits', passes: (v) => new RegExp(`^\\d{${this._length}}$`).test(String(v)), message: (a) => `The ${a} field must be ${this._length} digits.` });
    }
    static make(name: string): OneTimeCodeInput { return configured(new OneTimeCodeInput(name)); }
    /** Number of digits (6 by default). */
    length(length: number): this { this._length = Math.max(1, Math.min(32, Math.floor(length))); return this; }
    getLength(): number { return this._length; }
    /** Submits the form as soon as the last digit is typed. */
    submitOnCompletion(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_submitOnCompletion', condition); }
    readOnly(condition: Lazy<boolean, ComponentContext> = true): this { return this.setLazy('_readOnly', condition, Boolean); }
    hydrateState(value: unknown): unknown { return value === null || value === undefined ? null : String(value); }
    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const accessibility = accessibilityOf(this);
        const label = await this.getLabel();
        const container = new Attributes().merge({ ...this._extraAttributes, 'aria-describedby': accessibility['aria-describedby'], 'aria-label': label !== '' ? label : null }).class(['nv-one-time-code-input-ctn']);
        const first = new Attributes(this.getExtraInputAttributes()).merge({ ...accessibility, autofocus: await this.isAutofocused(), disabled: isDisabled, id: this.getId(), readonly: this._readOnly, required: await this.isRequired() }).class(['nv-one-time-code-input-digit']);
        const digit = new Attributes().merge(accessibility);
        const inputs = Array.from({ length: this._length }, (_, index) => (index === 0
            ? `<input autocomplete="one-time-code" inputmode="numeric" type="text" ${first.toHtml()} />`
            : `<input aria-label="${e(t('navette::components/input/one-time-code.aria_label', { position: index + 1, count: this._length }))}" autocomplete="off" inputmode="numeric" type="text" ${digit.toHtml()}${isDisabled ? ' disabled' : ''}${this._readOnly ? ' readonly' : ''} class="nv-one-time-code-input-digit" />`));
        return this.wrap(`<div x-data="${e(`{ code: $wire.$entangle(${js(this.getStatePath())}, ${this.entangleLive() ? 'true' : 'false'}), }`)}"><div x-data="navetteOneTimeCodeInput({ shouldSubmitOnCompletion: ${this._submitOnCompletion ? 'true' : 'false'} })" x-modelable="state" x-model="code" dir="ltr" role="group"${this.extraAlpineHtml()} ${container.toHtml()}>${inputs.join('')}</div></div>`);
    }
}

/**
 * Read-only text in a form. Nothing is saved. An `HtmlString` is inserted as is.
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
        const labelCol = this._hiddenLabel ? `<div class="nv-in-entry-label nv-sr-only" role="term">${label}</div>` : `<div class="nv-in-entry-label-col"><div class="nv-in-entry-label-ctn"><div class="nv-in-entry-label" role="term">${label}</div></div></div>`;
        return `<div class="nv-in-entry">${labelCol}<div class="nv-in-entry-content-col"><div class="nv-in-entry-content-ctn" role="definition"><div class="nv-in-entry-content"><div class="nv-in-text-item nv-size-sm nv-in-text nv-wrapped">${html}</div></div></div></div></div>`;
    }
}

// Nested state: a field inside a stateful group (e.g. `address.city`) is read and written at its path relative to the schema.
function relativePath(schema: Schema, field: Component): string[] {
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

/** A layout component saving its fields to a singular relationship (`Group.make().relationship('customer')`). */
const isRelationshipLayout = (c: Component): c is LayoutComponent => c instanceof LayoutComponent && c.getSingularRelationship() !== null;
/** Whether a component is inside a relationship layout of the schema (its state is loaded and saved by that layout). */
function isInsideRelationshipLayout(schema: Schema, c: Component): boolean {
    let parent = c.container.getParentComponent();
    while (parent && parent.container) {
        if (isRelationshipLayout(parent)) return true;
        if (parent.container === schema) return false;
        parent = parent.container.getParentComponent();
    }
    return false;
}
/** Runs the `afterStateHydrated()` callbacks (`formatStateUsing()`…) of the components, reading and writing `target`. */
function callAfterStateHydrated(schema: Schema, target: Record<string, unknown>, components: Component[]): void {
    withStateSource(schema, target, () => { for (const c of components) c.callAfterStateHydrated(); });
}
/** Fills the default state of every field in a schema, then runs the `afterStateHydrated()` callbacks. */
export function fillSchema(schema: Schema, target: Record<string, unknown>): void {
    for (const c of schema.getFlatComponents()) if (c instanceof Field) writePath(target, relativePath(schema, c), c.getDefaultState());
    callAfterStateHydrated(schema, target, schema.getFlatComponents());
}
/**
 * Fills the form state from a record, field by field, then runs the `afterStateHydrated()` callbacks (those of the fields of a
 * relationship layout run once `loadSchemaRelationships()` has loaded them).
 */
export function fillSchemaFromRecord(schema: Schema, target: Record<string, unknown>, record: Record<string, unknown>): void {
    for (const c of schema.getFlatComponents()) {
        if (!(c instanceof Field)) continue;
        const segments = relativePath(schema, c);
        writePath(target, segments, c.hydrateState(readPath(record, segments) ?? c.getDefaultState()));
    }
    callAfterStateHydrated(schema, target, schema.getFlatComponents().filter((c) => !isInsideRelationshipLayout(schema, c)));
}
/**
 * Fills the fields that load their state from the record's relationships (`loadStateFromRelationshipsUsing()`,
 * `Select::relationship()`…) and the fields of the layout components saving to a relationship (`Group.relationship()`).
 */
export async function loadSchemaRelationships(schema: Schema, target: Record<string, unknown>, record: unknown): Promise<void> {
    if (!record) return;
    for (const c of schema.getFlatComponents()) {
        if (isRelationshipLayout(c)) {
            if (isInsideRelationshipLayout(schema, c)) continue;
            await loadRelationshipLayout(schema, target, c, record);
            continue;
        }
        if (!(c instanceof Field) || isInsideRelationshipLayout(schema, c)) continue;
        const loaded = await c.loadStateFromRelationships(record);
        if (loaded) {
            writePath(target, relativePath(schema, c), c.hydrateState(loaded.state));
            callAfterStateHydrated(schema, target, [c]);
        }
    }
}
/** Loads a relationship layout's fields from the related record (then the relationship layouts nested in it). */
async function loadRelationshipLayout(schema: Schema, target: Record<string, unknown>, layout: LayoutComponent, record: unknown): Promise<void> {
    const state = await loadSingularRelationshipState(layout, record);
    const path = relativePath(schema, layout);
    const current = readPath(target, path);
    writePath(target, path, current && typeof current === 'object' ? Object.assign(current, state) : state);
    const child = layout.getChildSchemas()[0];
    callAfterStateHydrated(schema, target, child.getFlatComponents().filter((c) => !isInsideRelationshipLayout(child, c)));
    for (const c of child.getFlatComponents()) if (isRelationshipLayout(c) && !isInsideRelationshipLayout(child, c)) await loadRelationshipLayout(schema, target, c, record);
}
/** Components of a schema whose relationships are saved: the visible ones, and the hidden ones marked `saveRelationshipsWhenHidden()`. */
async function componentsSavingRelationships(schema: Schema): Promise<Component[]> {
    const out: Component[] = [];
    for (const c of schema.getComponents()) {
        if (!(await c.isVisible()) && !(await c.shouldSaveRelationshipsWhenHidden())) continue;
        out.push(c);
        for (const child of ((c as any).getChildSchemas?.() ?? []) as Schema[]) out.push(...(await componentsSavingRelationships(child)));
    }
    return out;
}
/**
 * Saves the fields that write the record's relationships, and the layout components saving to a singular relationship
 * (several layouts using the same relationship are saved together), once the record is created or updated.
 */
export async function saveSchemaRelationships(schema: Schema, record: unknown): Promise<void> {
    if (!record) return;
    const layouts = new Map<string, LayoutComponent[]>();
    for (const c of await componentsSavingRelationships(schema)) {
        if (isInsideRelationshipLayout(schema, c)) continue;
        if (isRelationshipLayout(c)) {
            const key = c.getStatePath();
            layouts.set(key, [...(layouts.get(key) ?? []), c]);
            continue;
        }
        if (c instanceof Field && (await c.isDehydrated() || (await c.getDehydratedOverride()) === false) && (await c.savesRelationships())) await c.saveRelationships(record);
    }
    for (const group of layouts.values()) {
        let data: Record<string, unknown> = {};
        for (const layout of group) data = { ...data, ...(await getSchemaState(layout.getChildSchemas()[0])) };
        await saveSingularRelationship(group[0], record, data);
        // Relationship fields and layouts inside it save to the related record.
        for (const layout of group) await saveSchemaRelationships(layout.getChildSchemas()[0], record);
    }
}
/** Validates every visible field of a schema; returns errors by state path. */
export async function validateSchema(schema: Schema): Promise<Record<string, string[]>> {
    const errors: Record<string, string[]> = {};
    for (const c of await schema.getVisibleFlatComponents()) {
        if (!(c instanceof Field)) continue;
        const messages = await c.validate();
        if (messages.length) errors[c.getStatePath()] = messages;
    }
    return errors;
}

/** State to save: only declared, visible, dehydrated fields; an empty string becomes `null`. */
export async function getSchemaState(schema: Schema): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};
    const fields: Field[] = [];
    const skipped: string[] = [];
    const visible = await schema.getVisibleFlatComponents();
    for (const c of visible) if (c instanceof Field) await c.callBeforeStateDehydrated();
    for (const c of visible) {
        // A layout component saving to a relationship leaves its fields out: they are saved to the related record.
        if (isRelationshipLayout(c)) { skipped.push(c.getStatePath()); continue; }
        if (!(c instanceof Field)) continue;
        // Relationship fields (and the fields of their items) save themselves after the record (see saveSchemaRelationships), unless forced with `dehydrated()`.
        if (skipped.some((path) => c.getStatePath().startsWith(`${path}.`))) continue;
        // A field that is not dehydrated leaves out its children too (the items of a `dehydrated(false)` repeater).
        if (!(await c.isDehydrated())) { skipped.push(c.getStatePath()); continue; }
        if ((await c.getDehydratedOverride()) !== true && (await c.savesRelationships())) { skipped.push(c.getStatePath()); continue; }
        const state = await c.dehydrateState(c.context().state);
        writePath(data, relativePath(schema, c), state === '' || state === undefined ? null : state);
        for (const [name, value] of Object.entries((c as any).getExtraDehydratedState?.() ?? {})) writePath(data, [...relativePath(schema, c).slice(0, -1), name], value);
        fields.push(c);
    }
    // Deepest first: a container sees its children already shaped.
    for (const c of fields.reverse()) {
        const path = relativePath(schema, c);
        const current = readPath(data, path);
        // `dehydrateStateUsing()` / `mutateDehydratedStateUsing()` see the field's shaped state (a container's, with its children).
        const final = await c.applyDehydrationCallbacks(c.finalizeDehydratedState(current));
        if (final !== current) writePath(data, path, final);
    }
    return data;
}

type StepHook = (ctx: ComponentContext) => void | Promise<void>;
/** Throw from a step's `beforeValidation` / `afterValidation` to stay on the current step. */
export class Halt extends Error { constructor() { super('Halt'); } }

/** A wizard step: a label, an optional description and icon, and its own schema. */
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
    /** Runs before the step is validated, on "Next"; throw `Halt` to stay on the step. */
    beforeValidation(callback: StepHook | null): this { this._beforeValidation = callback; return this; }
    /** Runs after a successful validation, before moving to the next step; throw `Halt` to stay on the step. */
    afterValidation(callback: StepHook | null): this { this._afterValidation = callback; return this; }
    getLabel(): string { return this.label; }
    getDescription(): string | null { return this._description; }
    getIcon(): string | null { return this._icon; }
    getCompletedIcon(): string | null { return this._completedIcon; }
    async callBeforeValidation(): Promise<void> { await this._beforeValidation?.(this.context()); }
    async callAfterValidation(): Promise<void> { await this._afterValidation?.(this.context()); }
    getChildSchemas(): Schema[] { return [childSchema(this, this.children).columns(this._columns)]; }
    async toHtml(): Promise<string> { return this.getChildSchemas()[0].toHtml(); }
    /** Step panel: a `<form>` when the wizard has a submit handler (Enter goes to the next step, or saves on the last one). */
    async toStepHtml(submitHandler: string | null, hasHeader: boolean): Promise<string> {
        const key = this.getKey()!;
        const tag = submitHandler ? 'form' : 'div';
        const attributes = new Attributes().merge({
            'aria-labelledby': hasHeader ? `${key}-tab` : null,
            'aria-label': hasHeader ? null : this.label,
            id: key,
            role: 'group',
            'x-data': `navetteSchemaComponent(${js(this.getAlpineScopeConfiguration())})`,
        }).class(['nv-sc-wizard-step']);
        return `<${tag} x-bind:tabindex="$el.querySelector('[autofocus]') ? '-1' : '0'" x-bind:class="{
                'nv-active': step === ${e(js(key))},
            }" x-on:expand="
                if (! isStepAccessible(${e(js(key))})) {
                    return
                }

                step = ${e(js(key))}            "${submitHandler ? ` x-on:submit.prevent="isLastStep() ? ${e(submitHandler)} : requestNextStep()"` : ''} x-cloak x-ref="step-${e(key)}" ${attributes.toHtml()}>${await this.toHtml()}${submitHandler ? '<input type="submit" hidden />' : ''}</${tag}>`;
    }
}

/**
 * Multi-step wizard: every step is rendered, the browser only shows the current one.
 * "Next" validates the current step on the server before moving on, unless the wizard is `skippable()`.
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
    /** Steps can be visited in any order, without validation. */
    skippable(condition = true): this { this._skippable = condition; return this; }
    /** Step shown on open (1-based). */
    startOnStep(step: number): this { this._startStep = step; return this; }
    /** `false`: no card around the wizard (as on a resource page). */
    contained(condition = true): this { this._contained = condition; return this; }
    hiddenHeader(condition = true): this { this._headerHidden = condition; return this; }
    /** Action shown instead of "Back" on the first step. */
    cancelAction(action: Action | null): this { this._cancelAction = action; return this; }
    /** Action shown instead of "Next" on the last step. */
    submitAction(action: Action | null): this { this._submitAction = action; return this; }
    /** Alpine expression run when the last step is submitted from the keyboard (e.g. `$wire.create()`). */
    alpineSubmitHandler(handler: string | null): this { this._alpineSubmitHandler = handler; return this; }
    /** Keeps the current step in the URL (`?step=…`). */
    persistStepInQueryString(key: string | null = 'step'): this { this._stepQueryStringKey = key; return this; }
    nextAction(modify: ((action: Action) => Action | void) | null): this { this._modifyNext = modify; return this; }
    previousAction(modify: ((action: Action) => Action | void) | null): this { this._modifyPrevious = modify; return this; }

    getKey(): string {
        const statePath = this.container.getStatePath();
        const own = statePath ? `${statePath}::wizard` : 'wizard';
        return `${this.container.getKey()}.${this._label ? `${slug(this._label)}::${own}` : own}`;
    }
    getExposedMethods(): string[] { return ['nextStep', 'previousStep']; }
    /** "Next" re-renders the component so the step's validation errors show up. */
    isRenderlessMethod(): boolean { return false; }
    getChildSchemas(): Schema[] { return [childSchema(this, this.steps)]; }
    private getSteps(): Step[] { this.getChildSchemas(); return this.steps; }

    /** Called by the browser on "Next": validates the current step, then announces the next one. */
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
    /** Going back happens in the browser; this exposed method is a no-op the front end still calls. */
    previousStep(): void {}

    async toHtml(): Promise<string> {
        const steps = this.getSteps();
        const key = this.getKey();
        const ctx = this.context();
        const tr = (name: string) => t(`navette-schemas::components.wizard.${name}`);
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
                : `<span x-show="getStepIndex(step) &lt;= ${index}" aria-hidden="true" class="nv-sc-wizard-header-step-number">${String(index + 1).padStart(2, '0')}</span>`;
            header.push(`<li class="nv-sc-wizard-header-step" x-bind:class="{
                                'nv-active': getStepIndex(step) === ${index},
                                'nv-completed': getStepIndex(step) &gt; ${index},
                            }"><button type="button" id="${e(stepKey)}-tab" aria-controls="${e(stepKey)}" x-bind:aria-current="getStepIndex(step) === ${index} ? 'step' : null" x-on:click="step = ${e(js(stepKey))}" x-bind:disabled="! isStepAccessible(${e(js(stepKey))}) || ${previousDisabled ? 'true' : 'false'}" class="nv-sc-wizard-header-step-btn"><div class="nv-sc-wizard-header-step-icon-ctn">${icon(step.getCompletedIcon() ?? icons.resolve('schemas::components.wizard.completed-step') ?? 'o-check', { size: 'lg', attributes: new Attributes({ 'x-cloak': 'x-cloak', 'x-show': `getStepIndex(step) > ${index}` }) })}${stepIcon}</div><div class="nv-sc-wizard-header-step-text"><span class="nv-sc-wizard-header-step-label">${e(step.getLabel())}</span>${step.getDescription() ? `<span class="nv-sc-wizard-header-step-description">${e(step.getDescription()!)}</span>` : ''}<span class="nv-sr-only" x-text="getStepIndex(step) &gt; ${index} ? ${e(js(tr('header.step.statuses.completed')))} : (getStepIndex(step) === ${index} ? '' : ${e(js(tr('header.step.statuses.upcoming')))})"></span></div></button>${index < steps.length - 1 ? '<svg fill="none" preserveAspectRatio="none" viewBox="0 0 22 80" aria-hidden="true" class="nv-sc-wizard-header-step-separator"><path d="M0 -2L20 40L0 82" stroke-linejoin="round" stroke="currentcolor" vector-effect="non-scaling-stroke"></path></svg>' : ''}</li>`);
        });
        const panels: string[] = [];
        for (const step of steps) panels.push(await step.toStepHtml(this._alpineSubmitHandler, !this._headerHidden));

        const outer = new Attributes().merge({ id: key }).class(['nv-sc-wizard', { 'nv-contained': this._contained, 'nv-sc-wizard-header-hidden': this._headerHidden }]);
        return `<div x-load x-load-src="${e(views.render('navette-schemas::asset', { path: 'wizard' }).trim())}" x-data="wizardSchemaComponent({
                        isSkippable: ${this._skippable ? 'true' : 'false'},
                        isStepPersistedInQueryString: ${this._stepQueryStringKey ? 'true' : 'false'},
                        livewireId: ${e(js(this.livewire.id))},
                        schemaKey: ${e(js(this.container.getKey().split('.')[0]))},
                        startStep: ${this._startStep},
                        stepQueryStringKey: ${e(js(this._stepQueryStringKey))},
                    })" x-on:next-wizard-step.window="${e(`if ($event.detail.key === ${js(key)}) goToNextStep($event.detail.step, $event.detail.currentStep)`)}" x-on:go-to-wizard-step.window="${e(`$event.detail.key === ${js(key)} && goToStep($event.detail.step)`)}" wire:ignore.self ${outer.toHtml()}><input type="hidden" value="${e(JSON.stringify(visibleKeys))}" x-ref="stepsData" />${this._headerHidden ? '' : `<ol${this._label ? ` aria-label="${e(this._label)}"` : ''} role="list" x-cloak x-ref="header" class="nv-sc-wizard-header">${header.join('')}</ol>`}${panels.join('')}<div x-cloak class="nv-sc-wizard-footer"><div x-cloak${previousDisabled ? '' : ' x-on:click="goToPreviousStep"'} x-show="! isFirstStep()">${await previousAction.toHtml(ctx)}</div><div x-show="isFirstStep()">${this._cancelAction ? await this._cancelAction.toHtml(ctx) : ''}</div><div x-cloak${nextDisabled ? '' : ` x-on:click.capture="if ($el.hasAttribute('aria-disabled')) { $event.preventDefault(); $event.stopImmediatePropagation() }" x-on:click="if (! $el.hasAttribute('aria-disabled')) requestNextStep()"`} x-bind:class="{ 'nv-hidden': isLastStep() }" wire:loading.attr="aria-disabled">${await nextAction.toHtml(ctx)}</div><div x-bind:class="{ 'nv-hidden': ! isLastStep() }">${this._submitAction ? await this._submitAction.toHtml(ctx) : ''}</div></div></div>`;
    }
}

/** Temporary file received by the runtime (see @navette-js/wire). */
export type TemporaryUpload = { id: string; path: string; name: string; type: string; size: number; extension: string };
/** A saved file as sent to FilePond. `type` is `null` (and `size` 0) with `fetchFileInformation(false)`. */
export type UploadedFileInfo = { name: string; size: number; type: string | null; url: string; openableUrl?: string; downloadableUrl?: string };
/** URL of a saved file for the open or download button (`getOpenableFileUrlUsing()`), or `null` for the file's own URL. */
export type FileUrlResolver = (file: string, ctx: ComponentContext) => string | null | undefined | Promise<string | null | undefined>;
type FieldLazy<T> = Lazy<T, ComponentContext>;
/** Saved state item when the field does not store files itself (`storeFiles(false)`): an already saved file, or a temporary file to process. */
export type FileUploadEntry = { key: string } | { file: TemporaryUpload };
/** Where files go once the form is saved. */
export interface FileStorage extends FileUrlStorage {
    /** Stores a temporary file and returns its key (relative path); `name` is the file name to use instead of a random one. */
    store(file: TemporaryUpload, directory: string | null, name?: string | null, options?: FileStoreOptions): Promise<string>;
    info(key: string): Promise<UploadedFileInfo | null>;
    /** Public URL of a stored file, without reading it (used by `fetchFileInformation(false)`; `info()` otherwise). */
    url?(key: string): string | null | Promise<string | null>;
    /** `'private'`: files are shown through `temporaryUrl()`. `'public'` when left out. */
    readonly visibility?: 'public' | 'private';
    /** Temporary URL of a private file, valid until `expiresAt`, that nobody can forge or extend. */
    temporaryUrl?(key: string, expiresAt: Date): string | null | Promise<string | null>;
    /** Whether a stored file exists (`checkFileExistence()` of image entries and columns). */
    exists?(key: string): boolean | Promise<boolean>;
    /** Deletes a stored file (`deleteUploadedFileUsing()`); a key outside the storage is ignored. */
    delete?(key: string): void | Promise<void>;
}
/**
 * `move`: the temporary file may be moved instead of copied (`moveFiles()`); the field removes it afterwards either way.
 * `visibility`: the field's `visibility()`, for storages that keep public and private files apart.
 */
export type FileStoreOptions = { move?: boolean; visibility?: 'public' | 'private' };
/**
 * A file name chosen by the application or the user, made safe for storage: no directory part, only letters, digits, `_` and
 * `-`, and always the extension detected from the file's content (an uploaded `shell.php` declared as an image is stored
 * as `shell.png`).
 */
export function safeStorageName(name: string, extension: string): string {
    const base = (name.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || randomUUID();
    return `${base}.${extension.replace(/[^A-Za-z0-9]/g, '') || 'bin'}`;
}
/** Width and height of a PNG, GIF, JPEG or WebP image, read from its header; `null` for other files. */
export function readImageSize(path: string): { width: number; height: number } | null {
    let buffer: Buffer;
    try { const fd = openSync(path, 'r'); buffer = Buffer.alloc(1024 * 1024); const read = readSync(fd, buffer, 0, buffer.length, 0); closeSync(fd); buffer = buffer.subarray(0, read); } catch { return null; }
    if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        const chunk = buffer.toString('ascii', 12, 16);
        if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
        if (chunk === 'VP8L') { const bits = buffer.readUInt32LE(21); return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }; }
        if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
        return null;
    }
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) { offset++; continue; }
            const marker = buffer[offset + 1];
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
            offset += 2 + buffer.readUInt16BE(offset + 2);
        }
    }
    return null;
}
const ratioOf = (ratio: string): number | null => { const [width, height] = ratio.split(/[:/]/).map(Number); return width > 0 && height > 0 ? width / height : null; };
export type ImageDimensions = { minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number; width?: number; height?: number; minRatio?: number; maxRatio?: number; ratio?: number };

/** Copies a file without overwriting; with `move`, hard-links then unlinks it (same disk), copying when that fails across disks. */
function placeFile(source: string, target: string, move: boolean): void {
    if (move) {
        try { linkSync(source, target); unlinkSync(source); return; } catch (error: any) { if (error?.code === 'EEXIST') throw error; }
    }
    copyFileSync(source, target, fsConstants.COPYFILE_EXCL);
    if (move) rmSync(source, { force: true });
}
/**
 * Local disk storage. Public by default: the folder is served under `baseUrl` (`express.static()` or `serve()`).
 * With `{ visibility: 'private', key }`, files are only served by `serve()`, behind temporary signed URLs.
 * File names are random; the extension comes from the detected type.
 */
export class LocalFileStorage implements FileStorage {
    private root: string;
    private baseUrl: string;
    readonly visibility: 'public' | 'private';
    private secret: string | Buffer | null;
    constructor(root: string, baseUrl: string, options: LocalFileStorageOptions = {}) {
        this.root = root; this.baseUrl = baseUrl.replace(/\/$/, '');
        this.visibility = options.visibility === 'private' ? 'private' : 'public';
        this.secret = options.key ?? null;
        if (this.visibility === 'private' && (!this.secret || this.secret.length < 16)) throw new Error('LocalFileStorage: a private storage needs a key of at least 16 characters to sign its URLs.');
    }
    private resolve(key: string): string | null {
        if (!isStoredFileKey(key)) return null;
        return nodePath.join(this.root, ...key.split('/'));
    }
    private encoded(key: string): string { return `${this.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`; }
    /** Temporary URL of a file, signed with the storage's key (HMAC over the base URL, the key and the expiry). */
    temporaryUrl(key: string, expiresAt: Date = temporaryFileUrlExpiry()): string | null {
        if (!this.resolve(key)) return null;
        if (!this.secret) throw new Error('LocalFileStorage: temporary URLs need a key (new LocalFileStorage(root, url, { key })).');
        return signedFileUrl(this.secret, this.encoded(key), key, expiresAt, this.baseUrl);
    }
    exists(key: string): boolean { const target = this.resolve(key); return target !== null && existsSync(target) && containedFile(this.root, target) !== null; }
    /** Deletes a file and its metadata; never follows a path or a link leading outside the folder. */
    delete(key: string): void { deleteContainedFile(this.root, key); }
    /**
     * Express handler serving the folder: `app.use('/files', storage.serve())`, at the storage's base URL. A private storage
     * refuses (403) any request without a valid, unexpired signature for that very file.
     */
    serve() { return serveContainedFiles(this.root, { isPrivate: this.visibility === 'private', key: this.secret, scope: this.baseUrl }); }
    async store(file: TemporaryUpload, directory: string | null, name: string | null = null, options: FileStoreOptions = {}): Promise<string> {
        let key = [directory, name === null ? `${randomUUID()}.${file.extension}` : safeStorageName(name, file.extension)].filter(Boolean).join('/');
        // A chosen name never overwrites another file: a short random suffix is added.
        if (name !== null && this.resolve(key) && existsSync(this.resolve(key)!)) key = key.replace(/(\.[A-Za-z0-9]+)$/, `-${randomUUID().slice(0, 8)}$1`);
        const target = this.resolve(key);
        if (!target) throw new Error('Invalid upload directory.');
        mkdirSync(nodePath.dirname(target), { recursive: true });
        try { placeFile(file.path, target, options.move === true); } catch (error: any) {
            // Another save took this name meanwhile: random suffix.
            if (error?.code !== 'EEXIST' || name === null) throw error;
            return this.store(file, directory, `${safeStorageName(name, file.extension).replace(/\.[^.]*$/, '')}-${randomUUID().slice(0, 8)}`, options);
        }
        writeFileSync(`${target}.meta.json`, JSON.stringify({ name: file.name, type: file.type }));
        return key;
    }
    async info(key: string): Promise<UploadedFileInfo | null> {
        const target = this.resolve(key);
        if (!target || !existsSync(target)) return null;
        let meta: { name?: string; type?: string } = {};
        try { meta = JSON.parse(readFileSync(`${target}.meta.json`, 'utf8')); } catch { /* file dropped in without metadata */ }
        return { name: meta.name ?? nodePath.basename(key), size: statSync(target).size, type: meta.type ?? 'application/octet-stream', url: this.url(key)! };
    }
    /** URL of a file: permanent for a public storage, temporary (signed) for a private one. */
    url(key: string): string | null {
        if (!this.resolve(key)) return null;
        return this.visibility === 'private' ? this.temporaryUrl(key) : this.encoded(key);
    }
}

/**
 * File upload (FilePond).
 * State: `{ <file key>: <stored key> | 'livewire-file:<temporary id>' }`. A stored key from the browser is only accepted
 * if the record being edited already has it (or `preventFilePathTampering(allowFilePathUsing: …)` approves it), so nobody
 * can claim someone else's file.
 * Every setter also accepts a function of the field's context (`({ state, get, record, operation, livewire, component }) => value`).
 */
export class FileUpload extends Field {
    /** Application-wide default storage. */
    static storage: FileStorage | null = null;
    private _multiple: FieldLazy<boolean> = false;
    private _maxFiles: FieldLazy<number | null> = null;
    private _minFiles: FieldLazy<number | null> = null;
    private _maxSize: FieldLazy<number | null> = null;
    private _reorderable: FieldLazy<boolean> = false;
    private _acceptedFileTypes: FieldLazy<string[] | null> = null;
    private _directory: FieldLazy<string | null> = null;
    private _storeFiles: FieldLazy<boolean> = true;
    private _moveFiles: FieldLazy<boolean> = false;
    private _fetchFileInformation: FieldLazy<boolean> = true;
    private _storage: FieldLazy<FileStorage | null> = null;
    private _visibility: FieldLazy<'public' | 'private' | null> = null;
    private _deleteUploadedFileUsing: ((args: ComponentContext & { file: string; storage: FileStorage | null }) => unknown) | null = null;
    private _getUploadedFileUsing: ((key: string, ctx: ComponentContext) => UploadedFileInfo | null | Promise<UploadedFileInfo | null>) | null = null;
    private _openableFileUrlUsing: FileUrlResolver | null = null;
    private _downloadableFileUrlUsing: FileUrlResolver | null = null;
    private _allowFilePathUsing: ((file: string, ctx: ComponentContext) => boolean | Promise<boolean>) | null = null;
    private _minSize: FieldLazy<number | null> = null;
    private _ui: Record<string, FieldLazy<unknown>> = {};
    private _avatar = false;
    private _imageEditor: FieldLazy<boolean> = false;
    private _circleCropper: FieldLazy<boolean> = false;
    private _editorAspectRatios: FieldLazy<(string | null)[]> = [];
    private _cropAspectRatio: FieldLazy<string | null> = null;
    private _imageAspectRatios: FieldLazy<string | string[] | null> = null;
    private _dimensions: FieldLazy<ImageDimensions | null> = null;
    private _deletable: FieldLazy<boolean> = true;
    private _preserveFilenames: FieldLazy<boolean> = false;
    private _autoOpenEditor: FieldLazy<boolean> = false;
    private _fileNameUsing: ((file: TemporaryUpload, ctx: ComponentContext) => string | Promise<string>) | null = null;
    private _fileNamesField: FieldLazy<string | null> = null;
    /** Resolved by `dehydrateState()` for `getExtraDehydratedState()`. */
    private _savedFileNamesField: string | null = null;
    private _savedMultiple = false;
    private _storedNames: Record<string, string> = {};
    private _alignment: FieldLazy<'start' | 'center' | 'end' | null> = null;
    private _placeholder: FieldLazy<string | null> = null;
    static make(name: string): FileUpload { return configured(new FileUpload(name)); }
    /** Minimum file size, in kilobytes. */
    minSize(kilobytes: FieldLazy<number | null>): this { this._minSize = kilobytes; return this; }
    /** Download button on each saved file. */
    downloadable(condition: FieldLazy<boolean> = true): this { this._ui.isDownloadable = condition; return this; }
    /** Button opening each saved file in a new tab. */
    openable(condition: FieldLazy<boolean> = true): this { this._ui.isOpenable = condition; return this; }
    /** URL of the "open" button of a saved file (`null`: the URL of the file). Only local or http(s) URLs are used. */
    getOpenableFileUrlUsing(callback: FileUrlResolver | null): this { this._openableFileUrlUsing = callback; return this; }
    /** URL of the download button of a saved file (`null`: the URL of the file). Only local or http(s) URLs are used. */
    getDownloadableFileUrlUsing(callback: FileUrlResolver | null): this { this._downloadableFileUrlUsing = callback; return this; }
    /** `false`: no preview of images. */
    previewable(condition: FieldLazy<boolean> = true): this { this._ui.isPreviewable = condition; return this; }
    /** `false`: files cannot be pasted from the clipboard. */
    pasteable(condition: FieldLazy<boolean> = true): this { this._ui.isPasteable = condition; return this; }
    /** New files are added after the existing ones (instead of before). */
    appendFiles(condition: FieldLazy<boolean> = true): this { this._ui.shouldAppendFiles = condition; return this; }
    /** `false`: saved files cannot be removed (the remove button is hidden, and removing is refused on the server). */
    deletable(condition: FieldLazy<boolean> = true): this { this._deletable = condition; return this; }
    /** `'grid'` (with `multiple()`), `'compact'`, `'integrated'` or `'circle'`. */
    panelLayout(layout: FieldLazy<'grid' | 'compact' | 'integrated' | 'circle' | string | null>): this { this._ui.panelLayout = layout; return this; }
    panelAspectRatio(ratio: FieldLazy<string | null>): this { this._ui.panelAspectRatio = ratio; return this; }
    itemPanelAspectRatio(ratio: FieldLazy<string | null>): this { this._ui.itemPanelAspectRatio = ratio; return this; }
    imagePreviewHeight(height: FieldLazy<string | null>): this { this._ui.imagePreviewHeight = height; return this; }
    loadingIndicatorPosition(position: FieldLazy<string | null>): this { this._ui.loadingIndicatorPosition = position; return this; }
    removeUploadedFileButtonPosition(position: FieldLazy<string | null>): this { this._ui.removeUploadedFileButtonPosition = position; return this; }
    uploadButtonPosition(position: FieldLazy<string | null>): this { this._ui.uploadButtonPosition = position; return this; }
    uploadProgressIndicatorPosition(position: FieldLazy<string | null>): this { this._ui.uploadProgressIndicatorPosition = position; return this; }
    /** Message shown while a file uploads. */
    uploadingMessage(message: FieldLazy<string | null>): this { this._ui.uploadingMessage = message; return this; }
    /** Number of files uploaded at the same time. */
    maxParallelUploads(count: FieldLazy<number | null>): this { this._ui.maxParallelUploads = count; return this; }
    /** Extension → MIME type map for files the browser cannot type (`{ zip: 'application/zip' }`). */
    mimeTypeMap(map: FieldLazy<Record<string, string>>): this { this._ui.mimeTypeMap = map; return this; }
    /** `false`: images keep their EXIF orientation. */
    orientImagesFromExif(condition: FieldLazy<boolean> = true): this { this._ui.shouldOrientImageFromExif = condition; return this; }
    alignment(alignment: FieldLazy<'start' | 'center' | 'end' | null>): this { this._alignment = alignment; return this; }
    /** Text of the drop area. */
    placeholder(text: FieldLazy<string | null>): this { this._placeholder = text; return this; }
    /** Round avatar: one image, cropped to a square and shown as a circle. */
    avatar(): this { this._avatar = true; this.image(); this._ui.panelLayout ??= 'compact circle'; this._ui.imagePreviewHeight ??= '250'; this._cropAspectRatio ??= '1:1'; this._ui.automaticallyResizeImagesHeight ??= '500'; this._ui.automaticallyResizeImagesWidth ??= '500'; this._ui.loadingIndicatorPosition ??= 'center bottom'; this._ui.removeUploadedFileButtonPosition ??= 'center bottom'; this._ui.uploadButtonPosition ??= 'center bottom'; this._ui.uploadProgressIndicatorPosition ??= 'center bottom'; this._alignment ??= 'center'; return this; }
    /** Image editor (crop, rotate, flip, zoom) opened from each image, powered by Cropper.js in the browser. */
    imageEditor(condition: FieldLazy<boolean> = true): this { this._imageEditor = condition; return this; }
    /** Aspect ratios offered by the image editor (`['16:9', '4:3', '1:1']`; `null` for a free crop). */
    imageEditorAspectRatioOptions(ratios: FieldLazy<(string | null)[]>): this { this._editorAspectRatios = ratios; return this; }
    imageEditorAspectRatios(ratios: FieldLazy<(string | null)[]>): this { return this.imageEditorAspectRatioOptions(ratios); }
    /** Cropper.js view mode (1, 2 or 3). */
    imageEditorMode(mode: FieldLazy<1 | 2 | 3>): this { this._ui.imageEditorMode = mode; return this; }
    imageEditorEmptyFillColor(color: FieldLazy<string | null>): this { this._ui.imageEditorEmptyFillColor = color; return this; }
    imageEditorViewportWidth(width: FieldLazy<string | number | null>): this { this._ui.imageEditorViewportWidth = mapLazy(width, (value) => (value === null ? null : String(value))); return this; }
    imageEditorViewportHeight(height: FieldLazy<string | number | null>): this { this._ui.imageEditorViewportHeight = mapLazy(height, (value) => (value === null ? null : String(value))); return this; }
    /**
     * Opens a crop-only editor when an uploaded image does not have the ratio of `imageAspectRatio()` (a single ratio,
     * without `multiple()`). With `imageEditor()`, the full editor opens instead.
     */
    automaticallyOpenImageEditorForAspectRatio(condition: FieldLazy<boolean> = true): this { this._autoOpenEditor = condition; return this; }
    /** Circle crop in the image editor (avatars). */
    circleCropper(condition: FieldLazy<boolean> = true): this { this._circleCropper = condition; return this; }
    /** Crops images to this ratio in the browser before upload (`'16:9'`), without opening the editor. */
    automaticallyCropImagesToAspectRatio(ratio: FieldLazy<string | null>): this { this._cropAspectRatio = ratio; return this; }
    imageCropAspectRatio(ratio: FieldLazy<string | null>): this { return this.automaticallyCropImagesToAspectRatio(ratio); }
    /** Resizes images in the browser before upload (`'cover'`, `'contain'` or `'force'`). */
    automaticallyResizeImagesMode(mode: FieldLazy<'cover' | 'contain' | 'force' | null>): this { this._ui.automaticallyResizeImagesMode = mode; return this; }
    automaticallyResizeImagesToWidth(width: FieldLazy<string | number | null>): this { this._ui.automaticallyResizeImagesWidth = mapLazy(width, (value) => (value === null ? null : String(value))); return this; }
    automaticallyResizeImagesToHeight(height: FieldLazy<string | number | null>): this { this._ui.automaticallyResizeImagesHeight = mapLazy(height, (value) => (value === null ? null : String(value))); return this; }
    automaticallyUpscaleImagesWhenResizing(condition: FieldLazy<boolean> = true): this { this._ui.shouldAutomaticallyUpscaleImagesWhenResizing = condition; return this; }
    imageResizeMode(mode: FieldLazy<'cover' | 'contain' | 'force' | null>): this { return this.automaticallyResizeImagesMode(mode); }
    imageResizeTargetWidth(width: FieldLazy<string | number | null>): this { return this.automaticallyResizeImagesToWidth(width); }
    imageResizeTargetHeight(height: FieldLazy<string | number | null>): this { return this.automaticallyResizeImagesToHeight(height); }
    imageResizeUpscale(condition: FieldLazy<boolean> = true): this { return this.automaticallyUpscaleImagesWhenResizing(condition); }
    /** Accepted aspect ratio(s) of uploaded images (`'16:9'` or a list), checked on the server. */
    imageAspectRatio(ratio: FieldLazy<string | string[] | null>): this { this._imageAspectRatios = ratio; return this; }
    /** Width, height and ratio bounds of uploaded images (`{ minWidth: 800, maxHeight: 1080 }`), checked on the server. */
    imageDimensions(dimensions: FieldLazy<ImageDimensions | null>): this { this._dimensions = dimensions; return this; }
    /** Stores files under their original (sanitized) names. See the security notes in the docs. */
    preserveFilenames(condition: FieldLazy<boolean> = true): this { this._preserveFilenames = condition; return this; }
    /** Name of the stored file, from the temporary file; sanitized, and its extension is the detected one. */
    getUploadedFileNameForStorageUsing(callback: ((file: TemporaryUpload, ctx: ComponentContext) => string | Promise<string>) | null): this { this._fileNameUsing = callback; return this; }
    /** Saves the original file names (keyed by stored file) in another attribute of the record. */
    storeFileNamesIn(field: FieldLazy<string | null>): this { this._fileNamesField = field; return this; }
    /** Extra saved values, next to the field (the original file names of `storeFileNamesIn()`), once `dehydrateState()` ran. */
    getExtraDehydratedState(): Record<string, unknown> {
        if (this._savedFileNamesField === null) return {};
        return { [this._savedFileNamesField]: this._savedMultiple ? this._storedNames : (Object.values(this._storedNames)[0] ?? null) };
    }
    multiple(condition: FieldLazy<boolean> = true): this { this._multiple = condition; return this; }
    maxFiles(count: FieldLazy<number | null>): this { this._maxFiles = count; return this; }
    /** Minimum number of files (Laravel's `min` rule on the list: an empty field fails it too). */
    minFiles(count: FieldLazy<number | null>): this { this._minFiles = count; return this; }
    /** Maximum file size, in kilobytes. */
    maxSize(kilobytes: FieldLazy<number | null>): this { this._maxSize = kilobytes; return this; }
    reorderable(condition: FieldLazy<boolean> = true): this { this._reorderable = condition; return this; }
    /** Accepted MIME types (`image/jpeg`, `image/*`…), checked against the received file's content. */
    acceptedFileTypes(types: FieldLazy<string[] | null>): this { this._acceptedFileTypes = types; return this; }
    image(): this { return this.acceptedFileTypes(['image/*']); }
    directory(directory: FieldLazy<string | null>): this { this._directory = directory; return this; }
    storage(storage: FieldLazy<FileStorage | null>): this { this._storage = storage; return this; }
    /**
     * Visibility of the stored files: `'private'` files are shown through temporary URLs of the storage. By default, the storage's own visibility (`'public'` for a storage without one).
     */
    visibility(visibility: FieldLazy<'public' | 'private' | null>): this { this._visibility = visibility; return this; }
    async getVisibility(): Promise<'public' | 'private'> {
        const visibility = await this.value(this._visibility);
        if (visibility === 'public' || visibility === 'private') return visibility;
        return (await this.getStorage())?.visibility === 'private' ? 'private' : 'public';
    }
    /**
     * Called when the user removes a stored file from the field, with the file's key and the storage:
     * `({ file, storage }) => storage?.delete?.(file)`. Only files the record really holds reach it (never a path sent by the
     * browser), and only when the field is enabled and `deletable()`.
     */
    deleteUploadedFileUsing(callback: ((args: ComponentContext & { file: string; storage: FileStorage | null }) => unknown) | null): this { this._deleteUploadedFileUsing = callback; return this; }
    /** `false`: the field stores nothing itself; the data receives `FileUploadEntry` items for the adapter to process (media). */
    storeFiles(condition: FieldLazy<boolean> = true): this { this._storeFiles = condition; return this; }
    /** Moves temporary files into the storage instead of copying them (the storage receives `{ move: true }`). */
    moveFiles(condition: FieldLazy<boolean> = true): this { this._moveFiles = condition; return this; }
    /** `false`: saved files are listed without reading their size and type from the storage (only their URL). */
    fetchFileInformation(condition: FieldLazy<boolean> = true): this { this._fetchFileInformation = condition; return this; }
    /**
     * The stored keys sent back by the browser are always checked against the record; this method only adds
     * `allowFilePathUsing`, which approves other keys (a template file, for example). The check cannot be turned off.
     */
    preventFilePathTampering(condition: FieldLazy<boolean> = true, allowFilePathUsing: ((file: string, ctx: ComponentContext) => boolean | Promise<boolean>) | null = null): this {
        if (condition === false) throw new Error('FileUpload: the file path check cannot be turned off. Approve other keys with preventFilePathTampering(true, allowFilePathUsing).');
        this._allowFilePathUsing = allowFilePathUsing;
        return this;
    }
    /** Info about an already saved file (name, size, type, URL), when it does not come from the storage. */
    getUploadedFileUsing(resolver: (key: string, ctx: ComponentContext) => UploadedFileInfo | null | Promise<UploadedFileInfo | null>): this { this._getUploadedFileUsing = resolver; return this; }

    private value<T>(value: FieldLazy<T>): Promise<T> { return evaluate(value, this.context()); }
    private async ui<T>(key: string, fallback: T): Promise<T> { const value = await this.value(this._ui[key]); return (value === undefined ? fallback : value) as T; }
    isMultiple(): Promise<boolean> { return this.value(this._multiple).then(Boolean); }
    getMaxFiles(): Promise<number | null> { return this.value(this._maxFiles); }
    getMinFiles(): Promise<number | null> { return this.value(this._minFiles); }
    getMaxSize(): Promise<number | null> { return this.value(this._maxSize); }
    getMinSize(): Promise<number | null> { return this.value(this._minSize); }
    isReorderable(): Promise<boolean> { return this.value(this._reorderable).then(Boolean); }
    isDeletable(): Promise<boolean> { return this.value(this._deletable).then(Boolean); }
    isDownloadable(): Promise<boolean> { return this.ui('isDownloadable', false).then(Boolean); }
    isOpenable(): Promise<boolean> { return this.ui('isOpenable', false).then(Boolean); }
    getAcceptedFileTypes(): Promise<string[] | null> { return this.value(this._acceptedFileTypes); }
    getDirectory(): Promise<string | null> { return this.value(this._directory); }
    shouldStoreFiles(): Promise<boolean> { return this.value(this._storeFiles).then(Boolean); }
    shouldMoveFiles(): Promise<boolean> { return this.value(this._moveFiles).then(Boolean); }
    shouldFetchFileInformation(): Promise<boolean> { return this.value(this._fetchFileInformation).then(Boolean); }
    shouldPreserveFilenames(): Promise<boolean> { return this.value(this._preserveFilenames).then(Boolean); }
    async getImageAspectRatio(): Promise<string[] | null> { const ratio = await this.value(this._imageAspectRatios); return ratio === null || ratio === undefined ? null : [ratio].flat(); }
    async getStorage(): Promise<FileStorage | null> { return (await this.value(this._storage)) ?? FileUpload.storage; }
    /** Ratio for which the editor opens by itself (`automaticallyOpenImageEditorForAspectRatio()`), or `null`. */
    async getAutomaticallyOpenImageEditorForAspectRatio(): Promise<number | null> {
        if (!(await this.value(this._autoOpenEditor))) return null;
        if (await this.isMultiple()) throw new Error('The [automaticallyOpenImageEditorForAspectRatio()] method cannot be used when [multiple()] is enabled.');
        const ratios = await this.getImageAspectRatio();
        if (!ratios?.length) throw new Error('The [automaticallyOpenImageEditorForAspectRatio()] method requires [imageAspectRatio()] to be set with a single aspect ratio.');
        if (ratios.length > 1) throw new Error('The [automaticallyOpenImageEditorForAspectRatio()] method cannot be used when [imageAspectRatio()] has multiple allowed aspect ratios.');
        return ratioOf(ratios[0]);
    }
    /** With `automaticallyOpenImageEditorForAspectRatio()`, a (crop-only) editor exists even without `imageEditor()`. */
    async hasImageEditor(): Promise<boolean> { return (await this.getAutomaticallyOpenImageEditorForAspectRatio()) !== null || Boolean(await this.value(this._imageEditor)); }

    getDefaultState(): unknown { return {}; }
    hydrateState(value: unknown): unknown {
        const keys = Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : typeof value === 'object' ? Object.values(value as object) : [value];
        return Object.fromEntries(keys.filter((key) => typeof key === 'string' || typeof key === 'number').map((key) => [randomUUID(), String(key)]));
    }
    private get uploads(): { resolve(value: unknown): TemporaryUpload | null; remove(id: string): void } | null { return (this.livewire as any)._runtime?.uploads ?? null; }
    /** Sanitized state entries: safe file key, string value. */
    private entries(): [string, string][] {
        const state = this.context().state;
        if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
        return Object.entries(state as Record<string, unknown>).filter(([key, value]) => /^[A-Za-z0-9-]{1,64}$/.test(key) && typeof value === 'string').map(([key, value]): [string, string] => [key, value as string]).slice(0, 100);
    }
    /** Stored keys the current record already owns: the keys accepted back from the browser, with those of `allowFilePathUsing`. */
    private originalKeys(): Set<string> {
        const record = this.container.getRecord() as Record<string, unknown> | null;
        return new Set(Object.values(this.hydrateState(record?.[this.getName()]) as Record<string, string>));
    }
    /** A stored key sent by the browser may be used: the record holds it, or `allowFilePathUsing` approves it. */
    async isFilePathAuthorized(file: string, original: Set<string> = this.originalKeys()): Promise<boolean> {
        if (original.has(file)) return true;
        return this._allowFilePathUsing !== null && (await this._allowFilePathUsing(file, this.context())) === true;
    }
    private isTemporary(value: string): boolean { return value.startsWith('livewire-file:'); }
    /** Original names saved by `storeFileNamesIn()`, by stored key. */
    private async savedFileNames(): Promise<Record<string, string>> {
        const field = await this.value(this._fileNamesField);
        if (field === null || field === undefined) return {};
        const record = this.container.getRecord() as Record<string, unknown> | null;
        let names: unknown = record?.[field];
        if (typeof names === 'string') { try { names = JSON.parse(names); } catch { const key = [...this.originalKeys()][0]; return key ? { [key]: names as string } : {}; } }
        return names && typeof names === 'object' && !Array.isArray(names) ? Object.fromEntries(Object.entries(names as Record<string, unknown>).filter(([, name]) => typeof name === 'string')) as Record<string, string> : {};
    }

    getExposedMethods(): string[] { return ['deleteUploadedFile', 'removeUploadedFile', 'reorderUploadedFiles', 'getUploadedFiles']; }
    async getUploadedFiles(): Promise<Record<string, UploadedFileInfo | null>> {
        const ctx = this.context();
        const original = this.originalKeys();
        const savedNames = await this.savedFileNames();
        const storage = await this.getStorage();
        const shouldFetch = await this.shouldFetchFileInformation();
        const visibility = await this.getVisibility();
        const openable = (await this.isOpenable()) ? this._openableFileUrlUsing : null;
        const downloadable = (await this.isDownloadable()) ? this._downloadableFileUrlUsing : null;
        const files: Record<string, UploadedFileInfo | null> = {};
        for (const [fileKey, value] of this.entries()) {
            if (this.isTemporary(value) || !(await this.isFilePathAuthorized(value, original))) { files[fileKey] = null; continue; }
            let info: UploadedFileInfo | null;
            if (this._getUploadedFileUsing) info = await this._getUploadedFileUsing(value, ctx);
            else if (shouldFetch) info = (await storage?.info(value)) ?? null;
            else {
                // Without file information: only the URL; FilePond reads the file itself to preview it.
                const url = !storage ? null : storage.url ? await storage.url(value) : ((await storage.info(value))?.url ?? null);
                info = url === null ? null : { name: value.split('/').pop() ?? value, size: 0, type: null, url };
            }
            // Private files: a temporary URL of the storage, when it can make one.
            if (info && !this._getUploadedFileUsing && visibility === 'private' && storage?.temporaryUrl) {
                try { const temporary = await storage.temporaryUrl(value, temporaryFileUrlExpiry()); if (temporary) info = { ...info, url: temporary }; } catch { /* no temporary URLs */ }
            }
            // Only local or http(s) URLs are sent to the browser.
            const url = safeFileUrl(info?.url);
            if (!info || url === null) { files[fileKey] = null; continue; }
            info = { ...info, url };
            if (savedNames[value]) info.name = savedNames[value];
            const openableUrl = openable ? safeFileUrl(await openable(value, ctx)) : null;
            if (openableUrl !== null) info.openableUrl = openableUrl;
            const downloadableUrl = downloadable ? safeFileUrl(await downloadable(value, ctx)) : null;
            if (downloadableUrl !== null) info.downloadableUrl = downloadableUrl;
            files[fileKey] = info;
        }
        return files;
    }
    private writeState(entries: [string, string][]): void { writePath(this.livewire as any, this.getStatePath().split('.'), Object.fromEntries(entries)); }
    /**
     * Removes a file from the field, and returns the stored key it removed (`null` for a temporary file or nothing).
     * A stored file stays in the storage, unless `deleteUploadedFileUsing()` deletes it.
     */
    async removeUploadedFile(fileKey: unknown): Promise<string | null> {
        const removed = this.entries().find(([key]) => key === fileKey);
        if (!removed || (await this.isDisabled())) return null;
        // `deletable(false)`: a saved file stays (a file just uploaded can still be removed).
        if (!this.isTemporary(removed[1]) && !(await this.isDeletable())) return null;
        if (this.isTemporary(removed[1])) this.uploads?.remove(removed[1].slice('livewire-file:'.length));
        this.writeState(this.entries().filter(([key]) => key !== fileKey));
        return this.isTemporary(removed[1]) ? null : removed[1];
    }
    /** FilePond's "remove": removes the file, then runs `deleteUploadedFileUsing()` for a stored file the record holds. */
    async deleteUploadedFile(fileKey: unknown): Promise<void> {
        if (await this.isDisabled()) return;
        const original = this.originalKeys();
        const file = await this.removeUploadedFile(fileKey);
        // A key the browser made up (not one of the record's files) never reaches the callback.
        if (file === null || !this._deleteUploadedFileUsing || !(await this.isFilePathAuthorized(file, original))) return;
        await this._deleteUploadedFileUsing({ ...this.context(), file, storage: await this.getStorage() });
    }
    async reorderUploadedFiles(fileKeys: unknown): Promise<void> {
        if (!Array.isArray(fileKeys) || !(await this.isReorderable())) return;
        const entries = new Map(this.entries());
        const ordered = fileKeys.map(String).filter((key) => entries.has(key));
        this.writeState([...ordered.map((key): [string, string] => [key, entries.get(key)!]), ...[...entries].filter(([key]) => !ordered.includes(key))]);
    }

    async getValidationRules(): Promise<Rule[]> {
        const entries = () => this.entries();
        const temporary = () => entries().filter(([, value]) => this.isTemporary(value)).map(([, value]) => this.uploads?.resolve(value) ?? null);
        const [multiple, maxFiles, minFiles, acceptedFileTypes, maxSize, minSize, dimensions, aspectRatios] = await Promise.all([
            this.isMultiple(), this.getMaxFiles(), this.getMinFiles(), this.getAcceptedFileTypes(), this.getMaxSize(), this.getMinSize(), this.value(this._dimensions), this.getImageAspectRatio(),
        ]);
        const accepts = (type: string) => (acceptedFileTypes ?? []).some((accepted) => accepted === type || (accepted.endsWith('/*') && type.startsWith(accepted.slice(0, -1))));
        const rules: Rule[] = [];
        if (await this.isRequired()) rules.push({ name: 'required', passes: () => entries().length > 0, message: (a) => `The ${a} field is required.` });
        rules.push({ name: 'file', passes: () => temporary().every((file) => file !== null), message: (a) => `The ${a} field must be a file.` });
        // A stored key the record does not hold (and `allowFilePathUsing` does not approve) was forged.
        rules.push({
            name: 'tampered',
            passes: async () => { const original = this.originalKeys(); for (const [, value] of entries()) if (!this.isTemporary(value) && !(await this.isFilePathAuthorized(value, original))) return false; return true; },
            message: (a) => t('navette-forms::validation.tampered_file_path', { attribute: a }),
        });
        if (!multiple) rules.push({ name: 'max_files', passes: () => entries().length <= 1, message: (a) => `The ${a} field must not have more than 1 items.` });
        if (maxFiles !== null && maxFiles !== undefined) rules.push({ name: 'max_files', passes: () => entries().length <= maxFiles, message: (a) => `The ${a} field must not have more than ${maxFiles} items.` });
        if (minFiles !== null && minFiles !== undefined) rules.push({ name: 'min_files', passes: () => entries().length >= minFiles, message: (a) => `The ${a} field must have at least ${minFiles} items.` });
        if (acceptedFileTypes) rules.push({ name: 'mimetypes', passes: () => temporary().every((file) => file !== null && accepts(file.type)), message: (a) => `The ${a} field must be a file of type: ${acceptedFileTypes.join(', ')}.` });
        if (maxSize !== null && maxSize !== undefined) rules.push({ name: 'max', passes: () => temporary().every((file) => file !== null && file.size <= maxSize * 1024), message: (a) => `The ${a} field must not be greater than ${maxSize} kilobytes.` });
        if (minSize !== null && minSize !== undefined) rules.push({ name: 'min', passes: () => temporary().every((file) => file !== null && file.size >= minSize * 1024), message: (a) => `The ${a} field must be at least ${minSize} kilobytes.` });
        // Image rules only apply to new uploads, as in Laravel; a file whose size cannot be read fails them.
        if (dimensions) {
            const d = dimensions;
            const fits = (size: { width: number; height: number } | null) => size !== null
                && (d.width === undefined || size.width === d.width) && (d.height === undefined || size.height === d.height)
                && (d.minWidth === undefined || size.width >= d.minWidth) && (d.maxWidth === undefined || size.width <= d.maxWidth)
                && (d.minHeight === undefined || size.height >= d.minHeight) && (d.maxHeight === undefined || size.height <= d.maxHeight)
                && (d.ratio === undefined || Math.abs(size.width / size.height - d.ratio) < 0.01)
                && (d.minRatio === undefined || size.width / size.height >= d.minRatio - 1e-9) && (d.maxRatio === undefined || size.width / size.height <= d.maxRatio + 1e-9);
            rules.push({ name: 'dimensions', passes: () => temporary().every((file) => file !== null && fits(readImageSize(file.path))), message: (a) => `The ${a} field has invalid image dimensions.` });
        }
        if (aspectRatios) {
            const ratios = aspectRatios.map(ratioOf).filter((ratio): ratio is number => ratio !== null);
            rules.push({ name: 'dimensions', passes: () => temporary().every((file) => { const size = file && readImageSize(file.path); return !!size && size.height > 0 && ratios.some((ratio) => Math.abs(size.width / size.height - ratio) < 0.01); }), message: (a) => `The ${a} field has invalid image dimensions.` });
        }
        // Rules added with rule() / rules() come after the file checks.
        return [...rules, ...this._rules];
    }
    /** Validates the whole state, even when empty (a required field without files must fail). */
    async validate(): Promise<string[]> {
        if (!(await this.isDehydrated())) return [];
        const attribute = (await this.getLabel()).toLowerCase();
        for (const rule of await this.getValidationRules()) if (!(await rule.passes(this.context().state, this.context()))) { reportFailedRule(this.getStatePath(), rule.name); return [rule.message(attribute)]; }
        return [];
    }
    /** On save: temporary files are stored, unauthorized existing keys are dropped. */
    async dehydrateState(): Promise<unknown> {
        const original = this.originalKeys();
        const savedNames = await this.savedFileNames();
        const [storeFiles, multiple, deletable] = await Promise.all([this.shouldStoreFiles(), this.isMultiple(), this.isDeletable()]);
        this._savedFileNamesField = (await this.value(this._fileNamesField)) ?? null;
        this._savedMultiple = multiple;
        this._storedNames = {};
        const out: (string | FileUploadEntry)[] = [];
        for (const [, value] of this.entries()) {
            if (this.isTemporary(value)) {
                const file = this.uploads?.resolve(value);
                if (!file) continue;
                if (!storeFiles) { out.push({ file }); continue; }
                const storage = await this.getStorage();
                if (!storage) throw new Error('FileUpload: no storage configured (FileUpload.storage).');
                const name = this._fileNameUsing ? await this._fileNameUsing(file, this.context()) : (await this.shouldPreserveFilenames()) ? file.name : null;
                const stored = await storage.store(file, await this.getDirectory(), name, { move: await this.shouldMoveFiles(), visibility: await this.getVisibility() });
                this._storedNames[stored] = file.name;
                out.push(stored);
                this.uploads?.remove(file.id);
            } else if (await this.isFilePathAuthorized(value, original)) { out.push(storeFiles ? value : { key: value }); if (savedNames[value]) this._storedNames[value] = savedNames[value]; }
        }
        // `deletable(false)`: a saved file the browser dropped from the state is kept.
        if (!deletable) for (const key of original) if (!out.some((item) => item === key || (typeof item === 'object' && 'key' in item && item.key === key))) { out.push(storeFiles ? key : { key }); if (savedNames[key]) this._storedNames[key] = savedNames[key]; }
        return multiple ? out : (out[0] ?? null);
    }

    /** Image editor dialog (Cropper.js), rendered once per field. */
    private imageEditorHtml(options: { explicit: boolean; circleCropper: boolean; editorAspectRatios: (string | null)[]; cropAspectRatio: string | null }): string {
        const tr = (key: string, replace: Record<string, string> = {}) => t(`navette-forms::components.file_upload.editor.${key}`, replace);
        const explicit = options.explicit;
        const fields = [
            ['x_position', 'xPositionInput', 'editor.setData({...editor.getData(true), x: +$el.value})'], ['y_position', 'yPositionInput', 'editor.setData({...editor.getData(true), y: +$el.value})'],
            ['width', 'widthInput', 'editor.setData({...editor.getData(true), width: +$el.value})'], ['height', 'heightInput', 'editor.setData({...editor.getData(true), height: +$el.value})'],
            ['rotation', 'rotationInput', 'editor.rotateTo(+$el.value)'],
        ].map(([name, ref, save]) => `<label><div class="nv-input-wrp"><div class="nv-input-wrp-prefix nv-input-wrp-prefix-has-content nv-input-wrp-prefix-has-label"><span class="nv-input-wrp-label">${e(tr(`fields.${name}.label`))}</span></div><div class="nv-input-wrp-content-ctn"><input x-on:keyup.enter.prevent.stop="editor &amp;&amp; ${e(save)}" x-on:blur="editor &amp;&amp; ${e(save)}" x-ref="${ref}" x-on:keydown.enter.prevent type="text" class="nv-input" /></div><div class="nv-input-wrp-suffix nv-input-wrp-suffix-has-label"><span class="nv-input-wrp-label">${e(tr(`fields.${name}.unit`))}</span></div></div></label>`).join('');
        const groups = [
            [['drag_move', icons.resolve('forms::components.file-upload.editor.actions.drag-move') ?? 'nv-o-arrows-move', "editor.setDragMode('move')"], ['drag_crop', icons.resolve('forms::components.file-upload.editor.actions.drag-crop') ?? 'nv-o-crop', "editor.setDragMode('crop')"], ['zoom_in', icons.resolve('forms::components.file-upload.editor.actions.zoom-in') ?? 'o-magnifying-glass-plus', 'editor.zoom(0.1)'], ['zoom_out', icons.resolve('forms::components.file-upload.editor.actions.zoom-out') ?? 'o-magnifying-glass-minus', 'editor.zoom(-0.1)'], ['zoom_100', icons.resolve('forms::components.file-upload.editor.actions.zoom-100') ?? 'o-arrows-pointing-out', 'editor.zoomTo(1)']],
            [['move_left', icons.resolve('forms::components.file-upload.editor.actions.move-left') ?? 'o-arrow-left-circle', 'editor.move(-10, 0)'], ['move_right', icons.resolve('forms::components.file-upload.editor.actions.move-right') ?? 'o-arrow-right-circle', 'editor.move(10, 0)'], ['move_up', icons.resolve('forms::components.file-upload.editor.actions.move-up') ?? 'o-arrow-up-circle', 'editor.move(0, -10)'], ['move_down', icons.resolve('forms::components.file-upload.editor.actions.move-down') ?? 'o-arrow-down-circle', 'editor.move(0, 10)']],
            [['rotate_left', icons.resolve('forms::components.file-upload.editor.actions.rotate-left') ?? 'o-arrow-uturn-left', 'editor.rotate(-90)'], ['rotate_right', icons.resolve('forms::components.file-upload.editor.actions.rotate-right') ?? 'o-arrow-uturn-right', 'editor.rotate(90)'], ['flip_horizontal', icons.resolve('forms::components.file-upload.editor.actions.flip-horizontal') ?? 'nv-o-flip-horizontal', 'editor.scaleX(-editor.getData().scaleX || -1)'], ['flip_vertical', icons.resolve('forms::components.file-upload.editor.actions.flip-vertical') ?? 'nv-o-flip-vertical', 'editor.scaleY(-editor.getData().scaleY || -1)']],
        ].map((group) => `<div class="nv-btn-group">${group.map(([name, iconName, click]) => { const label = tr(`actions.${name}.label`); return `<button aria-label="${e(label)}" type="button" x-on:click.prevent.stop="${e(click)}" x-tooltip="${e(`{ content: ${js(label)}, theme: $store.theme }`)}" class="nv-btn">${icon(iconName)}</button>`; }).join('')}</div>`).join('');
        const ratioOptions = [...options.editorAspectRatios, ...(options.cropAspectRatio !== null ? [options.cropAspectRatio] : [])].filter((ratio, index, all) => all.indexOf(ratio) === index)
            .map((ratio): [string, number | 'NaN'] => [ratio === null ? tr('aspect_ratios.no_fixed.label') : ratio.replace('/', ':'), ratio === null ? 'NaN' : (ratioOf(ratio) ?? 'NaN')]);
        const ratios = ratioOptions.length >= 2 ? `<div class="nv-fo-file-upload-editor-control-panel-group"><div class="nv-fo-file-upload-editor-control-panel-group-title">${e(tr('aspect_ratios.label'))}</div>${Array.from({ length: Math.ceil(ratioOptions.length / 5) }, (_, chunk) => `<div class="nv-btn-group">${ratioOptions.slice(chunk * 5, chunk * 5 + 5).map(([label, ratio]) => `<button type="button" x-on:click.prevent.stop="${e(`currentRatio = ${js(label)}; editor.setAspectRatio(${ratio === 'NaN' ? 'NaN' : ratio})`)}" x-tooltip="${e(`{ content: ${js(tr('actions.set_aspect_ratio.label', { ratio: label }))}, theme: $store.theme }`)}" x-bind:class="${e(`{ 'nv-active': currentRatio === ${js(label)} }`)}" class="nv-btn">${e(label)}</button>`).join('')}</div>`).join('')}</div>` : '';
        const success = cls(['nv-btn', ...(colorManager?.getComponentClasses('button', 'success') ?? [])]);
        const cancel = `<button type="button" x-on:click.prevent="pond.imageEditEditor.oncancel" class="nv-btn">${e(tr('actions.cancel.label'))}</button>`;
        const save = `<button type="button" x-on:click.prevent="saveEditor" class="${success}">${e(tr('actions.save.label'))}</button>`;
        const main = explicit ? `<div class="nv-fo-file-upload-editor-control-panel-main"><div class="nv-fo-file-upload-editor-control-panel-group">${fields}</div><div class="nv-fo-file-upload-editor-control-panel-group">${groups}</div>${ratios}<div class="nv-fo-file-upload-editor-control-panel-reset-action-ctn"><button type="button" x-on:click.prevent.stop="editor.reset()" class="${cls(['nv-link', 'nv-size-sm', 'nv-fo-file-upload-editor-control-panel-reset-action', ...(colorManager?.getComponentClasses('link', 'danger') ?? [])])}"><span class="nv-link-label">${e(tr('actions.reset.label'))}</span></button></div></div>` : '';
        return `<div aria-label="${e(tr('label'))}" aria-modal="true" role="dialog" x-show="isEditorOpen" x-cloak x-on:click.stop="" x-trap.noscroll="isEditorOpen" x-on:keydown.escape.prevent.stop="closeEditor" class="${cls(['nv-fo-file-upload-editor', { 'nv-fo-file-upload-editor-circle-cropper': options.circleCropper, 'nv-fo-file-upload-editor-crop-only': !explicit }])}"><div aria-hidden="true" class="nv-fo-file-upload-editor-overlay"></div><div class="nv-fo-file-upload-editor-window"><div class="nv-fo-file-upload-editor-image-ctn"><img alt="" x-ref="editor" class="nv-fo-file-upload-editor-image" /></div><div class="nv-fo-file-upload-editor-control-panel">${main}<div class="nv-fo-file-upload-editor-control-panel-footer">${explicit ? cancel + save : save + cancel}</div></div></div></div>`;
    }

    async toHtml(): Promise<string> {
        const isDisabled = await this.isDisabled();
        const id = this.getId();
        const label = (await this.getLabel()).toLowerCase();
        const tr = (key: string) => t(`navette-forms::components.file_upload.${key}`);
        const ui: Record<string, unknown> = {};
        for (const key of Object.keys(this._ui)) ui[key] = await this.value(this._ui[key]);
        const option = (key: string, fallback: unknown) => (ui[key] === undefined ? fallback : ui[key]);
        const [multiple, maxFiles, maxSize, minSize, acceptedFileTypes, reorderable, deletable] = await Promise.all([this.isMultiple(), this.getMaxFiles(), this.getMaxSize(), this.getMinSize(), this.getAcceptedFileTypes(), this.isReorderable(), this.isDeletable()]);
        const explicitEditor = Boolean(await this.value(this._imageEditor));
        const circleCropper = Boolean(await this.value(this._circleCropper));
        const cropAspectRatio = (await this.value(this._cropAspectRatio)) ?? null;
        const autoOpenRatio = await this.getAutomaticallyOpenImageEditorForAspectRatio();
        const hasEditor = (explicitEditor || autoOpenRatio !== null || cropAspectRatio !== null || circleCropper) && !isDisabled;
        const alignment = (await this.value(this._alignment)) ?? 'start';
        const config = `fileUploadFormComponent({
 acceptedFileTypes: ${acceptedFileTypes ? js(acceptedFileTypes) : 'null'},
 automaticallyCropImagesAspectRatio: ${js(cropAspectRatio)},
 automaticallyOpenImageEditorForAspectRatio: ${js(autoOpenRatio)},
 automaticallyResizeImagesMode: ${js(option('automaticallyResizeImagesMode', null))},
 automaticallyResizeImagesHeight: ${js(option('automaticallyResizeImagesHeight', null))},
 automaticallyResizeImagesWidth: ${js(option('automaticallyResizeImagesWidth', null))},
 canEditSvgs: true,
 confirmSvgEditingMessage: ${js(tr('editor.svg.messages.confirmation'))},
 disabledSvgEditingMessage: ${js(tr('editor.svg.messages.disabled'))},
 hasCircleCropper: ${js(circleCropper)},
 hasImageEditor: ${js(hasEditor)},
 imageEditorEmptyFillColor: ${js(option('imageEditorEmptyFillColor', null))},
 imageEditorMode: ${js(option('imageEditorMode', 1))},
 imageEditorViewportHeight: ${js(option('imageEditorViewportHeight', null))},
 imageEditorViewportWidth: ${js(option('imageEditorViewportWidth', null))},
 imagePreviewHeight: ${js(option('imagePreviewHeight', null))},
 isAvatar: ${js(this._avatar)},
 isDeletable: ${js(deletable)},
 isDisabled: ${isDisabled ? 'true' : 'false'},
 isDownloadable: ${js(Boolean(option('isDownloadable', false)))},
 isImageEditorExplicitlyEnabled: ${js(explicitEditor)},
 isMultiple: ${multiple ? 'true' : 'false'},
 isOpenable: ${js(Boolean(option('isOpenable', false)))},
 isPasteable: ${js(Boolean(option('isPasteable', true)))},
 isPreviewable: ${js(Boolean(option('isPreviewable', true)))},
 isReorderable: ${reorderable ? 'true' : 'false'},
 isSvgEditingConfirmed: false,
 itemPanelAspectRatio: ${js(option('itemPanelAspectRatio', null))},
 loadingIndicatorPosition: ${js(option('loadingIndicatorPosition', 'right'))},
 locale: 'en',
 maxFiles: ${maxFiles ?? 'null'},
 maxFilesValidationMessage: ${maxFiles !== null && maxFiles !== undefined ? js(`The ${label} field must not have more than ${maxFiles} items.`) : 'null'},
 maxParallelUploads: ${js(option('maxParallelUploads', null))},
 maxSize: ${maxSize !== null && maxSize !== undefined ? js(`${maxSize}KB`) : 'null'},
 mimeTypeMap: ${option('mimeTypeMap', null) ? js(option('mimeTypeMap', null)) : '[]'},
 minSize: ${minSize !== null && minSize !== undefined ? js(`${minSize}KB`) : 'null'},
 panelAspectRatio: ${js(option('panelAspectRatio', null))},
 panelLayout: ${js(option('panelLayout', 'compact'))},
 placeholder: ${js((await this.value(this._placeholder)) ?? null)},
 removeUploadedFileButtonPosition: ${js(option('removeUploadedFileButtonPosition', 'left'))},
 shouldAppendFiles: ${js(Boolean(option('shouldAppendFiles', false)))},
 shouldAutomaticallyUpscaleImagesWhenResizing: ${js(Boolean(option('shouldAutomaticallyUpscaleImagesWhenResizing', true)))},
 shouldOrientImageFromExif: ${js(Boolean(option('shouldOrientImageFromExif', true)))},
 shouldTransformImage: ${js(Boolean(cropAspectRatio || option('automaticallyResizeImagesHeight', null) || option('automaticallyResizeImagesWidth', null)))},
 state: $wire.$entangle(${js(this.getStatePath())}, ${this.entangleLive() ? 'true' : 'false'}),
 statePath: ${js(this.getStatePath())},
 uploadButtonPosition: ${js(option('uploadButtonPosition', 'right'))},
 uploadingMessage: ${js(option('uploadingMessage', t('navette::components/button.messages.uploading_file')))},
 downloadActionLabel: ${js(tr('actions.download.label'))},
 openActionLabel: ${js(tr('actions.open.label'))},
 uploadProgressIndicatorPosition: ${js(option('uploadProgressIndicatorPosition', 'right'))},
 })`;
        const key = `${this.getLivewireKey()}.${createHash('md5').update(JSON.stringify([acceptedFileTypes, maxFiles, multiple, isDisabled, ui, explicitEditor, cropAspectRatio])).digest('hex')}`;
        const input = new Attributes(this.getExtraInputAttributes()).merge({ 'x-ref': 'input', 'aria-labelledby': `${id}-label`, disabled: isDisabled, multiple: multiple ? 'multiple' : null, type: 'file' });
        const editor = hasEditor ? this.imageEditorHtml({ explicit: explicitEditor, circleCropper, editorAspectRatios: (await this.value(this._editorAspectRatios)) ?? [], cropAspectRatio }) : '';
        return this.wrap(`<div hidden data-field-accessibility data-preserve-filepond-description></div><div x-load x-load-src="${e(asset('file-upload'))}"${this.extraAlpineHtml()} x-data="${e(config)}" wire:ignore wire:key="${e(key)}" aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" class="${cls(['nv-fo-file-upload', { 'nv-fo-file-upload-avatar': this._avatar }, `nv-align-${alignment}`])}"><div class="nv-fo-file-upload-input-ctn"><input ${input.toHtml()} /></div><div x-show="error" x-text="error" x-cloak role="alert" class="nv-fo-file-upload-error-message"></div>${editor}</div>`, { labelAsDiv: true });
    }
}

// Modal wizards of actions (`Action.steps()`): the wizard is not contained, the last step submits the action.
Action.stepsRenderer = (steps, submit, cancel) => Wizard.make(steps as Step[]).contained(false).submitAction(submit).cancelAction(cancel);
