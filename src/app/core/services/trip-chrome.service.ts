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

  /** Suivi continu du scroll (boucle rAF) : instantané, sans transition — toute latence ici serait visible face au scroll natif du contenu. */
  setScrollTop(px: number): void {
    this.currentTranslateY = -clamp(px, 0, this.chromeHeight());
    this.applyTransform();
  }

  /**
   * Resynchronisation ponctuelle au changement de jour (swipe ou clic
   * d'onglet) : chaque jour a son propre scroll mémorisé, donc le chrome doit
   * sauter d'un état (ex. masqué) à un autre (ex. visible) d'un slide à
   * l'autre. Un saut INSTANTANÉ ici est perçu comme un raté visuel — voir
   * CLAUDE.md — donc on anime ce cas précis (durée alignée sur le swipe
   * horizontal de Swiper, `speed: 360` dans TripDaySwiperComponent), tout en
   * gardant `setScrollTop` (scroll continu) strictement sans transition.
   */
  setScrollTopAnimated(px: number, duration = 320): void {
    for (const el of this.chromeEls) {
      el.style.transition = `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    }
    this.currentTranslateY = -clamp(px, 0, this.chromeHeight());
    this.applyTransform();

    for (const el of this.chromeEls) {
      // Nettoyage après coup : les mises à jour issues de setScrollTop (scroll
      // continu, boucle rAF) doivent rester instantanées, jamais traverser
      // cette transition résiduelle.
      const cleanup = () => { el.style.transition = ''; };
      el.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(cleanup, duration + 50);
    }
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
