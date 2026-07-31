import { Injectable, OnDestroy, signal } from '@angular/core';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { TripDayMapComponent } from './trip-day-map/trip-day-map.component';

interface CardOffset { card: ActivityCardComponent; top: number; height: number }

export interface DayScrollSyncConfig {
  isActive: () => boolean;
  getSlideEl: () => HTMLElement | null;
  getFreshOffsets: () => CardOffset[];
  getDayMapPoints: () => DayMapPoint[];
  getMapComponent: () => TripDayMapComponent | null;
  getStickyMapEl: () => HTMLElement | null;
  /**
   * Layout scindé (carte à gauche, activités à droite — voir ViewportService)
   * : la carte n'est plus empilée AU-DESSUS de la liste, donc elle ne
   * "bloque" plus rien en haut du scroll — voir son usage dans
   * `updateMapFromScroll`/`focusActivity`/`trySnapActivity`.
   */
  isSplitLayout: () => boolean;
  /**
   * Optionnel, `true` par défaut si absent (vue jour, comportement historique
   * inchangé) : quand `false`, `tick()` détecte toujours le scroll (idle
   * threshold/garde-fou anti-emballement inchangés) mais n'appelle plus
   * `updateMapFromScroll` — utilisé par le pool d'activités de l'onglet
   * Général (`TripActivitiesComponent`), dont la caméra est désormais pilotée
   * par un service dédié (`GeneralMapCinematicService`, voir ROADMAP.md "UX /
   * Interactions") totalement décorrélé du scroll, plutôt que par ce suivi en
   * direct.
   */
  cameraFollowEnabled?: () => boolean;
  /**
   * `TripChromeService.stickyContentTop()` — 0 partout SAUF en `'split-pinned'`
   * (desktop) où toolbar+header+barre des jours ne se masquent JAMAIS au
   * scroll (contrairement à `'mobile'`/`'split-hideable'`, où le scroll
   * programmatique ci-dessous déclenche aussi `TripChromeService.setScrollTop`,
   * qui les fait glisser hors champ). En layout scindé, ce chrome fixe joue
   * exactement le même rôle de "bouclier" que la carte empilée en mode
   * empilé (voir `isSplitLayout` ci-dessus) : sans le compter, une cible
   * calculée pour arriver en haut du scrollport (y=0) arrive en fait
   * DERRIÈRE ce chrome toujours visible, jamais réellement dans le champ.
   */
  getPinnedChromeOffset: () => number;
}

/**
 * Moteur "scroll d'un jour ↔ carte" extrait de DayPanelComponent : fait
 * vivre ensemble le suivi caméra (la carte Google "suit" la position de
 * scroll dans la liste d'activités, voir `updateMapFromScroll`), le
 * rattachement de l'instance UNIQUE de carte à ce jour quand il devient actif
 * (voir `attachMap`, ex-`wireActiveMap`), et le magnétisme de fin de scroll
 * (voir `trySnapActivity`). Ces trois comportements partagent la même boucle
 * de mesure (`wakeLoop`/`tick`) et les mêmes offsets de cartes : les séparer
 * en services distincts aurait dupliqué cette mesure pour un gain de lisibilité
 * illusoire — voir CLAUDE.md sur le découpage de DayPanelComponent/
 * ActivityDayDispatchOverlayComponent.
 *
 * Fourni par `DayPanelComponent` (pas root) : une instance par jour affiché,
 * détruite avec lui — voir `providers` sur le composant.
 */
@Injectable()
export class DayScrollSyncService implements OnDestroy {
  private config!: DayScrollSyncConfig;

  readonly stickyHeight = signal(0);

