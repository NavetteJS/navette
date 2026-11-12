// Filtre « constructeur de requêtes » — port de Filament\Tables\Filters\QueryBuilder et de filament/query-builder.
// L'utilisateur compose des règles (contrainte + opérateur + réglages), éventuellement regroupées par des blocs « OR ».
// Tout l'état vient du navigateur : il est nettoyé contre les contraintes déclarées avant de servir (requête, indicateurs, rendu).
// Portés : TextConstraint, NumberConstraint, BooleanConstraint, DateConstraint (avec ou sans heure), SelectConstraint,
// RelationshipConstraint (nombre d'enregistrements liés, vide, `selectable(IsRelatedToOperator)`), contraintes sur une relation
// (`relationship(nom, attribut)`), opérateur « Is filled » (`nullable()`), bloc OR, indicateurs.
// Non portés : agrégats de relation (somme, moyenne… d'une colonne liée), groupes de contraintes, recherche serveur dans les listes.
// Le SQL de date et de recherche est écrit pour SQLite, MySQL / MariaDB, PostgreSQL et SQL Server, selon le client knex de la requête.
import { Action } from '@navette-js/actions';
import type { ListQuery } from '@navette-js/database';
import { DatePicker, DateTimePicker, Field, Select, TextInput } from '@navette-js/forms';
import { Block, Builder, colorsOf, iconActionButton, isItemKey, shortKey, writeState } from '@navette-js/forms/builder';
import { Component, Group, Schema } from '@navette-js/schemas';
import { Attributes, e, js, views, configured } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import { createHash } from 'node:crypto';
import type { FilterIndicator, FilterState, TableFilter, TableHost } from './index.ts';

