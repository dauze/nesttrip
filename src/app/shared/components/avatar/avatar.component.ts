import { Component, HostBinding, input } from '@angular/core';

/**
 * Remplacement maison de `p-avatar` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Host-as-box comme Tag/Message (voir leur doc) :
 * pas d'élément interne, juste le label centré. `pTooltip` (PrimeNG,
 * toujours en place jusqu'à sa Phase 7) continue de s'appliquer directement
 * sur `<app-avatar>` sans changement, indépendant du composant qui le porte.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  readonly label = input<string>('');
  readonly shape = input<'circle' | 'square'>('circle');
  readonly size = input<'normal' | 'large' | 'xlarge'>('normal');

  @HostBinding('class')
  protected get hostClass(): string {
    return `app-avatar app-avatar--${this.shape()} app-avatar--${this.size()}`;
  }
}
