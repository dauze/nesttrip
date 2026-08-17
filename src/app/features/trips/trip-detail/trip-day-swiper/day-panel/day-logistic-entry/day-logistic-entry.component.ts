import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { DraggedActivityInfo } from '@app/core/services/business/activity-dispatch.service';
import { LOGISTIC_TYPE_META } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/logistics/logistic.constants';
import { FlightStatusBadgeComponent } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/logistics/flight-status-badge/flight-status-badge.component';
import { LogisticDayOccurrence } from '../day-logistic-banner/logistic-day-occurrence';
import { ReorderableDayRow } from '../reorderable-day-row';

/** Clé stable d'une occurrence logistique dans la timeline unifiée (voir ReorderableDayRow) — une réservation peut jouer plusieurs rôles le même jour (ex. Check-in ET Check-out d'un aller-retour). */
export function logisticRowId(occurrence: LogisticDayOccurrence): string {
  return `${occurrence.logistic.id}:${occurrence.role}`;
}

/**
 * Occurrence logistique "frontière" (Check-in/out, Départ/Arrivée...) rendue
 * INLINE dans la timeline fusionnée du jour (voir `day-timeline-merge.ts`,
 * ROADMAP.md "Activités") — reprend le markup carte de
 * `DayLogisticBannerComponent`. Le tap navigue vers l'onglet Logistique pour
 * éditer (écrans de gestion non fusionnés, comportement inchangé).
 *
 * Implémente `ReorderableDayRow` : `DayReorderService` pilote désormais une
 * liste UNIFIÉE activités + logistique (retour utilisateur explicite —
 * "Activité et transport/logement doivent être dans la même pile pour le
 * drag and drop") — la poignée émet `dragHandleDown` exactement comme
 * `ActivityCardComponent`, le VRAI geste (lift, clone qui suit le doigt,
 * voisins qui se décalent) vit entièrement dans `DayReorderService`. Une
 * occurrence logistique n'a structurellement aucune position à persister
 * (toujours recalculée depuis son horaire réel côté Logistique) : son drag
 * retombe donc toujours exactement à sa place (voir
 * `DayReorderService.handleDragPointerUp`, qui ne commit que si l'ordre
 * relatif des activités a réellement changé).
 */
@Component({
  selector: 'app-day-logistic-entry',
  standalone: true,
  imports: [DatePipe, FlightStatusBadgeComponent],
  templateUrl: './day-logistic-entry.component.html',
  styleUrl: './day-logistic-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayLogisticEntryComponent implements ReorderableDayRow {
  private readonly logisticFocusService = inject(LogisticFocusService);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  readonly occurrence = input.required<LogisticDayOccurrence>();
  readonly tripId = input.required<string>();
  readonly typeMeta = LOGISTIC_TYPE_META;

  /** Voir `ActivityCardComponent.dragHandleDown`, même contrat (DayReorderService pilote une liste unifiée). */
  readonly dragHandleDown = output<{ x: number; y: number; pointerId: number; rowId: string }>();

  readonly kind = 'logistic' as const;
  /** Inerte : une occurrence logistique n'a rien à replier — juste un point d'ancrage uniforme pour DayReorderService.restoreCollapseSnapshot. */
  readonly collapsed = signal(false);

  get hostElement(): HTMLElement {
    return this.elRef.nativeElement;
  }

  get rowId(): string {
    return logisticRowId(this.occurrence());
  }

  get logisticId(): string {
    return this.occurrence().logistic.id;
  }

  get role(): string {
    return this.occurrence().role;
  }

  onTap(): void {
    this.logisticFocusService.requestFocus(this.logisticId);
  }

  onHandlePointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    try {
      document.documentElement.setPointerCapture(ev.pointerId);
    } catch {
      // Ignoré : capture refusée par certains navigateurs/anciens Android — voir ActivityCardComponent.updateDragState, même garde.
    }
    this.dragHandleDown.emit({ x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId, rowId: this.rowId });
  }

  // ─── ReorderableDayRow — voir la doc de classe : la géométrie/collapse est pilotée depuis DayReorderService, mêmes mécanismes qu'ActivityCardComponent ───

  collapseInstantly(): void {
    // No-op : rien à replier sur une ligne logistique.
  }

  leaveFlowHidden(): void {
    const style = this.hostElement.style;
    style.position = 'absolute';
    style.visibility = 'hidden';
    style.pointerEvents = 'none';
  }

  rejoinFlow(): void {
    const style = this.hostElement.style;
    style.position = '';
    style.visibility = '';
    style.pointerEvents = '';
  }

  setShiftOffset(px: number): void {
    const style = this.hostElement.style;
    style.transition = 'transform 200ms ease';
    style.transform = px ? `translateY(${px}px)` : '';
  }

  clearShiftOffset(): void {
    const style = this.hostElement.style;
    style.transition = '';
    style.transform = '';
  }

  buildDayDragInfo(): DraggedActivityInfo | null {
    return null; // désactive l'escalade cross-day (ActivityDayDispatchOverlayComponent) — hors scope pour une logistique.
  }
}
