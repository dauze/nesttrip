import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Trip } from '../../trip.model';
import { TripGeneralDesktopComponent } from '../trip-general-desktop/trip-general-desktop.component';
import { DayPanelComponent } from '../trip-day-swiper/day-panel/day-panel.component';
import { TripChromeService } from '@app/core/services/ui/trip-chrome.service';
import { TripDayMapHostService } from '@app/core/services/ui/trip-day-map-host.service';

/**
 * Scrollport DESKTOP UNIQUE (refonte desktop/mobile, option B — voir
 * PLAN-refonte-desktop-mobile.md / ROADMAP.md "UI spécifique Desktop") :
 * remplace entièrement le Swiper en desktop (`!viewport.isMobileChrome()`,
 * gate posée par TripDetailComponent). Le Swiper n'est alors plus monté du
 * tout — fini les deux scrollports `position:fixed` superposés qui se
 * disputaient la molette (la vue Général ne scrollait jamais car les
 * `swiper-slide` full-viewport captaient tout le scroll).
 *
 * Un seul `position:fixed; overflow-y:auto` (`.trip-detail-desktop-root`,
 * marqué `[data-scrollport]` pour que `getScrollContainer` le retrouve hors
 * Swiper) rend, à l'intérieur, en flux normal :
 * - la grille Général 3 colonnes (`TripGeneralDesktopComponent`, réutilisé
 *   tel quel) quand `isGeneralActive()` ;
 * - sinon la vue Jour du jour actif (`DayPanelComponent`, le MÊME composant
 *   que le Swiper mobile — monté ici hors slide, `getSlideEl` retombant sur
 *   ce scrollport via `[data-scrollport]`).
 *
 * Le changement de jour se fait par la barre des jours (TripTabsNavComponent),
 * plus de swipe horizontal (sans objet à la souris).
 *
 * Carte Google Maps partagée : réclamée par `TripSummaryComponent` en vue
 * Général et par `DayPanelComponent` (`.sticky-map`, layout scindé) en vue
 * Jour — jamais les deux à la fois (Général et Jour ne sont jamais rendus
 * simultanément ici). L'instance unique vit dans TripDetailComponent, hôte
 * neutre.
 */
@Component({
  selector: 'app-trip-detail-desktop',
  standalone: true,
  imports: [TripGeneralDesktopComponent, DayPanelComponent],
  templateUrl: './trip-detail-desktop.component.html',
  styleUrl: './trip-detail-desktop.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDetailDesktopComponent {
  protected readonly chromeService = inject(TripChromeService);
  protected readonly mapHost = inject(TripDayMapHostService);

  readonly trip = input.required<Trip>();
  /** Id de l'onglet/jour actif (voir TripDetailComponent.activeDay) — un des 4 ids Général, ou l'ISO d'un jour. */
  readonly activeDay = input.required<string>();
  /** `true` quand `activeDay` est un des 4 tabs Général (voir TripDetailComponent.isGeneralActive). */
  readonly isGeneralActive = input.required<boolean>();

  /**
   * Émis une fois le premier rendu stabilisé — même rôle que
   * `TripDaySwiperComponent.ready` (débloque le skeleton de TripDetailComponent
   * via `onSwiperReady`). Pas de Swiper à attendre ici : un `afterNextRender`
   * suffit à garantir que le contenu desktop est monté.
   */
  readonly ready = output<void>();

  /**
   * `activeDay` est un ISO string ; `DayPanelComponent.dayId` attend un `Date`.
   * Mémoïsé pour ne pas recréer un `Date` (donc re-rendre tout le day-panel) à
   * chaque détection de changement tant que l'id ne bouge pas.
   */
  protected readonly activeDayDate = computed(() =>
    this.isGeneralActive() ? null : new Date(this.activeDay())
  );

  constructor() {
    afterNextRender(() => this.ready.emit());
  }
}
