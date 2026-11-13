import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BooleanConstraint, CustomConstraint, DateConstraint, MAX_NESTING_DEPTH, MAX_RULES, NumberConstraint, QueryBuilder, QueryBuilderOperator, TextConstraint, compileRules, resolveRuleDate, sanitizeRules, type ConditionNode } from '../src/index.ts';

const constraints = [TextConstraint.make('name'), NumberConstraint.make('qty').label('Quantity'), BooleanConstraint.make('is_visible').label('Visibility'), DateConstraint.make('published_at').label('Publishing date').attribute('products.published_at')];
const rule = (type: string, operator: unknown, settings: unknown = null) => ({ type, data: { operator, settings } });
const compile = (raw: unknown) => compileRules(constraints, sanitizeRules(constraints, raw));

test('rules → conditions: text, number, boolean, date, and their inverses', () => {
    const { nodes, summaries } = compile({
        a: rule('name', 'contains', { text: '50%_off' }), b: rule('name', 'equals.inverse', { text: 'Kit' }), c: rule('qty', 'isMin', { number: '50', aggregate: null }),
        d: rule('qty', 'isMax.inverse', { number: 1200.5 }), e: rule('is_visible', 'isTrue.inverse'), f: rule('published_at', 'isAfter', { mode: 'absolute', date: '2026-06-01' }),
        g: rule('published_at', 'isMonth', { month: '3' }), h: rule('published_at', 'isYear.inverse', { year: '2025' }), i: rule('name', 'startsWith', { text: 'Al' }),
    });
    assert.deepEqual(nodes, [
        { kind: 'like', column: 'name', pattern: '%50\\%\\_off%', negate: false },
        { kind: 'compare', column: 'name', operator: '!=', value: 'Kit' },
        { kind: 'compare', column: 'qty', operator: '>=', value: 50 },
        { kind: 'compare', column: 'qty', operator: '>', value: 1200.5 },
        { kind: 'boolean', column: 'is_visible', value: false },
        { kind: 'date', column: 'products.published_at', operator: '>=', value: '2026-06-01' },
        { kind: 'month', column: 'products.published_at', operator: '=', value: 3 },
        { kind: 'year', column: 'products.published_at', operator: '!=', value: 2025 },
        { kind: 'like', column: 'name', pattern: 'Al%', negate: false },
    ] satisfies ConditionNode[]);
    assert.equal(summaries.a, 'Name contains 50%_off');
    assert.equal(summaries.c, 'Quantity is minimum 50');
    assert.equal(summaries.d, 'Quantity is greater than 1,200.5');
    assert.equal(summaries.e, 'Visibility is false');
    assert.equal(summaries.f, 'Publishing date is after Jun 1, 2026');
    assert.equal(summaries.g, 'Publishing date is March');
});

test('a rule with an incomplete or invalid form has no effect', () => {
    const { nodes, summaries } = compile({
        a: rule('name', 'contains', { text: null }), b: rule('name', 'contains', { text: '' }), c: rule('qty', 'isMin', { number: 'abc' }), d: rule('qty', 'isMin', { number: null }),
        e: rule('published_at', 'isAfter', { mode: 'absolute', date: '2026-02-31' }), f: rule('published_at', 'isMonth', { month: 13 }), g: rule('published_at', 'isYear', { year: '20x6' }),
        h: rule('published_at', 'isAfter', { mode: 'relative', preset: 'custom', relative_value: 0, relative_unit: 'day' }), i: rule('name', null, { text: 'x' }),
    });
    assert.deepEqual(nodes, []);
    assert.deepEqual(summaries, {});
});

test('OR block: empty groups ignored, parenthesized label for multi-rule groups', () => {
    const { nodes, summaries } = compile({
        o: { type: 'or', data: { groups: {
            g1: { rules: { a: rule('name', 'contains', { text: 'Alpine' }), b: rule('is_visible', 'isTrue') } },
            g2: { rules: { c: rule('qty', 'equals', { number: 3 }) } },
            g3: { rules: {} }, g4: { rules: { d: rule('qty', 'isMin', { number: null }) } },
        } } },
        p: { type: 'or', data: { groups: { g1: { rules: {} }, g2: { rules: {} } } } },
    });
    assert.deepEqual(nodes, [{ or: [
        [{ kind: 'like', column: 'name', pattern: '%Alpine%', negate: false }, { kind: 'boolean', column: 'is_visible', value: true }],
        [{ kind: 'compare', column: 'qty', operator: '=', value: 3 }],
    ] }]);
    assert.deepEqual(summaries, { o: '(Name contains Alpine AND Visibility is true) OR Quantity equals 3' });
});

