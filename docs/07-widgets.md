# 7. Widgets

Un widget est un bloc affiché en tête d'une page. Il est chargé quand il devient visible, sans retarder la page.

## Rangée de statistiques

```ts
import { Stat, StatsOverviewWidget } from '@navette-js/panels';

class SalesStats extends StatsOverviewWidget {
    static pollingInterval = '30s';             // rafraîchissement ; null pour ne pas rafraîchir (défaut : '5s')

    async getStats(): Promise<Stat[]> {
        const row = await knex('orders').sum({ total: 'total_price' }).count({ n: '*' }).first();
        return [
            Stat.make('Commandes', Number(row.n)),
            Stat.make('Chiffre d\'affaires', new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(row.total)))
                .description('+12 % sur un mois').descriptionIcon('m-arrow-trending-up').color('success')
                .chart([7, 9, 8, 12, 14, 13, 17]),
            Stat.make('Panier moyen', '54,20 €').icon('m-shopping-cart').url('/shop/orders'),
        ];
    }
}
```

`Stat` : `description(texte)`, `descriptionIcon(icône, 'before' | 'after')`, `color(couleur)` (description et courbe), `icon(icône)`, `chart(valeurs)` (courbe de tendance), `url(adresse)`.

Trois statistiques par rangée ; quatre quand leur nombre s'y prête (4, 7…).

## Enregistrer et afficher

Un widget doit être enregistré (par une resource ou par le panel), puis affiché par une page.

```ts
class OrderResource extends Resource {
    static widgets = [SalesStats];              // enregistrement
    static headerWidgets = [SalesStats];        // affichage au-dessus de la liste
}
```

Sur une page libre ou le tableau de bord :

```ts
class Home extends Dashboard {
    getHeaderWidgets() { return [SalesStats]; }
    getHeaderWidgetsColumns() { return 2; }     // grille de widgets (défaut : 2)
}
```

`static columnSpan` règle la largeur d'un widget dans cette grille : un nombre de colonnes ou `'full'` (défaut des statistiques).

Un widget qui n'appartient à aucune resource s'enregistre sur le panel : `panel.widgets([SalesStats])`. Un widget affiché sans avoir été enregistré provoque une erreur « Composant inconnu ».

## Statistiques liées à la table

`PageTableStatsWidget` reçoit l'état de la table de la page de liste (recherche, filtres, onglet) et agrège exactement les lignes qu'elle affiche. Les chiffres suivent donc chaque recherche et chaque filtre.

```ts
import { PageTableStatsWidget, Stat } from '@navette-js/panels';

class TaskStats extends PageTableStatsWidget {
    static pollingInterval = null;
    static tablePage = () => TaskResource.getPages().index as any;

    async getStats(): Promise<Stat[]> {
        const all = await this.aggregatePageTable({ sum: ['estimate'], avg: ['estimate'] });
        // Second argument : une restriction propre à cette statistique.
        const open = await this.aggregatePageTable({}, (query) => { query.where('is_done', 0); });
        return [
            Stat.make('Tâches', all.count),
            Stat.make('Heures estimées', all.sum.estimate),
            Stat.make('À faire', open.count).color('warning'),
        ];
    }
}
```

`aggregatePageTable(colonnes, restriction)` rend `{ count, sum, avg }`. Les colonnes peuvent être des alias calculés par l'adaptateur.

## Widget personnalisé

Héritez de `Widget` et rendez votre HTML dans `render()`, enveloppé par `this.wrap(...)`.

```ts
import { Widget } from '@navette-js/panels';
import { e } from '@navette-js/support';

class Welcome extends Widget {
    static columnSpan = 'full' as const;
    static isLazy = false;                      // rendu avec la page
    async render(): Promise<string> {
        const user = (this._ctx as any).user;
        return this.wrap(`<section class="fi-section"><div class="fi-section-content-ctn"><div class="fi-section-content">Bonjour ${e(user.name)}</div></div></section>`);
    }
}
```

Un widget est un composant à état : ses propriétés publiques voyagent avec le navigateur, ses méthodes publiques y sont appelables. Échappez avec `e()` tout ce qui vient des données.
