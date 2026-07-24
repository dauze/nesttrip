import { ChangeDetectorRef, Injectable, OnDestroy, inject } from '@angular/core';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { DayScrollSyncService } from './day-scroll-sync.service';

interface CardOffset { card: ActivityCardComponent; top: number; height: number }

/** État d'un réordonnancement manuel en cours dans un jour — voir DayReorderService.onDragHandleDown. */
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

export interface DayReorderConfig {
  getCards: () => readonly ActivityCardComponent[];
  getActivities: () => Activity[];
  getTripId: () => string;
  getDayId: () => Date;
  getSlideEl: () => HTMLElement | null;
  getFreshOffsets: () => CardOffset[];
  getActivityListEl: () => HTMLElement | null;
  /** Flush synchrone de la détection de changements de DayPanelComponent — voir `handleDragPointerUp`. */
  notifyRenderFlush: () => void;
}

/**
 * Réordonnancement manuel intra-jour (glisser une carte par sa poignée pour
 * la replacer dans la liste), extrait de DayPanelComponent. Comportement
 * "pointer-driven" maison (pas cdkDropList) : collapse instantané de toutes
 * les cartes au pointerdown, clone visuel qui suit le doigt hors du flux une
 * fois un léger seuil de mouvement franchi (voir `beginCardFollow`), hit-test
 * contre des offsets figés pour recalculer l'index de dépose, auto-scroll de
 * la fenêtre en bord d'écran, et coordination avec
 * ActivityDayDispatchOverlayComponent pour l'escalade vers un autre jour
 * (voir `ActivityDispatchService.dayEscalated`).
 *
 * Fourni par `DayPanelComponent` (pas root), aux côtés de
 * `DayScrollSyncService` — une instance par jour affiché, détruite avec lui.
 */
@Injectable()
export class DayReorderService implements OnDestroy {
  private readonly tripFacade = inject(TripFacade);
  private readonly lockService = inject(SwiperLockService);
  private readonly googleMapPanelService = inject(GoogleMapPanelService);
  private readonly dispatchService = inject(ActivityDispatchService);
  private readonly scrollSync = inject(DayScrollSyncService);
  private readonly cdr = inject(ChangeDetectorRef);

  private config!: DayReorderConfig;

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

  /** Instantané de l'état ouvert/fermé des cartes + de la carte Google, pris au début d'un drag dans ce jour pour tout restaurer à la fin. */
  private collapseSnapshot?: { cards: Map<string, boolean>; map: boolean };

  /** Lu par DayPanelComponent (effect de visibilité du clone pendant l'escalade) — voir sa doc. */
  get currentDrag(): { cloneEl: HTMLElement | null; startClientX: number; startClientY: number } | undefined {
    return this.drag;
  }

