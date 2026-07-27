import { Component, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import { GooglePlaceService } from '@core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@core/models/place.dto';

/**
 * Desktop uniquement : remplace la création immédiate au clic sur "+" (voir
 * ReservationsCreationService) — affiché à la place de la future carte, focus
 * posé sur le champ nom. État 100% local, rien n'est créé dans le store tant
 * que `confirmed` n'a pas été émis — mêmes règles de soumission que
 * `NewActivityDraftComponent`.
 */
@Component({
  selector: 'app-new-reservation-draft',
  standalone: true,
  imports: [ReactiveFormsModule, AutoCompleteComponent],
  templateUrl: './new-reservation-draft.component.html',
  styleUrl: './new-reservation-draft.component.scss',
})
export class NewReservationDraftComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  private readonly autocomplete = viewChild.required<AutoCompleteComponent<PlaceSummary>>('autocomplete');

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

  /** Une seule soumission possible (Entrée/blur/sélection peuvent sinon se chevaucher). */
  private submitted = false;

  displayName = (place: { name: unknown }): string => this.extractPlaceName(place?.name);

  constructor() {
    afterNextRender(() => this.autocomplete().focus());
  }

  onSearch(query: string): void {
    this.searchTerm.set(query ?? '');
  }

  onSelect(raw: PlaceSummary): void {
    if (!raw?.placeId || this.submitted) return;
    this.submit(this.extractPlaceName(raw.name));
  }

  onEnter(): void {
    this.tryConfirmFromText();
  }

  onBlur(): void {
    this.tryConfirmFromText();
  }

  private tryConfirmFromText(): void {
    if (this.submitted) return;
    const trimmed = this.titleControl.value.trim();
    if (!trimmed) {
      this.submit(undefined);
      return;
    }
    this.submit(trimmed);
  }

  private submit(title: string | undefined): void {
    if (this.submitted) return;
    this.submitted = true;
    if (title) this.confirmed.emit(title);
    else this.cancelled.emit();
  }

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }
}
