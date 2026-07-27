import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
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

  readonly tripId = input.required<string>();

  readonly typeMeta = RESERVATION_TYPE_META;

  readonly reservations = computed(() => this.tripFacade.allReservationsSorted(this.tripId()));

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
