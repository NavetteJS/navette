import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineEnum, enumCast, EnumCase, isEnum, isEnumCase, nativeEnum, resolveEnumCase, type EnumValue } from '../src/index.ts';

const Status = defineEnum({
    draft: { label: 'Draft', color: 'gray', icon: 'm-pencil', description: 'Not finished yet.' },
    reviewing: { label: 'Reviewing', color: 'warning', icon: 'm-eye' },
    published: 'Published',
    rejected: {},
});

test('defineEnum(): cases, values, options and per-value maps', () => {
    assert.ok(isEnum(Status));
    assert.deepEqual(Status.values(), ['draft', 'reviewing', 'published', 'rejected']);
    assert.deepEqual(Status.options(), [['draft', 'Draft'], ['reviewing', 'Reviewing'], ['published', 'Published'], ['rejected', 'rejected']]);
    assert.deepEqual(Status.labels(), { draft: 'Draft', reviewing: 'Reviewing', published: 'Published', rejected: 'rejected' });
    assert.deepEqual(Status.colors(), { draft: 'gray', reviewing: 'warning' });
    assert.deepEqual(Status.icons(), { draft: 'm-pencil', reviewing: 'm-eye' });
    assert.deepEqual(Status.descriptions(), { draft: 'Not finished yet.' });
    const typed: EnumValue<typeof Status> = 'draft';
    assert.equal(Status.getLabel(typed), 'Draft');
});

test('defineEnum(): from(), tryFrom(), has() and case objects', () => {
    const draft = Status.from('draft');
    assert.ok(draft instanceof EnumCase);
    assert.ok(isEnumCase(draft));
    assert.equal(draft.value, 'draft');
    assert.equal(draft.name, 'draft');
    assert.equal(draft.label, 'Draft');
    assert.equal(draft.color, 'gray');
    assert.equal(draft.icon, 'm-pencil');
    assert.equal(draft.description, 'Not finished yet.');
    assert.equal(`${draft}`, 'draft');
    assert.equal(JSON.stringify({ status: draft }), '{"status":"draft"}');
    assert.ok(draft.is('draft') && draft.is(Status.from('draft')) && !draft.is('published'));
    assert.equal(Status.tryFrom(draft), draft);
    assert.equal(Status.tryFrom('nope'), null);
    assert.equal(Status.tryFrom(null), null);
    assert.equal(Status.tryFrom({ value: 'draft' }), null);
    assert.ok(Status.has('published') && !Status.has('Published'));
    assert.throws(() => Status.from('nope'), RangeError);
    assert.equal(Status.getLabel('unknown'), 'unknown');
    assert.equal(Status.getLabel(null), null);
    assert.equal(Status.getColor('published'), null);
});

test('defineEnum(): a list of values, lazy labels and duplicate values', () => {
    const Size = defineEnum(['sm', 'md', 'lg']);
    assert.deepEqual(Size.options(), [['sm', 'sm'], ['md', 'md'], ['lg', 'lg']]);
    let locale = 'en';
    const Lazy = defineEnum({ yes: { label: () => (locale === 'en' ? 'Yes' : 'Oui'), description: () => `(${locale})` } });
    assert.equal(Lazy.getLabel('yes'), 'Yes');
    locale = 'fr';
    assert.equal(Lazy.getLabel('yes'), 'Oui');
    assert.equal(Lazy.getDescription('yes'), '(fr)');
    assert.throws(() => defineEnum([1, '1']), /defined twice/);
    assert.throws(() => defineEnum(null as any), TypeError);
});

// Node runs TypeScript by stripping types, which rejects `enum` declarations: the enums below are written the way tsc
// compiles them (`enum Visibility { Public = 'public', … }`, `enum Priority { Low = 1, Medium, High = 10 }`).
test('nativeEnum(): string and numeric TypeScript enums, `as const` objects', () => {
    const Visibility = { Public: 'public', Private: 'private' } as const;
    const VisibilityEnum = nativeEnum(Visibility, { Private: { label: 'Only me', color: 'danger' } });
    assert.deepEqual(VisibilityEnum.options(), [['public', 'Public'], ['private', 'Only me']]);
    assert.equal(VisibilityEnum.from('private').name, 'Private');
    assert.equal(VisibilityEnum.getColor(Visibility.Private), 'danger');

    const Priority = { Low: 1, Medium: 2, High: 10, 1: 'Low', 2: 'Medium', 10: 'High' } as const;
    const PriorityEnum = nativeEnum(Priority, { 10: 'Urgent' });
    assert.deepEqual(PriorityEnum.values(), [1, 2, 10]);
    assert.deepEqual(PriorityEnum.options(), [['1', 'Low'], ['2', 'Medium'], ['10', 'Urgent']]);
    // Form state is a string: '2' and 2 designate the same case.
    assert.equal(PriorityEnum.tryFrom('2'), PriorityEnum.from(Priority.Medium));
    assert.equal(PriorityEnum.from('10').value, 10);
});

test('enumCast(): the enum a model casts an attribute to', () => {
    class Post { static casts = { status: Status, title: 'string' }; status = 'reviewing'; title = 'Hello'; }
    const post = new Post();
    assert.equal(enumCast(post, 'status'), Status);
    assert.equal(enumCast(post, 'title'), null);
    assert.equal(enumCast(post, 'toString'), null);
    assert.equal(enumCast({ status: 'draft' }, 'status'), null);
    assert.equal(enumCast(null, 'status'), null);
    assert.equal(resolveEnumCase(post.status, { record: post, attribute: 'status' })?.label, 'Reviewing');
    assert.equal(resolveEnumCase('draft', { enum: Status })?.label, 'Draft');
    assert.equal(resolveEnumCase(Status.from('published'))?.label, 'Published');
    assert.equal(resolveEnumCase('draft'), null);
});
