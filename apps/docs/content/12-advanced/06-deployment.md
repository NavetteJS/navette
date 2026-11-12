---
title: Deployment
---

## Introduction

A Navette application is a Node.js process serving an Express application. Deploy it like any other Node.js application: behind a reverse proxy, with a process manager or in a container. This page lists what must change between development and production.

## Production checklist

- [ ] `APP_KEY` random, provided by the environment, startup refused without it
- [ ] `appUrl()` set on every panel that sends emails
- [ ] HTTPS, and `trust proxy` set behind a proxy
- [ ] A real mailer
- [ ] Passwords stored as hashes
- [ ] Authorization rules written and tested
- [ ] Adapters restricted to what each user may see
- [ ] Accepted types and sizes on every file upload; private files out of static folders
- [ ] No unescaped data in your own HTML
- [ ] `NODE_ENV=production`

## Ensuring that users are authorized to access panels

In development, it is common to log in with a test account. In production, the [user provider](/panels/users) decides who may log in, and its `find()` method runs on every request: return `null` for accounts that must not use the panel. Then check the [authorization rules](/resources/authorization) of your resources, pages and widgets: without them, every logged-in user can do everything.

## Setting the application key

The key signs the sessions, the password reset and email verification links (`panel.key()`), the state of the components (`new WireRuntime({ key })`) and the upload URLs (`new UploadStore(dir, key)`). Anyone who knows it can impersonate any user.

The examples fall back to a development key when `APP_KEY` is not set, and so does `Panel` when `key()` is not called. In production, generate a random key, pass it through the environment, never commit it, and refuse to start without it:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

```ts
const key = process.env.APP_KEY;
if (!key) throw new Error('APP_KEY is not set.');

const panel = Panel.make().key(key) /* ... */;
const runtime = new WireRuntime({ key, uploads: new UploadStore('./storage/tmp', key) });
```

Changing the key logs every user out, and invalidates the links already sent by email.

## Setting the application URL

The links sent by email are built from `appUrl()`. Without it, they use the `Host` header of the request, which a client can forge to send password reset links to its own site. Set it on every panel that sends emails:

```ts
panel.appUrl(process.env.APP_URL!); // https://admin.example.com
```

## Serving the panel over HTTPS

Serve the panel over HTTPS only. The session, CSRF and theme cookies are marked `Secure` when Express sees the request as secure.

Behind a reverse proxy (nginx, a load balancer, a hosting platform), tell Express to trust it:

```ts
app.set('trust proxy', 1);
```

Without it, Express believes requests are made over HTTP, so the cookies are not `Secure`, and it sees the address of the proxy instead of the client's: the login limit then applies to all users at once.

## Configuring the mailer

The default mailer writes emails to the console. Give every panel that sends emails (registration, password reset, email verification) a real [mailer](/panels/users#sending-emails).

## Serving files

Mount `express.static()` for your public folders (logos, compiled theme, stored files) before the panel. The assets of Navette are served by `panelRouter()` itself, with a long cache duration; their URLs carry a version number, so a new version of the assets is loaded after an upgrade.

If you use a [custom theme](/styling/overview#creating-a-custom-theme), compile it during your build, and add a version to its URL so browsers load the new one after a deployment:

```ts
panel.theme(`/css/theme.css?v=${process.env.BUILD_ID}`);
```

Keep the upload folders on persistent storage, and see [file storage](/advanced/file-storage#keeping-files-private) for private files.

## Running several instances

Most of the state of Navette lives in the browser (the signed state of components) and in your database, so several processes can serve the same panel behind a load balancer, provided they share the same key, database and file storage. Some data is kept in the memory of each process:

| Data | Effect with several processes |
|---|---|
| Login, registration and password reset attempt counters | Limits apply per process, and reset on restart. Add a rate limit at the proxy level. |
| Pending flash notifications | A notification is delivered by the process that created it. Use sticky sessions, or accept that a notification may be lost after a redirect. |
| Temporary uploads | Stored in the folder of the `UploadStore`: share it between the processes, or use sticky sessions. |

Sessions are signed cookies, not server-side sessions: they need no shared store.

## Setting the environment

Run the process with `NODE_ENV=production`. In development, Navette logs refused component calls and requests in the console to help you; in production, these messages are not written.

Navette requires Node.js 24 or later, which runs TypeScript directly: no build step is needed for your code, but only TypeScript syntax that can be erased is supported (no `enum`, no decorators, no parameter properties).
