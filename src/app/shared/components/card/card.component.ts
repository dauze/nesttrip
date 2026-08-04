import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Remplacement maison de `p-card` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Quatre slots projetés plutôt que les
 * `<ng-template pTemplate="title">`/`#header` de PrimeNG :
 * - `[cardHeader]` : zone libre pleine largeur avant le corps (trip-header,
 *   qui y re-projette elle-même son propre contenu `[trip-actions]`).
 * - `[cardTitle]` : ligne de titre (souvent titre + bouton).
 * - contenu par défaut : corps.
 * - `[cardFooter]` : ligne d'actions en pied de carte.
 * Slots vides = pas de contenu projeté = pas de boîte visible (voir
 * `:empty` dans le SCSS), donc les usages "carte simple" (login,
 * accueil-trip, notes...) qui n'utilisent aucun slot spécial n'affichent
 * rien en trop.
 */
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-card--fill-height]': 'fillHeight()',
  },
})
export class CardComponent {
  /**
   * Optionnel : la carte s'étire pour occuper toute la hauteur de SON PROPRE
   * parent (au lieu de se dimensionner sur son contenu) et le contenu projeté
   * par défaut (`[cardTitle]`/contenu par défaut/`[cardFooter]` restent en
   * flux normal) devient lui-même un conteneur flex colonne — même pattern
   * que `PanelComponent.fillHeight`. Utilisé par `TripSummaryComponent` pour
   * centrer le montant des dépenses par rapport à la hauteur RESTANTE de la
   * tuile (étirée par `align-items:stretch` pour matcher sa voisine "Résumé",
   * plus haute) — sans ça, le contenu projeté ne remplit jamais la hauteur
   * réellement disponible, juste celle de son propre contenu. N'affecte
   * aucun autre appelant (défaut `false`).
   */
  readonly fillHeight = input(false);
}
