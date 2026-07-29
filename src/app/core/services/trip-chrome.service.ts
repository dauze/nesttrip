import { Injectable, computed, signal } from '@angular/core';
import { clamp } from '@app/shared/utils/scroll-container';

type ChromeKey = 'toolbar' | 'header' | 'tabsNav' | 'generalSubTabBar' | 'generalSubTabSwitch';
/**
 * `'mobile'` : barre des jours fixe en bas, jamais masquée (comportement
 * historique). `'split-hideable'` : layout scindé (voir ViewportService)
 * mais viewport trop bas pour garder le chrome en permanence (mobile
 * paysage) — la barre des jours passe en haut ET rejoint le groupe qui se
 * masque au scroll avec toolbar+header. `'split-pinned'` : layout scindé
 * avec assez de hauteur (desktop) — toolbar+header+jours ne se masquent
 * jamais. Piloté par TripDetailComponent à partir de ViewportService.
 */
export type ChromeMode = 'mobile' | 'split-hideable' | 'split-pinned';

/**
 * gap-2 (0.5rem, voir `layout-utilities.scss`) entre header voyage/barre des
 * jours et entre barre des jours/contenu, quand celle-ci est passée en haut
 * (layout scindé — voir ROADMAP.md "UI Desktop"). En pixels (racine 16px, comme
 * les seuils `ViewportService`) : ce service raisonne uniquement en pixels
 * réels mesurés (`ResizeObserver`, voir `registerHeight`), jamais en rem/CSS
 * var — un `calc()` mêlant les deux dans les bindings `[style.top.px]` du
 * template aurait été plus fragile qu'une seule constante bien nommée ici.
 */
const SPLIT_CHROME_GAP_PX = 8;

/** Même rôle que `SPLIT_CHROME_GAP_PX`, mais gap-1 (0.25rem) entre header voyage et contenu en mode `'mobile'` (barre des jours fixe en bas, hors de ce calcul). */
const STACKED_CHROME_GAP_PX = 4;

