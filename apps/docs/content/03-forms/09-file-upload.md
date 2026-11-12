---
title: File upload
---

## Introduction

The file upload field is based on [FilePond](https://pqina.nl/filepond):

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
```

An upload happens in two steps. When the user picks a file, the browser sends it to a **temporary** folder. When the form is saved, the field **stores** the file in its final place and saves its key (a relative path) in the record's column.

## Setting up uploads

Two things must be configured once, when your server starts:

1. A temporary upload store, passed to the `WireRuntime`. Without it, every upload is refused.
2. A permanent storage for the fields, set on `FileUpload.storage`.

```ts
import path from 'node:path';
import express from 'express';
import { FileUpload, LocalFileStorage } from '@navette-js/forms';
import { panelRouter } from '@navette-js/panels';
import { UploadStore, WireRuntime } from '@navette-js/wire';

const storage = path.resolve('./storage');

// 1. Temporary uploads, signed with the application key.
const runtime = new WireRuntime({ key, uploads: new UploadStore(path.join(storage, 'tmp'), key) });

// 2. Permanent storage, served by Express under `/storage`.
FileUpload.storage = new LocalFileStorage(path.join(storage, 'public'), '/storage');
app.use('/storage', express.static(path.join(storage, 'public'), { dotfiles: 'deny', index: false }));

app.use(panelRouter(panel, runtime));
```

`UploadStore` accepts options as its third argument: `maxFileSize` in bytes (12 MB by default), `maxFiles` per upload request (20), and `ttl`, how long temporary files are kept (24 hours).

## Configuring the storage and directory

You may store the files of a field in a subdirectory of the storage with `directory()`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('receipt_path')
    .directory('expense-receipts')
```

You may also use another storage for one field with `storage()`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('contract')
    .storage(privateStorage)
```

### Writing a custom storage

To store files elsewhere (an object storage such as S3, for example), implement the `FileStorage` interface. `store()` receives the temporary file and the directory, and returns the key to save. `info()` returns the name, size, type and URL of a stored file, or `null`:

```ts
import { randomUUID } from 'node:crypto';
import type { FileStorage, TemporaryUpload, UploadedFileInfo } from '@navette-js/forms';

class BucketStorage implements FileStorage {
    async store(file: TemporaryUpload, directory: string | null): Promise<string> {
        // `file.path` is the temporary file; `file.type` and `file.extension` were detected from its content.
        const key = `${directory ?? 'files'}/${randomUUID()}.${file.extension}`;
        await bucket.upload(file.path, key, { contentType: file.type, metadata: { name: file.name } });

        return key;
    }

    async info(key: string): Promise<UploadedFileInfo | null> {
        const object = await bucket.head(key);

        return object ? { name: object.metadata.name ?? key, size: object.size, type: object.contentType, url: bucket.publicUrl(key) } : null;
    }
}

FileUpload.storage = new BucketStorage();
```

Only URLs starting with `/` or `http(s)://` are sent to the browser.

## Uploading multiple files

You may also upload multiple files. The saved value is then a list of keys, which you may store in a JSON column:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
```

Without `multiple()`, the field accepts a single file, and the saved value is a key or `null`.

## Controlling file names

`LocalFileStorage` gives each stored file a random name, with an extension derived from its detected type. The user's original file name is kept in a metadata file next to it, and displayed again in the form.

Random names prevent a user from overwriting another file, or from choosing a name that is executed or served as a page by your web server. If you write your own storage, keep that property: never build the stored path from `file.name`.

## Authorizing existing file paths

When the form is saved, the browser sends back the keys of the files that are already stored. Navette only keeps a key if the record being edited already holds it, in the column of the field. A forged request cannot attach another user's file to a record. On a Create page, no existing key is accepted.

## Reordering files

You can also allow users to re-order uploaded files using the `reorderable()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .reorderable()
```

## Preventing files from being stored by the field

When a file must become something other than a key in a column (a row in a media table, for example), use `storeFiles(false)`. The field then stores nothing itself: your data adapter receives a list of entries, in the order of the form. An entry is either `{ key }`, a file the record already has, or `{ file }`, a new temporary file:

```ts
import { FileUpload, type FileUploadEntry } from '@navette-js/forms';

FileUpload.make('media')
    .multiple()
    .image()
    .storeFiles(false)
    .getUploadedFileUsing(async (key) => {
        const media = await knex('media').where({ uuid: key }).first();

        return media ? { name: media.file_name, size: media.size, type: media.mime_type, url: `/storage/${media.id}/${media.file_name}` } : null;
    })

// In the adapter:
for (const entry of data.media as FileUploadEntry[]) {
    if ('key' in entry) {
        // An existing media, kept.
    } else {
        // `entry.file` is a temporary file: `path`, `name`, `type`, `size`, `extension`.
    }
}
```

`getUploadedFileUsing()` returns the information of an existing file, when it doesn't come from the storage. The record must expose its current keys under the name of the field (here `record.media = ['uuid-1', 'uuid-2']`): this is how the field recognizes the files it may keep.

## Deleting files

Removing a file from the field does not delete it from the storage. If you want to delete stored files, compare the old and new keys in your data adapter, after saving.

## File upload validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to file uploads. They are all checked again on the server, on the temporary files.

### File type validation

You may restrict the types of files that may be uploaded using the `acceptedFileTypes()` method, and passing a list of MIME types. `image()` is a shortcut for `acceptedFileTypes(['image/*'])`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('document')
    .acceptedFileTypes(['application/pdf'])
```

The type is read from the content of the file, never from its name or from the type announced by the browser. Navette recognizes JPEG, PNG, GIF, WebP, PDF and ZIP files, and plain text for the `.txt`, `.csv`, `.json` and `.md` extensions. Office documents such as `.docx` are ZIP files, and are detected as `application/zip`. Any other file is stored with the `.bin` extension as `application/octet-stream`, and is refused by `acceptedFileTypes()`.

<Aside variant="danger">
Always set `acceptedFileTypes()` or `image()`. Without it, any file is accepted, including unknown binary files.
</Aside>

### File size validation

You may restrict the size of each uploaded file in kilobytes with `maxSize()`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .maxSize(2048)
```

The `maxFileSize` of the `UploadStore` is an absolute limit for every upload, checked before any field rule.

### Number of files validation

You may customize the maximum number of files that may be uploaded at once using the `maxFiles()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .maxFiles(5)
```

## Security

Navette provides the following protections:

- The upload requires a signed URL valid for a few minutes, the CSRF token and a signed-in user.
- The file type is detected from the content, and the stored extension follows the detected type. An HTML or SVG file renamed to `.jpg` is neither accepted as an image nor served as a page.
- Existing keys are only accepted for the record that holds them.
- Types, sizes and number of files are validated on the server.

What your application must still do:

- Files stored by `LocalFileStorage` in a folder served by Express are public to anyone who knows their URL. Serve private documents through a route that checks access.
- Decide when to delete files that are no longer used.

<Aside variant="warning">
The image editor, avatar mode, image resizing and cropping, grid layout, downloading and opening files, image dimension and aspect ratio validation, `minSize()` and custom file names are not available yet.
</Aside>
