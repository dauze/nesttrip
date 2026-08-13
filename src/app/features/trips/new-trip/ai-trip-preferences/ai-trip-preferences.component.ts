import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, model } from '@angular/core';
import { SelectButtonComponent } from '@app/shared/components/select-button/select-button.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DialogService } from '@app/shared/services/dialog.service';
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
 * Le champ "plusieurs destinations ?" (multi-city) a été déplacé hors de ce
 * panneau (ROADMAP.md "### UI", `app-multi-city-field`, monté par
 * `NewTripComponent` avant le choix manuel/IA — saisissable dans les 2 modes,
 * plus seulement en IA) : `preferences().multiCity`/`.cities` restent dans le
 * contrat `TripAiPreferences` (consommés par la Cloud Function de génération)
 * mais sont désormais renseignés par `NewTripComponent` à la soumission,
 * depuis `Trip.additionalCities` — jamais édités ici.
 */
@Component({
  selector: 'app-ai-trip-preferences',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectButtonComponent, TextareaDirective, InputTextDirective],
  templateUrl: './ai-trip-preferences.component.html',
  styleUrl: './ai-trip-preferences.component.scss',
})
export class AiTripPreferencesComponent {
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

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
