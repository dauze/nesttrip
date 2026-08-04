import { WritableSignal } from '@angular/core';
import { DraggedActivityInfo } from '@app/core/services/activity-dispatch.service';

/**
 * Contrat commun implémenté par `ActivityCardComponent` et
 * `DayLogisticEntryComponent` : permet à `DayReorderService` de piloter une
 * liste UNIFIÉE (activités + occurrences logistiques "frontière", voir
 * `day-timeline-merge.ts`) dans le même geste de drag-and-drop — retour
 * utilisateur explicite (ROADMAP.md "Activités") : "Activité et
 * transport/logement doivent être dans la même pile pour le drag and drop".
 *
 * Seules les activités persistent réellement une nouvelle position
 * (`reorderActivities`) : une occurrence logistique n'a structurellement
 * aucune position à enregistrer (toujours recalculée depuis son horaire réel
 * côté Logistique) — voir `DayReorderService.handleDragPointerUp`, qui ne
 * commit que si l'ordre relatif des lignes `kind === 'activity'` a
 * réellement changé, peu importe le type de la ligne saisie.
 */
export interface DraggableDayRow {
  readonly hostElement: HTMLElement;
  readonly rowId: string;
  readonly kind: 'activity' | 'logistic';
  /** `signal(false)` inerte pour une logistique (jamais lu par un template) — juste un point d'ancrage uniforme pour `DayReorderService.restoreCollapseSnapshot`. */
  readonly collapsed: WritableSignal<boolean>;
  /** No-op pour une logistique (rien à replier). */
  collapseInstantly(): void;
  leaveFlowHidden(): void;
  rejoinFlow(): void;
  setShiftOffset(px: number): void;
  clearShiftOffset(): void;
  /** Toujours `null` pour une logistique : désactive l'escalade cross-day (voir ActivityDayDispatchOverlayComponent), hors scope pour ce type de ligne. */
  buildDayDragInfo(): DraggedActivityInfo | null;
}
