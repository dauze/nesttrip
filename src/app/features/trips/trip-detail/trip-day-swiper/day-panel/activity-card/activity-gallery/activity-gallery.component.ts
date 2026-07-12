import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap } from 'rxjs';
import { PanelBeforeToggleEvent } from 'primeng/panel';

import { GooglePlaceService } from '@app/core/services/google-place.service';
import { GooglePhotoService } from '@app/core/services/google-photo.service';
import { LoadingState, PlacePhotos } from '@app/core/models/place.dto';

const MAX_PHOTOS = 6;

@Component({
  selector: 'app-activity-gallery',
  standalone: true,
  imports: [CommonModule, DividerModule, PanelModule, ProgressSpinnerModule],
  templateUrl: './activity-gallery.component.html',
  styleUrl: './activity-gallery.component.scss',
})
export class ActivityGalleryComponent {
  private readonly placeService = inject(GooglePlaceService);
  private readonly photoCache = inject(GooglePhotoService);

  readonly placeId = input<string>('');
  readonly altText = input('');

  // Le fetch ne part que quand l'utilisateur déplie le panel ET qu'un placeId est disponible.
  private readonly shouldLoad = signal(false);

  readonly photosState = toSignal(
    toObservable(computed(() => this.shouldLoad() ? this.placeId() : '')).pipe(
      distinctUntilChanged(),
      switchMap((id): ReturnType<typeof this.placeService.getPlacePhotos$> =>
        id ? this.placeService.getPlacePhotos$(id)
           : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlacePhotos> }
  );

  readonly loading = computed(() => this.photosState().status === 'loading');
  readonly photoRefs = computed(() => {
    const s = this.photosState();
    return s.status === 'success' ? s.data.photos.slice(0, MAX_PHOTOS) : [];
  });

  readonly currentIndex = signal(0);

  onPanelToggle(event: PanelBeforeToggleEvent): void {
     if (!event.collapsed) return;
    this.shouldLoad.set(true);
  }

  prevPhoto(): void { this.currentIndex.update((i) => i - 1); }
  nextPhoto(): void { this.currentIndex.update((i) => i + 1); }

  getPhotoUrl$(ref: string, maxWidth = 800) {
    return this.photoCache.getPhotoUrl$(ref, maxWidth);
  }
}