import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
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
import { TagComponent } from '@app/shared/components/tag/tag.component';

/**
 * Carte réservation dépliable — même structure que `ActivityCardComponent`
 * (panel + header éditable + corps + fichiers), sans aucune des mécaniques
 * de drag-and-drop pool/jour (une réservation est une entité plate,
 * indépendante des jours, jamais dispatchée).
 */
@Component({
  selector: 'app-reservation-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass, PanelComponent, DividerComponent, CheckboxComponent,
    ReservationHeaderComponent, ReservationDetailsComponent, ReservationFilesComponent,
    SelectableDirective, LongPressDirective, TagComponent,
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

  /**
   * Catégorisation en cours/future/passée (voir ROADMAP.md, "Administratif") :
   * "passée" grise la carte, "en cours" affiche un tag — le cas par défaut
   * ("future") ne porte aucune marque visuelle particulière.
   */
  readonly timeStatus = computed<'past' | 'current' | 'future'>(() => {
    const reservation = this.reservation();
    if (!reservation) return 'future';
    const now = Date.now();
    if (reservation.endDateTime.getTime() < now) return 'past';
    if (reservation.startDateTime.getTime() <= now) return 'current';
    return 'future';
  });

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
