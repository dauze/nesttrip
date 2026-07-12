import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';

import { DurationPipe } from '@app/shared/pipes/duration.pipe';
import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_META } from '../activity.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';
import { GooglePhotoService } from '@app/core/services/google-photo.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { PlaceSummary } from '@app/core/models/place.dto';

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

  readonly placeSelected = output<PlaceSummary>();
  readonly titleEdited = output<string>();

  readonly activityTypeMeta = ACTIVITY_TYPE_META;
  readonly places = this.googlePlaceService.places;
  readonly searching = this.googlePlaceService.searching;

  readonly title = signal('');

  // La miniature vient directement du champ persisté (Basic Data, écrit à la sélection) —
  // plus aucune dépendance à un fetch async ici, plus de flicker.
  readonly firstPhotoRef = computed(() => this.activity().photoRef || null);

  constructor() {
    runOnceReady(this.activity, (a) => this.title.set(a.title));
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    const place = event.value as PlaceSummary;
    if (!place.placeId) return;
    this.title.set(place.name);
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