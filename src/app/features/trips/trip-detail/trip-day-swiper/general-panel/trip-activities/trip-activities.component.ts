import { ChangeDetectionStrategy, Component, ElementRef, ViewContainerRef, afterNextRender, computed, effect, inject, input, signal, viewChild, viewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Day } from '@app/features/trips/trip.model';
import { Activity, PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { extractCityFromAddress } from '@app/shared/utils/extract-city';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { GeneralMapPanelService } from '@app/core/services/general-map-panel.service';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';
import { getScrollContainer } from '@app/shared/utils/scroll-container';
import { TripActivitiesCreationService } from './trip-activities-creation.service';
import { DayScrollSyncService } from '../../day-panel/day-scroll-sync.service';
import { NewActivityDraftComponent } from '../../day-panel/new-activity-draft/new-activity-draft.component';

const UNCATEGORIZED_LABEL = 'À catégoriser';

type SortMode = 'city' | 'chrono';
const SORT_MODES: SortMode[] = ['city', 'chrono'];

/** Une ligne de la vue "Ville" : une ou plusieurs `PoolActivity` partageant le même `placeId` (doublons créés séparément sur des jours différents), affichées comme une seule carte "représentante". */
interface CityRow {
  representative: PoolActivity;
  mergedIds: string[];
}

interface CityGroup {
  city: string;
  rows: CityRow[];
}

interface ChronoDayGroup {
  day: Day;
  activities: Activity[];
}

/** Champs communs à `PoolActivity`/`Activity` nécessaires pour construire un `DayMapPoint` — voir `TripActivitiesComponent.generalMapPoints`. */
interface MapPointSource {
  id: string;
  title: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

function matchesSearch(title: string, address: string | undefined, term: string): boolean {
  if (!term) return true;
  return title.toLowerCase().includes(term) || (address ?? '').toLowerCase().includes(term);
}

@Component({
  selector: 'app-trip-activities',
  standalone: true,
  imports: [
    PanelComponent, SkeletonComponent, MessageComponent, ActivityCardComponent, CardComponent, NewActivityDraftComponent,
    SelectButtonComponent, InputTextDirective, DatePipe, ButtonComponent,
  ],
  templateUrl: './trip-activities.component.html',
  styleUrl: './trip-activities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Une instance de DayScrollSyncService par montage (détruite/recréée à
  // chaque va-et-vient sur le sous-onglet Activités, voir le @switch de
  // GeneralPanelComponent) : même portée que pour un DayPanelComponent.
  providers: [TripActivitiesCreationService, DayScrollSyncService],
})
export class TripActivitiesComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly creationService = inject(TripActivitiesCreationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly mapHost = inject(TripDayMapHostService);
  private readonly generalMapPanelService = inject(GeneralMapPanelService);
  private readonly viewport = inject(ViewportService);
  private readonly chromeService = inject(TripChromeService);
  protected readonly scrollSync = inject(DayScrollSyncService);

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');

  readonly tripId = input.required<string>();
  /** Slide "Général" active ET sous-onglet "Activités" monté (voir GeneralPanelComponent) : ce contexte ne possède la carte partagée que dans ce cas — voir TripDayMapHostService. */
  readonly active = input(false);

  /** Carte partagée avec la vue jour, "prêtée" à ce contexte tant qu'il est actif (même principe que DayPanelComponent.activeMapComponent). */
  readonly activeMapComponent = computed(() => (this.active() ? this.mapHost.activeMap() : null));
  /** État de collapse du placeholder skeleton (avant que la carte réelle ne soit déplacée ici) — état indépendant de la vue jour, voir GeneralMapPanelService. */
  readonly mapCollapsed = this.generalMapPanelService.isCollapsed;

  // Restaure le tri depuis l'URL (?sort=...) au montage — voir onSortModeChange,
  // qui l'y écrit à chaque changement (voir ROADMAP.md).
  readonly sortMode = signal<SortMode>(this.readSortModeFromUrl() ?? 'city');
  readonly searchTerm = signal('');

  readonly sortOptions: SelectButtonOption<SortMode>[] = [
        { label: 'Lieu', value: 'city', icon: 'pi pi-map-marker' },
    { label: 'Chronologie', value: 'chrono', icon: 'pi pi-calendar' },
  ];

  private readonly normalizedSearch = computed(() => this.searchTerm().trim().toLowerCase());

  private readonly allActivities = computed(() => this.tripFacade.getAllPoolActivities(this.tripId())());
  /** Map poolActivityId -> placements (jour + instance), utilisée pour dériver assignation, doublons fusionnés et navigation. */
  private readonly placements = computed(() => this.tripFacade.getActivityPlacements(this.tripId())());

  private readonly filteredActivities = computed(() => {
    const term = this.normalizedSearch();
    if (!term) return this.allActivities();
    return this.allActivities().filter(a => matchesSearch(a.title, a.address, term));
  });

  readonly hasNoActivityAtAll = computed(() => this.allActivities().length === 0);

  /**
   * Points de la carte du pool, dans l'ordre EXACTEMENT rendu par le mode de
   * tri courant (ville ou chronologique) — voir ROADMAP.md "Attention à
   * gérer le cas du scroll avec le filtre ville et le filtre chronologique !".
   * `.id` de chaque source correspond à l'`[activityId]` posé sur la carte
   * correspondante dans le template (poolId en mode Ville — `row.representative`,
   * instanceId en mode Chrono — `activity` de `getDayActivities`), donc au
   * `card.activity()?.id` que DayScrollSyncService utilise déjà pour faire
   * correspondre cartes et points, sans table de correspondance à part.
   */
  readonly generalMapPoints = computed<DayMapPoint[]>(() => {
    const source: MapPointSource[] =
      this.sortMode() === 'city'
        ? this.cityGroups().flatMap(group => group.rows.map(row => row.representative))
        : [...this.unassignedActivities(), ...this.chronoDayGroups().flatMap(group => group.activities)];

    return source
      .filter(a => a.placeId && a.latitude && a.longitude)
      .map((a, i) => ({
        activityId: a.id,
        placeId: a.placeId!,
        name: a.title,
        latitude: a.latitude!,
        longitude: a.longitude!,
        order: i + 1,
      }));
  });

  readonly hasMapPoints = computed(() => this.generalMapPoints().length > 0);

  constructor() {
    this.creationService.connect({
      getCards: () => this.activityCards(),
      getTripId: () => this.tripId(),
      getViewContainerRef: () => this.viewContainerRef,
      getSearchTerm: () => this.searchTerm(),
    });

    effect(() => {
      const map = this.activeMapComponent();
      if (map) map.points.set(this.generalMapPoints());
    });

    // Quand ce contexte devient actif (slide Général + sous-onglet
    // Activités), on récupère l'instance UNIQUE de la carte (partagée avec
    // la vue jour, voir TripDayMapHostService) et on la déplace physiquement
    // dans notre conteneur sticky — même mécanique que DayPanelComponent.
    effect(() => {
      if (!this.active()) return;
      const container = this.stickyMap()?.nativeElement;
      const map = this.mapHost.activeMap();
      if (!container || !map) return;

      this.mapHost.moveTo(container, 'general');
      this.scrollSync.attachMap(map);
    });

    this.scrollSync.connect({
      isActive: () => this.active(),
      getSlideEl: () => this.getSlideEl(),
      getFreshOffsets: () => this.getFreshCardOffsets(),
      getDayMapPoints: () => this.generalMapPoints(),
      getMapComponent: () => this.activeMapComponent(),
      getStickyMapEl: () => this.stickyMap()?.nativeElement ?? null,
      isSplitLayout: () => this.viewport.isSplitLayout(),
      // Contrairement à la vue jour (bouclier = stickyContentTop() seul), le
      // pool a TOUJOURS une bascule Activités/Réservations/Notes sticky
      // au-dessus de la carte en layout scindé (son masquage à elle dépend
      // d'un simple @media 768px, pas du ChromeMode) : il faut donc ajouter
      // sa hauteur au bouclier.
      getPinnedChromeOffset: () => this.chromeService.stickyContentTop() + this.chromeService.generalSubTabSwitchHeight(),
    });

    afterNextRender(() => {
      this.scrollSync.startListening();
    });
  }

  /** Conteneur de scroll isolé de la slide Général : le `swiper-slide` ancêtre (voir shared/utils/scroll-container.ts). */
  private getSlideEl(): HTMLElement | null {
    return getScrollContainer(this.elRef.nativeElement);
  }

  /** Offsets "pseudo-absolus" des cartes actuellement rendues — voir DayPanelComponent.getFreshCardOffsets pour le détail du calcul. */
  private getFreshCardOffsets(): { card: ActivityCardComponent; top: number; height: number }[] {
    const cards = this.activityCards();
    const slideEl = this.getSlideEl();
    const slideTop = slideEl?.getBoundingClientRect().top ?? 0;
    const slideScrollTop = slideEl?.scrollTop ?? 0;

    return cards.map(card => {
      const rect = card.element.getBoundingClientRect();
      return {
        card,
        top: rect.top - slideTop + slideScrollTop,
        height: rect.height,
      };
    });
  }

  /** Point d'entrée pour le bouton "+" flottant, porté par `GeneralPanelComponent` (pas ce composant). */
  triggerCreate(): void {
    this.creationService.startCreation();
  }

  onSortModeChange(mode: SortMode | undefined): void {
    if (!mode) return;
    this.sortMode.set(mode);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: mode },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private readSortModeFromUrl(): SortMode | null {
    const value = this.route.snapshot.queryParamMap.get('sort');
    return SORT_MODES.includes(value as SortMode) ? (value as SortMode) : null;
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  /** Nombre total d'activités visibles compte tenu du mode de tri courant — sert uniquement au message "aucun résultat". */
  readonly matchCount = computed(() =>
    this.sortMode() === 'city'
      ? this.filteredActivities().length
      : this.unassignedActivities().length + this.chronoDayGroups().reduce((sum, g) => sum + g.activities.length, 0)
  );

  // ── Vue "Ville" ──────────────────────────────────────────────────────────

  readonly cityGroups = computed<CityGroup[]>(() => {
    const groups = new Map<string, PoolActivity[]>();

    for (const activity of this.filteredActivities()) {
      const city = activity.placeId ? extractCityFromAddress(activity.address) : null;
      const key = city ?? UNCATEGORIZED_LABEL;
      groups.set(key, [...(groups.get(key) ?? []), activity]);
    }

    const entries = [...groups.entries()].filter(([city]) => city !== UNCATEGORIZED_LABEL);
    entries.sort(([a], [b]) => a.localeCompare(b));

    const uncategorized = groups.get(UNCATEGORIZED_LABEL);
    if (uncategorized?.length) {
      entries.push([UNCATEGORIZED_LABEL, uncategorized]);
    }

    return entries.map(([city, activities]) => ({ city, rows: this.buildRows(activities) }));
  });

  /** Regroupe les activités partageant le même `placeId` (doublons créés séparément) en une seule row "représentante". */
  private buildRows(activities: PoolActivity[]): CityRow[] {
    const rows: CityRow[] = [];
    const rowByPlaceId = new Map<string, CityRow>();

    for (const activity of activities) {
      const placeId = activity.placeId;
      const existing = placeId ? rowByPlaceId.get(placeId) : undefined;
      if (existing) {
        existing.mergedIds.push(activity.id);
        continue;
      }

      const row: CityRow = { representative: activity, mergedIds: [activity.id] };
      rows.push(row);
      if (placeId) rowByPlaceId.set(placeId, row);
    }

    return rows;
  }

  /** Placements combinés de TOUTES les `PoolActivity` fusionnées dans cette row — passé en override à la carte représentante. */
  mergedPlacementsFor(row: CityRow): { dayId: Date; instanceId: string }[] {
    const placements = this.placements();
    return row.mergedIds.flatMap(id => placements.get(id) ?? []);
  }

  // ── Vue "Chronologique" ──────────────────────────────────────────────────

  private readonly sortedDays = computed(() =>
    this.tripFacade.activeTrip()?.days?.slice().sort((a, b) => a.id.getTime() - b.id.getTime()) ?? []
  );

  /** Activités de pool non placées sur aucun jour — jamais fusionnées par placeId ici, contrairement à la vue Ville. */
  readonly unassignedActivities = computed(() =>
    this.filteredActivities().filter(a => (this.placements().get(a.id)?.length ?? 0) === 0)
  );

  readonly chronoDayGroups = computed<ChronoDayGroup[]>(() => {
    const term = this.normalizedSearch();
    const groups = this.sortedDays().map(day => ({
      day,
      activities: this.tripFacade.getDayActivities(day.id)().filter(a => matchesSearch(a.title, a.address, term)),
    }));
    // Sans recherche active : on garde tous les jours (même vides) pour une vraie vue d'ensemble du voyage.
    return term ? groups.filter(g => g.activities.length > 0) : groups;
  });

  onDayHeaderClick(day: Day): void {
    this.dayActivityFocusService.requestFocus(day.id.toISOString());
  }
}
