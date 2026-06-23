import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[cdkSwipe]',
  standalone: true,
  host: {
    '[style.touch-action]': "'pan-y'"
  }
})
export class SwipeDirective {

  @Output() swipeLeft = new EventEmitter<void>();
  @Output() swipeRight = new EventEmitter<void>();

  private startX = 0;
  private startY = 0;
  private pointerDown = false;

  private readonly threshold = 50;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    this.pointerDown = true;

    this.startX = event.clientX;
    this.startY = event.clientY;

    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    if (!this.pointerDown) return;

    this.pointerDown = false;

    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    // Ignore les scrolls verticaux
    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX > this.threshold) {
      this.swipeRight.emit();
    }

    if (deltaX < -this.threshold) {
      this.swipeLeft.emit();
    }
  }

  @HostListener('pointercancel')
  onPointerCancel() {
    this.pointerDown = false;
  }
}