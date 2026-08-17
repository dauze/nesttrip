import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { CheckboxComponent } from '@app/shared/components/form-fields/checkbox/checkbox.component';
import { INTEREST_OPTIONS, Interest } from '../../trip-ai-preferences.model';

export interface InterestsDialogData {
  selected: Interest[];
}

/**
 * Tiroir de sélection multiple "Centres d'intérêt" (dialogue IA, voir
 * process-creation-trip-ia.md §2.3) — même anatomie que
 * `LinkListDialogComponent` (header sticky + liste scrollable), mais chaque
 * ligne coche/décoche au lieu de fermer immédiatement : la fermeture se fait
 * via "Valider", qui renvoie la sélection complète.
 */
@Component({
  selector: 'app-interests-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CheckboxComponent],
  templateUrl: './interests-dialog.component.html',
  styleUrl: './interests-dialog.component.scss',
})
export class InterestsDialogComponent {
  private readonly dialogRef = inject(DialogRef<Interest[] | undefined>);
  private readonly data = inject<InterestsDialogData>(DIALOG_DATA);

  protected readonly options = INTEREST_OPTIONS;
  protected readonly selected = signal<Set<Interest>>(new Set(this.data.selected));

  protected isSelected(value: Interest): boolean {
    return this.selected().has(value);
  }

  protected toggle(value: Interest): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  protected confirm(): void {
    this.dialogRef.close([...this.selected()]);
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
