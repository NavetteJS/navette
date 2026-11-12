# 1. Démarrage

## Installer et lancer

```bash
cd navette
npm install
ADMIN_PASSWORD=choisissez-un-mot-de-passe node apps/starter/server.ts
```

Ouvrez `http://127.0.0.1:3300/login` et connectez-vous avec `admin@example.test` et le mot de passe choisi.
Sous PowerShell : `$env:ADMIN_PASSWORD = '…'; node apps/starter/server.ts`.

Vous obtenez un tableau de bord vide et une entrée « Tasks » : une liste avec recherche, tri, filtre, onglets, statistiques, une action de ligne, la création et l'édition.

Variables d'environnement de l'application de départ :

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | mot de passe du compte (obligatoire) | — |
| `ADMIN_EMAIL` | adresse du compte | `admin@example.test` |
| `APP_KEY` | secret qui signe les sessions et l'état des composants. **À définir en production.** | clé de développement |
| `PORT` | port d'écoute | `3300` |
| `STARTER_DB` | fichier SQLite | `apps/starter/data.sqlite` |

## Anatomie de `apps/starter/server.ts`

Le fichier tient en quatre parties. Tout le reste de la documentation détaille l'une d'elles.

### 1. Les données

```ts
import { Model, ObjectionAdapter, sqlite } from '@navette/database';

const knex = sqlite('./data.sqlite');          // ou createConnection({ client: 'pg', … })

class Task extends Model {
    static tableName = 'tasks';
    id!: number;
    title!: string;
}
```

Un modèle [Objection](https://vincit.github.io/objection.js/) par table. Voir [Données](08-donnees.md).

### 2. Une resource

Une resource décrit une entité : comment la lister (`table`), comment la saisir (`form`), où la trouver (`slug`), comment la lire et l'écrire (`adapter`).

```ts
class TaskResource extends Resource {
    static slug = 'tasks';                       // /tasks, /tasks/create, /tasks/12/edit
    static modelLabel = 'task';
    static navigationIcon = 'o-clipboard-document-check';
    static adapter = new ObjectionAdapter(Task);

    static form(schema: Schema): Schema {
        return schema.components([TextInput.make('title').required().maxLength(255)]);
    }
    static table(table: Table<Task>): Table<Task> {
        return table.columns([TextColumn.make('title').searchable().sortable()]);
    }
}
```

Voir [Resources](03-resources.md), [Tables](04-tables.md), [Formulaires](05-formulaires.md).

### 3. Le panel

```ts
const panel = Panel.make()
    .id('admin')
    .key(process.env.APP_KEY!)
    .brandName('Mon dashboard')
    .setColors({ primary: Color.Emerald })
    .login()
    .pages([Dashboard])
    .resources([TaskResource])
    .auth({ attempt: (email, password) => …, find: (id) => … });
```

Voir [Le panel](02-panel.md).

### 4. Le serveur

```ts
const app = express();
app.use(panelRouter(panel, new WireRuntime({ key })));
app.listen(3300);
```

`panelRouter` rend un routeur Express : vous pouvez le monter à côté de vos propres routes.

## Organiser un vrai projet

L'application de départ tient dans un fichier pour être lue d'un trait. Dès la deuxième resource, séparez :

```
mon-projet/
  server.ts                 panel, authentification, serveur
  resources/
    TaskResource.ts         modèle, resource, widgets, relation managers d'une entité
    CustomerResource.ts
  public/                   images, logo, feuille de thème compilée
```

`apps/demo` suit cette organisation et montre chaque brique dans un cas réel : c'est le meilleur réservoir d'exemples (par exemple `apps/demo/resources/ProductResource.ts` pour le téléversement et le constructeur de requêtes).

## Vérifier que tout marche

```bash
npm test                              # tests unitaires des paquets
node ../tools/parity/e2e-starter.mjs  # parcours de l'application de départ dans un navigateur
```
