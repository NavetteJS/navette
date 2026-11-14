---
title: File storage
---

## Introduction

Files reach your application through the [file upload field](/forms/file-upload), in two steps:

1. When the user picks a file, the browser sends it to a **temporary store**, managed by the `WireRuntime` of the panel. The field receives a reference to the temporary file.
2. When the form is saved, the field **stores** the file with a `FileStorage`, and the record receives the key of the stored file: a relative path.

This page describes both steps, and how to keep files private.

## The temporary store

The temporary store is an `UploadStore`, from `@navette-js/wire`, given to the runtime of the panel. Without it, every upload is refused:

```ts
import path from 'node:path';
import { panelRouter } from '@navette-js/panels';
import { UploadStore, WireRuntime } from '@navette-js/wire';

const uploads = new UploadStore(path.resolve('./storage/tmp'), key, {
    maxFileSize: 12 * 1024 * 1024, // bytes per file (12 MB by default)
    maxFiles: 20,                  // files per upload request (20 by default)
    ttl: 24 * 60 * 60 * 1000,      // how long temporary files are kept, in ms (24 hours by default)
    urlTtl: 5 * 60 * 1000,         // validity of an upload URL, in ms (5 minutes by default)
});

app.use(panelRouter(panel, new WireRuntime({ key, uploads })));
```

The folder is created if it does not exist. Temporary files older than `ttl` are deleted when the next upload arrives.

### Signed upload URLs

An upload follows the protocol of Livewire:

1. The field asks the component for an upload URL. The server answers with `/<panel path>/livewire/upload-file?expires=…&signature=…`, signed with the key of the store and valid for `urlTtl`.
2. The browser sends the files to that URL, with the CSRF token in a header. The server checks the signature, the token, and that a user is logged into the panel.
3. The server streams the files to the temporary folder under random names, and answers with their identifiers.
4. The field sets its state to a reference to these identifiers. A reference that does not designate a received file is refused.

### Checking the type of a file

The type of a file is read from its first bytes, never from its name or from the type announced by the browser:

| Detected type | Extension |
|---|---|
| JPEG, PNG, GIF, WebP images | `jpg`, `png`, `gif`, `webp` |
| PDF | `pdf` |
| ZIP | `zip` |
| Plain text, only for `.txt`, `.csv`, `.json` and `.md` names without null bytes | the same |
| Anything else | `bin`, type `application/octet-stream` |

The extension of the stored file comes from the detected type. An HTML or SVG file renamed to `.jpg` is therefore neither accepted as an image nor served as a page.

<Aside variant="warning">
Always restrict the accepted types of a field with `acceptedFileTypes()` or `image()`, and its size with `maxSize()`. Without them, any detected type is accepted, up to the limit of the store.
</Aside>

## Storing files

When the form is saved, the field moves each temporary file to a `FileStorage`. Set the storage of the whole application on `FileUpload.storage`, or the storage of one field with `storage()`:

```ts
import { FileUpload, LocalFileStorage } from '@navette-js/forms';

FileUpload.storage = new LocalFileStorage(path.resolve('./storage/public'), '/storage');

FileUpload.make('contract').storage(new LocalFileStorage(path.resolve('./storage/contracts'), '/contracts'));
```

### The local storage

