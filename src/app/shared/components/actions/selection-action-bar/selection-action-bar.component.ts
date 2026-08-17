import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';

/**
 * Le "drawer" du mode sélection multiple : barre fixe en bas d'écran,
 * recouvrant volontairement toute barre de navigation fixe en dessous (voir
 * styleUrl) tant qu'une sélection est active. Montée une seule fois par écran
 * (même topologie que FloatingAddButtonComponent) — visible via `count() > 0`.
 */
@Component({
  selector: 'app-selection-action-bar',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './selection-action-bar.component.html',
  styleUrl: './selection-action-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionActionBarComponent {
  readonly count = input.required<number>();
  /** Hauteur mini (px) à réserver, pour recouvrir entièrement la barre qu'elle remplace (ex. `TripChromeService.tabsNavHeight()`) — même pattern générique que `FloatingAddButtonComponent.bottomOffset`. */
  readonly minHeight = input<number>(0);

  readonly cancelSelection = output<void>();
  readonly deleteSelected = output<void>();
}
