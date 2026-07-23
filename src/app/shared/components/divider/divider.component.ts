import { Component } from '@angular/core';

/**
 * Remplacement maison de `p-divider` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Toujours horizontal (seul usage dans ce projet) :
 * une ligne pleine largeur, ou deux demi-lignes encadrant le contenu projeté
 * s'il y en a (voir `:not(:empty)` dans le SCSS — pas de logique JS
 * nécessaire pour distinguer les deux cas).
 */
@Component({
  selector: 'app-divider',
  standalone: true,
  templateUrl: './divider.component.html',
  styleUrl: './divider.component.scss',
})
export class DividerComponent {}
