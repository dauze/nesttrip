import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Trip } from '../../trip.model';
import { TripSummaryComponent } from '../trip-day-swiper/general-panel/trip-summary/trip-summary.component';
import { TripActivitiesComponent } from '../trip-day-swiper/general-panel/trip-activities/trip-activities.component';
import { LogisticsListComponent } from '../trip-day-swiper/general-panel/logistics/logistics-list.component';
import { NotesComponent } from '../trip-day-swiper/general-panel/notes/notes.component';
import { TripChromeService } from '@app/core/services/ui/trip-chrome.service';

/**
 * Desktop UNIQUEMENT (voir ViewportService.isMobileChrome, gate posée par
 * TripDetailComponent) : refonte "Général" (ROADMAP.md "UI Desktop") — les 4
 * onglets mobiles Résumé/Activités/Logements & Transports/Listes, montrés un
 * par un via TripDaySwiperComponent, deviennent 3 colonnes simultanées dans
 * ce composant frère du swiper (jamais un descendant — un `swiper-slide`
 * ancêtre a un `transform` permanent qui casserait tout `position:fixed/sticky`
 * interne, même raisonnement que ActivityDayDispatchOverlayComponent).
 *
 * Monté une seule fois et jamais détruit tant que `!isMobileChrome()` (voir
 * `[hidden]` dans trip-detail.component.html, jamais un `@if` séparé pour
 * basculer jour/général) : `TripSummaryComponent` ci-dessous possède la carte
 * Google Maps partagée pendant qu'il est `active` — le détruire pendant qu'il
 * la possède l'orphelinerait (voir sa doc `destroyRef.onDestroy`).
 *
 * Les 4 composants réels sont réutilisés tels quels (jamais réimplémentés),
 * juste rendus avec `[fillWidth]="true"` pour remplir leur colonne de grille
 * au lieu du plafond/centrage de leur usage historique en slide mobile.
 */
@Component({
  selector: 'app-trip-general-desktop',
  standalone: true,
  imports: [TripSummaryComponent, TripActivitiesComponent, LogisticsListComponent, NotesComponent],
  templateUrl: './trip-general-desktop.component.html',
  styleUrl: './trip-general-desktop.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripGeneralDesktopComponent {
  protected readonly chromeService = inject(TripChromeService);

  readonly trip = input.required<Trip>();
  /**
   * Reflète si CE composant est celui actuellement montré (par opposition à
   * un jour, affiché par le swiper caché à côté) — jamais codé en dur à
   * `true` : transmis tel quel à `TripSummaryComponent.active`, dont les
   * effects réactifs (pas seulement au montage) doivent savoir se taire
   * pendant qu'un jour est affiché, sous peine de voler la carte partagée à
   * ce jour dès qu'un signal dont ils dépendent change.
   */
  readonly active = input(false);
}
