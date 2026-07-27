import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { GooglePlaceService } from '@core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@core/models/place.dto';
import { runOnceReady } from '@app/shared/utils/run-once-ready';

/**
 * Champ d'autocomplete Google Places réutilisé par les formulaires de détail
 * de réservation (hôtel/vol×2/location×2) — extrait pour éviter de dupliquer
 * le branchement sur `GooglePlaceService.search$` (voir `ActivityHeaderComponent`
 * pour le pattern d'origine). `AutoCompleteComponent` n'accepte qu'une valeur
 * texte libre (CVA sur une chaîne) : l'objet `PlaceSummary` complet n'est
 * jamais dans un form, il est émis à part via `placeSelected`.
 *
 * Mobile (`ViewportService.isMobile()`) : texte statique cliquable (pas de
 * crayon séparé) qui ouvre `TitleEditDialogComponent` en tiroir plein écran
 * (réutilisé tel quel, générique) au clic/tap direct sur le texte, plutôt
 * que l'autocomplete inline utilisée sur desktop.
 */
@Component({
  selector: 'app-place-autocomplete-field',
  standalone: true,
  imports: [ReactiveFormsModule, AutoCompleteComponent],
  templateUrl: './place-autocomplete-field.component.html',
  styleUrl: './place-autocomplete-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceAutocompleteFieldComponent {
  private readonly googlePlaceService = inject(GooglePlaceService);
  protected readonly viewport = inject(ViewportService);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

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

  /** Mobile uniquement (voir le template) : ouvre le tiroir plein écran de recherche au clic/tap sur le texte, en lieu de l'autocomplete inline. */
  openMobileDialog(event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: this.displayControl.value, placeholder: this.placeholder() },
        panelClass: 'app-title-edit-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (!result) return;

      if (result.type === 'place') {
        this.onSelect(result.place);
        return;
      }

      // Texte libre sans `placeId` : rien à émettre côté place (cohérent avec
      // l'autocomplete desktop, qui n'émet `placeSelected` que sur un vrai
      // choix Google, jamais sur une simple frappe de texte).
      this.displayControl.setValue(result.text.trim());
    });
  }

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }
}
