import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, forwardRef, input, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

/**
 * Slider maison sur `<input type="range">` natif — aucun composant slider
 * n'existait dans le repo (vérifié). Même anatomie `ControlValueAccessor`
 * que `InputNumberComponent` (`shared/components/input-number/`), pour un
 * usage `formControlName`/`[formControl]` identique.
 */
@Component({
  selector: 'app-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SliderComponent),
      multi: true,
    },
  ],
})
export class SliderComponent implements ControlValueAccessor {
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  /** Suffixe affiché à côté de la valeur courante (ex. "km"). */
  readonly unit = input<string>('');

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly value = signal(0);
  protected readonly disabled = signal(false);

  /** Position du remplissage coloré (0-100%) — voir `.app-slider__track` (slider.component.scss). */
  protected readonly fillPercent = computed(() => {
    const range = this.max() - this.min();
    if (range <= 0) return 0;
    return ((this.value() - this.min()) / range) * 100;
  });

  private onChange?: (value: number) => void;
  protected onTouched?: () => void;

  constructor() {
    // Bug repéré en usage réel + confirmé en Playwright (drag souris) : un
    // `<input type="range">` NATIF, quand `min` change (ex. le slider du
    // palier 2 dont le `min` suit en direct la valeur du palier 1, voir
    // `travel-tiers-dialog.component.ts`), recalcule TOUT SEUL sa valeur DOM
    // affichée pour PRÉSERVER LE MÊME NOMBRE DE PAS depuis `min` — PAS la
    // même valeur absolue, PAS un simple clamp aux bornes (ex. valeur=8,
    // min 0→1.5 avec step=1 : le thumb saute à 9.5, ni 8 ni 1.5). Un premier
    // correctif qui RESYNCHRONISAIT depuis cette valeur DOM (`native.value`)
    // était une erreur : ça adoptait fidèlement cette renormalisation
    // erratique du navigateur comme "vérité", provoquant une dérive qui
    // grossissait à chaque aller-retour du palier 1 (confirmé par retour
    // utilisateur : plusieurs va-et-vient envoyaient le palier 2 jusqu'à
    // 100km). Le bon calcul ignore ENTIÈREMENT ce que le DOM raconte : la
    // valeur clampée se calcule en JS pur à partir du SIGNAL `value` déjà
    // connu, puis est RÉIMPOSÉE explicitement sur le DOM (même si elle n'a
    // pas changé numériquement) pour écraser la position que le navigateur
    // avait pu, lui, déjà déplacer tout seul sans émettre d'évènement.
    afterRenderEffect(() => {
      const min = this.min();
      const max = this.max();
      const current = untracked(() => this.value());
      const clamped = Math.min(Math.max(current, min), max);
      if (clamped !== current) {
        this.value.set(clamped);
        this.onChange?.(clamped);
      }
      const native = this.inputRef()?.nativeElement;
      if (native) native.value = String(clamped);
    });
  }

  writeValue(value: number): void {
    this.value.set(value ?? 0);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(raw: string): void {
    const parsed = Number(raw);
    this.value.set(parsed);
    this.onChange?.(parsed);
  }

  /** Focus programmatique — même API que `InputNumberComponent.focus`. */
  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }
}
