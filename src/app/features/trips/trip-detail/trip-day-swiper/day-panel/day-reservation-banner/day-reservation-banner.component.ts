import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ReservationFocusService } from '@app/features/trips/trip-detail/reservation-focus.service';
import { RESERVATION_TYPE_META } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/reservations/reservation.constants';
import { FlightStatusBadgeComponent } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/reservations/flight-status-badge/flight-status-badge.component';
import { getReservationDayOccurrences, ReservationDayOccurrence } from './reservation-day-occurrence';

/**
 * Bannière read-only en haut du contenu scrollable d'un jour (voir
 * `day-panel.component.html`) : une carte compacte par réservation qui
 * touche ce jour (hôtel/vol/location/autre), avec le rôle joué CE jour
 * précisément (check-in vs check-out, départ vs arrivée...) — voir
 * `getReservationDayOccurrences`. Purement passif : toute édition passe par
 * le sous-menu Réservations (voir `ReservationFocusService`), jamais de form
 * ici.
 */
@Component({
  selector: 'app-day-reservation-banner',
  standalone: true,
  imports: [DatePipe, FlightStatusBadgeComponent],
  templateUrl: './day-reservation-banner.component.html',
  styleUrl: './day-reservation-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Sans réservation ce jour-là, le host doit disparaître ENTIÈREMENT du
    // flux flex (pas juste visuellement à 0px) : `.day-panel-body`/
    // `.day-panel-activities-group` posent un `gap` entre TOUS leurs enfants
    // directs, y compris un enfant vide — laisser le host `display:block`
    // vide ajoutait quand même un `gap` avant l'élément suivant, doublant
    // l'écart (bandeau vide + gap) au lieu d'un seul gap propre.
    '[style.display]': "occurrences().length ? null : 'none'",
  },
})
export class DayReservationBannerComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly reservationFocusService = inject(ReservationFocusService);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  readonly typeMeta = RESERVATION_TYPE_META;

  readonly occurrences = computed<ReservationDayOccurrence[]>(() =>
    this.tripFacade
      .reservationsForDay(this.tripId(), this.dayId())
      .flatMap((r) => getReservationDayOccurrences(r, this.dayId()))
      .sort((a, b) => a.time.getTime() - b.time.getTime()),
  );

  onTap(reservationId: string): void {
    this.reservationFocusService.requestFocus(reservationId);
  }
}
