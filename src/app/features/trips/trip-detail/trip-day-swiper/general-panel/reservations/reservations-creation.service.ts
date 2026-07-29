import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { ReservationCardComponent } from './reservation-card/reservation-card.component';
import { BookingStatus } from '@core/enums/booking.status';
import { Reservation } from '@core/models/reservation.dto';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ViewportService } from '@core/services/viewport.service';

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
  private readonly viewport = inject(ViewportService);

  private config!: ReservationsCreationConfig;

  readonly draftActive = signal(false);

  /**
   * Id de la réservation en cours de création, tant que sa carte n'a pas
   * encore été retrouvée dans `getCards()` — voir la doc équivalente sur
   * `DayActivityCreationService.creatingInstanceId` : un second clic sur "+"
   * pendant cette fenêtre ouvrait un second draft en parallèle du premier
   * au lieu de simplement re-scroller vers la création en cours.
   */
  private readonly creatingId = signal<string | null>(null);

  connect(config: ReservationsCreationConfig): void {
    this.config = config;
  }

  /** Point d'entrée unique du "+" flottant sur le sous-onglet Réservations. */
  startCreation(): void {
    const inProgressId = this.creatingId();
    if (inProgressId) {
      this.config.getCards().find((c) => c.reservationId() === inProgressId)
        ?.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

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

    // Pas de date/heure préremplie (voir ROADMAP.md) : reste vide (`--:--`,
    // champ vide) jusqu'à ce que l'utilisateur la renseigne — même principe
    // que les heures d'une activité.
    const reservation: Reservation = {
      id,
      type: 'other',
      title,
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
    };

    this.tripFacade.createReservation(this.config.getTripId(), reservation);
    this.creatingId.set(id);

    afterNextRender(() => this.focusNewCardWhenReady(id), { injector: this.injector });
  }

  /**
   * Retente sur quelques frames avant d'abandonner silencieusement — même
   * raison que `DayScrollSyncService.focusActivityWhenReady`/
   * `ReservationsListComponent.focusCardWhenReady` : `getCards()`
   * (viewChildren) peut ne pas encore refléter la carte tout juste créée au
   * moment du premier `afterNextRender`, sinon le scroll (et le chaînage
   * guidé) ne se déclenchaient jamais. Libère `creatingId` dès que la carte
   * est trouvée (voir `startCreation`).
   */
  private focusNewCardWhenReady(id: string, attemptsLeft = 15): void {
    const card = this.config.getCards().find((c) => c.reservationId() === id);
    if (!card) {
      if (attemptsLeft <= 0) {
        this.creatingId.set(null);
        return;
      }
      requestAnimationFrame(() => this.focusNewCardWhenReady(id, attemptsLeft - 1));
      return;
    }

    this.creatingId.set(null);
    card.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Chaînage de saisie guidée (Type → Résa → Début → Fin), mobile
    // uniquement — voir ROADMAP.md et ActivityFormComponent.startGuidedEntry
    // pour l'équivalent activité.
    if (this.viewport.isMobile()) card.startGuidedEntry();
  }
}
