import { ChangeDetectionStrategy, Component, DestroyRef, ViewContainerRef, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CheckboxComponent } from '@app/shared/components/form-fields/checkbox/checkbox.component';
import { ChipComponent } from '@app/shared/components/feedback/chip/chip.component';
import { AutoCompleteComponent } from '@app/shared/components/form-fields/autocomplete/autocomplete.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/ui/viewport.service';
import { GooglePlaceService } from '@core/services/api/google-place.service';
import { LoadingState, PlaceSummary } from '@core/models/place.dto';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import { awaitOnce } from '@app/shared/utils/await-once.util';

/**
 * Champ "plusieurs destinations ?" (toggle + ajout de villes en chips) —
 * extrait de `AiTripPreferencesComponent` (ROADMAP.md "### UI") pour être
 * réutilisable en dehors du panneau IA : `NewTripComponent` (visible et
 * saisissable AVANT le choix manuel/IA, plus seulement en mode IA) et
 * `TripSettingsSectionComponent` (édition après création). `cities` est le
 * seul état persisté (`Trip.additionalCities`) ; le repli/dépli de la zone
 * d'ajout est un pur détail d'affichage local, initialisé ouvert si des
 * villes sont déjà présentes.
 */
@Component({
  selector: 'app-multi-city-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CheckboxComponent, ChipComponent, AutoCompleteComponent],
  templateUrl: './multi-city-field.component.html',
  styleUrl: './multi-city-field.component.scss',
})
export class MultiCityFieldComponent {
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly viewport = inject(ViewportService);

  readonly cities = model.required<string[]>();

  /**
   * `false` dans `MultiCityDialogComponent` (settings d'un trip existant,
   * ROADMAP.md "### UI" — retour utilisateur 2026-08-13 : "pour les
   * [destinations] additionnel[les], ne pas passer par la checkbox, si il a
   * cliqué dessus c'est qu'il veut en rajouter") : l'utilisateur a déjà
   * explicitement ouvert ce dialogue POUR gérer les destinations
   * additionnelles, la case "Plusieurs destinations ?" (utile à la création
   * d'un trip, où la plupart des voyages n'en ont aucune, voir `NewTripComponent`)
   * n'y a donc plus lieu d'être — la zone d'ajout est alors TOUJOURS dépliée,
   * sans geste intermédiaire.
   */
  readonly showToggle = input(true);

  /** Dépli initial : ouvert d'emblée si des villes sont déjà présentes (contexte édition) — posé une seule fois via `afterNextRender` (voir constructeur), pas en initialiseur de champ ni en constructeur direct (`cities` est un `model.required`, pas encore garanti résolu à ce stade, voir NG8118). Sans objet si `showToggle` est `false` (toujours déplié, voir template). */
  protected readonly expanded = signal(false);

  private readonly citySearchTerm = signal('');
  private readonly citySearchState = toSignal(
    this.googlePlaceService.search$(toObservable(this.citySearchTerm)),
    { initialValue: { status: 'idle' } as LoadingState<PlaceSummary[]> },
  );

  protected readonly cityPlaces = computed(() => {
    const state = this.citySearchState();
    return state.status === 'success' ? state.data : [];
  });
  protected readonly citySearching = computed(() => this.citySearchState().status === 'loading');

  protected readonly cityAutocompleteControl = new FormControl('', { nonNullable: true });

  constructor() {
    afterNextRender(() => this.expanded.set(this.cities().length > 0));
  }

  protected onToggle(): void {
    this.expanded.update((v) => !v);
  }

  protected onCitySearch(query: string): void {
    this.citySearchTerm.set(query ?? '');
  }

  protected onCitySelect(place: PlaceSummary): void {
    this.addCity(place.name);
  }

  protected async onCityTriggerClick(): Promise<void> {
    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: '', title: 'Ajouter une ville', placeholder: 'Rechercher une ville...' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.title-edit-dialog__input',
      },
    );
    const result = await awaitOnce(dialogRef.closed, this.destroyRef);
    if (!result) return;
    const name = result.type === 'place' ? result.place.name : result.text.trim();
    if (name) this.addCity(name);
  }

  protected removeCity(index: number): void {
    this.cities.update((cities) => cities.filter((_, i) => i !== index));
  }

  private addCity(name: string): void {
    this.cityAutocompleteControl.setValue('', { emitEvent: false });
    this.citySearchTerm.set('');
    this.cities.update((cities) => (cities.includes(name) ? cities : [...cities, name]));
  }

  protected displayPlaceName(place: PlaceSummary): string {
    return place.name;
  }
}
