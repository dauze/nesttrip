import { Injectable, computed, signal } from '@angular/core';

/**
 * Phase visuelle du mécanisme de "décrochage" d'une activité pour la
 * déposer sur un autre jour (indépendant du réordonnancement CDK classique
 * à l'intérieur d'un jour, qui reste géré par ailleurs).
 */
export type DispatchVisualPhase = 'idle' | 'lifted' | 'dropping' | 'returning' | 'deescalating';

export interface DraggedActivityInfo {
  tripId: string;
  activityId: string;
  /** undefined si l'activité vient du pool général (pas encore dispatchée). */
  sourceDayId?: Date;
  title: string;
  icon: string;
  color: string;
  photoRef?: string;
  /**
   * 'pool' : décrochage classique (hold) depuis TripActivitiesComponent.
   * 'day' : escalade depuis un cdkDrag de réordonnancement dans un jour
   * (DayPanelComponent) — gouverne le routage retour/désescalade et le
   * masquage du preview CDK natif (voir `dayEscalated`).
   */
  origin: 'pool' | 'day';
}

interface PendingDrop {
  tripId: string;
  activityId: string;
  dayKey: string;
  /** Repris de `DraggedActivityInfo.origin` : gouverne côté store si le drop crée une nouvelle instance (pool) ou déplace l'instance existante (jour). */
  origin: 'pool' | 'day';
}

/** Pulse de fin de "retour aimant" : un token distinct à chaque fois garantit que
 *  l'effet qui l'observe se redéclenche même si c'est deux fois de suite la même activité. */
export interface ReturnPulse {
  activityId: string;
  token: number;
}

/**
 * Coordonne l'état du drag & drop "inter-jours" (voir ActivityCardComponent
 * pour le déclenchement du geste et ActivityDayDispatchOverlayComponent pour
 * son rendu). Ce service ne connaît rien du domaine Trip : il expose de la
 * donnée + du hit-testing, et laisse l'overlay effectuer l'appel réel au
 * TripFacade (qui n'est pas injectable depuis un service `root`, puisqu'il
 * est fourni au niveau du composant `TripsComponent`).
 */
@Injectable({ providedIn: 'root' })
export class ActivityDispatchService {
  // ── Micro-feedback avant même le décrochage (le temps du "hold") ─────────
  readonly pendingActivityId = signal<string | null>(null);

  setPending(activityId: string): void {
    this.pendingActivityId.set(activityId);
  }

  clearPending(): void {
    this.pendingActivityId.set(null);
  }

  // ── Décrochage effectif ───────────────────────────────────────────────────
  readonly phase = signal<DispatchVisualPhase>('idle');
  readonly dragged = signal<DraggedActivityInfo | null>(null);
  readonly originRect = signal<DOMRect | null>(null);
  /**
   * Élément représentatif de la carte au moment du décrochage (le conteneur
   * de carte pour un décrochage pool, le clone qui suit déjà le doigt pour
   * une escalade jour — voir les appelants de `beginLift`) : source du clone
   * DOM que l'overlay insère dans la bulle (voir
   * ActivityDayDispatchOverlayComponent.playFormAnimation) plutôt que de
   * reconstruire à la main l'apparence de l'en-tête d'activité.
   */
  readonly originElement = signal<HTMLElement | null>(null);
  readonly pointer = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly hoveredDayKey = signal<string | null>(null);
  readonly hoveredDayRect = signal<DOMRect | null>(null);

  /** Consommé par l'overlay : demande de dispatch réelle côté store. */
  readonly dropRequested = signal<PendingDrop | null>(null);
  /** Pulse : dernier retour "aimant" terminé (voir ReturnPulse). */
  readonly justReturned = signal<ReturnPulse | null>(null);
  private returnTokenSeq = 0;

  readonly isVisible = computed(() => this.phase() !== 'idle');

  /**
   * Drag de réordonnancement (cdkDrag) en cours dans un jour, avant même
   * toute escalade — enregistré par ActivityCardComponent dès le départ du
   * cdkDrag. Sert uniquement à garder la barre repliée du calendrier
   * visible en permanence pendant ce drag (voir `sheetVisible`) et à armer
   * la détection de survol qui déclenche l'escalade.
   */
  readonly activeDayDrag = signal<DraggedActivityInfo | null>(null);
  /**
   * Élément DOM réel de la carte en cours de cdkDrag dans un jour. Sert à
   * mesurer sa taille ACTUELLE (déjà collapsée, voir DayPanelComponent) au
   * moment de l'escalade — le clone `.cdk-drag-preview` généré par CDK, lui,
   * est figé au moment de son apparition, souvent avant la fin de
   * l'animation de collapse (400ms côté PrimeNG Panel) : le récupérer trop
   * tôt donnait un rect encore "déplié", d'où le saut visuel de la bulle.
   */
  readonly activeDayDragElement = signal<HTMLElement | null>(null);

