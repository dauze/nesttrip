import { Component, ElementRef, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ReservationHeaderComponent } from './reservation-header/reservation-header.component';
import { ReservationDetailsComponent } from './reservation-details/reservation-details.component';
import { ReservationFilesComponent } from '../reservation-files/reservation-files.component';

/**
 * Carte réservation dépliable — même structure que `ActivityCardComponent`
 * (panel + header éditable + corps + fichiers), sans aucune des mécaniques
 * de drag-and-drop pool/jour (une réservation est une entité plate,
 * indépendante des jours, jamais dispatchée).
 */
@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [
    PanelComponent, DividerComponent, ButtonComponent,
    ReservationHeaderComponent, ReservationDetailsComponent, ReservationFilesComponent,
  ],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');

  readonly tripId = input.required<string>();
  readonly reservationId = input.required<string>();
  readonly initCollapsed = input.required<boolean>();

  readonly reservation = computed(() => this.tripFacade.getReservation(this.reservationId())());

  readonly collapsed = linkedSignal(() => this.initCollapsed());

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }

  onTitleChanged(newTitle: string): void {
    const reservation = this.reservation();
    if (!reservation) return;
    this.tripFacade.updateReservation(this.tripId(), { ...reservation, title: newTitle });
  }

  confirmDelete(): void {
    this.confirmDialogService.confirm({
      message: 'Supprimer cette réservation ?',
      accept: () => this.tripFacade.removeReservation(this.tripId(), this.reservationId()),
    });
  }
}
