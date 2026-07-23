import { Component, HostBinding, computed, input } from '@angular/core';

export type TagSeverity = 'primary' | 'secondary' | 'danger' | 'success' | 'warn' | 'info';

/**
 * Remplacement maison de `p-tag` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Contrairement à Button, pas d'élément interne
 * séparé : le :host EST le pill visuel (comme le faisait `<p-tag>` lui-même),
 * pour qu'une classe utilitaire posée sur `<app-tag class="...">` par un
 * consommateur s'applique directement à la même boîte, sans wrapper
 * intermédiaire qui l'empêcherait de porter (voir ButtonComponent, qui a
 * besoin d'un `<button>` interne réel, lui, pour la sémantique de formulaire).
 */
@Component({
  selector: 'app-tag',
  standalone: true,
  templateUrl: './tag.component.html',
  styleUrl: './tag.component.scss',
})
export class TagComponent {
  readonly value = input<string>('');
  readonly severity = input<TagSeverity | undefined>(undefined);

  protected readonly effectiveSeverity = computed<TagSeverity>(() => this.severity() ?? 'primary');

  @HostBinding('class')
  protected get hostClass(): string {
    return `app-tag app-tag--${this.effectiveSeverity()}`;
  }
}
