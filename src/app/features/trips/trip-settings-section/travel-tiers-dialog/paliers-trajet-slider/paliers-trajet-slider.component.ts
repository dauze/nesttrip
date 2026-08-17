import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';

type Handle = 'tier1' | 'tier2';

/**
 * Piste unique à deux poignées pour les paliers marche/vélo/voiture —
 * remplace les deux `app-slider` indépendants (voir
 * `ROADMAP_already done.md`, item "Distance/temps à pied...", passes 3 à 7)
 * dont la synchronisation a posteriori (`effect()` côté dialog) provoquait
 * des sauts/dérives sur le palier 2 à chaque mouvement du palier 1. Ici les
 * 2 seuils partagent le MÊME axe (donc la même origine de coordonnées) et le
 * bornage mutuel (`tier1 ≤ tier2`) est appliqué DIRECTEMENT dans la
 * conversion position→valeur (drag ET clavier) : plus de synchronisation
 * séparée à faire converger, la contrainte ne peut structurellement pas être
 * violée.
 */
@Component({
  selector: 'app-paliers-trajet-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paliers-trajet-slider.component.html',
  styleUrl: './paliers-trajet-slider.component.scss',
})
export class PaliersTrajetSliderComponent {
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);

  readonly tier1Value = model.required<number>();
  readonly tier2Value = model.required<number>();

  private readonly trackRef = viewChild.required<ElementRef<HTMLElement>>('track');

  /** Poignée actuellement captée par le pointeur (drag en cours) — `null` hors drag. */
  protected readonly activeHandle = signal<Handle | null>(null);

  protected readonly tier1Fraction = computed(() => this.fractionOf(this.tier1Value()));
  protected readonly tier2Fraction = computed(() => this.fractionOf(this.tier2Value()));

  /** Arrondi à l'entier km pour l'affichage uniquement — la valeur stockée garde la précision du `step`. */
  protected readonly tier1Display = computed(() => Math.round(this.tier1Value()));
  protected readonly tier2Display = computed(() => Math.round(this.tier2Value()));

  protected readonly segment1WidthPct = computed(() => this.tier1Fraction() * 100);
  protected readonly segment2LeftPct = computed(() => this.tier1Fraction() * 100);
  protected readonly segment2WidthPct = computed(() => (this.tier2Fraction() - this.tier1Fraction()) * 100);
  protected readonly segment3LeftPct = computed(() => this.tier2Fraction() * 100);
  protected readonly segment3WidthPct = computed(() => (1 - this.tier2Fraction()) * 100);

  private fractionOf(value: number): number {
    const range = this.max() - this.min();
    if (range <= 0) return 0;
    return (value - this.min()) / range;
  }

  private valueFromFraction(fraction: number): number {
    const min = this.min();
    const max = this.max();
    const step = this.step() || 1;
    const raw = min + fraction * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.min(Math.max(stepped, min), max);
  }

  private fractionFromClientX(clientX: number, track: HTMLElement): number {
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }

  private nearestHandle(fraction: number): Handle {
    const d1 = Math.abs(fraction - this.tier1Fraction());
    const d2 = Math.abs(fraction - this.tier2Fraction());
    return d1 <= d2 ? 'tier1' : 'tier2';
  }

  /** Bornage mutuel partagé par le drag ET le clavier — seul point qui applique `tier1 ≤ tier2`. */
  private setHandleValue(handle: Handle, rawValue: number): void {
    const clamped = Math.min(Math.max(rawValue, this.min()), this.max());
    if (handle === 'tier1') {
      const bounded = Math.min(clamped, this.tier2Value());
      if (bounded !== this.tier1Value()) this.tier1Value.set(bounded);
    } else {
      const bounded = Math.max(clamped, this.tier1Value());
      if (bounded !== this.tier2Value()) this.tier2Value.set(bounded);
    }
  }

  protected onTrackPointerDown(event: PointerEvent): void {
    const track = this.trackRef().nativeElement;
    const fraction = this.fractionFromClientX(event.clientX, track);
    this.activeHandle.set(this.nearestHandle(fraction));
    this.setHandleValue(this.activeHandle()!, this.valueFromFraction(fraction));
    track.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onHandlePointerDown(handle: Handle, event: PointerEvent): void {
    this.activeHandle.set(handle);
    this.trackRef().nativeElement.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  protected onTrackPointerMove(event: PointerEvent): void {
    const handle = this.activeHandle();
    if (!handle) return;
    const track = this.trackRef().nativeElement;
    const fraction = this.fractionFromClientX(event.clientX, track);
    this.setHandleValue(handle, this.valueFromFraction(fraction));
  }

  protected onTrackPointerUp(event: PointerEvent): void {
    const track = this.trackRef().nativeElement;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    this.activeHandle.set(null);
  }

  protected onHandleKeydown(handle: Handle, event: KeyboardEvent): void {
    const step = this.step() || 1;
    const bigStep = step * 10;
    const current = handle === 'tier1' ? this.tier1Value() : this.tier2Value();

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        this.setHandleValue(handle, current - step);
        return;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        this.setHandleValue(handle, current + step);
        return;
      case 'PageDown':
        event.preventDefault();
        this.setHandleValue(handle, current - bigStep);
        return;
      case 'PageUp':
        event.preventDefault();
        this.setHandleValue(handle, current + bigStep);
        return;
      case 'Home':
        event.preventDefault();
        this.setHandleValue(handle, this.min());
        return;
      case 'End':
        event.preventDefault();
        this.setHandleValue(handle, this.max());
        return;
    }
  }
}
