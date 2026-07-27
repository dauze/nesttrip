import { Component, ElementRef, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectableItemRef } from '@app/shared/services/selection-mode.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { BookingStatus } from '@core/enums/booking.status';
import { BOOKING_STATUS_META } from '@app/shared/components/activity-card/activity.constants';
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
    NgClass, PanelComponent, DividerComponent, CheckboxComponent,
    ReservationHeaderComponent, ReservationDetailsComponent, ReservationFilesComponent,
    SelectableDirective, LongPressDirective,
  ],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent {
  private readonly tripFacade = inject(TripFacade);

  private readonly cardContainer = viewChild.required<ElementRef<HTMLElement>>('cardContainer');

  readonly tripId = input.required<string>();
  readonly reservationId = input.required<string>();
  readonly initCollapsed = input.required<boolean>();

  readonly reservation = computed(() => this.tripFacade.getReservation(this.reservationId())());

  readonly collapsed = linkedSignal(() => this.initCollapsed());

  readonly bookingMeta = computed(() => BOOKING_STATUS_META[this.reservation()?.booking?.status ?? BookingStatus.NOT_NEEDED]);

  readonly selectableRef = computed<SelectableItemRef>(() => ({ kind: 'reservation', id: this.reservationId() }));

  get element(): HTMLElement {
    return this.cardContainer().nativeElement;
  }

  onTitleChanged(newTitle: string): void {
    const reservation = this.reservation();
    if (!reservation) return;
    this.tripFacade.updateReservation(this.tripId(), { ...reservation, title: newTitle });
  }
}
