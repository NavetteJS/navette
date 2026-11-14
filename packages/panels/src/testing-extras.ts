// More testing helpers of `@navette-js/panels/testing` (Filament's table column, filter, wizard and modal assertions, Livewire's
// `assertSeeLivewire()`), installed on `Testable`, plus the standalone `assertNotified()` / `assertNotNotified()`.
import { AssertionError, deepStrictEqual } from 'node:assert';
import { ActionGroup } from '@navette-js/actions';
import { Wizard } from '@navette-js/forms';
import { getTableRecords, getVisibleColumns, SelectColumn, TextColumn } from '@navette-js/tables';
import type { Component } from '@navette-js/wire';
import { listenToSentNotifications, type Notification, type NotificationData } from './notifications.ts';

const fail = (message: string): never => { throw new AssertionError({ message }); };
const show = (value: unknown) => { try { return JSON.stringify(value); } catch { return String(value); } };

/**
 * An object whose keys are exactly `'0'`, `'1'`… in order is a list (PHP array semantics): a repeater or builder state with
 * faked item keys (`Repeater.fake()`) equals the list written in a test. Applied to the actual value where a list is expected.
 */
export function normalizeListLikeState(actual: unknown, expected: unknown): unknown {
    if (Array.isArray(expected)) {
        let list: unknown[] | null = Array.isArray(actual) ? actual : null;
        if (!list && actual && typeof actual === 'object') {
            const keys = Object.keys(actual);
            if (keys.every((key, index) => key === String(index))) list = Object.values(actual);
        }
        return list ? list.map((item, index) => normalizeListLikeState(item, expected[index])) : actual;
    }
    if (expected && typeof expected === 'object' && actual && typeof actual === 'object' && !Array.isArray(actual)) {
        return Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, normalizeListLikeState(value, (expected as Record<string, unknown>)[key])]));
    }
    return actual;
}
const wireCopy = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const same = (actual: unknown, expected: unknown): boolean => { try { deepStrictEqual(normalizeListLikeState(wireCopy(actual), wireCopy(expected)), wireCopy(expected)); return true; } catch { return false; } };
const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' } as Record<string, string>)[c]);

// ------------------------------------------------------------------ standalone notification assertions (Filament's `Notification::assertNotified()`)
let sentNotifications: NotificationData[] = [];
listenToSentNotifications((notification) => { sentNotifications.push(notification); });
const titleOf = (expected: string | Notification) => (typeof expected === 'string' ? expected : expected.getData().title);
function matchingNotifications(expected: string | Notification | null): NotificationData[] {
    if (expected === null) return sentNotifications;
    if (typeof expected === 'string') return sentNotifications.filter((notification) => notification.title === expected);
    const { id: _id, ...wanted } = expected.getData();
    return sentNotifications.filter((notification) => { const { id: _other, ...sent } = notification; return same(sent, wanted); });
}
/**
 * A notification was sent since the last standalone assertion, anywhere in the process: in a component tested with
 * `livewire()`, a route, a job, or outside any request (where `send()` records it instead of failing in tests). With a title or
 * a `Notification`, that one was sent. Consumes the notifications sent so far.
 */
export function assertNotified(expected: string | Notification | null = null): void {
    const found = matchingNotifications(expected).length > 0;
    const sent = sentNotifications.map((notification) => notification.title);
    sentNotifications = [];
    if (!found) fail(expected === null ? 'A notification was expected but none were sent.' : `A notification was expected [${titleOf(expected)}] but not sent${sent.length ? ` (sent: ${sent.map((title) => `[${title}]`).join(', ')})` : ''}.`);
}
/** No notification was sent (or none with this title, or not this exact one) since the last standalone assertion. Consumes them. */
export function assertNotNotified(expected: string | Notification | null = null): void {
    const found = matchingNotifications(expected);
    sentNotifications = [];
    if (found.length) fail(expected === null ? `No notification was expected but at least one was sent ([${found[0].title}]).` : `The notification [${found[0].title}] was sent.`);
}
/** Forgets the notifications recorded for the standalone assertions (call it in `beforeEach()`). */
export function clearSentNotifications(): void { sentNotifications = []; }

