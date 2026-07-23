import { Component, HostBinding, computed, input } from '@angular/core';

export type MessageSeverity = 'info' | 'success' | 'warn' | 'error';

const DEFAULT_ICON: Record<MessageSeverity, string> = {
  info: 'pi pi-info-circle',
  success: 'pi pi-check-circle',
  warn: 'pi pi-exclamation-triangle',
  error: 'pi pi-times-circle',
};

/**
 * Remplacement maison de `p-message` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Comme TagComponent, le :host EST la boîte visuelle
 * (pas d'élément interne) : une classe utilitaire posée par le consommateur
 * (`class="w-full ..."`) s'applique donc directement, sans wrapper.
 */
@Component({
  selector: 'app-message',
  standalone: true,
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss',
})
export class MessageComponent {
  readonly text = input<string>('');
  readonly severity = input<MessageSeverity>('info');
  readonly icon = input<string | undefined>(undefined);

  protected readonly effectiveIcon = computed(() => this.icon() ?? DEFAULT_ICON[this.severity()]);

  @HostBinding('class')
  protected get hostClass(): string {
    return `app-message app-message--${this.severity()}`;
  }
}
