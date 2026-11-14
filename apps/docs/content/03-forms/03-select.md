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

Options may also come from an [enum](/advanced/enums#using-an-enum-for-field-options): `Select.make('status').options(Status)` lists its values with their labels.

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

## Grouping options

You may group options under a label by passing an object of groups. The native select uses `<optgroup>` elements, and the JavaScript select shows group headings:

```ts
import { Select } from '@navette-js/forms';

Select.make('status')
    .searchable()
    .options({
        'In Process': {
            draft: 'Draft',
            reviewing: 'Reviewing',
        },
        Reviewed: {
            published: 'Published',
            rejected: 'Rejected',
        },
    })
```

## Boolean options

`boolean()` fills the options with "Yes" and "No", saved as `1` and `0`. You may change the labels, and the placeholder:

```ts
import { Select } from '@navette-js/forms';

Select.make('feedback')
    .label('Like this post?')
    .boolean('Yes, I like it', 'No, not really', 'Pick an answer')
```

## Integrating with a relationship

`relationship()` lists the records of a relationship of the form's model, an Objection model with `relationMappings` (the resource's data adapter model). The second argument is the column used as the option label:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
```

For a belongs-to relationship, the field is named after the foreign key, and saves it like any other field. The value must be one of the related records: a key forged by the browser is rejected.

### Many-to-many relationships

With `multiple()` and a many-to-many relationship, name the field after the relationship. The selected records are loaded when the form is filled, and the links are saved once the record is created or updated, on resource pages and in the `CreateAction` and `EditAction` modals. The field is not part of the saved data:

```ts
import { Select } from '@navette-js/forms';

Select.make('technologies')
    .multiple()
    .relationship('technologies', 'name')
```

### Searching relationship options

With `searchable()`, the related records are searched on the server, in the title column, and only matching records are sent to the browser. Call `preload()` to also load the options when the form opens:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
    .searchable()
    .preload()
```

To search several columns of the related table, pass them to `searchable()`. A record matches when any of the columns contains the search term:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
    .searchable(['name', 'email'])
```

Only plain column names (`email`, or `authors.email`) are used in the query; anything else is ignored.

### Customizing the relationship option labels

If you'd like to customize the label of each option, maybe to be more descriptive, or to concatenate a first and last name, you could use a virtual column in your database migration, or use `getOptionLabelFromRecordUsing()`, which receives the whole related record:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'first_name')
    .getOptionLabelFromRecordUsing((record) => `${record.first_name} ${record.last_name}`)
    .searchable(['first_name', 'last_name'])
```

