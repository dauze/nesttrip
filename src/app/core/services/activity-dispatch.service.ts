import { Injectable, computed, signal } from '@angular/core';

/**
 * Phase visuelle du mécanisme de "décrochage" d'une activité pour la
 * déposer sur un autre jour (indépendant du réordonnancement CDK classique
 * à l'intérieur d'un jour, qui reste géré par ailleurs).
 */
export type DispatchVisualPhase = 'idle' | 'lifted' | 'dropping' | 'returning';

export interface DraggedActivityInfo {
  tripId: string;
  activityId: string;
  /** undefined si l'activité vient du pool général (pas encore dispatchée). */
  sourceDayId?: Date;
  title: string;
  icon: string;
  color: string;
  photoRef?: string;
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
  private fallbackDayKey: string | null = null;
  private fallbackDayRect: DOMRect | null = null;

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

  isDraggedActivity(activityId: string): boolean {
    return this.phase() !== 'idle' && this.dragged()?.activityId === activityId;
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
  // Enregistrés une fois par TripTabsNavComponent / TripDaySwiperComponent :
  // permettent à l'overlay de connaître, à la demande, le rectangle de départ
  // de son animation d'ouverture (la barre d'onglets) et la zone de dépose de
  // secours quand il se rétracte (la vue du jour actif).
  private navBarEl?: HTMLElement;
  private dayViewEl?: HTMLElement;

  registerNavBarElement(el: HTMLElement): void {
    this.navBarEl = el;
  }

  registerDayViewElement(el: HTMLElement): void {
    this.dayViewEl = el;
  }

  getNavBarRect(): DOMRect | null {
    return this.navBarEl?.getBoundingClientRect() ?? null;
  }

  getDayViewRect(): DOMRect | null {
    return this.dayViewEl?.getBoundingClientRect() ?? null;
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
    this.clearFallbackDropZone();

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
    this.clearFallbackDropZone();

    if (wasReturning && info) {
      this.justReturned.set({ activityId: info.activityId, token: ++this.returnTokenSeq });
    }
  }

  registerFallbackDropZone(dayKey: string, rect: DOMRect): void {
    this.fallbackDayKey = dayKey;
    this.fallbackDayRect = rect;
  }

  clearFallbackDropZone(): void {
    this.fallbackDayKey = null;
    this.fallbackDayRect = null;
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

    // Sinon retour (même si une zone de secours existe)
    this.phase.set('returning');
  }

  private detachDocumentListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMoveBound);
    document.removeEventListener('pointerup', this.onPointerUpBound);
    document.removeEventListener('pointercancel', this.onPointerUpBound);
    document.removeEventListener('dragstart', this.onDragStartBound, { capture: true });
    document.removeEventListener('contextmenu', this.onContextMenuBound, { capture: true });
  }
}
