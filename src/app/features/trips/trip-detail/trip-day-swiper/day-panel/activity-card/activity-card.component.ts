import { Component, ElementRef, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CdkDrag, DragDropModule } from '@angular/cdk/drag-drop';

import { TripFacade } from '@app/features/trips/trip-facade.service';
import { GooglePlaceService } from '@core/services/google.places.service';
import { Place } from '@app/core/models/place.dto';
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
    CommonModule,
    PanelModule,
    DividerModule,
    ProgressSpinnerModule,
    DragDropModule,
    Button,
    ActivityHeaderComponent,
    ActivityGalleryComponent,
    ActivityFormComponent,
    ActivityFilesComponent,
    ActivityGoogleInfoComponent,
    ConfirmDialog
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
  readonly lazyGoogleData = signal<Place | null>(null);
  readonly googleDataLoading = signal(false);
  protected dragDisabled = signal(true); 
  readonly scrollOffset = input(0);

  constructor() {
    // Récupère les données Google complètes dès qu'un placeId est connu et pas encore en cache.
    // Pas de flag "loaded" séparé : on dérive l'état "déjà chargé" de lazyGoogleData() !== null.
    effect(() => {
      const placeId = this.activity()?.placeId;
      if (!placeId || this.lazyGoogleData() !== null || this.googleDataLoading()) {
        return;
      }
      this.googleDataLoading.set(true);
      this.googlePlaceService.getPlaceDetail(placeId).subscribe({
        next: (place) => {
          this.lazyGoogleData.set(place);
          this.googleDataLoading.set(false);
        },
        error: () => this.googleDataLoading.set(false),
      });
    });

    afterNextRender(() => {
      const el = this.cardContainer()?.nativeElement;
      if (!el) return;

      el.addEventListener('mousedown', this.updateDragState, { capture: true });
      el.addEventListener('touchstart', this.updateDragState, { capture: true, passive: true });
    });
  }

    // activity-card.component.ts
  onCardPointerDown(event: MouseEvent | TouchEvent): void {
  const target = event.target as HTMLElement;
  this.dragDisabled.set(!target.closest('.drag-handle'));
}

  /** API publique — appelée depuis la liste parente pour déplier la carte et scroller dessus. */
  openAndScroll(): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
      // attendre le rendu
      setTimeout(() => {
        this.scrollToMe();
      }, 300);
    } else {
      this.scrollToMe();
    }
  }
  onPlaceSelected(place: Partial<Place>): void {
    const activity = this.activity();
    if (!activity || !place.placeId) return;

    this.lazyGoogleData.set(null);

    this.googlePlaceService.getPlaceDetail(place.placeId).subscribe((p) => {
      this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
        ...activity,
        title: p.name,
        placeId: p.placeId ?? '',
        address: p.address ?? '',
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
        openingHours: p.openingHours ?? [],
        phone: p.phone ?? '',
        website: p.website ?? '',
        priceLevel: p.priceLevel ?? 0,
      });
      this.lazyGoogleData.set(p);
    });
  }

  /** Titre édité librement (sans sélection dans l'autocomplete) -> on déconnecte le lieu Google. */
  onTitleChanged(newTitle: string): void {
    const activity = this.activity();
    if (!activity) return;

    this.lazyGoogleData.set(null);

    this.tripFacade.updateActivity(this.tripId(), this.dayId(), {
      ...activity,
      title: newTitle,
      placeId: '',
      address: '',
      latitude: 0,
      longitude: 0,
      rating: 0,
      reviewCount: 0,
      openingHours: [],
      phone: '',
      website: '',
      priceLevel: 0,
    });
  }

  private scrollToMe(): void {
    const element = this.cardContainer().nativeElement;
    const offset = this.scrollOffset();

    const y =
      window.scrollY +
      element.getBoundingClientRect().top -
      offset -
      8;

    window.scrollTo({
      top: y,
      behavior: 'smooth'
    });
  }

    confirmDelete(): void {
    this.confirmationService.confirm({
      message: 'Supprimer cette activitée ?',
      accept: () => this.tripFacade.removeActivity(this.tripId(), this.dayId(), this.activityId())
    });
  }


  private updateDragState = (event: MouseEvent | TouchEvent) => {
    const target = event.target as HTMLElement;
    this.cdkDrag.disabled = !target.closest('.drag-handle');
  };
}