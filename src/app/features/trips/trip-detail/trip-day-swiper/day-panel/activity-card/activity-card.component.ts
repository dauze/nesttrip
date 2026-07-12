import {
  Component, ElementRef, afterNextRender, computed, inject,
  input, signal, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CdkDrag, DragDropModule } from '@angular/cdk/drag-drop';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap } from 'rxjs';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { LoadingState, PlaceContact, PlaceAtmosphere, PlaceSummary } from '@app/core/models/place.dto';
import { BookingStatus } from '@core/enums/booking.status';
import { BOOKING_STATUS_META } from './activity.constants';

import { ActivityHeaderComponent } from './activity-header/activity-header.component';
import { ActivityFilesComponent } from './activity-files/activity-files.component';
import { ActivityFormComponent } from './activity-form/activity-form.component';
import { ActivityGalleryComponent } from './activity-gallery/activity-gallery.component';
import { ActivityGoogleInfoComponent } from './activity-google-info/activity-google-info.component';
import { Button } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [
    CommonModule, PanelModule, DividerModule, ProgressSpinnerModule, DragDropModule, Button,
    ActivityHeaderComponent, ActivityGalleryComponent, ActivityFormComponent,
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
  private cdkDrag = inject(CdkDrag, { self: true });
  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly activityId = input.required<string>();

  readonly activity = computed(() => this.tripFacade.getActivity(this.activityId())());

  readonly bookingMeta = computed(() => {
    const status = this.activity()?.booking?.status ?? BookingStatus.NOT_NEEDED;
    return BOOKING_STATUS_META[status];
  });

  readonly collapsed = signal(false);
  protected dragDisabled = signal(true);
  readonly scrollOffset = input(0);

  // Émet le placeId uniquement quand la carte est dépliée, null/'' sinon.
  // toSignal() est appelé ici dans le contexte d'injection de la classe (pas dans un effect),
  // ce qui est parfaitement légal — c'est l'équivalent d'un champ initialisé dans le constructeur.
  private readonly activeId$ = toObservable(
    computed(() => {
      const placeId = this.activity()?.placeId;
      return !this.collapsed() && placeId ? placeId : '';
    })
  ).pipe(distinctUntilChanged());

  readonly contactState = toSignal(
    this.activeId$.pipe(
      switchMap((id): ReturnType<typeof this.googlePlaceService.getPlaceContact$> =>
        id ? this.googlePlaceService.getPlaceContact$(id)
           : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlaceContact> }
  );

  readonly atmosphereState = toSignal(
    this.activeId$.pipe(
      switchMap((id): ReturnType<typeof this.googlePlaceService.getPlaceAtmosphere$> =>
        id ? this.googlePlaceService.getPlaceAtmosphere$(id)
           : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlaceAtmosphere> }
  );

  constructor() {
    afterNextRender(() => {
      const el = this.cardContainer()?.nativeElement;
      if (!el) return;
      el.addEventListener('mousedown', this.updateDragState, { capture: true });
      el.addEventListener('touchstart', this.updateDragState, { capture: true, passive: true });
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

  // Aucun appel réseau ici : tout vient du PlaceSummary (Basic Data, déjà dans les résultats de recherche)
  onPlaceSelected(place: PlaceSummary): void {
    const activity = this.activity();
    if (!activity || !place.placeId) return;

    this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
      ...activity,
      title: place.name,
      placeId: place.placeId,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      photoRef: place.photoRef?.name ?? '',
    });
  }

  onTitleChanged(newTitle: string): void {
    const activity = this.activity();
    if (!activity) return;

    this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
      ...activity,
      title: newTitle,
      placeId: '',
      address: '',
      latitude: 0,
      longitude: 0,
      photoRef: '',
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
      message: 'Supprimer cette activitée ?',
      accept: () => this.tripFacade.removeActivity(this.tripId(), this.dayId(), this.activityId()),
    });
  }

  private updateDragState = (event: MouseEvent | TouchEvent) => {
    const target = event.target as HTMLElement;
    this.cdkDrag.disabled = !target.closest('.drag-handle');
  };

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }
}