// ------------------------------------------------------------------ Testable extras
type ActionName = string | { make(...args: any[]): { getName(): string } };
const actionNameOf = (name: ActionName): string => (typeof name === 'string' ? name : name.make().getName());
/** A component class (registered in the runtime) or its name. */
type ComponentReference = string | (abstract new (...args: any[]) => Component);

/** Methods added to `Testable` by this file (Filament's and Livewire's names). */
export interface TestableExtras {
    /** The column is visible and rendered in every row of the current page. */
    assertCanRenderTableColumn(name: string): this;
    /** The column exists but is not rendered in the rows (hidden, or toggled off). */
    assertCanNotRenderTableColumn(name: string): this;
    /** Text the column shows for a record (or its key), as `TextColumn.formatState()` gives it (a list for a list state). */
    assertTableColumnFormattedStateSet(name: string, state: unknown, record: unknown): this;
    assertTableColumnFormattedStateNotSet(name: string, state: unknown, record: unknown): this;
    /** Extra HTML attributes of the column for a record (`extraAttributes()`). */
    assertTableColumnHasExtraAttributes(name: string, attributes: Record<string, unknown>, record: unknown): this;
    assertTableColumnDoesNotHaveExtraAttributes(name: string, attributes: Record<string, unknown>, record: unknown): this;
    /** Options of a `SelectColumn` for a record: `{ value: label }` or `[value, label]` pairs. */
    assertTableSelectColumnHasOptions(name: string, options: Record<string, string> | [string, string][], record: unknown): this;
    assertTableSelectColumnDoesNotHaveOptions(name: string, options: Record<string, string> | [string, string][], record: unknown): this;
    /** The filter exists and is visible (not `hidden()` / `visible(false)`). */
    assertTableFilterVisible(name: string): this;
    assertTableFilterHidden(name: string): this;
    /** These row actions come in this order (other actions may come between them; groups are flattened). */
    assertTableRecordActionsExistInOrder(names: ActionName[]): this;
    /** v3 name of `assertTableRecordActionsExistInOrder()`. */
    assertTableActionsExistInOrder(names: ActionName[]): this;
    assertTableHeaderActionsExistInOrder(names: ActionName[]): this;
    assertTableEmptyStateActionsExistInOrder(names: ActionName[]): this;
    assertTableBulkActionsExistInOrder(names: ActionName[]): this;
    /** The wizard of the form (of the mounted action, if any) has this step (1-based). */
    assertWizardStepExists(step: number, schema?: string | null): this;
    /** The wizard is on this step (1-based), as the browser shows it. */
    assertWizardCurrentStep(step: number, schema?: string | null): this;
    /** "Next" from the step before `step`: validates that step, then shows `step` (1-based; 1 goes back to the first step). */
    goToWizardStep(step: number, schema?: string | null): this;
    /** "Next": validates the current step, then shows the next one. */
    goToNextWizardStep(schema?: string | null): this;
    /** "Back": shows the previous step. */
    goToPreviousWizardStep(schema?: string | null): this;
    /** The modal of the mounted action contains these raw HTML fragments. */
    assertMountedActionModalSeeHtml(values: string | string[]): this;
    assertMountedActionModalDontSeeHtml(values: string | string[]): this;
    /** The last render contains this child component (a widget, a relation manager…), by class or registered name. */
    assertSeeLivewire(component: ComponentReference): this;
    assertDontSeeLivewire(component: ComponentReference): this;
}

