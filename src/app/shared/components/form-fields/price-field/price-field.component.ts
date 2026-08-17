import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';

import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/ui/viewport.service';
import { InputNumberComponent } from '@app/shared/components/form-fields/input-number/input-number.component';
import { SelectComponent, SelectOption } from '@app/shared/components/form-fields/select/select.component';
import { PriceEditDialogComponent, PriceEditDialogData } from './price-edit-dialog/price-edit-dialog.component';

export interface PriceFieldValue {
  amount: number;
  currency: string;
}

/**
 * Champ prix + devise d'une activité/réservation (voir ROADMAP.md, "Édition
 * d'activité 100% par composants dédiés mobile"). CVA composite : les deux
 * `FormControl` internes (`amountControl`/`currencyControl`) sont bindés
 * directement côté desktop (inline, inchangé). Côté mobile, le tiroir édite
 * un brouillon LOCAL (ses propres `FormControl`, voir PriceEditDialogComponent)
 * et ne remonte la valeur ici (`onChange`) qu'au clic sur "OK" — fermer
 * autrement (croix, "Annuler", backdrop/Échap) abandonne le brouillon, même
 * pattern que NotesFieldComponent.
 */
@Component({
  selector: 'app-price-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputNumberComponent, SelectComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PriceFieldComponent),
      multi: true,
    },
  ],
  templateUrl: './price-field.component.html',
  styleUrl: './price-field.component.scss',
})
export class PriceFieldComponent implements ControlValueAccessor {
  private readonly dialogService = inject(DialogService);
  protected readonly viewport = inject(ViewportService);

  readonly currencyOptions = input.required<SelectOption<string>[]>();
  readonly inputId = input<string>('');
  readonly title = input('Prix');

  protected readonly amountControl = new FormControl<number | null>(null);
  protected readonly currencyControl = new FormControl<string>('EUR', { nonNullable: true });

  /**
   * Signals dédiés pour l'affichage du trigger mobile — PAS de
   * `toSignal(control.valueChanges)` : `writeValue()` pose la valeur avec
   * `{emitEvent:false}` (pour ne pas re-déclencher `onChange` en boucle sur
   * un simple écho du store), donc `valueChanges` ne s'émet JAMAIS pour un
   * écho distant (ex. reload de page). Un `toSignal` basé dessus restait
   * bloqué à sa valeur initiale (`null`/`'EUR'`) après un `writeValue` —
   * symptôme observé : prix enregistré mais jamais affiché sur le trigger
   * mobile après rechargement (le desktop, lui, bind `[formControl]`
   * directement et n'a pas ce problème). Mis à jour explicitement dans
   * `writeValue` ET dans l'abonnement `valueChanges` ci-dessous, donc
   * toujours synchrones avec les deux `FormControl`, quelle que soit
   * l'origine du changement.
   */
  protected readonly amount = signal<number | null>(null);
  protected readonly currency = signal<string>('EUR');

  protected readonly currencyLabel = computed(
    () => this.currencyOptions().find((o) => o.value === this.currency())?.label ?? this.currency(),
  );
  protected readonly displayAmount = computed(() => this.amount());

  private onChange?: (value: PriceFieldValue) => void;
  private onTouched?: () => void;
  private isProgrammaticUpdate = false;

  constructor() {
    merge(this.amountControl.valueChanges, this.currencyControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.amount.set(this.amountControl.value);
        this.currency.set(this.currencyControl.value);
        if (this.isProgrammaticUpdate) return;
        this.onChange?.({ amount: this.amountControl.value ?? 0, currency: this.currencyControl.value });
        this.onTouched?.();
      });
  }

  writeValue(value: PriceFieldValue): void {
    this.isProgrammaticUpdate = true;
    this.amountControl.setValue(value?.amount ?? null, { emitEvent: false });
    this.currencyControl.setValue(value?.currency ?? 'EUR', { emitEvent: false });
    this.isProgrammaticUpdate = false;
    this.amount.set(value?.amount ?? null);
    this.currency.set(value?.currency ?? 'EUR');
  }

  registerOnChange(fn: (value: PriceFieldValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.amountControl.disable({ emitEvent: false });
      this.currencyControl.disable({ emitEvent: false });
    } else {
      this.amountControl.enable({ emitEvent: false });
      this.currencyControl.enable({ emitEvent: false });
    }
  }

  /** Public : ouverture programmatique (chaînage de saisie guidée mobile, voir ActivityFormComponent.startGuidedEntry). */
  openDialog(): void {
    const dialogRef = this.dialogService.open<void, PriceEditDialogData>(PriceEditDialogComponent, {
      data: {
        initialAmount: this.amountControl.value,
        initialCurrency: this.currencyControl.value,
        currencyOptions: this.currencyOptions(),
        title: this.title(),
        onConfirm: (value) => {
          this.amountControl.setValue(value.amount);
          this.currencyControl.setValue(value.currency);
        },
      },
      panelClass: 'app-price-dialog-panel',
      autoFocus: '.price-edit-dialog__amount',
    });
    dialogRef.closed.subscribe(() => this.onTouched?.());
  }
}
