import { Injectable, computed, signal } from '@angular/core';

/**
 * Compteur de verrous (pas un simple booléen) : plusieurs sources
 * indépendantes peuvent vouloir verrouiller le swiper en même temps (ex.
 * DayPanelComponent pour un réordonnancement intra-jour, ActivityCardComponent
 * pour un décrochage pool — voir isBeingDragged) sans se marcher dessus.
 * Avec un booléen, la source A qui `unlock()` alors que la source B tient
 * encore son verrou aurait déverrouillé le swiper en plein geste de B.
 */
@Injectable()
export class SwiperLockService {
  private readonly lockCount = signal(0);
  readonly isLocked = computed(() => this.lockCount() > 0);

  lock() {
    this.lockCount.update(n => n + 1);
  }

  unlock() {
    this.lockCount.update(n => Math.max(0, n - 1));
  }
}