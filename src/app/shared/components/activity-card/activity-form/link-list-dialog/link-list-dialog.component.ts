import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';

export interface LinkListDialogData {
  tripId: string;
}

export interface LinkListDialogResult {
  itemId: string;
  title: string;
}

/**
 * Tiroir de sélection "Lier une liste" (voir ROADMAP.md "UX / Interactions",
 * `ActivityFormComponent`) : liste plate des Listes (`Item`, voir
 * notes.model.ts) du trip — pas de regroupement par date ici (les listes
 * n'en ont pas), contrairement à `LinkActivityDialogComponent`. Clic sur une
 * ligne ferme immédiatement avec le choix.
 */
@Component({
  selector: 'app-link-list-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './link-list-dialog.component.html',
  styleUrl: './link-list-dialog.component.scss',
})
export class LinkListDialogComponent {
  private readonly dialogRef = inject(DialogRef<LinkListDialogResult | undefined>);
  private readonly data = inject<LinkListDialogData>(DIALOG_DATA);
  private readonly tripFacade = inject(TripFacade);

  protected readonly items = computed(() => this.tripFacade.getNotesItems(this.data.tripId)());
  protected readonly isEmpty = computed(() => this.items().length === 0);

  protected displayTitle(title: string): string {
    return title.trim() || '(Sans titre)';
  }

  protected select(itemId: string, title: string): void {
    this.dialogRef.close({ itemId, title });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
