import { ChangeDetectionStrategy, Component, HostBinding, input, model } from '@angular/core';

export interface SelectButtonOption<T = unknown> {
  label: string;
  value: T;
  icon?: string;
}

export type SelectButtonVariant = 'solid' | 'subtle';

/**
 * Remplacement maison de `p-selectbutton` (Phase 4 de la sortie de PrimeNG,
 * voir PRIMENG_MIGRATION.md). Options `{label, value, icon}` directement
 * plutôt que le `<ng-template #item>` de PrimeNG — inutile de gérer un
 * TemplateRef arbitraire pour un appelant dont la forme des options est déjà
 * connue.
 *
 * `variant` : `'solid'` (défaut, historique — bascule Activités/Notes de
 * general-panel, pleine largeur, remplissage couleur primaire) ou `'subtle'`
 * (pilule compacte, largeur auto, surbrillance discrète — pour une bascule
 * secondaire qui ne doit pas visuellement rivaliser avec un `'solid'` déjà
 * affiché juste au-dessus, ex. tri Ville/Chronologique dans l'onglet
 * Activités).
 */
@Component({
  selector: 'app-select-button',
  standalone: true,
  templateUrl: './select-button.component.html',
  styleUrl: './select-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectButtonComponent<T = unknown> {
  readonly options = input.required<SelectButtonOption<T>[]>();
  readonly value = model<T | undefined>(undefined);
  readonly variant = input<SelectButtonVariant>('solid');

  @HostBinding('class')
  protected get hostClass(): string {
    return `app-select-button--${this.variant()}`;
  }

  protected select(option: SelectButtonOption<T>): void {
    this.value.set(option.value);
  }
}
