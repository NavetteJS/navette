# 10. Fichiers

## Mise en place

Un envoi de fichier se fait en deux temps : le navigateur dépose le fichier dans un dossier **temporaire**, puis, à l'enregistrement du formulaire, le fichier est **stocké** à sa place définitive.

```ts
import path from 'node:path';
import { FileUpload, LocalFileStorage } from '@navette-js/forms';
import { UploadStore, WireRuntime } from '@navette-js/wire';

const uploads = path.resolve('./storage');

// 1. Dossier temporaire, signé avec la clé de l'application.
const runtime = new WireRuntime({ key, uploads: new UploadStore(path.join(uploads, 'tmp'), key) });

// 2. Stockage définitif, servi par Express.
FileUpload.storage = new LocalFileStorage(path.join(uploads, 'public'), '/storage');
app.use('/storage', express.static(path.join(uploads, 'public'), { dotfiles: 'deny', index: false }));

app.use(panelRouter(panel, runtime));
```

Sans `UploadStore`, tout envoi est refusé. Options de `UploadStore` (troisième argument) : `maxFileSize` (octets, défaut 12 Mo), `maxFiles` par envoi (20), `ttl` de conservation des fichiers temporaires (24 h).

## Le champ

```ts
FileUpload.make('attachment'),                                   // un fichier ; la colonne reçoit sa clé (chemin relatif)
FileUpload.make('photos').multiple().maxFiles(5).reorderable()   // plusieurs ; la colonne (JSON) reçoit la liste des clés
    .image()                                                     // équivaut à acceptedFileTypes(['image/*'])
    .maxSize(2048)                                               // en kilo-octets, par fichier
    .directory('photos'),                                        // sous-dossier du stockage
FileUpload.make('contract').acceptedFileTypes(['application/pdf']).required(),
```

Le nom du fichier stocké est aléatoire ; le nom d'origine est conservé à part et réaffiché dans le formulaire.

## Ce que le serveur vérifie

- **Le type est lu dans le contenu du fichier**, jamais dans son nom ni dans le type annoncé par le navigateur. Types reconnus : JPEG, PNG, GIF, WebP, PDF, ZIP, et texte brut pour `.txt`, `.csv`, `.json`, `.md`. Tout le reste est traité comme binaire inconnu, stocké avec l'extension `.bin`, et refusé par `acceptedFileTypes`.
- L'extension du fichier stocké découle du type détecté. Un fichier HTML ou SVG renommé en `.jpg` ne sera donc ni accepté comme image ni servi comme page.
- L'envoi exige une adresse signée valable quelques minutes, le jeton CSRF et un utilisateur connecté.
- Une clé de fichier déjà enregistré n'est acceptée à l'enregistrement que si l'enregistrement en cours la possède : on ne peut pas s'attribuer le fichier d'un autre en forgeant le formulaire.
- `acceptedFileTypes`, `maxSize`, `maxFiles` sont revérifiés côté serveur.

**Indiquez toujours `acceptedFileTypes`** (ou `image()`) : sans cela, tout type reconnu est accepté.

## Stockage personnalisé

Pour un stockage objet (S3…) ou une autre organisation, implémentez `FileStorage` :

```ts
import type { FileStorage, TemporaryUpload, UploadedFileInfo } from '@navette-js/forms';

class BucketStorage implements FileStorage {
    async store(file: TemporaryUpload, directory: string | null): Promise<string> {
        // file.path : fichier temporaire ; file.type, file.extension : détectés ; file.name : nom d'origine
        const key = `${directory ?? 'files'}/${crypto.randomUUID()}.${file.extension}`;
        await bucket.upload(file.path, key, { contentType: file.type });
        return key;
    }
    async info(key: string): Promise<UploadedFileInfo | null> {
        return { name: key.split('/').pop()!, size: 0, type: 'application/octet-stream', url: bucket.publicUrl(key) };
    }
}

FileUpload.storage = new BucketStorage();                 // pour toute l'application
FileUpload.make('avatar').storage(new BucketStorage());   // ou pour un champ
```

## Laisser l'adaptateur gérer les fichiers

Quand un fichier doit devenir autre chose qu'une clé dans une colonne (une ligne dans une table de médias, par exemple), désactivez le stockage du champ :

```ts
FileUpload.make('media').multiple().storeFiles(false)
    .getUploadedFileUsing(async (key) => {           // informations d'un fichier déjà enregistré
        const media = await knex('media').where({ uuid: key }).first();
        return media ? { name: media.file_name, size: media.size, type: media.mime_type, url: `/storage/${media.id}/${media.file_name}` } : null;
    }),
```

L'adaptateur reçoit alors une liste d'entrées, dans l'ordre du formulaire :

```ts
import type { FileUploadEntry } from '@navette-js/forms';

for (const entry of data.media as FileUploadEntry[]) {
    if ('key' in entry) { /* fichier déjà enregistré, conservé */ }
    else { /* entry.file : fichier temporaire à traiter (path, name, type, size, extension) */ }
}
```

L'enregistrement doit exposer ses clés actuelles sous le nom du champ (ici `record.media = ['uuid1', 'uuid2']`) : c'est ce qui permet de reconnaître les fichiers qu'il possède. Exemple complet : `Products.syncMedia` dans `apps/demo/resources/ProductResource.ts`.

## Limites

- Un fichier retiré du formulaire n'est pas effacé du stockage par le champ : supprimez-le dans votre adaptateur si vous le souhaitez.
- Pas de redimensionnement ni de recadrage d'image côté serveur.
- Les fichiers stockés par `LocalFileStorage` sous un dossier servi par Express sont publics pour qui connaît leur adresse. Pour des documents privés, servez-les par une route qui vérifie l'accès.
