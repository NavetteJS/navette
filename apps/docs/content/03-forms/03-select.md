---
title: Select
---

## Introduction

The select component allows you to select from a list of predefined options:

```ts
import { Select } from '@navette-js/forms';

Select.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

```preview
// state: {"status": "reviewing"}
Select.make('status')
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

Options may be an object of `value: label` pairs, or a list of `[value, label]` pairs when the order matters or the values are numeric:

```ts
import { Select } from '@navette-js/forms';

Select.make('priority')
    .options([
        ['3', 'High'],
        ['2', 'Medium'],
        ['1', 'Low'],
    ])
```

Values are handled as strings: a number read from the record (`department_id: 4`) is converted to `'4'` when the form is filled.

The empty option of a select displays "Select an option" by default. You may change it with `placeholder()`.

## Loading options from a function

Instead of a static list, you may pass a function to `options()`. It receives the [field context](/forms/overview#using-the-field-context), may be asynchronous, and is called every time the form is rendered or validated. This is how you list related records, since Navette has no `relationship()` method:

```ts
import { Select } from '@navette-js/forms';

Select.make('department_id')
    .label('Department')
    .options(async () => {
        const rows = await knex('departments').orderBy('name').select('id', 'name');

        return rows.map((row): [string, string] => [String(row.id), row.name]);
    })
```

The function may read other fields with `get()`. See [dependant select options](/forms/overview#dependant-select-options).

If the options come from a function but don't change while the page is open, pass `{ dynamic: false }`. The JavaScript select then treats them as a static list:

```ts
import { Select } from '@navette-js/forms';

Select.make('country')
    .options(async () => loadCountries(), { dynamic: false })
```

<Aside variant="warning">
Filament's `relationship()` is not available. List related records with an options function, and save the foreign key (or, for a multi-select, the related keys) in your data adapter.
</Aside>

## Enabling the JavaScript select

By default, Navette uses the native HTML select. You may enable the JavaScript select of Filament, which offers search, by calling `searchable()`. A [multi-select](#multi-select) always uses the JavaScript select.

## Searching options

You may enable a search input to allow easier access to many options, using the `searchable()` method:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .label('Author')
    .options(async () => listAuthors())
    .searchable()
```

With static options, the search runs in the browser. With an options function, each search asks the server, which filters the options by label. If the function returns the complete list anyway, you may search in the browser instead with `{ searchOnServer: false }`:

```ts
import { Select } from '@navette-js/forms';

Select.make('product_id')
    .options(async () => listProducts(), { searchOnServer: false })
    .searchable()
```

`preload()` is accepted for compatibility, but has no effect: options are always loaded with the form.

### Returning custom search results

When there are too many records to load them all, you may compute the search results on the server with `getSearchResultsUsing()`. It receives the search string (cut to 1000 characters) and the field context, and returns pairs. You must also define `getOptionLabelUsing()`, which returns the label of the selected value:

```ts
import { Select } from '@navette-js/forms';

Select.make('customer_id')
    .label('Customer')
    .getSearchResultsUsing(async (search) => {
        const rows = await knex('customers')
            .whereRaw('lower(name) like ?', [`%${search.toLowerCase().replace(/[%_]/g, '')}%`])
            .orderBy('name')
            .limit(50)
            .select('id', 'name');

        return rows.map((row): [string, string] => [String(row.id), row.name]);
    })
    .getOptionLabelUsing(async (value) => (await knex('customers').where({ id: value }).first())?.name ?? null)
```

`getSearchResultsUsing()` makes the field searchable. Limit the number of results, as the example does.

<Aside variant="danger">
`getOptionLabelUsing()` is also the validation of the field: a value is accepted only if the function returns a label for it. Return `null` for any value the user may not select, for example a customer of another tenant.
</Aside>

## Multi-select

The `multiple()` method allows you to select several values. The state of the field is then a list of strings:

```ts
import { Select } from '@navette-js/forms';

Select.make('technologies')
    .multiple()
    .options({
        tailwind: 'Tailwind CSS',
        alpine: 'Alpine.js',
        laravel: 'Laravel',
        livewire: 'Laravel Livewire',
    })
```

The saved value is a list, without duplicates. If you store it in a column, declare the column as JSON in your model.

With server-side search, define `getOptionLabelsUsing()`, which returns the labels of several values at once. Like `getOptionLabelUsing()`, it also validates the selected values:

```ts
import { Select } from '@navette-js/forms';

Select.make('tags')
    .multiple()
    .getSearchResultsUsing(async (search) => searchTags(search))
    .getOptionLabelsUsing(async (values) => {
        const rows = await knex('tags').whereIn('id', values).select('id', 'name');

        return rows.map((row): [string, string] => [String(row.id), row.name]);
    })
```

## Creating a new option in a modal

You may define a form that creates a new option in a modal. A "+" button is displayed next to the select. Use `createOptionForm()` for the modal's fields, and `createOptionUsing()` to save the option and return its value:

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('author_id')
    .label('Author')
    .options(async () => listAuthors())
    .createOptionForm([
        TextInput.make('name').required(),
        TextInput.make('email').required().email(),
    ])
    .createOptionUsing(async (data) => {
        const [id] = await knex('authors').insert({ name: data.name, email: data.email });

        return id;
    })
```

```preview
// state: {"author_id": "1"}
Select.make('author_id')
    .label('Author')
    .options(async () => [['1', 'Ada Lovelace'], ['2', 'Grace Hopper']])
    .createOptionForm([
        TextInput.make('name').required(),
        TextInput.make('email').required().email(),
    ])
    .createOptionUsing(async () => '3')
```

The modal's form is validated on the server before `createOptionUsing()` is called. The returned value becomes the state of the select; in a multi-select, it is added to the selection, and the modal offers a "Create & create another" button.

The options must come from a function (or from server-side search) so that the new option is listed when the form is re-rendered.

### Customizing new option creation

You may change the modal heading with `createOptionModalHeading()`, and customize the action itself (label, icon, modal width…) with `createOptionAction()`:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .createOptionModalHeading('New author')
    .createOptionAction((action) => action.modalWidth('lg'))
```

## Editing the selected option in a modal

You may define a form that edits the selected option in a modal. An edit button is displayed next to the select once an option is chosen. Fill the modal with `fillEditOptionActionFormUsing()`, which receives the field context (the selected value is `state`), and save the changes with `updateOptionUsing()`:

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('author_id')
    .options(async () => listAuthors())
    .editOptionForm([
        TextInput.make('name').required(),
    ])
    .fillEditOptionActionFormUsing(async ({ state }) => knex('authors').where({ id: state }).first('name'))
    .updateOptionUsing(async (data, { state }) => {
        await knex('authors').where({ id: state }).update({ name: data.name });
    })
```

```preview
// state: {"author_id": "1"}
Select.make('author_id')
    .options(async () => [['1', 'Ada Lovelace'], ['2', 'Grace Hopper']])
    .editOptionForm([
        TextInput.make('name').required(),
    ])
    .updateOptionUsing(async () => {})
```

Editing is only available on single selects. `editOptionForm()` makes the field `live()`, so the button appears as soon as an option is chosen. You may customize the modal with `editOptionModalHeading()` and `editOptionAction()`.

If the creation and edit forms are the same, you may define both at once with `manageOptionForm()`.

### Authorizing option actions

The create and edit buttons are hidden when the field is disabled. Navette does not check any other permission for you.

<Aside variant="danger">
`createOptionUsing()` and `updateOptionUsing()` run with the data submitted by the user. Check in these functions that the current user may create the option, and may edit the selected record: the selected value comes from the browser.
</Aside>

## Disable placeholder selection

You can prevent the placeholder (the empty option) from being selected in the native select using `selectablePlaceholder(false)`:

```ts
import { Select } from '@navette-js/forms';

Select.make('status')
    .options({ draft: 'Draft', published: 'Published' })
    .default('draft')
    .selectablePlaceholder(false)
```

```preview
// state: {"status": "draft"}
Select.make('status')
    .options({ draft: 'Draft', published: 'Published' })
    .default('draft')
    .selectablePlaceholder(false)
```

## Disabling specific options

You can disable specific options in the JavaScript select using `disableOptionWhen()`. It receives the value of each option and the field context:

```ts
import { Select } from '@navette-js/forms';

Select.make('status')
    .options({ draft: 'Draft', reviewing: 'Reviewing', published: 'Published' })
    .searchable()
    .disableOptionWhen((value) => value === 'published')
```

A disabled option cannot be picked in the browser, but it still passes validation. If the user must not submit it, also add a [custom rule](/forms/validation#custom-rules). This example, inside a [repeater](/forms/repeater), prevents the same product from being chosen twice:

```ts
import { Select } from '@navette-js/forms';

const chosenProducts = (livewire: any): string[] =>
    Object.values(livewire.data?.items ?? {}).map((item: any) => String(item?.product_id ?? '')).filter(Boolean);

Select.make('product_id')
    .options(async () => listProducts(), { searchOnServer: false })
    .searchable()
    .live()
    .disableOptionWhen((value, { state, livewire }) => value !== String(state ?? '') && chosenProducts(livewire).includes(value))
    .rule({
        name: 'distinct',
        passes: (value, { livewire }) => chosenProducts(livewire).filter((id) => id === String(value)).length <= 1,
        message: (attribute) => `The ${attribute} field has a duplicate value.`,
    })
```

## Select validation

As well as all rules listed on the [validation](/forms/validation) page, the select always checks that the submitted value is valid:

- With options, the value (or each value of a multi-select) must be one of the options, computed with the current form data.
- With server-side search, `getOptionLabelUsing()` (or `getOptionLabelsUsing()`) must return a label for it.

The error message is "The selected author is invalid.".

<Aside variant="warning">
Grouped options, HTML option labels, boolean options, `maxItems()`, affixes and selecting options from a table in a modal are not available yet.
</Aside>
