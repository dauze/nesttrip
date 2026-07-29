import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardComponent } from '@app/shared/components/card/card.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { SelectComponent } from '@app/shared/components/select/select.component';
import { CURRENCY_OPTIONS } from '@app/shared/components/activity-card/activity.constants';
import { Trip } from '../../trip.model';

@Component({
  selector: 'app-trip-header',
  standalone: true,
  imports: [ReactiveFormsModule, CardComponent, TextareaDirective, DatePickerComponent, SelectComponent],
  templateUrl: './trip-header.component.html',
  styleUrl: './trip-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripHeaderComponent {
  private readonly fb = inject(FormBuilder);

  readonly trip = input<Trip | null>(null);
  readonly title = input<string>('');
  /** Devise par défaut du trip — signal dédié côté TripFacade, pas lu depuis `trip()` (voir TripStore._tripCurrency, ROADMAP.md "Devise"). */
  readonly currency = input<string>('EUR');

  readonly titleChange = output<string>();
  readonly datesChange = output<[Date, Date]>();
  readonly currencyChange = output<string>();

  readonly currencyOptions = CURRENCY_OPTIONS;

  readonly dateForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
  });

  readonly currencyControl = this.fb.nonNullable.control<string>('EUR');

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

    // Séparé du reste (voir `currency` input) : ne doit pas dépendre de
    // `lastPatchedTripId`, sinon un changement de devise arrivant après le
    // premier patch (ex. autre onglet/collaborateur) ne serait jamais repris.
    effect(() => {
      this.currencyControl.setValue(this.currency(), { emitEvent: false });
    });

    this.currencyControl.valueChanges.subscribe((currency) => {
      if (currency !== this.currency()) this.currencyChange.emit(currency);
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