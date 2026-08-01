import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { format } from 'date-fns';
import { CardComponent } from '@app/shared/components/card/card.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { DialogService } from '@app/shared/services/dialog.service';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';
import { Trip } from '../../trip.model';

@Component({
  selector: 'app-trip-header',
  standalone: true,
  imports: [ReactiveFormsModule, CardComponent, DatePickerComponent],
  templateUrl: './trip-header.component.html',
  styleUrl: './trip-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripHeaderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly trip = input<Trip | null>(null);
  readonly title = input<string>('');

  readonly titleChange = output<string>();
  readonly datesChange = output<[Date, Date]>();

  private readonly datePickerRef = viewChild(DatePickerComponent);

  readonly dateForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
  });

  /** Libellé "Date : " affiché en lecture seule à côté du crayon — voir `openDatePicker`. */
  readonly dateRangeLabel = computed(() => {
    const dates = this.dateForm.value.dates;
    const [start, end] = dates ?? [];
    if (!start || !end) return '';
    return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
  });

  private lastPatchedTripId: string | null = null;

  constructor() {
    // Initialise la plage de dates une seule fois par trip chargé (et seulement
    // quand les jours sont dispo), pour ne pas écraser une saisie en cours de l'utilisateur.
    effect(() => {
      const trip = this.trip();
      if (!trip || !trip.days.length) return;
      if (this.lastPatchedTripId === trip.id) return;

      this.lastPatchedTripId = trip.id;
      this.patchFromTrip(trip);
    });
  }

  /** Titre en lecture seule + crayon dédié (voir ROADMAP.md "UX / Interactions") — même popup texte simple que les titres Logistique. */
  protected openTitleDialog(): void {
    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      {
        data: { initialValue: this.title(), placeholder: 'Titre du voyage', title: 'Titre' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result === undefined) return;
      this.onTitleBlur(result);
    });
  }

  /** Dates en lecture seule + crayon dédié : ouvre le même calendrier qu'avant, juste plus caché derrière un déclencheur explicite. */
  protected openDatePicker(): void {
    this.datePickerRef()?.openPanel();
  }

  protected onTitleBlur(value: string): void {
    const trimmed = value.trim();
    if (!trimmed || trimmed === this.title()) return;
    this.titleChange.emit(trimmed);
  }

  protected onDatesSelected(): void {
    const dates = this.dateForm.value.dates;
    if (!dates || !dates[0] || !dates[1]) return;
    this.datesChange.emit([dates[0], dates[1]]);
  }

  /** Permet au parent de revenir à la plage d'origine si l'utilisateur annule une suppression. */
  resetDates(): void {
    const trip = this.trip();
    if (!trip || !trip.days.length) return;
    this.patchFromTrip(trip);
  }

  private patchFromTrip(trip: Trip): void {
    const sorted = trip.days.slice().sort((a, b) => a.id.getTime() - b.id.getTime());
    this.dateForm.patchValue(
      { dates: [sorted[0].id, sorted[sorted.length - 1].id] },
      { emitEvent: false }
    );
  }
}