/**
 * Pilote le chrome persistant (toolbar app + header voyage) partagé entre
 * TripsComponent (toolbar, ancêtre commun à accueil-trip/new-trip/trip-detail)
 * et TripDetailComponent (header voyage). Reproduit le flux natif d'aujourd'hui
 * (toolbar+header défilent avec le contenu à la même vitesse) via
 * `translateY = -clamp(scrollTop, 0, hideableHeight)`, appliqué en position fixed.
 * `hideableHeight` dépend du `ChromeMode` courant (voir plus bas) : en layout
 * scindé desktop (`'split-pinned'`), elle vaut 0 — rien ne se masque.
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
@Injectable()
export class TripChromeService {
  private readonly heights = signal<Record<ChromeKey, number>>({
    toolbar: 0, header: 0, tabsNav: 0, generalSubTabBar: 0, generalSubTabSwitch: 0,
  });
  private readonly chromeEls = new Set<HTMLElement>();
  private currentTranslateY = 0;
  private readonly _mode = signal<ChromeMode>('mobile');

  /** Hauteur de la seule toolbar : réservée en `padding-top` par TripsComponent (flux normal, tous écrans). */
  readonly toolbarHeight = computed(() => this.heights().toolbar);
  /** Hauteur du seul header voyage : réservée nativement (voir le "sticky spacer" dans day-panel/general-panel). */
  readonly headerHeight = computed(() => this.heights().header);
  /** Hauteur BRUTE de la barre des jours (mesure réelle, quelle que soit sa position) — voir `tabsNavBottomReserve` pour l'espace à réserver en bas. */
  readonly tabsNavHeight = computed(() => this.heights().tabsNav);
  /** Hauteur de la barre Activités/Réservations/Notes flottante mobile (voir `GeneralSubTabBarComponent`), 0 quand elle n'est pas montée (desktop, ou onglet jour) : réservée en `padding-bottom` par `GeneralPanelComponent` uniquement. */
  readonly generalSubTabBarHeight = computed(() => this.heights().generalSubTabBar);
  /**
   * Hauteur de la bascule Activités/Réservations/Notes INLINE desktop de
   * `GeneralPanelComponent` (`.sub-tab-switch`, distincte de la barre
   * flottante mobile ci-dessus) — sert à décaler `.sticky-map` du pool
   * d'activités sous elle en layout scindé, où les deux sont sticky dans le
   * même scrollport (contrairement à `.sticky-map` de la vue jour, qui n'a
   * rien au-dessus d'elle).
   */
  readonly generalSubTabSwitchHeight = computed(() => this.heights().generalSubTabSwitch);
  /** Mode courant (voir `ChromeMode`), piloté par `setMode`. */
  readonly mode = this._mode.asReadonly();

  /**
   * `top` fixe du header voyage : juste sous la toolbar, avec un gap de
   * respiration (gap-1 empilé / gap-2 scindé, comme le reste — voir
   * `STACKED_CHROME_GAP_PX`/`SPLIT_CHROME_GAP_PX`) plutôt que collé pile dessous.
   */
  readonly headerTop = computed(() =>
    this.toolbarHeight() + (this.mode() === 'mobile' ? STACKED_CHROME_GAP_PX : SPLIT_CHROME_GAP_PX),
  );

  /** Hauteur cumulée toolbar+gap+header (jamais la barre des jours). */
  readonly headerStackHeight = computed(() => this.headerTop() + this.headerHeight());

  /**
   * Gap courant (px) entre deux éléments de chrome fixed consécutifs
   * (toolbar->header toujours ; header->barre des jours seulement hors
   * `'mobile'`, où c'est plutôt header->contenu qui vaut ce gap) — même
   * constante réutilisée dans les deux calculs ci-dessus
   * (`headerTop`/`tabsNavTop`/`contentTopOffset`). Exposé pour que
   * `.app-toolbar`/`.app-trip-header-fixed` puissent peindre un `box-shadow`
   * de cette hauteur dans ce gap (voir leurs styles) : ce sont des éléments
   * `position:fixed` DISJOINTS avec un intervalle non couvert entre eux, à
   * travers lequel le contenu défilé en dessous (position:fixed lui aussi,
   * plein écran) reste visible par transparence le temps de ces quelques px.
   */
  readonly chromeGapPx = computed(() => (this.mode() === 'mobile' ? STACKED_CHROME_GAP_PX : SPLIT_CHROME_GAP_PX));

  /**
   * `top` fixe de la barre des jours quand elle passe en haut (layout
   * scindé, voir TripDetailComponent) : juste sous toolbar+header, avec un
   * gap-2 de respiration (voir `SPLIT_CHROME_GAP_PX`) plutôt que collée pile
   * dessous.
   */
  readonly tabsNavTop = computed(() => this.headerStackHeight() + SPLIT_CHROME_GAP_PX);

  /**
   * Espace total à réserver en HAUT du contenu (`--chrome-top-offset`,
   * padding-top de day-panel/general-panel) : toolbar+header (+ gap-1 de
   * respiration en `'mobile'`, où la barre des jours reste en bas), plus la
   * barre des jours (+ ses 2 gap-2, un au-dessus un en dessous) dès qu'elle
   * n'est plus en bas (tout mode différent de `'mobile'`).
   */
  readonly contentTopOffset = computed(() =>
    this.mode() === 'mobile'
      ? this.headerStackHeight() + STACKED_CHROME_GAP_PX
      : this.tabsNavTop() + this.tabsNavHeight() + SPLIT_CHROME_GAP_PX,
  );

  /**
   * Espace à réserver en BAS (bouton flottant "+", barre de sélection, sous-
   * barre Général mobile) : la hauteur réelle de la barre des jours en mode
   * `'mobile'` (elle y est fixe en bas), `0` sinon (elle est passée en haut,
   * plus rien à éviter en bas).
   */
  readonly tabsNavBottomReserve = computed(() => (this.mode() === 'mobile' ? this.tabsNavHeight() : 0));

  /**
   * Borne du `translateY` (voir `setScrollTop`) : la portion du chrome
   * effectivement autorisée à glisser hors champ au scroll. `0` en
   * `'split-pinned'` (rien ne se masque, desktop) ; toolbar+header+jours en
   * `'split-hideable'` (mobile paysage, la barre des jours rejoint le groupe
   * qui glisse) ; toolbar+header seulement en `'mobile'` (comportement
   * historique, la barre des jours fixe en bas ne suit jamais ce mécanisme).
   */
  readonly hideableHeight = computed(() => {
    switch (this.mode()) {
      case 'split-pinned': return 0;
      case 'split-hideable': return this.tabsNavTop() + this.tabsNavHeight();
      default: return this.headerStackHeight();
    }
  });

  /**
   * `top` à utiliser par tout élément `position: sticky` DANS le contenu
   * scrollé (`.sticky-map`, la bascule Activités/Réservations/Notes du
   * panneau Général...) — jamais un simple `0`. Le scrollport (`swiper-slide`)
   * s'étend visuellement SOUS le chrome fixe (voir la doc de classe) : un
   * `top:0` colle l'élément à `y=0` de la fenêtre, càd DERRIÈRE le chrome. En
   * `'mobile'`/`'split-hideable'`, ça reste invisible car le chrome a fini de
   * se masquer (translateY) au moment où l'élément atteint cette position — la
   * même distance de scroll fait disparaître le chrome ET faire "arriver"
   * l'élément sticky, donc `0` convient. En `'split-pinned'` (desktop), le
   * chrome ne se masque JAMAIS : un `top:0` collerait l'élément derrière lui en
   * permanence une fois le scroll engagé — il faut donc explicitement viser
   * `contentTopOffset()` (juste sous le chrome) au lieu de `0`.
   */
  readonly stickyContentTop = computed(() => (this.mode() === 'split-pinned' ? this.contentTopOffset() : 0));

  registerHeight(key: ChromeKey, px: number): void {
    this.heights.update(current => ({ ...current, [key]: px }));
  }

  /** Piloté par TripDetailComponent à partir de ViewportService (isSplitLayout/isChromePinned). */
  setMode(mode: ChromeMode): void {
    if (this._mode() === mode) return;
    this._mode.set(mode);
    // Un changement de mode peut réduire hideableHeight() (ex. passage en
    // split-pinned) : reclamp immédiat, sinon le chrome resterait masqué par
    // un translateY devenu hors-borne jusqu'au prochain scroll.
    this.currentTranslateY = -clamp(-this.currentTranslateY, 0, this.hideableHeight());
    this.applyTransform();
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
    this.currentTranslateY = -clamp(px, 0, this.hideableHeight());
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
    this.currentTranslateY = -clamp(px, 0, this.hideableHeight());
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
