import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, switchMap } from 'rxjs';
import { TravelDistanceService } from '@app/core/services/travel-distance.service';
import { LoadingState } from '@core/models/place.dto';
import { WalkingRoute } from '@core/models/travel-route.dto';
import { TravelPoint } from '../day-logistic-banner/day-timeline-distance';
import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { formatDistanceMeters } from './travel-format.util';

/**
 * Segment "distance/temps à pied" affiché entre 2 cartes consécutives d'un
 * jour (voir `insertDistanceGaps`, day-timeline-distance.ts) — clic sur toute
 * la rangée = navigation Google Maps à pied entre les 2 points. Le
 * pictogramme "marche à pied" n'est PAS interactif dans cette v1 (pas de
 * `(click)` dédié) : le choix d'un autre mode de transport, qui relancerait
 * le calcul, est un futur item (ROADMAP.md).
 */
@Component({
  selector: 'app-day-distance-gap',
  standalone: true,
  imports: [DurationPipe, SkeletonComponent],
  templateUrl: './day-distance-gap.component.html',
  styleUrl: './day-distance-gap.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDistanceGapComponent {
  private readonly travelDistanceService = inject(TravelDistanceService);

  readonly origin = input.required<TravelPoint>();
  readonly destination = input.required<TravelPoint>();

  private readonly points = computed(() => ({ origin: this.origin(), destination: this.destination() }));
  private readonly points$ = toObservable(this.points).pipe(
    distinctUntilChanged((a, b) => a.origin.placeId === b.origin.placeId && a.destination.placeId === b.destination.placeId),
  );

  private readonly routeState = toSignal(
    this.points$.pipe(
      switchMap(({ origin, destination }) => this.travelDistanceService.getWalkingRoute$(origin.placeId, destination.placeId)),
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
    return `${distance} à pied, environ ${minutes} min — ouvrir l'itinéraire`;
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
      travelmode: 'walking',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  });
}
