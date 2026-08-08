import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SelectComponent, SelectOption } from '@app/shared/components/select/select.component';
import { PaliersTrajetSliderComponent } from './paliers-trajet-slider/paliers-trajet-slider.component';
import { TravelTiers } from '@app/features/trips/trip.model';
import { TravelMode } from '../../trip-day-swiper/day-panel/day-distance-gap/travel-mode.util';

export interface TravelTiersDialogData {
  initialValue: TravelTiers;
}

const MODE_OPTIONS: SelectOption<TravelMode>[] = [
  { label: 'Marche', value: 'walk', icon: 'nt-icon-walk' },
  { label: 'Vélo', value: 'bike', icon: 'nt-icon-bike' },
  { label: 'Voiture', value: 'car', icon: 'pi pi-car' },
];

const MAX_KM = 20;

/**
 * Tiroir "3 paliers" pilotant `selectTravelMode` : palier 1 et palier 2
 * partagent une piste unique à 2 poignées (`PaliersTrajetSliderComponent`,
 * axe 0–100km, contrainte `tier1MaxKm ≤ tier2MaxKm` appliquée DANS le
 * composant lui-même — voir sa doc pour l'historique des bugs de
 * synchronisation que ça remplace), palier 3 "sinon" (liste de mode seule,
 * pas de borne — dernier palier). Même anatomie (header/champs/pied
 * Annuler-OK) que le reste des dialogs du projet (voir
 * `SimpleTextEntryDialogComponent`).
 */
@Component({
  selector: 'app-travel-tiers-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent, PaliersTrajetSliderComponent],
  templateUrl: './travel-tiers-dialog.component.html',
  styleUrl: './travel-tiers-dialog.component.scss',
})
export class TravelTiersDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(DialogRef<TravelTiers | undefined>);
  private readonly data = inject<TravelTiersDialogData>(DIALOG_DATA);

  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly maxKm = MAX_KM;

  protected readonly form = this.fb.nonNullable.group({
    tier1Mode: this.data.initialValue.tier1Mode,
    tier1MaxKm: this.data.initialValue.tier1MaxKm,
    tier2Mode: this.data.initialValue.tier2Mode,
    tier2MaxKm: this.data.initialValue.tier2MaxKm,
    tier3Mode: this.data.initialValue.tier3Mode,
  });

  // `toSignal(form.valueChanges, ...)` rend le form réactif pour alimenter
  // `[tier1Value]`/`[tier2Value]` — un getter `form.getRawValue()` lu
  // directement dans un template ne redéclenche pas Angular tout seul, voir
  // `TripHeaderComponent.dateRangeLabel` (ROADMAP.md "Bugs / fixes").
  protected readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  // `.valueChanges` (donc `formValue()`) type chaque champ en optionnel (Angular
  // exclut les contrôles désactivés de `.value`), alors que ce form n'en a
  // aucun — fallback théorique uniquement, pour satisfaire `[tier1Value]`/
  // `[tier2Value]` (`number`, pas `number | undefined`).
  protected readonly tier1Km = computed(() => this.formValue().tier1MaxKm ?? 0);
  protected readonly tier2Km = computed(() => this.formValue().tier2MaxKm ?? 0);

  protected validate(): void {
    this.dialogRef.close(this.form.getRawValue());
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