  /** true une fois la bulle formée pour un geste jour (après escalade, pas pendant le simple reorder). */
  readonly dayEscalated = computed(() => this.phase() !== 'idle' && this.dragged()?.origin === 'day');

  /** Pilote l'affichage de la barre repliée du calendrier (visible dès le début d'un drag dans un jour, pas seulement une fois la bulle formée). */
  readonly sheetVisible = computed(() => this.phase() !== 'idle' || this.activeDayDrag() !== null);

  isDraggedActivity(activityId: string): boolean {
    return this.phase() !== 'idle' && this.dragged()?.activityId === activityId;
  }

  registerActiveDayDrag(info: DraggedActivityInfo, el: HTMLElement): void {
    this.activeDayDrag.set(info);
    this.activeDayDragElement.set(el);
  }

  clearActiveDayDrag(): void {
    this.activeDayDrag.set(null);
    this.activeDayDragElement.set(null);
  }

  // ── DEBUG TEMPORAIRE — À RETIRER une fois le bug tactile diagnostiqué ────
  // HUD textuel affiché par l'overlay (voir son template) : permet de lire
  // la séquence d'événements pointer directement sur l'écran du téléphone,
  // sans passer par un débogueur distant.
  readonly debugLog = signal<string[]>([]);
  private moveCount = 0;

  log(msg: string): void {
    const line = `${(performance.now() % 100000).toFixed(0)}ms ${msg}`;
    this.debugLog.update(list => {
      const next = [...list, line];
      return next.length > 120 ? next.slice(-120) : next;
    });
    console.log('[dispatch-debug]', line);
  }

  clearDebugLog(): void {
    this.debugLog.set([]);
  }

  private readonly onScrollBound = (e: Event) => {
    const target = e.target as HTMLElement | Document;
    const desc = target === document
      ? 'document'
      : `${(target as HTMLElement).tagName}.${(target as HTMLElement).className}`;
    this.log(`⚠ SCROLL event target=${desc}`);
  };

  // ── EVENT TAP : capture ABSOLUMENT tout ce qui se passe sur le doigt ─────
  // Écoute en phase de capture (donc même si un handler ailleurs appelle
  // stopPropagation) TOUS les événements pointer/touch/selection pertinents,
  // sans filtrage — pour voir, dans l'ordre exact, qui reçoit quoi et quand,
  // plutôt que de deviner. Démarré au pointerdown sur une poignée (voir
  // ActivityCardComponent.updateDragState), auto-arrêté après quelques
  // secondes.
  private eventTapHandlers: { type: string; fn: (e: Event) => void }[] = [];
  private eventTapActive = false;
  private eventTapStopTimer?: ReturnType<typeof setTimeout>;

  private describeEvent(e: Event): string {
    const t = e.target as HTMLElement | null;
    const tDesc = t
      ? `${t.nodeName}${t.className ? '.' + String(t.className).trim().replace(/\s+/g, '.') : ''}`
      : 'null';
    let extra = '';
    if (typeof PointerEvent !== 'undefined' && e instanceof PointerEvent) {
      extra = ` pid=${e.pointerId} primary=${e.isPrimary} cancelable=${e.cancelable} `
        + `defaultPrevented=${e.defaultPrevented} x=${e.clientX.toFixed(0)} y=${e.clientY.toFixed(0)}`;
    } else if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
      const touches = Array.from(e.changedTouches)
        .map(pt => `(${pt.identifier}:${pt.clientX.toFixed(0)},${pt.clientY.toFixed(0)})`)
        .join(',');
      extra = ` cancelable=${e.cancelable} defaultPrevented=${e.defaultPrevented} touches=${touches}`;
    }

