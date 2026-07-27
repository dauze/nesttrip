import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, tap } from 'rxjs/operators';

import { SelectComponent } from '@app/shared/components/select/select.component';
import { InputNumberComponent } from '@app/shared/components/input-number/input-number.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { TimePickerDialogComponent } from '@app/shared/components/time-picker-dialog/time-picker-dialog.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { PlaceSummary } from '@core/models/place.dto';
import { BookingStatus } from '@core/enums/booking.status';
import { BOOKING_STATUS_META, BOOKING_STATUS_OPTIONS } from '@app/shared/components/activity-card/activity.constants';
import { Reservation, ReservationType } from '@core/models/reservation.dto';
import { RESERVATION_TYPE_META, RESERVATION_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../../reservation.constants';
import { HotelFieldsComponent } from '../../reservation-form/hotel-fields/hotel-fields.component';
import { FlightFieldsComponent } from '../../reservation-form/flight-fields/flight-fields.component';
import { CarRentalFieldsComponent } from '../../reservation-form/car-rental-fields/car-rental-fields.component';
import { GenericFieldsComponent } from '../../reservation-form/generic-fields/generic-fields.component';
import { FlightStatusBadgeComponent } from '../../flight-status-badge/flight-status-badge.component';
import { ReservationPlaceInfoComponent } from '../reservation-place-info/reservation-place-info.component';

interface SelectedPlaces {
  place?: PlaceSummary;
  departureAirport?: PlaceSummary;
  arrivalAirport?: PlaceSummary;
  pickupPlace?: PlaceSummary;
  dropoffPlace?: PlaceSummary;
}

function initialPlacesFrom(reservation: Reservation): SelectedPlaces {
  switch (reservation.type) {
    case 'hotel':
    case 'other':
      return { place: reservation.place };
    case 'flight':
      return { departureAirport: reservation.departureAirport, arrivalAirport: reservation.arrivalAirport };
    case 'carRental':
      return { pickupPlace: reservation.pickupPlace, dropoffPlace: reservation.dropoffPlace };
  }
}

/**
 * Corps de la carte réservation dépliée : type + dates + prix + notes +
 * champ(s) "lieu" propre au type sélectionné — édition live avec debounce
 * 300ms, exactement comme `ActivityFormComponent`, jamais de bouton
 * Enregistrer/Annuler. Un seul `FormGroup` plat (pas de `detailsForm` séparé
 * reconstruit au changement de type) : les champs texte propres à un type
 * (compagnie, n° de vol) sont de simples contrôles supplémentaires du même
 * form, affichés/masqués selon `selectedType()` — bien plus simple à
 * synchroniser qu'un couple form commun/détails vu l'édition live.
 */
@Component({
  selector: 'app-reservation-details',
  standalone: true,
  imports: [
    NgClass, ReactiveFormsModule, SelectComponent, InputNumberComponent, DatePickerComponent, TimePickerDialogComponent,
    DividerComponent, TextareaDirective,
    HotelFieldsComponent, FlightFieldsComponent, CarRentalFieldsComponent, GenericFieldsComponent,
    FlightStatusBadgeComponent, ReservationPlaceInfoComponent,
  ],
  templateUrl: './reservation-details.component.html',
  styleUrl: './reservation-details.component.scss',
})
export class ReservationDetailsComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly fb = inject(FormBuilder);

  readonly tripId = input.required<string>();
  readonly reservation = input.required<Reservation>();

  readonly typeOptions = RESERVATION_TYPE_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;

  readonly form = this.fb.group({
    type: this.fb.nonNullable.control<ReservationType>('other'),
    startDate: this.fb.control<Date | null>(null),
    startTime: this.fb.control<Date | null>(null),
    endDate: this.fb.control<Date | null>(null),
    endTime: this.fb.control<Date | null>(null),
    notes: this.fb.nonNullable.control<string>(''),
    price: this.fb.group({
      amount: this.fb.nonNullable.control<number>(0),
      currency: this.fb.nonNullable.control<string>('EUR'),
    }),
    booking: this.fb.group({
      status: this.fb.nonNullable.control<BookingStatus>(BookingStatus.NOT_NEEDED),
      deadline: this.fb.control<Date | null>(null),
    }),
    airline: this.fb.nonNullable.control<string>(''),
    flightNumber: this.fb.nonNullable.control<string>(''),
    company: this.fb.nonNullable.control<string>(''),
  });

  private readonly selectedPlaces = signal<SelectedPlaces>({});

  private readonly formChanges = toSignal(this.form.valueChanges, { initialValue: null });

  readonly formValue = computed(() => {
    this.reservation();    // Dépendance 1 : se réévalue si l'input change
    this.formChanges();    // Dépendance 2 : se réévalue si l'utilisateur tape
    return this.form.getRawValue();
  });

  readonly selectedType = computed(() => this.formValue().type);
  readonly dateLabels = computed(() => RESERVATION_TYPE_META[this.selectedType()]);
  readonly currentPlaces = computed(() => this.selectedPlaces());

  readonly bookingMeta = computed(() => BOOKING_STATUS_META[this.formValue().booking?.status ?? BookingStatus.NOT_NEEDED]);

  readonly showDeadline = computed(() => {
    const status = this.formValue().booking?.status ?? BookingStatus.NOT_NEEDED;
    return [BookingStatus.TO_BOOK, BookingStatus.WAITLIST].includes(status);
  });

  readonly isDeadlineSoon = computed(() => {
    const deadline = this.formValue().booking?.deadline;
    if (!deadline) return false;
    return new Date(deadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  });

  /** Même garde-fou anti-course que `ActivityFormComponent.hasUnflushedLocalEdit` — voir sa doc. */
  private hasUnflushedLocalEdit = false;
  private lastSyncedReservationId: string | undefined;

  constructor() {
    effect(() => {
      const r = this.reservation();
      if (!r) return;

      if (this.hasUnflushedLocalEdit && r.id === this.lastSyncedReservationId) return;
      this.lastSyncedReservationId = r.id;

      this.form.patchValue({
        type: r.type,
        startDate: r.startDateTime,
        startTime: r.startDateTime,
        endDate: r.endDateTime,
        endTime: r.endDateTime,
        notes: r.notes ?? '',
        price: r.price ?? { amount: 0, currency: 'EUR' },
        booking: r.booking,
        airline: r.type === 'flight' ? (r.airline ?? '') : '',
        flightNumber: r.type === 'flight' ? (r.flightNumber ?? '') : '',
        company: r.type === 'carRental' ? (r.company ?? '') : '',
      }, { emitEvent: false });

      this.selectedPlaces.set(initialPlacesFrom(r));
    });

    this.form.valueChanges.pipe(
      tap(() => { this.hasUnflushedLocalEdit = true; }),
      debounceTime(300),
      takeUntilDestroyed(),
    ).subscribe(() => this.commit());
  }

  onPlaceSelected(key: keyof SelectedPlaces, place: PlaceSummary): void {
    this.selectedPlaces.update((s) => ({ ...s, [key]: place }));
    this.commit();
  }

  private commit(): void {
    const reservation = this.reservation();
    if (!reservation) return;

    const value = this.form.getRawValue();
    this.hasUnflushedLocalEdit = false;

    const startDateTime = this.combineDateTime(value.startDate, value.startTime) ?? reservation.startDateTime;
    const endDateTime = this.combineDateTime(value.endDate, value.endTime) ?? startDateTime;
    const places = this.selectedPlaces();

    const base = {
      id: reservation.id,
      title: reservation.title,
      startDateTime,
      endDateTime,
      notes: value.notes,
      files: reservation.files ?? [],
      links: reservation.links ?? [],
      booking: { ...value.booking, deadline: value.booking.deadline ?? undefined },
      ...(reservation.referenceNumber ? { referenceNumber: reservation.referenceNumber } : {}),
      ...(value.price.amount ? { price: value.price } : {}),
    };

    let updated: Reservation;
    switch (value.type) {
      case 'hotel':
        updated = { ...base, type: 'hotel', ...(places.place ? { place: places.place } : {}) };
        break;
      case 'flight':
        updated = {
          ...base,
          type: 'flight',
          ...(value.airline ? { airline: value.airline } : {}),
          ...(value.flightNumber ? { flightNumber: value.flightNumber } : {}),
          ...(places.departureAirport ? { departureAirport: places.departureAirport } : {}),
          ...(places.arrivalAirport ? { arrivalAirport: places.arrivalAirport } : {}),
          ...(reservation.type === 'flight' && reservation.status
            ? { status: reservation.status, statusFetchedAt: reservation.statusFetchedAt }
            : {}),
        };
        break;
      case 'carRental':
        updated = {
          ...base,
          type: 'carRental',
          ...(value.company ? { company: value.company } : {}),
          ...(places.pickupPlace ? { pickupPlace: places.pickupPlace } : {}),
          ...(places.dropoffPlace ? { dropoffPlace: places.dropoffPlace } : {}),
        };
        break;
      case 'other':
        updated = { ...base, type: 'other', ...(places.place ? { place: places.place } : {}) };
        break;
    }

    this.tripFacade.updateReservation(this.tripId(), updated);
  }

  private combineDateTime(date: Date | null, time: Date | null): Date | null {
    if (!date) return null;
    const combined = new Date(date);
    if (time) combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    else combined.setHours(0, 0, 0, 0);
    return combined;
  }
}
