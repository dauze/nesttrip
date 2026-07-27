import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import { GooglePlaceService } from '@core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@core/models/place.dto';
import { runOnceReady } from '@app/shared/utils/run-once-ready';

/**
 * Champ d'autocomplete Google Places réutilisé par les 4 formulaires de
 * détail de réservation (hôtel/vol×2/location×2) — extrait pour éviter de
 * dupliquer 4 fois le même branchement sur `GooglePlaceService.search$`
 * (voir `ActivityHeaderComponent` pour le pattern d'origine). `AutoCompleteComponent`
 * n'accepte qu'une valeur texte libre (CVA sur une chaîne) : l'objet
 * `PlaceSummary` complet n'est jamais dans le form, il est émis à part via
 * `placeSelected`, à charge de l'appelant (`ReservationFormComponent`) de le
 * conserver pour la sauvegarde.
 */
@Component({
  selector: 'app-place-autocomplete-field',
  standalone: true,
  imports: [ReactiveFormsModule, AutoCompleteComponent],
  templateUrl: './place-autocomplete-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceAutocompleteFieldComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);

  readonly label = input('');
  readonly placeholder = input("Rechercher un lieu...");
  readonly initialPlace = input<PlaceSummary | undefined>();

  readonly placeSelected = output<PlaceSummary>();

  readonly displayControl = new FormControl('', { nonNullable: true });

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

  constructor() {
    runOnceReady(this.initialPlace, (place) => this.displayControl.setValue(place.name, { emitEvent: false }));
  }

  onSearch(query: string): void {
    this.searchTerm.set(query ?? '');
  }

  onSelect(raw: PlaceSummary): void {
    if (!raw?.placeId) return;
    const place: PlaceSummary = { ...raw, name: this.extractPlaceName(raw.name) };
    this.displayControl.setValue(place.name);
    this.placeSelected.emit(place);
  }

  displayName = (place: { name: unknown }): string => this.extractPlaceName(place?.name);

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }
}
