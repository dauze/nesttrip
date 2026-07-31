import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, ViewContainerRef, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, firstValueFrom, tap } from 'rxjs';

import { SelectComponent } from '@app/shared/components/select/select.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { TimePickerDialogComponent } from '@app/shared/components/time-picker-dialog/time-picker-dialog.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { NotesFieldComponent } from '@app/shared/components/notes-field/notes-field.component';
import { PriceFieldComponent } from '@app/shared/components/price-field/price-field.component';
import { DialogService } from '@app/shared/services/dialog.service';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { FlightLookupApiService } from '@core/services/flight-lookup-api.service';
import { ViewportService } from '@core/services/viewport.service';
import { PlaceSummary } from '@core/models/place.dto';
import { BookingStatus } from '@core/enums/booking.status';
import { BOOKING_STATUS_META, BOOKING_STATUS_OPTIONS } from '@app/shared/components/activity-card/activity.constants';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META, LOGISTIC_TYPE_OPTIONS, CURRENCY_OPTIONS } from '../../logistic.constants';
import { FlightFieldsComponent } from '../../logistic-form/flight-fields/flight-fields.component';
import { CarRentalFieldsComponent } from '../../logistic-form/car-rental-fields/car-rental-fields.component';
import { TrainFieldsComponent } from '../../logistic-form/train-fields/train-fields.component';
import { GenericFieldsComponent } from '../../logistic-form/generic-fields/generic-fields.component';
import { FlightStatusBadgeComponent } from '../../flight-status-badge/flight-status-badge.component';
import { LogisticPlaceInfoComponent } from '../logistic-place-info/logistic-place-info.component';

interface SelectedPlaces {
  place?: PlaceSummary;
  departureAirport?: PlaceSummary;
  arrivalAirport?: PlaceSummary;
  pickupPlace?: PlaceSummary;
  dropoffPlace?: PlaceSummary;
  departurePlace?: PlaceSummary;
  arrivalPlace?: PlaceSummary;
}

