import { Component } from '@angular/core';

/**
 * Remplacement maison de `p-toolbar` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Seul usage dans ce projet (trips.component, barre
 * du haut) : trois slots projetés (start/center/end) plutôt que les
 * `<ng-template #start>` de PrimeNG.
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {}
