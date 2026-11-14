---
title: Security
---

## Introduction

An admin panel handles sensitive data. This page explains what Navette guarantees, and what remains your responsibility.

The interface works by sending the state of its components back to the server, which runs a method and renders them again. Any user can forge these requests. Navette therefore starts from what **you** declared, never from what it receives:

| What the browser sends | What the server does with it |
|---|---|
| The state of a component | Signed with HMAC by the `WireRuntime`: a state modified outside of the expected properties is rejected. |
| The values of a form | Only declared, visible and enabled fields are validated, then passed to the adapter. |
| The key of a record | Read again through the adapter: outside of its scope, the record does not exist. |
| The selection of a bulk action | Reduced to the records that the adapter can see. |
| The name of an action | Searched among the actions declared at that location; visibility and authorization checked again before running. |
| Sort, search, filters, columns, tab | Limited to the columns, filters and tabs declared; values passed as bound parameters. |
| The value of a select | Must be one of the options, or be recognized by your label function. |
| A file | Type read from its content, extension imposed, existing key accepted only if the record owns it. |
| A theme | Compared to the themes declared by the panel. |

Other protections are always on: a CSRF token on every component request, file upload and logout; pages and components unavailable without a session; HTML escaping of every value rendered by the provided components; rich text sanitized on the server; login attempts limited per IP address.

## Authorization

### Resource authorization

Resources, pages and widgets have checkpoints for your authorization rules: policies, `canAccess()`, `canView()`, and the `authorizeUsing()` hook of the panel. Without any rule, every logged-in user can do everything. See [authorization](/resources/authorization).

### Authorization and the request lifecycle

Pages and widgets check the session, the tenant, and the access rules on **every** request, including the updates sent by the browser: a snapshot kept after logging out, or after losing a right, is refused. The record of an edit or View page is read again from the adapter on every request, and its ability checked again.

### Restricting the methods callable from the browser

TypeScript removes `private` and `protected` when the code runs: without a rule, any method of a component could be called by a forged request, and its return value sent back to the browser. Navette only lets the browser call the methods named in the static `callable` list of the component and its parent classes:

```ts
import { Page } from '@navette-js/panels';

class ReportPage extends Page {
    static callable = ['refresh']; // added to the callable methods of Page

    async refresh(): Promise<void> {
        // Treat it as a public route: check the rights, validate the arguments.
    }

    async loadSecrets() {
        // Never callable from the browser, whatever its name.
    }
}
```

Every method in `callable` is an entry point, to treat like a public HTTP route. The lifecycle hooks of pages (`mutateFormDataBeforeCreate()`, `beforeSave()`…) are never callable.

### Protecting server-managed component state

The public properties of a component, those whose name does not start with `_`, are sent to the browser and can be changed by it. The state is signed, so the browser cannot change it outside of an update, but an update can set any public property:

- never put a secret or trusted data in a public property: prefix internal properties with `_`;
- list in `locked` the public properties the browser must not change. Navette locks the record key of the edit and View pages, and the owner key of relation managers.

```ts
class InvoicePage extends Page {
    static locked = ['invoiceId'];

    invoiceId = '';        // public, sent to the browser, cannot be changed by it
    _invoice: any = null;  // stays on the server
}
```

Property names like `__proto__`, `constructor` and `prototype` are refused in any update path.

### Inline editable columns

Editable table columns check that the column exists, is editable and visible, that the record is in the scope of the table and not disabled, that the user has the `update` ability on it, and that the value passes the validation rules of the column, before saving.

### Custom actions

An action you write is available to every user who can see it. Declare its ability with `authorize()`:

```ts
import { Action } from '@navette-js/actions';
import { can } from '@navette-js/panels';

Action.make('refund')
    .authorize(({ livewire, record }) => can(livewire, 'refund', record))
    .requiresConfirmation()
    .action(async ({ record }) => { /* ... */ });
```

A hidden, unauthorized or disabled action cannot be mounted nor run, even by a forged request. The arguments of an action, and the record keys of a calendar, come from the browser: validate them before use.

### Testing authorization

Write at least one test per role: that buttons are hidden, that direct URLs answer 403, and that forged requests change nothing. See [testing](/testing/other-tests#testing-authorization).

## Validating user input

The validation rules of form fields run on the server, whatever the browser does. Only the fields declared in the form, visible and enabled, are validated and saved: a value sent for an unknown field is ignored. A field that is hidden or disabled is not saved, unless you call `dehydrated()` on it.

Values the user must not decide (an author, a tenant, a foreign key of a relation manager) belong in your code: the [lifecycle hooks](/resources/creating-records#customizing-data-before-saving) of the pages, or the adapter.

## HTML escaping and sanitization

The components of Navette escape the values they render. Rich text sent by the rich editor is sanitized on the server, keeping only the tags of the editor, and the HTML displayed by an infolist entry goes through the same sanitizer.

The HTML that **you** write is inserted as is: `Html.make()`, render hooks, the `render()` method of a custom widget or component, an overridden view, the `css` of a theme. Escape every value with `e()`:

```ts
import { Html } from '@navette-js/schemas';
import { e } from '@navette-js/support';

Html.make(({ record }) => `<p>${e(record.title)}</p>`)
```

In an EJS view, `<%= value %>` escapes, `<%- html %>` does not.

## Panel access

The user provider of the panel decides who may log in, and its `find()` method runs on every request: return `null` to cut an account off immediately. See [users](/panels/users#authorizing-access-to-the-panel) for passwords, sessions, rate limits and the security of password reset and email verification.

The session cookie is signed with the key of the panel; the state of components is signed with the key of the runtime. Anyone who knows these keys can impersonate any user: see [deployment](/advanced/deployment#setting-the-application-key).

## Model attribute exposure

The records of a resource are not part of the state of its pages: an edit page keeps the record key, and fills its form with the fields it declares only. A table renders the columns it declares. Other attributes of the record never reach the browser, unless you display them.

The state of a form is visible to the user in the browser, including the values of hidden fields. Do not put secrets in a form.

## File uploads

Uploaded files go to a temporary folder through a signed URL, valid for a few minutes, with the CSRF token, and only for a logged-in user. Their type is read from their content, never from their name. Always restrict the accepted types and the size, and keep private files out of public folders. See [file storage](/advanced/file-storage).

## Scoping queries

A policy answers "may they change **this** record?", it does not filter lists. To keep users away from records, restrict the adapter of the resource with its `modify` option: a record outside of its scope does not exist for the resource. See [restricting the records](/resources/authorization#restricting-the-records) and [multi-tenancy](/panels/tenancy#tenancy-security).

In `modify`, in a custom filter, in an action: always pass values as bound parameters, never by concatenating them into SQL:

```ts
query.where('status', value);                              // safe
query.whereRaw('lower(name) like ?', [`%${search}%`]);     // safe
query.whereRaw(`name like '%${search}%'`);                 // SQL injection
```

<Aside variant="warning">
A strict Content Security Policy is not supported yet: the pages use inline scripts and styles, Alpine.js evaluates expressions written in the markup, and there is no nonce option. A policy without `'unsafe-inline'` and `'unsafe-eval'` breaks the panel.
</Aside>
