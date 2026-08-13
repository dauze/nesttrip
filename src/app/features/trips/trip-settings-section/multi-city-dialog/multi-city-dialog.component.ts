import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { MultiCityFieldComponent } from '@app/shared/components/multi-city-field/multi-city-field.component';
import { ViewportService } from '@app/core/services/viewport.service';

export interface MultiCityDialogData {
  initialCities: string[];
}

/**
 * Édition de TOUTES les destinations d'un trip existant, principale
 * COMPRISE (ROADMAP.md "### UI", "pouvoir changer le multi destination dans
 * les settings du trip" — fusion demandée le 2026-08-13 : une seule entrée
 * "Destinations" dans `TripSettingsSectionComponent` plutôt que deux lignes
 * séparées "principale"/"additionnelles"). `initialCities[0]` est TOUJOURS
 * la destination principale courante — ce composant, purement liste de
 * strings (voir `MultiCityFieldComponent`), ne fait aucune distinction
 * visuelle entre position 0 et les suivantes ; c'est `TripSettingsSectionComponent`
 * (côté appelant) qui interprète `résultat[0]` comme la nouvelle principale
 * à la fermeture et déclenche, si besoin, une résolution Google Place dédiée
 * (une position dans cette liste n'est qu'un NOM, jamais un `placeId` — voir
 * `MultiCityFieldComponent`, qui ne conserve jamais l'identité Google d'une
 * ville ajoutée). Même anatomie (header/corps/pied Annuler-OK) que
 * `TravelTiersDialogComponent`.
 *
 * `[disabled]="cities().length === 0"` sur OK (retour utilisateur explicite,
 * 2026-08-13) : un voyage a TOUJOURS besoin d'au moins une destination —
 * jamais permettre de valider une liste vidée sans qu'aucune n'ait été
 * remise, plutôt qu'une validation a posteriori qui rejetterait le clic.
 */
@Component({
  selector: 'app-multi-city-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, MultiCityFieldComponent],
  templateUrl: './multi-city-dialog.component.html',
  styleUrl: './multi-city-dialog.component.scss',
})
export class MultiCityDialogComponent {
  private readonly dialogRef = inject(DialogRef<string[] | undefined>);
  private readonly data = inject<MultiCityDialogData>(DIALOG_DATA);
  protected readonly viewport = inject(ViewportService);

  protected readonly cities = signal(this.data.initialCities);
  protected readonly noDestinationLeft = computed(() => this.cities().length === 0);

  protected validate(): void {
    if (this.noDestinationLeft()) return;
    this.dialogRef.close(this.cities());
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
