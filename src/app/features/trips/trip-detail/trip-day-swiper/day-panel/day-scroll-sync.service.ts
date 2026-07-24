import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
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
  private readonly zone = inject(NgZone);

  private config!: DayScrollSyncConfig;

  readonly stickyHeight = signal(0);

  private rafLoop?: number;
  private lastScrollY = -1;
  private idleFrames = 0;
  private readonly IDLE_THRESHOLD = 30;
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
        });
      }
    });
    this.mapObserver.observe(map.elementRef.nativeElement);

    // Correction d'affichage de l'API Google Maps après transfert du DOM
    setTimeout(() => {
      const nativeMap = map.googleMap;
      if (nativeMap) {
        google.maps.event.trigger(nativeMap, 'resize');
        if (map.center()) {
          nativeMap.setCenter(map.center());
        }
      }
    }, 50);
  }

  readonly wakeLoop = (): void => {
    this.idleFrames = 0;
    if (!this.rafLoop) {
      this.zone.runOutsideAngular(() => {
        this.rafLoop = requestAnimationFrame(this.tick);
      });
    }
  };

  private readonly tick = (): void => {
    const currentScrollY = this.config.getSlideEl()?.scrollTop ?? 0;

    if (currentScrollY !== this.lastScrollY) {
      this.lastScrollY = currentScrollY;
      this.idleFrames = 0;
      this.updateMapFromScroll(currentScrollY);
    } else {
      this.idleFrames++;
    }

    if (this.idleFrames < this.IDLE_THRESHOLD) {
      this.rafLoop = requestAnimationFrame(this.tick);
    } else {
      this.rafLoop = undefined;
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
    const totalStickyShield = Math.max(stickyContainerHeight, mapHeight);
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
      const t = scrollAtFirst > 0 ? Math.min(1, Math.max(0, scrollY / scrollAtFirst)) : 1;

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

  /** Scroll jusqu'à l'activité `activityId` (clic timeline ou marqueur carte), en tenant compte du bandeau sticky qui la masquerait sinon. */
  focusActivity(activityId: string): void {
    const freshOffsets = this.config.getFreshOffsets();

    const target = freshOffsets.find(
      item => item.card.activity()?.id === activityId
    );

    if (!target) {
      return;
    }

    const stickyElement = this.config.getStickyMapEl();

    const stickyHeight = stickyElement
      ? stickyElement.getBoundingClientRect().height
      : this.stickyHeight();

    const targetScroll = target.top - stickyHeight - this.ACTIVITY_SCROLL_GAP;

    this.smoothScrollTo(targetScroll, 700);
  }

  private smoothScrollTo(targetY: number, duration = 600): void {
    const slideEl = this.config.getSlideEl();
    if (!this.config.isActive() || !slideEl) {
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
      }
    };

    requestAnimationFrame(animate);
  }

  private readonly onSlideScroll = (): void => {
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

    const stickyHeight = stickyElement.getBoundingClientRect().height;

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
