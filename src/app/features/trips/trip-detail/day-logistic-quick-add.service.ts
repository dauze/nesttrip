import { Injectable, inject } from '@angular/core';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { LogisticFocusService } from './logistic-focus.service';

/**
 * Création d'un élément logistique depuis le menu "Ajouter" (voir
 * `TripDetailComponent.addMenuItems`, ROADMAP.md — atteignable depuis un jour
 * OU depuis l'onglet Général, `dayDate` absent dans ce 2e cas) — type déjà
 * connu (choisi dans le menu), contrairement à `LogisticsCreationService` qui
 * le redemande en première étape. Crée l'entité puis délègue TOUTE la
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

  /** `dayDate` : jour depuis lequel le menu "Ajouter" a été ouvert (voir ROADMAP.md, "La date de début d'une réservation doit être positionnée soit sur le jour cliqué") — préremplit la date de début, jamais l'heure. */
  create(type: LogisticType, dayDate?: Date): void {
    const tripId = this.tripFacade.activeTrip()?.id;
    if (!tripId) return;

    const logistic: Logistic = {
      id: crypto.randomUUID(),
      type,
      title: '',
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
      ...(dayDate ? { startDateTime: dateOnly(dayDate) } : {}),
    };

    this.tripFacade.createLogistic(tripId, logistic);
    this.logisticFocusService.requestFocus(logistic.id, true);
  }
}

/** Ne garde que le jour calendaire (minuit local) : l'heure ne doit jamais être préremplie (voir ROADMAP.md). */
function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
