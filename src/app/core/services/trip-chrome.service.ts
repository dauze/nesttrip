import { Injectable, computed, signal } from '@angular/core';
import { clamp } from '@app/shared/utils/scroll-container';

type ChromeKey = 'toolbar' | 'header' | 'tabsNav';

/**
 * Pilote le chrome persistant (toolbar app + header voyage) partagé entre
 * TripsComponent (toolbar, ancêtre commun à accueil-trip/new-trip/trip-detail)
 * et TripDetailComponent (header voyage). Reproduit le flux natif d'aujourd'hui
 * (toolbar+header défilent avec le contenu à la même vitesse) via
 * `translateY = -clamp(scrollTop, 0, chromeHeight)`, appliqué en position fixed.
 *
 * Seul TripDaySwiperComponent appelle `setScrollTop` (scroll du slide actif
 * dans trip-detail) : sur accueil-trip/new-trip, `translateY` reste à 0, donc
 * la toolbar y est fixed mais toujours visible, comme voulu.
 */
@Injectable({ providedIn: 'root' })
export class TripChromeService {
  private readonly heights = signal<Record<ChromeKey, number>>({ toolbar: 0, header: 0, tabsNav: 0 });
  private readonly _translateY = signal(0);

  /** Hauteur de la seule toolbar : réservée en `padding-top` par TripsComponent (flux normal, tous écrans). */
  readonly toolbarHeight = computed(() => this.heights().toolbar);
  /** Hauteur du seul header voyage : réservée en `padding-top` par le contenu du swiper (trip-detail uniquement). */
  readonly headerHeight = computed(() => this.heights().header);
  /** Hauteur de la barre des jours (fixed bottom, jamais masquée) : réservée en `padding-bottom` par le contenu du swiper. */
  readonly tabsNavHeight = computed(() => this.heights().tabsNav);
  /** Hauteur cumulée toolbar+header : borne le `translateY` (au-delà, tout le chrome est masqué). N'inclut PAS la barre du bas, qui ne suit pas ce mécanisme. */
  readonly chromeHeight = computed(() => this.toolbarHeight() + this.headerHeight());
  readonly translateY = this._translateY.asReadonly();

  registerHeight(key: ChromeKey, px: number): void {
    this.heights.update(current => ({ ...current, [key]: px }));
  }

  setScrollTop(px: number): void {
    this._translateY.set(-clamp(px, 0, this.chromeHeight()));
  }

  /** Remet le chrome pleinement visible — appelé en quittant trip-detail. */
  reset(): void {
    this._translateY.set(0);
  }
}
