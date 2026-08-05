import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CardComponent } from '@app/shared/components/card/card.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { SelectComponent } from '@app/shared/components/select/select.component';
import { CURRENCY_OPTIONS } from '@app/shared/components/activity-card/activity.constants';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Day } from '@app/features/trips/trip.model';
import { TripHeaderComponent } from '../../../trip-header/trip-header.component';
import { TripCollaboratorsComponent } from '../../../trip-collaborators/trip-collaborators.component';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { GeneralMapCinematicService } from '../trip-activities/general-map-cinematic.service';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { TripTasksTileComponent } from './trip-tasks-tile/trip-tasks-tile.component';
import { ActivityTypeRingsComponent, RingChartEntry } from './activity-type-rings/activity-type-rings.component';
import { ACTIVITY_TYPE_META } from '@app/shared/components/activity-card/activity.constants';
import { LOGISTIC_TYPE_META } from '../logistics/logistic.constants';

/** Top 5 catégories max affichées dans les anneaux (ROADMAP.md "### UI") — au-delà, le reste est simplement ignoré (pas de segment "autres"). */
const MAX_RING_ENTRIES = 5;

/**
 * Onglet "Résumé" (voir ROADMAP.md "UX / Interactions", 2026-08-01) : header
 * voyage (`TripHeaderComponent`, qui ne vit plus QUE dans cet onglet — plus
 * de mécanisme de chrome fixe/caché, voir `TripChromeService` et
 * `TripDetailComponent`, simplifié le jour même) + carte du pool d'activités
 * (reprise telle quelle depuis l'ancien onglet Activités, mêmes mécanismes
 * `TripDayMapHostService`/`GeneralMapCinematicService`, voir leur doc — plus
 * jamais repliable dans ce contexte, `app-panel` en mode `bare`) + tuile
 * Dépenses (devise + somme des prix de toutes les `DayActivityInstance` du
 * trip, TOUTES devises confondues sans conversion — décision actée) + tuile
 * Résumé (nb d'activités/transports/jours).
 */
