import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, switchMap } from 'rxjs';
import { TravelDistanceService } from '@app/core/services/travel-distance.service';
import { LoadingState } from '@core/models/place.dto';
import { WalkingRoute } from '@core/models/travel-route.dto';
import { TravelPoint } from '../day-logistic-banner/day-timeline-distance';
import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { AppMenuItem, MenuComponent } from '@app/shared/components/menu/menu.component';
import { formatDistanceMeters } from './travel-format.util';
import { selectTravelMode, buildPlacePairKey, TravelMode } from './travel-mode.util';
import { haversineDistanceMeters } from '@app/shared/utils/geo.util';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { DayLogisticQuickAddService } from '@app/features/trips/trip-detail/day-logistic-quick-add.service';
import { LOGISTIC_TYPE_META } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/logistics/logistic.constants';
import { LogisticType } from '@core/models/logistic.dto';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';

const GOOGLE_MAPS_TRAVEL_MODE: Record<TravelMode, string> = {
  walk: 'walking',
  bike: 'bicycling',
  car: 'driving',
};

const MODE_MENU_ENTRIES: { mode: TravelMode | null; label: string }[] = [
  { mode: null, label: 'Automatique' },
  { mode: 'walk', label: 'Marche' },
  { mode: 'bike', label: 'Vélo' },
  { mode: 'car', label: 'Voiture' },
];

/** Types logistiques pertinents pour un long trajet (exclut logement/autre) — voir `onTransportCtaClick`. */
const TRANSPORT_TYPES: LogisticType[] = ['flight', 'train', 'carRental'];

/** Au-delà de cette distance routée, le bouton "Enregistrer un transport ?" apparaît — voir `showTransportCta`. */
const TRANSPORT_CTA_DISTANCE_METERS = 300_000;

/**
 * Segment "distance/temps" affiché entre 2 cartes consécutives d'un jour
 * (voir `insertDistanceGaps`, day-timeline-distance.ts). 2 pills SŒURS (pas
 * de pictogramme imbriqué dans un lien) :
 * - pill "trajet" (`<a>`) : ouvre Google Maps dans le mode résolu.
 * - pill "mode" (`<button>`) : uniquement le pictogramme, ouvre une liste
 *   pour choisir/changer le mode de cette paire de lieux (override manuel,
 *   `Trip.travelModeOverrides`/`buildPlacePairKey`), sans jamais déclencher
 *   la navigation Maps de la 1re pill.
 * Le mode auto vient de `selectTravelMode`/`Trip.travelTiers` (3 paliers
 * distance+mode configurables par voyage). Au-delà de 300km routés, un
 * bouton propose de créer directement la réservation de transport
 * correspondante (voir `onTransportCtaClick`).
 */
