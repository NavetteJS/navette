# 11. Sécurité

Un back-office manipule des données sensibles. Cette page dit ce que le framework garantit, et ce qui reste à votre charge.

## Le principe : rien de ce qui vient du navigateur n'est cru

L'interface est animée par des requêtes qui renvoient au serveur l'état des composants. Un utilisateur peut forger ces requêtes. Le framework part donc de ce que **vous** avez déclaré, pas de ce qu'il reçoit :

| Ce que le navigateur envoie | Ce que le serveur en fait |
|---|---|
| État d'un composant | Signé (HMAC avec `APP_KEY`) : toute modification hors des champs prévus est rejetée. |
| Valeurs d'un formulaire | Seuls les champs déclarés, visibles et actifs sont validés puis transmis à l'adaptateur. |
| Clé d'un enregistrement | Relue par l'adaptateur : hors de sa portée, l'enregistrement n'existe pas. |
| Sélection d'une action groupée | Ramenée aux enregistrements que la table peut afficher. |
| Nom d'une action | Cherché parmi les actions déclarées à cet emplacement ; `visible` / `hidden` revérifiés avant l'exécution. |
| Tri, recherche, filtres, colonnes | Limités aux colonnes et filtres déclarés ; valeurs passées en paramètres liés. |
| Valeur d'un sélecteur | Doit figurer dans les options ou être reconnue par votre fonction de libellé. |
| Fichier | Type lu dans le contenu, extension imposée, clé existante acceptée seulement si l'enregistrement la possède. |
| Thème, onglet actif | Comparés à la liste déclarée. |

Autres protections en place : jeton CSRF sur chaque requête d'état et chaque envoi de fichier ; pages et composants inaccessibles sans session ; échappement HTML de toutes les valeurs rendues par les composants fournis ; texte riche nettoyé côté serveur ; cinq tentatives de connexion par minute et par adresse IP.

## Ce qui reste à votre charge

### 1. La clé de l'application

`APP_KEY` signe les sessions et l'état des composants. Qui la connaît peut se faire passer pour n'importe quel utilisateur.

- Générez-la aléatoirement : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- Passez-la par l'environnement ; ne la mettez jamais dans le dépôt. Le repli « clé de développement » des exemples ne doit pas atteindre la production : faites échouer le démarrage si la variable manque.

### 2. Les mots de passe

Le panel vous confie la vérification (`auth.attempt`). Stockez une empreinte lente (`scrypt`, `argon2`, `bcrypt`) avec un sel par utilisateur, comparez en temps constant, ne journalisez jamais un mot de passe.

### 3. Les autorisations

Le framework authentifie ; il ne sait pas **qui a le droit de quoi**. Trois endroits où l'exprimer :

- `auth.find` : rendez `null` pour un compte qui ne doit plus accéder au panel.
- `modify` de l'adaptateur : restreignez les enregistrements visibles (voir [Données](08-donnees.md)). C'est la protection la plus sûre, car elle s'applique à la lecture comme à l'écriture.
- `visible` / `hidden` des actions, et un refus explicite dans `action` pour les opérations sensibles.

S'y ajoutent les politiques de resource, `canAccess` des pages, `canView` des widgets et le crochet `panel.authorizeUsing` : voir [Permissions](13-permissions.md). Sans aucune de ces règles, tout utilisateur connecté voit et peut tout : si vos utilisateurs n'ont pas tous les mêmes droits, écrivez-les, et vérifiez-les par un test.

### 4. HTTPS et proxy

- Servez le panel en HTTPS. Les cookies de session et CSRF sont alors marqués `Secure` automatiquement.
- Derrière un proxy (nginx, plateforme d'hébergement), déclarez-le : `app.set('trust proxy', 1)`. Sans cela, Express croit la requête en HTTP (cookies non `Secure`) et voit l'adresse du proxy à la place de celle du client (la limitation des connexions s'applique alors à tout le monde à la fois).
- La limitation des connexions est tenue en mémoire, par processus. Sur plusieurs instances, ajoutez une limitation au niveau du proxy.

### 5. Le HTML que vous écrivez vous-même

Les composants fournis échappent leurs valeurs. Ce que vous insérez vous-même ne l'est pas : `Html.make(...)`, `render()` d'un widget, `css` d'un thème. Échappez toute donnée avec `e()` :

```ts
import { e } from '@navette/support';
Html.make(({ record }) => `<p>${e(record.title)}</p>`)
```

### 6. Les propriétés et méthodes publiques

Une page, un widget ou un relation manager est un composant à état.

- **Méthodes** : seules celles nommées dans `static callable = [...]` sont appelables depuis le navigateur. C'est une liste d'autorisation : tout ce que vous y mettez devient une porte d'entrée, à traiter comme une route publique (vérifiez les droits, validez les arguments).
- **Propriétés** : celles qui ne commencent pas par `_` sont lisibles et modifiables par le navigateur. N'y mettez ni secret ni donnée de confiance ; préfixez par `_` ce qui est interne, et listez dans `static locked = [...]` celles que le navigateur ne doit pas modifier.

### 7. Les requêtes que vous écrivez

Dans `modify`, un filtre personnalisé, une action : passez toujours les valeurs en paramètres liés.

```ts
query.where('status', value);                              // bien
query.whereRaw('lower(name) like ?', [`%${search}%`]);     // bien
query.whereRaw(`name like '%${search}%'`);                 // injection SQL
```

### 8. Les fichiers

Indiquez `acceptedFileTypes`, limitez `maxSize`, et ne servez pas en statique des documents qui doivent rester privés. Voir [Fichiers](10-fichiers.md).

## Avant la mise en production

- [ ] `APP_KEY` aléatoire, fournie par l'environnement, démarrage refusé si absente
- [ ] Mots de passe stockés en empreinte
- [ ] HTTPS, et `trust proxy` réglé s'il y a un proxy
- [ ] `modify` restreint chaque adaptateur à ce que l'utilisateur peut voir
- [ ] Actions sensibles protégées par `visible` / `hidden`
- [ ] `acceptedFileTypes` sur chaque `FileUpload`
- [ ] Aucune donnée non échappée dans `Html.make` et les widgets personnalisés
- [ ] `NODE_ENV=production`
