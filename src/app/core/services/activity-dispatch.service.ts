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

  private dayCells = new Map<string, DOMRect>();
  private readonly onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onPointerUpBound = () => this.handlePointerUp();
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

  beginLift(info: DraggedActivityInfo, originRect: DOMRect, pointerX: number, pointerY: number): void {
    this.dragged.set(info);
    this.originRect.set(originRect);
    this.pointer.set({ x: pointerX, y: pointerY });
    this.hoveredDayKey.set(null);
    this.hoveredDayRect.set(null);
    this.phase.set('lifted');

    document.addEventListener('pointermove', this.onPointerMoveBound, { passive: true });
    document.addEventListener('pointerup', this.onPointerUpBound, { passive: true });
    document.addEventListener('pointercancel', this.onPointerUpBound, { passive: true });
    document.addEventListener('dragstart', this.onDragStartBound, { capture: true });
    document.addEventListener('contextmenu', this.onContextMenuBound, { capture: true });
  }

  /** Appelé par l'overlay une fois l'animation de fin (drop ou retour) terminée. */
  finish(): void {
    const info = this.dragged();
    const wasReturning = this.phase() === 'returning';

    this.phase.set('idle');
    this.dragged.set(null);
    this.originRect.set(null);
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
    this.detachDocumentListeners();
    this.phase.set('deescalating');
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.phase() !== 'lifted') return;
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

    // Drop valide uniquement sur un vrai bouton du calendrier
    if (info && targetKey && targetRect) {
      this.dropRequested.set({
        tripId: info.tripId,
        activityId: info.activityId,
        dayKey: targetKey,
      });

      this.phase.set('dropping');
      return;
    }

    // Sinon retour vers l'origine (pool) ou désescalade sur place (jour) :
    // pour un geste jour, `originRect` est la position du preview cdkDrag au
    // moment de l'escalade, devenue obsolète depuis (le drag a continué en
    // arrière-plan) — y retourner ferait voler la bulle vers un point qui
    // n'a plus de sens.
    this.phase.set(info?.origin === 'day' ? 'deescalating' : 'returning');
  }

  private detachDocumentListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMoveBound);
    document.removeEventListener('pointerup', this.onPointerUpBound);
    document.removeEventListener('pointercancel', this.onPointerUpBound);
    document.removeEventListener('dragstart', this.onDragStartBound, { capture: true });
    document.removeEventListener('contextmenu', this.onContextMenuBound, { capture: true });
  }
}
