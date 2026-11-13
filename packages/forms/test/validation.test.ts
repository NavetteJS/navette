import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema } from '@navette-js/schemas';
import { TagsInput, TextInput, validateSchema } from '../src/index.ts';

const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const check = (data: Record<string, unknown>, components: any[]) => validateSchema(Schema.make(host(data) as any).key('form').statePath('data').components(components));

test('rules(): Laravel-style strings, numeric sizes on numeric fields', async () => {
    const fields = () => [TextInput.make('name').rules(['required', 'max:5']), TextInput.make('age').integer().rules('min:18|max:120'), TextInput.make('code').rules(['nullable', 'regex:/^[A-Z]{3}$/'])];
    assert.deepEqual(await check({ name: 'Jonathan', age: '12', code: 'abc' }, fields()), {
        'data.name': ['The name field must not be greater than 5 characters.'],
        'data.age': ['The age field must be at least 18.'],
        'data.code': ['The code field format is invalid.'],
    });
    assert.deepEqual(await check({ name: 'Jo', age: '30', code: '' }, fields()), {});
    assert.deepEqual(await check({ name: '', age: '30', code: 'ABC' }, fields()), { 'data.name': ['The name field is required.'] });
    assert.throws(() => TextInput.make('x').rules(['frobnicate']), /Unknown validation rule "frobnicate"/);
    assert.throws(() => TextInput.make('x').rule('regex:abc'), /Invalid regex rule/);
});

test('validationAttribute() and validationMessages()', async () => {
    const field = TextInput.make('email_address').required().email().validationAttribute('email').validationMessages({ required: 'We need :attribute.', email: (a) => `Bad ${a}!` });
    assert.deepEqual(await check({ email_address: '' }, [field]), { 'data.email_address': ['We need email.'] });
    assert.deepEqual(await check({ email_address: 'nope' }, [field]), { 'data.email_address': ['Bad email!'] });
});

test('format rules', async () => {
    const cases: [any, unknown, string | null][] = [
        [TextInput.make('v').alpha(), 'abc1', 'The v field must only contain letters.'],
        [TextInput.make('v').alphaDash(), 'a-b_c1', null],
        [TextInput.make('v').alphaNum(), 'a-b', 'The v field must only contain letters and numbers.'],
        [TextInput.make('v').uuid(), '123e4567-e89b-12d3-a456-426614174000', null],
        [TextInput.make('v').ulid(), 'nope', 'The v field must be a valid ULID.'],
        [TextInput.make('v').json(), '{"a":1}', null],
        [TextInput.make('v').ipv4(), '256.1.1.1', 'The v field must be a valid IPv4 address.'],
        [TextInput.make('v').ip(), '::1', null],
        [TextInput.make('v').macAddress(), '00:1A:2b:3c:4d:5e', null],
        [TextInput.make('v').hexColor(), '#12345', 'The v field must be a valid hexadecimal color.'],
        [TextInput.make('v').numeric().multipleOf(5), '12', 'The v field must be a multiple of 5.'],
        [TextInput.make('v').in(['a', 'b']), 'c', 'The selected v is invalid.'],
        [TextInput.make('v').enum({ Draft: 'draft', Published: 'published' }), 'draft', null],
        [TextInput.make('v').notIn(['admin']), 'admin', 'The selected v is invalid.'],
        [TextInput.make('v').startsWith(['https://', 'mailto:']), 'ftp://x', 'The v field must start with one of the following: https://, mailto:.'],
        [TextInput.make('v').doesntEndWith('.exe'), 'a.exe', 'The v field must not end with one of the following: .exe.'],
        [TextInput.make('v').regex(/^\d+$/), '12a', 'The v field format is invalid.'],
        [TextInput.make('v').notRegex('/admin/i'), 'ADMIN', 'The v field format is invalid.'],
        [TagsInput.make('v').distinct(), ['a', 'a'], 'The v field has a duplicate value.'],
    ];
    for (const [field, value, message] of cases) assert.deepEqual(await check({ v: value }, [field]), message ? { 'data.v': [message] } : {}, `${value}`);
});

test('rules comparing with other fields', async () => {
    const fields = () => [
        TextInput.make('password').confirmed(),
        TextInput.make('password_confirmation').dehydrated(false),
        TextInput.make('new_email').different('email'),
        TextInput.make('email'),
        TextInput.make('max').numeric().gt('min'),
        TextInput.make('min').numeric(),
    ];
    assert.deepEqual(await check({ password: 'a', password_confirmation: 'b', email: 'x@y.z', new_email: 'x@y.z', min: '10', max: '5' }, fields()), {
        'data.password': ['The password field confirmation does not match.'],
        'data.new_email': ['The new email field and email must be different.'],
        'data.max': ['The max field must be greater than min.'],
    });
    assert.deepEqual(await check({ password: 'a', password_confirmation: 'a', email: 'x@y.z', new_email: 'w@y.z', min: '1', max: '5' }, fields()), {});
});

test('conditional requirements run on empty values', async () => {
    const fields = () => [
        TextInput.make('type'),
        TextInput.make('company').requiredIf('type', 'business'),
        TextInput.make('vat').requiredWith('company'),
        TextInput.make('nickname').prohibitedUnless('type', 'person'),
    ];
    assert.deepEqual(await check({ type: 'business', company: '', vat: '', nickname: 'Bob' }, fields()), {
        'data.company': ['The company field is required when type is business.'],
        'data.nickname': ['The nickname field is prohibited unless type is in person.'],
    });
    assert.deepEqual(await check({ type: 'business', company: 'ACME', vat: '', nickname: '' }, fields()), { 'data.vat': ['The vat field is required when company is present.'] });
    assert.deepEqual(await check({ type: 'person', company: '', vat: '', nickname: 'Bob' }, fields()), {});
});

test('rule() with a condition, exists() with a function and an adapter', async () => {
    const fields = (strict: boolean) => [TextInput.make('code').rule('min:4', () => strict)];
    assert.deepEqual(await check({ code: 'ab' }, fields(false)), {});
    assert.deepEqual(await check({ code: 'ab' }, fields(true)), { 'data.code': ['The code field must be at least 4 characters.'] });
    const adapter = { exists: async (column: string, value: unknown) => column === 'id' && value === '7' };
    assert.deepEqual(await check({ brand: '8' }, [TextInput.make('brand').exists({ adapter, column: 'id' })]), { 'data.brand': ['The selected brand is invalid.'] });
    assert.deepEqual(await check({ brand: '7' }, [TextInput.make('brand').exists({ adapter, column: 'id' })]), {});
    assert.deepEqual(await check({ brand: 'x' }, [TextInput.make('brand').exists((value) => value === 'y')]), { 'data.brand': ['The selected brand is invalid.'] });
});

test('markAsRequired() controls the asterisk only', async () => {
    const livewire = host({ a: '' });
    const schema = Schema.make(livewire as any).key('form').statePath('data').components([TextInput.make('a').required().markAsRequired(false), TextInput.make('b').markAsRequired()]);
    const html = await schema.toHtml();
    assert.equal(html.match(/fi-fo-field-label-required-mark/g)?.length, 1);
    assert.deepEqual(await validateSchema(schema), { 'data.a': ['The a field is required.'] });
});
