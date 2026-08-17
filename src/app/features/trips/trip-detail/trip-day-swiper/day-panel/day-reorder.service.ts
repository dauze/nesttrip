import { ChangeDetectorRef, Injectable, OnDestroy, inject } from '@angular/core';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { SwiperLockService } from '@app/core/services/ui/swiper-lock.service';
import { GoogleMapPanelService } from '@app/core/services/ui/google-map-panel.service';
import { ActivityDispatchService } from '@app/core/services/business/activity-dispatch.service';
import { DayScrollSyncService } from './day-scroll-sync.service';
import { ReorderableDayRow } from './reorderable-day-row';

interface CardOffset { card: ReorderableDayRow; top: number; height: number }

/** État d'un réordonnancement manuel en cours dans un jour — voir DayReorderService.onDragHandleDown. */
interface DayDragState {
  readonly pointerId: number;
  readonly card: ReorderableDayRow;
  readonly rowId: string;
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
  /**
   * Offsets (id, top document-relatif, hauteur RÉELLE) de toutes les cartes,
   * figés une seule fois au franchissement du seuil — les voisines ne
   * bougent pas dans le DOM pendant le drag, seul leur décalage visuel
   * change. La hauteur est conservée PAR CARTE (pas de grille uniforme) :
   * une occurrence logistique est nettement plus basse qu'une carte
   * d'activité — voir `updateTargetIndex` (hit-test par point milieu réel de
   * chaque carte, pas par division d'une hauteur de slot fixe).
   */
  offsets: { id: string; top: number; height: number }[];
  /**
   * Distance (px) dont TOUT le reste de la liste se décale quand CETTE carte
   * quitte/rejoint le flux — hauteur réelle de la carte draguée + l'écart
   * (`gap` flex) qui la sépare de sa voisine suivante, mesurés une seule
   * fois au franchissement du seuil. Ne dépend QUE de la carte saisie
   * (jamais des voisines, qui peuvent avoir une hauteur différente) — voir
   * `applySiblingOffsets`.
   */
  collapseDelta: number;
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
  /** Liste UNIFIÉE activités + occurrences logistiques "frontière" (voir ReorderableDayRow), dans l'ordre visuel — les échos ne sont jamais inclus (jamais draguables). */
  getCards: () => readonly ReorderableDayRow[];
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
 * Pilote une liste UNIFIÉE de lignes (activités + occurrences logistiques
 * "frontière", voir `ReorderableDayRow` — retour utilisateur explicite,
 * ROADMAP.md "Activités" : "Activité et transport/logement doivent être dans
 * la même pile pour le drag and drop"). Seules les activités persistent
 * réellement une nouvelle position (`reorderActivities`) : `handleDragPointerUp`
 * ne commit que si l'ordre relatif des lignes `kind === 'activity'` a
 * RÉELLEMENT changé, peu importe le type de la ligne saisie — glisser une
 * logistique, ou une activité qui n'a croisé que des logistiques, ne change
 * jamais cet ordre et retombe donc toujours exactement à sa place (voir la
 * comparaison avant/après dans `handleDragPointerUp`).
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
   * pointerdown sur la poignée d'une carte (voir
   * `ActivityCardComponent`/`DayLogisticEntryComponent`.`dragHandleDown`).
   * Collapse toutes les cartes immédiatement (comme avant), puis attend un
   * léger seuil de mouvement avant de sortir réellement la carte du flux —
   * voir `handleDragPointerMove`/`beginCardFollow`.
   */
  onDragHandleDown(ev: { x: number; y: number; pointerId: number; rowId: string }): void {
    if (this.drag) return; // un seul geste de reorder actif à la fois

    const cards = this.config.getCards();
    const card = cards.find(c => c.rowId === ev.rowId);
    const fromIndex = cards.findIndex(c => c.rowId === ev.rowId);
    if (!card || fromIndex === -1) return;

    // Mesuré AVANT le collapse : voir la doc de `grabOffsetX/Y` sur DayDragState.
    const preCollapseRect = card.hostElement.getBoundingClientRect();
    const grabOffsetX = ev.x - preCollapseRect.left;
    const grabOffsetY = ev.y - preCollapseRect.top;

    this.lockService.lock();

    const collapseState = new Map<string, boolean>();
    for (const c of cards) collapseState.set(c.rowId, c.collapsed());
    this.collapseSnapshot = { cards: collapseState, map: this.googleMapPanelService.isCollapsed() };

    // collapseInstantly (pas juste collapsed.set(true)) : sur un drag rapide,
    // la géométrie doit déjà refléter l'état replié dès la frame suivante,
    // avant que le moindre mouvement ne soit interprété (voir sa doc).
    for (const c of cards) c.collapseInstantly();
    this.googleMapPanelService.setCollapse(true);

    this.drag = {
      pointerId: ev.pointerId,
      card,
      rowId: ev.rowId,
      fromIndex,
      targetIndex: fromIndex,
      thresholdCrossed: false,
      startClientX: ev.x,
      startClientY: ev.y,
      grabOffsetX,
      grabOffsetY,
      offsets: [],
      collapseDelta: 0,
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
    if (this.config.getCards().findIndex(c => c.rowId === drag.rowId) === -1) {
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
      if (c.rowId !== drag.rowId) c.clearShiftOffset();
    }

    // Ne commit (persistance store) QUE si l'ordre relatif des ACTIVITÉS
    // entre elles a réellement changé — peu importe le type de la ligne
    // saisie (voir la doc de classe). Glisser une logistique, ou une
    // activité qui n'a croisé que des logistiques sans jamais dépasser une
    // autre activité, laisse cette comparaison identique : aucun appel
    // store, `settleCard` anime simplement le retour à la position
    // d'origine (la liste sous-jacente n'a jamais bougé).
    let committed = false;
    if (drag.targetIndex !== drag.fromIndex) {
      const cards = this.config.getCards();
      const activityIdsBefore = cards.filter(c => c.kind === 'activity').map(c => c.rowId);

      const reorderedCards = [...cards];
      const [moved] = reorderedCards.splice(drag.fromIndex, 1);
      reorderedCards.splice(drag.targetIndex, 0, moved);
      const activityIdsAfter = reorderedCards.filter(c => c.kind === 'activity').map(c => c.rowId);

      const changed = activityIdsAfter.length !== activityIdsBefore.length
        || activityIdsAfter.some((id, i) => id !== activityIdsBefore[i]);

      if (changed) {
        this.tripFacade.reorderActivities(this.config.getTripId(), this.config.getDayId(), activityIdsAfter);
        // Flush synchrone : @for a le vrai nœud de la carte (jamais déplacé
        // hors de sa place, voir `beginCardFollow`) dans son nouveau slot AVANT
        // la mesure "after" de `settleCard`.
        this.config.notifyRenderFlush();
        committed = true;
      }
    }

    this.settleCard(drag);
    this.restoreCollapseSnapshot();
    queueMicrotask(() => this.scrollSync.wakeLoop());

    // Scroll jusqu'à la carte déplacée à sa nouvelle position (voir
    // ROADMAP.md, "il faut scroller sur l'activité drop en tête") : seulement
    // si un ordre a réellement été persisté (sinon rien n'a bougé), et après
    // deux rAF pour laisser le re-dépli déclenché par `restoreCollapseSnapshot()`
    // (cartes remises à leur état pré-drag, souvent dépliées) se peindre —
    // sans cette attente, `focusActivity` mesurerait encore la géométrie
    // "toutes cartes repliées" du drag, pas la position finale réelle.
    if (committed) {
      const movedId = drag.rowId;
      requestAnimationFrame(() => requestAnimationFrame(() => this.scrollSync.focusActivity(movedId)));
    }
  };

  /** Sort réellement la carte du flux (sur place, voir `leaveFlowHidden`) et fait apparaître un clone SOUS LE DOIGT (voir `grabOffsetX/Y`, pas sa position mesurée après collapse) hors du swiper (voir ActivityDispatchService.registerDragPortal), puis fige les offsets des voisines pour le hit-test. */
  private beginCardFollow(drag: DayDragState): void {
    drag.thresholdCrossed = true;

    const el = drag.card.hostElement;
    const rect = el.getBoundingClientRect();

    const freshOffsets = this.config.getFreshOffsets();
    drag.offsets = freshOffsets.map(o => ({ id: o.card.rowId, top: o.top, height: o.height }));

    // Écart (gap) flex entre deux cartes consécutives — supposé uniforme sur
    // toute la liste (le conteneur pose un seul `gap-*`, voir
    // day-panel.component.html), donc mesurable sur N'IMPORTE QUELLE paire
    // adjacente : on prend la première. `collapseDelta` = hauteur RÉELLE de
    // la carte draguée (jamais une hauteur générique — voir sa doc) + ce gap.
    const gap = freshOffsets.length > 1
      ? freshOffsets[1].top - freshOffsets[0].top - freshOffsets[0].height
      : 0;
    const draggedHeight = freshOffsets.find(o => o.card.rowId === drag.rowId)?.height ?? rect.height;
    drag.collapseDelta = draggedHeight + gap;

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

  /**
   * Recalcule l'index de dépose par hit-test contre les offsets figés au
   * franchissement du seuil, et ne réapplique le décalage visuel des
   * voisines que si l'index a changé.
   *
   * Compare le pointeur au POINT MILIEU RÉEL de chaque carte VOISINE (jamais
   * une grille à hauteur uniforme — une occurrence logistique est nettement
   * plus basse qu'une carte d'activité, voir la doc de `DayDragState.offsets`) :
   * `targetIndex` compte combien de voisines ont leur milieu déjà franchi
   * par le pointeur, ce qui correspond exactement à l'index d'insertion
   * "retirer puis réinsérer" utilisé par `handleDragPointerUp`/`applySiblingOffsets`.
   */
  private updateTargetIndex(drag: DayDragState, event: PointerEvent): void {
    if (!drag.offsets.length) return;

    // Même repère pseudo-absolu que getFreshCardOffsets() (relatif au slide isolé, pas au document).
    const slideEl = this.config.getSlideEl();
    const slideTop = slideEl?.getBoundingClientRect().top ?? 0;
    const slideScrollTop = slideEl?.scrollTop ?? 0;
    const docY = event.clientY - slideTop + slideScrollTop;

    const siblings = drag.offsets.filter(o => o.id !== drag.rowId);
    let targetIndex = 0;
    for (const o of siblings) {
      if (docY < o.top + o.height / 2) break;
      targetIndex++;
    }
    targetIndex = Math.max(0, Math.min(siblings.length, targetIndex));

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
   * index d'origine remonte donc déjà, tout seul, de `collapseDelta` (la
   * hauteur RÉELLE de la carte draguée + le gap, jamais une hauteur générique
   * — voir sa doc, une occurrence logistique est plus basse qu'une carte
   * d'activité) en layout pur (aucun transform requis pour ça). Ce calcul
   * doit composer avec ce remous automatique plutôt que l'ignorer :
   * - pour une carte après `fromIndex` ET dans la zone active du drag (jusqu'à
   *   `targetIndex` en descendant), ce remous automatique EST exactement le
   *   décalage recherché → décalage manuel nul.
   * - pour une carte après `fromIndex` mais HORS de cette zone, il faut au
   *   contraire ANNULER ce remous (+collapseDelta) pour qu'elle reste à sa place.
   * - pour une carte avant `fromIndex`, aucun remous automatique n'existe :
   *   le décalage (si besoin, en remontant la carte) est entièrement manuel.
   */
  private applySiblingOffsets(drag: DayDragState): void {
    const { fromIndex, targetIndex, collapseDelta, rowId } = drag;
    const cards = this.config.getCards();

    cards.forEach((c, index) => {
      if (c.rowId === rowId) return;

      const offset = index > fromIndex
        ? ((targetIndex > fromIndex && index <= targetIndex) ? 0 : collapseDelta)
        : ((targetIndex < fromIndex && index >= targetIndex) ? collapseDelta : 0);

      c.setShiftOffset(offset);
    });
  }

  /**
   * Animation de "pose" jouée une seule fois au relâchement (pas à chaque
   * swap) : mesure la position écran du CLONE (encore `position:fixed`, suit
   * le doigt), le retire, fait réapparaître le vrai nœud dans le flux (voir
   * `rejoinFlow`), puis anime son delta vers 0 — même technique FLIP que
   * `runTabFlip` dans ActivityDayDispatchOverlayComponent. Pour une ligne
   * logistique (jamais persistée, voir la doc de classe), la liste sous-jacente
   * n'a jamais bougé : ce FLIP anime donc simplement le retour à la position
   * d'origine, exactement le "rebond" attendu.
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
      const prev = cards.get(card.rowId);
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
      if (c.rowId !== drag.rowId) c.clearShiftOffset();
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
