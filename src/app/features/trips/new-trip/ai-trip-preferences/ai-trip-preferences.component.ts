import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectButtonComponent } from '@app/shared/components/select-button/select-button.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { GooglePlaceService } from '@core/services/google-place.service';
import { LoadingState, PlaceSummary } from '@core/models/place.dto';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import { MAX_NOTES_LENGTH } from '@app/shared/utils/input-limits';
import {
  ASSISTANCE_LEVEL_OPTIONS, INTEREST_OPTIONS, Interest,
  PACE_OPTIONS, TRAVELER_TYPE_OPTIONS, TripAiPreferences,
} from '../trip-ai-preferences.model';
import { InterestsDialogComponent, InterestsDialogData } from './interests-dialog/interests-dialog.component';

/**
 * Panneau de préférences du mode "Laisser l'IA m'aider" (écran "Nouveau
 * voyage" — voir src/specs/process-creation-trip-ia.md §2.3). Lot 1 : purement
 * front, aucun appel backend, `preferences` reste dans l'état local du
 * formulaire parent (voir `NewTripComponent`).
 *
 * Champ "villes" (multi-city) : mêmes briques que le champ Destination du
 * formulaire parent (`AutoCompleteComponent` desktop / `TitleEditDialogComponent`
 * mobile), mais en mode "ajout à une liste" plutôt que valeur unique — d'où
 * un branchement direct sur `GooglePlaceService.search$` (flux scopé à cette
 * instance, voir sa doc) plutôt que le `setSearchTerm`/`places` global déjà
 * utilisé par le champ Destination visible simultanément sur la même page.
 */
@Component({
  selector: 'app-ai-trip-preferences',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, SelectButtonComponent, CheckboxComponent, ChipComponent,
    AutoCompleteComponent, TextareaDirective, InputTextDirective,
  ],
  templateUrl: './ai-trip-preferences.component.html',
  styleUrl: './ai-trip-preferences.component.scss',
})
export class AiTripPreferencesComponent {
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly googlePlaceService = inject(GooglePlaceService);
  protected readonly viewport = inject(ViewportService);

  readonly preferences = model.required<TripAiPreferences>();

  protected readonly assistanceLevelOptions = ASSISTANCE_LEVEL_OPTIONS;
  protected readonly travelerTypeOptions = TRAVELER_TYPE_OPTIONS;
  protected readonly paceOptions = PACE_OPTIONS;
  protected readonly maxFreeTextLength = MAX_NOTES_LENGTH;

  protected readonly interestsLabel = computed(() => {
    const selected = this.preferences().interests;
    if (selected.length === 0) return 'Ajouter des centres d\'intérêt';
    const byValue = new Map(INTEREST_OPTIONS.map((o) => [o.value, o.label]));
    return selected.map((v) => byValue.get(v)).filter(Boolean).join(', ');
  });

  // --- Ajout de ville (multi-city) ---

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

  /** `SelectButtonComponent.valueChange` type toujours `T | undefined` (aucune sélection possible en théorie) — en pratique toujours défini ici, un clic sélectionne forcément une des options du tableau. */
  protected onAssistanceLevelChange(assistanceLevel: TripAiPreferences['assistanceLevel'] | undefined): void {
    if (assistanceLevel === undefined) return;
    this.preferences.update((p) => ({ ...p, assistanceLevel }));
  }

  protected onTravelerTypeChange(travelerType: TripAiPreferences['travelerType'] | undefined): void {
    if (travelerType === undefined) return;
    this.preferences.update((p) => ({ ...p, travelerType }));
  }

  protected onPaceChange(pace: TripAiPreferences['pace'] | undefined): void {
    if (pace === undefined) return;
    this.preferences.update((p) => ({ ...p, pace }));
  }

  protected onMultiCityToggle(): void {
    this.preferences.update((p) => ({ ...p, multiCity: !p.multiCity }));
  }

  protected onFreeTextInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.preferences.update((p) => ({ ...p, freeText: text }));
  }

  /** Best-effort côté LLM (voir apply-budget-cap.ts côté serveur) — jamais une garantie stricte, d'où le libellé "Budget max" plutôt qu'un vrai plafond contractuel. */
  protected onBudgetMaxInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const budgetMaxEur = raw === '' ? undefined : Number(raw);
    this.preferences.update((p) => ({ ...p, budgetMaxEur: budgetMaxEur !== undefined && budgetMaxEur >= 0 ? budgetMaxEur : undefined }));
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
    const result = await new Promise<TitleEditDialogResult | undefined>((resolve) => {
      const sub = dialogRef.closed.subscribe((value) => {
        sub.unsubscribe();
        resolve(value);
      });
    });
    if (!result) return;
    const name = result.type === 'place' ? result.place.name : result.text.trim();
    if (name) this.addCity(name);
  }

  protected removeCity(index: number): void {
    this.preferences.update((p) => ({ ...p, cities: p.cities.filter((_, i) => i !== index) }));
  }

  private addCity(name: string): void {
    this.cityAutocompleteControl.setValue('', { emitEvent: false });
    this.citySearchTerm.set('');
    this.preferences.update((p) => (p.cities.includes(name) ? p : { ...p, cities: [...p.cities, name] }));
  }

  protected displayPlaceName(place: PlaceSummary): string {
    return place.name;
  }

  // --- Centres d'intérêt ---

  protected openInterestsDialog(): void {
    const dialogRef = this.dialogService.open<Interest[] | undefined, InterestsDialogData>(
      InterestsDialogComponent,
      {
        data: { selected: this.preferences().interests },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );
    dialogRef.closed.subscribe((interests) => {
      if (interests === undefined) return;
      this.preferences.update((p) => ({ ...p, interests }));
    });
  }
}
