import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ColorManager, views } from '@navette-js/support';
import { Schema, useColorManager as useSchemasColorManager } from '@navette-js/schemas';
import { useColorManager as useActionsColorManager } from '@navette-js/actions';
import { DatePicker, DateTimePicker, TimePicker, fillSchemaFromRecord, getSchemaState, phpDateFormatToDayjs, useColorManager, validateSchema } from '../src/index.ts';

const colors = new ColorManager();
useColorManager(colors);
useActionsColorManager(colors);
useSchemasColorManager(colors);
views.share({ assetUrl: (file: string) => `/${file}` });
const host = (data: Record<string, unknown> = {}) => ({ id: 'lw', _errors: {} as Record<string, string[]>, data, getSchema() { return null as any; }, dispatch() {} });
const form = (livewire: any, components: any[]) => Schema.make(livewire).key('form').statePath('data').components(components);

test('PHP display formats convert to day.js', () => {
    assert.equal(phpDateFormatToDayjs('M j, Y H:i:s'), 'MMM D, YYYY HH:mm:ss');
    assert.equal(phpDateFormatToDayjs(String.raw`d/m/Y \a\t g:i A`), 'DD/MM/YYYY [a][t] h:mm A');
});

test('native pickers keep their inputs; min/max apply to all three', async () => {
    const livewire = host({ day: '2026-01-10', at: '2026-01-10 09:30:00', time: '08:00' });
    const schema = form(livewire, [DatePicker.make('day').minDate('2026-01-15'), DateTimePicker.make('at').maxDate('2026-01-01 00:00:00'), TimePicker.make('time').seconds(false).minDate('09:00')]);
    const html = await schema.toHtml();
    assert.match(html, /min="2026-01-15"[^>]*type="date"/);
    assert.match(html, /max="2026-01-01T00:00:00"[^>]*type="datetime-local"/);
    assert.match(html, /min="09:00"[^>]*type="time"/);
    assert.deepEqual(Object.keys(await validateSchema(schema)).sort(), ['data.at', 'data.day', 'data.time']);
});

test('JavaScript picker: markup, display format, disabled dates checked on the server', async () => {
    const livewire = host({ day: '2026-03-04' });
    const field = DatePicker.make('day').native(false).displayFormat('d/m/Y').firstDayOfWeek(0).disabledDates(['2026-03-04']).locale('fr');
    const schema = form(livewire, [field]);
    fillSchemaFromRecord(schema, livewire.data, { day: '2026-03-04' });
    assert.equal(livewire.data.day, '2026-03-04 00:00:00');
    const html = await schema.toHtml();
    assert.match(html, /dateTimePickerFormComponent/);
    assert.match(html, /displayFormat: &#039;DD.{0,2}\/MM.{0,2}\/YYYY&#039;/);
    assert.match(html, /firstDayOfWeek: 0/);
    assert.match(html, /role="grid"/);
    assert.deepEqual(await validateSchema(schema), { 'data.day': ['The selected day is invalid.'] });
    livewire.data.day = '2026-03-05 00:00:00';
    assert.deepEqual(await validateSchema(schema), {});
    assert.deepEqual(await getSchemaState(schema), { day: '2026-03-05' });
});

test('timezone: shown in the zone, saved in UTC; format() shapes the saved value', async () => {
    const livewire = host({});
    const schema = form(livewire, [DateTimePicker.make('at').timezone('Europe/Paris'), DatePicker.make('day').format('d/m/Y')]);
    fillSchemaFromRecord(schema, livewire.data, { at: '2026-07-01 10:00:00', day: '2026-07-01' });
    assert.equal(livewire.data.at, '2026-07-01 12:00:00');
    livewire.data.at = '2026-01-15T08:30';
    assert.deepEqual(await getSchemaState(schema), { at: '2026-01-15 07:30:00', day: '01/07/2026' });
});
