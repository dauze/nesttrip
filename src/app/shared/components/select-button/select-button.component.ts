import { Component, input, model } from '@angular/core';

export interface SelectButtonOption<T = unknown> {
  label: string;
  value: T;
  icon?: string;
}

/**
 * Remplacement maison de `p-selectbutton` (Phase 4 de la sortie de PrimeNG,
 * voir PRIMENG_MIGRATION.md). Seul usage dans ce projet (general-panel,
 * bascule Activités/Notes) : options `{label, value, icon}` directement
 * plutôt que le `<ng-template #item>` de PrimeNG — inutile de gérer un
 * TemplateRef arbitraire pour un seul appelant dont la forme des options
 * est déjà connue.
 */
@Component({
  selector: 'app-select-button',
  standalone: true,
  templateUrl: './select-button.component.html',
  styleUrl: './select-button.component.scss',
})
export class SelectButtonComponent<T = unknown> {
  readonly options = input.required<SelectButtonOption<T>[]>();
  readonly value = model<T | undefined>(undefined);

  protected select(option: SelectButtonOption<T>): void {
    this.value.set(option.value);
  }
}
