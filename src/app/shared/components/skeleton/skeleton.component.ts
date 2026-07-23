import { Component, computed, input } from '@angular/core';

/**
 * Remplacement maison de `p-skeleton` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Purement décoratif : le :host EST le bloc animé,
 * pas de template (dimensions/rayon posés en bindings de style sur le host).
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: '',
  styleUrl: './skeleton.component.scss',
  host: {
    class: 'app-skeleton',
    '[style.width]': 'effectiveWidth()',
    '[style.height]': 'effectiveHeight()',
    '[style.borderRadius]': 'borderRadius()',
    '[class.app-skeleton--circle]': "shape() === 'circle'",
  },
})
export class SkeletonComponent {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly borderRadius = input('4px');
  readonly shape = input<'rectangle' | 'circle' | 'square'>('rectangle');
  readonly size = input<string | undefined>(undefined);

  protected readonly effectiveWidth = computed(() => {
    const size = this.size();
    return size && this.shape() !== 'rectangle' ? size : this.width();
  });

  protected readonly effectiveHeight = computed(() => {
    const size = this.size();
    return size && this.shape() !== 'rectangle' ? size : this.height();
  });
}
