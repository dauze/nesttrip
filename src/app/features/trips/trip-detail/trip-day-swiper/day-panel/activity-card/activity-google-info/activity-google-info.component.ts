import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { PanelBeforeToggleEvent } from 'primeng/panel';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap } from 'rxjs';

import { Activity } from '../activity.model';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { LoadingState, PlaceContact, PlaceAtmosphere, PlaceReviews } from '@app/core/models/place.dto';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

@Component({
  selector: 'app-activity-google-info',
  standalone: true,
  imports: [CommonModule, TagModule, PanelModule, DividerModule],
  templateUrl: './activity-google-info.component.html',
})
export class ActivityGoogleInfoComponent {
  private readonly placeService = inject(GooglePlaceService);

  readonly activity = input.required<Activity>();
  readonly dayId = input.required<Date>();

  // Contact et Atmosphere arrivent du parent (ActivityCardComponent),
  // qui contrôle le déclenchement selon collapsed().
  readonly contactState = input<LoadingState<PlaceContact>>({ status: 'idle' });
  readonly atmosphereState = input<LoadingState<PlaceAtmosphere>>({ status: 'idle' });

  // Les avis : décision locale, seulement au premier dépliage du panel dédié.
  private readonly shouldLoadReviews = signal(false);

  readonly reviewsState = toSignal(
    toObservable(computed(() =>
      this.shouldLoadReviews() ? this.activity().placeId : ''
    )).pipe(
      distinctUntilChanged(),
      switchMap((id): ReturnType<typeof this.placeService.getPlaceReviews$> =>
        id ? this.placeService.getPlaceReviews$(id)
           : of({ status: 'idle' as const })
      )
    ),
    { initialValue: { status: 'idle' as const } as LoadingState<PlaceReviews> }
  );

  onReviewsPanelToggle(event: PanelBeforeToggleEvent): void {
    if (event.collapsed !== false) return;
    this.shouldLoadReviews.set(true);
  }

  readonly contact = computed(() => {
    const s = this.contactState();
    return s.status === 'success' ? s.data : null;
  });
  readonly atmosphere = computed(() => {
    const s = this.atmosphereState();
    return s.status === 'success' ? s.data : null;
  });
  readonly reviews = computed(() => {
    const s = this.reviewsState();
    return s.status === 'success' ? s.data.reviews : null;
  });

  readonly atmosphereLoading = computed(() => this.atmosphereState().status === 'loading');
  readonly reviewsLoading = computed(() => this.reviewsState().status === 'loading');

  readonly isVisible = computed(() => !!this.activity().placeId);

  readonly mapsUrl = computed(() => {
    const address = this.activity().address;
    const title = this.activity().title;
    if (!address?.length && !title?.length) return null;
    const query = encodeURIComponent(address || title);
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${this.activity().placeId}`;
  });

  readonly todayDayName = computed(() => DAY_NAMES[this.dayId().getDay()]);

  readonly isOpenNow = computed(() => {
    const hours = this.contact()?.openingHours;
    if (!hours?.length) return null;

    const day = this.dayId();
    const now = new Date();
    const checkTime = new Date(day);
    checkTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const todayName = DAY_NAMES[checkTime.getDay()];
    const todayLine = hours.find((h) => h.toLowerCase().startsWith(todayName));
    if (!todayLine) return false;
    if (todayLine.toLowerCase().includes('fermé')) return false;

    const ranges = [...todayLine.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)];
    const hm = checkTime.getHours() * 60 + checkTime.getMinutes();

    return ranges.some(([, sh, sm, eh, em]) => {
      const start = +sh * 60 + +sm;
      let end = +eh * 60 + +em;
      if (end < start) end += 24 * 60;
      return hm >= start && hm <= end;
    });
  });

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }
}