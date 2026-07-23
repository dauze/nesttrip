import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Remplacement maison de `p-password` (Phase 4 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Seul usage dans ce projet (login) : `[feedback]`
 * (indicateur de force) toujours désactivé, seul `toggleMask` (afficher/
 * masquer) est réellement utilisé — pas besoin de reproduire l'indicateur
 * de force du mot de passe.
 */
@Component({
  selector: 'app-password',
  standalone: true,
  templateUrl: './password.component.html',
  styleUrl: './password.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordComponent),
      multi: true,
    },
  ],
})
export class PasswordComponent implements ControlValueAccessor {
  readonly inputId = input<string>('');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('current-password');

  protected value = '';
  protected disabled = false;
  protected readonly masked = signal(true);

  private onChange?: (value: string) => void;
  protected onTouched?: () => void;

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onInput(raw: string): void {
    this.value = raw;
    this.onChange?.(this.value);
  }

  protected toggleMask(): void {
    this.masked.update((v) => !v);
  }
}
