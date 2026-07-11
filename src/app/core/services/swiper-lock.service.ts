import { Injectable, signal } from '@angular/core';

@Injectable()
export class SwiperLockService {
  private locked = signal(false);
  readonly isLocked = this.locked.asReadonly();

  lock() {
    this.locked.set(true);
  }

  unlock() {
    this.locked.set(false);
  }
}