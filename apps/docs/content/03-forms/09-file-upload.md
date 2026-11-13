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

<Aside variant="danger">
Restrict [accepted file types](#file-type-validation) with `acceptedFileTypes()` or `image()`, and serve stored files so that they can never run as code or be rendered as pages of your application.
</Aside>

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

To store files elsewhere (an object storage such as S3, for example), implement the `FileStorage` interface:

- `store(file, directory, name)` receives the temporary file, the directory of the field, and the file name to use, or `null` for a random name. It returns the key to save.
- `info(key)` returns the name, size, type and URL of a stored file, or `null`.

```ts
import { randomUUID } from 'node:crypto';
import { safeStorageName, type FileStorage, type TemporaryUpload, type UploadedFileInfo } from '@navette-js/forms';

class BucketStorage implements FileStorage {
    async store(file: TemporaryUpload, directory: string | null, name?: string | null): Promise<string> {
        // `file.path` is the temporary file; `file.type` and `file.extension` were detected from its content.
        let fileName = name ? safeStorageName(name, file.extension) : `${randomUUID()}.${file.extension}`;
        if (name && await bucket.exists(`${directory ?? 'files'}/${fileName}`)) {
            fileName = fileName.replace(/(\.[A-Za-z0-9]+)$/, `-${randomUUID().slice(0, 8)}$1`);
        }
        const key = `${directory ?? 'files'}/${fileName}`;
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

Only URLs starting with `/` or `http(s)://` are sent to the browser. When `name` is not `null`, it comes from the user or from your application: pass it through `safeStorageName()` (see [controlling file names](#controlling-file-names)) and never overwrite an existing file.

## Uploading multiple files

You may also upload multiple files. The saved value is then a list of keys, which you may store in a JSON column:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
```

Without `multiple()`, the field accepts a single file, and the saved value is a key or `null`.

### Controlling the maximum parallel uploads

You can control the maximum number of files uploaded at the same time using the `maxParallelUploads()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .maxParallelUploads(1)
```

If unset, FilePond uploads `2` files at a time.

## Controlling file names

By default, `LocalFileStorage` gives each stored file a random name (`<directory>/<uuid>.<extension>`), with an extension derived from its detected type. The user's original file name is kept in a metadata file next to it, and displayed again in the form.

### Security implications of controlling file names

Before using `preserveFilenames()` or `getUploadedFileNameForStorageUsing()`, consider the risk of storing names chosen by the user. Navette limits it:

- Every chosen name goes through `safeStorageName(name, extension)`. Directory parts are removed (`../../evil.php` becomes `evil`), every run of characters other than letters, digits, `_` and `-` becomes a single `-` (`my report.final.pdf` becomes `my-report-final`), and the name is cut to 180 characters. An empty result is replaced by a random name.
- The extension is **always** the one detected from the content of the file, never the one in the name. An upload named `shell.php` whose content is a PNG image is stored as `shell.png`. If its content is PHP code, it is detected as `application/octet-stream` and refused by `image()`.
- `LocalFileStorage` does not overwrite an existing file: when the name is already taken, it adds a random suffix (`report-1a2b3c4d.pdf`).

What remains your responsibility:

- Predictable names make predictable URLs. In a folder served publicly, anyone can guess `/storage/invoices/invoice-2024.pdf`. Keep random names for documents that are not meant to be public, or serve them through a route that checks access.
- Two users uploading `report.pdf` get two different files, but the names no longer tell which is which. Scope files with `directory()` if that matters.
- If you write your own storage, apply the same rules (see [writing a custom storage](#writing-a-custom-storage)).

To display original names without using them as storage names, use [`storeFileNamesIn()`](#storing-original-file-names-independently) and keep the random names.

### Preserving original file names

<Aside variant="danger">
Before using this feature, please ensure that you have read the [security implications](#security-implications-of-controlling-file-names).
</Aside>

To store files under their original (sanitized) names, use the `preserveFilenames()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .preserveFilenames()
```

Optionally, you may pass a boolean value to control if the original file names should be preserved: `preserveFilenames(false)`.

### Generating custom file names

<Aside variant="danger">
Before using this feature, please ensure that you have read the [security implications](#security-implications-of-controlling-file-names).
</Aside>

You may completely customize how file names are generated using the `getUploadedFileNameForStorageUsing()` method. The function receives the temporary file (`name`, `type`, `size`, `extension`, `path`) and the context of the field, and returns the name, synchronously or as a promise:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .getUploadedFileNameForStorageUsing((file) => `custom-prefix-${file.name}`)
```

The returned name is sanitized by `safeStorageName()` like any other, and its extension is replaced by the detected one. It takes precedence over `preserveFilenames()`.

### Storing original file names independently

You can keep the random file names, while still storing the original file names, using the `storeFileNamesIn()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .storeFileNamesIn('attachment_file_names')
```

When the form is saved, your data adapter receives `attachment_file_names` next to `attachments`:

- With `multiple()`, an object mapping each stored key to its original name (`{ 'abc.pdf': 'Quote March.pdf' }`), which you may store in a JSON column.
- Without `multiple()`, the original name of the file, or `null`.

When the form is loaded again, these names are displayed in the field instead of the ones returned by the storage. Names are only recorded for files stored by the field: they are not available with [`storeFiles(false)`](#preventing-files-from-being-stored-by-the-field).

## Authorizing existing file paths

When the form is saved, the browser sends back the keys of the files that are already stored. Navette only keeps a key if the record being edited already holds it, in the column of the field. A forged request cannot attach another user's file to a record, and the field never returns information or URLs for a key the record doesn't hold. On a Create page, no existing key is accepted.

This check is always enabled, and cannot be turned off for a field. To attach a file that the record doesn't hold yet (a default template, for example), set the key in your data adapter, after validation.

This protection only covers the field. Your own routes that serve files must still check access.

## Avatar mode

You can enable avatar mode for your file upload field using the `avatar()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('avatar')
    .avatar()
```

This only allows images, crops them to a square and resizes them to 500 × 500 pixels in the browser, and displays them in a compact circle layout, centered. Options you set before or after `avatar()` (`panelLayout()`, `automaticallyResizeImagesToWidth()`, `alignment()`…) take precedence over these defaults.

This feature pairs well with the [circle cropper](#allowing-users-to-crop-images-as-a-circle).

<Aside variant="warning">
The crop and resize happen in the browser. A forged request can still upload an image of any size or shape: add [`imageAspectRatio('1:1')`](#image-aspect-ratio-validation) or [`imageDimensions()`](#image-dimension-validation) if your application relies on it.
</Aside>

## Image editor

You can enable an image editor for your file upload field using the `imageEditor()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .imageEditor()
```

You can open the editor once you upload an image by clicking the pencil icon. It lets the user crop, move, zoom, rotate and flip the image. You can also open the editor on an existing image, which will remove it and upload the edited version on save. The editor is not rendered when the field is disabled.

Optionally, you may pass a boolean value to control if the image editor is enabled: `imageEditor(false)`.

<Aside variant="info">
The editor runs in the browser and sends a new image. Edited images are new uploads, checked by the [validation rules](#file-upload-validation) like any other.
</Aside>

### Allowing users to crop images to aspect ratios

You can allow users to crop images to a set of specific aspect ratios using the `imageEditorAspectRatioOptions()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .imageEditor()
    .imageEditorAspectRatioOptions([
        '16:9',
        '4:3',
        '1:1',
    ])
```

You can also allow users to choose no aspect ratio, "free cropping", by passing `null` as an option:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .imageEditor()
    .imageEditorAspectRatioOptions([
        null,
        '16:9',
        '4:3',
        '1:1',
    ])
```

The buttons are only shown when there are at least two options.

### Setting the image editor's mode

You can change the mode of the image editor using the `imageEditorMode()` method, which accepts either `1`, `2` or `3`. These options are explained in the [Cropper.js documentation](https://github.com/fengyuanchen/cropperjs/blob/v1/README.md#viewmode):

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .imageEditor()
    .imageEditorMode(2)
```

### Customizing the image editor's empty fill color

By default, the image editor will make the empty space around the image transparent. You can customize this using the `imageEditorEmptyFillColor()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .imageEditor()
    .imageEditorEmptyFillColor('#000000')
```

### Setting the image editor's viewport size

You can change the size of the image editor's viewport using the `imageEditorViewportWidth()` and `imageEditorViewportHeight()` methods, which generate an aspect ratio to use across device sizes:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .imageEditor()
    .imageEditorViewportWidth(1920)
    .imageEditorViewportHeight(1080)
```

### Allowing users to crop images as a circle

You can allow users to crop images as a circle using the `circleCropper()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .avatar()
    .imageEditor()
    .circleCropper()
```

This is perfectly accompanied by the [`avatar()` method](#avatar-mode), which renders the images in a compact circle layout. The circle is only a visual guide: the uploaded image is still a square.

Optionally, you may pass a boolean value to control if the circle cropper is enabled: `circleCropper(false)`.

## Cropping and resizing images without the editor

FilePond can crop and resize images before they are uploaded, without the need for a separate editor. Crop images to an aspect ratio with `automaticallyCropImagesToAspectRatio()`, and resize them with `automaticallyResizeImagesToWidth()` and `automaticallyResizeImagesToHeight()`. `automaticallyResizeImagesMode()` sets how the image fits the target size: [`'force'`, `'cover'` or `'contain'`](https://pqina.nl/filepond/docs/api/plugins/image-resize):

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('image')
    .image()
    .automaticallyCropImagesToAspectRatio('16:9')
    .automaticallyResizeImagesMode('cover')
    .automaticallyResizeImagesToWidth(1920)
    .automaticallyResizeImagesToHeight(1080)
```

`imageCropAspectRatio()` is an alias of `automaticallyCropImagesToAspectRatio()`. By default, smaller images are enlarged to the target size; to keep them as they are, use `automaticallyUpscaleImagesWhenResizing(false)`.

<Aside variant="warning">
Cropping and resizing happen in the browser, before the upload. They are not a security control: a forged request can upload any image. To guarantee a ratio or a size, also use [`imageAspectRatio()`](#image-aspect-ratio-validation) or [`imageDimensions()`](#image-dimension-validation), which are checked on the server.
</Aside>

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('banner')
    .image()
    .automaticallyCropImagesToAspectRatio('16:9')
    .imageAspectRatio('16:9')
```

The crop is applied automatically, without user interaction: the user cannot choose which part of the image to keep. If you want users to control how their images are cropped, use the [image editor](#allowing-users-to-crop-images-to-aspect-ratios) instead.

## Altering the appearance of the file upload area

You may also alter the general appearance of the FilePond component. Available values for these methods are listed on the [FilePond website](https://pqina.nl/filepond/docs/api/instance/properties/#styles):

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .imagePreviewHeight('250')
    .loadingIndicatorPosition('left')
    .panelAspectRatio('2:1')
    .panelLayout('integrated')
    .removeUploadedFileButtonPosition('right')
    .uploadButtonPosition('left')
    .uploadProgressIndicatorPosition('left')
```

By default, the layout is `'compact'`, the remove button is on the left, and the upload button and indicators are on the right. `itemPanelAspectRatio()` sets the aspect ratio of each file item, like `panelAspectRatio()` does for the whole area.

### Displaying files in a grid

You can use the [FilePond `grid` layout](https://pqina.nl/filepond/docs/api/style/#grid-layout) by setting the `panelLayout()`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .panelLayout('grid')
```

### Aligning the field

You may align the upload area with the `alignment()` method, which accepts `'start'` (the default), `'center'` or `'end'`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('logo')
    .alignment('center')
```

### Customizing the placeholder

You may change the text displayed in the empty upload area with the `placeholder()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .placeholder('Drop your receipt here')
```

<Aside variant="warning">
FilePond inserts this text as HTML. Never build it from user input.
</Aside>

## Reordering files

You can also allow users to re-order uploaded files using the `reorderable()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .reorderable()
```

When using this method, FilePond may add newly-uploaded files to the beginning of the list, instead of the end. To fix this, use the `appendFiles()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .reorderable()
    .appendFiles()
```

Optionally, the `reorderable()` and `appendFiles()` methods accept a boolean value to control if the files can be reordered and if new files should be appended to the end of the list.

## Opening files in a new tab

You can add a button to open each saved file in a new tab with the `openable()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .openable()
```

The button uses the URL returned by the storage's `info()`. It is not shown in [avatar mode](#avatar-mode). Optionally, you may pass a boolean value to control if the files can be opened: `openable(false)`.

## Downloading files

If you wish to add a download button to each saved file instead, you can use the `downloadable()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .downloadable()
```

The button also uses the URL returned by the storage, and is not shown in avatar mode either. Browsers only honour the download for URLs on the same origin as the panel: for files served from another domain, send a `Content-Disposition: attachment` header from that server. Optionally, you may pass a boolean value: `downloadable(false)`.

## Previewing files

By default, images, videos and audio files are previewed in FilePond. If you wish to disable the preview for all files, you can use the `previewable(false)` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachments')
    .multiple()
    .previewable(false)
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

With `storeFiles(false)`, `preserveFilenames()` and `getUploadedFileNameForStorageUsing()` have no effect, and `storeFileNamesIn()` does not record the names of new files: `entry.file.name` holds the original name, and your adapter decides how to store it.

## Deleting files

Removing a file from the field does not delete it from the storage. If you want to delete stored files, compare the old and new keys in your data adapter, after saving.

## Orienting images from their EXIF data

By default, FilePond will automatically orient images based on their EXIF data. If you wish to disable this behavior, you can use the `orientImagesFromExif(false)` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .orientImagesFromExif(false)
```

## Hiding the remove file button

It is also possible to prevent users from removing saved files by using `deletable(false)`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .deletable(false)
```

The remove button is hidden, and the server ignores a request to remove a saved file from the field. A file uploaded since the form was opened can still be removed.

## Preventing pasting files

You can disable the ability to paste files via the clipboard using the `pasteable(false)` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .pasteable(false)
```

## Customizing the uploading message

You may customize the uploading message that is displayed in the form's submit button using the `uploadingMessage()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .uploadingMessage('Uploading attachment...')
```

## File upload validation

As well as all rules listed on the [validation](/forms/validation) page, there are additional rules that are specific to file uploads. They are all checked again on the server, on the temporary files.

<Aside variant="info">
These rules only apply to newly uploaded files. Files the record already has are not validated again, even if the rules changed since they were uploaded.
</Aside>

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

#### Custom MIME type mapping

Some file formats may not be recognized correctly by the browser. You may give the browser the MIME type of an extension using the `mimeTypeMap()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('archive')
    .acceptedFileTypes(['application/zip'])
    .mimeTypeMap({
        zipx: 'application/zip',
    })
```

This map is only used by the browser, to check the file before it is sent. It does not change the type detected on the server: a format that Navette does not recognize is still `application/octet-stream` there.

### File size validation

You may restrict the size of each uploaded file in kilobytes with `minSize()` and `maxSize()`:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('attachment')
    .minSize(512)
    .maxSize(1024)
```

The `maxFileSize` of the `UploadStore` is an absolute limit for every upload, checked before any field rule.

### Image dimension validation

You may restrict the dimensions of uploaded images with the `imageDimensions()` method. It accepts `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, an exact `width` or `height` in pixels, and `minRatio`, `maxRatio` or an exact `ratio` (width divided by height):

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('photo')
    .image()
    .imageDimensions({ minWidth: 800, minHeight: 600 })
```

You can combine minimum and maximum constraints:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('photo')
    .image()
    .imageDimensions({
        minWidth: 800,
        minHeight: 600,
        maxWidth: 1920,
        maxHeight: 1080,
    })
```

The size is read on the server, from the header of the PNG, GIF, JPEG or WebP file. Any other file, including an SVG image, fails the rule. An exact `ratio` allows a difference of 0.01.

### Image aspect ratio validation

You may restrict the aspect ratio of uploaded images using the `imageAspectRatio()` method:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('banner')
    .image()
    .imageAspectRatio('16:9')
```

You can allow multiple aspect ratios by passing a list:

```ts
import { FileUpload } from '@navette-js/forms';

FileUpload.make('banner')
    .image()
    .imageAspectRatio(['16:9', '4:3', '1:1'])
```

Ratios are written `'16:9'` or `'16/9'`, and an image passes if its width divided by its height is within 0.01 of one of them. Like dimensions, the ratio is checked on the server, and files whose size cannot be read fail the rule. You can also specify a range of acceptable aspect ratios with `imageDimensions({ minRatio: 4 / 3, maxRatio: 16 / 9 })`.

To help users meet the requirement rather than just rejecting their upload, combine it with [automatic cropping](#cropping-and-resizing-images-without-the-editor) or the [image editor](#allowing-users-to-crop-images-to-aspect-ratios).

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
- Chosen file names are sanitized, and never overwrite an existing file in `LocalFileStorage`.
- Existing keys are only accepted for the record that holds them.
- Types, sizes, number of files, image dimensions and aspect ratios are validated on the server.

What your application must still do:

- Files stored by `LocalFileStorage` in a folder served by Express are public to anyone who knows their URL. Serve private documents through a route that checks access, and keep random names for them.
- Treat cropping, resizing, the image editor, the avatar mode and `mimeTypeMap()` as conveniences: they run in the browser and can be bypassed.
- Decide when to delete files that are no longer used.

<Aside variant="warning">
The setters of this field take static values, not functions. `minFiles()`, `moveFiles()`, `fetchFileInformation(false)`, `automaticallyOpenImageEditorForAspectRatio()`, `getOpenableFileUrlUsing()` and `getDownloadableFileUrlUsing()` are not available yet. There is no `preventFilePathTampering()`: Navette always only accepts the keys that the record already holds.
</Aside>
