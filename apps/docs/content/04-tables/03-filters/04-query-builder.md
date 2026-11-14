---
title: Query builder
---

## Introduction

The query builder allows you to define a complex set of conditions to filter the data in your table. Users add rules, which are combined with "and", and group rules with "or" blocks.

To use it, you need to define a set of "constraints": the attributes the user may filter, each with a type that determines its operators. You can add a query builder to any table using the `QueryBuilder` filter:

```ts
import {
    BooleanConstraint,
    DateConstraint,
    IsRelatedToOperator,
    NumberConstraint,
    QueryBuilder,
    RelationshipConstraint,
    SelectConstraint,
    TextConstraint,
} from '@navette-js/tables';

QueryBuilder.make()
    .constraints([
        TextConstraint.make('name'),
        BooleanConstraint.make('is_visible'),
        NumberConstraint.make('stock'),
        SelectConstraint.make('status')
            .options({
                draft: 'Draft',
                reviewing: 'Reviewing',
                published: 'Published',
            })
            .multiple(),
        DateConstraint.make('created_at'),
        RelationshipConstraint.make('categories')
            .multiple()
            .selectable(
                IsRelatedToOperator.make()
                    .titleAttribute('name')
                    .multiple(),
            ),
    ])
```

The query builder takes the full width of the filters form. When rules are nested, it needs more space than the dropdown offers: [position the filters above the table content](/tables/filters/layout#displaying-filters-above-the-table-content):

```ts
import { QueryBuilder, type Table } from '@navette-js/tables';

static table(table: Table<Product>): Table<Product> {
    return table
        .filters([
            QueryBuilder.make()
                .constraints([
                    // ...
                ]),
        ], { layout: 'above-content-collapsible' });
}
```

Each rule that has an effect is displayed as an [indicator](/tables/filters/overview#active-filter-indicators) above the table, such as "Price is minimum 100", and the user can remove it from there. A rule that is incomplete, such as "Contains" without text, has no effect.

<Aside variant="info">
A table can have one query builder. Constraint names must be unique, and may only contain letters, digits, underscores and hyphens (up to 64 characters).
</Aside>

## Available constraints

Navette ships with these constraints:

- [Text constraint](#text-constraints)
- [Boolean constraint](#boolean-constraints)
- [Number constraint](#number-constraints)
- [Date constraint](#date-constraints)
- [Select constraint](#select-constraints)
- [Relationship constraint](#relationship-constraints)

Every constraint except the relationship constraint can also [filter an attribute of a related record](#filtering-an-attribute-of-related-records).

### Text constraints

Text constraints allow you to filter text fields. They can be used to filter any text field, including via relationships.

```ts
import { TextConstraint } from '@navette-js/tables';

TextConstraint.make('name') // Filter the `name` column

TextConstraint.make('creator.name') // Filter the `name` column on the `creator` relationship using dot syntax
```

By default, the following operators are available:

- Contains - filters a column to contain the search term
- Does not contain - filters a column to not contain the search term
- Starts with - filters a column to start with the search term
- Does not start with - filters a column to not start with the search term
- Ends with - filters a column to end with the search term
- Does not end with - filters a column to not end with the search term
- Equals - filters a column to equal the search term
- Does not equal - filters a column to not equal the search term

Text entered into these operators is treated as literal text, so characters such as `%` and `_` do not act as SQL wildcard characters. On PostgreSQL, "contains", "starts with" and "ends with" ignore case, as they do with SQLite and MySQL's default collations.

### Boolean constraints

Boolean constraints allow you to filter boolean fields. They can be used to filter any boolean field, including via relationships.

```ts
import { BooleanConstraint } from '@navette-js/tables';

BooleanConstraint.make('is_visible') // Filter the `is_visible` column

BooleanConstraint.make('creator.is_admin') // Filter the `is_admin` column on the `creator` relationship using dot syntax
```

By default, the following operators are available:

- Is true - filters a column to be true (`1`, or `true` on PostgreSQL)
- Is false - filters a column to be false (`0`, or `false` on PostgreSQL)

### Number constraints

Number constraints allow you to filter numeric fields. They can be used to filter any numeric field, including via relationships.

```ts
import { NumberConstraint } from '@navette-js/tables';

NumberConstraint.make('stock') // Filter the `stock` column

NumberConstraint.make('orders.item_count') // Filter the `item_count` column on the `orders` relationship using dot syntax
```

By default, the following operators are available:

- Is minimum - filters a column to be greater than or equal to the search number
- Is less than - filters a column to be less than the search number
- Is maximum - filters a column to be less than or equal to the search number
- Is greater than - filters a column to be greater than the search number
- Equals - filters a column to equal the search number
- Does not equal - filters a column to not equal the search number

Number constraints accept decimal values. To accept whole numbers only, use `integer()`: the field only allows integers, and a rule with a decimal value has no effect:

```ts
import { NumberConstraint } from '@navette-js/tables';

NumberConstraint.make('stock')
    .integer()
```

### Aggregating related records

When using a relationship column with a number constraint, users also have the ability to "aggregate" related records: an "Aggregate" field lets them filter the column to be the sum, average, minimum or maximum of all the related records at once, instead of each value:

```ts
import { NumberConstraint } from '@navette-js/tables';

NumberConstraint.make('orders.total')
```

With "Sum" and "Is minimum" 1000, the rule keeps the customers whose orders total at least 1,000. Without an aggregate, it keeps those with at least one order of 1,000 or more.

### Date constraints

Date constraints allow you to filter date fields. They can be used to filter any date field, including via relationships.

```ts
import { DateConstraint } from '@navette-js/tables';

DateConstraint.make('created_at') // Filter the `created_at` column

DateConstraint.make('creator.created_at') // Filter the `created_at` column on the `creator` relationship using dot syntax
```

By default, the following operators are available:

- Is after - filters a column to be after the search date, or the same date
- Is not after - filters a column to be before the search date
- Is before - filters a column to be before the search date, or the same date
- Is not before - filters a column to be after the search date
- Is date - filters a column to be the same date as the search date
- Is not date - filters a column to not be the same date as the search date
- Is month - filters a column to be in the same month as the selected month
- Is not month - filters a column to not be in the same month as the selected month
- Is year - filters a column to be in the same year as the searched year
- Is not year - filters a column to not be in the same year as the searched year

The "after" and "before" operators compare the column with a specific date, or with a rolling window: a preset such as "Past month", "This quarter" or "Next 2 weeks", or a custom number of days, weeks, months, quarters or years in the past or the future. Rolling windows are computed when the table is displayed, in UTC.

#### Datetime constraints

By default, date constraints only filter by date. If you have a datetime column and want to enable time-based filtering, you can use the `time()` method:

```ts
import { DateConstraint } from '@navette-js/tables';

DateConstraint.make('published_at')
    .time()
```

The "after" and "before" operators then use a date and time picker, and rolling windows can also be counted in seconds, minutes or hours, with presets such as "Past hour".

### Select constraints

Select constraints allow you to filter fields using a select field:

```ts
import { SelectConstraint } from '@navette-js/tables';

SelectConstraint.make('status') // Filter the `status` column
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

The constraint offers the "Is" and "Is not" operators. Values that are not among the options are ignored, whatever the browser sends.

<Aside variant="danger">
`options()` controls the available filter values, but it does not restrict access to records. Users can remove the rule, and rules that fail validation are ignored. If you are using `options()` to hide certain values from a group of users, apply the mandatory restriction to the table's data adapter instead, for example with the `modify` option of `ObjectionAdapter`.
</Aside>

#### Searchable select constraints

By default, select constraints will not allow the user to search the options. If you'd like to allow the user to search the options, you can use the `searchable()` method:

```ts
import { SelectConstraint } from '@navette-js/tables';

SelectConstraint.make('status')
    .searchable()
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

`native(false)` uses the JavaScript select without search, and `optionsLimit()` changes how many options it lists at once (50 by default).

#### Searching select options on the server

For a long list, `getSearchResultsUsing()` computes the options of each search on the server. Give the labels of the picked values with `getOptionLabelUsing()` (or `getOptionLabelsUsing()` for several values at once): they are used by the select and by the filter indicator:

```ts
import { SelectConstraint } from '@navette-js/tables';

SelectConstraint.make('customer_id')
    .label('Customer')
    .getSearchResultsUsing(async (search) => Object.fromEntries(
        (await Customer.query().where('name', 'like', `%${search}%`).limit(50)).map((customer) => [customer.id, customer.name]),
    ))
    .getOptionLabelUsing(async (value) => (await Customer.query().findById(value))?.name ?? null)
```

Without fixed options, the picked values cannot be checked against a list: any string (of at most 255 characters) reaches the query, as a bound parameter, so an unknown value matches no record.

#### Multi-select constraints

By default, select constraints will only allow the user to select a single option. If you'd like to allow the user to select multiple options, you can use the `multiple()` method:

```ts
import { SelectConstraint } from '@navette-js/tables';

SelectConstraint.make('status')
    .multiple()
    .options({
        draft: 'Draft',
        reviewing: 'Reviewing',
        published: 'Published',
    })
```

When the user selects multiple options, the table will be filtered to show records that match any of the selected options. Up to 100 values are kept.

### Relationship constraints

Relationship constraints allow you to filter records using data about a relationship. They require a table whose data adapter is an `ObjectionAdapter`, and a relationship declared in the model's `relationMappings`:

```ts
import { Model } from '@navette-js/database';

export class Post extends Model {
    static tableName = 'posts';

    static get relationMappings() {
        return {
            creator: { relation: Model.BelongsToOneRelation, modelClass: User, join: { from: 'posts.creator_id', to: 'users.id' } },
            tags: { relation: Model.ManyToManyRelation, modelClass: Tag, join: { from: 'posts.id', through: { from: 'post_tag.post_id', to: 'post_tag.tag_id' }, to: 'tags.id' } },
        };
    }
}
```

The name of the constraint is the name of the relationship:

```ts
import { IsRelatedToOperator, RelationshipConstraint } from '@navette-js/tables';

RelationshipConstraint.make('creator') // Filter the `creator` relationship
    .selectable(
        IsRelatedToOperator.make()
            .titleAttribute('name'),
    )
```

The `IsRelatedToOperator` is used to configure the "Is" and "Is not" operators (or "Contains" and "Does not contain" for a [multiple relationship](#multiple-relationships)). It provides a select field which allows the user to filter the relationship by which records are attached to it. The `titleAttribute()` method is used to specify which attribute should be used to identify each related record in the list; the related records are listed in its order, up to 1,000. The `searchable()` method makes the list searchable: the related records are then searched on the server (at most `optionsLimit()` of them, 50 by default) instead of being listed, unless `preload()` is also called. `getOptionLabelFromRecordUsing()` computes the label of each related record from the record itself. The `multiple()` method allows the user to select multiple related records: the table is then filtered to show records that match any of them.

```ts
import { IsRelatedToOperator, RelationshipConstraint } from '@navette-js/tables';

RelationshipConstraint.make('author')
    .selectable(
        IsRelatedToOperator.make()
            .titleAttribute('last_name')
            .searchable()
            .getOptionLabelFromRecordUsing((author) => `${author.first_name} ${author.last_name}`),
    )
```

Navette finds the model of the table through the data adapter of the list page. If the constraint is used elsewhere, pass the model to the query builder with `model()`:

```ts
import { QueryBuilder } from '@navette-js/tables';

QueryBuilder.make()
    .model(Post)
    .constraints([
        // ...
    ])
```

#### Multiple relationships

By default, relationship constraints only include operators that are appropriate for filtering a singular relationship, like a `BelongsToOneRelation`. If you have a relationship such as a `HasManyRelation` or `ManyToManyRelation`, you may wish to mark the constraint as `multiple()`:

```ts
import { RelationshipConstraint } from '@navette-js/tables';

RelationshipConstraint.make('tags')
    .multiple()
```

This will add the following operators to the constraint:

- Has minimum - filters a column to have at least the specified number of related records
- Has less than - filters a column to have less than the specified number of related records
- Has maximum - filters a column to have at most the specified number of related records
- Has more than - filters a column to have more than the specified number of related records
- Has - filters a column to have the specified number of related records
- Does not have - filters a column to not have the specified number of related records

#### Empty relationship constraints

The `RelationshipConstraint` does not support [`nullable()`](#nullable-constraints) in the same way as other constraints.

If the relationship is `multiple()`, then the constraint will show an option to filter out "empty" relationships. This means that the relationship has no related records. If your relationship is singular, then you can use the `emptyable()` method to show an option to filter out "empty" relationships:

```ts
import { RelationshipConstraint } from '@navette-js/tables';

RelationshipConstraint.make('creator')
    .emptyable()
```

If you have a `multiple()` relationship that must always have at least 1 related record, then you can use the `emptyable(false)` method to hide the option to filter out "empty" relationships:

```ts
import { RelationshipConstraint } from '@navette-js/tables';

RelationshipConstraint.make('categories')
    .multiple()
    .emptyable(false)
```

### Filtering an attribute of related records

The dot syntax (`creator.name`) filters the attribute after the last dot on the relationship before it: the rule matches the records that have at least one related record satisfying it (Laravel's `whereHas()`). Nested relationships are walked one after the other: `TextConstraint.make('author.country.name')`. The relationships must be declared in the model's `relationMappings`. The default label is the part of the name before the first dot ("Creator"); use `label()` to change it.

When the name of the constraint should differ from the attribute, call `relationship()` with the name of the relationship and the attribute to filter:

```ts
import { TextConstraint } from '@navette-js/tables';

TextConstraint.make('creatorName')
    .label('Creator name')
    .relationship('creator', 'name')
```

The [aggregates](#aggregating-related-records) of number constraints, and [relationship constraints](#relationship-constraints), apply to a direct relationship of the table's model.

### Nullable constraints

By default, constraints will not show an option to filter `null` values. If you'd like to show an option to filter `null` values, you can use the `nullable()` method:

```ts
import { TextConstraint } from '@navette-js/tables';

TextConstraint.make('name')
    .nullable()
```

Now, the following operators are also available:

- Is filled - filters a column to not be empty
- Is blank - filters a column to be empty

A value is considered empty when it is `null` or an empty string.

## Filtering a different column

By default, a constraint filters the column of the query that has its name. To filter another column, or a computed column of the query, use the `attribute()` method (to filter an attribute of related records, use the [dot syntax](#filtering-an-attribute-of-related-records)):

```ts
import { TextConstraint } from '@navette-js/tables';

TextConstraint.make('brand')
    .attribute('brand_name')
```

<Aside variant="info">
Filtering a select alias in the `WHERE` clause works with SQLite, but not with databases such as PostgreSQL and MySQL. With them, filter a real column, or use [`relationship()`](#filtering-an-attribute-of-related-records).
</Aside>

## Limiting the size of the rule tree

The set of rules a user builds is part of the page's state and is submitted with each request. To protect the server against an excessively large or deeply nested set of rules, Navette applies fixed limits:

- 100 rules at most in the whole tree ("or" blocks do not count);
- 3 levels of nesting at most: an "or" block inside an "or" block inside the root;
- 20 groups at most in an "or" block;
- 100 values at most in a multi-select.

The UI enforces these limits: the "add rule" and clone buttons are disabled once the maximum number of rules is reached, and the "or" block is not offered at the maximum depth. A submitted tree is cut down to these limits before it is used.

You may lower the number of rules and the nesting depth with `maxRules()` and `maxNestingDepth()`. A depth of 1 removes "or" blocks. Values above the fixed limits are reduced to them:

```ts
import { QueryBuilder } from '@navette-js/tables';

QueryBuilder.make()
    .maxRules(10)
    .maxNestingDepth(2)
    .constraints([
        // ...
    ])
```

## Scoping relationships

When you use a relationship constraint, or a constraint on an attribute of related records, you can scope the relationship to filter the related records using the `modifyRelationshipQueryUsing()` method. It receives the Objection query of the related records:

```ts
import { TextConstraint } from '@navette-js/tables';

TextConstraint.make('adminCreatorName')
    .label('Admin creator name')
    .relationship('creator', 'name', (query) => query.where('is_admin', 1))
```

The third argument of `relationship()` is a shortcut for `modifyRelationshipQueryUsing()`.

The `IsRelatedToOperator` has its own `modifyRelationshipQueryUsing()` method, which scopes both the list of related records offered to the user and the filter:

```ts
import { IsRelatedToOperator, RelationshipConstraint } from '@navette-js/tables';

RelationshipConstraint.make('creator')
    .selectable(
        IsRelatedToOperator.make()
            .titleAttribute('name')
            .modifyRelationshipQueryUsing((query) => query.where('is_active', 1)),
    )
```

## Customizing the constraint icon

Each constraint type has a default [icon](/styling/icons), which is displayed next to the label in the picker. You can customize the icon for a constraint by passing its name to the `icon()` method:

```ts
import { NumberConstraint } from '@navette-js/tables';

NumberConstraint.make('price')
    .icon('m-currency-dollar')
```

## Customizing the constraint labels

The label of a constraint is generated from its name, and you may change it with `label()`. Rule summaries in the indicators use the label too; to use a different wording there, set `attributeLabel()`:

```ts
import { TextConstraint } from '@navette-js/tables';

TextConstraint.make('sku')
    .label('SKU (Stock Keeping Unit)')
    .attributeLabel('SKU')
```

## Customizing the constraint picker

### Changing the number of columns in the constraint picker

The constraint picker has only 1 column. You may customize it by passing a number of columns to `constraintPickerColumns()`:

```ts
import { QueryBuilder } from '@navette-js/tables';

QueryBuilder.make()
    .constraintPickerColumns(2)
    .constraints([
        // ...
    ])
```

The picker is made wider for 2 or 3 columns.

## Database support

The SQL for dates, months, years and text searches is written for SQLite, MySQL and MariaDB, PostgreSQL and SQL Server. Navette reads the client of the Knex connection to choose it. Columns are passed as identifiers and values as bound parameters; the operators come from a closed list.

## Overriding the default operators

Each constraint offers its default operators. To offer only some of them, pass the built-in operator classes to `operators()`; `pushOperators()` adds operators after the default ones, and `unshiftOperators()` before them (the first one becomes the default operator of a new rule):

```ts
import { ContainsOperator, IsFilledOperator, NumberConstraint, EqualsOperator, IsMinOperator, TextConstraint } from '@navette-js/tables';

TextConstraint.make('name')
    .operators([ContainsOperator.make(), IsFilledOperator.make()])

NumberConstraint.make('stock')
    .integer()
    .pushOperators([IsFilledOperator.make()]) // like nullable()

NumberConstraint.make('price')
    .unshiftOperators([EqualsOperator.make()]) // "equals" becomes the default operator
```

The built-in operators are `IsFilledOperator` (any constraint), `ContainsOperator`, `StartsWithOperator`, `EndsWithOperator` and `EqualsOperator` (text), `IsMinOperator`, `IsMaxOperator` and `EqualsOperator` (number), `IsTrueOperator` (boolean), `IsAfterOperator`, `IsBeforeOperator`, `IsDateOperator`, `IsMonthOperator` and `IsYearOperator` (date), `IsOperator` (select), and `IsRelatedToOperator`, `HasMinOperator`, `HasMaxOperator`, `EqualsOperator` and `IsEmptyOperator` (relationship). A single `EqualsOperator` adapts to its constraint: it compares text on a text constraint, numbers on a number constraint, and the number of related records on a relationship constraint. A built-in operator follows its constraint's options (`integer()`, `time()`, `multiple()`…), even when they are set after `operators()`. `IsOperator` needs a select constraint, and `IsRelatedToOperator` and `IsEmptyOperator` a relationship constraint.

## Custom operators

You may add your own operators to a constraint with `pushOperators()` (after the default ones) or `unshiftOperators()` (before them: the first one becomes the default operator of a new rule), or replace its operators with `operators()`. An operator given to `unshiftOperators()` with the name of an existing operator replaces it. An operator has a name, labels, an optional settings form, the condition it adds to the query, and the summary shown in the filter indicator:

```ts
import { TextInput } from '@navette-js/forms';
import { QueryBuilderOperator, TextConstraint } from '@navette-js/tables';

TextConstraint.make('email')
    .pushOperators([
        QueryBuilderOperator.make('hasDomain')
            .label('Has domain', 'Does not have domain')
            .schema([TextInput.make('domain').required()])
            .query((query, { settings, inverse }) => {
                // Only plain domain names: `%` and `_` would be wildcards in `like`.
                const domain = typeof settings.domain === 'string' && /^[a-z0-9.-]+$/i.test(settings.domain) ? settings.domain : null;
                if (domain === null) return;
                query.where('email', inverse ? 'not like' : 'like', `%@${domain}`);
            })
            .summary(({ attribute, settings, inverse }) => `${attribute} ${inverse ? 'is not' : 'is'} on ${settings.domain}`),
    ])
```

Each operator also exists in an inverse form ("Does not have domain"); `inverse` tells you which one the user picked. `settings` comes from the browser: only the names of the schema fields are kept, as scalars, but check their values and pass them as bound parameters.

## Custom constraints

`CustomConstraint` has no operators of its own: give it yours with `operators()`:

```ts
import { CustomConstraint, QueryBuilderOperator } from '@navette-js/tables';

CustomConstraint.make('popularity')
    .icon('m-fire')
    .operators([
        QueryBuilderOperator.make('isPopular')
            .label('Is popular', 'Is not popular')
            .query((query, { inverse }) => query.where('views', inverse ? '<' : '>=', 1000)),
    ])
```

## Grouping constraints in the picker

Pass an object of groups to group the constraints under labels in the constraint picker. It may be given alone, or among ungrouped constraints, which are listed first:

```ts
import { QueryBuilder, TextConstraint } from '@navette-js/tables';

QueryBuilder.make()
    .constraints([
        TextConstraint.make('title'),
        { People: [TextConstraint.make('author'), TextConstraint.make('editor')] },
    ])
```

`pickerGroup()` sets the group of one constraint:

```ts
TextConstraint.make('slug').pickerGroup('Content')
```

With the object form alone:

```ts
import { DateConstraint, NumberConstraint, QueryBuilder, TextConstraint } from '@navette-js/tables';

QueryBuilder.make()
    .constraints({
        Content: [
            TextConstraint.make('title'),
            TextConstraint.make('slug'),
        ],
        Statistics: [
            NumberConstraint.make('views'),
            DateConstraint.make('published_at'),
        ],
    })
```

## Changing the picker width

`constraintPickerWidth()` sets the width of the constraint picker: `'xs'` to `'7xl'`. By default, it is wider with 2 or 3 columns:

```ts
import { QueryBuilder } from '@navette-js/tables';

QueryBuilder.make()
    .constraintPickerColumns(3)
    .constraintPickerWidth('4xl')
```

## Global settings

`QueryBuilder.configureUsing()` applies options to every query builder created afterwards, and each constraint class has its own `configureUsing()`:

```ts
import { DateConstraint, QueryBuilder } from '@navette-js/tables';

QueryBuilder.configureUsing((filter) => filter.maxRules(20).constraintPickerColumns(2));
DateConstraint.configureUsing((constraint) => constraint.nullable());
```

Call them once, when the application starts. Options set on a filter or a constraint override them.
