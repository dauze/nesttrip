import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Trip } from '../../trip.model';
import { TripSummaryComponent } from '../trip-day-swiper/general-panel/trip-summary/trip-summary.component';
import { TripActivitiesComponent } from '../trip-day-swiper/general-panel/trip-activities/trip-activities.component';
import { LogisticsListComponent } from '../trip-day-swiper/general-panel/logistics/logistics-list.component';
import { NotesComponent } from '../trip-day-swiper/general-panel/notes/notes.component';

/**
 * Desktop UNIQUEMENT (voir ViewportService.isMobileChrome) : vue "Général"
 * (ROADMAP.md "UI spécifique Desktop") — les 4 onglets mobiles Résumé/
 * Activités/Logements & Transports/Listes, montrés un par un via le Swiper
 * mobile, deviennent 3 colonnes simultanées.
 *
 * Refonte desktop/mobile (option B) : ce composant n'est plus un scrollport
 * `position:fixed` basculé par `[hidden]` à côté du Swiper — il est désormais
 * un simple CONTENU en flux normal rendu DANS le scrollport desktop unique
 * (`TripDetailDesktopComponent`), via un `@if (isGeneralActive())`. Le
 * scrollport parent, et le fait que Général et vue Jour ne sont jamais rendus
 * simultanément, garantissent qu'un seul propriétaire réclame la carte
 * partagée à la fois (ici `TripSummaryComponent` tant qu'`active`).
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
  readonly trip = input.required<Trip>();
  /**
   * Reflète si CE composant est celui actuellement montré (par opposition à
   * la vue Jour) — transmis tel quel à `TripSummaryComponent.active`, dont les
   * effects réactifs doivent savoir se taire quand ce n'est pas le cas, sous
   * peine de voler la carte partagée. Rendu via `@if` dans
   * TripDetailDesktopComponent : vaut donc toujours `true` quand ce composant
   * est effectivement monté, mais gardé en input pour rester explicite.
   */
  readonly active = input(false);
}