  /** Branche le service sur cette instance de DayPanelComponent — à appeler une seule fois (constructeur). */
  connect(config: DayReorderConfig): void {
    this.config = config;
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

    const card = this.config.getCards().find(c => c.activityId() === ev.activityId);
    const fromIndex = this.config.getActivities().findIndex(a => a.id === ev.activityId);
    if (!card || fromIndex === -1) return;

    // Mesuré AVANT le collapse : voir la doc de `grabOffsetX/Y` sur DayDragState.
    const preCollapseRect = card.hostElement.getBoundingClientRect();
    const grabOffsetX = ev.x - preCollapseRect.left;
    const grabOffsetY = ev.y - preCollapseRect.top;

    this.lockService.lock();

    const cards = new Map<string, boolean>();
    for (const c of this.config.getCards()) {
      const id = c.activity()?.id;
      if (id) cards.set(id, c.collapsed());
    }
    this.collapseSnapshot = { cards, map: this.googleMapPanelService.isCollapsed() };

    // collapseInstantly (pas juste collapsed.set(true)) : sur un drag rapide,
    // la géométrie doit déjà refléter l'état replié dès la frame suivante,
    // avant que le moindre mouvement ne soit interprété (voir sa doc).
    for (const c of this.config.getCards()) c.collapseInstantly();
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
    if (this.config.getActivities().findIndex(a => a.id === drag.activityId) === -1) {
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
      this.beginCardFollow(drag);
    }

    this.dispatchService.pointer.set({ x: event.clientX, y: event.clientY });

    // Pendant l'escalade (survol prolongé de la barre de jours), la bulle a
    // la main : on met le suivi local en pause sans le tuer (voir aussi
    // `startDayDragAutoScroll`), la reprise est automatique à la désescalade.
    // Le clone, lui, est masqué le temps de l'escalade (visibilité pilotée
    // par un effect() dans DayPanelComponent, réactif à `dayEscalated()` —
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

    for (const c of this.config.getCards()) {
      if (c.activity()?.id !== drag.activityId) c.clearShiftOffset();
    }

    if (drag.targetIndex !== drag.fromIndex) {
      const ids = this.config.getActivities().map(a => a.id);
      const [movedId] = ids.splice(drag.fromIndex, 1);
      ids.splice(drag.targetIndex, 0, movedId);
      this.tripFacade.reorderActivities(this.config.getTripId(), this.config.getDayId(), ids);
      // Flush synchrone : @for a le vrai nœud de la carte (jamais déplacé
      // hors de sa place, voir `beginCardFollow`) dans son nouveau slot AVANT
      // la mesure "after" de `settleCard`.
      this.config.notifyRenderFlush();
    }

    this.settleCard(drag);
    this.restoreCollapseSnapshot();
    queueMicrotask(() => this.scrollSync.wakeLoop());
  };

  /** Sort réellement la carte du flux (sur place, voir `leaveFlowHidden`) et fait apparaître un clone SOUS LE DOIGT (voir `grabOffsetX/Y`, pas sa position mesurée après collapse) hors du swiper (voir ActivityDispatchService.registerDragPortal), puis fige les offsets des voisines pour le hit-test. */
  private beginCardFollow(drag: DayDragState): void {
    drag.thresholdCrossed = true;

    const el = drag.card.hostElement;
    const rect = el.getBoundingClientRect();

    const freshOffsets = this.config.getFreshOffsets();
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
    const slideEl = this.config.getSlideEl();
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
    const order = this.config.getActivities();

    for (const c of this.config.getCards()) {
      const id = c.activity()?.id;
      if (!id || id === activityId) continue;

      const index = order.findIndex(a => a.id === id);
      const offset = index > fromIndex
        ? ((targetIndex > fromIndex && index <= targetIndex) ? 0 : slotHeight)
        : ((targetIndex < fromIndex && index >= targetIndex) ? slotHeight : 0);

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
    for (const card of this.config.getCards()) {
      const id = card.activity()?.id;
      const prev = id ? cards.get(id) : undefined;
      if (prev !== undefined) card.collapsed.set(prev);
    }
    this.googleMapPanelService.setCollapse(map);
    this.collapseSnapshot = undefined;
  }

  /** Annule proprement un geste en cours (mutation externe de la liste, ou destruction du service) : remet la carte à sa place, sans rien committer au store. */
  private abortDrag(drag: DayDragState): void {
    this.detachDragListeners();
    this.stopDayDragAutoScroll();
    this.lockService.unlock();
    this.dispatchService.clearActiveDayDrag();
    this.unlockActivityListHeight();
    if (this.drag === drag) this.drag = undefined;

    for (const c of this.config.getCards()) {
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
    const el = this.config.getActivityListEl();
    if (!el) return;
    el.style.minHeight = `${el.getBoundingClientRect().height}px`;
  }

  private unlockActivityListHeight(): void {
    const el = this.config.getActivityListEl();
    if (el) el.style.minHeight = '';
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
          this.config.getSlideEl()?.scrollBy(0, delta);
          this.scrollSync.wakeLoop();
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

  ngOnDestroy(): void {
    this.stopDayDragAutoScroll();
    if (this.drag) this.abortDrag(this.drag);
  }
}
