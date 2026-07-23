import { Component, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Remplacement maison de `p-inputNumber` (Phase 4 de la sortie de PrimeNG,
 * voir PRIMENG_MIGRATION.md). Un seul usage dans ce projet (prix d'une
 * activité), sans formatage locale/devise particulier côté PrimeNG à
 * reproduire : un `<input type="number">` natif derrière un
 * ControlValueAccessor minimal suffit.
 */
@Component({
  selector: 'app-input-number',
  standalone: true,
  templateUrl: './input-number.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputNumberComponent),
      multi: true,
    },
  ],
})
export class InputNumberComponent implements ControlValueAccessor {
  readonly inputId = input<string>('');
  readonly inputClass = input<string>('');

  protected value: number | null = null;
  protected disabled = false;

  private onChange?: (value: number | null) => void;
  protected onTouched?: () => void;

  writeValue(value: number | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onInput(raw: string): void {
    this.value = raw === '' ? null : Number(raw);
    this.onChange?.(this.value);
  }
}
