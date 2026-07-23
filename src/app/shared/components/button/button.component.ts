import { Component, computed, input } from '@angular/core';

export type ButtonSeverity = 'primary' | 'secondary' | 'danger' | 'success' | 'warn' | 'info';

/**
 * Remplacement maison de `p-button` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). API volontairement proche de l'original pour un
 * portage mécanique des templates : label/icon/severity/text/outlined/
 * rounded/size/type/link/loading/disabled. Pas d'output `click` dédié : un
 * clic sur le `<button>` interne bubble naturellement jusqu'au tag hôte,
 * donc `(click)="..."` posé sur `<app-button>` fonctionne comme avant sur
 * `<p-button>`.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  readonly label = input<string>('');
  readonly icon = input<string>('');
  readonly severity = input<ButtonSeverity | undefined>(undefined);
  readonly text = input(false);
  readonly outlined = input(false);
  readonly rounded = input(false);
  readonly link = input(false);
  readonly size = input<'small' | 'normal' | 'large'>('normal');
  readonly type = input<'button' | 'submit'>('button');
  readonly loading = input(false);
  readonly disabled = input(false);

  protected readonly effectiveSeverity = computed<ButtonSeverity>(() => this.severity() ?? 'primary');
  protected readonly isDisabled = computed(() => this.disabled() || this.loading());
}