`LocalFileStorage` copies the file to a folder, under a random name (`<directory>/<uuid>.<extension>`), and writes its original name and type next to it. When the field chooses the name ([`preserveFilenames()`, `getUploadedFileNameForStorageUsing()`](/forms/file-upload#controlling-file-names)), the name is sanitized with `safeStorageName()` and an existing file is never overwritten: a short random suffix is added. The second argument is the URL under which the folder is served, used to display and download the file:

```ts
import express from 'express';

app.use('/storage', express.static(path.resolve('./storage/public'), { dotfiles: 'deny', index: false }));
```

Keys are checked before use: a key containing `..` or other unexpected characters is refused.

### Writing your own storage

To store files elsewhere, such as an object storage service, implement the `FileStorage` interface:

```ts
import { randomUUID } from 'node:crypto';
import { safeStorageName, type FileStorage, type TemporaryUpload, type UploadedFileInfo } from '@navette-js/forms';

class BucketStorage implements FileStorage {
    // Stores a temporary file and returns its key. `name` is set when the field chooses the file name.
    async store(file: TemporaryUpload, directory: string | null, name: string | null = null): Promise<string> {
        // file.path: the temporary file; file.type and file.extension: detected; file.name: original name.
        const key = `${directory ?? 'files'}/${name === null ? `${randomUUID()}.${file.extension}` : safeStorageName(name, file.extension)}`;
        await bucket.upload(file.path, key, { contentType: file.type });

        return key;
    }

    // Describes a stored file: name, size, type and URL. Null if it does not exist.
    async info(key: string): Promise<UploadedFileInfo | null> {
        const object = await bucket.head(key);
        return object ? { name: object.metadata.name ?? key, size: object.size, type: object.contentType, url: bucket.publicUrl(key) } : null;
    }
}

FileUpload.storage = new BucketStorage();
```

Only URLs that start with `/` or `http(s)://` are sent to the browser.

### Letting the adapter handle the files

When a file must become more than a key in a column (a row in a media table, for example), call `storeFiles(false)` on the field. The adapter then receives the temporary files, and stores them itself. See [the file upload field](/forms/file-upload) for the format of the data.

## Keeping files private

Files stored under a folder served by `express.static()` are public for anyone who knows their URL. The random names make URLs hard to guess, but not secret: they appear in the pages, the browser history and the logs.

### Temporary URLs for private files

A `LocalFileStorage` created with `{ visibility: 'private', key }` keeps its files private: they are only served by its own `serve()` handler, behind temporary signed URLs, like the private disks of Filament:

```ts
import path from 'node:path';
import { FileUpload, LocalFileStorage } from '@navette-js/forms';

const contracts = new LocalFileStorage(path.resolve('./storage/contracts'), '/contracts', {
    visibility: 'private',
    key: process.env.APP_KEY, // the application key, at least 16 characters
});

// Serves the folder at the storage's base URL, checking every signature. Do not serve it with express.static().
app.use('/contracts', contracts.serve());

FileUpload.make('contract').storage(contracts);
```

`url()`, `info()` and `temporaryUrl(key, expiresAt)` give URLs such as `/contracts/2026/3f2a….pdf?expires=1767225599&signature=…`. The signature is an HMAC-SHA256, made with the key, of the storage's base URL, the file's key and the expiry: it cannot be forged without the key, it cannot be reused for another file, and it cannot be extended. Without a valid and unexpired signature, `serve()` answers 403. The file is sent with its detected type, `X-Content-Type-Options: nosniff` and a sandboxing `Content-Security-Policy`, so that an uploaded file is never run as a page of your site. Keys containing `..` or unexpected characters, metadata files, folders and symbolic links leading out of the folder are refused.

Temporary URLs expire after `fileUrlConfig.temporaryFileUrlExpiryMinutes` (30 by default, Filament's `temporary_file_url_expiry_minutes`), rounded up to the end of that hour, so that the same URL is reused for a while and the browser can cache the file:

```ts
import { fileUrlConfig } from '@navette-js/support';

fileUrlConfig.temporaryFileUrlExpiryMinutes = 10;
```

A field's [`visibility()`](/forms/file-upload#setting-the-visibility-of-files) and an image entry's [`visibility()`](/infolists/image-entry#public-images) use `temporaryUrl()` for private files. A public `LocalFileStorage` can also serve its folder with `serve()`, without signatures.

<Aside variant="warning">
A temporary URL gives access to the file to anyone who has it, until it expires: it is not tied to the session. For documents that must only be opened by users with a given right, also check that right in your own route, as below.
</Aside>

### Temporary URLs of your own storage

A custom storage provides temporary URLs by implementing `temporaryUrl()`, and declares its default visibility with `visibility`. With an object storage service, return the service's presigned URL:

```ts
class BucketStorage implements FileStorage {
    readonly visibility = 'private';

    // …store() and info()…

    temporaryUrl(key: string, expiresAt: Date): string {
        return bucket.presignedGetUrl(key, { expiresAt });
    }

    exists(key: string): Promise<boolean> {
        return bucket.exists(key);
    }

    async delete(key: string): Promise<void> {
        await bucket.delete(key);
    }
}
```

To sign URLs served by your own route, use `signedFileUrl(key, url, fileKey, expiresAt, scope)` and `verifyFileUrlSignature(key, fileKey, expires, signature, scope)` from `@navette-js/support`.

### Serving files through your own route

To check the session and the rights of the user on each download, store the files outside of any static folder, and serve them through your own route:

```ts
app.get('/files/contracts/:id', async (req, res) => {
    const user = await panel.user(req);
    if (!user) return void res.status(401).end();

    const contract = await ContractResource.adapter.find(req.params.id);
    if (!contract || !(await ContractResource.can('view', user, contract))) return void res.status(404).end();

    res.download(path.join(contractsRoot, contract.file), contract.file_name);
});
```

Then return that URL from `info()` of your storage, or from `getUploadedFileUsing()` of the field.

## Deleting files

`FileStorage.delete(key)` deletes a stored file. `LocalFileStorage.delete()` also removes the file's metadata, ignores keys containing `..` or unexpected characters, never removes a folder, and never follows a symbolic link leading out of the storage folder.

A file removed from a field is not deleted from the storage, as the file may be used elsewhere. To delete it, use the field's [`deleteUploadedFileUsing()`](/forms/file-upload#deleting-files):

```ts
FileUpload.make('attachments')
    .multiple()
    .deleteUploadedFileUsing(({ file, storage }) => storage?.delete?.(file))
```

<Aside variant="info">
Image resizing and cropping on the server are not available: images are resized and cropped in the browser, by the [image editor](/forms/file-upload#image-editor) and the [automatic resizing options](/forms/file-upload#cropping-and-resizing-images-without-the-editor).
</Aside>
