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

### Configuring the HTML sanitizer

`sanitizeHtml()` from `@navette-js/support` is the sanitizer used by Navette. By default, it keeps formatting elements, lists, headings, code and links (to `http`, `https`, `mailto` and relative URLs, with `rel="noopener noreferrer nofollow"`), and drops everything else. Change what it keeps for the whole application with `useHtmlSanitizerConfig()`, which receives the current configuration and returns a new one (each method returns a copy):

```ts
import { HtmlSanitizerConfig, useHtmlSanitizerConfig } from '@navette-js/support';

useHtmlSanitizerConfig((config) => config
    .allowElement('mark')
    .allowAttribute('class', ['span', 'p'])
    .dropAttribute('style')
    .withMaxInputLength(100_000));
```

Pass a configuration to start from scratch, or `null` to go back to the default:

```ts
useHtmlSanitizerConfig(HtmlSanitizerConfig.make().allowSafeElements().allowRelativeLinks());
```

| Method | Effect |
|---|---|
| `HtmlSanitizerConfig.make()` | An empty configuration: nothing is kept until you allow it. |
| `HtmlSanitizerConfig.default()` | Navette's default configuration. |
| `allowSafeElements()`, `allowStaticElements()` | Allow every element that cannot run code (formatting, lists, tables, images, quotes…), with their safe attributes. |
| `allowElement(element, attributes)` | Allows an element, with these attributes (`'*'`: its safe attributes). |
| `blockElement(element)` | Removes the element's tags, but keeps its content. |
| `dropElement(element)` | Removes the element with its content. |
| `allowAttribute(attribute, elements)` | Allows an attribute on some elements (`'*'`: every allowed element). |
| `dropAttribute(attribute, elements)` | Removes an attribute, even when another rule allows it. |
| `forceAttribute(element, attribute, value)` | Sets an attribute on every occurrence of an element. |
| `allowLinkSchemes(schemes)`, `allowMediaSchemes(schemes)` | Replace the schemes allowed in links (`href`, `cite`) and media (`src`, `poster`). |
| `allowLinkHosts(hosts)`, `allowMediaHosts(hosts)` | Only keep absolute URLs to these hosts (`null`: any host). |
| `allowRelativeLinks()`, `allowRelativeMedias()` | Keep URLs without a scheme. |
| `forceHttpsUrls()` | Rewrites `http:` URLs to `https:`. |
| `withMaxInputLength(length)` | Truncates longer input before parsing it. |
| `withLinkRel(rel)` | The `rel` attribute forced on links (`null`: none). |

Whatever the configuration, event handler attributes (`on…`), `<script>`, `<style>`, frames, plugins and forms are never kept, and URL attributes always follow the scheme lists: `javascript:` URLs only survive if you add `javascript` to `allowLinkSchemes()` yourself, which you should never do.

### Checking URLs

To put a URL that comes from users into a link yourself, check it first. `isSafeUrl()` tells whether a URL can be put in a link: `http`, `https`, `mailto`, paths and anchors by default, never `javascript:` or `data:`. `sanitizeUrl()` returns the URL when it is relative or uses an allowed scheme (`http` and `https` by default), and `null` otherwise:

```ts
import { e, isSafeUrl, sanitizeUrl } from '@navette-js/support';

isSafeUrl(record.website);                                   // http, https, mailto and relative URLs
isSafeUrl(record.website, { schemes: ['https'], allowRelative: false });

const url = sanitizeUrl(record.website, ['https']);
const html = url ? `<a href="${e(url)}">Website</a>` : '';
```

Both decode entities and control characters first, as the browser does. The returned URL still has to be escaped in HTML.

## Content Security Policy

The panel's pages contain inline scripts and styles (the configuration of Livewire, the color variables, the initial state of the sidebar). To serve them under a `Content-Security-Policy` without `'unsafe-inline'`, generate a nonce for each request in a middleware, send it in the header and give it to the panel with `useCspNonce()`: every inline `<script>` and `<style>` of the page, of its error pages and of its component updates then carries it.

```ts
import { randomBytes } from 'node:crypto';
import { useCspNonce } from '@navette-js/support';

panel.middleware([
    (req, res, next) => {
        const nonce = randomBytes(16).toString('base64');
        useCspNonce(res, nonce);
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`,
            `style-src-elem 'self' 'nonce-${nonce}' https://fonts.bunny.net`,
            "style-src-attr 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self' https://fonts.bunny.net",
        ].join('; '));
        next();
    },
], true);
```

Register it as a persistent middleware (`true`), so that component updates get the nonce too. Alpine.js evaluates the expressions written in the markup, which needs `'unsafe-eval'`, and `style` attributes cannot carry a nonce, which needs `style-src-attr 'unsafe-inline'`. The nonce must be base64 text, and new for every request.

In your own views and render hooks, `cspNonce()` returns the nonce of the request being rendered, and `cspNonceAttribute()` the ` nonce="…"` attribute to write in an inline element:

```ts
import { cspNonceAttribute } from '@navette-js/support';