/** The members of `Testable` used here (private there). */
type Internals = {
    enqueue(step: () => unknown): any;
    ensureSucceeded(): void;
    inspect<T>(fn: (component: any) => T | Promise<T>): Promise<T>;
    request(updates: Record<string, unknown>, calls: { method: string; params: unknown[] }[]): Promise<void>;
    schemaNameFor(schema: string | null | undefined): string;
    schemaOrFail(component: any, name: string): Promise<any>;
    loadRecord(component: any, record: unknown): Promise<unknown>;
    recordKeyOf(record: unknown): string;
    mountedCount(): number;
    haystack(): string;
    instance(): any;
    getEffects(): { dispatches?: { name: string; params: any }[] };
    runtime: { nameOf(cls: any): string };
    snapshot: { memo: { id: string } } | null;
    className: string;
    /** Current step index of each wizard (by key): the browser keeps it, so the tester does too. */
    wizardSteps?: Map<string, number>;
};

/** Column of the table, or a failed assertion. */
async function columnOf(self: Internals, component: any, name: string): Promise<any> {
    const column = component.getTable().getColumn(name);
    if (!column) fail(`Failed asserting that a table column with name [${name}] exists on the [${self.className}] component.`);
    return column;
}
/** Records of the current table page, keyed by their key. */
async function pageRecordKeys(component: any): Promise<string[]> {
    const adapter = component.getDataAdapterForTable();
    return (await getTableRecords(component.getTable(), component, adapter)).records.map((record: unknown) => String(adapter.getKey(record)));
}
/** A record of the table, by key: it must be in the table's scope (Filament's `assertTableRecordKeyExists()`). */
async function tableRecord(self: Internals, component: any, record: unknown): Promise<unknown> {
    const found = await self.loadRecord(component, record);
    const adapter = component.getDataAdapterForTable();
    if (typeof adapter.keysInScope === 'function' && !(await adapter.keysInScope([String(adapter.getKey(found))])).length) fail(`Failed asserting that a table record with the key [${self.recordKeyOf(record)}] exists on the [${self.className}] component.`);
    return found;
}
const normalizeOptions = (options: Record<string, string> | [string, string][]): Record<string, string> => Object.fromEntries((Array.isArray(options) ? options : Object.entries(options)).map(([value, label]) => [String(value), String(label)]));
/** Extra attributes of a column for a record: `getExtraAttributes(record)` when the column has it. */
async function extraAttributesOf(column: any, record: unknown): Promise<Record<string, unknown>> {
    if (typeof column.getExtraAttributes === 'function') return (await column.getExtraAttributes(record)) ?? {};
    const raw = column._extraAttributes;
    const value = typeof raw === 'function' ? await raw({ record }) : raw;
    return value && typeof value === 'object' ? value : {};
}
/** Names of a list of actions, groups flattened (Filament's `assertActionListInOrder()`). */
function actionNames(actions: unknown[]): string[] {
    return actions.flatMap((action: any) => (action instanceof ActionGroup ? actionNames(action.getActions()) : typeof action?.getActions === 'function' && typeof action?.getName !== 'function' ? actionNames(action.getActions()) : [action.getName()]));
}
function assertInOrder(self: Internals, wanted: ActionName[], actions: unknown[], type: string): void {
    const names = wanted.map(actionNameOf);
    let index = 0;
    for (const name of actionNames(actions)) { if (index === names.length) break; if (names[index] === name) index++; }
    if (index !== names.length) fail(`Failed asserting that a ${type} actions with names [${names.join(', ')}] exist in order on the [${self.className}] component.`);
}

/** The first wizard of a schema. */
async function wizardOf(self: Internals, component: any, schemaName: string): Promise<{ wizard: any; steps: any[] }> {
    const schema = await self.schemaOrFail(component, schemaName);
    const wizard = (schema.getFlatComponents() as any[]).find((candidate) => candidate instanceof Wizard);
    if (!wizard) fail(`Failed asserting that a wizard exists on the schema with the name [${schemaName}] on the [${self.className}] component.`);
    const steps = wizard.getChildSchemas()[0].getComponents() as any[];
    return { wizard, steps };
}
function currentStepOf(self: Internals, wizard: any): number {
    const key = wizard.getKey();
    return (self.wizardSteps ??= new Map()).get(key) ?? Math.max(0, Number(wizard._startStep ?? 1) - 1);
}

