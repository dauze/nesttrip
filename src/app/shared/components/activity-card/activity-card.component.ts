import {
  Component, ElementRef, afterNextRender, computed, inject,
  input, signal, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CdkDrag, DragDropModule } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, filter, map, of, switchMap, take } from 'rxjs';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
// Remplacement des anciens modèles par PlaceDetails
import { LoadingState, PlaceSummary, PlaceDetails, PlacePhotoRef } from '@app/core/models/place.dto';
import { BookingStatus } from '@core/enums/booking.status';
import { BOOKING_STATUS_META } from './activity.constants';

import { ActivityHeaderComponent } from './activity-header/activity-header.component';
import { ActivityFilesComponent } from './activity-files/activity-files.component';
import { ActivityFormComponent } from './activity-form/activity-form.component';
import { ActivityGoogleInfoComponent } from './activity-google-info/activity-google-info.component';
import { Button } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule, PanelModule, DividerModule, ProgressSpinnerModule, DragDropModule, Button,
    ActivityHeaderComponent, ActivityFormComponent,
    ActivityFilesComponent, ActivityGoogleInfoComponent, ConfirmDialog,
  ],
  providers: [ConfirmationService],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
})
export class ActivityCardComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly confirmationService = inject(ConfirmationService);
  private cdkDrag = inject(CdkDrag, { self: true, optional: true  });
  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');

  readonly tripId = input.required<string>();
  /** Optionnel : absent quand l'activité n'est pas (encore) rattachée à un jour (vue générale). */
  readonly dayId = input<Date | undefined>(undefined);
  readonly activityId = input.required<string>();

  readonly activity = computed(() => this.tripFacade.getActivity(this.activityId())());

  readonly bookingMeta = computed(() => {
    const status = this.activity()?.booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });

  readonly collapsed = signal(false);
  protected dragDisabled = signal(true);
  readonly scrollOffset = input(0);

  private readonly requestedPlaceId = signal<string>('');

  private readonly placeId$ = toObservable(this.requestedPlaceId).pipe(distinctUntilChanged());

  readonly detailsState = toSignal(
    this.placeId$.pipe(
      switchMap((id): ReturnType<typeof this.googlePlaceService.getPlaceDetails$> =>
        id ? this.googlePlaceService.getPlaceDetails$(id)
           : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlaceDetails> }
  );

  loadGoogleDetails(placeId: string): void {
    this.requestedPlaceId.set(placeId);
  }

  // --- Sélection d'un lieu depuis l'autocomplete + récupération des photos ---
  //
  // Historique du bug : l'ancienne implémentation faisait un `.subscribe()` manuel
  // avec `take(1)` directement sur `getPlacePhotos$`. Or ce flux est un état
  // (idle/loading/success/error), donc `take(1)` pouvait capturer l'état
  // "loading" au lieu de l'état final "success" selon le timing du cache -> les
  // photos étaient alors sauvegardées vides de façon aléatoire. De plus,
  // `activity` était capturé en closure au moment du clic, ce qui pouvait
  // écraser un état plus récent si l'activité changeait avant la résolution
  // de l'appel réseau.
  //
  // On repasse ici sur un signal + toObservable/switchMap, comme pour
  // `detailsState`, et on ne filtre que sur les états terminaux du flux photo.
  private readonly selectedPlace = signal<PlaceSummary | null>(null);

  private readonly selectedPlace$ = toObservable(this.selectedPlace).pipe(
    filter((place): place is PlaceSummary => !!place?.placeId)
  );

  constructor() {
    afterNextRender(() => {
      const el = this.cardContainer()?.nativeElement;
      if (!el) return;
      el.addEventListener('mousedown', this.updateDragState, { capture: true });
      el.addEventListener('touchstart', this.updateDragState, { capture: true, passive: true });
    });

    this.selectedPlace$
      .pipe(
        switchMap(place =>
          this.googlePlaceService.getPlacePhotos$(place.placeId).pipe(
            // On attend un état terminal (succès ou erreur), jamais "loading"/"idle".
            filter(state => state.status === 'success' || state.status === 'error'),
            take(1),
            map(state => ({
              place,
              photoRefs: state.status === 'success' && state.data?.photos
                ? state.data.photos.map((p: PlacePhotoRef) => p.name)
                : ([] as string[]),
            })),
            catchError(err => {
              console.error('Impossible de récupérer les photos du lieu à la sélection', err);
              return of({ place, photoRefs: [] as string[] });
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ place, photoRefs }) => {
        const activity = this.activity();
        if (!activity) return;

        this.tripFacade.updateActivity(this.tripId(), {
          ...activity,
          title: place.name,
          placeId: place.placeId,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          photoRefs,
        });
      });
  }

  onCardPointerDown(event: MouseEvent | TouchEvent): void {
    const target = event.target as HTMLElement;
    this.dragDisabled.set(!target.closest('.drag-handle'));
  }

  openAndScroll(): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
      setTimeout(() => this.scrollToMe(), 300);
    } else {
      this.scrollToMe();
    }
  }

  onPlaceSelected(place: PlaceSummary): void {
    if (!place.placeId) return;
    this.selectedPlace.set(place);
  }

  onTitleChanged(newTitle: string): void {
    const activity = this.activity();
    if (!activity) return;

    this.tripFacade.updateActivity(this.tripId(), {
      ...activity,
      title: newTitle,
      placeId: '',
      address: '',
      latitude: 0,
      longitude: 0,
      photoRefs: [],
    });
  }

  private scrollToMe(): void {
    const element = this.cardContainer().nativeElement;
    const offset = this.scrollOffset();
    const y = window.scrollY + element.getBoundingClientRect().top - offset - 13;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      message: 'Supprimer cette activité ?',
      accept: () => this.tripFacade.removeActivity(this.tripId(), this.activityId(), this.dayId()),
    });
  }

  private updateDragState = (event: MouseEvent | TouchEvent) => {
    const target = event.target as HTMLElement;
    if (this.cdkDrag) {
      this.cdkDrag.disabled = !target.closest('.drag-handle');
    }
  };

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }
}