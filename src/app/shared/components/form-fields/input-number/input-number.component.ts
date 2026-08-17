import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-number.component.html',
  styleUrl: './input-number.component.scss',
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

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly value = signal<number | null>(null);
  protected readonly disabled = signal(false);

  private onChange?: (value: number | null) => void;
  protected onTouched?: () => void;

  writeValue(value: number | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(raw: string): void {
    const parsed = raw === '' ? null : Number(raw);
    this.value.set(parsed);
    this.onChange?.(parsed);
  }

  /** Focus programmatique (ex. dernière étape du chaînage de saisie guidée). */
  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }
}