const extras: { [K in keyof TestableExtras]: (this: Internals, ...args: any[]) => any } = {
    assertCanRenderTableColumn(name: string) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const html = this.haystack();
            await this.inspect(async (component) => {
                await columnOf(this, component, name);
                if (!getVisibleColumns(component.getTable(), component).some((column: any) => column.name === name)) fail(`Failed asserting that a table column with name [${name}] is visible on the [${this.className}] component.`);
                for (const key of await pageRecordKeys(component)) {
                    const needle = `wire:key="${escapeAttribute(`${this.snapshot!.memo.id}.table.record.${key}.column.${name}`)}"`;
                    if (!html.includes(needle)) fail(`Failed asserting that the table column [${name}] is rendered for the record [${key}] on the [${this.className}] component.`);
                }
            });
        });
    },
    assertCanNotRenderTableColumn(name: string) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const html = this.haystack();
            await this.inspect(async (component) => {
                await columnOf(this, component, name);
                for (const key of await pageRecordKeys(component)) {
                    const needle = `wire:key="${escapeAttribute(`${this.snapshot!.memo.id}.table.record.${key}.column.${name}`)}"`;
                    if (html.includes(needle)) fail(`Failed asserting that the table column [${name}] is not rendered for the record [${key}] on the [${this.className}] component.`);
                }
            });
        });
    },
    assertTableColumnFormattedStateSet(name: string, state: unknown, record: unknown) { return formattedState.call(this, name, state, record, true); },
    assertTableColumnFormattedStateNotSet(name: string, state: unknown, record: unknown) { return formattedState.call(this, name, state, record, false); },
    assertTableColumnHasExtraAttributes(name: string, attributes: Record<string, unknown>, record: unknown) { return extraAttributes.call(this, name, attributes, record, true); },
    assertTableColumnDoesNotHaveExtraAttributes(name: string, attributes: Record<string, unknown>, record: unknown) { return extraAttributes.call(this, name, attributes, record, false); },
    assertTableSelectColumnHasOptions(name: string, options: Record<string, string> | [string, string][], record: unknown) { return selectOptions.call(this, name, options, record, true); },
    assertTableSelectColumnDoesNotHaveOptions(name: string, options: Record<string, string> | [string, string][], record: unknown) { return selectOptions.call(this, name, options, record, false); },
    assertTableFilterVisible(name: string) { return filterVisibility.call(this, name, true); },
    assertTableFilterHidden(name: string) { return filterVisibility.call(this, name, false); },
    assertTableRecordActionsExistInOrder(names: ActionName[]) { return actionsInOrder.call(this, names, (table) => table.getRecordActions(), 'table'); },
    assertTableActionsExistInOrder(names: ActionName[]) { return actionsInOrder.call(this, names, (table) => table.getRecordActions(), 'table'); },
    assertTableHeaderActionsExistInOrder(names: ActionName[]) { return actionsInOrder.call(this, names, (table) => table.getHeaderActions(), 'table header'); },
    assertTableEmptyStateActionsExistInOrder(names: ActionName[]) { return actionsInOrder.call(this, names, (table) => table.getEmptyStateActions(), 'table empty state'); },
    assertTableBulkActionsExistInOrder(names: ActionName[]) { return actionsInOrder.call(this, names, (_table, component) => (typeof component.getBulkActions === 'function' ? component.getBulkActions() : (component.getTable().getBulkActions() ?? [])), 'table bulk'); },

    assertWizardStepExists(step: number, schema: string | null = null) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            await this.inspect(async (component) => {
                const { steps } = await wizardOf(this, component, this.schemaNameFor(schema));
                if (!steps[step - 1]) fail(`Wizard does not have a step [${step}].`);
            });
        });
    },
    assertWizardCurrentStep(step: number, schema: string | null = null) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            await this.inspect(async (component) => {
                const { wizard } = await wizardOf(this, component, this.schemaNameFor(schema));
                const current = currentStepOf(this, wizard) + 1;
                if (current !== step) fail(`Failed asserting that wizard is on step [${step}], current step is [${current}].`);
            });
        });
    },
    goToWizardStep(step: number, schema: string | null = null) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const { key, steps } = await this.inspect(async (component) => { const found = await wizardOf(this, component, this.schemaNameFor(schema)); return { key: found.wizard.getKey() as string, steps: found.steps.map((s: any) => s.getKey() as string) }; });
            if (!steps[step - 1]) fail(`Wizard does not have a step [${step}].`);
            // The first step is reached by going back, in the browser.
            if (step <= 1) { (this.wizardSteps ??= new Map()).set(key, 0); return; }
            await goNext.call(this, key, steps, step - 2);
        });
    },
    goToNextWizardStep(schema: string | null = null) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const { key, steps, current } = await this.inspect(async (component) => { const found = await wizardOf(this, component, this.schemaNameFor(schema)); return { key: found.wizard.getKey() as string, steps: found.steps.map((s: any) => s.getKey() as string), current: currentStepOf(this, found.wizard) }; });
            await goNext.call(this, key, steps, current);
        });
    },
    goToPreviousWizardStep(schema: string | null = null) {
        return this.enqueue(async () => {
            this.ensureSucceeded();
            const { key, current } = await this.inspect(async (component) => { const found = await wizardOf(this, component, this.schemaNameFor(schema)); return { key: found.wizard.getKey() as string, current: currentStepOf(this, found.wizard) }; });
            await this.request({}, [{ method: 'callSchemaComponentMethod', params: [key, 'previousStep', [current]] }]);
            if (current >= 1) (this.wizardSteps ??= new Map()).set(key, current - 1);
        });
    },

    assertMountedActionModalSeeHtml(values: string | string[]) { return modalHtml.call(this, values, true); },
    assertMountedActionModalDontSeeHtml(values: string | string[]) { return modalHtml.call(this, values, false); },
    assertSeeLivewire(component: ComponentReference) { return seeLivewire.call(this, component, true); },
    assertDontSeeLivewire(component: ComponentReference) { return seeLivewire.call(this, component, false); },
};