@Component({
  selector: 'app-trip-summary',
  standalone: true,
  imports: [ReactiveFormsModule, CardComponent, SkeletonComponent, SelectComponent, TripHeaderComponent, TripCollaboratorsComponent, TripTasksTileComponent, ActivityTypeRingsComponent],
  templateUrl: './trip-summary.component.html',
  styleUrl: './trip-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Une instance de GeneralMapCinematicService par montage (détruite/recréée
  // à chaque va-et-vient sur ce tab, voir le `@if (visitedDays().has('summary'))`
  // de TripDaySwiperComponent) — même portée que TripActivitiesComponent avant elle.
  providers: [GeneralMapCinematicService],
})
export class TripSummaryComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  protected readonly tripFacade = inject(TripFacade);
  private readonly mapHost = inject(TripDayMapHostService);
  private readonly mapCinematic = inject(GeneralMapCinematicService);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapContainerRef = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private readonly headerRef = viewChild(TripHeaderComponent);
  private readonly currencySelectRef = viewChild<SelectComponent<string>>('currencySelect');

  readonly tripId = input.required<string>();
  /** Slide "Résumé" active (voir TripDaySwiperComponent) : ce contexte ne possède la carte partagée que dans ce cas — voir TripDayMapHostService. */
  readonly active = input(false);

  /**
   * Lu depuis la liste des trips AVANT `activeTrip()` (Firestore async pas
   * encore résolu au tout premier rendu) — même pattern que l'ancien
   * `TripDetailComponent.tripTitle`, déplacé ici avec le header voyage (voir
   * ROADMAP.md "UX / Interactions", 2026-08-01).
   */
  readonly tripTitle = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return '';
    const fromList = this.tripFacade.trips().find(t => t.id === id);
    return fromList?.title ?? this.tripFacade.getTripTitle(id)();
  });

  /** Carte partagée avec la vue jour/l'ancien onglet Activités, "prêtée" à ce contexte tant qu'il est actif. */
  readonly activeMapComponent = computed(() => (this.active() ? this.mapHost.activeMap() : null));

  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly currencyControl = this.fb.nonNullable.control<string>('EUR');

  /**
   * Toutes les instances placées sur un jour du trip (une activité posée sur 2 jours
   * compte 2 fois — décision actée, cohérent avec la somme des dépenses ci-dessous),
   * avec le jour de placement conservé (nécessaire pour la navigation au clic sur la
   * carte, voir `mapClickSub` dans le constructeur, et pour la tuile Tâches, voir `TripTasksTileComponent`).
   */
  readonly allPlacedActivities = computed(() => {
    const trip = this.tripFacade.activeTrip();
    if (!trip || trip.id !== this.tripId()) return [];
    return trip.days
      .slice()
      .sort((a, b) => a.id.getTime() - b.id.getTime())
      .flatMap(day => this.tripFacade.getDayActivities(day.id)().map(activity => ({ dayId: day.id, activity })));
  });

  /** Somme de tous les montants, devise de chaque activité ignorée (décision actée le 2026-08-01) — affichée avec le symbole de la devise du trip. */
  readonly totalExpense = computed(() =>
    this.allPlacedActivities().reduce((sum, { activity }) => sum + (activity.price?.amount || 0), 0),
  );

  readonly currencySymbol = computed(() => {
    const currency = this.tripFacade.getTripCurrency(this.tripId())();
    return this.currencyOptions.find(o => o.value === currency)?.label.split(' ')[0] ?? '';
  });


  /** Points de la carte, ordonnés chronologiquement (par jour) — voir `allPlacedActivities`. */
  readonly generalMapPoints = computed<DayMapPoint[]>(() =>
    this.allPlacedActivities()
      .filter(({ activity }) => activity.placeId && activity.latitude && activity.longitude)
      .map(({ dayId, activity: a }, i) => ({
        activityId: a.id,
        placeId: a.placeId!,
        name: a.title,
        latitude: a.latitude!,
        longitude: a.longitude!,
        order: i + 1,
        photoRef: a.photoRefs?.[0],
        dayId: dayId.toISOString(),
      })),
  );

  readonly hasMapPoints = computed(() => this.generalMapPoints().length > 0);

  /**
   * Top 5 catégories (types d'activité + transport + logement combinés,
   * ROADMAP.md "### UI") pour les anneaux du Résumé — `share` de chaque
   * catégorie retenue est calculée sur le total GLOBAL (toutes catégories,
   * y compris celles hors top 5), pas seulement la somme du top 5 : chaque
   * anneau reflète ainsi sa vraie part de l'ensemble du voyage, pas une part
   * relative uniquement entre les 5 affichées.
   */
  readonly typeBreakdown = computed<RingChartEntry[]>(() => {
    const counts = new Map<string, { label: string; icon: string; colorVar: string; count: number }>();

    for (const { activity } of this.allPlacedActivities()) {
      const meta = ACTIVITY_TYPE_META[activity.type];
      if (!meta) continue;
      const key = `activity:${activity.type}`;
      const entry = counts.get(key) ?? { label: meta.label, icon: meta.icon, colorVar: meta.colorVar, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }

    for (const logistic of this.tripFacade.getAllLogistics(this.tripId())()) {
      const meta = LOGISTIC_TYPE_META[logistic.type];
      if (!meta) continue;
      const key = `logistic:${logistic.type}`;
      const entry = counts.get(key) ?? { label: meta.label, icon: meta.icon, colorVar: meta.colorVar, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }

    const all = Array.from(counts.values());
    const total = all.reduce((sum, e) => sum + e.count, 0);
    if (total === 0) return [];

    return all
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_RING_ENTRIES)
      .map(e => ({ ...e, share: e.count / total }));
  });

  private mapClickSub?: { unsubscribe: () => void };

  constructor() {
    this.destroyRef.onDestroy(() => this.mapClickSub?.unsubscribe());

    effect(() => {
      this.currencyControl.setValue(this.tripFacade.getTripCurrency(this.tripId())(), { emitEvent: false });
    });

    this.currencyControl.valueChanges.subscribe((currency) => {
      if (currency !== this.tripFacade.getTripCurrency(this.tripId())()) {
        this.tripFacade.updateTripCurrency(this.tripId(), currency);
      }
    });

    // Quand ce contexte devient actif (slide Résumé), on récupère l'instance
    // UNIQUE de la carte et on la déplace physiquement dans notre conteneur —
    // même mécanique que l'ancien TripActivitiesComponent. Pas de dépendance à
    // `generalMapPoints()` ici volontairement : ne doit tourner qu'au
    // (re)montage de cet onglet (voir doc historique du même effect dans
    // TripActivitiesComponent, avant son retrait de là-bas).
    effect(() => {
      if (!this.active()) return;
      const container = this.mapContainerRef()?.nativeElement;
      const map = this.mapHost.activeMap();
      if (!container || !map) return;

      this.mapHost.moveTo(container, 'general');
      this.mapCinematic.attachMap(map);

      // Clic sur une activité de la carte -> navigation vers le bon jour (voir
      // ROADMAP.md "UX / Interactions") : même pattern que
      // `DayScrollSyncService.attachMap` (`map.activitySelected.subscribe`),
      // ré-abonné à chaque (ré)attachement de l'instance de carte partagée.
      // N'affecte pas le comportement existant (clic centre la carte, voir
      // `TripDayMapComponent.onMarkerClick`), qui reste géré en interne.
      this.mapClickSub?.unsubscribe();
      this.mapClickSub = map.activitySelected.subscribe((point) => {
        if (point.dayId) this.dayActivityFocusService.requestFocus(point.dayId, point.activityId);
      });
    });

    // `map.points` synchronisé à chaque changement de `generalMapPoints()` —
    // voir la doc historique de cet effect dans TripActivitiesComponent pour
    // le raisonnement complet (garde `container` incluse dans l'effect, pas
    // seulement sur `moveTo`, pour ne pas rater le tout premier passage).
    effect(() => {
      const map = this.activeMapComponent();
      const container = this.mapContainerRef()?.nativeElement;
      if (!map || !container) return;
      this.mapHost.moveTo(container, 'general');
      map.points.set(this.generalMapPoints());
    });

    this.mapCinematic.connect({
      isActive: () => this.active(),
      // Toujours vrai : la carte n'est plus jamais repliable dans ce contexte
      // (voir ROADMAP.md "UX / Interactions", 2026-08-01, `TripDayMapComponent.collapsed`).
      isExpanded: () => true,
      getPoints: () => this.generalMapPoints(),
      getMapComponent: () => this.activeMapComponent(),
    });

    afterNextRender(() => {
      this.mapCinematic.startListening();
    });
  }

  protected onTitleChange(title: string): void {
    this.tripFacade.updateTripTitle(this.tripId(), title);
  }

  /** Crayon dédié à côté de "Devise :" (ROADMAP.md "Bugs / fixes") : le select lui-même perd son chevron (`no-chevron`, pour rester discret à côté du montant), le crayon redevient donc le seul indice visuel qu'il est éditable. */
  protected openCurrencyPanel(): void {
    this.currencySelectRef()?.openPanel();
  }

  /**
   * Plus de bascule forcée vers un autre onglet après coup (contrairement à
   * l'ancien `TripDetailComponent.onDatesChange`) : l'édition se fait
   * désormais directement depuis Résumé (seul onglet où le header voyage
   * vit encore, voir ROADMAP.md "UX / Interactions", 2026-08-01), donc rien
   * ne justifie plus de quitter cet onglet une fois les jours mis à jour.
   */
  protected onDatesChange(range: [Date, Date]): void {
    const trip = this.tripFacade.activeTrip();
    if (!trip) return;

    const [start, end] = range;
    const newDays = this.buildDays(start, end, trip.days);
    const toDelete = this.findDaysToDelete(trip.days, newDays);
    const toAdd = this.findDaysToAdd(trip.days, newDays);

    const applyChanges = () => {
      for (const day of toDelete) this.tripFacade.removeDay(trip.id, day.id);
      for (const day of toAdd) this.tripFacade.addDay(trip.id, day);
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
}
