import { Component } from '@angular/core';

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
})
export class CardComponent {}
