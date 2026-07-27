import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { DialogFrameComponent } from '@app/shared/components/dialog-frame/dialog-frame.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SelectComponent } from '@app/shared/components/select/select.component';
import { InputNumberComponent } from '@app/shared/components/input-number/input-number.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { TimePickerDialogComponent } from '@app/shared/components/time-picker-dialog/time-picker-dialog.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { PlaceSummary } from '@core/models/place.dto';
import { Reservation, ReservationType } from '@core/models/reservation.dto';
import { RESERVATION_TYPE_META, RESERVATION_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../reservation.constants';
import { buildDetailsForm } from './reservation-details-form.factory';
import { HotelFieldsComponent } from './hotel-fields/hotel-fields.component';
import { FlightFieldsComponent } from './flight-fields/flight-fields.component';
import { CarRentalFieldsComponent } from './car-rental-fields/car-rental-fields.component';
import { GenericFieldsComponent } from './generic-fields/generic-fields.component';
import { ReservationFilesComponent } from '../reservation-files/reservation-files.component';

export interface ReservationFormDialogData {
  tripId: string;
  /** Absent = création d'une nouvelle réservation. */
  reservation?: Reservation;
}

interface SelectedPlaces {
  place?: PlaceSummary;
  departureAirport?: PlaceSummary;
  arrivalAirport?: PlaceSummary;
  pickupPlace?: PlaceSummary;
  dropoffPlace?: PlaceSummary;
}

function initialPlacesFrom(reservation: Reservation | undefined): SelectedPlaces {
  if (!reservation) return {};
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
 * Formulaire de création/édition d'une réservation, ouvert en dialog plein
 * écran (voir DialogService). `commonForm` porte les champs partagés à tous
 * les types ; `detailsForm` est détruit/recréé au changement de type (voir
 * `buildDetailsForm`) sans jamais toucher aux valeurs déjà saisies dans
 * `commonForm`. Les champs "lieu" (Google Places) ne vivent dans aucun des
 * deux FormGroup — `AutoCompleteComponent` n'accepte qu'une valeur texte
 * libre — ils sont conservés à part dans `selectedPlaces` et mergés au
 * `type` courant à la sauvegarde.
 */
@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, DialogFrameComponent, ButtonComponent, SelectComponent, InputNumberComponent,
    DatePickerComponent, TimePickerDialogComponent, DividerComponent, InputTextDirective, TextareaDirective,
    HotelFieldsComponent, FlightFieldsComponent, CarRentalFieldsComponent, GenericFieldsComponent,
    ReservationFilesComponent,
  ],
  templateUrl: './reservation-form.component.html',
  styleUrl: './reservation-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationFormComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<ReservationFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = this.data.tripId;
  readonly isEditing = !!this.data.reservation;
  private readonly reservationId = this.data.reservation?.id ?? crypto.randomUUID();

  readonly typeOptions = RESERVATION_TYPE_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;

  readonly commonForm = this.fb.group({
    type: this.fb.nonNullable.control<ReservationType>(this.data.reservation?.type ?? 'hotel'),
    title: this.fb.nonNullable.control<string>(this.data.reservation?.title ?? ''),
    startDate: this.fb.control<Date | null>(this.data.reservation?.startDateTime ?? null),
    startTime: this.fb.control<Date | null>(this.data.reservation?.startDateTime ?? null),
    endDate: this.fb.control<Date | null>(this.data.reservation?.endDateTime ?? null),
    endTime: this.fb.control<Date | null>(this.data.reservation?.endDateTime ?? null),
    referenceNumber: this.fb.nonNullable.control<string>(this.data.reservation?.referenceNumber ?? ''),
    notes: this.fb.nonNullable.control<string>(this.data.reservation?.notes ?? ''),
    price: this.fb.group({
      amount: this.fb.nonNullable.control<number>(this.data.reservation?.price?.amount ?? 0),
      currency: this.fb.nonNullable.control<string>(this.data.reservation?.price?.currency ?? 'EUR'),
    }),
    links: this.fb.array(
      (this.data.reservation?.links ?? []).map((link) =>
        this.fb.group({
          label: this.fb.nonNullable.control<string>(link.label),
          url: this.fb.nonNullable.control<string>(link.url),
        }),
      ),
    ),
  });

  /**
   * Valeurs "lieu" initiales pré-calculées une fois (pas de changement en
   * cours de vie du dialog) — exposées telles quelles au template plutôt que
   * de re-discriminer `data.reservation?.type` inline dans le HTML : le
   * vérificateur de templates AOT ne propage pas le narrowing TypeScript à
   * travers un ternaire dans une expression de binding.
   */
  protected readonly initialPlaces = initialPlacesFrom(this.data.reservation);

  private readonly selectedPlaces = signal<SelectedPlaces>(this.initialPlaces);

  protected readonly selectedType = toSignal(this.commonForm.controls.type.valueChanges, {
    initialValue: this.commonForm.controls.type.value,
  });

  /** Détruit/recrée le bout de formulaire propre au type sans jamais toucher `commonForm` (voir buildDetailsForm). */
  readonly detailsForm = computed(() => buildDetailsForm(this.fb, this.selectedType()));

  readonly dateLabels = computed(() => RESERVATION_TYPE_META[this.selectedType()]);

  readonly canSave = computed(() => {
    const type = this.selectedType();
    const places = this.selectedPlaces();
    switch (type) {
      case 'hotel': return !!places.place;
      case 'flight': return !!places.departureAirport && !!places.arrivalAirport;
      case 'carRental': return !!places.pickupPlace && !!places.dropoffPlace;
      case 'other': return true;
    }
  });

  get linksArray() {
    return this.commonForm.controls.links;
  }

  addLink(): void {
    this.linksArray.push(
      this.fb.group({
        label: this.fb.nonNullable.control<string>(''),
        url: this.fb.nonNullable.control<string>(''),
      }),
    );
  }

  removeLink(index: number): void {
    this.linksArray.removeAt(index);
  }

  onPlaceSelected(key: keyof SelectedPlaces, place: PlaceSummary): void {
    this.selectedPlaces.update((s) => ({ ...s, [key]: place }));
  }

  save(): void {
    if (this.commonForm.invalid || !this.canSave()) {
      this.commonForm.markAllAsTouched();
      return;
    }

    const common = this.commonForm.getRawValue();
    const details = this.detailsForm().getRawValue() as { airline?: string; flightNumber?: string; company?: string };
    const places = this.selectedPlaces();

    const startDateTime = this.combineDateTime(common.startDate, common.startTime);
    if (!startDateTime) return;
    const endDateTime = this.combineDateTime(common.endDate, common.endTime) ?? startDateTime;

    const base = {
      id: this.reservationId,
      title: common.title.trim() || RESERVATION_TYPE_META[common.type].label,
      startDateTime,
      endDateTime,
      notes: common.notes,
      files: this.data.reservation?.files ?? [],
      links: common.links.filter((l) => l.url.trim().length > 0),
      ...(common.referenceNumber.trim() ? { referenceNumber: common.referenceNumber.trim() } : {}),
      ...(common.price.amount ? { price: common.price } : {}),
    };

    let reservation: Reservation;
    switch (common.type) {
      case 'hotel':
        reservation = { ...base, type: 'hotel', place: places.place! };
        break;
      case 'flight':
        reservation = {
          ...base,
          type: 'flight',
          airline: details.airline ?? '',
          flightNumber: details.flightNumber ?? '',
          departureAirport: places.departureAirport!,
          arrivalAirport: places.arrivalAirport!,
          ...(this.data.reservation?.type === 'flight' && this.data.reservation.status
            ? { status: this.data.reservation.status, statusFetchedAt: this.data.reservation.statusFetchedAt }
            : {}),
        };
        break;
      case 'carRental':
        reservation = {
          ...base,
          type: 'carRental',
          company: details.company ?? '',
          pickupPlace: places.pickupPlace!,
          dropoffPlace: places.dropoffPlace!,
        };
        break;
      case 'other':
        reservation = { ...base, type: 'other', ...(places.place ? { place: places.place } : {}) };
        break;
    }

    if (this.isEditing) {
      this.tripFacade.updateReservation(this.tripId, reservation);
    } else {
      this.tripFacade.createReservation(this.tripId, reservation);
    }
    this.dialogRef.close();
  }

  delete(): void {
    if (!this.isEditing) return;
    this.tripFacade.removeReservation(this.tripId, this.reservationId);
    this.dialogRef.close();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private combineDateTime(date: Date | null, time: Date | null): Date | null {
    if (!date) return null;
    const combined = new Date(date);
    if (time) combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    else combined.setHours(0, 0, 0, 0);
    return combined;
  }
}
