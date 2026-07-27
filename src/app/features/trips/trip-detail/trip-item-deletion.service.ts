import { Injectable, inject } from '@angular/core';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { SelectionModeService } from '@app/shared/services/selection-mode.service';

/**
 * Exécute la suppression groupée des 4 types d'entités sélectionnables d'un
 * trip (activités de pool, instances de jour, réservations, notes) derrière
 * une seule confirmation — remplace les corbeilles unitaires de
 * ActivityCardComponent/ReservationCardComponent/NotesComponent. Fourni par
 * TripDetailComponent, à côté de la SelectionModeService qu'il consomme.
 */
@Injectable()
export class TripItemDeletionService {
  private readonly tripFacade = inject(TripFacade);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly selectionService = inject(SelectionModeService);

  confirmDeleteSelected(tripId: string): void {
    const items = this.selectionService.values();
    if (items.length === 0) return;

    const plural = items.length > 1 ? 's' : '';
    this.confirmDialogService.confirm({
      message: `Supprimer ${items.length} élément${plural} sélectionné${plural} ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      accept: () => {
        for (const item of items) {
          switch (item.kind) {
            case 'poolActivity':
              this.tripFacade.removePoolActivity(tripId, item.id);
              break;
            case 'dayActivityInstance':
              this.tripFacade.removeDayActivityInstance(tripId, item.id, item.dayId);
              break;
            case 'reservation':
              this.tripFacade.removeReservation(tripId, item.id);
              break;
            case 'noteItem':
              this.tripFacade.removeItem(tripId, item.id);
              break;
          }
        }
        this.selectionService.cancel();
      },
      // reject non fourni : refuser ferme juste la pop-up (ConfirmDialogService),
      // on reste en mode sélection avec la même sélection intacte.
    });
  }
}
