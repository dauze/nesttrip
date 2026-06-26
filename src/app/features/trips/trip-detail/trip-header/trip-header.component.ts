import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { Textarea } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { Trip } from '../../trip.model';

@Component({
  selector: 'app-trip-header',
  standalone: true,
  imports: [ReactiveFormsModule, CardModule, Textarea, DatePickerModule],
  templateUrl: './trip-header.component.html',
  styleUrl: './trip-header.component.scss',
})
export class TripHeaderComponent {
  private readonly fb = inject(FormBuilder);

  readonly trip = input<Trip | null>(null);
  readonly title = input<string>('');

  readonly titleChange = output<string>();
  readonly datesChange = output<[Date, Date]>();

  readonly dateForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
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

  protected onTitleBlur(value: string): void {
    const trimmed = value.trim();
    const current = this.trip()?.title ?? this.title();
    if (!trimmed || trimmed === current) return;
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