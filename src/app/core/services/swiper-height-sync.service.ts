import { Injectable } from '@angular/core';
import type { SwiperContainer } from 'swiper/element';

@Injectable()
export class SwiperHeightSyncService {
  private swiperEl?: SwiperContainer;

  register(swiperEl: SwiperContainer): void {
    this.swiperEl = swiperEl;
  }

  /** Recalcule et anime la hauteur du swiper vers celle du contenu actuel du slide actif. */
  update(duration = 300): void {
    this.swiperEl?.swiper?.updateAutoHeight(duration);
  }
}