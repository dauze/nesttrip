import { Component, input } from '@angular/core';

/**
 * Remplacement maison de `p-progressSpinner` (Phase 3 de la sortie de
 * PrimeNG, voir PRIMENG_MIGRATION.md). Anneau CSS pur (border-spin) plutôt
 * que le SVG animé de PrimeNG — mêmes deux usages dans ce projet, tous deux
 * de petite taille, un anneau CSS suffit largement. Dimensions posées par le
 * consommateur via `[style]="{ width, height }"` directement sur le host,
 * comme avant.
 */
@Component({
  selector: 'app-progress-spinner',
  standalone: true,
  template: '',
  styleUrl: './progress-spinner.component.scss',
  host: {
    class: 'app-progress-spinner',
    '[style.border-width.px]': 'strokeWidth()',
  },
})
export class ProgressSpinnerComponent {
  readonly strokeWidth = input(2);
}