function initialPlacesFrom(logistic: Logistic): SelectedPlaces {
  switch (logistic.type) {
    case 'logement':
    case 'other':
      return { place: logistic.place };
    case 'flight':
      return { departureAirport: logistic.departureAirport, arrivalAirport: logistic.arrivalAirport };
    case 'carRental':
      return { pickupPlace: logistic.pickupPlace, dropoffPlace: logistic.dropoffPlace };
    case 'train':
      return { departurePlace: logistic.departurePlace, arrivalPlace: logistic.arrivalPlace };
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
  selector: 'app-logistic-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass, ReactiveFormsModule, SelectComponent, DatePickerComponent, TimePickerDialogComponent,
    DividerComponent, NotesFieldComponent, PriceFieldComponent,
    FlightFieldsComponent, CarRentalFieldsComponent, TrainFieldsComponent, GenericFieldsComponent,
    FlightStatusBadgeComponent, LogisticPlaceInfoComponent,
  ],
  templateUrl: './logistic-details.component.html',
  styleUrl: './logistic-details.component.scss',
})
export class LogisticDetailsComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly flightLookupApi = inject(FlightLookupApiService);
  private readonly viewport = inject(ViewportService);

  readonly tripId = input.required<string>();
  readonly logistic = input.required<Logistic>();

  // Refs template pour le chaînage de saisie guidée (Type → cinématique propre au type), voir startGuidedEntry().
  private readonly typeSelect = viewChild.required<SelectComponent<LogisticType>>('typeSelect');
  private readonly bookingSelect = viewChild.required<SelectComponent<BookingStatus>>('bookingSelect');
  private readonly startDatePicker = viewChild.required<DatePickerComponent>('startDatePicker');
  private readonly startTimePicker = viewChild.required<TimePickerDialogComponent>('startTimePicker');
  private readonly endDatePicker = viewChild.required<DatePickerComponent>('endDatePicker');
  private readonly endTimePicker = viewChild.required<TimePickerDialogComponent>('endTimePicker');
  private readonly priceField = viewChild.required<PriceFieldComponent>('priceField');

  readonly typeOptions = LOGISTIC_TYPE_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly bookingStatusOptions = BOOKING_STATUS_OPTIONS;

  readonly form = this.fb.group({
    type: this.fb.nonNullable.control<LogisticType>('other'),
    startDate: this.fb.control<Date | null>(null),
    startTime: this.fb.control<Date | null>(null),
    endDate: this.fb.control<Date | null>(null),
    endTime: this.fb.control<Date | null>(null),
    notes: this.fb.nonNullable.control<string>(''),
    price: this.fb.nonNullable.control<{ amount: number; currency: string }>({ amount: 0, currency: 'EUR' }),
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
    this.logistic();    // Dépendance 1 : se réévalue si l'input change
    this.formChanges();    // Dépendance 2 : se réévalue si l'utilisateur tape
    return this.form.getRawValue();
  });

  readonly selectedType = computed(() => this.formValue().type);
  readonly dateLabels = computed(() => LOGISTIC_TYPE_META[this.selectedType()]);
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
  private lastSyncedLogisticId: string | undefined;

  /**
   * `true` pendant toute la durée d'une cinématique guidée (voir
   * `startGuidedEntry`) : bloque le resync `patchValue` ci-dessous, qui
   * sinon peut retomber au mauvais moment — un commit débouncé (300ms) d'une
   * étape précédente (ex. Résa) peut aboutir PENDANT qu'un picker suivant
   * (ex. date/heure de fin) est ouvert, et le `patchValue({..., emitEvent:false})`
   * qui en résulte perturbe ce picker en plein milieu de l'interaction —
   * observé concrètement sur la cinématique "Location voiture", qui
   * s'arrêtait après "heure de début" sans jamais enchaîner sur la date de
   * fin. Le rattrapage se fait tout seul : `logistic()` continue de changer
   * à chaque étape (nouveaux commits), donc l'effect se redéclenche et finit
   * par resynchroniser dès que `guidedFlowActive` repasse à `false`.
   */
  private guidedFlowActive = false;

  constructor() {
    effect(() => {
      const r = this.logistic();
      if (!r) return;

      if ((this.hasUnflushedLocalEdit || this.guidedFlowActive) && r.id === this.lastSyncedLogisticId) return;
      this.lastSyncedLogisticId = r.id;

      this.form.patchValue({
        type: r.type,
        startDate: r.startDateTime ?? null,
        startTime: r.startDateTime ?? null,
        endDate: r.endDateTime ?? null,
        endTime: r.endDateTime ?? null,
        notes: r.notes ?? '',
        price: r.price ?? { amount: 0, currency: this.tripFacade.getTripCurrency(this.tripId())() },
        booking: r.booking,
        airline: r.type === 'flight' ? (r.airline ?? '') : '',
        flightNumber: r.type === 'flight' ? (r.flightNumber ?? '') : '',
        company: r.type === 'carRental' ? (r.company ?? '') : '',
      }, { emitEvent: false });

      this.selectedPlaces.set(initialPlacesFrom(r));
    });

    // Préremplissage fin ← début (voir ROADMAP.md, "La date de fin d'une
    // réservation doit être alimentée de la date de début" / "L'heure de fin
    // doit être alimentée de l'heure de début") : seulement si la fin n'est
    // pas déjà renseignée, jamais si l'utilisateur l'a déjà éditée
    // indépendamment. `{emitEvent:false}` : le contrôle enfant émet AVANT que
    // le `FormGroup` parent (souscrit juste après, `debounceTime`) n'agrège
    // le changement — cette valeur est donc déjà incluse dans le commit
    // débounce déclenché par la sélection de la date/heure de début, pas
    // besoin d'un commit séparé. Ne se déclenche jamais sur le `patchValue`
    // de resynchronisation ci-dessus (posé avec `emitEvent:false` lui aussi).
    this.form.controls.startDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((startDate) => {
      if (startDate && !this.form.controls.endDate.value) {
        this.form.controls.endDate.setValue(startDate, { emitEvent: false });
      }
    });
    this.form.controls.startTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((startTime) => {
      if (startTime && !this.form.controls.endTime.value) {
        this.form.controls.endTime.setValue(startTime, { emitEvent: false });
      }
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
    const logistic = this.logistic();
    if (!logistic) return;

    const value = this.form.getRawValue();
    this.hasUnflushedLocalEdit = false;

    const startDateTime = this.combineDateTime(value.startDate, value.startTime) ?? logistic.startDateTime;
    const endDateTime = this.combineDateTime(value.endDate, value.endTime) ?? startDateTime;
    const places = this.selectedPlaces();

    const base = {
      id: logistic.id,
      title: logistic.title,
      startDateTime,
      endDateTime,
      notes: value.notes,
      files: logistic.files ?? [],
      links: logistic.links ?? [],
      booking: { ...value.booking, deadline: value.booking.deadline ?? undefined },
      ...(logistic.referenceNumber ? { referenceNumber: logistic.referenceNumber } : {}),
      ...(value.price.amount ? { price: value.price } : {}),
    };

    let updated: Logistic;
    switch (value.type) {
      case 'logement':
        updated = { ...base, type: 'logement', ...(places.place ? { place: places.place } : {}) };
        break;
      case 'flight':
        updated = {
          ...base,
          type: 'flight',
          ...(value.airline ? { airline: value.airline } : {}),
          ...(value.flightNumber ? { flightNumber: value.flightNumber } : {}),
          ...(places.departureAirport ? { departureAirport: places.departureAirport } : {}),
          ...(places.arrivalAirport ? { arrivalAirport: places.arrivalAirport } : {}),
          ...(logistic.type === 'flight' && logistic.status
            ? { status: logistic.status, statusFetchedAt: logistic.statusFetchedAt }
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
      case 'train':
        updated = {
          ...base,
          type: 'train',
          ...(places.departurePlace ? { departurePlace: places.departurePlace } : {}),
          ...(places.arrivalPlace ? { arrivalPlace: places.arrivalPlace } : {}),
        };
        break;
      case 'other':
        updated = { ...base, type: 'other', ...(places.place ? { place: places.place } : {}) };
        break;
    }

    this.tripFacade.updateLogistic(this.tripId(), updated);
  }

  private combineDateTime(date: Date | null, time: Date | null): Date | null {
    if (!date) return null;
    const combined = new Date(date);
    if (time) combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    else combined.setHours(0, 0, 0, 0);
    return combined;
  }

  /**
   * Déclenché juste après la création d'un élément (voir
   * `LogisticsCreationService`) : demande le TYPE en premier (sauf
   * `skipTypeStep`, déjà répondu par le menu "Ajouter" d'un jour — voir
   * `DayLogisticQuickAddService`), puis enchaîne sur la cinématique propre à
   * ce type (voir ROADMAP.md). MOBILE UNIQUEMENT — décision explicite :
   * sur desktop le formulaire complet est déjà visible d'un coup, l'utilisateur
   * renseigne les champs à son rythme sans qu'on lui impose un ordre ; ce
   * chaînage reste donc un pattern mobile, comme `ActivityFormComponent.startGuidedEntry`.
   * Dès qu'une étape est fermée SANS validation (backdrop/Échap sur un
   * `app-select`, annulation d'un `app-time-picker-dialog`/dialog), le
   * chaînage s'arrête net, le reste s'édite manuellement.
   */
  async startGuidedEntry(skipTypeStep = false): Promise<void> {
    if (!this.viewport.isMobile()) return;

    if (!skipTypeStep) {
      this.typeSelect().openPanel();
      const { selected } = await this.awaitOnce(this.typeSelect().closed);
      if (!selected) return;
    }

    this.guidedFlowActive = true;
    try {
      switch (this.form.getRawValue().type) {
        case 'logement': await this.guidedLogement(); break;
        case 'flight': await this.guidedFlight(); break;
        case 'carRental': await this.guidedCarRental(); break;
        case 'train': await this.guidedTrain(); break;
        case 'other': await this.guidedOther(); break;
      }
    } finally {
      this.guidedFlowActive = false;
    }
  }

  /** Titre (Google ou texte libre, voir LogisticHeaderComponent) → conditionnellement Adresse → Résa → check-in → check-out → Prix. */
  private async guidedLogement(): Promise<void> {
    const nameResult = await this.openTitleDialog({ initialTitle: '', title: 'Nom', placeholder: 'Nom du logement' });
    if (!nameResult) return;

    if (nameResult.type === 'place') {
      this.applyTitleWithPlace(nameResult.place.name, nameResult.place);
    } else {
      this.applyTitle(nameResult.text);
      const addressResult = await this.openTitleDialog({ initialTitle: '', title: 'Adresse', placeholder: 'Adresse du logement' });
      if (addressResult?.type === 'place') this.onPlaceSelected('place', addressResult.place);
    }

    if (!(await this.guidedBooking())) return;
    if (!(await this.guidedDateTime(this.startDatePicker(), this.startTimePicker()))) return;
    await this.guidedDateTime(this.endDatePicker(), this.endTimePicker());
    this.priceField().openDialog();
  }

  /** N° de vol → date de départ → lookup AeroDataBox (autofill compagnie/aéroports/horaires) → Résa → Prix. Lookup en échec : bascule sur la chaîne manuelle (Résa → date/heure de fin → Prix), jamais bloquant. */
  private async guidedFlight(): Promise<void> {
    const flightNumber = await this.openTextDialog({ title: 'Numéro de vol', placeholder: 'AF1234' });
    if (!flightNumber) return;
    this.form.patchValue({ flightNumber });

    this.startDatePicker().openPanel();
    const startSelection = await this.awaitOnce(this.startDatePicker().selected);
    const departureDate = Array.isArray(startSelection) ? startSelection[0] : startSelection;

    try {
      const lookup = await firstValueFrom(this.flightLookupApi.getLookup$(flightNumber, departureDate));
      const current = this.logistic();
      if (current) {
        const titleParts = [lookup.departureAirportName, lookup.arrivalAirportName].filter(Boolean);
        this.tripFacade.updateLogistic(this.tripId(), {
          ...current,
          type: 'flight',
          flightNumber,
          title: `Vol (${flightNumber})${titleParts.length ? ' - ' + titleParts.join(' - ') : ''}`,
          ...(lookup.airline ? { airline: lookup.airline } : {}),
          ...(lookup.departureAirportName ? { departureAirport: this.syntheticPlace(lookup.departureAirportName) } : {}),
          ...(lookup.arrivalAirportName ? { arrivalAirport: this.syntheticPlace(lookup.arrivalAirportName) } : {}),
          ...(lookup.scheduledDepartureTime ? { startDateTime: lookup.scheduledDepartureTime } : {}),
          ...(lookup.scheduledArrivalTime ? { endDateTime: lookup.scheduledArrivalTime } : {}),
        });

        // Miroir dans l'état local (form + selectedPlaces) de ce qui vient
        // d'être écrit directement dans le store ci-dessus : le formulaire lit
        // `currentPlaces()`/`form` (pas `logistic()`), et l'effect qui
        // resynchronise habituellement l'un depuis l'autre est suppressé tant
        // que `guidedFlowActive` vaut `true` (voir sa doc) — sans ce miroir,
        // les champs restaient visuellement vides malgré l'écriture réussie,
        // et la prochaine étape du chaînage (Résa, qui touche au même `form`)
        // aurait de toute façon déclenché un `commit()` débounce écrasant
        // cette écriture avec les anciennes valeurs locales (vides). `{emitEvent:
        // false}` : la persistance de ces valeurs est déjà faite ci-dessus, pas
        // besoin d'un second commit débounce en parallèle de celui-là.
        if (lookup.departureAirportName) {
          this.selectedPlaces.update((s) => ({ ...s, departureAirport: this.syntheticPlace(lookup.departureAirportName!) }));
        }
        if (lookup.arrivalAirportName) {
          this.selectedPlaces.update((s) => ({ ...s, arrivalAirport: this.syntheticPlace(lookup.arrivalAirportName!) }));
        }
        this.form.patchValue({
          ...(lookup.airline ? { airline: lookup.airline } : {}),
          ...(lookup.scheduledDepartureTime ? { startDate: lookup.scheduledDepartureTime, startTime: lookup.scheduledDepartureTime } : {}),
          ...(lookup.scheduledArrivalTime ? { endDate: lookup.scheduledArrivalTime, endTime: lookup.scheduledArrivalTime } : {}),
        }, { emitEvent: false });
      }
      if (!(await this.guidedBooking())) return;
      this.priceField().openDialog();
    } catch {
      // Vol introuvable / erreur réseau : repli manuel — la date de départ
      // est déjà connue (demandée avant la tentative de lookup ci-dessus),
      // on enchaîne sur heure de décollage → lieu de décollage → date/heure
      // d'arrivée → compagnie → Résa → Prix, jamais bloquant.
      this.applyTitle(`Vol (${flightNumber})`);

      if (!(await this.guidedTime(this.startTimePicker()))) return;

      const departureResult = await this.openTitleDialog({ initialTitle: '', title: 'Lieu de décollage', placeholder: 'Rechercher un lieu...' });
      if (departureResult?.type === 'place') this.onPlaceSelected('departureAirport', departureResult.place);

      if (!(await this.guidedDateTime(this.endDatePicker(), this.endTimePicker()))) return;

      const arrivalResult = await this.openTitleDialog({ initialTitle: '', title: "Lieu d'arrivée", placeholder: 'Rechercher un lieu...' });
      if (arrivalResult?.type === 'place') this.onPlaceSelected('arrivalAirport', arrivalResult.place);

      const airline = await this.openTextDialog({ title: 'Compagnie', placeholder: 'Air France', optional: true });
      if (airline) this.form.patchValue({ airline });

      const places = this.currentPlaces();
      const cities = [places.departureAirport?.name, places.arrivalAirport?.name].filter((v): v is string => !!v);
      if (cities.length) this.applyTitle(`Vol (${flightNumber}) - ${cities.join(' - ')}`);

      if (!(await this.guidedBooking())) return;
      this.priceField().openDialog();
    }
  }

  /** Résa → prise en charge (date/heure) → restitution (date/heure) → nom du loueur → Prix. Titre calculé : "Location voiture - {loueur}" si renseigné, "Location voiture" sinon. */
  private async guidedCarRental(): Promise<void> {
    if (!(await this.guidedBooking())) return;
    if (!(await this.guidedDateTime(this.startDatePicker(), this.startTimePicker()))) return;
    if (!(await this.guidedDateTime(this.endDatePicker(), this.endTimePicker()))) return;

    const company = await this.openTextDialog({ title: 'Nom de la location', placeholder: 'Hertz, Europcar...', optional: true });
    if (company) this.form.patchValue({ company });
    this.applyTitle(company ? `Location voiture - ${company}` : 'Location voiture');

    this.priceField().openDialog();
  }

  /** Résa → ville de départ → date/heure de départ → ville d'arrivée → date/heure d'arrivée → Prix. Titre calculé à partir des deux villes. */
  private async guidedTrain(): Promise<void> {
    if (!(await this.guidedBooking())) return;

    const departureResult = await this.openTitleDialog({ initialTitle: '', title: 'Ville de départ', placeholder: 'Rechercher une ville...' });
    if (departureResult?.type === 'place') this.onPlaceSelected('departurePlace', departureResult.place);

    if (!(await this.guidedDateTime(this.startDatePicker(), this.startTimePicker()))) return;

    const arrivalResult = await this.openTitleDialog({ initialTitle: '', title: "Ville d'arrivée", placeholder: 'Rechercher une ville...' });
    if (arrivalResult?.type === 'place') this.onPlaceSelected('arrivalPlace', arrivalResult.place);

    if (!(await this.guidedDateTime(this.endDatePicker(), this.endTimePicker()))) return;

    const places = this.currentPlaces();
    const cities = [places.departurePlace?.name, places.arrivalPlace?.name].filter((v): v is string => !!v);
    this.applyTitle(cities.length ? `Train ${cities.join(' - ')}` : 'Train');

    this.priceField().openDialog();
  }

  /** Titre (Google ou texte libre, même pattern que Logement) → conditionnellement Adresse → Résa → date/heure début → date/heure fin → Prix. */
  private async guidedOther(): Promise<void> {
    const nameResult = await this.openTitleDialog({ initialTitle: '', title: 'Titre', placeholder: "Nom de l'élément" });
    if (nameResult) {
      if (nameResult.type === 'place') {
        this.applyTitleWithPlace(nameResult.place.name, nameResult.place);
      } else {
        this.applyTitle(nameResult.text);
        const addressResult = await this.openTitleDialog({ initialTitle: '', title: 'Adresse', placeholder: 'Adresse' });
        if (addressResult?.type === 'place') this.onPlaceSelected('place', addressResult.place);
      }
    }

    if (!(await this.guidedBooking())) return;
    if (!(await this.guidedDateTime(this.startDatePicker(), this.startTimePicker()))) return;
    await this.guidedDateTime(this.endDatePicker(), this.endTimePicker());
    this.priceField().openDialog();
  }

  private async guidedBooking(): Promise<boolean> {
    this.bookingSelect().openPanel();
    const { selected } = await this.awaitOnce(this.bookingSelect().closed);
    return selected;
  }

  /** Date (pas de signal d'annulation propre — le chaînage reste simplement en attente si l'utilisateur abandonne, voir la doc de `awaitOnce`) puis heure ; renvoie `false` si l'heure est annulée. */
  private async guidedDateTime(datePicker: DatePickerComponent, timePicker: TimePickerDialogComponent): Promise<boolean> {
    datePicker.openPanel();
    await this.awaitOnce(datePicker.selected);
    return this.guidedTime(timePicker);
  }

  /**
   * Sur mobile, `TimePickerDialogComponent` est un vrai déclencheur (texte
   * "HH:MM" cliquable) qui ouvre un dialog dédié : `openDialog()` + attendre
   * `closed` reproduit exactement ce geste. Sur DESKTOP, ce composant n'a
   * PAS d'équivalent — il affiche directement 2 champs HH/MM éditables en
   * ligne dans le formulaire (voir sa doc de classe), sans aucun
   * déclencheur "ouvrir". Appeler `openDialog()` quand même y ouvre un
   * troisième jeu de champs HH/MM redondant par-dessus les 2 déjà visibles
   * (début ET fin) : confirmé en reproduisant la cinématique "Location
   * voiture" (Playwright) — le chaînage semblait "se bloquer après l'heure
   * de début" alors que le code fonctionne, en réalité l'utilisateur remplit
   * un des 2 champs déjà visibles plutôt que le dialog fraîchement ouvert,
   * qui n'émet jamais `closed`. Sur desktop, l'étape passe donc directement
   * à la suite : le champ reste éditable normalement, déjà visible dans le
   * formulaire.
   */
  private async guidedTime(timePicker: TimePickerDialogComponent): Promise<boolean> {
    if (!this.viewport.isMobile()) return true;
    timePicker.openDialog();
    const time = await this.awaitOnce(timePicker.closed);
    return !!time;
  }

  private openTitleDialog(data: TitleEditDialogData): Promise<TitleEditDialogResult | undefined> {
    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data,
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // Sans ça, l'autofocus CDK par défaut ('first-tabbable') cible le
        // bouton de fermeture (1er élément focusable du template), pas le
        // champ — même correctif que les autres points d'ouverture de ce
        // dialog (ActivityHeaderComponent, DayActivityCreationService...).
        autoFocus: '.title-edit-dialog__input',
      },
    );
    return this.awaitOnce(dialogRef.closed);
  }

  private openTextDialog(data: SimpleTextEntryDialogData): Promise<string | undefined> {
    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      { data, panelClass: 'app-wide-dialog-panel', viewContainerRef: this.viewContainerRef },
    );
    return this.awaitOnce(dialogRef.closed);
  }

  /**
   * Écriture directe du titre (pas de champ `title` dans le form réactif,
   * voir LogisticHeaderComponent). ATTENTION : ne JAMAIS enchaîner un appel
   * synchrone à `onPlaceSelected`/`commit()` juste après (voir
   * `applyTitleWithPlace` sinon) — `this.logistic()` est un `input()` signal
   * alimenté par le binding du template PARENT (`[logistic]="r"` dans
   * `LogisticCardComponent`), qui ne se met à jour qu'au prochain cycle de
   * rendu Angular, PAS de façon synchrone dans la même pile d'appels qu'un
   * `tripFacade.updateLogistic()`. Un 2e appel synchrone relirait donc encore
   * l'ancien `logistic()` (titre pas encore propagé) et l'écraserait — bug
   * confirmé en reproduisant la cinématique Logement (sélection Google) :
   * le titre retombait sur le libellé générique du type juste après.
   */
  private applyTitle(title: string): void {
    const current = this.logistic();
    if (!current) return;
    this.tripFacade.updateLogistic(this.tripId(), { ...current, title });
  }

  /** Titre + lieu Google en une seule écriture atomique (voir la mise en garde de `applyTitle`) — nécessaire pour Logement/Autre, où les deux sont connus au même instant sans geste utilisateur entre les deux (contrairement au texte libre, où l'attente du dialog "Adresse" laisse le temps à `logistic()` de se repropager). */
  private applyTitleWithPlace(title: string, place: PlaceSummary): void {
    this.selectedPlaces.update((s) => ({ ...s, place }));
    const current = this.logistic();
    if (!current || (current.type !== 'logement' && current.type !== 'other')) return;
    this.tripFacade.updateLogistic(this.tripId(), { ...current, title, place });
  }

  /** `PlaceSummary` minimal (pas de `placeId`) pour un aéroport connu seulement par son nom (voir FlightLookupApiService, AeroDataBox ne fournit ni placeId ni coordonnées) — `LogisticPlaceInfoComponent` n'affiche la carte/les détails Google que si `placeId` est renseigné, donc reste silencieux ici ; l'utilisateur peut toujours re-sélectionner un vrai lieu Google ensuite. */
  private syntheticPlace(name: string): PlaceSummary {
    return { placeId: '', name, address: '', latitude: 0, longitude: 0 };
  }

  /**
   * Adapte un `output()`/une `Observable` (CDK `DialogRef.closed`) en
   * `Promise` pour permettre le chaînage `async`/`await` des cinématiques
   * ci-dessus — sécurisé contre la destruction du composant en plein
   * chaînage (désabonnement automatique). Si la source n'émet jamais (ex.
   * `DatePickerComponent.selected` sur annulation, qui n'a pas de signal
   * d'annulation dédié), la promesse reste simplement en attente : le
   * chaînage s'arrête là, sans erreur.
   */
  private awaitOnce<T>(source: { subscribe(next: (value: T) => void): { unsubscribe(): void } }): Promise<T> {
    return new Promise((resolve) => {
      const subscription = source.subscribe((value) => {
        subscription.unsubscribe();
        resolve(value);
      });
      this.destroyRef.onDestroy(() => subscription.unsubscribe());
    });
  }
}
