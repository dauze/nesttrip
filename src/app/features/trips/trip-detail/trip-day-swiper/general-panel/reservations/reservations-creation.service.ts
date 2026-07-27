import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { ReservationCardComponent } from './reservation-card/reservation-card.component';
import { BookingStatus } from '@core/enums/booking.status';
import { Reservation } from '@core/models/reservation.dto';
import { TripFacade } from '@app/features/trips/trip-facade.service';

export interface ReservationsCreationConfig {
  getCards: () => readonly ReservationCardComponent[];
  getTripId: () => string;
}

/**
 * Orchestration du bouton "+" flottant pour les réservations. Contrairement
 * aux activités (dont le titre est souvent un lieu Google), le titre d'une
 * réservation est un texte libre (voir ReservationHeaderComponent) : jamais
 * de recherche Google ni de dialog à la création, ni sur desktop ni sur
 * mobile — `draftActive` affiche `NewReservationDraftComponent` (un simple
 * champ texte focus) dans les deux cas. La création réelle n'est
 * déclenchée qu'une fois du texte saisi (blur/Entrée non vide) ; un blur
 * vide annule sans rien créer. Type par défaut 'other' (le plus générique,
 * ne bloque sur aucun champ obligatoire) — modifiable ensuite dans la carte
 * dépliée.
 *
 * Fourni par `ReservationsListComponent` (pas root).
 */
@Injectable()
export class ReservationsCreationService {
  private readonly tripFacade = inject(TripFacade);
  private readonly injector = inject(Injector);

  private config!: ReservationsCreationConfig;

  readonly draftActive = signal(false);

  connect(config: ReservationsCreationConfig): void {
    this.config = config;
  }

  /** Point d'entrée unique du "+" flottant sur le sous-onglet Réservations. */
  startCreation(): void {
    this.draftActive.set(true);
  }

  /** Câblé sur `(confirmed)` de `NewReservationDraftComponent`. */
  confirmDraft(title: string): void {
    this.draftActive.set(false);
    this.createReservation(title);
  }

  /** Câblé sur `(cancelled)` de `NewReservationDraftComponent` : rien n'a jamais été créé. */
  cancelDraft(): void {
    this.draftActive.set(false);
  }

  private createReservation(title: string): void {
    const id = crypto.randomUUID();
    const now = new Date();

    const reservation: Reservation = {
      id,
      type: 'other',
      title,
      startDateTime: now,
      endDateTime: now,
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
    };

    this.tripFacade.createReservation(this.config.getTripId(), reservation);

    afterNextRender(() => {
      const card = this.config.getCards().find((c) => c.reservationId() === id);
      card?.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, { injector: this.injector });
  }
}
