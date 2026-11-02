import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
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
 * Général et par `DayPanelComponent` (mode `floating`, calque plein écran
 * `#dayMapLayer` sous le panneau d'activités flottant) en vue Jour — jamais
 * les deux à la fois. L'instance unique vit dans TripDetailComponent, hôte
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
   * Mémoïsé sur `activeDay()` seul (pas sur `isGeneralActive()`) : lu uniquement
   * dans la branche `@else` (jour actif), où `activeDay()` est forcément un ISO
   * valide — recrée un `Date` seulement quand l'id de jour change, pas à chaque
   * bascule Général/Jour.
   */
  protected readonly activeDayDate = computed(() => new Date(this.activeDay()));

  /** Panneau d'activités replié (languette « < ») : volontairement non mémorisé. */
  protected readonly sidebarCollapsed = signal(false);

  private readonly dayMapLayer = viewChild<ElementRef<HTMLElement>>('dayMapLayer');
  private readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');
  /** Bord droit du panneau déplié (px, `offsetLeft + offsetWidth` : insensible au `transform` de repli). */
  private readonly sidebarRight = signal(0);

  constructor() {
    afterNextRender(() => this.ready.emit());

    effect((onCleanup) => {
      const el = this.dayMapLayer()?.nativeElement ?? null;
      this.mapHost.registerDesktopDayContainer(el);
      onCleanup(() => this.mapHost.registerDesktopDayContainer(null));
    });

    effect((onCleanup) => {
      const el = this.sidebar()?.nativeElement;
      if (!el) {
        this.sidebarRight.set(0);
        return;
      }
      const observer = new ResizeObserver(() => this.sidebarRight.set(el.offsetLeft + el.offsetWidth));
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    effect((onCleanup) => {
      this.mapHost.setDesktopMapInsetLeft(this.sidebarCollapsed() ? 0 : this.sidebarRight());
      onCleanup(() => this.mapHost.setDesktopMapInsetLeft(0));
    });
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }
}
