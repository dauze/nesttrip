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
 * Écriture DOM DIRECTE (`registerChromeElement` + `el.style.transform = ...`),
 * PAS un signal lu depuis un template : passer par un binding Angular ajoute
 * un aller-retour (écriture → détection de changement → diff de vue → écriture
 * DOM) entre la lecture du scroll natif (déjà rendu par le compositeur) et
 * l'application du transform — un retard perceptible comparé au scroll natif
 * du contenu. L'écriture directe élimine ce détour : à chaque frame où le
 * scroll change, le style est pushé au DOM dans le même passage que la
 * lecture, sans dépendre du cycle de détection de changement d'Angular.
 *
 * Seul TripDaySwiperComponent appelle `setScrollTop` (scroll du slide actif
 * dans trip-detail) : sur accueil-trip/new-trip, rien ne l'appelle, donc la
 * toolbar y reste toujours visible (translateY jamais modifié), comme voulu.
 */
@Injectable({ providedIn: 'root' })
export class TripChromeService {
  private readonly heights = signal<Record<ChromeKey, number>>({ toolbar: 0, header: 0, tabsNav: 0 });
  private readonly chromeEls = new Set<HTMLElement>();
  private currentTranslateY = 0;

  /** Hauteur de la seule toolbar : réservée en `padding-top` par TripsComponent (flux normal, tous écrans). */
  readonly toolbarHeight = computed(() => this.heights().toolbar);
  /** Hauteur du seul header voyage : réservée nativement (voir le "sticky spacer" dans day-panel/general-panel). */
  readonly headerHeight = computed(() => this.heights().header);
  /** Hauteur de la barre des jours (fixed bottom, jamais masquée) : réservée en `padding-bottom` par le contenu du swiper. */
  readonly tabsNavHeight = computed(() => this.heights().tabsNav);
  /** Hauteur cumulée toolbar+header : borne le `translateY` (au-delà, tout le chrome est masqué). N'inclut PAS la barre du bas, qui ne suit pas ce mécanisme. */
  readonly chromeHeight = computed(() => this.toolbarHeight() + this.headerHeight());

  registerHeight(key: ChromeKey, px: number): void {
    this.heights.update(current => ({ ...current, [key]: px }));
  }

  /**
   * Enregistre un élément (toolbar ou header) dont le `transform` doit suivre
   * le scroll en direct. Retourne une fonction de désinscription (à appeler
   * au destroy du composant appelant).
   */
  registerChromeElement(el: HTMLElement): () => void {
    this.chromeEls.add(el);
    el.style.transform = `translateY(${this.currentTranslateY}px)`;
    return () => this.chromeEls.delete(el);
  }

  setScrollTop(px: number): void {
    this.currentTranslateY = -clamp(px, 0, this.chromeHeight());
    this.applyTransform();
  }

  /** Remet le chrome pleinement visible — appelé en quittant trip-detail. */
  reset(): void {
    this.currentTranslateY = 0;
    this.applyTransform();
  }

  private applyTransform(): void {
    const transform = `translateY(${this.currentTranslateY}px)`;
    for (const el of this.chromeEls) el.style.transform = transform;
  }
}
