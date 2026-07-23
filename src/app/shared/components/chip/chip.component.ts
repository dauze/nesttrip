import { Component, input, output } from '@angular/core';

/**
 * Remplacement maison de `p-chip` (Phase 3 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Seul usage dans ce projet : un chip fichier
 * cliquable (ouvre le fichier) avec bouton de suppression optionnel — le
 * clic sur ce bouton ne doit pas déclencher le `(click)` du chip lui-même,
 * d'où le `stopPropagation` et l'output dédié `remove` (pas de bubbling
 * natif possible ici, contrairement à Button).
 */
@Component({
  selector: 'app-chip',
  standalone: true,
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.scss',
})
export class ChipComponent {
  readonly icon = input<string>('');
  readonly removable = input(false);

  readonly remove = output<void>();

  protected onRemoveClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit();
  }
}
