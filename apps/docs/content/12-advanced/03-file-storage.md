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

`LocalFileStorage` copies the file to a folder, under a random name (`<directory>/<uuid>.<extension>`), and writes its original name and type next to it. The second argument is the URL under which the folder is served, used to display and download the file:

```ts
import express from 'express';

app.use('/storage', express.static(path.resolve('./storage/public'), { dotfiles: 'deny', index: false }));
```

Keys are checked before use: a key containing `..` or other unexpected characters is refused.

### Writing your own storage

To store files elsewhere, such as an object storage service, implement the `FileStorage` interface:

```ts
import { randomUUID } from 'node:crypto';
import type { FileStorage, TemporaryUpload, UploadedFileInfo } from '@navette-js/forms';

class BucketStorage implements FileStorage {
    // Stores a temporary file and returns its key.
    async store(file: TemporaryUpload, directory: string | null): Promise<string> {
        // file.path: the temporary file; file.type and file.extension: detected; file.name: original name.
        const key = `${directory ?? 'files'}/${randomUUID()}.${file.extension}`;
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

For private documents, store them outside of any static folder, and serve them through your own route, which checks the session and the rights of the user:

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

<Aside variant="warning">
Navette does not generate temporary signed URLs for stored files yet: protect private files with your own route. A file removed from a field is not deleted from the storage either: delete it in your adapter if you need to. Image resizing and cropping on the server are not available.
</Aside>
