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
  // Volontairement PAS `title` : un attribut statique `title="..."` (sans
  // crochets) sur un tag de composant est aussi écrit tel quel comme
  // attribut HTML natif sur l'élément hôte, en plus d'initialiser l'input —
  // le navigateur affichait alors SA PROPRE bulle native (celle du titre du
  // dialog) au survol de n'importe quel descendant sans tooltip à lui,
  // masquant/perturbant `appTooltip`. `header` (même nom que PanelComponent)
  // n'entre pas en collision avec un attribut HTML global.
  readonly header = input<string>('');
  readonly showCloseButton = input(true);

  readonly closeRequested = output<void>();
}