panel.renderHook(PanelsRenderHook.BODY_END, () => `<script${cspNonceAttribute()}>console.log('ready')</script>`);
```

The demo application has a panel served under such a policy: `apps/demo/lab-navigation.ts`.

## Panel access

The user provider of the panel decides who may log in, and its `find()` method runs on every request: return `null` to cut an account off immediately. See [users](/panels/users#authorizing-access-to-the-panel) for passwords, sessions, rate limits and the security of password reset and email verification.

The session cookie is signed with the key of the panel; the state of components is signed with the key of the runtime. Anyone who knows these keys can impersonate any user: see [deployment](/advanced/deployment#setting-the-application-key).

## Model attribute exposure

The records of a resource are not part of the state of its pages: an edit page keeps the record key, and fills its form with the fields it declares only. A table renders the columns it declares. Other attributes of the record never reach the browser, unless you display them.

The state of a form is visible to the user in the browser, including the values of hidden fields. Do not put secrets in a form.

## File uploads

Uploaded files go to a temporary folder through a signed URL, valid for a few minutes, with the CSRF token, and only for a logged-in user. Their type is read from their content, never from their name. Always restrict the accepted types and the size, and keep private files out of public folders. See [file storage](/advanced/file-storage).

### Restricting uploads to schema components

The browser names the property an upload is for. Panel pages, resource pages, relation managers and widgets only accept a temporary upload for a visible upload field of their own schemas: a `FileUpload` (or a subclass), or the file attachments of a `RichEditor` or `MarkdownEditor`. The schemas checked are every `<name>Schema(schema)` builder of the component (`formSchema()`, `infolistSchema()`, `contentSchema()`…) and the forms of its mounted actions. Any other target, such as a text field, a hidden upload field or another public property, is rejected with a 403 error before the upload URL is signed, so a signed-in user cannot store files through a page that does not offer an upload. This restriction is turned on by default for every panel component.

A custom field that uploads files itself (calling `$wire.upload()` with its own state path) declares it with an `acceptsFileUploads()` method:

```ts
import { Field } from '@navette-js/forms';

export class SignaturePad extends Field {
    acceptsFileUploads(): boolean {
        return true;
    }
}
```

A component that receives uploads for a property outside its schemas can turn the check off, or decide itself by overriding `isFileUploadForSchemaComponent(name)` (the name is the upload's state path, such as `data.photos.<uuid>`), and can add schemas built in another way by overriding `getFileUploadSchemas()`:

```ts
import { Page } from '@navette-js/panels';

export class ImportPhotos extends Page {
    static restrictFileUploadsToSchemaComponents = false;
}
```

Components [outside a panel](/components/outside-a-panel/form) built on `LivewireComponent` are pages too, so they are restricted the same way. A component built directly on the wire runtime's `Component` opts in by declaring the same two methods, which the runtime calls for `_startUpload`, `_finishUpload`, `_uploadErrored` and `_removeUpload`:

```ts
import { Component } from '@navette-js/wire';
import { FileUpload, isFileUploadForSchemas, TextInput } from '@navette-js/forms';
import { Schema } from '@navette-js/schemas';

export class ContactForm extends Component {
    data: Record<string, unknown> = {};

    form(): Schema {
        return Schema.make(this).key('form').statePath('data').components([
            TextInput.make('name'),
            FileUpload.make('attachment'),
        ]);
    }

    shouldRestrictFileUploadsToSchemaComponents(): boolean {
        return true;
    }

    async isFileUploadForSchemaComponent(name: string): Promise<boolean> {
        return isFileUploadForSchemas([this.form()], name);
    }
}
```

The check covers where a file is uploaded, not what is done with it: the field still validates the file's type and size when the form is submitted, and your save logic decides where it is stored.

## Scoping queries

A policy answers "may they change **this** record?", it does not filter lists. To keep users away from records, restrict the adapter of the resource with its `modify` option: a record outside of its scope does not exist for the resource. See [restricting the records](/resources/authorization#restricting-the-records) and [multi-tenancy](/panels/tenancy#tenancy-security).

In `modify`, in a custom filter, in an action: always pass values as bound parameters, never by concatenating them into SQL:

```ts
query.where('status', value);                              // safe
query.whereRaw('lower(name) like ?', [`%${search}%`]);     // safe
query.whereRaw(`name like '%${search}%'`);                 // SQL injection
```
