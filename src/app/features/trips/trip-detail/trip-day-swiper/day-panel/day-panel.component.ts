import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  Signal,
  signal,
  viewChild,
  viewChildren
} from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { PanelModule } from 'primeng/panel';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { MessageModule } from 'primeng/message';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';
import { TripDayMapComponent } from './trip-day-map/trip-day-map.component';
import { SwiperHeightSyncService } from '@app/core/services/swiper-height-sync.service';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';

/** État d'un réordonnancement manuel en cours dans un jour — voir DayPanelComponent.onDragHandleDown. */
interface DayDragState {
  readonly pointerId: number;
  readonly card: ActivityCardComponent;
  readonly activityId: string;
  readonly fromIndex: number;
  targetIndex: number;
  thresholdCrossed: boolean;
  /** Dernier état d'escalade observé — détecte la transition pour masquer/réafficher la carte une seule fois (voir `handleDragPointerMove`). */
  wasEscalated: boolean;
  readonly startClientX: number;
  readonly startClientY: number;
  /** Position du pointeur à l'instant où le seuil a été franchi — sert de référence pour le `translate3d` appliqué à chaque frame. */
  baseClientX: number;
  baseClientY: number;
  /** Offsets (id, top document-relatif) de toutes les cartes, figés une seule fois au franchissement du seuil — les voisines ne bougent pas dans le DOM pendant le drag, seul leur décalage visuel change. */
  offsets: { id: string; top: number }[];
  /** Distance top-à-top entre deux cartes consécutives (déjà collapsées) — sert de grille uniforme pour le hit-test. */
  slotHeight: number;
  originParent: Node | null;
  originNextSibling: ChildNode | null;
}

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, PanelModule, Button, MessageModule, Skeleton],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly lockService = inject(SwiperLockService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly heightSync = inject(SwiperHeightSyncService);
  private readonly mapHost = inject(TripDayMapHostService);
  readonly googleMapPanelService = inject(GoogleMapPanelService);
  protected readonly dispatchService = inject(ActivityDispatchService);
  
  readonly collapsed = this.googleMapPanelService.isCollapsed;

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');

  private scrollTimeout?: number;
  private isTouching = false;
  private isAutoScrolling = false;
  // Ce jour n'a de carte "à lui" que lorsqu'il est actif : l'instance
  // partagée (jamais recréée) est alors physiquement déplacée dans son
  // conteneur sticky par TripDayMapHostService.
  readonly activeMapComponent = computed(() => (this.active() ? this.mapHost.activeMap() : null));
  private mapSubscription?: { unsubscribe: () => void };
  private mapObserver?: ResizeObserver;

  readonly stickyHeight = signal(0);
  readonly stickyOffset = this.stickyHeight.asReadonly();
  readonly active = input(false);
  private rafLoop?: number;
  private lastScrollY = -1;
  private idleFrames = 0;
  private readonly IDLE_THRESHOLD = 30;
  private readonly ACTIVITY_SCROLL_GAP = 8;
  private readonly SNAP_DELAY = 500;
  private readonly SNAP_DISTANCE = 60;
  /**
   * Zone d'auto-scroll (px depuis le haut/bas de l'ÉCRAN, pas du conteneur)
   * pendant un réordonnancement manuel dans le jour. Volontairement large :
   * la barre de navigation en bas d'écran arme, elle, sa propre escalade vers
   * le changement de jour après 450ms de survol (voir
   * ActivityDayDispatchOverlayComponent.checkEscalate) — une zone de scroll
   * trop étroite forcerait à s'en approcher au point de déclencher les deux
   * cinématiques en même temps.
   */
  private readonly DAY_DRAG_SCROLL_ZONE = 140;
  private readonly DAY_DRAG_SCROLL_MAX_SPEED = 18;
  private readonly DAY_DRAG_MOVE_THRESHOLD = 5;
  private dayDragScrollLoop?: number;
  /** Position Y courante du pointeur pendant un drag, alimentée par `handleDragPointerMove` — utilisée par la boucle d'auto-scroll. */
  private pointerY = 0;
  /** État du réordonnancement manuel en cours dans ce jour (voir `onDragHandleDown`), `undefined` en dehors d'un drag. */
  private drag?: DayDragState;

  activitiesCollapsed = false;
  private pendingActivityId?: string;
  /** Instantané de l'état ouvert/fermé des cartes + de la carte Google, pris au début d'un drag dans ce jour pour tout restaurer à la fin. */
  private collapseSnapshot?: { cards: Map<string, boolean>; map: boolean };

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getActivities(this.dayId())());

  readonly dayMapPoints = computed<DayMapPoint[]>(() => {
    return this.activities()
      .filter(a => a.placeId && a.latitude && a.longitude)
      .map((a, i) => ({
        activityId: a.id,
        placeId: a.placeId!,
        name: a.title,
        latitude: a.latitude!,
        longitude: a.longitude!,
        order: i + 1,
      }));
  });

  constructor() {
    // 1. Gestionnaire réactif pour mettre à jour les points de la carte
    effect(() => {
      const map = this.activeMapComponent();
      if (map) {
        map.points.set(this.dayMapPoints());
      }
    });

    // 2. Quand ce jour devient actif, on récupère l'instance UNIQUE de la
    // carte (créée une seule fois par TripDaySwiperComponent, jamais
    // recréée) et on la déplace physiquement dans notre conteneur sticky.
    effect(() => {
      if (!this.active()) return;
      const container = this.stickyMap()?.nativeElement;
      const map = this.mapHost.activeMap();
      if (!container || !map) return;

      this.mapHost.moveTo(container);
      this.wireActiveMap(map);
    });

    afterNextRender(() => {
      const el = this.stickyMap()?.nativeElement;
      if (!el) return;

      const mainContainer = el.parentElement; 
      let globalObserver: ResizeObserver | undefined;

      if (mainContainer) {
        // Le conteneur change de taille -> on recalcule la cinématique à la volée via wakeLoop
        globalObserver = new ResizeObserver(() => this.wakeLoop());
        globalObserver.observe(mainContainer);
      }

      // Écouteurs globaux branchés directement sur la boucle cinématique dynamique
      this.wakeLoop();
      window.addEventListener('resize', this.wakeLoop, { passive: true });
      window.addEventListener(
          'scroll',
          this.onWindowScroll,
          { passive: true }
        );

        window.addEventListener(
          'touchstart',
          this.onTouchStart,
          { passive: true }
        );

        window.addEventListener(
          'touchend',
          this.onTouchEnd,
          { passive: true }
        );
      window.addEventListener('touchstart', this.wakeLoop, { passive: true });
      window.addEventListener('touchmove', this.wakeLoop, { passive: true });
      window.addEventListener('wheel', this.wakeLoop, { passive: true });

      // Nettoyage complet à la destruction du composant
      this.destroyRef.onDestroy(() => {
        this.mapSubscription?.unsubscribe();
        this.mapObserver?.disconnect();
        if (globalObserver) globalObserver.disconnect();
        window.removeEventListener('resize', this.wakeLoop);
       window.removeEventListener(
          'scroll',
          this.onWindowScroll
        );

        window.removeEventListener(
          'touchstart',
          this.onTouchStart
        );

        window.removeEventListener(
          'touchend',
          this.onTouchEnd
        );
        window.removeEventListener('touchmove', this.wakeLoop);
        window.removeEventListener('wheel', this.wakeLoop);
        if (this.rafLoop) cancelAnimationFrame(this.rafLoop);
        this.stopDayDragAutoScroll();
        if (this.drag) this.abortDrag(this.drag);
      });
    });
  }

  /** Branche les listeners propres à l'instance partagée de la carte, une fois qu'elle vient d'être déplacée ici. */
  private wireActiveMap(map: TripDayMapComponent): void {
    // Reconnexion de l'événement de clic sur un marqueur
    this.mapSubscription?.unsubscribe();
    this.mapSubscription = map.activitySelected.subscribe((point) => {
      this.onMapPointClick(point);
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

  addActivity() {
    this.tripFacade.createActivity(this.tripId(), this.dayId(), {
      id: crypto.randomUUID(),
      title: '',
      type: ActivityType.ACTIVITE,
      duration: 0,
      price: { amount: 0, currency: 'EUR' },
      placeId: '',
      booking: { status: BookingStatus.NOT_NEEDED, deadline: undefined },
      notes: '',
      files: [],
      photoRefs: []
    });
    queueMicrotask(() => this.wakeLoop());
  }

  focusActivity(activityId: string): void {
    const freshOffsets = this.getFreshCardOffsets();

    const target = freshOffsets.find(
      item => item.card.activity()?.id === activityId
    );

    if (!target) {
      return;
    }

    const stickyElement = this.stickyMap()?.nativeElement;

    const stickyHeight = stickyElement
      ? stickyElement.getBoundingClientRect().height
      : this.stickyHeight();

    const targetScroll =
      target.top - stickyHeight - this.ACTIVITY_SCROLL_GAP;

    this.smoothScrollTo(targetScroll, 700);
  }

  onActivitiesPanelToggled() {
    if (this.pendingActivityId) {
      this.openCard(this.pendingActivityId);
      this.pendingActivityId = undefined;
    }
    // Filet de sécurité : force un recalcul de la hauteur du swiper à la fin
    // de l'animation PrimeNG, indépendamment du ResizeObserver de
    // SwiperAutoHeightWatchDirective (qui peut manquer sa fenêtre si le
    // contenu du panel n'a lui-même aucune raison de resize après montage).
    setTimeout(() => this.heightSync.update(0), 300);
    // Laisse le temps à l'animation PrimeNG de se terminer avant d'ajuster le scroll
    setTimeout(() => this.wakeLoop(), 300);
  }

  private openCard(activityId: string): void {
    const card = this.activityCards().find(c => c.activity()?.id === activityId);
    if (card) {
      card.openAndScroll();
    }
  }

  /**
   * Point d'entrée du réordonnancement manuel intra-jour, déclenché par le
   * pointerdown sur la poignée d'une carte (voir `ActivityCardComponent.dragHandleDown`).
   * Collapse toutes les cartes immédiatement (comme avant), puis attend un
   * léger seuil de mouvement avant de sortir réellement la carte du flux —
   * voir `handleDragPointerMove`/`beginCardFollow`.
   */
  onDragHandleDown(ev: { x: number; y: number; pointerId: number; activityId: string }): void {
    if (this.drag) return; // un seul geste de reorder actif à la fois

    const card = this.activityCards().find(c => c.activityId() === ev.activityId);
    const fromIndex = this.activities().findIndex(a => a.id === ev.activityId);
    if (!card || fromIndex === -1) return;

    this.lockService.lock();

    const cards = new Map<string, boolean>();
    for (const c of this.activityCards()) {
      const id = c.activity()?.id;
      if (id) cards.set(id, c.collapsed());
    }
    this.collapseSnapshot = { cards, map: this.googleMapPanelService.isCollapsed() };

    // collapseInstantly (pas juste collapsed.set(true)) : sur un drag rapide,
    // la géométrie doit déjà refléter l'état replié dès la frame suivante,
    // avant que le moindre mouvement ne soit interprété (voir sa doc).
    for (const c of this.activityCards()) c.collapseInstantly();
    this.googleMapPanelService.setCollapse(true);

    this.drag = {
      pointerId: ev.pointerId,
      card,
      activityId: ev.activityId,
      fromIndex,
      targetIndex: fromIndex,
      thresholdCrossed: false,
      startClientX: ev.x,
      startClientY: ev.y,
      baseClientX: ev.x,
      baseClientY: ev.y,
      offsets: [],
      slotHeight: 0,
      originParent: null,
      originNextSibling: null,
      wasEscalated: false,
    };
    this.pointerY = ev.y;

    document.addEventListener('pointermove', this.handleDragPointerMove, { passive: false });
    document.addEventListener('pointerup', this.handleDragPointerUp, { passive: true });
    document.addEventListener('pointercancel', this.handleDragPointerUp, { passive: true });

    this.startDayDragAutoScroll();
  }

  private readonly handleDragPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    this.pointerY = event.clientY;

    // Garde-fou : la liste a changé de façon inattendue en plein geste (ex.
    // suppression/dispatch concurrent) — on annule proprement plutôt que de
    // raisonner sur un fromIndex/offsets devenus obsolètes.
    if (this.activities().findIndex(a => a.id === drag.activityId) === -1) {
      this.abortDrag(drag);
      return;
    }

    if (!drag.thresholdCrossed) {
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      if (Math.hypot(dx, dy) < this.DAY_DRAG_MOVE_THRESHOLD) return;
      this.beginCardFollow(drag, event);
    }

    if (event.cancelable) event.preventDefault();

    this.dispatchService.pointer.set({ x: event.clientX, y: event.clientY });

    // Pendant l'escalade (survol prolongé de la barre de jours), la bulle a
    // la main : on met le suivi local en pause sans le tuer (voir aussi
    // `startDayDragAutoScroll`), la reprise est automatique à la désescalade.
    // La carte, elle, est masquée le temps de l'escalade pour ne jamais
    // l'avoir visible en même temps que la bulle (voir `setDragHidden`).
    const escalated = this.dispatchService.dayEscalated();
    if (escalated !== drag.wasEscalated) {
      drag.wasEscalated = escalated;
      drag.card.setDragHidden(escalated);
    }
    if (escalated) return;

    drag.card.updateDragTransform(event.clientX - drag.baseClientX, event.clientY - drag.baseClientY);
    this.updateTargetIndex(drag, event);
  };

  private readonly handleDragPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    this.detachDragListeners();
    this.stopDayDragAutoScroll();
    this.lockService.unlock();
    this.dispatchService.clearActiveDayDrag();
    this.drag = undefined;

    if (!drag.thresholdCrossed) {
      // Simple tap sur la poignée : rien à committer, juste rouvrir/refermer
      // les cartes comme avant le geste.
      this.restoreCollapseSnapshot();
      return;
    }

    for (const c of this.activityCards()) {
      if (c.activity()?.id !== drag.activityId) c.clearShiftOffset();
    }

    if (drag.targetIndex !== drag.fromIndex) {
      const ids = this.activities().map(a => a.id);
      const [movedId] = ids.splice(drag.fromIndex, 1);
      ids.splice(drag.targetIndex, 0, movedId);
      this.tripFacade.reorderActivities(this.tripId(), this.dayId(), ids);
      // Flush synchrone : @for doit avoir replacé le vrai nœud de la carte
      // dans son nouveau slot AVANT la mesure "after" de `settleCard`.
      this.cdr.detectChanges();
    } else if (drag.originParent) {
      drag.originParent.insertBefore(drag.card.hostElement, drag.originNextSibling);
    }

    this.settleCard(drag.card);
    this.restoreCollapseSnapshot();
    queueMicrotask(() => this.wakeLoop());
  };

  /** Sort réellement la carte du flux : mesure sa position écran actuelle, la déplace hors du swiper (voir ActivityDispatchService.registerDragPortal) et fige les offsets des voisines pour le hit-test. */
  private beginCardFollow(drag: DayDragState, event: PointerEvent): void {
    drag.thresholdCrossed = true;
    drag.baseClientX = event.clientX;
    drag.baseClientY = event.clientY;

    const el = drag.card.hostElement;
    const rect = el.getBoundingClientRect();
    drag.originParent = el.parentNode;
    drag.originNextSibling = el.nextSibling;

    const freshOffsets = this.getFreshCardOffsets();
    drag.offsets = freshOffsets.map(o => ({ id: o.card.activity()?.id ?? '', top: o.top }));
    drag.slotHeight = freshOffsets.length > 1
      ? freshOffsets[1].top - freshOffsets[0].top
      : (freshOffsets[0]?.height ?? rect.height);

    const portal = this.dispatchService.getDragPortalElement();
    if (portal) portal.appendChild(el);

    drag.card.setDragTransform(rect);

    const info = drag.card.buildDayDragInfo();
    if (info) this.dispatchService.registerActiveDayDrag(info, drag.card.element);
  }

  /** Recalcule l'index de dépose par hit-test contre les offsets figés au franchissement du seuil, et ne réapplique le décalage visuel des voisines que si l'index a changé. */
  private updateTargetIndex(drag: DayDragState, event: PointerEvent): void {
    if (!drag.offsets.length || drag.slotHeight <= 0) return;

    const docY = event.clientY + window.scrollY;
    const relative = docY - drag.offsets[0].top;
    let targetIndex = Math.round(relative / drag.slotHeight);
    targetIndex = Math.max(0, Math.min(drag.offsets.length - 1, targetIndex));

    if (targetIndex === drag.targetIndex) return;
    drag.targetIndex = targetIndex;
    this.applySiblingOffsets(drag);
  }

  /** Décale visuellement (translateY CSS, transition déclarative) les cartes voisines pour ouvrir/refermer la place de la carte draguée — jamais la carte elle-même (voir `updateDragTransform`). */
  private applySiblingOffsets(drag: DayDragState): void {
    const { fromIndex, targetIndex, slotHeight, activityId } = drag;
    const order = this.activities();

    for (const c of this.activityCards()) {
      const id = c.activity()?.id;
      if (!id || id === activityId) continue;

      const index = order.findIndex(a => a.id === id);
      let offset = 0;
      if (targetIndex > fromIndex && index > fromIndex && index <= targetIndex) offset = -slotHeight;
      else if (targetIndex < fromIndex && index >= targetIndex && index < fromIndex) offset = slotHeight;

      c.setShiftOffset(offset);
    }
  }

  /**
   * Animation de "pose" jouée une seule fois au relâchement (pas à chaque
   * swap) : mesure la position écran de la carte encore figée (`position:fixed`,
   * suit le doigt), retire ce figeage, puis anime le delta vers 0 — même
   * technique FLIP que `runTabFlip` dans ActivityDayDispatchOverlayComponent.
   */
  private settleCard(card: ActivityCardComponent): void {
    const before = card.hostElement.getBoundingClientRect();
    card.clearDragTransform();
    const after = card.hostElement.getBoundingClientRect();

    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (dx === 0 && dy === 0) return;

    card.hostElement.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }

  private restoreCollapseSnapshot(): void {
    if (!this.collapseSnapshot) return;
    const { cards, map } = this.collapseSnapshot;
    for (const card of this.activityCards()) {
      const id = card.activity()?.id;
      const prev = id ? cards.get(id) : undefined;
      if (prev !== undefined) card.collapsed.set(prev);
    }
    this.googleMapPanelService.setCollapse(map);
    this.collapseSnapshot = undefined;
  }

  /** Annule proprement un geste en cours (mutation externe de la liste, ou destruction du composant) : remet la carte à sa place, sans rien committer au store. */
  private abortDrag(drag: DayDragState): void {
    this.detachDragListeners();
    this.stopDayDragAutoScroll();
    this.lockService.unlock();
    this.dispatchService.clearActiveDayDrag();
    if (this.drag === drag) this.drag = undefined;

    for (const c of this.activityCards()) {
      if (c.activity()?.id !== drag.activityId) c.clearShiftOffset();
    }

    if (drag.thresholdCrossed) {
      if (drag.originParent) drag.originParent.insertBefore(drag.card.hostElement, drag.originNextSibling);
      drag.card.clearDragTransform();
    }

    this.restoreCollapseSnapshot();
  }

  private detachDragListeners(): void {
    document.removeEventListener('pointermove', this.handleDragPointerMove);
    document.removeEventListener('pointerup', this.handleDragPointerUp);
    document.removeEventListener('pointercancel', this.handleDragPointerUp);
  }

  onMapPointClick(point: DayMapPoint) {
    this.focusActivity(point.activityId);
  }

  /**
   * Auto-scroll de la fenêtre pendant un réordonnancement manuel dans ce
   * jour, sur une zone bien plus large que celle (5%) de l'ancien cdkDropList
   * — voir `DAY_DRAG_SCROLL_ZONE`. Vitesse proportionnelle à la profondeur du
   * pointeur dans la zone, pour rester doux près du seuil et rapide tout
   * contre le bord. S'arrête dès l'escalade vers le changement de jour (le
   * drag local est alors en pause, seule la bulle de
   * ActivityDayDispatchOverlayComponent est pilotée par l'utilisateur) pour
   * ne pas faire défiler la liste en arrière-plan pendant cette cinématique.
   */
  private startDayDragAutoScroll(): void {
    this.stopDayDragAutoScroll();

    const step = () => {
      // Pendant l'escalade (survol prolongé de la barre de jours), le scroll
      // de CE jour n'a plus de sens (c'est la grille du calendrier qui
      // défile, voir ActivityDayDispatchOverlayComponent) — on met juste la
      // boucle en pause SANS la tuer : le geste sous-jacent reste actif en
      // arrière-plan, et une désescalade (le doigt s'éloigne de la barre sans
      // être relâché) doit pouvoir la faire reprendre.
      if (!this.dispatchService.dayEscalated()) {
        const y = this.pointerY;
        const zone = this.DAY_DRAG_SCROLL_ZONE;
        let delta = 0;

        if (y < zone) {
          delta = -this.DAY_DRAG_SCROLL_MAX_SPEED * (1 - y / zone);
        } else if (y > window.innerHeight - zone) {
          delta = this.DAY_DRAG_SCROLL_MAX_SPEED * (1 - (window.innerHeight - y) / zone);
        }

        if (delta !== 0) {
          window.scrollBy(0, delta);
          this.wakeLoop();
        }
      }

      this.dayDragScrollLoop = requestAnimationFrame(step);
    };

    this.dayDragScrollLoop = requestAnimationFrame(step);
  }

  private stopDayDragAutoScroll(): void {
    if (this.dayDragScrollLoop) {
      cancelAnimationFrame(this.dayDragScrollLoop);
      this.dayDragScrollLoop = undefined;
    }
  }

  private wakeLoop = (): void => {
    this.idleFrames = 0;
    if (!this.rafLoop) {
      this.zone.runOutsideAngular(() => {
        this.rafLoop = requestAnimationFrame(this.tick);
      });
    }
  };

  private tick = (): void => {
    const currentScrollY = window.scrollY;

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

  private updateMapFromScroll(scrollY: number) {
    if (!this.active()) {
      return;
    }
  const freshOffsets = this.getFreshCardOffsets();
  if (freshOffsets.length === 0) return;

  const mapElement = this.stickyMap()?.nativeElement;
  if (!mapElement) return;

  // 1. Récupérer la hauteur réelle de la carte via son composant actif
  const activeMapComponent = this.activeMapComponent();
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

  let fromIndex: number;
  let toIndex: number;
  let t: number;

  if (upcomingIndex === -1) {
    fromIndex = freshOffsets.length - 1;
    toIndex = fromIndex;
    t = 1;
  } else if (upcomingIndex === 0) {
    fromIndex = 0;
    toIndex = 0;
    t = 0;
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

  const fromPoint = this.dayMapPoints().find(p => p.activityId === fromId);
  const toPoint = this.dayMapPoints().find(p => p.activityId === toId);
  if (!fromPoint || !toPoint) return;

  this.mapRef()?.followScroll(fromPoint, toPoint, t);
}

  private get mapRef(): () => TripDayMapComponent | null {
    return () => this.activeMapComponent();
  }

  getFreshCardOffsets(): { card: ActivityCardComponent; top: number; height: number }[] {
    const cards = this.activityCards();
    const currentScrollY = window.scrollY;

    return cards.map(card => {
      const rect = card.element.getBoundingClientRect();
      return {
        card,
        top: rect.top + currentScrollY, 
        height: rect.height,
      };
    });
  }

  private smoothScrollTo(targetY: number, duration = 600): void {
      if (!this.active()) {
    return;
  }

  this.isAutoScrolling = true;
  const startY = window.scrollY;
  const distance = targetY - startY;

  const startTime = performance.now();

  const easeOutCubic = (t: number) =>
    1 - Math.pow(1 - t, 3);

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const eased = easeOutCubic(progress);

    window.scrollTo(
      0,
      startY + distance * eased
    );

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


  private readonly onWindowScroll = (): void => {

    if (!this.active() || this.isTouching || this.isAutoScrolling) {
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
    if (!this.active()) {
      return;
    }
    const stickyElement = this.stickyMap()?.nativeElement;

    if (!stickyElement) {
      return;
    }

    const stickyHeight =
      stickyElement.getBoundingClientRect().height;

    const anchor = window.scrollY + stickyHeight;

    const cards = this.getFreshCardOffsets();

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

    const maxScroll =
      document.documentElement.scrollHeight -
      window.innerHeight;

    // Ne jamais perturber l'accès au bouton +
    if (window.scrollY >= maxScroll - 200) {
      return;
    }

    this.smoothScrollTo(
      candidate.top - stickyHeight - 5,
      400
    );
  }
}