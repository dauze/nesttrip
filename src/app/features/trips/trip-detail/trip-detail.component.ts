import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MenuComponent, AppMenuItem } from '@app/shared/components/menu/menu.component';
import { LOGISTIC_TYPE_META } from './trip-day-swiper/general-panel/logistics/logistic.constants';
import { LogisticType } from '@core/models/logistic.dto';
import { DayLogisticQuickAddService } from './day-logistic-quick-add.service';
import { ActivatedRoute } from '@angular/router';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { Day, Trip } from '../trip.model';
import { TripDetailSkeletonComponent } from './trip-detail-skeleton.component';
import { TripFacade } from '../trip-facade.service';
import { TripHeaderComponent } from './trip-header/trip-header.component';
import { TripCollaboratorsComponent } from './trip-collaborators/trip-collaborators.component';
import { TripTabsNavComponent } from './trip-tabs-nav/trip-tabs-nav.component';
import { TripDaySwiperComponent } from './trip-day-swiper/trip-day-swiper.component';
import { TripTab } from './trip-tab.model';
import { Location } from '@angular/common';
import { ActivityDayDispatchOverlayComponent } from '@app/shared/components/activity-day-dispatch-overlay/activity-day-dispatch-overlay.component';
import { FloatingAddButtonComponent } from '@app/shared/components/floating-add-button/floating-add-button.component';
import { MobileTripNavComponent } from './mobile-trip-nav/mobile-trip-nav.component';
import { SelectionActionBarComponent } from '@app/shared/components/selection-action-bar/selection-action-bar.component';
import { SelectionModeService } from '@app/shared/services/selection-mode.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { TripCreationTargetService } from './trip-creation-target.service';
import { DayActivityFocusService } from './day-activity-focus.service';
import { LogisticFocusService } from './logistic-focus.service';
import { NotesFocusService } from './notes-focus.service';
import { TripItemDeletionService } from './trip-item-deletion.service';