@Component({
  selector: 'app-day-distance-gap',
  standalone: true,
  imports: [DurationPipe, SkeletonComponent, MenuComponent, ChipComponent, ButtonComponent],
  templateUrl: './day-distance-gap.component.html',
  styleUrl: './day-distance-gap.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDistanceGapComponent {
  private readonly travelDistanceService = inject(TravelDistanceService);
  private readonly tripFacade = inject(TripFacade);
  private readonly dayLogisticQuickAdd = inject(DayLogisticQuickAddService);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly origin = input.required<TravelPoint>();
  readonly destination = input.required<TravelPoint>();

  private readonly modeMenuRef = viewChild<MenuComponent>('modeMenu');
  private readonly pictogramRef = viewChild<ElementRef<HTMLElement>>('pictogram');
  private readonly transportMenuRef = viewChild<MenuComponent>('transportMenu');
  private readonly transportCtaRef = viewChild<ElementRef<HTMLElement>>('transportCta');

  private readonly tiers = computed(() => this.tripFacade.getTripTravelTiers(this.tripId())());
  private readonly overrides = computed(() => this.tripFacade.getTravelModeOverrides(this.tripId())());
  protected readonly overrideKey = computed(() => buildPlacePairKey(this.origin().placeId, this.destination().placeId));

  /** Choix auto du mode : synchrone, gratuit (Haversine), pas d'attente réseau — voir `selectTravelMode`. */
  private readonly autoMode = computed<TravelMode>(() => {
    const o = this.origin();
    const d = this.destination();
    const distanceMeters = haversineDistanceMeters(o.latitude, o.longitude, d.latitude, d.longitude);
    return selectTravelMode(distanceMeters, this.tiers());
  });

  /** Mode réellement affiché : override manuel de cette paire de lieux si présent, sinon le choix auto. */
  protected readonly mode = computed<TravelMode>(() => this.overrides()[this.overrideKey()] ?? this.autoMode());

  protected readonly modeMenuItems = computed<AppMenuItem[]>(() => {
    const override = this.overrides()[this.overrideKey()] ?? null;
    return MODE_MENU_ENTRIES.map(({ mode, label }) => ({
      label,
      icon: override === mode ? 'pi pi-check' : undefined,
      command: () => this.tripFacade.setTravelModeOverride(this.tripId(), this.overrideKey(), mode),
    }));
  });

  protected onPictogramClick(): void {
    const trigger = this.pictogramRef()?.nativeElement;
    if (trigger) this.modeMenuRef()?.toggleAt(trigger);
  }

  private readonly points = computed(() => ({ origin: this.origin(), destination: this.destination(), mode: this.mode() }));
  private readonly points$ = toObservable(this.points).pipe(
    distinctUntilChanged(
      (a, b) => a.origin.placeId === b.origin.placeId && a.destination.placeId === b.destination.placeId && a.mode === b.mode,
    ),
  );

  private readonly routeState = toSignal(
    this.points$.pipe(
      switchMap(({ origin, destination, mode }) =>
        this.travelDistanceService.getRoute$(origin.placeId, destination.placeId, mode),
      ),
    ),
    { initialValue: { status: 'idle' } as LoadingState<WalkingRoute> },
  );

  protected readonly loading = computed(() => this.routeState().status === 'loading');

  private readonly route = computed(() => {
    const state = this.routeState();
    return state.status === 'success' ? state.data : null;
  });

  protected readonly hasRoute = computed(() => this.route() !== null);
  protected readonly distanceLabel = computed(() => {
    const route = this.route();
    return route ? formatDistanceMeters(route.distanceMeters) : '';
  });
  protected readonly durationMinutes = computed(() => {
    const route = this.route();
    return route ? Math.round(route.durationSeconds / 60) : null;
  });

  protected readonly ariaLabel = computed(() => {
    const distance = this.distanceLabel();
    const minutes = this.durationMinutes();
    const modeLabel = { walk: 'à pied', bike: 'à vélo', car: 'en voiture' }[this.mode()];
    return `${distance} ${modeLabel}, environ ${minutes} min — ouvrir l'itinéraire`;
  });

  protected readonly pictogramAriaLabel = computed(() => {
    const modeLabel = { walk: 'Marche', bike: 'Vélo', car: 'Voiture' }[this.mode()];
    return `Mode de trajet : ${modeLabel} — changer`;
  });

    protected readonly modeLibelle = computed(() => {
    return { walk: 'Marche', bike: 'Vélo', car: 'Voiture' }[this.mode()];
  });

  protected readonly mapsUrl = computed(() => {
    const origin = this.origin();
    const destination = this.destination();
    const params = new URLSearchParams({
      api: '1',
      origin: `${origin.latitude},${origin.longitude}`,
      origin_place_id: origin.placeId,
      destination: `${destination.latitude},${destination.longitude}`,
      destination_place_id: destination.placeId,
      travelmode: GOOGLE_MAPS_TRAVEL_MODE[this.mode()],
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  });

  protected readonly showTransportCta = computed(() => (this.route()?.distanceMeters ?? 0) > TRANSPORT_CTA_DISTANCE_METERS);

  /** Vol/Train/Location de voiture — réutilise `DayLogisticQuickAddService.create`, EXACTEMENT le même chemin que le "+" d'un jour (préremplit `dayId`, déclenche la cinématique guidée mobile, ramène sur ce jour à la fin). */
  protected readonly transportMenuItems = computed<AppMenuItem[]>(() =>
    TRANSPORT_TYPES.map((type) => ({
      label: LOGISTIC_TYPE_META[type].label,
      icon: LOGISTIC_TYPE_META[type].icon,
      command: () => this.dayLogisticQuickAdd.create(type, this.dayId()),
    })),
  );

  protected onTransportCtaClick(): void {
    const trigger = this.transportCtaRef()?.nativeElement;
    if (trigger) this.transportMenuRef()?.toggleAt(trigger);
  }
}
