import { Injectable, inject } from '@angular/core';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { LogisticFocusService } from './logistic-focus.service';

/**
 * Création d'un élément logistique depuis le menu "Ajouter" (voir
 * `TripDetailComponent.addMenuItems`, ROADMAP.md — atteignable depuis un jour
 * OU depuis l'un des 3 tabs Activités/Logistique/Listes, `dayDate` absent
 * dans ce 2e cas) — type déjà connu (choisi dans le menu), contrairement à
 * `LogisticsCreationService` qui le redemande en première étape. Crée
 * l'entité puis délègue TOUTE la navigation croisée (bascule vers le tab
 * Logistique, dépli/scroll de la carte) à `LogisticFocusService`, déjà câblé
 * pour ça côté `TripDetailComponent`/`LogisticsListComponent` —
 * `startGuided: true` y déclenche en plus la cinématique guidée (sans
 * réétape "Type") une fois la carte trouvée, qui ramène ensuite sur
 * `dayDate` une fois terminée (voir `originDayId`, ROADMAP.md "UX /
 * Interactions").
 */
@Injectable()
export class DayLogisticQuickAddService {
  private readonly tripFacade = inject(TripFacade);
  private readonly logisticFocusService = inject(LogisticFocusService);

  /**
   * `dayDate` : jour depuis lequel le menu "Ajouter" a été ouvert (voir
   * ROADMAP.md, "La date de début d'une réservation doit être positionnée
   * soit sur le jour cliqué") — préremplit la date de début, jamais l'heure,
   * et sert aussi de jour de retour une fois la cinématique guidée terminée.
   * `initialTitle` : recherche en cours sur le tab Logistique au moment du
   * "+" (voir `LogisticsListComponent`, ROADMAP.md "UX / Interactions",
   * "préremplissage/vidage") — vide dans le cas du menu "Ajouter" d'un jour,
   * qui n'a pas de champ recherche.
   */
  create(type: LogisticType, dayDate?: Date, initialTitle = ''): void {
    const tripId = this.tripFacade.activeTrip()?.id;
    if (!tripId) return;

    const logistic: Logistic = {
      id: crypto.randomUUID(),
      type,
      title: initialTitle,
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
      ...(dayDate ? { startDateTime: dateOnly(dayDate) } : {}),
    };

    this.tripFacade.createLogistic(tripId, logistic);
    this.logisticFocusService.requestFocus(logistic.id, true, dayDate?.toISOString());
  }
}

/** Ne garde que le jour calendaire (minuit local) : l'heure ne doit jamais être préremplie (voir ROADMAP.md). */
function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
