import { Directive, DestroyRef, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

const DEFAULT_DELAY_MS = 500;
/** Au-delà de ce déplacement (px), on considère que le doigt scrolle/drague : plus un "appui maintenu". */
const MOVE_THRESHOLD_PX = 10;

/**
 * Émet `(longPress)` après un appui maintenu sans déplacement significatif.
 * Volontairement générique (aucune connaissance du mode sélection, voir
 * SelectableDirective qui la consomme) : n'appelle jamais `preventDefault()`
 * sur `pointerdown`/`pointermove`, pour ne jamais gêner le scroll tactile
 * natif (contrairement à `ActivityCardComponent.updateDragState`, qui a une
 * bonne raison de le faire sur sa propre poignée de drag).
 *
 * `pointermove`/`pointerup`/`pointercancel` sont écoutés sur `document`, PAS
 * sur l'élément lui-même : dès qu'un drag démarre sur la poignée d'une carte
 * (`ActivityCardComponent.updateDragState`), `document.documentElement`
 * capture le pointer (`setPointerCapture`) pour le reste du geste — tous les
 * events suivants sont alors retargetés vers `<html>` et ne bubblent plus
 * jusqu'à cet élément. Des listeners posés ICI seraient donc "sourds" au
 * mouvement/relâchement pendant tout le drag, et le timer de long-press irait
 * jusqu'au bout sans jamais être annulé — c'était le bug (voir ROADMAP.md,
 * "le mode drag and drop lance le mode modification à tort") : démarrer un
 * drag déclenchait le mode sélection ~500ms plus tard, alors que l'utilisateur
 * était déjà en train de dragger. `document` reste dans le chemin de
 * propagation même après un retarget vers `<html>` (qui EST `document`'s
 * enfant), donc les events y arrivent toujours.
 */
@Directive({
  selector: '[appLongPress]',
  standalone: true,
})
export class LongPressDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly longPressDelay = input(DEFAULT_DELAY_MS);
  readonly longPress = output<void>();

  private timer?: ReturnType<typeof setTimeout>;
  private startX = 0;
  private startY = 0;
  private activePointerId?: number;

  constructor() {
    afterNextRender(() => {
      const el = this.elementRef.nativeElement;
      el.addEventListener('pointerdown', this.onPointerDown);
      document.addEventListener('pointermove', this.onPointerMove);
      document.addEventListener('pointerup', this.onPointerEnd);
      document.addEventListener('pointercancel', this.onPointerEnd);

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.onPointerDown);
        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerEnd);
        document.removeEventListener('pointercancel', this.onPointerEnd);
        this.clear();
      });
    });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    // Souris : pas de long-press (sur PC, l'entrée en mode sélection passe
    // uniquement par la checkbox, voir SelectableDirective).
    if (event.pointerType === 'mouse') return;

    this.clearTimer();
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.activePointerId = event.pointerId;
    this.timer = setTimeout(() => this.longPress.emit(), this.longPressDelay());
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    const movedX = Math.abs(event.clientX - this.startX);
    const movedY = Math.abs(event.clientY - this.startY);
    if (movedX > MOVE_THRESHOLD_PX || movedY > MOVE_THRESHOLD_PX) this.clear();
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.clear();
  };

  private readonly clear = (): void => {
    this.activePointerId = undefined;
    this.clearTimer();
  };

  private readonly clearTimer = (): void => {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  };
}
