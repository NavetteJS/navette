---
title: Wizards
---

## Introduction

Similar to [tabs](/schemas/tabs), you may want to use a multistep wizard to reduce the number of components that are visible at once. These are especially useful if your form has a definite chronological order, in which you want each step to be validated as the user progresses.

In Navette, `Wizard` and `Step` are exported by `@navette-js/forms`, since a wizard validates form fields:

```ts
import { Step, Wizard } from '@navette-js/forms';

Wizard.make([
    Step.make('Order')
        .schema([
            // ...
        ]),
    Step.make('Delivery')
        .schema([
            // ...
        ]),
    Step.make('Billing')
        .schema([
            // ...
        ]),
])
```

```preview
// state: {"number": "OR-1024", "currency": "eur"}
Wizard.make([
    Step.make('Order').schema([
        TextInput.make('number').required(),
        Select.make('currency').options([['eur', 'Euro'], ['usd', 'US dollar']]),
    ]),
    Step.make('Delivery').schema([
        TextInput.make('address'),
    ]),
    Step.make('Billing').schema([
        TextInput.make('vat_number').label('VAT number'),
    ]),
])
```

All steps are rendered with the page, and the browser only shows the current one. When the user clicks "Next", the fields of the current step are validated on the server, and the wizard only moves to the next step if they are valid.

## Using a wizard on a resource's create page

The most common use of a wizard is the creation of a record. To do so, override the `getSteps()` method of the resource's create page. The steps replace the components of the resource's `form()` on that page, and the wizard renders "Back" and "Next" buttons, with the "Create" button on the last step:

```ts
import { DatePicker, Repeater, Select, Step, TextInput } from '@navette-js/forms';
import { CreateRecord, Resource } from '@navette-js/panels';

class CreateExpense extends CreateRecord {
    protected getSteps(): Step[] {
        return [
            Step.make('Details')
                .icon('s-information-circle')
                .columns(2)
                .schema([
                    TextInput.make('expense_number').required(),
                    Select.make('employee_id').label('Employee').options(employees).required(),
                ]),
            Step.make('Line Items')
                .icon('s-list-bullet')
                .schema([
                    Repeater.make('expenseLines').schema([
                        // ...
                    ]),
                ]),
            Step.make('Review')
                .icon('s-check-circle')
                .schema([
                    // ...
                ]),
        ];
    }
}

export class ExpenseResource extends Resource {
    static pages = { create: CreateExpense };

    // ...
}
```

