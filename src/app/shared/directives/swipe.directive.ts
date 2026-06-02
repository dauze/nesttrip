import {Directive, EventEmitter, HostListener, Output} from '@angular/core';

@Directive({
  selector: '[cdkSwipe]'
})
export class SwipeDirective {

  @Output() swipeLeft = new EventEmitter<void>();
  @Output() swipeRight = new EventEmitter<void>();

  private startX = 0;
  private startY = 0;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    this.startX = event.clientX;
    this.startY = event.clientY;
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    const threshold = 50;

    // ignore les scroll verticaux
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > threshold) {
        this.swipeRight.emit();
      } else if (deltaX < -threshold) {
        this.swipeLeft.emit();
      }
    }
  }
}
