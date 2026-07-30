import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { LOGISTIC_TYPE_META } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/logistics/logistic.constants';
import { FlightStatusBadgeComponent } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/logistics/flight-status-badge/flight-status-badge.component';
import { getLogisticDayOccurrences, LogisticDayOccurrence } from './logistic-day-occurrence';

/**
 * Bannière read-only en haut du contenu scrollable d'un jour (voir
 * `day-panel.component.html`) : une carte compacte par réservation qui
 * touche ce jour (hôtel/vol/location/autre), avec le rôle joué CE jour
 * précisément (check-in vs check-out, départ vs arrivée...) — voir
 * `getLogisticDayOccurrences`. Purement passif : toute édition passe par
 * le sous-menu Réservations (voir `LogisticFocusService`), jamais de form
 * ici.
 */
@Component({
  selector: 'app-day-logistic-banner',
  standalone: true,
  imports: [DatePipe, FlightStatusBadgeComponent],
  templateUrl: './day-logistic-banner.component.html',
  styleUrl: './day-logistic-banner.component.scss',
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
export class DayLogisticBannerComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly logisticFocusService = inject(LogisticFocusService);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  readonly typeMeta = LOGISTIC_TYPE_META;

  readonly occurrences = computed<LogisticDayOccurrence[]>(() =>
    this.tripFacade
      .logisticsForDay(this.tripId(), this.dayId())
      .flatMap((r) => getLogisticDayOccurrences(r, this.dayId()))
      .sort((a, b) => a.time.getTime() - b.time.getTime()),
  );

  onTap(logisticId: string): void {
    this.logisticFocusService.requestFocus(logisticId);
  }
}