The create page also lets you override `hasSkippableSteps()` to [allow steps to be skipped](#allowing-steps-to-be-skipped), and `getStartStep()` to [set the default active step](#setting-the-default-active-step).

<Aside variant="info">
The edit page of the resource still uses the components of `form()`, without steps.
</Aside>

## Rendering a submit button on the last step

You may use the `submitAction()` method to render an [action](/actions/overview) at the end of the wizard, on the last step, in place of the "Next" button. This provides a clearer UX than displaying a submit button below the wizard at all times:

```ts
import { Action } from '@navette-js/actions';
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
])
    .submitAction(Action.make('order').label('Place order').action('placeOrder'))
```

In this example, `placeOrder` is a method of the page, which must be listed in its `static callable` array. You may also render an action in place of the "Back" button on the first step, using the `cancelAction()` method.

To let the user press Enter to move through the wizard, pass an Alpine expression to `alpineSubmitHandler()`, such as `alpineSubmitHandler('$wire.placeOrder()')`. Each step then becomes a `<form>`: Enter moves to the next step, and runs the expression on the last step.

## Setting a step icon

Steps may have an icon, which you can set using the `icon()` method. Icons are [Heroicons](/schemas/primes#icon-component) names. Without an icon, the step displays its number:

```ts
import { Step } from '@navette-js/forms';

Step.make('Order')
    .icon('o-shopping-bag')
    .schema([
        // ...
    ])
```

## Customizing the icon for completed steps

You may customize the icon of a completed step using the `completedIcon()` method. By default, it is a check mark:

```ts
import { Step } from '@navette-js/forms';

Step.make('Order')
    .completedIcon('o-hand-thumb-up')
    .schema([
        // ...
    ])
```

## Adding descriptions to steps

You may add a short description after the title of each step using the `description()` method:

```ts
import { Step } from '@navette-js/forms';

Step.make('Order')
    .description('Review your basket')
    .schema([
        // ...
    ])
```

## Setting the default active step

You may use the `startOnStep()` method to load a specific step in the wizard. Steps are numbered from 1:

```ts
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
]).startOnStep(2)
```

## Allowing steps to be skipped

If you'd like to allow free navigation, so all steps are skippable, use the `skippable()` method:

```ts
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
]).skippable()
```

Optionally, the `skippable()` method accepts a boolean value to control if the steps are skippable or not.

When steps are skippable, "Next" does not validate the current step. Make sure that the whole form is validated again when it is finally submitted: the create page of a resource does so.

## Persisting the current step in the URL's query string

By default, the current step is not persisted in the URL's query string. You can change this behavior using the `persistStepInQueryString()` method:

```ts
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
]).persistStepInQueryString()
```

When enabled, the current step is persisted in the URL's query string using the `step` key. You can change this key by passing it to the `persistStepInQueryString()` method:

```ts
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
]).persistStepInQueryString('wizard-step')
```

## Step lifecycle hooks

You may use the `afterValidation()` and `beforeValidation()` methods to run code before and after validation occurs on the step. The functions receive the [context object](/schemas/overview#component-utility-injection) of the step, and may be `async`:

```ts
import { Step } from '@navette-js/forms';

Step.make('Order')
    .beforeValidation(({ get }) => {
        // ...
    })
    .afterValidation(async ({ get }) => {
        // ...
    })
    .schema([
        // ...
    ])
```

The hooks run on the server when the user clicks "Next". `afterValidation()` only runs when the step is valid. Neither hook runs when the wizard is [skippable](#allowing-steps-to-be-skipped).

### Preventing the next step from being loaded

Inside `afterValidation()` or `beforeValidation()`, you may throw `Halt`, which will prevent the wizard from loading the next step:

```ts
import { Halt, Step } from '@navette-js/forms';

Step.make('Order')
    .afterValidation(async ({ get }) => {
        if (!(await isInStock(get('product_id')))) {
            throw new Halt();
        }
    })
    .schema([
        // ...
    ])
```

## Using grid columns within a step

You may use the `columns()` method to customize the [grid](/schemas/layouts#grid-system) within the step. Without an argument, it creates 2 columns:

```ts
import { Step, Wizard } from '@navette-js/forms';

Wizard.make([
    Step.make('Order')
        .columns(2)
        .schema([
            // ...
        ]),
    // ...
])
```

## Customizing the wizard action objects

This component uses action objects for easy customization of buttons within it. You can customize these buttons by passing a function to an action registration method. The function receives the action object, which you can use to [customize it](/actions/overview), and returns it. The following methods are available to customize the actions:

- `nextAction()`
- `previousAction()`

Here is an example of how you might customize an action:

```ts
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
])
    .nextAction((action) => action.label('Next step'))
```

## Customizing the wizard's appearance

The wizard is rendered in a card by default. You may remove it with `contained(false)`, as the create page of a resource does. You may hide the list of steps at the top of the wizard with `hiddenHeader()`, and give the list an accessible name with `label()`:

```ts
import { Wizard } from '@navette-js/forms';

Wizard.make([
    // ...
])
    .label('Checkout')
    .contained(false)
```

## Using a wizard in an action modal

An [action](/actions/overview) can open its modal as a wizard: pass the steps to its `steps()` method instead of a form. Each step is validated before the next one, and the last step submits the action:

```ts
import { Action } from '@navette-js/actions';
import { Step, TextInput, Toggle } from '@navette-js/forms';

Action.make('create')
    .steps([
        Step.make('Name')
            .schema([
                TextInput.make('name').required(),
            ]),
        Step.make('Visibility')
            .schema([
                Toggle.make('is_visible'),
            ]),
    ])
    .action(async ({ data }) => {
        // ...
    })
```

See [using a wizard as a modal](/actions/modals#using-a-wizard-as-a-modal) in the actions documentation.

<Aside variant="warning">
Lazy loading step content is not available in Navette yet.
</Aside>
