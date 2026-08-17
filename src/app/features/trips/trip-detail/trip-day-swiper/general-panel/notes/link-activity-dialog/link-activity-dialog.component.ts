import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity } from '@app/shared/components/activity-card/activity.model';

export interface LinkActivityDialogData {
  tripId: string;
}

export interface LinkActivityDialogResult {
  instanceId: string;
  title: string;
}

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'item'; activity: Activity };

/**
 * Tiroir de sélection "Lier une activité" (voir ROADMAP.md "UX /
 * Interactions", `NotesComponent`) : liste PLATE (voir la doc de
 * `LogisticsListComponent.typeRows` pour la raison — même principe,
 * en-têtes de jour + activités dans une seule boucle `@for`) des activités
 * du trip, groupées par jour chronologique, dates visibles en en-tête de
 * section. Clic sur une ligne ferme immédiatement avec le choix, pas de
 * "OK" séparé (même pattern que `TitleEditDialogComponent`).
 */
@Component({
  selector: 'app-link-activity-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './link-activity-dialog.component.html',
  styleUrl: './link-activity-dialog.component.scss',
})
export class LinkActivityDialogComponent {
  private readonly dialogRef = inject(DialogRef<LinkActivityDialogResult | undefined>);
  private readonly data = inject<LinkActivityDialogData>(DIALOG_DATA);
  private readonly tripFacade = inject(TripFacade);

  protected readonly rows = computed<Row[]>(() => {
    const trip = this.tripFacade.activeTrip();
    if (!trip || trip.id !== this.data.tripId) return [];

    const days = trip.days.slice().sort((a, b) => a.id.getTime() - b.id.getTime());
    const rows: Row[] = [];
    for (const day of days) {
      const activities = this.tripFacade.getDayActivities(day.id)();
      if (!activities.length) continue;
      rows.push({ kind: 'header', label: this.formatDay(day.id) });
      for (const activity of activities) rows.push({ kind: 'item', activity });
    }
    return rows;
  });

  protected readonly isEmpty = computed(() => this.rows().length === 0);

  private formatDay(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  }

  protected select(activity: Activity): void {
    this.dialogRef.close({ instanceId: activity.id, title: activity.title });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
