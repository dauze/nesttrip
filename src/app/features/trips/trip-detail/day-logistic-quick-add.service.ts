import { Injectable, inject } from '@angular/core';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { LogisticFocusService } from './logistic-focus.service';

/**
 * Création d'un élément logistique depuis le menu "Ajouter" d'un jour (voir
 * `TripDetailComponent.dayAddMenuItems`, ROADMAP.md) — type déjà connu
 * (choisi dans le menu), contrairement à `LogisticsCreationService` qui le
 * redemande en première étape. Crée l'entité puis délègue TOUTE la
 * navigation croisée (bascule vers l'onglet Général, sous-onglet Logistique,
 * dépli/scroll de la carte) à `LogisticFocusService`, déjà câblé pour ça côté
 * `TripDetailComponent`/`GeneralPanelComponent`/`LogisticsListComponent` —
 * `startGuided: true` y déclenche en plus la cinématique guidée (sans
 * réétape "Type") une fois la carte trouvée.
 */
@Injectable()
export class DayLogisticQuickAddService {
  private readonly tripFacade = inject(TripFacade);
  private readonly logisticFocusService = inject(LogisticFocusService);

  create(type: LogisticType): void {
    const tripId = this.tripFacade.activeTrip()?.id;
    if (!tripId) return;

    const logistic: Logistic = {
      id: crypto.randomUUID(),
      type,
      title: '',
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
    };

    this.tripFacade.createLogistic(tripId, logistic);
    this.logisticFocusService.requestFocus(logistic.id, true);
  }
}
