import { Injectable, OnDestroy, inject } from '@angular/core';
import { ActivityDispatchService, DraggedActivityInfo } from '@app/core/services/activity-dispatch.service';

const BALL_SIZE = 56;
/** Délai doigt-hors-calendrier avant désescalade d'un geste jour déjà escaladé (voir `checkLeaveSheet`). */
const LEAVE_SHEET_DELAY_MS = 150;
/** Durée de survol continu de la barre repliée avant d'escalader un cdkDrag en cours vers le calendrier de dispatch. */
const DAY_DRAG_ESCALATE_HOVER_MS = 450;

export interface DispatchHoverEscalationConfig {
  getSheetEl: () => HTMLElement | null;
}

/**
 * Escalade (survol prolongé de la barre repliée pendant un cdkDrag intra-jour
 * → décrochage vers le calendrier de dispatch) et désescalade (le doigt
 * s'éloigne du calendrier pendant un geste jour déjà escaladé → retour au
 * drag intra-jour) — extrait de ActivityDayDispatchOverlayComponent.
 *
 * Avant escalade, la barre repliée du calendrier est déjà visible (voir
 * `ActivityDispatchService.sheetVisible`) pendant tout cdkDrag dans un jour :
 * elle sert de cible de survol. Un survol continu de
 * `DAY_DRAG_ESCALATE_HOVER_MS` déclenche l'escalade (bulle + déploiement du
 * calendrier) depuis la position courante du preview cdkDrag, qui reste actif
 * en arrière-plan (juste masqué, voir styles.scss) pour une reprise fluide en
 * cas de désescalade.
 *
 * Fourni par ActivityDayDispatchOverlayComponent (pas root).
 */
@Injectable()
export class DispatchHoverEscalationService implements OnDestroy {
  private readonly dispatchService = inject(ActivityDispatchService);

  private config!: DispatchHoverEscalationConfig;

  private leaveTimer?: ReturnType<typeof setTimeout>;
  private escalateTimer?: ReturnType<typeof setTimeout>;

  connect(config: DispatchHoverEscalationConfig): void {
    this.config = config;
  }

  checkEscalate(pointer: { x: number; y: number }, info: DraggedActivityInfo): void {
    const inside = this.isInsideSheet(pointer);

    if (!inside) {
      this.clearEscalateTimer();
      return;
    }

    if (!this.escalateTimer) {
      this.escalateTimer = setTimeout(() => {
        this.escalateTimer = undefined;
        this.triggerEscalation(info);
      }, DAY_DRAG_ESCALATE_HOVER_MS);
    }
  }

  clearEscalateTimer(): void {
    if (this.escalateTimer) {
      clearTimeout(this.escalateTimer);
      this.escalateTimer = undefined;
    }
  }

  private triggerEscalation(info: DraggedActivityInfo): void {
    const pointer = this.dispatchService.pointer();
    // `activeDayDragElement()` est le clone qui suit le doigt en direct
    // (`position:fixed`, voir DayReorderService.beginCardFollow) — sa
    // géométrie est toujours à jour et déjà à la bonne taille (carte repliée
    // avant même le seuil de déclenchement du drag, voir `collapseInstantly`).
    const sourceEl = this.dispatchService.activeDayDragElement();
    const rect = sourceEl?.getBoundingClientRect()
      ?? new DOMRect(pointer.x - BALL_SIZE / 2, pointer.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
    this.dispatchService.beginLift(info, rect, sourceEl, pointer.x, pointer.y);
  }

  checkLeaveSheet(pointer: { x: number; y: number }): void {
    if (this.isInsideSheet(pointer)) {
      this.clearLeaveTimer();
      return;
    }

    if (!this.leaveTimer) {
      this.leaveTimer = setTimeout(() => {
        this.leaveTimer = undefined;
        this.dispatchService.deescalate();
      }, LEAVE_SHEET_DELAY_MS);
    }
  }

  clearLeaveTimer(): void {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = undefined;
    }
  }

  private isInsideSheet(pointer: { x: number; y: number }): boolean {
    const sheetRect = this.config.getSheetEl()?.getBoundingClientRect();
    return !!sheetRect &&
      pointer.x >= sheetRect.left && pointer.x <= sheetRect.right &&
      pointer.y >= sheetRect.top - 32 && pointer.y <= sheetRect.bottom;
  }

  ngOnDestroy(): void {
    this.clearEscalateTimer();
    this.clearLeaveTimer();
  }
}
