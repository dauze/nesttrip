import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';

import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { GooglePlaceService } from '@core/services/google.places.service';
import { Place } from '@app/core/models/place.dto';
import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_META } from '../activity.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';
import { GooglePhotoService } from '@app/core/services/google-photo.service';

@Component({
  selector: 'app-activity-header',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoComplete, DurationPipe],
  templateUrl: './activity-header.component.html',
})
export class ActivityHeaderComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly photoCache = inject(GooglePhotoService);

  readonly activity = input.required<Activity>();
  readonly lazyGoogleData = input<Place | null>(null);

  readonly placeSelected = output<Partial<Place>>();
  readonly titleEdited = output<string>();

  readonly activityTypeMeta = ACTIVITY_TYPE_META;
  readonly places = this.googlePlaceService.places;
  readonly searching = signal(false);

  /** Copie locale éditable, initialisée une seule fois depuis l'activité chargée. */
  readonly title = signal('');

  readonly firstPhotoRef = computed(() => this.lazyGoogleData()?.photos?.[0]);

  constructor() {
    runOnceReady(this.activity, (a) => this.title.set(a.title));
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.searching.set(true);
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    const place = event.value as Partial<Place>;
    if (!place.placeId) return;
    this.title.set(place.name ?? '');
    this.placeSelected.emit(place);
  }

  onTitleBlur(): void {
    const next = this.title();
    if (this.activity().title === next) return;
    this.titleEdited.emit(next);
  }

  getPhotoUrl$(ref: string, maxWidth = 800) {
    return this.photoCache.getPhotoUrl$(ref, maxWidth);
  }
}