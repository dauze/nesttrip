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
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';
import { TripDayMapComponent } from './trip-day-map/trip-day-map.component';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { getScrollContainer } from '@app/shared/utils/scroll-container';

/** État d'un réordonnancement manuel en cours dans un jour — voir DayPanelComponent.onDragHandleDown. */
interface DayDragState {
  readonly pointerId: number;
  readonly card: ActivityCardComponent;
  readonly activityId: string;
  readonly fromIndex: number;
  targetIndex: number;
  thresholdCrossed: boolean;
  readonly startClientX: number;
  readonly startClientY: number;
  /**
   * Distance (px) entre le point de pointerdown et le coin haut-gauche de la
   * carte, mesurée AVANT tout collapse (voir `onDragHandleDown`) — le collapse
   * simultané de TOUTES les cartes (dont d'éventuelles cartes au-dessus,
   * elles aussi dépliées) peut faire remonter la carte draguée sans que le
   * doigt n'ait bougé. En repositionnant toujours la carte à
   * `pointeur courant - grabOffset` plutôt qu'à sa position mesurée après
   * collapse, elle reste exactement sous le doigt, à l'endroit où elle a été
   * saisie, quel que soit le réagencement de la liste.
   */
  readonly grabOffsetX: number;
  readonly grabOffsetY: number;
  /** Offsets (id, top document-relatif) de toutes les cartes, figés une seule fois au franchissement du seuil — les voisines ne bougent pas dans le DOM pendant le drag, seul leur décalage visuel change. */
  offsets: { id: string; top: number }[];
  /** Distance top-à-top entre deux cartes consécutives (déjà collapsées) — sert de grille uniforme pour le hit-test. */
  slotHeight: number;
  /**
   * Clone visuel qui suit le doigt, ajouté au portail hors-swiper — voir
   * `beginCardFollow`. Le VRAI nœud de la carte, lui, ne quitte JAMAIS sa
   * place dans le DOM (juste masqué via `leaveFlowHidden`) : le reparenter
   * (comme une version précédente le faisait) annule le geste au premier
   * mouvement sur beaucoup de navigateurs/plateformes, le nœud déplacé étant
   * la cible du pointeur actif — la même logique que `.cdk-drag-preview`
   * dans Angular CDK, qui clone pour la même raison.
   */
  cloneEl: HTMLElement | null;
}

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, PanelComponent, ButtonComponent, MessageComponent, SkeletonComponent],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly lockService = inject(SwiperLockService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly mapHost = inject(TripDayMapHostService);
  readonly googleMapPanelService = inject(GoogleMapPanelService);
  protected readonly dispatchService = inject(ActivityDispatchService);
  
  readonly collapsed = this.googleMapPanelService.isCollapsed;

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');
  /** Conteneur flex de la liste — voir `lockActivityListHeight` : sa hauteur est figée pendant un drag pour ne pas "sauter" quand la carte draguée quitte le flux. */
  private readonly activityList = viewChild<ElementRef<HTMLElement>>('activityList');

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

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getDayActivities(this.dayId())());

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

    // Visibilité du clone de suivi réactive à l'escalade — pas seulement
    // réévaluée au pointermove suivant (comme avant, voir historique dans
    // `handleDragPointerMove`) : sinon, si le doigt reste immobile pile au
    // moment où l'escalade démarre (fin du survol prolongé de la barre) ou
    // se termine (désescalade), le clone garde son ancien état de visibilité
    // jusqu'au prochain mouvement — fenêtre où ni lui ni la bulle
    // (ActivityDayDispatchOverlayComponent) ne sont visibles.
    effect(() => {
      const escalated = this.dispatchService.dayEscalated();
      const drag = this.drag;
      const clone = drag?.cloneEl;
      if (!clone || !drag) return;

      if (escalated) {
        clone.style.visibility = 'hidden';
        return;
      }

      // À la réapparition (désescalade), son `transform` n'a plus bougé
      // depuis le début de l'escalade : `handleDragPointerMove` s'arrête
      // court-circuité tant que `dayEscalated()` est vrai (voir plus bas),
      // donc le clone est resté figé à sa position d'AVANT le survol du
      // calendrier. Sans le repositionner ici, il réapparaît loin de l'endroit
      // où la bulle vient de s'effacer (sous le doigt) — d'où l'impression
      // que "la bulle disparaît" sans que rien ne prenne le relais visible.
      const pointer = this.dispatchService.pointer();
      clone.style.transform = `translate3d(${pointer.x - drag.startClientX}px, ${pointer.y - drag.startClientY}px, 0)`;
      clone.style.visibility = '';
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

      // Le scroll pertinent est désormais celui du slide isolé (swiper-slide
      // ancêtre), plus celui du document — chaque jour a son propre scroll,
      // voir CLAUDE.md / TripChromeService.
      const slideEl = this.getSlideEl();

      // Écouteurs globaux branchés directement sur la boucle cinématique dynamique
      this.wakeLoop();
      window.addEventListener('resize', this.wakeLoop, { passive: true });
      slideEl?.addEventListener('scroll', this.onSlideScroll, { passive: true });

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
        slideEl?.removeEventListener('scroll', this.onSlideScroll);

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

  /** Conteneur de scroll isolé de ce jour : le `swiper-slide` ancêtre (voir shared/utils/scroll-container.ts). */
  private getSlideEl(): HTMLElement | null {
    return getScrollContainer(this.elRef.nativeElement);
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
    const poolId = crypto.randomUUID();
    this.tripFacade.createActivity(
      this.tripId(),
      this.dayId(),
      {
        id: poolId,
        title: '',
        placeId: '',
        files: [],
        photoRefs: [],
      },
      {
        id: crypto.randomUUID(),
        activityId: poolId,
        type: ActivityType.ACTIVITE,
        duration: 0,
        price: { amount: 0, currency: 'EUR' },
        booking: { status: BookingStatus.NOT_NEEDED, deadline: undefined },
        notes: '',
      },
    );
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

    // Mesuré AVANT le collapse : voir la doc de `grabOffsetX/Y` sur DayDragState.
    const preCollapseRect = card.hostElement.getBoundingClientRect();
    const grabOffsetX = ev.x - preCollapseRect.left;
    const grabOffsetY = ev.y - preCollapseRect.top;

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
      grabOffsetX,
      grabOffsetY,
      offsets: [],
      slotHeight: 0,
      cloneEl: null,
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

    // Appelé sur CHAQUE pointermove, y compris avant le franchissement du
    // seuil : sur mobile, laisser passer ne serait-ce que les tout premiers
    // events sans preventDefault() laisse une fenêtre où le navigateur peut
    // encore arbitrer en faveur d'un scroll natif (le `touch-action: none`
    // du handle protège la plupart des cas, mais pas cette fenêtre-là si le
    // thread principal est chargé au même instant, ex. collapse simultané de
    // toutes les cartes déclenché au pointerdown).
    if (event.cancelable) event.preventDefault();

    if (!drag.thresholdCrossed) {
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      if (Math.hypot(dx, dy) < this.DAY_DRAG_MOVE_THRESHOLD) return;
      this.beginCardFollow(drag, event);
    }

    this.dispatchService.pointer.set({ x: event.clientX, y: event.clientY });

    // Pendant l'escalade (survol prolongé de la barre de jours), la bulle a
    // la main : on met le suivi local en pause sans le tuer (voir aussi
    // `startDayDragAutoScroll`), la reprise est automatique à la désescalade.
    // Le clone, lui, est masqué le temps de l'escalade (visibilité pilotée
    // par un effect() dans le constructeur, réactif à `dayEscalated()` —
    // pas ici, voir sa doc : sinon la bascule attend le pointermove suivant).
    if (this.dispatchService.dayEscalated()) return;

    if (drag.cloneEl) {
      drag.cloneEl.style.transform = `translate3d(${event.clientX - drag.startClientX}px, ${event.clientY - drag.startClientY}px, 0)`;
    }
    this.updateTargetIndex(drag, event);
  };

  private readonly handleDragPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    this.detachDragListeners();
    this.stopDayDragAutoScroll();
    this.lockService.unlock();
    this.dispatchService.clearActiveDayDrag();
    this.unlockActivityListHeight();
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
      // Flush synchrone : @for a le vrai nœud de la carte (jamais déplacé
      // hors de sa place, voir `beginCardFollow`) dans son nouveau slot AVANT
      // la mesure "after" de `settleCard`.
      this.cdr.detectChanges();
    }

    this.settleCard(drag);
    this.restoreCollapseSnapshot();
    queueMicrotask(() => this.wakeLoop());
  };

  /** Sort réellement la carte du flux (sur place, voir `leaveFlowHidden`) et fait apparaître un clone SOUS LE DOIGT (voir `grabOffsetX/Y`, pas sa position mesurée après collapse) hors du swiper (voir ActivityDispatchService.registerDragPortal), puis fige les offsets des voisines pour le hit-test. */
  private beginCardFollow(drag: DayDragState, event: PointerEvent): void {
    drag.thresholdCrossed = true;

    const el = drag.card.hostElement;
    const rect = el.getBoundingClientRect();

    const freshOffsets = this.getFreshCardOffsets();
    drag.offsets = freshOffsets.map(o => ({ id: o.card.activity()?.id ?? '', top: o.top }));
    drag.slotHeight = freshOffsets.length > 1
      ? freshOffsets[1].top - freshOffsets[0].top
      : (freshOffsets[0]?.height ?? rect.height);

    // Fige la hauteur de la liste À CET INSTANT PRÉCIS (juste avant que la
    // carte ne quitte le flux) : mesurée trop tôt (ex. dès le pointerdown),
    // PrimeNG n'a pas encore appliqué le collapse (son moteur d'animation
    // défère la mise à jour via un rAF interne même à durée nulle), et on
    // fige alors la hauteur "toutes cartes dépliées" pour tout le reste du
    // drag. Ici, `rect`/`freshOffsets` ci-dessus prouvent déjà que le collapse
    // est visuellement appliqué (même mesure, même instant).
    this.lockActivityListHeight();

    // Clone visuel qui suivra le doigt hors du swiper — voir la doc de
    // `cloneEl` sur DayDragState pour pourquoi ce n'est PAS le vrai nœud
    // qu'on déplace. `removeAttribute('id')` évite les doublons d'id (des
    // champs de formulaire notamment) entre l'original et le clone.
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    clone.style.position = 'fixed';
    // Position de base = point de pointerdown moins le grabOffset : c'est la
    // position qu'aurait la carte si le doigt n'avait pas bougé depuis le
    // pointerdown, indépendamment d'où le collapse simultané des autres
    // cartes l'a fait atterrir (voir la doc de `grabOffsetX/Y`).
    clone.style.left = `${drag.startClientX - drag.grabOffsetX}px`;
    clone.style.top = `${drag.startClientY - drag.grabOffsetY}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.margin = '0';
    clone.style.zIndex = '1150';
    clone.style.transform = 'translate3d(0px, 0px, 0)';
    clone.style.pointerEvents = 'none';
    drag.cloneEl = clone;

    const portal = this.dispatchService.getDragPortalElement();
    (portal ?? document.body).appendChild(clone);

    // Le vrai nœud ne bouge jamais dans le DOM : juste masqué + sorti du flux
    // sur place (voir `leaveFlowHidden`).
    drag.card.leaveFlowHidden();

    const info = drag.card.buildDayDragInfo();
    if (info) this.dispatchService.registerActiveDayDrag(info, clone);
  }

  /** Recalcule l'index de dépose par hit-test contre les offsets figés au franchissement du seuil, et ne réapplique le décalage visuel des voisines que si l'index a changé. */
  private updateTargetIndex(drag: DayDragState, event: PointerEvent): void {
    if (!drag.offsets.length || drag.slotHeight <= 0) return;

    // Même repère pseudo-absolu que getFreshCardOffsets() (relatif au slide isolé, pas au document).
    const slideEl = this.getSlideEl();
    const slideTop = slideEl?.getBoundingClientRect().top ?? 0;
    const slideScrollTop = slideEl?.scrollTop ?? 0;
    const docY = event.clientY - slideTop + slideScrollTop;
    const relative = docY - drag.offsets[0].top;
    let targetIndex = Math.round(relative / drag.slotHeight);
    targetIndex = Math.max(0, Math.min(drag.offsets.length - 1, targetIndex));

    if (targetIndex === drag.targetIndex) return;
    drag.targetIndex = targetIndex;
    this.applySiblingOffsets(drag);
  }

  /**
   * Décale visuellement (translateY CSS, transition déclarative) les cartes
   * voisines pour ouvrir/refermer la place de la carte draguée — jamais la
   * carte elle-même (elle suit le doigt via le clone, voir `beginCardFollow`).
   *
   * Piège : la carte draguée est en `position:fixed` (voir `beginCardFollow`),
   * donc entièrement retirée de la composition flex — TOUT ce qui suit son
   * index d'origine remonte donc déjà, tout seul, d'un `slotHeight` en layout
   * pur (aucun transform requis pour ça). Ce calcul doit composer avec ce
   * remous automatique plutôt que l'ignorer :
   * - pour une carte après `fromIndex` ET dans la zone active du drag (jusqu'à
   *   `targetIndex` en descendant), ce remous automatique EST exactement le
   *   décalage recherché → décalage manuel nul.
   * - pour une carte après `fromIndex` mais HORS de cette zone, il faut au
   *   contraire ANNULER ce remous (+slotHeight) pour qu'elle reste à sa place.
   * - pour une carte avant `fromIndex`, aucun remous automatique n'existe :
   *   le décalage (si besoin, en remontant la carte) est entièrement manuel.
   */
  private applySiblingOffsets(drag: DayDragState): void {
    const { fromIndex, targetIndex, slotHeight, activityId } = drag;
    const order = this.activities();

    for (const c of this.activityCards()) {
      const id = c.activity()?.id;
      if (!id || id === activityId) continue;

      const index = order.findIndex(a => a.id === id);
      let offset = 0;
      if (index > fromIndex) {
        offset = (targetIndex > fromIndex && index <= targetIndex) ? 0 : slotHeight;
      } else {
        offset = (targetIndex < fromIndex && index >= targetIndex) ? slotHeight : 0;
      }

      c.setShiftOffset(offset);
    }
  }

  /**
   * Animation de "pose" jouée une seule fois au relâchement (pas à chaque
   * swap) : mesure la position écran du CLONE (encore `position:fixed`, suit
   * le doigt), le retire, fait réapparaître le vrai nœud dans le flux (voir
   * `rejoinFlow`), puis anime son delta vers 0 — même technique FLIP que
   * `runTabFlip` dans ActivityDayDispatchOverlayComponent.
   */
  private settleCard(drag: DayDragState): void {
    const before = drag.cloneEl?.getBoundingClientRect();
    drag.cloneEl?.remove();
    drag.cloneEl = null;
    drag.card.rejoinFlow();

    if (!before) return;
    const after = drag.card.hostElement.getBoundingClientRect();

    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (dx === 0 && dy === 0) return;

    drag.card.hostElement.animate(
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
    this.unlockActivityListHeight();
    if (this.drag === drag) this.drag = undefined;

    for (const c of this.activityCards()) {
      if (c.activity()?.id !== drag.activityId) c.clearShiftOffset();
    }

    if (drag.thresholdCrossed) {
      drag.cloneEl?.remove();
      drag.card.rejoinFlow();
    }

    this.restoreCollapseSnapshot();
  }

  private detachDragListeners(): void {
    document.removeEventListener('pointermove', this.handleDragPointerMove);
    document.removeEventListener('pointerup', this.handleDragPointerUp);
    document.removeEventListener('pointercancel', this.handleDragPointerUp);
  }

  /**
   * Fige la hauteur du conteneur de la liste à sa valeur actuelle (toutes les
   * cartes déjà collapsées, mais aucune n'a encore quitté le flux) : sans ça,
   * dès que la carte draguée passe en `position:fixed` (voir `beginCardFollow`),
   * le conteneur perd la hauteur d'un slot entier et tout ce qui dépend de sa
   * taille (auto-height du swiper notamment) recalcule/saute d'un coup.
   */
  private lockActivityListHeight(): void {
    const el = this.activityList()?.nativeElement;
    if (!el) return;
    el.style.minHeight = `${el.getBoundingClientRect().height}px`;
  }

  private unlockActivityListHeight(): void {
    const el = this.activityList()?.nativeElement;
    if (el) el.style.minHeight = '';
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
          this.getSlideEl()?.scrollBy(0, delta);
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
    const currentScrollY = this.getSlideEl()?.scrollTop ?? 0;

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

  if (upcomingIndex === 0) {
    // Avant d'atteindre la 1re activité : la carte part d'une vue
    // d'ensemble (tous les points du jour) en haut du jour (scrollY = 0) et
    // se resserre progressivement sur la 1re activité au fur et à mesure du
    // scroll, jusqu'à rejoindre exactement l'état que `followScroll`
    // produirait pour t=0 sur le 1er segment (voir ROADMAP.md).
    const firstOffset = freshOffsets[0];
    const firstId = firstOffset.card.activity()?.id;
    const firstPoint = firstId ? this.dayMapPoints().find(p => p.activityId === firstId) : undefined;
    if (!firstPoint) return;

    const scrollAtFirst = Math.max(0, firstOffset.top - totalStickyShield);
    const t = scrollAtFirst > 0 ? Math.min(1, Math.max(0, scrollY / scrollAtFirst)) : 1;

    this.mapRef()?.followFromOverview(this.dayMapPoints(), firstPoint, t);
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

  const fromPoint = this.dayMapPoints().find(p => p.activityId === fromId);
  const toPoint = this.dayMapPoints().find(p => p.activityId === toId);
  if (!fromPoint || !toPoint) return;

  this.mapRef()?.followScroll(fromPoint, toPoint, t);
}

  private get mapRef(): () => TripDayMapComponent | null {
    return () => this.activeMapComponent();
  }

  /**
   * Offsets "pseudo-absolus" des cartes, stables quel que soit le scroll
   * courant du slide : `rect.top` (relatif viewport, bouge avec le scroll
   * interne du slide) - `slideRect.top` (position écran fixe du slide, la
   * carte Google ne le déplace jamais verticalement) + `slideEl.scrollTop`
   * (scroll interne courant) — même principe que l'ancien `rect.top + window.scrollY`,
   * juste réancré sur le conteneur de scroll isolé du jour (voir CLAUDE.md).
   */
  getFreshCardOffsets(): { card: ActivityCardComponent; top: number; height: number }[] {
    const cards = this.activityCards();
    const slideEl = this.getSlideEl();
    const slideTop = slideEl?.getBoundingClientRect().top ?? 0;
    const slideScrollTop = slideEl?.scrollTop ?? 0;

    return cards.map(card => {
      const rect = card.element.getBoundingClientRect();
      return {
        card,
        top: rect.top - slideTop + slideScrollTop,
        height: rect.height,
      };
    });
  }

  private smoothScrollTo(targetY: number, duration = 600): void {
    const slideEl = this.getSlideEl();
    if (!this.active() || !slideEl) {
      return;
    }

    this.isAutoScrolling = true;
    const startY = slideEl.scrollTop;
    const distance = targetY - startY;

    const startTime = performance.now();

    const easeOutCubic = (t: number) =>
      1 - Math.pow(1 - t, 3);

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
    const slideEl = this.getSlideEl();

    if (!stickyElement || !slideEl) {
      return;
    }

    const stickyHeight =
      stickyElement.getBoundingClientRect().height;

    const anchor = slideEl.scrollTop + stickyHeight;

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

    const maxScroll = slideEl.scrollHeight - slideEl.clientHeight;

    // Ne jamais perturber l'accès au bouton +
    if (slideEl.scrollTop >= maxScroll - 200) {
      return;
    }

    this.smoothScrollTo(
      candidate.top - stickyHeight - 5,
      400
    );
  }
}