The title column (the second argument of `relationship()`) is still searched by default, so with a computed label, list the searched columns in `searchable()`. The label is escaped, unless you [allow HTML](#allowing-html-in-the-option-labels).

### Ignoring the current record

When working with a relationship to the same model, such as a parent or manager of a record of the same table, you can prevent the record being edited from being offered as an option, with the `ignoreRecord` option:

```ts
import { Select } from '@navette-js/forms';

Select.make('parent_id')
    .relationship('parent', 'name', null, { ignoreRecord: true })
```

The record is left out of the options and of the search results, and is rejected if the browser sends its key. When there is no record yet (on a create page), every option is offered.

### Getting the selected record

`getSelectedRecord()` returns the related record of the selected option (single selection), loaded through the relationship's query, or `null`. It is useful in a function of another field, through the field context's `component`, or in an action of the field:

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
    .live()
    .afterStateUpdated(async ({ component, set }) => {
        const author = await (component as Select).getSelectedRecord();
        set('author_email', author?.email ?? null);
    })
```

Without a relationship, you may tell the select how to find the record of its state with `getSelectedRecordUsing()`, which receives the field context: `getSelectedRecordUsing(({ state }) => Author.query().findById(state))`.

### Saving pivot data to the relationship

If you're using a many-to-many relationship, you can use the `pivotData()` method to pass an object of data to be saved in the pivot table when a record is linked:

```ts
import { Select } from '@navette-js/forms';

Select.make('primary_technologies')
    .multiple()
    .relationship('technologies', 'name')
    .pivotData({
        is_primary: true,
    })
```

Objection only writes the pivot columns that the relation declares in `join.through.extra` (`extra: ['is_primary']`). `pivotData()` also accepts a function of the [field context](/forms/overview#using-the-field-context) returning the data, called when the links are saved.

### Customizing the relationship query

The third argument scopes the query. It receives the Objection query, and the search term when searching. Records outside this scope are neither listed nor accepted:

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name', (query) => query.where('is_active', true))
```

When the form has no model (a custom page, an action on another model), pass it with the fourth argument: `relationship('author', 'name', null, { model: Post })`.

### Creating related records

With a relationship, `createOptionForm()` works without `createOptionUsing()`: the related record is inserted with the modal's data, and selected:

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
    .createOptionForm([
        TextInput.make('name').required(),
        TextInput.make('email').email().required(),
    ])
```

### Saving other relationships

For other relationships, any field can load and save its state itself with `loadStateFromRelationshipsUsing()` and `saveRelationshipsUsing()`. The second callback runs after the record is saved; such a field is not part of the saved data:

```ts
import { Select } from '@navette-js/forms';

Select.make('category_ids')
    .multiple()
    .options(async () => listCategories())
    .loadStateFromRelationshipsUsing(async (record) => (await knex('product_category').where('product_id', record.id)).map((row) => String(row.category_id)))
    .saveRelationshipsUsing(async ({ record, state }) => {
        await knex('product_category').where('product_id', record.id).delete();
        await knex('product_category').insert((state as string[]).map((id) => ({ product_id: record.id, category_id: id })));
    })
```

## Enabling the JavaScript select

By default, Navette uses the native HTML select. You may enable the JavaScript select, which offers search, by calling `searchable()`. A [multi-select](#multi-select) always uses the JavaScript select.

## Using the JavaScript select without search

`native(false)` uses the JavaScript select without enabling search:

```ts
import { Select } from '@navette-js/forms';

Select.make('status')
    .native(false)
    .options({ draft: 'Draft', published: 'Published' })
```

## Allowing HTML in the option labels

`allowHtml()` displays the option labels as HTML in the JavaScript select. Labels are sanitized on the server with an allow-list (formatting, links and images; no scripts, styles or event handlers):

```ts
import { Select } from '@navette-js/forms';

Select.make('technology')
    .options({
        tailwind: '<span class="text-blue-500">Tailwind</span>',
        alpine: '<span class="text-green-500">Alpine</span>',
    })
    .searchable()
    .allowHtml()
```

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

### Limiting the number of selected items

`maxItems()` limits how many items a multi-select can have (the JavaScript select stops adding items, and the server rejects more), and `minItems()` requires a minimum:

```ts
import { Select } from '@navette-js/forms';

Select.make('technologies')
    .multiple()
    .options({ tailwind: 'Tailwind CSS', alpine: 'Alpine.js', laravel: 'Laravel' })
    .maxItems(2)
```

### Reordering selected options

The `reorderable()` method allows the user to reorder the selected options of a multi-select, by dragging them. The state keeps the order of the options:

```ts
import { Select } from '@navette-js/forms';

Select.make('technologies')
    .multiple()
    .options({ tailwind: 'Tailwind CSS', alpine: 'Alpine.js', laravel: 'Laravel' })
    .reorderable()
```

A many-to-many relationship saves its links, not their order: to keep the order, save it yourself with `saveRelationshipsUsing()`.

## Preventing option labels from wrapping

By default, long option labels wrap onto several lines in the JavaScript select. `wrapOptionLabels(false)` keeps each label on one line, truncated:

```ts
import { Select } from '@navette-js/forms';

Select.make('product_id')
    .native(false)
    .options(async () => listProducts())
    .wrapOptionLabels(false)
```

## Customizing the select messages

```ts
import { Select } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
    .searchable()
    .searchPrompt('Search authors by name')
    .searchingMessage('Searching authors...')
    .noSearchResultsMessage('No authors found.')
    .loadingMessage('Loading authors...')
    .noOptionsMessage('No authors yet.')
    .optionsLimit(20)
    .searchDebounce(500)
```

`noOptionsMessage()` is shown when the JavaScript select has no options at all, before any search.

`optionsLimit()` sets how many options the JavaScript select shows at once (50 by default), and `searchDebounce()` the delay before a server search, in milliseconds (1000 by default).

## Adding affix text and icons

Like the [text input](/forms/text-input#adding-affix-text-aside-the-field), the select may have a prefix and a suffix: text, icons (with a color) and actions:

```ts
import { Select } from '@navette-js/forms';

Select.make('domain')
    .options({ com: 'example.com', org: 'example.org' })
    .prefix('https://')
    .suffixIcon('m-globe-alt')
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

With a [relationship](#integrating-with-a-relationship), `fillEditOptionActionFormUsing()` and `updateOptionUsing()` are optional: the modal is filled with the [selected record](#getting-the-selected-record), and the record is updated with the validated modal data. Only a record allowed by the relationship's query can be edited.

Editing is only available on single selects. `editOptionForm()` makes the field `live()`, so the button appears as soon as an option is chosen. You may customize the modal with `editOptionModalHeading()` and `editOptionAction()`.

If the creation and edit forms are the same, you may define both at once with `manageOptionForm()`.

To customize the create and edit actions together, use `manageOptionActions()`. It runs before `createOptionAction()` and `editOptionAction()`, which may still change each action on its own:

```ts
import { Select, TextInput } from '@navette-js/forms';

Select.make('author_id')
    .relationship('author', 'name')
    .manageOptionForm([TextInput.make('name').required()])
    .manageOptionActions((action) => action.modalWidth('lg').slideOver())
```

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

## Selecting options from a table in a modal

`ModalTableSelect` opens a [table](/tables/overview) in a slide-over, where the user searches, filters, sorts and pages through the records, then checks the one to select. It suits a [relationship](#integrating-with-a-relationship) with many records. The field shows the label of the selected record and a "Select" button.

The table is described by a table configuration: a class with a static `configure()` method that receives the table and returns it:

```ts
import { SelectFilter, TextColumn, type Table } from '@navette-js/tables';

export class CategoriesTable {
    static configure(table: Table): Table {
        return table
            .columns([
                TextColumn.make('name').searchable().sortable(),
                TextColumn.make('slug').searchable(),
            ])
            .filters([
                SelectFilter.make('parent').relationship('parent', 'name'),
            ]);
    }
}
```

Pass the class to `tableConfiguration()`. With `relationship()`, the table lists the related records, and the second argument is the column shown as the label of the selected record:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('category_id')
    .relationship('category', 'name')
    .tableConfiguration(CategoriesTable)
```

You can also use `multiple()` with a many-to-many relationship. Name the field after the relationship: the links are saved once the record is saved, like a [many-to-many select](#many-to-many-relationships). `maxItems()` and `minItems()` limit the number of selected records:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('categories')
    .relationship('categories', 'name')
    .multiple()
    .maxItems(5)
    .tableConfiguration(CategoriesTable)
```

The table's records come from the related model. A configuration may provide its own data adapter instead, in a static `adapter` property: the field then needs no relationship. A resource class is a valid configuration too: its `table()` method sets the table up, and its adapter, scoped to the current tenant, provides the records:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('category_id')
    .tableConfiguration(CategoryResource)
    .getOptionLabelFromRecordUsing((record) => record.name)
```

`tableConfiguration()` also accepts a function returning the configuration.

<Aside variant="info">
The table is a child component of the page, which finds its configuration again on each of its requests: the configuration is registered when the form is built. After a restart of the server, a table left open asks the user to reload the page.
</Aside>

### Customizing the modal table select actions

Passing a function to `selectAction()` customizes the "Select" action, for example its label, the modal heading and the submit button label:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('category_id')
    .relationship('category', 'name')
    .tableConfiguration(CategoriesTable)
    .selectAction((action) => action
        .label('Select a category')
        .modalHeading('Search categories')
        .modalSubmitActionLabel('Confirm selection'))
```

`tableSelect()` customizes the `TableSelect` field shown in the modal in the same way.

### Customizing the option labels in the modal table select

`getOptionLabelFromRecordUsing()` builds the label of each selected record, for example from two columns:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('category_id')
    .relationship('category', 'name')
    .tableConfiguration(CategoriesTable)
    .getOptionLabelFromRecordUsing((record) => `${record.name} (${record.slug})`)
```

`getOptionLabelUsing()` (for one value) and `getOptionLabelsUsing()` (for the values of `multiple()`) compute the labels without reading the records. Without any of these, the key itself is shown.

By default, the labels of `multiple()` are shown as badges, and a single label as plain text. `badge()` changes this, and `badgeColor()` sets the badge color. `placeholder()` sets the text shown when nothing is selected:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('category_id')
    .relationship('category', 'name')
    .tableConfiguration(CategoriesTable)
    .badge()
    .placeholder('No category')

ModalTableSelect.make('categories')
    .relationship('categories', 'name')
    .multiple()
    .tableConfiguration(CategoriesTable)
    .badgeColor('success')
```

### Passing additional arguments to the table in a modal select

`tableArguments()` passes values from the form to the table configuration, for example to narrow the table's query with fields filled earlier. The function receives the field context, with `get()` to read other fields. The values must be plain JSON data:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('products')
    .relationship('products', 'name')
    .multiple()
    .tableConfiguration(ProductsTable)
    .tableArguments(({ get }) => ({
        category_id: get('category_id'),
        budget_limit: get('budget'),
    }))
```

The configuration reads them with `table.getArguments()`, and narrows the query with `modifyQueryUsing()`, which receives the Objection query:

```ts
import { TextColumn, type Table } from '@navette-js/tables';

export class ProductsTable {
    static configure(table: Table): Table {
        const { category_id, budget_limit } = table.getArguments();
        return table
            .modifyQueryUsing((query) => {
                if (category_id) query.where('category_id', category_id);
                if (budget_limit) query.where('price', '<=', budget_limit);
            })
            .columns([
                TextColumn.make('name'),
                TextColumn.make('price').money('usd'),
            ]);
    }
}
```

### Validating the records selected in the table

The keys sent by the browser are checked on the server when the modal is submitted, and again when the form is validated and saved: each key must be a record that the table itself can show and select. That is a record within the data adapter's scope (including the tenant), within the relationship's query (the third argument of `relationship()`), within the table's `modifyQueryUsing()` query, computed with the current arguments, and accepted by the table's `checkIfRecordIsSelectableUsing()`. Any other key, forged or no longer allowed, is rejected with "The selected category is invalid.". The filters and the search chosen in the table only narrow what is displayed.

To restrict which records may be selected, restrict one of these queries:

```ts
import { ModalTableSelect } from '@navette-js/forms';

ModalTableSelect.make('category_id')
    .relationship('category', 'name', (query) => query.where('is_visible', true))
    .tableConfiguration(CategoriesTable)
```

### Selecting options from a table in the form

`TableSelect` shows the same table directly in the form, with a checkbox on each row. It takes the same `tableConfiguration()`, `tableArguments()`, `multiple()`, `maxItems()` and `minItems()` methods, and `relationship()` with the relationship name and an optional query function:

```ts
import { TableSelect } from '@navette-js/forms';

TableSelect.make('categories')
    .relationship('categories')
    .multiple()
    .tableConfiguration(CategoriesTable)
```

The selection is kept while the user searches, filters or changes page. The table shows no actions: the header, row, bulk and empty state actions of the configuration are left out.

## Select validation

As well as all rules listed on the [validation](/forms/validation) page, the select always checks that the submitted value is valid:

- With options, the value (or each value of a multi-select) must be one of the options, computed with the current form data.
- With server-side search, `getOptionLabelUsing()` (or `getOptionLabelsUsing()`) must return a label for it.

The error message is "The selected author is invalid.".

- With a relationship, the value must be a record of the relationship's query.
- With `maxItems()` or `minItems()`, the number of selected items is checked.

The records selected in a table are checked against the table's query: see [validating the records selected in the table](#validating-the-records-selected-in-the-table).

