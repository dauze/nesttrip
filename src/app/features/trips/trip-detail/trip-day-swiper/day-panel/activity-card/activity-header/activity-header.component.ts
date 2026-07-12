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
  readonly firstPhotoRef = computed(() => {
    const refs = this.activity().photoRefs;
    return refs && refs.length > 0 ? refs[0] : null;
  });

  constructor() {
    runOnceReady(this.activity, (a) => this.title.set(a.title));
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.googlePlaceService.setSearchTerm(event.query ?? '');
  }

  /**
   * PrimeNG AutoComplete écrit aussi l'objet complet sélectionné via ngModelChange
   * (même quand `field` est utilisé pour l'affichage). On ignore volontairement
   * ces valeurs non-string ici : c'est onSelect() qui a la responsabilité exclusive
   * de fixer le titre lors d'une sélection. Cela évite qu'un objet PlaceSummary
   * ne se retrouve stocké dans le signal `title` (=> "[object Object]" affiché).
   */
  onModelChange(value: string | PlaceSummary): void {
    if (typeof value === 'string') {
      this.title.set(value);
    }
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    const place = event.value as PlaceSummary;
    if (!place?.placeId) return;
    this.title.set(place.name);
    this.placeSelected.emit(place);
  }

  onTitleBlur(): void {
    const next = this.title();
    // Garde-fou : si un blur survient pendant une sélection (race condition
    // PrimeNG), `next` peut transitoirement être un objet plutôt qu'une string.
    // On ignore plutôt que de propager une valeur invalide au parent.
    if (typeof next !== 'string') return;

    const trimmed = next.trim();
    if (this.activity().title === trimmed) return;
    this.titleEdited.emit(trimmed);
  }

  getPhotoUrl$(ref: string, maxWidth = 100) {
    return this.photoCache.getPhotoUrl$(ref, maxWidth);
  }
}