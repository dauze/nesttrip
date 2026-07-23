import { Component, input, output } from '@angular/core';

/**
 * Habillage visuel commun (header + titre + bouton fermer, zone de contenu,
 * zone de footer) pour les dialogs maison ouverts via DialogService (Phase 2
 * de la sortie de PrimeNG, voir PRIMENG_MIGRATION.md). Purement
 * présentationnel : ne dépend pas de DialogRef, le composant hôte décide de
 * ce que fait `closeRequested` (typiquement `dialogRef.close()`).
 */
@Component({
  selector: 'app-dialog-frame',
  standalone: true,
  templateUrl: './dialog-frame.component.html',
  styleUrl: './dialog-frame.component.scss',
})
export class DialogFrameComponent {
  readonly title = input<string>('');
  readonly showCloseButton = input(true);

  readonly closeRequested = output<void>();
}
