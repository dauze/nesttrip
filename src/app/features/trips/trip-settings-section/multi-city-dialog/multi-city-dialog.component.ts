import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { MultiCityFieldComponent } from '@app/shared/components/multi-city-field/multi-city-field.component';
import { ViewportService } from '@app/core/services/viewport.service';

export interface MultiCityDialogData {
  initialCities: string[];
}

/**
 * Édition des destinations additionnelles d'un trip existant (ROADMAP.md
 * "### UI", "pouvoir changer le multi destination dans les settings du
 * trip") — ouvert depuis `TripSettingsSectionComponent`. Même anatomie
 * (header/corps/pied Annuler-OK) que `TravelTiersDialogComponent`.
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

  protected validate(): void {
    this.dialogRef.close(this.cities());
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
