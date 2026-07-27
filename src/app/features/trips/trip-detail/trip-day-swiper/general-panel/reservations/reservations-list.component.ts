import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ReservationFocusService } from '@app/features/trips/trip-detail/reservation-focus.service';
import { Reservation } from '@core/models/reservation.dto';
import { RESERVATION_TYPE_META } from './reservation.constants';
import { ReservationFormComponent } from './reservation-form/reservation-form.component';

@Component({
  selector: 'app-reservations-list',
  standalone: true,
  imports: [PanelComponent, MessageComponent, CardComponent, ButtonComponent, DatePipe],
  templateUrl: './reservations-list.component.html',
  styleUrl: './reservations-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsListComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly reservationFocusService = inject(ReservationFocusService);

  readonly tripId = input.required<string>();

  readonly typeMeta = RESERVATION_TYPE_META;

  readonly reservations = computed(() => this.tripFacade.allReservationsSorted(this.tripId()));

  constructor() {
    // Demande de navigation croisée (voir ReservationFocusService) : consomme
    // la requête dès que ce composant est monté (sous-onglet déjà basculé par
    // GeneralPanelComponent) et ouvre le dialog d'édition sur l'item ciblé.
    effect(() => {
      const pending = this.reservationFocusService.pending();
      if (!pending) return;

      const reservation = this.tripFacade.getReservation(pending.reservationId)();
      if (!reservation) return;

      this.reservationFocusService.clear(pending.token);
      this.openForm(reservation);
    });
  }

  /** Point d'entrée pour le bouton "+" flottant, porté par `GeneralPanelComponent` (pas ce composant). */
  triggerCreate(): void {
    this.openForm();
  }

  openForm(reservation?: Reservation): void {
    this.dialogService.open(ReservationFormComponent, {
      data: { tripId: this.tripId(), reservation },
      viewContainerRef: this.viewContainerRef,
    });
  }

  sameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
  }
}
