import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SelectComponent, SelectOption } from '@app/shared/components/select/select.component';
import { SliderComponent } from '@app/shared/components/slider/slider.component';
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

const TIER1_MAX_KM = 20;
const TIER2_MAX_KM = 100;

/**
 * Tiroir "3 paliers" pilotant `selectTravelMode` : palier 1 (liste de mode +
 * slider 0–20km), palier 2 (liste de mode + slider borné entre le palier 1
 * courant et 100km), palier 3 "sinon" (liste de mode seule, pas de borne —
 * dernier palier). Même anatomie (header/champs/pied Annuler-OK) que le
 * reste des dialogs du projet (voir `SimpleTextEntryDialogComponent`).
 */
@Component({
  selector: 'app-travel-tiers-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, SelectComponent, SliderComponent],
  templateUrl: './travel-tiers-dialog.component.html',
  styleUrl: './travel-tiers-dialog.component.scss',
})
export class TravelTiersDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(DialogRef<TravelTiers | undefined>);
  private readonly data = inject<TravelTiersDialogData>(DIALOG_DATA);

  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly tier1Max = TIER1_MAX_KM;
  protected readonly tier2Max = TIER2_MAX_KM;

  protected readonly form = this.fb.nonNullable.group({
    tier1Mode: this.data.initialValue.tier1Mode,
    tier1MaxKm: this.data.initialValue.tier1MaxKm,
    tier2Mode: this.data.initialValue.tier2Mode,
    tier2MaxKm: this.data.initialValue.tier2MaxKm,
    tier3Mode: this.data.initialValue.tier3Mode,
  });

  // `effect()` ne suit QUE des signaux : lire `form.getRawValue()` (getter
  // ordinaire) directement dedans figerait toute dérivation après sa
  // première évaluation, comme documenté sur `TripHeaderComponent.dateRangeLabel`
  // (ROADMAP.md "Bugs / fixes") — `toSignal(form.valueChanges, ...)` rend le
  // form réellement réactif ici.
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Dernière valeur connue du palier 1 — sert uniquement à détecter si le palier 2 le "suivait" (voir l'effect ci-dessous), pas un signal (pure bookkeeping interne). */
  private previousTier1MaxKm = this.data.initialValue.tier1MaxKm;

  constructor() {
    // Le slider du palier 2 a un `[min]`/`[max]` FIXES (0–100, voir le
    // template) — PAS dynamiquement bornés par le palier 1 comme dans une
    // itération précédente : un `<input type="range">` natif recalcule tout
    // seul sa valeur DOM affichée quand son `min` change (pour préserver le
    // même nombre de pas depuis `min`, pas la même valeur), ce qui, combiné
    // à une contrainte "min = palier 1", provoquait une dérive du palier 2
    // vers 100km à chaque aller-retour du palier 1 (retour utilisateur).
    //
    // La contrainte "palier 2 ≥ palier 1" est donc appliquée ICI, en JS pur,
    // avec le comportement précisément demandé : le palier 2 suit le
    // palier 1 dans LES DEUX SENS tant qu'il lui est "attaché" (jamais
    // détaché par un réglage manuel indépendant) — détecté en comparant le
    // palier 2 courant à la valeur du palier 1 lors du dernier passage. Dès
    // que l'utilisateur bouge le palier 2 lui-même à une valeur différente,
    // il se détache et n'est plus affecté par le palier 1 (sauf si celui-ci
    // le rattrape/dépasse à nouveau, qui le rattache).
    effect(() => {
      const tier1 = this.formValue().tier1MaxKm ?? 0;
      const tier2 = untracked(() => this.formValue().tier2MaxKm) ?? 0;
      const wasAttached = tier2 === this.previousTier1MaxKm;
      if ((tier1 > tier2 || wasAttached) && tier2 !== tier1) {
        this.form.patchValue({ tier2MaxKm: tier1 });
      }
      this.previousTier1MaxKm = tier1;
    });
  }

  protected validate(): void {
    this.dialogRef.close(this.form.getRawValue());
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