  private rafLoop?: number;
  private lastScrollY = -1;
  private idleFrames = 0;
  private readonly IDLE_THRESHOLD = 30;
  /**
   * Garde-fou anti-emballement : nombre de frames consécutives depuis le
   * dernier `wakeLoop()` sans jamais atteindre `IDLE_THRESHOLD` (30 frames de
   * scroll inchangé, ~0.5s) — signale une boucle de rétroaction (le scroll ou
   * la géométrie mesurée changent à CHAQUE frame sans jamais se stabiliser),
   * jamais un usage normal (même un long scroll continu finit par ralentir).
   * Remonté suite à un signalement utilisateur de gel total (CPU à fond,
   * onglet/PC bloqué) en cliquant sur un jour en mode mobile — cause exacte
   * pas encore identifiée : ce garde-fou arrête la boucle et journalise un
   * diagnostic au lieu de tourner indéfiniment, le temps de la retrouver.
   */
  private frameBudget = 0;
  private static readonly MAX_FRAMES_WITHOUT_IDLE = 600;
  private readonly ACTIVITY_SCROLL_GAP = 8;
  private readonly SNAP_DELAY = 500;
  private readonly SNAP_DISTANCE = 60;

  private scrollTimeout?: number;
  private isTouching = false;
  private isAutoScrolling = false;

  private mapSubscription?: { unsubscribe: () => void };
  private mapObserver?: ResizeObserver;
  private globalObserver?: ResizeObserver;
  private slideEl: HTMLElement | null = null;

  /** Branche le service sur cette instance de DayPanelComponent — à appeler une seule fois, avant `startListening`/`attachMap`. */
  connect(config: DayScrollSyncConfig): void {
    this.config = config;
  }

  /**
   * Démarre les écouteurs globaux (resize/scroll/touch/wheel) qui alimentent
   * la boucle `wakeLoop`/`tick` — ex-bloc `afterNextRender` du constructeur
   * de DayPanelComponent. À appeler une seule fois, une fois le DOM du jour
   * rendu (`afterNextRender` côté composant).
   */
  startListening(): void {
    const el = this.config.getStickyMapEl();
    const mainContainer = el?.parentElement;

    if (mainContainer) {
      // Le conteneur change de taille -> on recalcule la cinématique à la volée via wakeLoop
      this.globalObserver = new ResizeObserver(() => this.wakeLoop());
      this.globalObserver.observe(mainContainer);
    }

    // Le scroll pertinent est celui du slide isolé (swiper-slide ancêtre),
    // plus celui du document — chaque jour a son propre scroll, voir
    // CLAUDE.md / TripChromeService.
    this.slideEl = this.config.getSlideEl();

    this.wakeLoop();
    window.addEventListener('resize', this.wakeLoop, { passive: true });
    this.slideEl?.addEventListener('scroll', this.onSlideScroll, { passive: true });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchstart', this.wakeLoop, { passive: true });
    window.addEventListener('touchmove', this.wakeLoop, { passive: true });
    window.addEventListener('wheel', this.wakeLoop, { passive: true });
  }

