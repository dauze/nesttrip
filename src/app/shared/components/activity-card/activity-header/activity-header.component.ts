import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms'; // Import de ReactiveForms
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { Activity } from '../activity.model';
import { ACTIVITY_TYPE_META } from '../activity.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';
import { GooglePhotoService } from '@app/core/services/google-photo.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@app/core/models/place.dto';
import { DayLabelsListPipe } from '@app/shared/pipes/day-labels-list.pipe';
import { TagComponent } from '@app/shared/components/tag/tag.component';

@Component({
  selector: 'app-activity-header',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutoComplete,  TagComponent, DayLabelsListPipe,],
  templateUrl: './activity-header.component.html',
  styleUrl: './activity-header.component.scss',
})
export class ActivityHeaderComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly photoCache = inject(GooglePhotoService);

  readonly activity = input.required<Activity>();
  readonly dayId = input.required<Date | undefined>();
  readonly isPlacedNowhere = input.required<boolean>();
  readonly assignedDays = input.required<Date[]>();
  
  readonly placeSelected = output<PlaceSummary>();
  readonly titleEdited = output<string>();

  readonly activityTypeMeta = ACTIVITY_TYPE_META;

  // Recherche scopée à CETTE instance : deux ActivityHeaderComponent
  // simultanément affichés (ex. plusieurs cartes dans la vue "Activités")
  // ne partagent plus le même état de recherche global, contrairement à
  // l'ancien `googlePlaceService.places`/`searching` (signaux uniques
  // partagés par toute l'app).
  private readonly searchTerm = signal('');
  private readonly searchState = toSignal(
    this.googlePlaceService.search$(toObservable(this.searchTerm)),
    { initialValue: { status: 'idle' } as LoadingState<PlaceSummary[]> },
  );

  readonly places = computed(() => {
    const s = this.searchState();
    return s.status === 'success' ? s.data : [];
  });
  readonly searching = computed(() => this.searchState().status === 'loading');

  readonly titleControl = new FormControl('', { nonNullable: true });

  readonly firstPhotoRef = computed(() => {
    const refs = this.activity().photoRefs;
    return refs && refs.length > 0 ? refs[0] : null;
  });

  constructor() {
     runOnceReady(this.activity, (a) => this.titleControl.setValue(a.title, { emitEvent: false }));
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    this.searchTerm.set(event.query ?? '');
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    const raw = event.value as PlaceSummary;
    if (!raw?.placeId) return;

    const place: PlaceSummary = { ...raw, name: this.extractPlaceName(raw.name) };

    // En forçant la valeur ici, le FormControl court-circuite le composant 
    // et lui réinjecte immédiatement la string. Zéro flash global.
    this.titleControl.setValue(place.name);
    
    this.placeSelected.emit(place);
  }

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }

  displayName(place: { name: unknown }): string {
    return this.extractPlaceName(place?.name);
  }

  onTitleBlur(): void {
    const next = this.titleControl.value;
    if (typeof next !== 'string') return;

    const trimmed = next.trim();
    if (this.activity().title === trimmed) return;
    this.titleEdited.emit(trimmed);
  }

  getPhotoUrl$(ref: string, maxWidth = 100) {
    return this.photoCache.getPhotoUrl$(ref, maxWidth);
  }
}