    // DEBUG : sur touchstart, remonte la chaîne d'ancêtres et logue le
    // touch-action CALCULÉ (résolu par le CSS, pas juste ce qu'on a écrit
    // dans la feuille de style) de chacun — confirme si "none" est vraiment
    // la valeur effective au tout premier contact, ou si un ancêtre
    // réintroduit du scroll autorisé quelque part dans la chaîne.
    if (e.type === 'touchstart' && t) {
      const chain: string[] = [];
      let node: HTMLElement | null = t;
      let depth = 0;
      while (node && depth < 8) {
        const ta = getComputedStyle(node).touchAction;
        const label = `${node.nodeName}${node.className ? '.' + String(node.className).trim().replace(/\s+/g, '.').slice(0, 30) : ''}`;
        chain.push(`${label}=${ta}`);
        node = node.parentElement;
        depth++;
      }
      extra += ` | touchAction chain: ${chain.join(' > ')}`;
    }

    return `${e.type} target=${tDesc}${extra}`;
  }

  startEventTap(): void {
    if (this.eventTapActive) return;
    this.eventTapActive = true;
    this.log('══ EVENT TAP ON ══');

    const types = [
      'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'pointerleave',
      'gotpointercapture', 'lostpointercapture',
      'touchstart', 'touchmove', 'touchend', 'touchcancel',
      'contextmenu', 'dragstart', 'selectionchange', 'scroll',
    ];

    for (const type of types) {
      const fn = (e: Event) => this.log(`⋯ ${this.describeEvent(e)}`);
      document.addEventListener(type, fn, { capture: true, passive: true });
      this.eventTapHandlers.push({ type, fn });
    }

    clearTimeout(this.eventTapStopTimer);
    this.eventTapStopTimer = setTimeout(() => this.stopEventTap(), 10000);
  }

  stopEventTap(): void {
    if (!this.eventTapActive) return;
    this.eventTapActive = false;
    for (const { type, fn } of this.eventTapHandlers) {
      document.removeEventListener(type, fn, { capture: true });
    }
    this.eventTapHandlers = [];
    this.log('══ EVENT TAP OFF ══');
  }
  // ── FIN DEBUG TEMPORAIRE ──────────────────────────────────────────────────

  private dayCells = new Map<string, DOMRect>();
  private readonly onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onPointerUpBound = (e: PointerEvent) => {
    this.log(`pointerup id=${e.pointerId}`);
    this.handlePointerUp();
  };
  private readonly onPointerCancelBound = (e: PointerEvent) => {
    // DEBUG : `pointercancel` ne porte PAS de coordonnées valides (toujours
    // (0,0) per spec) — utiliser e.clientX/Y ici pointait donc TOUJOURS sur
    // le coin (0,0) de l'écran (d'où `.app-toolbar`, qui y est bien réel,
    // mais sans rapport avec le doigt). On utilise la dernière position
    // RÉELLE connue (`this.pointer()`, mise à jour à chaque pointermove).
    const last = this.pointer();
    const el = document.elementFromPoint(last.x, last.y);
    const pe = el ? getComputedStyle(el).pointerEvents : 'n/a';
    this.log(`⚠ POINTERCANCEL id=${e.pointerId} lastPointer=(${last.x.toFixed(0)},${last.y.toFixed(0)}) elementFromPoint=${el?.tagName}.${(el as HTMLElement)?.className} pointerEvents=${pe}`);

    // DEBUG : géométrie réelle de la grille du calendrier de dispatch (elle
    // s'étend pile pendant le lift, voir openSheet) au moment précis du
    // cancel — confirme si sa boîte recouvre VRAIMENT le dernier point connu.
    const grid = document.querySelector('.dispatch-overlay__scroll');
    if (grid) {
      const r = grid.getBoundingClientRect();
      const cs = getComputedStyle(grid);
      this.log(
        `.dispatch-overlay__scroll rect=(${r.left.toFixed(0)},${r.top.toFixed(0)})-(${r.right.toFixed(0)},${r.bottom.toFixed(0)}) `
        + `touchAction=${cs.touchAction} pointerEvents=${cs.pointerEvents}`,
      );
    }
    this.log(`document.documentElement.hasPointerCapture=${document.documentElement.hasPointerCapture(e.pointerId)}`);

    this.handlePointerUp();
  };
  // Le doigt/curseur traverse forcément d'autres cartes (donc d'autres
  // images) pendant le trajet vers un autre jour. Sans ce garde-fou, le
  // navigateur peut interpréter ce survol comme le début d'un drag natif
  // HTML5 sur l'une de ces images, ce qui annule aussitôt notre geste
  // (`pointercancel`) — symptôme observé : la bulle "disparaît" dès qu'on
  // bouge, sans jamais rejouer l'animation de retour.
  private readonly onDragStartBound = (e: DragEvent) => e.preventDefault();
  // Sur mobile, un appui immobile de plus de ~500ms déclenche le menu
  // contextuel natif (callout "Copier"/loupe de sélection) SOUS le doigt —
  // ce qui annule le pointeur actif exactement comme un drag natif.
  // Symptôme observé : la bulle disparaît en silence même sans aucun
  // mouvement, dès qu'on la laisse "posée" après sa formation.
  private readonly onContextMenuBound = (e: Event) => e.preventDefault();

  // ── Ancrages géométriques ────────────────────────────────────────────────
  // Enregistré une fois par TripTabsNavComponent : permet à l'overlay de
  // connaître, à la demande, le rectangle de départ de son animation
  // d'ouverture (la barre d'onglets).
  private navBarEl?: HTMLElement;

  registerNavBarElement(el: HTMLElement): void {
    this.navBarEl = el;
  }

  getNavBarRect(): DOMRect | null {
    return this.navBarEl?.getBoundingClientRect() ?? null;
  }

  /**
   * Élément source pour le clone DOM de la réplique affichée par l'overlay
   * (voir ActivityDayDispatchOverlayComponent.cloneNavBarInto) : le `<p-tabs>`
   * interne, pas `navBarEl` (le host `app-trip-tabs-nav`, qui porte les
   * classes utilitaires de positionnement `fixed bottom-0 left-0 right-0`
   * posées par le parent — les cloner ferait fuir le clone hors de son
   * conteneur `.dispatch-overlay__replica`).
   */
  private navBarCloneSourceEl?: HTMLElement;

  registerNavBarCloneSource(el: HTMLElement): void {
    this.navBarCloneSourceEl = el;
  }

  getNavBarCloneSource(): HTMLElement | null {
    return this.navBarCloneSourceEl ?? null;
  }

  /**
   * Point d'ancrage `position:fixed` hors du swiper de jours (enregistré une
   * fois par TripDetailComponent, en frère de app-activity-day-dispatch-overlay)
   * — voir DayPanelComponent.beginCardFollow : le CLONE qui suit le doigt
   * pendant un réordonnancement intra-jour y est inséré le temps du geste
   * (jamais le vrai nœud de la carte, voir `ActivityCardComponent.leaveFlowHidden`),
   * car un `swiper-slide` ancêtre applique `transform`/`filter`, ce qui
   * créerait un containing block local et casserait tout `position:fixed`
   * posé dessus.
   */
  private dragPortalEl?: HTMLElement;

  registerDragPortal(el: HTMLElement): void {
    this.dragPortalEl = el;
  }

  getDragPortalElement(): HTMLElement | null {
    return this.dragPortalEl ?? null;
  }

  /** Appelé par l'overlay après chaque rendu/scroll de la grille de jours. */
  registerDayCells(cells: Map<string, DOMRect>): void {
    this.dayCells = cells;
  }

  beginLift(
    info: DraggedActivityInfo,
    originRect: DOMRect,
    originElement: HTMLElement | null,
    pointerX: number,
    pointerY: number,
  ): void {
    this.dragged.set(info);
    this.originRect.set(originRect);
    this.originElement.set(originElement);
    this.pointer.set({ x: pointerX, y: pointerY });
    this.hoveredDayKey.set(null);
    this.hoveredDayRect.set(null);
    this.phase.set('lifted');
    this.moveCount = 0;
    this.log(`▶ beginLift origin=${info.origin} start=(${pointerX.toFixed(0)},${pointerY.toFixed(0)})`);

    document.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    document.addEventListener('pointerup', this.onPointerUpBound, { passive: true });
    document.addEventListener('pointercancel', this.onPointerCancelBound, { passive: true });
    document.addEventListener('dragstart', this.onDragStartBound, { capture: true });
    document.addEventListener('contextmenu', this.onContextMenuBound, { capture: true });
    // DEBUG : capture:true remonte tout scroll déclenché sur N'IMPORTE QUEL
    // conteneur descendant pendant le drag — sert à confirmer si un scroll
    // natif se produit réellement, et sur quel élément.
    document.addEventListener('scroll', this.onScrollBound, { capture: true, passive: true });
  }

  /** Appelé par l'overlay une fois l'animation de fin (drop ou retour) terminée. */
  finish(): void {
    const info = this.dragged();
    const wasReturning = this.phase() === 'returning';

    this.phase.set('idle');
    this.dragged.set(null);
    this.originRect.set(null);
    this.originElement.set(null);
    this.hoveredDayKey.set(null);
    this.hoveredDayRect.set(null);
    this.dropRequested.set(null);

    if (wasReturning && info) {
      this.justReturned.set({ activityId: info.activityId, token: ++this.returnTokenSeq });
    }
  }

  /**
   * Désescalade un geste jour toujours en cours (le doigt n'a pas été
   * relâché, c'est un simple éloignement du calendrier) : contrairement à
   * `handlePointerUp`, aucun `pointerup` réel ne va détacher nos listeners,
   * il faut le faire explicitement pour rendre la main à cdkDrag.
   */
  deescalate(): void {
    if (this.phase() !== 'lifted') return;
    this.log(`deescalate() called after move#${this.moveCount} (doigt éloigné du calendrier)`);
    this.detachDocumentListeners();
    this.phase.set('deescalating');
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.phase() !== 'lifted') return;

    this.moveCount++;
    // DEBUG : log les tout premiers moves (fenêtre critique) puis 1/10.
    if (this.moveCount <= 8 || this.moveCount % 10 === 0) {
      this.log(
        `move#${this.moveCount} type=${event.pointerType} cancelable=${event.cancelable} `
        + `defaultPrevented(before)=${event.defaultPrevented} x=${event.clientX.toFixed(0)} y=${event.clientY.toFixed(0)}`,
      );
    }

    // Sur mobile, le thread principal est fortement sollicité pendant toute
    // la formation/le voyage de la bulle (boucles rAF de playFormAnimation/
    // playCollapseFollow/playTravelFollow dans l'overlay) : laisser passer
    // ne serait-ce que les tout premiers pointermove sans preventDefault()
    // laisse une fenêtre où le navigateur peut arbitrer en faveur du scroll
    // natif malgré le `touch-action: none` posé sur la poignée d'origine —
    // même symptôme (et même fix) que DayPanelComponent.handleDragPointerMove,
    // qui doit lui aussi rappeler preventDefault() à CHAQUE mouvement, pas
    // une seule fois au pointerdown. Sans ce fix ici, la bulle "perdait la
    // main" au profit du scroll dès le premier déplacement tactile.
    if (event.cancelable) event.preventDefault();

    this.pointer.set({ x: event.clientX, y: event.clientY });

    let hitKey: string | null = null;
    let hitRect: DOMRect | null = null;
    for (const [key, rect] of this.dayCells) {
      if (
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom
      ) {
        hitKey = key;
        hitRect = rect;
        break;
      }
    }

    if (hitKey !== this.hoveredDayKey()) {
      this.hoveredDayKey.set(hitKey);
      this.hoveredDayRect.set(hitRect);
    }
  }

  private handlePointerUp(): void {
    if (this.phase() !== 'lifted') return;

    this.detachDocumentListeners();

    const info = this.dragged();
    const targetKey = this.hoveredDayKey();
    const targetRect = this.hoveredDayRect();

    this.log(`handlePointerUp after move#${this.moveCount} hoveredDayKey=${targetKey ?? 'null'}`);

    // Drop valide uniquement sur un vrai bouton du calendrier
    if (info && targetKey && targetRect) {
      this.dropRequested.set({
        tripId: info.tripId,
        activityId: info.activityId,
        dayKey: targetKey,
        origin: info.origin,
      });

      this.log('phase -> dropping');
      this.phase.set('dropping');
      return;
    }

    // Sinon retour vers l'origine (pool) ou désescalade sur place (jour) :
    // pour un geste jour, `originRect` est la position du preview cdkDrag au
    // moment de l'escalade, devenue obsolète depuis (le drag a continué en
    // arrière-plan) — y retourner ferait voler la bulle vers un point qui
    // n'a plus de sens.
    const nextPhase = info?.origin === 'day' ? 'deescalating' : 'returning';
    this.log(`phase -> ${nextPhase}`);
    this.phase.set(nextPhase);
  }

  private detachDocumentListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMoveBound);
    document.removeEventListener('pointerup', this.onPointerUpBound);
    document.removeEventListener('pointercancel', this.onPointerCancelBound);
    document.removeEventListener('dragstart', this.onDragStartBound, { capture: true });
    document.removeEventListener('contextmenu', this.onContextMenuBound, { capture: true });
    document.removeEventListener('scroll', this.onScrollBound, { capture: true });
  }
}
