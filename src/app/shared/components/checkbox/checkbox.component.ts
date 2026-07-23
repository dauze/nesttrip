import { Component, input, model } from '@angular/core';

/**
 * Remplacement maison de `p-checkbox` (Phase 4 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Aucun des trois usages du projet ne passe par
 * `formControlName` (seulement `[ngModel]`/`[(ngModel)]`) : `model()` suffit
 * donc, pas besoin d'un ControlValueAccessor.
 */
@Component({
  selector: 'app-checkbox',
  standalone: true,
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss',
})
export class CheckboxComponent {
  readonly checked = model(false);
  readonly disabled = input(false);

  protected toggle(): void {
    if (this.disabled()) return;
    this.checked.update((v) => !v);
  }
}
