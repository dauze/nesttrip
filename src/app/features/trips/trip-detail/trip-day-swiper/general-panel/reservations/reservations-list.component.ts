import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, input, viewChildren } from '@angular/core';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ReservationFocusService } from '@app/features/trips/trip-detail/reservation-focus.service';
import { ReservationCardComponent } from './reservation-card/reservation-card.component';
import { ReservationsCreationService } from './reservations-creation.service';
import { NewReservationDraftComponent } from './new-reservation-draft/new-reservation-draft.component';

/**
 * Sous-menu "Réservations" : liste de `ReservationCardComponent`, triée
 * automatiquement (voir `TripFacade.allReservationsSorted` — en cours/futures
 * d'abord, passées à la fin, pas de glisser-déposer manuel), mêmes principes
 * que `TripActivitiesComponent` (pool général des activités) — pas de bouton
 * "Ajouter" local, la création passe exclusivement par le "+" flottant unique
 * (voir `GeneralPanelComponent.onFabActivate` -> `triggerCreate()` ci-dessous),
 * jamais de popup : un brouillon inline (`NewReservationDraftComponent`, même
 * mobile que desktop) crée la réservation dès qu'un titre est saisi, puis se
 * referme sur une carte dépliable, éditable en direct.
 */
@Component({
  selector: 'app-reservations-list',
  standalone: true,
  imports: [PanelComponent, MessageComponent, ReservationCardComponent, NewReservationDraftComponent],
  templateUrl: './reservations-list.component.html',
  styleUrl: './reservations-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReservationsCreationService],
})
export class ReservationsListComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly reservationFocusService = inject(ReservationFocusService);
  private readonly injector = inject(Injector);
  protected readonly creationService = inject(ReservationsCreationService);

  private readonly reservationCards = viewChildren(ReservationCardComponent);

  readonly tripId = input.required<string>();

  readonly reservations = computed(() => this.tripFacade.allReservationsSorted(this.tripId()));

  constructor() {
    this.creationService.connect({
      getCards: () => this.reservationCards(),
      getTripId: () => this.tripId(),
    });

    // Demande de navigation croisée (voir ReservationFocusService) : consomme
    // la requête dès que ce composant est monté (sous-onglet déjà basculé par
    // GeneralPanelComponent), déplie la carte ciblée et y scrolle — plus de
    // dialog à ouvrir, la carte est déjà dans la liste.
    effect(() => {
      const pending = this.reservationFocusService.pending();
      if (!pending) return;

      afterNextRender(() => {
        const card = this.reservationCards().find((c) => c.reservationId() === pending.reservationId);
        if (!card) return;

        this.reservationFocusService.clear(pending.token);
        card.collapsed.set(false);
        card.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, { injector: this.injector });
    });
  }

  /** Point d'entrée unique du "+" flottant, porté par `GeneralPanelComponent` (pas ce composant). */
  triggerCreate(): void {
    this.creationService.startCreation();
  }
}
