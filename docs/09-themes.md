# 9. Thèmes

Trois niveaux, du plus simple au plus poussé.

## 1. Couleurs du panel

```ts
import { Color } from '@navette/support';

panel.setColors({
    primary: Color.Emerald,        // une palette Tailwind : Color.Blue, Color.Violet, Color.Amber…
    gray: Color.Slate,             // la teinte des gris : Slate, Zinc, Neutral, Stone
    danger: '#e11d48',             // ou une seule couleur : les onze nuances sont générées
});
```

Couleurs disponibles : `primary`, `gray`, `info`, `success`, `warning`, `danger`. Vous pouvez en ajouter (`brand: '#0ea5e9'`) et les utiliser partout où une couleur est attendue : `Action.make('…').color('brand')`.

Une couleur accepte `#rrggbb` ou `rgb(r, g, b)`. Le contraste du texte sur chaque nuance est calculé pour rester lisible.

## 2. Thèmes au choix de l'utilisateur

Déclarez plusieurs thèmes : l'utilisateur choisit le sien dans son menu, sous le sélecteur clair / sombre. Le choix est gardé dans un cookie.

```ts
panel.themes([
    { id: 'default', label: 'Standard', colors: { primary: Color.Blue } },          // le premier est le thème par défaut
    { id: 'forest', label: 'Forêt', colors: { primary: Color.Emerald, gray: Color.Stone } },
    { id: 'night', label: 'Nuit', colors: { primary: '#8b5cf6' }, font: { family: 'Outfit' }, css: '.fi-sidebar { letter-spacing: .01em; }' },
]);
```

| Clé | Rôle |
|---|---|
| `id` | Identifiant (minuscules, chiffres, tirets). |
| `label` | Nom affiché dans le menu. |
| `colors` | Mêmes valeurs que `setColors` ; elles priment sur celles du panel. |
| `font` | `{ family, url? }`. Sans `url`, la police est chargée depuis Bunny Fonts. |
| `css` | CSS ajouté à la page pour ce thème. Écrit par vous, inséré tel quel. |

Avec un seul thème, le menu ne propose rien. Les couleurs sont résolues à chaque requête : deux utilisateurs peuvent avoir deux thèmes différents en même temps.

Le mode clair / sombre est indépendant du thème et reste au choix de l'utilisateur.

## 3. Feuille de thème compilée (Tailwind)

Pour changer la forme (rayons, espacements, composants) ou utiliser vos propres classes Tailwind dans des pages personnalisées, compilez votre feuille.

`resources/css/theme.css` :

```css
@import '@navette/panels/theme.css';

/* Vos fichiers, pour que Tailwind y trouve les classes utilisées. */
@source '../../resources/**/*.ts';

.fi-sidebar-item-btn { border-radius: 9999px; }
```

```bash
npx @tailwindcss/cli -i resources/css/theme.css -o public/css/theme.css --minify
```

```ts
app.use(express.static('./public'));
panel.theme('/css/theme.css');
```

Sans appel à `theme()`, la feuille par défaut est servie. Toutes les classes de l'interface commencent par `fi-` (`fi-btn`, `fi-ta-row`, `fi-section`…) : ce sont vos points d'accroche.

`apps/demo` contient un exemple complet (`resources/css/theme.css`, script `build:theme`).

## Animations

Le panel ajoute de légères transitions (apparition des pages et des contenus chargés en différé, indicateur d'activité pendant une requête). Pour les désactiver :

```ts
panel.motion(false);
```

Elles respectent le réglage système « réduire les animations ».

## Marque

```ts
panel
    .brandName('Mon dashboard')
    .brandLogo('/images/logo-light.svg')
    .darkModeBrandLogo('/images/logo-dark.svg')
    .brandLogoHeight('2rem')
    .favicon('/images/icon.svg')
    .font('Inter');
```