test('forged state: unknown types, operators, columns and settings are dropped', () => {
    const clean = sanitizeRules(constraints, {
        a: rule('password', 'contains', { text: 'x' }), b: rule('name', "contains'; drop table products; --", { text: 'Alpine' }),
        c: rule('qty', 'isMin', { number: { $gt: 0 }, 'qty) or (1=1': 1, aggregate: ['sum'] }), d: rule('name', 'toString', { text: 'x' }),
        'e f': rule('name', 'contains', { text: 'x' }), constructor: rule('name', 'contains', { text: 'x' }), g: 'name', h: { type: ['name'], data: {} }, i: { type: 'name' },
    });
    assert.deepEqual(Object.keys(clean), ['b', 'c', 'd', 'i']);
    assert.deepEqual(clean.b, { type: 'name', data: { operator: null, settings: { text: 'Alpine' } } });
    assert.deepEqual(clean.c, { type: 'qty', data: { operator: 'isMin', settings: { number: null, aggregate: null } } });
    assert.equal(clean.d.data.operator, null);
    assert.deepEqual(compileRules(constraints, clean).nodes, []);
    // The queried column comes from the constraint, never from the state.
    const [node] = compile({ x: { type: 'published_at', column: 'users.password', data: { operator: 'isDate', column: 'users.password', settings: { date: '2026-01-02', column: 'users.password' } } } }).nodes;
    assert.deepEqual(node, { kind: 'date', column: 'products.published_at', operator: '=', value: '2026-01-02' });
});

test('OR block depth and rule count are bounded', () => {
    let deep: unknown = rule('name', 'contains', { text: 'fond' });
    for (let level = 0; level < 10; level++) deep = { type: 'or', data: { groups: { g: { rules: { r: deep } } } } };
    const depthOf = (rules: Record<string, any>): number => 1 + Math.max(0, ...Object.values(rules).filter((r) => r.type === 'or').flatMap((r) => Object.values(r.data.groups as Record<string, any>).map((g) => depthOf(g.rules))));
    const clean = sanitizeRules(constraints, { r: deep });
    assert.equal(depthOf(clean), MAX_NESTING_DEPTH);
    assert.deepEqual(compileRules(constraints, clean).nodes, []);

    const many = Object.fromEntries(Array.from({ length: MAX_RULES + 50 }, (_, i) => [`k${i}`, rule('name', 'contains', { text: 'x' })]));
    assert.equal(Object.keys(sanitizeRules(constraints, many)).length, MAX_RULES);
    assert.equal(QueryBuilder.make().constraints(constraints).countRules({ rules: many }), MAX_RULES);
    for (const garbage of [null, 'rules', 42, [], [rule('name', 'contains', { text: 'x' })]]) assert.deepEqual(sanitizeRules(constraints, garbage), {});
});

test('relative dates: presets and custom offset', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'past_month' }, now), '2026-10-12');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'this_quarter' }, now), '2026-10-01');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'this_decade' }, now), '2020-01-01');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'next_2_weeks' }, now), '2026-11-26');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'custom', tense: 'future', relative_value: '3', relative_unit: 'quarter' }, now), '2027-08-12');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'custom', tense: 'past', relative_value: 2, relative_unit: 'week' }, now), '2026-10-29');
    // Unknown preset: today; unknown unit: days.
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'nope' }, now), '2026-11-12');
    assert.equal(resolveRuleDate({ mode: 'relative', preset: 'custom', relative_value: 1, relative_unit: 'eon' }, now), '2026-11-11');
    assert.equal(resolveRuleDate({ mode: 'absolute', date: 'yesterday' }, now), null);
});