const tr = (key: string, replace: Record<string, string | number> = {}) => t(`filament-query-builder::query-builder.${key}`, replace);
const headline = (s: string) => s.replace(/[_.-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const scalar = (value: unknown): string | number | boolean | null =>
    typeof value === 'string' ? value.slice(0, 1000) : typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;
/** Réglage reçu du navigateur : un scalaire, ou une liste de scalaires (sélection multiple), bornée. */
const setting = (value: unknown): unknown =>
    Array.isArray(value) ? value.slice(0, MAX_LIST_VALUES).map(scalar).filter((item): item is string | number => typeof item === 'string' || typeof item === 'number') : scalar(value);

/** Plafonds appliqués à l'arbre de règles reçu du navigateur. */
export const MAX_RULES = 100;
export const MAX_NESTING_DEPTH = 3;
/** Nombre maximal de valeurs d'une sélection multiple. */
export const MAX_LIST_VALUES = 100;
const OR = 'or';

// ------------------------------------------------------------------ conditions (forme neutre, appliquée ensuite à la requête)
type Comparison = '=' | '!=' | '<' | '<=' | '>' | '>=';
type Key = string | number;
export type Condition =
    | { kind: 'like'; column: string; pattern: string; negate: boolean }
    | { kind: 'compare'; column: string; operator: Comparison; value: string | number }
    | { kind: 'boolean'; column: string; value: boolean }
    | { kind: 'date' | 'month' | 'year'; column: string; operator: Comparison; value: string | number }
    /** Valeur renseignée (ni nulle, ni chaîne vide), ou l'inverse. */
    | { kind: 'filled'; column: string; negate: boolean }
    | { kind: 'in'; column: string; values: Key[]; negate: boolean }
    /** Nombre d'enregistrements liés comparé à une valeur. */
    | { kind: 'relationCount'; relationship: string; operator: Comparison; value: number; modify?: RelationshipQueryModifier }
    /** Au moins un enregistrement lié (parmi `keys` si la liste est donnée), ou aucun (`negate`). */
    | { kind: 'related'; relationship: string; keys: Key[] | null; negate: boolean; modify?: RelationshipQueryModifier };
/** `whereHas` : les conditions s'appliquent aux enregistrements liés par la relation. */
export type ConditionNode = Condition | { or: ConditionNode[][] } | { relationship: string; nodes: ConditionNode[]; modify?: RelationshipQueryModifier };
type Settings = Record<string, unknown>;
type Resolved = { condition: Condition; summary: string };

/** Opérateur d'une contrainte : son formulaire de réglages et sa traduction en condition. */
type Operator = {
    name: string;
    label: (inverse: boolean) => string;
    /** Réglages par défaut (null : l'opérateur n'a pas de formulaire). */
    defaults: () => Settings | null;
    fields: () => Component[];
    /** Null quand les réglages ne passent pas la validation du formulaire : la règle est alors sans effet, comme dans Filament. */
    resolve: (settings: Settings, inverse: boolean, constraint: Constraint) => Resolved | null;
    /** Condition posée sur la requête principale, même quand la contrainte vise une relation (opérateurs de RelationshipConstraint). */
    onBaseQuery?: boolean;
};
const label = (group: string, name: string) => (inverse: boolean) => tr(`operators.${group}.${name}.label.${inverse ? 'inverse' : 'direct'}`);
/** Liste de libellés à la manière de `Arr::join($labels, ', ', ' or ')`. */
const joinLabels = (labels: string[], glueKey: string) => (labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(tr(`${glueKey}.0`))}${tr(`${glueKey}.final`)}${labels[labels.length - 1]}`);
const summary = (group: string, name: string, inverse: boolean, replace: Record<string, string | number>) => tr(`operators.${group}.${name}.summary.${inverse ? 'inverse' : 'direct'}`, replace);
const likeEscape = (text: string) => text.replace(/[\\%_]/g, '\\$&');

function textOperator(name: string, key: string, pattern: (text: string) => string | null): Operator {
    return {
        name, label: label('text', key), defaults: () => ({ text: null }),
        fields: () => [TextInput.make('text').label(tr('operators.text.form.text.label')).required().columnSpanFull()],
        resolve: (settings, inverse, constraint) => {
            const text = typeof settings.text === 'string' ? settings.text : typeof settings.text === 'number' ? String(settings.text) : '';
            if (text === '') return null;
            const like = pattern(text);
            return {
                condition: like === null ? { kind: 'compare', column: constraint.getColumn(), operator: inverse ? '!=' : '=', value: text } : { kind: 'like', column: constraint.getColumn(), pattern: like, negate: inverse },
                summary: summary('text', key, inverse, { attribute: constraint.getAttributeLabel(), text }),
            };
        },
    };
}
function numberOperator(name: string, key: string, direct: Comparison, inverted: Comparison): Operator {
    return {
        name, label: label('number', key), defaults: () => ({ number: null, aggregate: null }),
        // `aggregate` ne sert qu'aux relations : le champ existe, masqué, comme dans Filament.
        fields: () => [TextInput.make('number').label(tr('operators.number.form.number.label')).numeric().required(), Select.make('aggregate').label(tr('operators.number.form.aggregate.label')).hidden()],
        resolve: (settings, inverse, constraint) => {
            const raw = settings.number;
            if (!(typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) || !Number.isFinite(Number(raw))) return null;
            const number = Number(raw);
            return { condition: { kind: 'compare', column: constraint.getColumn(), operator: inverse ? inverted : direct, value: number }, summary: summary('number', key, inverse, { attribute: constraint.getAttributeLabel(), number: new Intl.NumberFormat('en-US').format(number) }) };
        },
    };
}

// --- dates
const pad = (n: number) => String(n).padStart(2, '0');
const toDateString = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const toDateTimeString = (date: Date) => `${toDateString(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
/** Date `AAAA-MM-JJ` réelle, sinon null. */
function parseDate(value: unknown): string | null {
    const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
    if (!m) return null;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return toDateString(date) === `${m[1]}-${m[2]}-${m[3]}` ? toDateString(date) : null;
}
/** Date et heure `AAAA-MM-JJ HH:MM[:SS]` (ou avec `T`) réelles → `AAAA-MM-JJ HH:MM:SS` ; une date seule vaut minuit. */
function parseDateTime(value: unknown): string | null {
    const date = parseDate(value);
    if (date === null) return null;
    const time = /^.{10}(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(value));
    if (!time) return null;
    const [hours, minutes, seconds] = [time[1] ?? '00', time[2] ?? '00', time[3] ?? '00'];
    return Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60 ? `${date} ${hours}:${minutes}:${seconds}` : null;
}
const formatDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
/** Date et heure comme Carbon `toFormattedDayDateString() . ' ' . format('H:i:s')` : « Mon, Jun 1, 2026 14:30:00 ». */
const formatDayDateTime = (dateTime: string) => `${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${dateTime.slice(0, 10)}T00:00:00Z`))}, ${formatDate(dateTime)} ${dateTime.length > 10 ? dateTime.slice(11, 19) : '00:00:00'}`;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, i, 1))));
const UNITS = ['day', 'week', 'month', 'quarter', 'year'] as const;
const TIME_UNITS = ['second', 'minute', 'hour'] as const;
const shift = (now: Date, unit: string, amount: number): Date => {
    const date = new Date(now.getTime());
    if (unit === 'second') date.setUTCSeconds(date.getUTCSeconds() + amount);
    else if (unit === 'minute') date.setUTCMinutes(date.getUTCMinutes() + amount);
    else if (unit === 'hour') date.setUTCHours(date.getUTCHours() + amount);
    else if (unit === 'day') date.setUTCDate(date.getUTCDate() + amount);
    else if (unit === 'week') date.setUTCDate(date.getUTCDate() + 7 * amount);
    else if (unit === 'month') date.setUTCMonth(date.getUTCMonth() + amount);
    else if (unit === 'quarter') date.setUTCMonth(date.getUTCMonth() + 3 * amount);
    else if (unit === 'year') date.setUTCFullYear(date.getUTCFullYear() + amount);
    return date;
};
/** Préréglages de fenêtre glissante (port de resolveRelativeDate). */
const PRESETS: Record<string, (now: Date) => Date> = {
    past_decade: (n) => shift(n, 'year', -10), past_5_years: (n) => shift(n, 'year', -5), past_2_years: (n) => shift(n, 'year', -2), past_year: (n) => shift(n, 'year', -1),
    past_6_months: (n) => shift(n, 'month', -6), past_quarter: (n) => shift(n, 'quarter', -1), past_month: (n) => shift(n, 'month', -1), past_2_weeks: (n) => shift(n, 'week', -2), past_week: (n) => shift(n, 'week', -1),
    this_decade: (n) => new Date(Date.UTC(n.getUTCFullYear() - (n.getUTCFullYear() % 10), 0, 1)), this_year: (n) => new Date(Date.UTC(n.getUTCFullYear(), 0, 1)),
    this_quarter: (n) => new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - (n.getUTCMonth() % 3), 1)), this_month: (n) => new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)), today: (n) => n,
    next_week: (n) => shift(n, 'week', 1), next_2_weeks: (n) => shift(n, 'week', 2), next_month: (n) => shift(n, 'month', 1), next_quarter: (n) => shift(n, 'quarter', 1), next_6_months: (n) => shift(n, 'month', 6),
    next_year: (n) => shift(n, 'year', 1), next_2_years: (n) => shift(n, 'year', 2), next_5_years: (n) => shift(n, 'year', 5), next_decade: (n) => shift(n, 'year', 10),
};
/** Préréglages à la minute ou à l'heure, proposés seulement pour une contrainte `time()` : ils comparent la date et l'heure. */
const TIME_PRESETS: Record<string, (now: Date) => Date> = {
    past_hour: (n) => shift(n, 'hour', -1), past_minute: (n) => shift(n, 'minute', -1),
    this_hour: (n) => new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours())), this_minute: (n) => new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours(), n.getUTCMinutes())),
    next_minute: (n) => shift(n, 'minute', 1), next_hour: (n) => shift(n, 'hour', 1),
};
/** Ordre des préréglages dans la liste, comme Filament (les horaires s'intercalent seulement avec `time()`). */
const presetNames = (hasTime: boolean) => [
    'past_decade', 'past_5_years', 'past_2_years', 'past_year', 'past_6_months', 'past_quarter', 'past_month', 'past_2_weeks', 'past_week', ...(hasTime ? ['past_hour', 'past_minute'] : []),
    'this_decade', 'this_year', 'this_quarter', 'this_month', 'today', ...(hasTime ? ['this_hour', 'this_minute', 'next_minute', 'next_hour'] : []),
    'next_week', 'next_2_weeks', 'next_month', 'next_quarter', 'next_6_months', 'next_year', 'next_2_years', 'next_5_years', 'next_decade', 'custom',
];
/**
 * Moment visé par les réglages d'un opérateur « après / avant » : date fixe, préréglage, ou décalage personnalisé. `time` est vrai quand la
 * comparaison porte sur la date et l'heure (contrainte `time()` avec une date fixe, un préréglage horaire ou une unité de moins d'un jour).
 */
function resolveRuleMoment(settings: Settings, now: Date, hasTime: boolean): { value: string; time: boolean } | null {
    if (settings.mode !== 'relative') {
        const value = hasTime ? parseDateTime(settings.date) : parseDate(settings.date);
        return value === null ? null : { value, time: hasTime };
    }
    const preset = typeof settings.preset === 'string' ? settings.preset : 'custom';
    if (hasTime && Object.hasOwn(TIME_PRESETS, preset)) return { value: toDateTimeString(TIME_PRESETS[preset](now)), time: true };
    if (preset !== 'custom') return { value: toDateString((Object.hasOwn(PRESETS, preset) ? PRESETS[preset] : PRESETS.today)(now)), time: false };
    const value = Math.floor(Number(settings.relative_value));
    // Comme le formulaire de Filament : un entier d'au moins 1 (borné ici pour rester dans les dates représentables).
    if (!Number.isFinite(value) || value < 1 || value > 10000) return null;
    const units: readonly string[] = hasTime ? [...TIME_UNITS, ...UNITS] : UNITS;
    const unit = units.includes(String(settings.relative_unit)) ? String(settings.relative_unit) : 'day';
    const moment = shift(now, unit, settings.tense === 'future' ? value : -value);
    return (TIME_UNITS as readonly string[]).includes(unit) ? { value: toDateTimeString(moment), time: true } : { value: toDateString(moment), time: false };
}
/** Date (ou date et heure, avec `hasTime`) visée par les réglages d'un opérateur « après / avant ». */
export function resolveRuleDate(settings: Settings, now: Date = new Date(), hasTime = false): string | null { return resolveRuleMoment(settings, now, hasTime)?.value ?? null; }
function windowOperator(name: string, key: string, direct: Comparison, inverted: Comparison, hasTime: boolean): Operator {
    const option = (path: string, names: readonly string[]): [string, string][] => names.map((value) => [value, tr(`${path}.${value}`)]);
    return {
        name, label: label('date', key),
        defaults: () => ({ mode: 'absolute', date: null, preset: 'past_month', tense: 'past', relative_value: 1, relative_unit: 'day' }),
        fields: () => [
            Select.make('mode').label(tr('operators.date.form.mode.label')).live().options(option('operators.date.form.mode.options', ['absolute', 'relative'])).default('absolute'),
            (hasTime ? DateTimePicker.make('date') : DatePicker.make('date')).label(tr('operators.date.form.date.label')).hidden(({ get }) => get('mode') === 'relative').required(({ get }) => get('mode') !== 'relative'),
            Select.make('preset').label(tr('operators.date.form.preset.label')).live().options(option('operators.date.presets', presetNames(hasTime))).default('past_month')
                .hidden(({ get }) => get('mode') !== 'relative').required(({ get }) => get('mode') === 'relative'),
            // Dans Filament ces trois champs sont fusionnés (FusedGroup) ; ici ils sont côte à côte.
            Group.make([
                Select.make('tense').label(tr('operators.date.form.tense.label')).options(option('operators.date.form.tense.options', ['past', 'future'])).default('past').required(),
                TextInput.make('relative_value').label(tr('operators.date.form.relative_value.label')).numeric().minValue(1).default(1).required(),
                Select.make('relative_unit').label(tr('operators.date.form.relative_unit.label')).options(option('operators.date.unit_labels', hasTime ? [...TIME_UNITS, ...UNITS] : UNITS)).default('day').required(),
            ]).columns(3).columnSpanFull().hidden(({ get }) => get('mode') !== 'relative' || get('preset') !== 'custom'),
        ],
        resolve: (settings, inverse, constraint) => {
            const moment = resolveRuleMoment(settings, new Date(), hasTime);
            if (moment === null) return null;
            // Avec l'heure, la colonne est comparée telle quelle (`where`) ; sinon, sa seule date (`whereDate`), comme Filament.
            const condition: Condition = moment.time
                ? { kind: 'compare', column: constraint.getColumn(), operator: inverse ? inverted : direct, value: moment.value }
                : { kind: 'date', column: constraint.getColumn(), operator: inverse ? inverted : direct, value: moment.value };
            return { condition, summary: summary('date', key, inverse, { attribute: constraint.getAttributeLabel(), date: moment.time ? formatDayDateTime(moment.value) : formatDate(moment.value) }) };
        },
    };
}

/** Opérateur « Is filled » (port de IsFilledOperator), proposé par les contraintes `nullable()`. */
const isFilledOperator: Operator = {
    name: 'isFilled', label: (inverse) => tr(`operators.is_filled.label.${inverse ? 'inverse' : 'direct'}`), defaults: () => null, fields: () => [],
    resolve: (_settings, inverse, constraint) => ({ condition: { kind: 'filled', column: constraint.getColumn(), negate: inverse }, summary: tr(`operators.is_filled.summary.${inverse ? 'inverse' : 'direct'}`, { attribute: constraint.getAttributeLabel() }) }),
};

const OPERATORS: Record<'text' | 'number' | 'boolean' | 'date', Operator[]> = {
    text: [
        textOperator('contains', 'contains', (text) => `%${likeEscape(text)}%`), textOperator('startsWith', 'starts_with', (text) => `${likeEscape(text)}%`),
        textOperator('endsWith', 'ends_with', (text) => `%${likeEscape(text)}`), textOperator('equals', 'equals', () => null),
    ],
    number: [numberOperator('isMin', 'is_min', '>=', '<'), numberOperator('isMax', 'is_max', '<=', '>'), numberOperator('equals', 'equals', '=', '!=')],
    boolean: [{
        name: 'isTrue', label: label('boolean', 'is_true'), defaults: () => null, fields: () => [],
        resolve: (_settings, inverse, constraint) => ({ condition: { kind: 'boolean', column: constraint.getColumn(), value: !inverse }, summary: summary('boolean', 'is_true', inverse, { attribute: constraint.getAttributeLabel() }) }),
    }],
    date: [
        {
            name: 'isDate', label: label('date', 'is_date'), defaults: () => ({ date: null }),
            fields: () => [DatePicker.make('date').label(tr('operators.date.form.date.label')).required()],
            resolve: (settings, inverse, constraint) => {
                const date = parseDate(settings.date);
                return date === null ? null : { condition: { kind: 'date', column: constraint.getColumn(), operator: inverse ? '!=' : '=', value: date }, summary: summary('date', 'is_date', inverse, { attribute: constraint.getAttributeLabel(), date: formatDate(date) }) };
            },
        },
        {
            name: 'isMonth', label: label('date', 'is_month'), defaults: () => ({ month: null }),
            fields: () => [Select.make('month').label(tr('operators.date.form.month.label')).placeholder(t('filament-forms::components.select.placeholder')).options(MONTHS.map((name, i): [string, string] => [String(i + 1), name])).required()],
            resolve: (settings, inverse, constraint) => {
                const month = typeof settings.month === 'string' || typeof settings.month === 'number' ? Math.floor(Number(settings.month)) : NaN;
                return !(month >= 1 && month <= 12) ? null : { condition: { kind: 'month', column: constraint.getColumn(), operator: inverse ? '!=' : '=', value: month }, summary: summary('date', 'is_month', inverse, { attribute: constraint.getAttributeLabel(), month: MONTHS[month - 1] }) };
            },
        },
        {
            name: 'isYear', label: label('date', 'is_year'), defaults: () => ({ year: null }),
            fields: () => [TextInput.make('year').label(tr('operators.date.form.year.label')).integer().required()],
            resolve: (settings, inverse, constraint) => {
                const year = (typeof settings.year === 'string' && /^\d{1,4}$/.test(settings.year.trim())) || typeof settings.year === 'number' ? Number(settings.year) : NaN;
                return !(Number.isInteger(year) && year >= 1 && year <= 9999) ? null : { condition: { kind: 'year', column: constraint.getColumn(), operator: inverse ? '!=' : '=', value: year }, summary: summary('date', 'is_year', inverse, { attribute: constraint.getAttributeLabel(), year }) };
            },
        },
    ],
};

// ------------------------------------------------------------------ contraintes
type ConstraintType = keyof typeof OPERATORS | 'select' | 'relationship';
/** Modification de la requête des enregistrements liés (knex / objection), posée par l'application. */
export type RelationshipQueryModifier = (query: any) => void;

/**
 * Attribut filtrable par le constructeur de requêtes (port de Constraint). La colonne et la relation interrogées sont celles déclarées
 * ici, jamais des valeurs du navigateur : celui-ci ne choisit qu'une contrainte (par son nom) et un opérateur de sa liste.
 */
export class Constraint {
    readonly name: string;
    readonly type: ConstraintType;
    private _label: string | null = null;
    private _attributeLabel: string | null = null;
    private _icon: string;
    private _column: string | null = null;
    protected _relationship: string | null = null;
    protected _modifyRelationshipQuery: RelationshipQueryModifier | null = null;
    protected _nullable = false;
    /** Modèle Objection interrogé (enregistrements de la table), pour les listes d'enregistrements liés. */
    protected _model: any = null;
    constructor(name: string, type: ConstraintType, icon: string) {
        if (!isItemKey(name) || name === OR) throw new Error(`Nom de contrainte invalide : ${name}`);
        this.name = name; this.type = type; this._icon = icon;
    }
    label(label: string): this { this._label = label; return this; }
    /** Nom de l'attribut dans les résumés des règles (par défaut, le libellé). */
    attributeLabel(label: string | null): this { this._attributeLabel = label; return this; }
    icon(name: string): this { this._icon = name; return this; }
    /** Colonne (ou alias de la requête) interrogée quand elle diffère du nom. */
    attribute(column: string): this { this._column = column; return this; }
    /**
     * La contrainte porte sur un attribut d'enregistrements liés (`whereHas`) : `relationship('author', 'name')` filtre sur le nom de
     * l'auteur. La relation doit être déclarée par le modèle Objection (`relationMappings`).
     */
    relationship(name: string, titleAttribute: string, modifyQueryUsing: RelationshipQueryModifier | null = null): this {
        this._relationship = name; this._column = titleAttribute; this._modifyRelationshipQuery = modifyQueryUsing;
        return this;
    }
    modifyRelationshipQueryUsing(callback: RelationshipQueryModifier | null): this { this._modifyRelationshipQuery = callback; return this; }
    /** Ajoute l'opérateur « Is filled » / « Is blank » (port de `nullable()`). */
    nullable(condition = true): this { this._nullable = condition; return this; }
    isNullable(): boolean { return this._nullable; }
    model(model: any): this { this._model = model; return this; }
    getModel(): any { return this._model; }
    getLabel(): string { return this._label ?? headline(this.name); }
    getAttributeLabel(): string { return this._attributeLabel ?? this.getLabel(); }
    getIcon(): string { return this._icon; }
    getColumn(): string { return this._column ?? this.name; }
    /** Relation dont les enregistrements portent l'attribut, ou `null` pour une colonne de la table. */
    getRelationshipName(): string | null { return this._relationship; }
    getModifyRelationshipQueryUsing(): RelationshipQueryModifier | null { return this._modifyRelationshipQuery; }
    getOperators(): Operator[] { return [...OPERATORS[this.type as keyof typeof OPERATORS], ...(this._nullable ? [isFilledOperator] : [])]; }
    /** `contains` ou `contains.inverse` → opérateur et sens ; null si la contrainte ne le déclare pas. */
    parseOperator(value: unknown): { operator: Operator; inverse: boolean } | null {
        if (typeof value !== 'string') return null;
        const inverse = value.endsWith('.inverse');
        const operator = this.getOperators().find((candidate) => candidate.name === (inverse ? value.slice(0, -8) : value));
        return operator ? { operator, inverse } : null;
    }
    getOperatorOptions(): [string, string][] { return this.getOperators().flatMap((operator): [string, string][] => [[operator.name, operator.label(false)], [`${operator.name}.inverse`, operator.label(true)]]); }
    /** Noms de réglages connus de la contrainte, tous opérateurs confondus (un changement d'opérateur conserve les anciens, comme Filament). */
    getSettingNames(): string[] { return [...new Set(this.getOperators().flatMap((operator) => Object.keys(operator.defaults() ?? {})))]; }
    /** Réglages dont la valeur est une liste (sélection multiple). */
    getListSettingNames(): string[] { return [...new Set(this.getOperators().flatMap((operator) => Object.entries(operator.defaults() ?? {}).filter(([, value]) => Array.isArray(value)).map(([name]) => name)))]; }
    getDefaultData(): Record<string, unknown> { const [first] = this.getOperators(); return { operator: first.name, settings: first.defaults() }; }
}
export class TextConstraint extends Constraint { static make(name: string): TextConstraint { return configured(new TextConstraint(name, 'text', 'm-language')); } }
export class NumberConstraint extends Constraint { static make(name: string): NumberConstraint { return configured(new NumberConstraint(name, 'number', 'm-variable')); } }
export class BooleanConstraint extends Constraint { static make(name: string): BooleanConstraint { return configured(new BooleanConstraint(name, 'boolean', 'm-check-circle')); } }
/** Date ; avec `time()`, la date et l'heure (sélecteur date-heure, préréglages et unités à la minute ou à l'heure). */
export class DateConstraint extends Constraint {
    private _time = false;
    static make(name: string): DateConstraint { return configured(new DateConstraint(name, 'date', 'm-calendar')); }
    time(condition = true): this { this._time = condition; return this; }
    hasTime(): boolean { return this._time; }
    getOperators(): Operator[] {
        return [windowOperator('isAfter', 'is_after', '>=', '<', this._time), windowOperator('isBefore', 'is_before', '<=', '>', this._time), ...super.getOperators()];
    }
}

/** Valeur choisie dans une liste fixe (port de SelectConstraint) ; `multiple()` : l'une des valeurs choisies. */
export class SelectConstraint extends Constraint {
    private _options: [string, string][] = [];
    private _multiple = false;
    private _searchable = false;
    static make(name: string): SelectConstraint { return configured(new SelectConstraint(name, 'select', 'm-chevron-up-down')); }
    /** Options `[valeur, libellé]` ou `{ valeur: libellé }` ; seules ces valeurs filtrent. */
    options(options: [string | number, string][] | Record<string, string>): this {
        this._options = (Array.isArray(options) ? options : Object.entries(options)).map(([value, label]): [string, string] => [String(value), String(label)]);
        return this;
    }
    getOptions(): [string, string][] { return this._options; }
    multiple(condition = true): this { this._multiple = condition; return this; }
    isMultiple(): boolean { return this._multiple; }
    searchable(condition = true): this { this._searchable = condition; return this; }
    getOperators(): Operator[] {
        const field = this._multiple ? 'values' : 'value';
        const known = (value: unknown) => (typeof value === 'string' || typeof value === 'number') && this._options.some(([option]) => option === String(value));
        const is: Operator = {
            name: 'is', label: label('select', 'is'), defaults: () => ({ [field]: this._multiple ? [] : null }),
            fields: () => [Select.make(field).label(tr(`operators.select.is.form.${field}.label`)).options(this._options).multiple(this._multiple).searchable(this._searchable).required().columnSpanFull()],
            resolve: (settings, inverse, constraint) => {
                const raw = settings[field];
                // Valeurs forgées ou inconnues écartées : il ne reste que des options déclarées (sinon la règle est sans effet).
                const values = (Array.isArray(raw) ? raw : this._multiple ? [] : [raw]).filter(known).map(String);
                if (!values.length) return null;
                const labels = this._options.filter(([option]) => values.includes(option)).map(([, optionLabel]) => optionLabel);
                const condition: Condition = this._multiple
                    ? { kind: 'in', column: constraint.getColumn(), values: [...new Set(values)], negate: inverse }
                    : { kind: 'compare', column: constraint.getColumn(), operator: inverse ? '!=' : '=', value: values[0] };
                return { condition, summary: summary('select', 'is', inverse, { attribute: constraint.getAttributeLabel(), values: joinLabels(labels, 'operators.select.is.summary.values_glue') }) };
            },
        };
        return [is, ...(this._nullable ? [isFilledOperator] : [])];
    }
}

/** Nombre entier d'enregistrements liés, d'au moins 1 (formulaire `count` des opérateurs de RelationshipConstraint). */
const countSetting = (value: unknown): number | null => (isNumericValue(value) && Number(value) >= 1 && Number(value) <= 1e9 ? Math.floor(Number(value)) : null);
const isNumericValue = (value: unknown) => typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
function relationshipCountOperator(name: string, key: string, direct: Comparison, inverted: Comparison): Operator {
    return {
        name, label: label('relationship', key), defaults: () => ({ count: null }), onBaseQuery: true,
        fields: () => [TextInput.make('count').label(tr('operators.relationship.form.count.label')).numeric().required().minValue(1)],
        resolve: (settings, inverse, constraint) => {
            const count = countSetting(settings.count);
            const relationship = (constraint as RelationshipConstraint).getRelationshipName();
            const modify = constraint.getModifyRelationshipQueryUsing();
            return count === null ? null : { condition: { kind: 'relationCount', relationship, operator: inverse ? inverted : direct, value: count, ...(modify ? { modify } : {}) }, summary: summary('relationship', key, inverse, { relationship: constraint.getAttributeLabel(), count }) };
        },
    };
}

/**
 * Opérateur « Is » / « Contains » d'une RelationshipConstraint (port de IsRelatedToOperator) : les enregistrements liés sont choisis dans
 * une liste tirée du modèle lié, par leur clé ; `titleAttribute` est la colonne affichée.
 */
export class IsRelatedToOperator {
    private _titleAttribute: string | null = null;
    private _multiple = false;
    private _searchable = false;
    private _preload = false;
    private _optionsLimit = 50;
    private _modifyQuery: RelationshipQueryModifier | null = null;
    static make(): IsRelatedToOperator { return configured(new IsRelatedToOperator()); }
    titleAttribute(attribute: string | null): this { this._titleAttribute = attribute; return this; }
    getTitleAttribute(): string | null { return this._titleAttribute; }
    multiple(condition = true): this { this._multiple = condition; return this; }
    isMultiple(): boolean { return this._multiple; }
    searchable(condition = true): this { this._searchable = condition; return this; }
    preload(condition = true): this { this._preload = condition; return this; }
    optionsLimit(limit: number): this { this._optionsLimit = Math.max(1, Math.floor(limit)); return this; }
    modifyRelationshipQueryUsing(callback: RelationshipQueryModifier | null): this { this._modifyQuery = callback; return this; }
    getModifyRelationshipQueryUsing(): RelationshipQueryModifier | null { return this._modifyQuery; }
    /** Opérateur du constructeur pour la contrainte donnée. */
    toOperator(constraint: RelationshipConstraint): Operator {
        const field = constraint.isMultiple() ? 'values' : 'value';
        const variant = constraint.isMultiple() ? 'multiple' : 'single';
        const keys = (raw: unknown): Key[] => (Array.isArray(raw) ? raw : [raw]).filter((value): value is Key => typeof value === 'string' || typeof value === 'number').slice(0, MAX_LIST_VALUES);
        return {
            name: 'isRelatedTo', label: (inverse) => tr(`operators.relationship.is_related_to.label.${variant}.${inverse ? 'inverse' : 'direct'}`), defaults: () => ({ [field]: this._multiple ? [] : null }), onBaseQuery: true,
            fields: () => [Select.make(field).label(tr(`operators.relationship.is_related_to.form.${field}.label`)).multiple(this._multiple).searchable(this._searchable)
                .options(async (ctx: any) => constraint.loadRelatedOptions(this, ctx?.livewire)).required().columnSpanFull()],
            resolve: (settings, inverse, c) => {
                const selected = keys(settings[field]);
                if (!selected.length) return null;
                const labels = selected.map((key) => constraint.getRelatedLabel(key) ?? String(key));
                const relationship = (c as RelationshipConstraint).getRelationshipName();
                const modify = this._modifyQuery;
                return {
                    condition: { kind: 'related', relationship, keys: [...new Set(selected)], negate: inverse, ...(modify ? { modify } : {}) },
                    summary: tr(`operators.relationship.is_related_to.summary.${variant}.${inverse ? 'inverse' : 'direct'}`, { relationship: c.getAttributeLabel(), values: joinLabels(labels, 'operators.relationship.is_related_to.summary.values_glue') }),
                };
            },
        };
    }
    getOptionsLimit(): number { return this._optionsLimit; }
}

/**
 * Enregistrements liés (port de RelationshipConstraint) : nombre minimal, maximal ou exact (`multiple()`), relation vide (`emptyable()`,
 * par défaut avec `multiple()`), ou liés à des enregistrements choisis (`selectable(IsRelatedToOperator.make()…)`).
 */
export class RelationshipConstraint extends Constraint {
    private _multiple = false;
    private _emptyable: boolean | null = null;
    private _selectable: IsRelatedToOperator | null = null;
    /** Libellés des enregistrements liés cités par les règles, chargés avant le calcul des indicateurs. */
    private _relatedLabels = new Map<string, string>();
    static make(name: string): RelationshipConstraint { return configured(new RelationshipConstraint(name, 'relationship', 'm-arrows-pointing-out')); }
    multiple(condition = true): this { this._multiple = condition; return this; }
    isMultiple(): boolean { return this._multiple; }
    emptyable(condition: boolean | null = true): this { this._emptyable = condition; return this; }
    canBeEmpty(): boolean { return this._emptyable ?? this._multiple; }
    selectable(operator: IsRelatedToOperator): this { this._selectable = operator; return this; }
    getSelectableOperator(): IsRelatedToOperator | null { return this._selectable; }
    /** Relation interrogée : celle de `relationship()`, sinon `attribute()`, sinon le nom de la contrainte. */
    getRelationshipName(): string { return this._relationship ?? this.getColumn(); }
    getOperators(): Operator[] {
        return [
            ...(this._selectable ? [this._selectable.toOperator(this)] : []),
            ...(this._multiple ? [relationshipCountOperator('hasMin', 'has_min', '>=', '<'), relationshipCountOperator('hasMax', 'has_max', '<=', '>'), relationshipCountOperator('equals', 'equals', '=', '!=')] : []),
            ...(this.canBeEmpty() ? [{
                name: 'isEmpty', label: label('relationship', 'is_empty'), defaults: () => null, fields: () => [], onBaseQuery: true,
                resolve: (_settings: Settings, inverse: boolean): Resolved => {
                    const modify = this.getModifyRelationshipQueryUsing();
                    return { condition: { kind: 'related', relationship: this.getRelationshipName(), keys: null, negate: !inverse, ...(modify ? { modify } : {}) }, summary: summary('relationship', 'is_empty', inverse, { relationship: this.getAttributeLabel() }) };
                },
            } satisfies Operator] : []),
        ];
    }
    getRelatedLabel(key: Key): string | null { return this._relatedLabels.get(String(key)) ?? null; }
    /** Modèle lié, retrouvé par la relation du modèle de la table (déclaré, ou celui de l'adaptateur Objection de l'hôte). */
    private relatedModel(host: unknown): any {
        const model = this._model ?? modelOfHost(host);
        if (!model?.getRelation) throw new Error(`RelationshipConstraint ${this.name} : modèle de la table introuvable ; déclarez-le avec model() sur la contrainte ou le QueryBuilder.`);
        return model.getRelation(this.getRelationshipName()).relatedModelClass;
    }
    private relatedQuery(operator: IsRelatedToOperator, host: unknown): { query: any; id: string; title: string } {
        const related = this.relatedModel(host);
        const title = operator.getTitleAttribute() ?? String(related.idColumn);
        const query = related.query();
        operator.getModifyRelationshipQueryUsing()?.(query);
        return { query, id: `${related.tableName}.${related.idColumn}`, title: `${related.tableName}.${title}` };
    }
    /** Options de la liste : enregistrements du modèle lié, triés par leur titre. */
    async loadRelatedOptions(operator: IsRelatedToOperator, host: unknown): Promise<[string, string][]> {
        const { query, id, title } = this.relatedQuery(operator, host);
        // Comme une liste non cherchable de Filament : toutes les options, ici plafonnées.
        const rows = await query.clearSelect().select({ __key: id, __title: title }).orderBy(title).limit(1000);
        return rows.map((row: any): [string, string] => [String(row.__key), String(row.__title ?? row.__key)]);
    }
    /** Charge les libellés des clés citées par des règles (indicateurs « Author is Ada or Linus »). */
    async loadRelatedLabels(keys: Key[], host: unknown): Promise<void> {
        if (!this._selectable || !keys.length) return;
        const { query, id, title } = this.relatedQuery(this._selectable, host);
        const rows = await query.clearSelect().select({ __key: id, __title: title }).whereIn(id, keys.slice(0, MAX_LIST_VALUES));
        for (const row of rows) this._relatedLabels.set(String(row.__key), String(row.__title ?? row.__key));
    }
}

/** Modèle Objection de la table de l'hôte (adaptateur `ObjectionAdapter`), quand l'application ne l'a pas déclaré. */
function modelOfHost(host: unknown): any {
    const adapter = (host as any)?.getDataAdapterForTable?.() ?? (host as any)?.resource?.adapter ?? null;
    const model = adapter?.model;
    return typeof model === 'function' && typeof model.getRelation === 'function' ? model : null;
}

// ------------------------------------------------------------------ état : nettoyage et traduction
type Rule = { type: string; data: Record<string, any> };
type Rules = Record<string, Rule>;
const isObject = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Arbre de règles reçu du navigateur → arbre ne contenant que ce que le filtre déclare : types de blocs connus, opérateurs de la contrainte,
 * réglages scalaires aux noms connus, profondeur et nombre de règles bornés. Un opérateur inconnu est remis à vide (règle sans effet).
 */
export function sanitizeRules(constraints: Constraint[], raw: unknown, depth = 1, budget = { rules: MAX_RULES }): Rules {
    const rules: Rules = {};
    if (!isObject(raw)) return rules;
    for (const [key, rule] of Object.entries(raw)) {
        if (budget.rules <= 0) break;
        if (!isItemKey(key) || !isObject(rule) || typeof rule.type !== 'string') continue;
        const data = isObject(rule.data) ? rule.data : {};
        if (rule.type === OR) {
            if (depth >= MAX_NESTING_DEPTH) continue;
            const groups: Record<string, { rules: Rules }> = {};
            for (const [groupKey, group] of Object.entries(isObject(data.groups) ? data.groups : {}).slice(0, 20)) {
                if (isItemKey(groupKey)) groups[groupKey] = { rules: sanitizeRules(constraints, isObject(group) ? group.rules : null, depth + 1, budget) };
            }
            rules[key] = { type: OR, data: { groups } };
            continue;
        }
        const constraint = constraints.find((candidate) => candidate.name === rule.type);
        if (!constraint) continue;
        budget.rules--;
        // Une liste n'est acceptée que pour un réglage qui en est une par défaut (sélection multiple) ; ailleurs, seulement un scalaire.
        const lists = constraint.getListSettingNames();
        const settings = isObject(data.settings) ? Object.fromEntries(constraint.getSettingNames().filter((name) => Object.hasOwn(data.settings, name)).map((name) => [name, lists.includes(name) ? setting(data.settings[name]) : scalar(data.settings[name])])) : null;
        rules[key] = { type: constraint.name, data: { operator: constraint.parseOperator(data.operator) ? data.operator : null, settings } };
    }
    return rules;
}

/** Règles nettoyées → conditions et libellés d'indicateurs (une entrée par règle de premier niveau qui a un effet). */
export function compileRules(constraints: Constraint[], rules: Rules, iteration = 1): { nodes: ConditionNode[]; summaries: Record<string, string> } {
    const nodes: ConditionNode[] = [];
    const summaries: Record<string, string> = {};
    for (const [key, rule] of Object.entries(rules)) {
        if (rule.type === OR) {
            const groups = Object.values((rule.data.groups ?? {}) as Record<string, { rules: Rules }>).map((group) => compileRules(constraints, group.rules, iteration + 1));
            // Un groupe sans règle effective n'ajoute rien (dans Filament, `orWhere` avec une clôture vide est ignoré).
            const effective = groups.filter((group) => group.nodes.length);
            if (!effective.length) continue;
            nodes.push({ or: effective.map((group) => group.nodes) });
            const parts = effective.map((group) => { const list = Object.values(group.summaries); return list.length > 1 ? `(${list.join(` ${tr('form.rules.item.and')} `)})` : list[0]; });
            summaries[key] = parts.length === 1 ? parts[0] : `${iteration > 1 ? '(' : ''}${parts.join(` ${tr('form.or_groups.block.or')} `)}${iteration > 1 ? ')' : ''}`;
            continue;
        }
        const constraint = constraints.find((candidate) => candidate.name === rule.type);
        const parsed = constraint?.parseOperator(rule.data.operator);
        if (!constraint || !parsed) continue;
        const resolved = parsed.operator.resolve(isObject(rule.data.settings) ? rule.data.settings : {}, parsed.inverse, constraint);
        if (!resolved) continue;
        // Attribut d'une relation : la condition porte sur les enregistrements liés (`whereHas`), comme Operator::applyToBaseQuery.
        const relationship = parsed.operator.onBaseQuery ? null : constraint.getRelationshipName();
        const modify = constraint.getModifyRelationshipQueryUsing();
        nodes.push(relationship === null ? resolved.condition : { relationship, nodes: [resolved.condition], ...(modify ? { modify } : {}) });
        summaries[key] = resolved.summary;
    }
    return { nodes, summaries };
}

/** Famille de SQL de la connexion knex de la requête. */
export type SqlDialect = 'sqlite' | 'mysql' | 'pg' | 'mssql';
/** Dialecte lu dans le client knex (`query.client.config.client`, ou celui de la connexion du modèle Objection) ; SQLite par défaut. */
export function sqlDialectOf(query: any): SqlDialect {
    const client = query?.client ?? query?.knex?.()?.client ?? query?.modelClass?.()?.knex?.()?.client;
    const configured = client?.config?.client;
    const name = String(typeof configured === 'string' ? configured : (client?.dialect ?? configured?.prototype?.dialect ?? client?.driverName ?? '')).toLowerCase();
    if (/mysql|maria/.test(name)) return 'mysql';
    if (/^(pg|pgnative|postgres|postgresql|cockroachdb|redshift)$/.test(name)) return 'pg';
    if (/mssql|sqlserver/.test(name)) return 'mssql';
    return 'sqlite';
}
/** Fragments SQL qui diffèrent d'une base à l'autre. `??` est la colonne (identifiant lié), jamais une valeur du navigateur. */
const SQL: Record<SqlDialect, { date: string; month: string; year: string; text: string; like: string }> = {
    sqlite: { date: 'date(??)', month: "cast(strftime('%m', ??) as integer)", year: "cast(strftime('%Y', ??) as integer)", text: '??', like: "?? like ? escape '\\'" },
    // MySQL : la barre oblique inverse est déjà le caractère d'échappement de LIKE (et doit être doublée dans un littéral).
    mysql: { date: 'date(??)', month: 'month(??)', year: 'year(??)', text: '??', like: '?? like ?' },
    // PostgreSQL : LIKE sensible à la casse, d'où la comparaison en minuscules (comme Filament) ; `cast` pour les colonnes non textuelles.
    pg: { date: 'cast(?? as date)', month: 'extract(month from ??)', year: 'extract(year from ??)', text: 'cast(?? as text)', like: "lower(cast(?? as text)) like ? escape '\\'" },
    mssql: { date: 'cast(?? as date)', month: 'month(??)', year: 'year(??)', text: '??', like: "?? like ? escape '\\'" },
};

/** Requête des enregistrements liés à ceux de la requête (sous-requête corrélée d'Objection, `relatedQuery`). */
function relatedQuery(query: any, relationship: string, modify: RelationshipQueryModifier | undefined): any {
    const model = query?.modelClass?.();
    if (typeof model?.relatedQuery !== 'function') throw new Error(`Constructeur de requêtes : la relation ${relationship} demande une requête Objection (modèle avec relationMappings).`);
    // Alias fixé ici (sinon Objection en pose un seulement pour certaines relations) : les colonnes liées sont qualifiées par lui.
    const sub = model.relatedQuery(relationship).alias(`${relationship}_related`);
    modify?.(sub);
    return sub;
}

/**
 * Applique des conditions à une requête knex / objection. Colonnes passées en identifiants, valeurs en paramètres liés ; les opérateurs
 * de comparaison viennent d'une liste fermée. Le SQL de date et de recherche suit le dialecte de la connexion.
 */
export function applyConditions(query: any, nodes: ConditionNode[], dialect: SqlDialect = sqlDialectOf(query)): void {
    const sql = SQL[dialect];
    for (const node of nodes) {
        if ('or' in node) {
            query.where((builder: any) => { for (const group of node.or) builder.orWhere((inner: any) => applyConditions(inner, group, dialect)); });
        } else if ('nodes' in node) {
            const sub = relatedQuery(query, node.relationship, node.modify);
            // Colonne qualifiée par la table liée : la sous-requête peut joindre une table pivot.
            const table = sub.tableRefFor(sub.modelClass());
            sub.where((inner: any) => applyConditions(inner, node.nodes.map((child) => qualify(child, table)), dialect));
            query.whereExists(sub);
        } else if (node.kind === 'like') query.whereRaw(node.negate ? `not (${sql.like})` : sql.like, [node.column, dialect === 'pg' ? node.pattern.toLowerCase() : node.pattern]);
        else if (node.kind === 'compare') query.where(node.column, node.operator, node.value);
        else if (node.kind === 'boolean') query.where(node.column, dialect === 'pg' ? node.value : node.value ? 1 : 0);
        else if (node.kind === 'date') query.whereRaw(`${sql.date} ${node.operator} ?`, [node.column, node.value]);
        else if (node.kind === 'month') query.whereRaw(`${sql.month} ${node.operator} ?`, [node.column, node.value]);
        else if (node.kind === 'year') query.whereRaw(`${sql.year} ${node.operator} ?`, [node.column, node.value]);
        else if (node.kind === 'filled') {
            // Port de IsFilledOperator : ni NULL ni chaîne vide (la colonne est lue en texte sous PostgreSQL).
            const column = node.column;
            query.where((inner: any) => (node.negate ? inner.whereNull(column).orWhereRaw(`${sql.text} = ?`, [column, '']) : inner.whereNotNull(column).whereRaw(`not (${sql.text} = ?)`, [column, ''])));
        } else if (node.kind === 'in') {
            if (node.negate) query.whereNotIn(node.column, node.values); else query.whereIn(node.column, node.values);
        } else if (node.kind === 'relationCount') {
            // Sous-requête de comptage en paramètre lié (Objection ne l'accepte pas comme colonne de `where`).
            query.whereRaw(`(?) ${node.operator} ?`, [relatedQuery(query, node.relationship, node.modify).count(), node.value]);
        } else if (node.kind === 'related') {
            const sub = relatedQuery(query, node.relationship, node.modify);
            if (node.keys !== null) { const related = sub.modelClass(); sub.whereIn(`${sub.tableRefFor(related)}.${related.idColumn}`, node.keys); }
            if (node.negate) query.whereNotExists(sub); else query.whereExists(sub);
        }
    }
}
/** Colonne d'une condition qualifiée par la table des enregistrements liés (sauf si elle l'est déjà). */
function qualify(node: ConditionNode, table: string): ConditionNode {
    if ('or' in node) return { or: node.or.map((group) => group.map((child) => qualify(child, table))) };
    if ('nodes' in node || !('column' in node) || node.column.includes('.')) return node;
    return { ...node, column: `${table}.${node.column}` };
}

// ------------------------------------------------------------------ formulaire
const CONTAINER_GRID = { '@md': 2, '@xl': 3, '!@sm': 2, '!@md': 3 };
const SETTINGS_GRID = { '@xl': 2, '!@md': 2 };
const anonymousScope = (path: string) => `x-data="filamentSchemaComponent(${e(js({ key: null, exposedMethods: [], path, containerPath: path }))})"`;

/** Réglages d'un opérateur : groupe à état `settings`, masqué quand l'opérateur n'a pas de formulaire. */
class SettingsGroup extends Component {
    private fields: Component[];
    constructor(fields: Component[]) {
        super();
        this._name = 'settings';
        this.fields = fields;
        this._hidden = () => this.fields.length === 0;
        this.columnSpan(SETTINGS_GRID);
    }
    hasStatePath(): boolean { return true; }
    getChildSchemas(): Schema[] {
        const c = this.container;
        return [new Schema(c.livewire).key(this.getKey()!).statePath(this.getStatePath()).operation(c.getOperation()).record(c.getRecord()).root(false).columns(SETTINGS_GRID).dense().components(this.fields)];
    }
    async toHtml(): Promise<string> { return `<div id="${e(this.getKey()!)}">${await this.getChildSchemas()[0].toHtml()}</div>`; }
}

/** Boutons « dupliquer » et « supprimer » d'un élément, portés par le Builder parent. */
function itemActions(builder: Builder, itemKey: string, path: string, cloneDisabled: boolean): string {
    const label = (name: string) => t(`filament-forms::components.builder.actions.${name}.label`);
    const danger = colorsOf(builder.livewire)?.getComponentClasses('icon-button', 'danger') ?? [];
    return `<div wire:key="" ${anonymousScope(path)}><div class="fi-sc-actions"><div class="fi-ac">${iconActionButton({ label: label('clone'), icon: 'm-square-2-stack', expression: builder.actionExpression('clone', { item: itemKey }), disabled: cloneDisabled })}${iconActionButton({ label: label('delete'), icon: 'm-trash', expression: builder.actionExpression('delete', { item: itemKey }), colorClasses: danger })}</div></div></div>`;
}

/** Ligne d'une règle : sélecteur d'opérateur, réglages, actions (port du Flex de Constraint::getBuilderBlock). */
class RuleRow extends Component {
    private builder: RuleBuilder;
    private itemKey: string;
    private constraint: Constraint;
    private data: Record<string, unknown>;
    constructor(builder: RuleBuilder, itemKey: string, constraint: Constraint, data: Record<string, unknown>) { super(); this.builder = builder; this.itemKey = itemKey; this.constraint = constraint; this.data = data; }
    getChildSchemas(): Schema[] {
        const c = this.container;
        const constraint = this.constraint;
        const parsed = constraint.parseOperator(this.data.operator);
        const operator = Select.make('operator').label(constraint.getLabel()).placeholder(t('filament-forms::components.select.placeholder')).options(constraint.getOperatorOptions()).live()
            // Changement d'opérateur : ses réglages par défaut complètent les réglages existants (comme `fill()` dans Filament).
            .afterStateUpdated(({ state, get, set }) => {
                const next = constraint.parseOperator(state)?.operator.defaults() ?? null;
                const current = get('settings');
                set('settings', next === null && !isObject(current) ? null : { ...(next ?? {}), ...(isObject(current) ? current : {}) });
            });
        return [new Schema(c.livewire).key(c.getKey()).statePath(c.getStatePath() || null).operation(c.getOperation()).record(c.getRecord()).root(false).columns(CONTAINER_GRID).dense()
            .components([operator, new SettingsGroup(parsed ? parsed.operator.fields() : [])])];
    }
    /** Le conteneur de la ligne est un conteneur de requêtes CSS (`gridContainer()`), dont dépendent les colonnes `@md` / `@xl`. */
    async toSchemaHtml(isVisible: boolean): Promise<string> { return (await super.toSchemaHtml(isVisible)).replace('class="fi-sc-component"', 'class="fi-sc-component fi-grid-ctn"'); }
    async toHtml(): Promise<string> {
        const path = this.container.getStatePath();
        return `<div role="group" aria-label="${e(this.constraint.getLabel())}" class="fi-sc-flex fi-from-default"><div wire:key="" ${anonymousScope(path)} class="fi-growable"><div>${await this.getChildSchemas()[0].toHtml()}</div></div>${itemActions(this.builder, this.itemKey, path, this.builder.isAtRuleLimit())}</div>`;
    }
}

/** Groupes d'un bloc « OR » : chaque groupe contient son propre constructeur de règles (port du Repeater `groups`). */
class OrGroups extends Field {
    private builder: RuleBuilder;
    private itemKey: string;
    constructor(builder: RuleBuilder, itemKey: string) { super('groups'); this.builder = builder; this.itemKey = itemKey; this._hiddenLabel = true; this._label = tr('form.or_groups.label'); }
    getGroups(): Record<string, { rules: unknown }> {
        const state = this.context().state;
        return isObject(state) ? Object.fromEntries(Object.entries(state).filter(([key, group]) => isItemKey(key) && isObject(group)).slice(0, 20)) : {};
    }
    private isBlank(group: { rules: unknown }): boolean { return !isObject(group.rules) || Object.keys(group.rules).length === 0; }
    getDefaultState(): unknown { return {}; }
    dehydrateState(): unknown { return Object.fromEntries(Object.keys(this.getGroups()).map((key) => [key, {}])); }
    getChildSchemas(): Schema[] {
        const c = this.container;
        return Object.keys(this.getGroups()).map((key) => new Schema(c.livewire).key(`${this.getKey()}.${key}`).statePath(`${this.getStatePath()}.${key}`).operation(c.getOperation()).record(c.getRecord()).root(false)
            .components([new RuleBuilder('rules', this.builder.filter, this.builder.depth + 1).hiddenLabel()]));
    }
    private canAddGroup(): boolean { const groups = Object.values(this.getGroups()); return groups.length < 20 && !groups.some((group) => this.isBlank(group)) && !this.builder.isAtRuleLimit(); }
    private canDeleteGroup(key: string): boolean { const groups = this.getGroups(); return Object.hasOwn(groups, key) && this.isBlank(groups[key]) && Object.keys(groups).length > 2; }
    getActions(): Action[] {
        const write = (groups: Record<string, unknown>) => writeState(this.livewire, this.getStatePath().split('.'), groups);
        return [
            Action.make('add').action(() => { if (this.canAddGroup()) write({ ...this.getGroups(), [shortKey()]: { rules: {} } }); }),
            Action.make('delete').action(({ arguments: args }) => { const key = String(args.item); if (!this.canDeleteGroup(key)) return; const groups = this.getGroups(); delete groups[key]; write(groups); }),
        ];
    }
    async toHtml(): Promise<string> {
        const key = this.getKey()!;
        const id = this.getId();
        const livewireKey = this.getLivewireKey() ?? '';
        const groups = Object.keys(this.getGroups());
        const schemas = this.getChildSchemas();
        const context = { ...((this.livewire as any).getActionMountContext?.() ?? {}), schemaComponent: key };
        const expression = (action: string, args: Record<string, unknown> | null) => `mountAction(${js(action)}, ${args ? js(args) : '{}'}, ${js(context)})`;
        const danger = colorsOf(this.livewire)?.getComponentClasses('icon-button', 'danger') ?? [];
        const tf = (name: string, replace: Record<string, string> = {}) => t(`filament-forms::components.repeater.${name}`, replace);
        const descriptionId = (groupKey: string) => `${id}-item-${createHash('md5').update(groupKey).digest('hex')}`;
        const rows: string[] = [];
        for (const [index, groupKey] of groups.entries()) {
            const path = `${this.getStatePath()}.${groupKey}`;
            const [builder] = schemas[index].getComponents() as RuleBuilder[];
            const remove = this.canDeleteGroup(groupKey) ? `<div wire:key="" ${anonymousScope(path)}><div class="fi-sc-actions"><div class="fi-ac">${iconActionButton({ label: tf('actions.delete.label'), icon: 'm-trash', expression: expression('delete', { item: groupKey }), colorClasses: danger })}</div></div></div>` : '';
            const content = `<div class="fi-grid fi-sc fi-sc-has-gap" style="--cols-default: repeat(1, minmax(0, 1fr));"><div ${anonymousScope(path)} class="fi-grid-col" style="--col-span-default: span 1 / span 1;"><div class="fi-sc-component"><div role="group" aria-label="${e(tr('form.or_groups.group.label'))}" class="fi-sc-flex fi-from-default fi-vertical-align-center"><div wire:key="${e(builder.getLivewireKey() ?? '')}" x-data="filamentSchemaComponent(${e(js(builder.getAlpineScopeConfiguration()))})" class="fi-growable">${await builder.toHtml()}</div>${remove}</div></div></div></div>`;
            rows.push(`<li wire:ignore.self wire:key="${e(livewireKey)}.${e(groupKey)}.item" x-data="item(${e(js({ isCollapsed: false, collapseKey: null }))})" x-on:repeater-expand.window="expandFromEvent" x-on:repeater-collapse.window="collapseFromEvent" x-on:expand="expand" x-sortable-item="${e(groupKey)}" class="fi-fo-repeater-item" x-bind:class="itemClasses"><div x-show="! isCollapsed" class="fi-fo-repeater-item-content">${content}</div></li>`);
            if (index < groups.length - 1) rows.push(`<li class="fi-fo-repeater-label-between-items-ctn"><div class="fi-fo-repeater-label-between-items-divider-before"></div><span class="fi-fo-repeater-label-between-items">${e(tr('item_separators.or'))}</span><div class="fi-fo-repeater-label-between-items-divider-after"></div></li>`);
        }
        const config = { statePath: this.getStatePath(), schemaComponent: key, moveUpAction: 'moveUp', moveDownAction: 'moveDown', reorderAction: 'reorder', message: tf('reordering.moved'), hasCustomReorderAction: false };
        const addExpression = expression('add', null);
        const add = this.canAddGroup() ? `<div class="fi-fo-repeater-add fi-align-end"><button type="button" wire:loading.attr="aria-disabled" wire:loading.class="fi-disabled" class="fi-ac-btn-action fi-btn fi-size-sm" wire:click="${e(addExpression)}">${e(tr('actions.add_rule_group.label'))}</button></div>` : '';
        const descriptions = groups.map((groupKey, index) => `<span class="fi-sr-only" data-reorder-description="${e(groupKey)}" data-reorder-label="${e(tf('reordering.item'))}" id="${e(descriptionId(groupKey))}">${e(tf('reordering.position', { label: tf('reordering.item'), position: String(index + 1), count: String(groups.length) }))}</span>`).join('');
        const repeater = `<div aria-labelledby="${e(id)}-label" id="${e(id)}" role="group" data-reorder-owner="data-reorder-owner" data-reorder-items="${e(JSON.stringify(groups))}" x-load="x-load" x-load-src="${e(views.render('filament-forms::asset', { path: 'repeater' }).trim())}" x-data="repeaterFormComponent(${e(js(config))})" class="fi-fo-repeater"><span wire:ignore x-ref="reorderStatus" class="fi-sr-only" role="status" aria-live="polite" aria-atomic="true"></span><ul x-sortable data-sortable-animation-duration="300" x-on:end.stop="reorder" x-ref="reorderItems" class="fi-grid fi-fo-repeater-items" style="--cols-default: repeat(1, minmax(0, 1fr));">${rows.join('')}</ul>${add}${descriptions}</div>`;
        const path = this.container.getStatePath();
        return `<div role="group" aria-label="${e(tr('form.or_groups.block.label'))}" class="fi-sc-flex fi-from-default"><div wire:key="${e(livewireKey)}" ${anonymousScope(path)} class="fi-growable">${await this.wrap(repeater, { labelAsDiv: true })}</div>${itemActions(this.builder, this.itemKey, path, this.builder.isAtRuleLimit())}</div>`;
    }
}

/** Constructeur de règles (port de RuleBuilder) : un Builder dont les blocs sont les contraintes du filtre, plus le bloc « OR ». */
export class RuleBuilder extends Builder {
    readonly filter: QueryBuilder;
    readonly depth: number;
    constructor(name: string, filter: QueryBuilder, depth = 1) {
        super(name);
        this.filter = filter;
        this.depth = depth;
        const columns = filter.getConstraintPickerColumns();
        this.label(tr('form.rules.label'))
            .blocks(() => [
                ...filter.getConstraints().map((constraint) => Block.make(constraint.name).label(constraint.getLabel()).icon(constraint.getIcon())
                    .defaultData(() => constraint.getDefaultData())
                    .schema(({ builder, itemKey, data }) => [new RuleRow(builder as RuleBuilder, itemKey, constraint, data)])),
                Block.make(OR).label(tr('form.or_groups.block.label')).icon('m-slash')
                    .defaultData(() => ({ groups: { [shortKey()]: { rules: {} }, [shortKey()]: { rules: {} } } }))
                    .schema(({ builder, itemKey }) => [new OrGroups(builder as RuleBuilder, itemKey)]),
            ])
            .addActionLabel(tr('actions.add_rule.label')).addActionIcon('c-plus').addActionAlignment('start')
            .labelBetweenItems(tr('item_separators.and')).blockHeaders(false).addBetweenAction(false).storedAsList(false).cloneable().generateUuidUsing(shortKey)
            .blockPickerColumns(columns).blockPickerWidth(columns === 2 ? 'md' : columns === 3 ? '2xl' : null)
            .extraClass('fi-fo-builder-not-contained').maxItems(MAX_RULES);
    }
    /** Le bloc « OR » n'est plus proposé (ni accepté) quand il dépasserait la profondeur autorisée ; rien ne l'est une fois le plafond de règles atteint. */
    getBlockPickerBlocks(): Block[] {
        if (this.isAtRuleLimit()) return [];
        return this.getBlocks().filter((block) => block.name !== OR || this.depth < MAX_NESTING_DEPTH);
    }
    getBlock(name: unknown): Block | undefined { return name === OR && this.depth >= MAX_NESTING_DEPTH ? undefined : super.getBlock(name); }
    protected canAdd(): boolean { return !this.isAtRuleLimit(); }
    /** Nombre de règles de l'arbre entier (les blocs « OR » ne comptent pas), lu dans l'état différé de l'hôte. */
    isAtRuleLimit(): boolean { return this.filter.countRules((this.livewire as any).tableDeferredFilters?.[this.filter.name]) >= MAX_RULES; }
    /** Action de composant sans modale (utilisée aussi par les groupes « OR »). */
    makeAction(name: string, handler: (args: Record<string, unknown>) => void): any { return this.getActions()[0].constructor.make(name).action(({ arguments: args }: { arguments: Record<string, unknown> }) => handler(args)); }
}

// ------------------------------------------------------------------ filtre
/** Filtre « constructeur de requêtes » d'une table. */
export class QueryBuilder implements TableFilter {
    readonly name = 'queryBuilder';
    private _constraints: Constraint[] = [];
    private _pickerColumns: number | null = null;
    private _model: any = null;
    static make(): QueryBuilder { return configured(new QueryBuilder()); }
    constraints(constraints: Constraint[]): this {
        if (new Set(constraints.map((c) => c.name)).size !== constraints.length) throw new Error('QueryBuilder : deux contraintes portent le même nom.');
        this._constraints = constraints;
        if (this._model) for (const constraint of constraints) if (!constraint.getModel()) constraint.model(this._model);
        return this;
    }
    /** Modèle Objection de la table, transmis aux contraintes de relation (listes d'enregistrements liés). */
    model(model: any): this {
        this._model = model;
        for (const constraint of this._constraints) if (!constraint.getModel()) constraint.model(model);
        return this;
    }
    /** Avant les indicateurs : charge les libellés des enregistrements liés que citent les règles (`RelationshipConstraint.selectable`). */
    async loadIndicatorData(state: FilterState, host: TableHost): Promise<void> {
        const keys = new Map<RelationshipConstraint, Key[]>();
        const walk = (rules: Rules) => {
            for (const rule of Object.values(rules)) {
                if (rule.type === OR) { for (const group of Object.values(rule.data.groups as Record<string, { rules: Rules }>)) walk(group.rules); continue; }
                const constraint = this._constraints.find((candidate) => candidate.name === rule.type);
                if (!(constraint instanceof RelationshipConstraint) || !isObject(rule.data.settings)) continue;
                const raw = rule.data.settings.values ?? rule.data.settings.value;
                const list = (Array.isArray(raw) ? raw : [raw]).filter((value): value is Key => typeof value === 'string' || typeof value === 'number');
                keys.set(constraint, [...(keys.get(constraint) ?? []), ...list]);
            }
        };
        walk(this.sanitizeState(state).rules as Rules);
        for (const [constraint, list] of keys) await constraint.loadRelatedLabels([...new Set(list)], host);
    }
    constraintPickerColumns(columns: number | null = 2): this { this._pickerColumns = columns; return this; }
    getConstraints(): Constraint[] { return this._constraints; }
    getConstraintPickerColumns(): number | null { return this._pickerColumns; }
    getLabel(): string { return tr('label'); }
    getDefaultState(): FilterState { return { rules: {} }; }
    getFormDefinition() { return { placeholder: '', options: [] as [string, string][] }; }
    /** Le filtre occupe toute la largeur du formulaire des filtres. */
    getColumnSpan(): Record<string, number | string> { return { default: 'full' }; }
    getFormComponents(): Component[] { return [new RuleBuilder('rules', this).label(this.getLabel()).hiddenLabel()]; }
    sanitizeState(state: unknown): FilterState { return { rules: sanitizeRules(this._constraints, isObject(state) ? state.rules : null) }; }
    countRules(state: unknown): number {
        const count = (rules: Rules): number => Object.values(rules).reduce((total, rule) => total + (rule.type === OR ? Object.values(rule.data.groups as Record<string, { rules: Rules }>).reduce((sum, group) => sum + count(group.rules), 0) : 1), 0);
        return count(this.sanitizeState(state).rules as Rules);
    }
    private compile(state: FilterState) { return compileRules(this._constraints, this.sanitizeState(state).rules as Rules); }
    isActive(state: FilterState): boolean { return this.compile(state).nodes.length > 0; }
    getIndicators(state: FilterState): FilterIndicator[] { return Object.entries(this.compile(state).summaries).map(([field, label]) => ({ label, field })); }
    /** Retrait d'un indicateur : la règle de premier niveau correspondante disparaît. */
    removeIndicator(state: FilterState, field: string): FilterState {
        const rules = { ...(this.sanitizeState(state).rules as Rules) };
        if (Object.hasOwn(rules, field)) delete rules[field];
        return { rules };
    }
    apply(query: Omit<ListQuery, 'page' | 'perPage'>, state: FilterState): void {
        const { nodes } = this.compile(state);
        if (nodes.length) (query.modifiers ??= []).push((builder: any) => { builder.where((inner: any) => applyConditions(inner, nodes)); });
    }
}
