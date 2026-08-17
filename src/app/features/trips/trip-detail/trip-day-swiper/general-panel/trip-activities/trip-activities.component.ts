import { ChangeDetectionStrategy, Component, DestroyRef, ViewContainerRef, computed, effect, inject, input, signal, viewChildren } from '@angular/core';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PanelComponent } from '@app/shared/components/layout/panel/panel.component';
import { MessageComponent } from '@app/shared/components/feedback/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Day } from '@app/features/trips/trip.model';
import { Activity, PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { extractCityFromAddress } from '@app/shared/utils/extract-city';
import { CardComponent } from '@app/shared/components/layout/card/card.component';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/form-fields/select-button/select-button.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { TripActivitiesCreationService } from './trip-activities-creation.service';
import { NewActivityDraftComponent } from '../../day-panel/new-activity-draft/new-activity-draft.component';
import { FabBottomProximityDirective } from '@app/shared/directives/fab-bottom-proximity.directive';

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

function matchesSearch(title: string, address: string | undefined, term: string): boolean {
  if (!term) return true;
  return title.toLowerCase().includes(term) || (address ?? '').toLowerCase().includes(term);
}

@Component({
  selector: 'app-trip-activities',
  standalone: true,
  imports: [
    PanelComponent, MessageComponent, ActivityCardComponent, CardComponent, NewActivityDraftComponent,
    SelectButtonComponent, InputTextDirective, DatePipe, ButtonComponent, FabBottomProximityDirective,
  ],
  templateUrl: './trip-activities.component.html',
  styleUrl: './trip-activities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TripActivitiesCreationService],
})
export class TripActivitiesComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly creationService = inject(TripActivitiesCreationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly activityCards = viewChildren(ActivityCardComponent);

  readonly tripId = input.required<string>();

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

  constructor() {
    this.creationService.connect({
      getCards: () => this.activityCards(),
      getTripId: () => this.tripId(),
      getViewContainerRef: () => this.viewContainerRef,
      getSearchTerm: () => this.searchTerm(),
      clearSearch: () => this.clearSearch(),
    });

    // "+" flottant (voir TripDetailComponent.addMenuItems, entrée "Activité") : ce
    // tab est un singleton comme un jour, donc un enregistrement one-shot au
    // montage suffit (pas d'effect, pas d'input dont dépendre).
    const unregisterFab = this.fabTarget.register('activities', () => this.triggerCreate());
    this.destroyRef.onDestroy(unregisterFab);

    // Demande de création différée (voir TripCreationTargetService.requestCreateOnMount) :
    // le "+" depuis Logistique/Listes navigue d'abord vers cet onglet, PUIS pose
    // cette demande — consommée ici dès que ce composant est effectivement monté
    // (même schéma que NotesFocusService/LogisticFocusService).
    effect(() => {
      const pending = this.fabTarget.pendingCreate();
      if (!pending || pending.id !== 'activities') return;
      this.fabTarget.clearPendingCreate(pending.token);
      this.triggerCreate();
    });

  }

  /** Point d'entrée pour le bouton "+" flottant (voir TripCreationTargetService/TripDetailComponent.addMenuItems). */
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

  /** Voir `FabBottomProximityDirective`/`TripCreationTargetService.avoidEdge` (ROADMAP.md "UX / Interactions") : évitement de bord du "+" flottant. */
  onFabNearBottomChange(nearBottom: boolean): void {
    this.fabTarget.setAvoidEdge(nearBottom);
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