test('filter: sanitized applied state, indicators, removal, query', () => {
    const filter = QueryBuilder.make().constraints(constraints).constraintPickerColumns(2);
    const state = filter.sanitizeState({ rules: { a: rule('name', 'contains', { text: 'Alpine' }), b: rule('qty', 'isMin', { number: null }), z: rule('nope', 'x') }, extra: 1 });
    assert.deepEqual(Object.keys(state), ['rules']);
    assert.deepEqual(Object.keys(state.rules as object), ['a', 'b']);
    assert.deepEqual(filter.getIndicators(state), [{ label: 'Name contains Alpine', field: 'a' }]);
    assert.equal(filter.isActive(state), true);
    assert.deepEqual(Object.keys(filter.removeIndicator(state, 'a').rules as object), ['b']);
    const query: { modifiers?: ((q: any) => void)[] } = {};
    filter.apply(query as any, state);
    assert.equal(query.modifiers?.length, 1);
    const none: { modifiers?: unknown[] } = {};
    filter.apply(none as any, filter.getDefaultState());
    assert.equal(none.modifiers, undefined);
    assert.throws(() => TextConstraint.make('or'));
    assert.throws(() => QueryBuilder.make().constraints([TextConstraint.make('a'), NumberConstraint.make('a')]));
});

test('`maxRules()`, `maxNestingDepth()`, `integer()` and custom operators', () => {
    const many = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, rule('name', 'contains', { text: 'x' })]));
    const limited = QueryBuilder.make().constraints(constraints).maxRules(3).maxNestingDepth(1);
    assert.equal(limited.countRules({ rules: many }), 3);
    const nested = { r: { type: 'or', data: { groups: { g: { rules: { a: rule('name', 'contains', { text: 'x' }) } } } } } };
    assert.deepEqual((limited.sanitizeState({ rules: nested }) as any).rules, {}, 'depth 1: no "or" groups');
    assert.equal(QueryBuilder.make().maxRules(5000).getMaxRules(), MAX_RULES, 'never above the hard limit');

    const whole = [NumberConstraint.make('qty').integer()];
    const compileWhole = (raw: unknown) => compileRules(whole, sanitizeRules(whole, raw)).nodes;
    assert.equal(compileWhole({ a: rule('qty', 'isMin', { number: '2.5' }) }).length, 0);
    assert.equal(compileWhole({ a: rule('qty', 'isMin', { number: '2' }) }).length, 1);

    const applied: unknown[] = [];
    const custom = [
        CustomConstraint.make('popularity').operators([
            QueryBuilderOperator.make('isPopular').label('Is popular', 'Is not popular')
                .query((query, { inverse }) => { applied.push(inverse); query.where('views', inverse ? '<' : '>=', 1000); })
                .summary(({ inverse }) => (inverse ? 'Not popular' : 'Popular')),
        ]),
        TextConstraint.make('name').pushOperators([QueryBuilderOperator.make('isShort').query((query) => query.whereRaw('length(name) < 5'))]),
    ];
    assert.deepEqual(custom[0].getOperatorOptions(), [['isPopular', 'Is popular'], ['isPopular.inverse', 'Is not popular']]);
    assert.ok(custom[1].getOperatorOptions().some(([value]) => value === 'isShort'));
    assert.ok(custom[1].getOperatorOptions().some(([value]) => value === 'contains'), 'default operators kept');
    const compiled = compileRules(custom, sanitizeRules(custom, { a: rule('popularity', 'isPopular.inverse'), b: rule('popularity', 'unknown') }));
    assert.deepEqual(compiled.summaries, { a: 'Not popular' });
    const calls: unknown[][] = [];
    const fake: any = { where: (arg: any, ...rest: unknown[]) => { if (typeof arg === 'function') arg(fake); else calls.push([arg, ...rest]); return fake; } };
    (compiled.nodes[0] as any).apply(fake);
    assert.deepEqual(calls, [['views', '<', 1000]]);
    assert.deepEqual(applied, [true]);
    assert.throws(() => TextConstraint.make('x').pushOperators([QueryBuilderOperator.make('contains')]).getOperatorOptions(), /same name/);
});