function formattedState(this: Internals, name: string, state: unknown, record: unknown, expected: boolean) {
    return this.enqueue(async () => {
        this.ensureSucceeded();
        await this.inspect(async (component) => {
            const column = await columnOf(this, component, name);
            const row = await tableRecord(this, component, record);
            const raw = await column.getState(row);
            const formatted = column instanceof TextColumn ? column.formatState(raw, row) : typeof column.formatState === 'function' ? column.formatState(raw, row) : raw;
            if (same(formatted, state) !== expected) fail(`Failed asserting that a table column with name [${name}] ${expected ? 'has' : 'does not have'} a formatted state of [${show(state)}] for record [${this.recordKeyOf(record)}] on the [${this.className}] component${expected ? `: it is [${show(formatted)}]` : ''}.`);
        });
    });
}
function extraAttributes(this: Internals, name: string, attributes: Record<string, unknown>, record: unknown, expected: boolean) {
    return this.enqueue(async () => {
        this.ensureSucceeded();
        await this.inspect(async (component) => {
            const column = await columnOf(this, component, name);
            const actual = await extraAttributesOf(column, await tableRecord(this, component, record));
            if (same(actual, attributes) !== expected) fail(`Failed asserting that a table column with name [${name}] ${expected ? 'has' : 'does not have'} extra attributes [${show(attributes)}] for record [${this.recordKeyOf(record)}] on the [${this.className}] component${expected ? `: they are [${show(actual)}]` : ''}.`);
        });
    });
}
function selectOptions(this: Internals, name: string, options: Record<string, string> | [string, string][], record: unknown, expected: boolean) {
    return this.enqueue(async () => {
        this.ensureSucceeded();
        await this.inspect(async (component) => {
            const column = await columnOf(this, component, name);
            if (!(column instanceof SelectColumn)) fail(`Failed asserting that the table column [${name}] is a select column on the [${this.className}] component.`);
            const actual = normalizeOptions(await (column as SelectColumn).getOptionsFor(await tableRecord(this, component, record)));
            if (same(actual, normalizeOptions(options)) !== expected) fail(`Failed asserting that a table column with name [${name}] ${expected ? 'has' : 'does not have'} options [${show(normalizeOptions(options))}] for record [${this.recordKeyOf(record)}] on the [${this.className}] component${expected ? `: they are [${show(actual)}]` : ''}.`);
        });
    });
}
function filterVisibility(this: Internals, name: string, visible: boolean) {
    return this.enqueue(async () => {
        this.ensureSucceeded();
        await this.inspect((component) => {
            const table = component.getTable();
            const filter = typeof table.getFilter === 'function' ? table.getFilter(name, true) : table.getFilters().find((candidate: any) => candidate.name === name);
            if (!filter) fail(`Failed asserting that a table filter with name [${name}] exists on the [${this.className}] component.`);
            if (!filter.isHidden?.() !== visible) fail(`Failed asserting that a table filter with name [${name}] is ${visible ? 'visible' : 'hidden'} on the [${this.className}] component.`);
        });
    });
}
function actionsInOrder(this: Internals, names: ActionName[], list: (table: any, component: any) => unknown[], type: string) {
    return this.enqueue(async () => {
        this.ensureSucceeded();
        await this.inspect((component) => assertInOrder(this, names, list(component.getTable(), component), type));
    });
}
/** "Next" from step `index`: the server validates it and announces the next step, which the browser then shows. */
async function goNext(this: Internals, key: string, steps: string[], index: number): Promise<void> {
    await this.request({}, [{ method: 'callSchemaComponentMethod', params: [key, 'nextStep', [index, steps[index] ?? null]] }]);
    const next = (this.getEffects().dispatches ?? []).find((dispatch) => dispatch.name === 'next-wizard-step' && dispatch.params?.key === key);
    if (next) (this.wizardSteps ??= new Map()).set(key, Math.max(0, steps.indexOf(String(next.params.step))));
}
function modalHtml(this: Internals, values: string | string[], see: boolean) {
    return this.enqueue(async () => {
        this.ensureSucceeded();
        if (!this.mountedCount()) fail(`Failed asserting that an action is mounted on the [${this.className}] component.`);
        const html = await this.inspect((component) => component.renderActionModals()) as string;
        for (const value of [values].flat()) if (html.includes(value) !== see) fail(`Failed asserting that the mounted action modal HTML ${see ? 'contains' : 'does not contain'} [${value}].`);
    });
}
function seeLivewire(this: Internals, component: ComponentReference, see: boolean) {
    return this.enqueue(() => {
        this.ensureSucceeded();
        const name = typeof component === 'string' ? component : this.runtime.nameOf(component);
        if (!name) fail(`The component [${(component as any).name}] is not registered in the runtime.`);
        const found = this.haystack().includes(`wire:name="${escapeAttribute(name)}"`);
        if (found !== see) fail(`Failed asserting that the [${this.className}] component ${see ? 'contains' : 'does not contain'} the Livewire component [${name}].`);
    });
}

/** Installs the extra methods on the tester class (called once by `testing.ts`). */
export function installTestingExtras(TestableClass: { prototype: object }): void {
    for (const [name, method] of Object.entries(extras)) Object.defineProperty(TestableClass.prototype, name, { value: method, writable: true, configurable: true });
}
