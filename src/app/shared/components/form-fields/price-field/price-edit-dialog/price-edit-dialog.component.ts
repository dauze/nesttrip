import { AfterViewInit, ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { InputNumberComponent } from '@app/shared/components/form-fields/input-number/input-number.component';
import { SelectComponent, SelectOption } from '@app/shared/components/form-fields/select/select.component';
import { PriceFieldValue } from '../price-field.component';
import { ViewportService } from '@app/core/services/ui/viewport.service';

export interface PriceEditDialogData {
  initialAmount: number | null;
  initialCurrency: string;
  currencyOptions: SelectOption<string>[];
  title: string;
  /** Appelé uniquement à la validation ("OK") — voir PriceFieldComponent, la saisie reste un brouillon local tant que ce tiroir est ouvert. */
  onConfirm: (value: PriceFieldValue) => void;
}

/**
 * Tiroir mobile pour éditer le prix + la devise d'une activité/réservation
 * (voir ROADMAP.md). Ouvert par `PriceFieldComponent.openDialog()` via
 * `DialogService`. `amountControl`/`currencyControl` sont des `FormControl`
 * LOCAUX à ce composant (pas les mêmes instances que `PriceFieldComponent`,
 * contrairement à une version précédente) : brouillon + "Annuler"/"OK"
 * (même pattern que `TimePickerClockComponent`, pour l'uniformité entre
 * tiroirs mobile) — la saisie ne remonte au champ appelant (`data.onConfirm`)
 * qu'au clic sur "OK". Fermer autrement (croix, "Annuler", backdrop/Échap
 * gérés par CDK) abandonne le brouillon sans rien modifier.
 */
@Component({
  selector: 'app-price-edit-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, InputNumberComponent, SelectComponent],
  templateUrl: './price-edit-dialog.component.html',
  styleUrl: './price-edit-dialog.component.scss',
})
export class PriceEditDialogComponent implements AfterViewInit {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<PriceEditDialogData>(DIALOG_DATA);
  protected readonly viewport = inject(ViewportService);

  protected readonly amountControl = new FormControl<number | null>(this.data.initialAmount);
  protected readonly currencyControl = new FormControl<string>(this.data.initialCurrency, { nonNullable: true });

  private readonly amountInputRef = viewChild.required(InputNumberComponent);

  ngAfterViewInit(): void {
    this.amountInputRef().focus();
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    this.data.onConfirm({ amount: this.amountControl.value ?? 0, currency: this.currencyControl.value });
    this.dialogRef.close();
  }
}
