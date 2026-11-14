// Built-in query builder operators (IsFilledOperator, ContainsOperator...) in operators(), pushOperators() and
// unshiftOperators().
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    ContainsOperator, DateConstraint, EndsWithOperator, EqualsOperator, HasMinOperator, IsAfterOperator, IsEmptyOperator, IsFilledOperator, IsMinOperator,
    IsOperator, IsRelatedToOperator, IsTrueOperator, IsYearOperator, NumberConstraint, RelationshipConstraint, SelectConstraint, StartsWithOperator, TextConstraint,
    compileRules, sanitizeRules,
} from '../src/index.ts';

const rule = (type: string, operator: unknown, settings: unknown = null) => ({ type, data: { operator, settings } });

test('operators(): only the given built-in operators, in order; pushOperators() / unshiftOperators() add them', () => {
    const name = TextConstraint.make('name').operators([StartsWithOperator.make(), IsFilledOperator.make()]);
    assert.deepEqual(name.getOperatorOptions().map(([value]) => value), ['startsWith', 'startsWith.inverse', 'isFilled', 'isFilled.inverse']);
    const pushed = TextConstraint.make('title').pushOperators([IsFilledOperator.make()]);
    assert.deepEqual(pushed.getAvailableOperators().map((operator) => operator.name), ['contains', 'startsWith', 'endsWith', 'equals', 'isFilled']);
    const unshifted = TextConstraint.make('code').unshiftOperators([EndsWithOperator.make()]);
    assert.deepEqual(unshifted.getAvailableOperators().map((operator) => operator.name), ['endsWith', 'contains', 'startsWith', 'equals']);
    const constraints = [name, NumberConstraint.make('qty').integer().operators([IsMinOperator.make(), EqualsOperator.make()])];
    const { nodes, summaries } = compileRules(constraints, sanitizeRules(constraints, { a: rule('name', 'isFilled.inverse'), b: rule('qty', 'equals', { number: '4' }), c: rule('name', 'contains', { text: 'x' }) }));
    assert.deepEqual(nodes, [{ kind: 'filled', column: 'name', negate: true }, { kind: 'compare', column: 'qty', operator: '=', value: 4 }]);
    assert.equal(Object.keys(summaries).length, 2, 'contains is not offered any more');
});

test('built-in operators follow the constraint: number equals, integer(), date time(), relationship and select operators', () => {
    const qty = NumberConstraint.make('qty').operators([EqualsOperator.make()]);
    qty.integer();
    const text = TextConstraint.make('code').operators([EqualsOperator.make(), ContainsOperator.make()]);
    const compiled = compileRules([text, qty], sanitizeRules([text, qty], { a: rule('code', 'equals', { text: 'A' }), b: rule('qty', 'equals', { number: '2.5' }) }));
    assert.deepEqual(compiled.nodes, [{ kind: 'compare', column: 'code', operator: '=', value: 'A' }], 'the integer constraint refuses 2.5 (it reads integer() set later)');
    const date = DateConstraint.make('at').time().operators([IsAfterOperator.make(), IsYearOperator.make()]);
    assert.deepEqual(date.getAvailableOperators().map((operator) => operator.name), ['isAfter', 'isYear']);
    const tags = RelationshipConstraint.make('tags').multiple().operators([HasMinOperator.make(), IsEmptyOperator.make(), IsRelatedToOperator.make().titleAttribute('name')]);
    assert.deepEqual(tags.getAvailableOperators().map((operator) => operator.name), ['hasMin', 'isEmpty', 'isRelatedTo']);
    const status = SelectConstraint.make('status').options({ draft: 'Draft' }).operators([IsOperator.make(), IsFilledOperator.make()]);
    assert.deepEqual(status.getAvailableOperators().map((operator) => operator.name), ['is', 'isFilled']);
    assert.throws(() => TextConstraint.make('x').operators([IsOperator.make()]).getOperatorOptions(), /IsOperator needs a SelectConstraint/);
    assert.throws(() => TextConstraint.make('x').operators([IsRelatedToOperator.make()]), /needs a RelationshipConstraint/);
    assert.deepEqual(TextConstraint.make('flag').operators([IsTrueOperator.make()]).getAvailableOperators().map((operator) => operator.name), ['isTrue']);
});

test('SelectFilter: hasRelationship() and getRelationshipName()', async () => {
    const { SelectFilter } = await import('../src/index.ts');
    assert.deepEqual([SelectFilter.make('status').hasRelationship(), SelectFilter.make('status').getRelationshipName()], [false, null]);
    const author = SelectFilter.make('author').relationship('author', 'name');
    assert.deepEqual([author.hasRelationship(), author.getRelationshipName()], [true, 'author']);
});
