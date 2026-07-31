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
import { GeneralSubTabBarComponent } from './general-sub-tab-bar/general-sub-tab-bar.component';
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
    GeneralSubTabBarComponent,
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
   * ou Général (voir ROADMAP.md "UX / Interactions", uniformisé le
   * 2026-07-31 : auparavant le "+" de l'onglet Général créait directement
   * l'élément du sous-onglet actif, sans ce menu) : Activité, les 5 types
   * logistiques dans l'ordre de `LOGISTIC_TYPE_META`, puis Note.
   * - Activité : sur un jour, chemin inchangé (`fabTarget.triggerDay`) ; sur
   *   Général, bascule le sous-onglet Activités puis crée une activité de
   *   pool (`GeneralCreationTarget.createActivity`).
   * - Types logistiques : `DayLogisticQuickAddService.create` fonctionne déjà
   *   indépendamment de l'onglet de départ (il crée l'élément puis délègue
   *   toute la navigation croisée à `LogisticFocusService`) — la date du jour
   *   n'est préremplie que si on part effectivement d'un jour.
   * - Note : `NotesFocusService.requestCreate` (même schéma de navigation
   *   croisée que les types logistiques), atteignable depuis n'importe où.
   */
  protected readonly addMenuItems = computed<AppMenuItem[]>(() => [
    {
      label: 'Activité',
      icon: 'pi pi-map-marker',
      command: () => {
        if (this.activeDay() !== 'notes') {
          this.fabTarget.triggerDay(this.activeDay());
          return;
        }
        this.fabTarget.general()?.selectSubTab('activities');
        this.fabTarget.general()?.createActivity();
      },
    },
    ...(Object.entries(LOGISTIC_TYPE_META) as [LogisticType, typeof LOGISTIC_TYPE_META[LogisticType]][]).map(([type, meta]) => ({
      label: meta.label,
      icon: meta.icon,
      command: () => this.dayLogisticQuickAdd.create(type, this.activeDay() !== 'notes' ? new Date(this.activeDay()) : undefined),
    })),
    { label: 'Note', icon: 'pi pi-clipboard', command: () => this.notesFocusService.requestCreate() },
  ]);

  readonly activeDay = signal<string>('notes');
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

  readonly tabs = computed<TripTab[]>(() => [
    { id: 'notes', label: 'Général' },
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

  /** Ouvre le menu "Ajouter" (Activité/Vol/Logement/Location voiture/Train/Autre/Note, voir addMenuItems) ancré sur le bouton "+" lui-même — même comportement sur un jour ET sur l'onglet Général. */
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
    // pas de layout scindé -> comportement mobile historique ; layout scindé
    // + assez de hauteur (desktop) -> chrome jamais masqué ; layout scindé
    // mais viewport bas (mobile paysage) -> la barre des jours (en haut)
    // rejoint le groupe qui se masque au scroll (voir TripTabsNavComponent).
    effect(() => {
      if (!this.viewport.isSplitLayout()) {
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
    // sur une date depuis l'onglet Général (pool d'activités) bascule ici sur
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
    // l'onglet Général — GeneralPanelComponent (sous-onglet) puis
    // LogisticsListComponent (ouverture du dialog d'édition) consomment
    // ensuite la même requête, chacun à son échelle.
    effect(() => {
      const pending = this.logisticFocusService.pending();
      if (!pending || this.activeDay() === 'notes') return;

      this.activeDay.set('notes');
      const index = this.tabs().findIndex(t => t.id === 'notes');
      if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
      this.updateFragment('notes');
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
      this.activeDay.set('notes');
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
    return day ? day.id.toISOString() : 'notes';
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

  private getDayIdFromFragment(fragment: string | null): string | null {
    if (!fragment) return null;

    const match = fragment.match(/^day-(\d+)$/);
    if (!match) return null;

    const dayIndex = parseInt(match[1], 10) - 1;
    const day = this.sortedDays()[dayIndex];
    return day ? day.id.toISOString() : null;
  }

  private updateFragment(dayId: string): void {
    const dayNumber = this.sortedDays().findIndex(d => d.id.toISOString() === dayId) + 1;
    const basePath = this.location.path(false);
    this.location.replaceState(dayNumber > 0 ? `${basePath}#day-${dayNumber}` : basePath);
  }
}