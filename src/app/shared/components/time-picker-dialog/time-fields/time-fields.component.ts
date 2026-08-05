import { ChangeDetectionStrategy, Component, input, linkedSignal, output, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Paire de champs texte HH/MM réutilisée à la fois par `TimePickerDialogComponent`
 * (affichage desktop, sans dialog) et par `TimePickerClockComponent` (mode
 * clavier mobile). Édition "bufferisée" localement (`hourText`/`minuteText`) :
 * la valeur reçue via `hour()`/`minute()` n'est réappliquée que lorsque le
 * champ correspondant n'a pas le focus, sinon la re-synchronisation depuis le
 * parent (qui repadde immédiatement à 2 chiffres, ex. "1" -> "01") écraserait
 * la frappe en cours au milieu de la saisie du 2e chiffre.
 */
@Component({
  selector: 'app-time-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './time-fields.component.html',
  styleUrl: './time-fields.component.scss',
})
export class TimeFieldsComponent {
  readonly hour = input<string>('00');
  readonly minute = input<string>('00');
  /** 'flat' : rendu texte nu sans bordure, pour s'intégrer au reste d'un formulaire (desktop). 'boxed' (défaut) : cases délimitées, utilisé dans le dialog mobile (cadran/clavier). */
  readonly variant = input<'flat' | 'boxed'>('boxed');

  readonly hourChange = output<string>();
  readonly minuteChange = output<string>();

  private readonly hourInput = viewChild<ElementRef<HTMLInputElement>>('hourInput');
  private readonly minuteInput = viewChild<ElementRef<HTMLInputElement>>('minuteInput');

  /** Ne se resynchronise depuis `hour()` que si le champ n'a pas le focus, pour ne jamais écraser une frappe en cours. */
  readonly hourText = linkedSignal<string, string>({
    source: () => this.hour(),
    computation: (value, previous) => (this.hourFocused && previous ? previous.value : value),
  });
  readonly minuteText = linkedSignal<string, string>({
    source: () => this.minute(),
    computation: (value, previous) => (this.minuteFocused && previous ? previous.value : value),
  });

  private hourFocused = false;
  private minuteFocused = false;

  /** Focalise et sélectionne le champ des heures — utilisé à l'ouverture du mode clavier. */
  focusHour(): void {
    const input = this.hourInput()?.nativeElement;
    input?.focus();
    input?.select();
  }

  onHourFocus(): void {
    this.hourFocused = true;
    this.hourInput()?.nativeElement.select();
  }

  onHourInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    this.hourText.set(digits);
    this.hourChange.emit(digits);

    if (digits.length === 2) {
      const minuteInput = this.minuteInput()?.nativeElement;
      minuteInput?.focus();
      minuteInput?.select();
    }
  }

  onHourBlur(): void {
    this.hourFocused = false;
    const padded = this.finalize(this.hourText(), 23);
    this.hourText.set(padded);
    this.hourChange.emit(padded);
  }

  onMinuteFocus(): void {
    this.minuteFocused = true;
    this.minuteInput()?.nativeElement.select();
  }

  onMinuteInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    this.minuteText.set(digits);
    this.minuteChange.emit(digits);
  }

  onMinuteBlur(): void {
    this.minuteFocused = false;
    const padded = this.finalize(this.minuteText(), 59);
    this.minuteText.set(padded);
    this.minuteChange.emit(padded);
  }

  private finalize(raw: string, max: number): string {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '00';
    const clamped = Math.min(Number(digits), max);
    return String(clamped).padStart(2, '0');
  }
}