  /** Branche les listeners propres à l'instance partagée de la carte, une fois qu'elle vient d'être déplacée dans ce jour — ex-`wireActiveMap`. */
  attachMap(map: TripDayMapComponent): void {
    // Nouveau jour = nouveau budget pour le garde-fou anti-emballement (voir tick()).
    this.frameBudget = 0;

    // Force le PROCHAIN tick() à recalculer la caméra même si le scrollY de
    // CE jour est déjà à la même valeur qu'avant (typiquement 0) : `tick()`
    // n'appelle `updateMapFromScroll` que quand `scrollY !== lastScrollY`,
    // hérité du dernier passage de la boucle rAF sur CETTE instance — jour
    // préchargé (`TripDaySwiperComponent.preloadAround`) et déjà retombé idle
    // à `lastScrollY = 0` PENDANT qu'il était encore inactif (`tick()` lit le
    // scroll indépendamment de `isActive()`, seul `updateMapFromScroll` le
    // vérifie) — en passant d'un jour à l'autre, ce jour redevient actif avec
    // un scrollY toujours à 0, donc `tick()` ne voit AUCUN changement et ne
    // rappelle jamais `updateMapFromScroll` : la carte partagée garde alors la
    // caméra laissée par le contexte précédent au lieu de se recentrer sur ses
    // propres points — retour utilisateur ("positionnée en mode random" en
    // arrivant sur un jour). `-1` (valeur impossible pour un vrai scrollTop)
    // garantit que la comparaison échoue au prochain tick, quel que soit le
    // scrollY réel.
    this.lastScrollY = -1;
    this.wakeLoop();

    // Reconnexion de l'événement de clic sur un marqueur
    this.mapSubscription?.unsubscribe();
    this.mapSubscription = map.activitySelected.subscribe((point) => {
      this.focusActivity(point.activityId);
    });

    // On observe la vraie hauteur HTML du composant (ré)injecté
    this.mapObserver?.disconnect();
    this.mapObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        window.requestAnimationFrame(() => {
          this.stickyHeight.set(entries[0].contentRect.height);
          this.wakeLoop();
          // Google Maps ne réagit PAS tout seul à un changement de taille CSS
          // de son conteneur (contrairement à un simple redimensionnement de
          // fenêtre) : sans ce trigger, l'instance continue de peindre à son
          // ANCIENNE taille interne (juste étirée en CSS) — d'où un rendu
          // flou et des tuiles qui ne se rechargent plus au pan une fois le
          // conteneur agrandi (ex. layout scindé, voir ROADMAP.md "UI Desktop").
          // Le trigger ponctuel déjà fait plus bas (juste après le déplacement
          // DOM) ne couvre que CE moment précis, pas les redimensionnements
          // ultérieurs du même conteneur (resize fenêtre, rotation...).
          const nativeMap = map.googleMap;
          if (nativeMap) google.maps.event.trigger(nativeMap, 'resize');
        });
      }
    });
    this.mapObserver.observe(map.elementRef.nativeElement);

    // Correction d'affichage de l'API Google Maps après transfert du DOM :
    // un simple `setCenter` sur SA PROPRE position actuelle (`getCenter()`,
    // pas `map.center()` — ce signal Angular n'est plus jamais réécrit par
    // personne depuis que le recentrage "1er point" par défaut a été retiré,
    // voir `TripDayMapComponent`, il resterait figé sur sa valeur initiale
    // et écraserait la vraie caméra déjà posée par `updateMapFromScroll`)
    // suffit à forcer le repaint, sans repositionner la caméra.
    setTimeout(() => {
      const nativeMap = map.googleMap;
      if (nativeMap) {
        google.maps.event.trigger(nativeMap, 'resize');
        const center = nativeMap.getCenter();
        if (center) nativeMap.setCenter(center);
      }
    }, 50);
  }

  readonly wakeLoop = (): void => {
    this.idleFrames = 0;
    // `frameBudget` n'est volontairement PAS remis à 0 ici : si quelque chose
    // rappelle `wakeLoop()` en continu (ex. un ResizeObserver qui se
    // redéclenche à cause d'un effet de bord de `updateMapFromScroll`), ça
    // viderait le compteur avant qu'il n'atteigne jamais le seuil — le
    // garde-fou doit mesurer la durée totale sans repos, pas juste depuis le
    // dernier réveil. Remis à 0 uniquement quand la boucle atteint vraiment
    // l'idle (voir tick()) ou qu'un nouveau jour est branché (attachMap).
    if (!this.rafLoop) {
      this.rafLoop = requestAnimationFrame(this.tick);
    }
  };

  private readonly tick = (): void => {
    this.frameBudget++;
    if (this.frameBudget > DayScrollSyncService.MAX_FRAMES_WITHOUT_IDLE) {
      console.error(
        '[DayScrollSyncService] Boucle rAF arrêtée après', this.frameBudget,
        'frames sans repos (probable boucle de rétroaction scroll/carte) — diagnostic :',
        {
          lastScrollY: this.lastScrollY,
          currentScrollY: this.config.getSlideEl()?.scrollTop,
          isActive: this.config.isActive(),
          offsetsCount: this.config.getFreshOffsets().length,
          mapPointsCount: this.config.getDayMapPoints().length,
          isAutoScrolling: this.isAutoScrolling,
          isTouching: this.isTouching,
        },
      );
      this.rafLoop = undefined;
      return;
    }

    const currentScrollY = this.config.getSlideEl()?.scrollTop ?? 0;

    if (currentScrollY !== this.lastScrollY) {
      this.lastScrollY = currentScrollY;
      this.idleFrames = 0;
      if (this.config.cameraFollowEnabled?.() ?? true) this.updateMapFromScroll(currentScrollY);
    } else {
      this.idleFrames++;
    }

    if (this.idleFrames < this.IDLE_THRESHOLD) {
      this.rafLoop = requestAnimationFrame(this.tick);
    } else {
      this.rafLoop = undefined;
      this.frameBudget = 0;
    }
  };

  private updateMapFromScroll(scrollY: number): void {
    if (!this.config.isActive()) {
      return;
    }
    const freshOffsets = this.config.getFreshOffsets();
    if (freshOffsets.length === 0) return;

    const mapElement = this.config.getStickyMapEl();
    if (!mapElement) return;

    // 1. Récupérer la hauteur réelle de la carte via son composant actif
    const activeMapComponent = this.config.getMapComponent();
    const mapHeight = activeMapComponent?.elementRef?.nativeElement?.getBoundingClientRect().height || this.stickyHeight();

    // 2. Récupérer la hauteur du conteneur sticky global (qui contient ta timeline)
    // Comme getBoundingClientRect().height reste vraie même en sticky, on l'utilise !
    const stickyContainerHeight = mapElement.getBoundingClientRect().height;

    // 3. LA LIGNE DE DÉCLENCHEMENT EXACTE (SANS PIÈGE DU STICKY) :
    // C'est le scroll actuel + l'espace total occupé par tes éléments fixes à l'écran.
    // Si la map et la timeline sont l'une sur l'autre dans le bloc sticky, stickyContainerHeight englobe déjà le tout.
    // Par sécurité, on s'assure de prendre au moins la hauteur de la map.
    // En layout scindé (carte à gauche, PAS au-dessus de la liste), la carte
    // elle-même ne bloque plus rien en haut du scroll : un bouclier de sa
    // hauteur décalerait le déclenchement de toute sa hauteur (~70dvh), très
    // en retard. Le chrome fixe (toolbar+header+jours), lui, reste un vrai
    // bouclier en `'split-pinned'` (desktop, jamais masqué au scroll) — voir
    // `getPinnedChromeOffset` — d'où son ajout ici en plus de la petite marge
    // ACTIVITY_SCROLL_GAP.
    const totalStickyShield = this.config.isSplitLayout()
      ? this.config.getPinnedChromeOffset() + this.ACTIVITY_SCROLL_GAP
      : Math.max(stickyContainerHeight, mapHeight);
    const triggerLine = scrollY + totalStickyShield;

    // 4. Trouver l'index de la carte par rapport à cette ligne
    const upcomingIndex = freshOffsets.findIndex(offset => offset.top > triggerLine);

    if (upcomingIndex === 0) {
      // Avant d'atteindre la 1re activité : la carte part d'une vue
      // d'ensemble (tous les points du jour) en haut du jour (scrollY = 0) et
      // se resserre progressivement sur la 1re activité au fur et à mesure du
      // scroll, jusqu'à rejoindre exactement l'état que `followScroll`
      // produirait pour t=0 sur le 1er segment (voir ROADMAP.md).
      const firstOffset = freshOffsets[0];
      const firstId = firstOffset.card.activity()?.id;
      const firstPoint = firstId ? this.config.getDayMapPoints().find(p => p.activityId === firstId) : undefined;
      if (!firstPoint) return;

      const scrollAtFirst = Math.max(0, firstOffset.top - totalStickyShield);
      // Cas dégénéré (bouclier — carte sticky + chrome — aussi haut ou plus
      // que la position de la 1re carte, ex. jour très court avec peu
      // d'activités) : `scrollAtFirst <= 0` forçait `t=1` (zoom complet sur
      // le 1er point) même à `scrollY=0`, empêchant la vue d'ensemble de
      // jamais s'afficher à l'arrivée sur un tel jour — l'utilisateur n'a
      // pourtant pas scrollé, `scrollY<=0` doit rester la vue d'ensemble.
      const t = scrollAtFirst > 0 ? Math.min(1, Math.max(0, scrollY / scrollAtFirst)) : (scrollY <= 0 ? 0 : 1);

      this.config.getMapComponent()?.followFromOverview(this.config.getDayMapPoints(), firstPoint, t);
      return;
    }

    let fromIndex: number;
    let toIndex: number;
    let t: number;

    if (upcomingIndex === -1) {
      fromIndex = freshOffsets.length - 1;
      toIndex = fromIndex;
      t = 1;
    } else {
      fromIndex = upcomingIndex - 1;
      toIndex = upcomingIndex;

      const fromCard = freshOffsets[fromIndex];
      const toCard = freshOffsets[toIndex];

      const span = toCard.top - fromCard.top;
      t = span !== 0 ? (triggerLine - fromCard.top) / span : 0;
      t = Math.min(1, Math.max(0, t));
    }

    const from = freshOffsets[fromIndex];
    const to = freshOffsets[toIndex];

    const fromId = from.card.activity()?.id;
    const toId = to.card.activity()?.id;
    if (!fromId || !toId) return;

    const fromPoint = this.config.getDayMapPoints().find(p => p.activityId === fromId);
    const toPoint = this.config.getDayMapPoints().find(p => p.activityId === toId);
    if (!fromPoint || !toPoint) return;

    this.config.getMapComponent()?.followScroll(fromPoint, toPoint, t);
  }

  /**
   * Scroll jusqu'à l'activité `activityId` (clic timeline ou marqueur carte),
   * en tenant compte du bandeau sticky qui la masquerait sinon. `onComplete`
   * (ex. chaînage de saisie guidée, voir DayActivityCreationService) n'est
   * appelé qu'UNE FOIS L'ANIMATION TERMINÉE : `app-select`/`app-time-picker-dialog`
   * s'ancrent (CDK `flexibleConnectedTo`) à la position de leur champ au
   * moment de l'ouverture et ne suivent PAS le scroll programmatique de
   * `smoothScrollTo` (`slideEl` n'est pas enregistré `cdkScrollable`) — les
   * ouvrir pendant que le scroll est encore en vol les ancre à une position
   * qui devient fausse dès que le scroll continue, cassant visuellement le
   * chaînage.
   */
  /**
   * Variante de `focusActivity` utilisée pour une navigation croisée depuis
   * un autre onglet (voir DayActivityFocusService) : le jour vient parfois
   * d'être monté à l'instant (préchargement par `TripDaySwiperComponent`,
   * voir `preloadAround`), donc `activityCards` (viewChildren) peut ne pas
   * encore refléter les cartes du tout premier rendu. On réessaie sur
   * quelques frames avant d'abandonner silencieusement.
   */
  focusActivityWhenReady(activityId: string, attemptsLeft = 15): void {
    const found = this.config.getFreshOffsets().some(item => item.card.activity()?.id === activityId);
    if (found || attemptsLeft <= 0) {
      this.focusActivity(activityId);
      return;
    }
    requestAnimationFrame(() => this.focusActivityWhenReady(activityId, attemptsLeft - 1));
  }

  focusActivity(activityId: string, onComplete?: () => void): void {
    const freshOffsets = this.config.getFreshOffsets();

    const target = freshOffsets.find(
      item => item.card.activity()?.id === activityId
    );

    if (!target) {
      onComplete?.();
      return;
    }

    const stickyElement = this.config.getStickyMapEl();

    // En layout scindé, la carte est à côté (pas au-dessus) de la liste :
    // aucune hauteur à soustraire pour "sortir de dessous" la carte — mais le
    // chrome fixe (toolbar+header+jours) reste à soustraire en `'split-pinned'`
    // (voir `getPinnedChromeOffset`), lui ne se masquant jamais au scroll.
    const stickyHeight = this.config.isSplitLayout()
      ? this.config.getPinnedChromeOffset()
      : stickyElement
        ? stickyElement.getBoundingClientRect().height
        : this.stickyHeight();

    const targetScroll = target.top - stickyHeight - this.ACTIVITY_SCROLL_GAP;

    this.smoothScrollTo(targetScroll, 700, onComplete);
  }

  private smoothScrollTo(targetY: number, duration = 600, onComplete?: () => void): void {
    const slideEl = this.config.getSlideEl();
    if (!this.config.isActive() || !slideEl) {
      onComplete?.();
      return;
    }

    this.isAutoScrolling = true;
    const startY = slideEl.scrollTop;
    const distance = targetY - startY;

    const startTime = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = easeOutCubic(progress);

      slideEl.scrollTop = startY + distance * eased;

      this.wakeLoop();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAutoScrolling = false;
        this.wakeLoop();
        onComplete?.();
      }
    };

    requestAnimationFrame(animate);
  }

  private readonly onSlideScroll = (): void => {
    // Réveille aussi la boucle rAF (comme wheel/touch) : un drag de la
    // scrollbar desktop déclenche un `scroll` natif SANS `wheel`/`touch`, donc
    // sans cet appel la boucle — si déjà retombée idle — ne redémarre jamais
    // et le suivi caméra en direct (tick()/updateMapFromScroll) ne voit pas
    // le scroll. Même correctif déjà en place côté chrome, voir
    // TripDaySwiperComponent.onSlideScroll.
    this.wakeLoop();

    if (!this.config.isActive() || this.isTouching || this.isAutoScrolling) {
      return;
    }

    clearTimeout(this.scrollTimeout);

    this.scrollTimeout = window.setTimeout(() => {
      this.trySnapActivity();
    }, this.SNAP_DELAY);
  };

  private readonly onTouchStart = (): void => {
    this.isTouching = true;
  };

  private readonly onTouchEnd = (): void => {
    this.isTouching = false;

    clearTimeout(this.scrollTimeout);

    this.scrollTimeout = window.setTimeout(() => {
      this.trySnapActivity();
    }, this.SNAP_DELAY);
  };

  private trySnapActivity(): void {
    if (!this.config.isActive()) {
      return;
    }
    const stickyElement = this.config.getStickyMapEl();
    const slideEl = this.config.getSlideEl();

    if (!stickyElement || !slideEl) {
      return;
    }

    // Même raisonnement que focusActivity ci-dessus.
    const stickyHeight = this.config.isSplitLayout()
      ? this.config.getPinnedChromeOffset()
      : stickyElement.getBoundingClientRect().height;

    const anchor = slideEl.scrollTop + stickyHeight;

    const cards = this.config.getFreshOffsets();

    if (!cards.length) {
      return;
    }

    const candidate = cards.find(card => {
      const distance = card.top - anchor;
      return Math.abs(distance) <= this.SNAP_DISTANCE;
    });

    if (!candidate) {
      return;
    }

    const delta = candidate.top - anchor;

    if (Math.abs(delta) > this.SNAP_DISTANCE) {
      return;
    }

    const maxScroll = slideEl.scrollHeight - slideEl.clientHeight;

    // Ne jamais perturber l'accès au bouton +
    if (slideEl.scrollTop >= maxScroll - 200) {
      return;
    }

    this.smoothScrollTo(candidate.top - stickyHeight - 5, 400);
  }

  ngOnDestroy(): void {
    this.mapSubscription?.unsubscribe();
    this.mapObserver?.disconnect();
    this.globalObserver?.disconnect();
    window.removeEventListener('resize', this.wakeLoop);
    this.slideEl?.removeEventListener('scroll', this.onSlideScroll);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchstart', this.wakeLoop);
    window.removeEventListener('touchmove', this.wakeLoop);
    window.removeEventListener('wheel', this.wakeLoop);
    if (this.rafLoop) cancelAnimationFrame(this.rafLoop);
    clearTimeout(this.scrollTimeout);
  }
}