const TRIP_DETAIL_ACTIVE_CLASS = 'trip-detail-active';
/** Ids des 3 tabs de premier niveau Activités/Logistique/Listes (voir `tabs`) — tout le reste de `activeDay()` est un id de jour (ISO). */
const GENERAL_TAB_IDS = ['activities', 'logistics', 'notes'];

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TripDetailSkeletonComponent,
    TripHeaderComponent,
    TripCollaboratorsComponent,
    TripTabsNavComponent,
    TripDaySwiperComponent,
    ActivityDayDispatchOverlayComponent,
    FloatingAddButtonComponent,
    MobileTripNavComponent,
    SelectionActionBarComponent,
    MenuComponent,
  ],
  templateUrl: 'trip-detail.component.html',
  styleUrl: 'trip-detail.component.scss',
  // TripCreationTargetService : partagé entre le swiper de jours (qui
  // enregistre chaque panel actif) et le "+" flottant unique (voir plus bas),
  // tous deux descendants de ce composant dans l'arbre de vues.
  // SelectionModeService/TripItemDeletionService : même topologie, mais pour
  // le mode sélection multiple transverse (voir SelectableDirective) —
  // partagés par le panneau Général (activités/réservations/notes) ET tous
  // les DayPanelComponent du swiper, pour une sélection persistante d'un
  // onglet à l'autre. DayLogisticQuickAddService/NotesFocusService : même
  // topologie, pour le menu "Ajouter" (voir addMenuItems ci-dessous).
  providers: [
    TripCreationTargetService, DayActivityFocusService, LogisticFocusService, NotesFocusService,
    SelectionModeService, TripItemDeletionService, DayLogisticQuickAddService,
  ],
})
export class TripDetailComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(TripFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly location = inject(Location);
  private readonly dispatchService = inject(ActivityDispatchService);
  protected readonly chromeService = inject(TripChromeService);
  protected readonly viewport = inject(ViewportService);
  protected readonly fabTarget = inject(TripCreationTargetService);
  private readonly dayFocusService = inject(DayActivityFocusService);
  private readonly logisticFocusService = inject(LogisticFocusService);
  private readonly notesFocusService = inject(NotesFocusService);
  protected readonly selectionService = inject(SelectionModeService);
  private readonly itemDeletionService = inject(TripItemDeletionService);
  private readonly dayLogisticQuickAdd = inject(DayLogisticQuickAddService);

  private readonly headerRef = viewChild(TripHeaderComponent);
  private readonly headerWrapperRef = viewChild<ElementRef<HTMLElement>>('headerWrapper');
  private readonly tabsNavRef = viewChild(TripTabsNavComponent);
  private readonly dragPortalRef = viewChild<ElementRef<HTMLElement>>('dragPortal');
  private readonly addMenu = viewChild.required<MenuComponent>('addMenu');
  private readonly fabElementRef = viewChild(FloatingAddButtonComponent, { read: ElementRef });

  /**
   * Options du menu "Ajouter", UNIFORME quel que soit l'onglet actif — jour
   * ou l'un des 3 tabs Activités/Logistique/Listes (voir ROADMAP.md "UX /
   * Interactions") : Activité, les 5 types logistiques dans l'ordre de
   * `LOGISTIC_TYPE_META`, puis Liste.
   * - Activité : sur un jour, chemin inchangé (`fabTarget.trigger`) ; sur le
   *   tab Activités, idem (`fabTarget.trigger('activities')`) ; sur
   *   Logistique/Listes, bascule d'abord vers le tab Activités PUIS pose une
   *   demande de création différée (`requestCreateOnMount`, consommée par
   *   `TripActivitiesComponent` une fois monté — même schéma que
   *   NotesFocusService/LogisticFocusService).
   * - Types logistiques : `DayLogisticQuickAddService.create` fonctionne déjà
   *   indépendamment de l'onglet de départ (il crée l'élément puis délègue
   *   toute la navigation croisée à `LogisticFocusService`) — la date du jour
   *   n'est préremplie que si on part effectivement d'un jour.
   * - Liste : `NotesFocusService.requestCreate` (même schéma de navigation
   *   croisée que les types logistiques), atteignable depuis n'importe où.
   */
  protected readonly addMenuItems = computed<AppMenuItem[]>(() => [
    {
      label: 'Activité',
      icon: 'pi pi-map-marker',
      command: () => {
        if (this.activeDay() === 'activities') {
          this.fabTarget.trigger('activities');
          return;
        }
        if (!GENERAL_TAB_IDS.includes(this.activeDay())) {
          this.fabTarget.trigger(this.activeDay());
          return;
        }
        this.fabTarget.requestCreateOnMount('activities');
        const index = this.tabs().findIndex(t => t.id === 'activities');
        this.onTabSelected({ id: 'activities', index });
      },
    },
    ...(Object.entries(LOGISTIC_TYPE_META) as [LogisticType, typeof LOGISTIC_TYPE_META[LogisticType]][]).map(([type, meta]) => ({
      label: meta.label,
      icon: meta.icon,
      command: () => this.dayLogisticQuickAdd.create(type, GENERAL_TAB_IDS.includes(this.activeDay()) ? undefined : new Date(this.activeDay())),
    })),
    { label: 'Liste', icon: 'pi pi-clipboard', command: () => this.notesFocusService.requestCreate() },
  ]);

  readonly activeDay = signal<string>('activities');
  private initializedTripId: string | null = null;
  readonly currentDayIndex = signal(0);

  readonly contentReady = signal(false);
  private readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tripTitle = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    const fromList = this.facade.trips().find(t => t.id === id);
    return fromList?.title ?? this.facade.activeTrip()?.title ?? '';
  });

  readonly sortedDays = computed(() =>
    this.facade.activeTrip()?.days
      ?.slice()
      .sort((a, b) => a.id.getTime() - b.id.getTime()) ?? []
  );

  /**
   * Activités/Logistique/Listes sont désormais 3 tabs/slides de premier
   * niveau (au lieu d'un unique onglet "Général" avec switch interne, voir
   * ROADMAP.md "UX / Interactions") — même ordre qu'avant (ce bloc précède
   * toujours les jours). `id: 'notes'` gardé tel quel en interne pour
   * "Listes" (NotesFocusService, fragment d'URL...) : seul le libellé change.
   */
  readonly tabs = computed<TripTab[]>(() => [
    { id: 'activities', label: 'Activités' },
    { id: 'logistics', label: 'Logistique' },
    { id: 'notes', label: 'Listes' },
    ...this.sortedDays().map(d => this.formatDayTab(d.id)),
  ]);

  /**
   * "+" flottant UNIQUE (voir TripCreationTargetService), icône/libellé
   * génériques désormais quel que soit l'onglet actif : le clic ouvre
   * toujours le même menu "Ajouter" (voir addMenuItems, ROADMAP.md "UX /
   * Interactions") — plus de création directe contextuelle sur l'onglet
   * Général.
   */
  protected readonly fabIcon = 'pi pi-plus';
  protected readonly fabAriaLabel = 'Ajouter';

  /** Ouvre le menu "Ajouter" (Activité/Vol/Logement/Location voiture/Train/Autre/Liste, voir addMenuItems) ancré sur le bouton "+" lui-même — même comportement sur un jour ET sur les tabs Activités/Logistique/Listes. */
  protected onFabActivate(): void {
    const anchor = this.fabElementRef()?.nativeElement;
    if (anchor) this.addMenu().toggleAt(anchor);
  }

  protected onSelectionCancel(): void {
    this.selectionService.cancel();
  }

  protected onSelectionDelete(): void {
    const tripId = this.facade.activeTrip()?.id;
    if (tripId) this.itemDeletionService.confirmDeleteSelected(tripId);
  }

  constructor() {
    afterNextRender(() => {
      const el = this.dragPortalRef()?.nativeElement;
      if (el) this.dispatchService.registerDragPortal(el);
    });

    // Traduit le layout (ViewportService) en mode chrome (voir TripChromeService.ChromeMode) :
    // `isMobileChrome` (portrait OU appareil tactile même en paysage — voir sa
    // doc) -> barre de nav morphing bas d'écran, comportement "mobile"
    // historique ; sinon (vrai desktop, pointeur fin) -> layout scindé, chrome
    // jamais masqué si assez de hauteur, ou rejoint le groupe qui se masque au
    // scroll sinon (fenêtre desktop basse).
    effect(() => {
      if (this.viewport.isMobileChrome()) {
        this.chromeService.setMode('mobile');
      } else {
        this.chromeService.setMode(this.viewport.isChromePinned() ? 'split-pinned' : 'split-hideable');
      }
    });

    // effect() (pas afterNextRender, qui ne s'exécute qu'une seule fois) :
    // #headerWrapper est dans un @if (facade.activeTrip(); as trip) — au tout
    // premier rendu, le trip n'a pas encore fini de charger (Firestore async),
    // donc l'élément n'existe pas encore. Un afterNextRender ici ratait
    // silencieusement l'attache de l'observer pour de bon (headerHeight
    // restait à 0 à vie, empêchant le header de jamais se masquer entièrement,
    // seulement de la hauteur de la toolbar). L'effect se relance quand le
    // signal du viewChild change, donc capte l'élément dès qu'il apparaît.
    effect((onCleanup) => {
      const el = this.headerWrapperRef()?.nativeElement;
      if (!el) return;

      // getBoundingClientRect (pas entry.contentRect, qui exclut le padding
      // vertical de .app-trip-header-fixed) pour mesurer le vrai encombrement.
      const observer = new ResizeObserver(() => {
        this.chromeService.registerHeight('header', el.getBoundingClientRect().height);
      });
      observer.observe(el);

      // Écriture DOM directe du transform (voir TripChromeService) : pas de
      // binding [style.transform] dans le template.
      const unregister = this.chromeService.registerChromeElement(el);

      onCleanup(() => {
        observer.disconnect();
        unregister();
      });
    });

    effect(() => {
      const trip = this.facade.activeTrip();
      const loading = this.facade.activeTripLoading();
      if (!trip || loading) return;
      if (this.initializedTripId === trip.id) return;

      this.initializedTripId = trip.id;

      const dayFromUrl = this.getDayIdFromFragment(this.route.snapshot.fragment);
      const initialDay = dayFromUrl ?? this.getTodayId(trip);
      this.activeDay.set(initialDay);

      const index = this.tabs().findIndex(t => t.id === initialDay);
      if (index >= 0) {
        setTimeout(() => this.tabsNavRef()?.scrollIntoView(index), 100);
      }
    });

    effect(() => {
      const id = this.facade.activeTrip()?.id;
      if (!id) return;

      this.contentReady.set(false);
      this.clearReadyFallback();

      // Filet de sécurité : si le swiper n'a jamais émis `ready` (bug,
      // tab introuvable, event raté) on débloque quand même l'UI après 4s
      // plutôt que de laisser le skeleton tourner indéfiniment.
      this.readyFallbackTimer = setTimeout(() => {
        this.contentReady.set(true);
      }, 4000);
    });

    // Demande de navigation croisée (voir DayActivityFocusService) : un clic
    // sur une date depuis le tab Activités (pool d'activités) bascule ici sur
    // le jour ciblé, exactement comme onTabSelected/onSwiperActiveIdChange.
    // Si le jour ciblé est déjà actif, rien à faire ici : c'est
    // DayPanelComponent qui consomme la requête (et scroll) une fois actif.
    effect(() => {
      const pending = this.dayFocusService.pending();
      if (!pending || this.activeDay() === pending.dayId) return;

      this.activeDay.set(pending.dayId);
      const index = this.tabs().findIndex(t => t.id === pending.dayId);
      if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
      this.updateFragment(pending.dayId);
    });

    // Demande de navigation croisée symétrique (voir LogisticFocusService)
    // : tap sur une bannière de réservation depuis un jour bascule ici sur
    // le tab Logistique — LogisticsListComponent (ouverture du dialog
    // d'édition) consomme ensuite la même requête.
    effect(() => {
      const pending = this.logisticFocusService.pending();
      if (!pending || this.activeDay() === 'logistics') return;

      this.activeDay.set('logistics');
      const index = this.tabs().findIndex(t => t.id === 'logistics');
      if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
      this.updateFragment('logistics');
    });
  }

  ngOnInit(): void {
    this.initializedTripId = null;
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.facade.loadTrip(id);

    // Le scroll de la page est désormais géré slide par slide (voir
    // trip-day-swiper.component.scss) : garde-fou contre tout débordement
    // résiduel qui ferait apparaître un scrollbar body en plus de celui du
    // slide actif. Retiré au démontage (voir ngOnDestroy) — les autres écrans
    // (accueil-trip, new-trip) gardent leur scroll body classique.
    document.documentElement.classList.add(TRIP_DETAIL_ACTIVE_CLASS);
  }

  ngOnDestroy(): void {
    this.facade.unloadTrip();
    this.clearReadyFallback();
    document.documentElement.classList.remove(TRIP_DETAIL_ACTIVE_CLASS);
    this.chromeService.registerHeight('header', 0);
    this.chromeService.reset();
  }

  protected onSwiperReady(): void {
    this.contentReady.set(true);
    this.clearReadyFallback();
  }

  private clearReadyFallback(): void {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
  }

  protected onTitleChange(title: string): void {
    const trip = this.facade.activeTrip();
    if (!trip) return;
    this.facade.updateTripTitle({ ...trip, title });
  }

  protected onCurrencyChange(currency: string): void {
    const trip = this.facade.activeTrip();
    if (!trip) return;
    this.facade.updateTripCurrency(trip.id, currency);
  }

  protected onTabSelected(event: { id: string; index: number }): void {
    this.activeDay.set(event.id);
    this.tabsNavRef()?.scrollIntoView(event.index);
    this.updateFragment(event.id);
  }

  protected onSwiperActiveIdChange(id: string): void {
    this.activeDay.set(id);
    const index = this.tabs().findIndex(t => t.id === id);
    if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
    this.updateFragment(id);
  }

  protected onDatesChange(range: [Date, Date]): void {
    const trip = this.facade.activeTrip();
    if (!trip) return;

    const [start, end] = range;
    const newDays = this.buildDays(start, end, trip.days);
    const toDelete = this.findDaysToDelete(trip.days, newDays);
    const toAdd = this.findDaysToAdd(trip.days, newDays);

    const applyChanges = () => {
      for (const day of toDelete) this.facade.removeDay(trip.id, day.id);
      for (const day of toAdd) this.facade.addDay(trip.id, day);
      this.activeDay.set('activities');
      setTimeout(() => this.tabsNavRef()?.scrollIntoView(0), 100);
    };

    if (toDelete.length > 0) {
      this.confirmDialogService.confirm({
        message: 'Certains jours contiennent des activités et vont être supprimés. Êtes-vous sûr de vouloir continuer ?',
        accept: applyChanges,
        reject: () => this.headerRef()?.resetDates(),
      });
    } else {
      applyChanges();
    }
  }

  private formatDayTab(date: Date): TripTab {
    return {
      id: date.toISOString(),
      label: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date),
      dayNumber: new Intl.DateTimeFormat('fr-FR', { day: 'numeric' }).format(date),
      weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date),
      weekdayFull: new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date),
      month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date),
      monthFull: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(date),
    };
  }

  private getTodayId(trip: Trip): string {
    const today = new Date().toDateString();
    const day = trip.days.find(d => new Date(d.id).toDateString() === today);
    return day ? day.id.toISOString() : 'activities';
  }

  private buildDays(start: Date, end: Date, existingDays: Day[]): Day[] {
    const days: Day[] = [];
    const existingMap = new Map(existingDays.map(day => [day.id.getTime(), day]));

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);

    while (current <= endNorm) {
      const key = current.getTime();
      days.push(existingMap.get(key) ?? { id: new Date(current), activityIds: [] });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private findDaysToAdd(existingDays: Day[], newDays: Day[]): Day[] {
    const existingIds = new Set(existingDays.map(d => d.id.getTime()));
    return newDays.filter(d => !existingIds.has(d.id.getTime()));
  }

  private findDaysToDelete(existingDays: Day[], newDays: Day[]): Day[] {
    const newIds = new Set(newDays.map(d => d.id.getTime()));
    return existingDays.filter(d => !newIds.has(d.id.getTime()));
  }

  /**
   * Généralisé pour couvrir aussi les 3 tabs Activités/Logistique/Listes (pas
   * seulement les jours, `#day-N`) : sans ça, un refresh de page sur
   * Logistique/Listes retombait toujours sur le tab par défaut — régression
   * introduite en dissolvant `GeneralPanelComponent` (qui persistait le
   * sous-onglet via `?tab=`), corrigée en unifiant sur ce même mécanisme de
   * fragment.
   */
  private getDayIdFromFragment(fragment: string | null): string | null {
    if (!fragment) return null;
    if (GENERAL_TAB_IDS.includes(fragment)) return fragment;

    const match = fragment.match(/^day-(\d+)$/);
    if (!match) return null;

    const dayIndex = parseInt(match[1], 10) - 1;
    const day = this.sortedDays()[dayIndex];
    return day ? day.id.toISOString() : null;
  }

  private updateFragment(tabId: string): void {
    const basePath = this.location.path(false);
    if (GENERAL_TAB_IDS.includes(tabId)) {
      this.location.replaceState(`${basePath}#${tabId}`);
      return;
    }
    const dayNumber = this.sortedDays().findIndex(d => d.id.toISOString() === tabId) + 1;
    this.location.replaceState(dayNumber > 0 ? `${basePath}#day-${dayNumber}` : basePath);
  }
}