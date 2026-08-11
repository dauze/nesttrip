import { computed, effect, Injectable, Signal, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Trip, Day, TripMember, TripSummary, TravelTiers, DEFAULT_TRAVEL_TIERS } from './trip.model';
import { TravelMode } from './trip-detail/trip-day-swiper/day-panel/day-distance-gap/travel-mode.util';
import { Activity, ActivityEcho, DayActivityEntry, PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { resolveEndDayOffset } from '@app/shared/components/activity-card/activity-time.util';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { FlightLogistic, FlightStatus, Logistic } from '@core/models/logistic.dto';
import { ActivityPersistenceService } from '@app/core/infra/firebase/services/persistence/activity-persistence.service';
import { DayActivityInstancePersistenceService } from '@app/core/infra/firebase/services/persistence/day-activity-instance-persistence.service';
import { DayActivitiesPersistenceService } from '@app/core/infra/firebase/services/persistence/day-activities-persistence.service';
import { LogisticPersistenceService } from '@app/core/infra/firebase/services/persistence/logistic-persistence.service';
import { ExpensePersistenceService } from '@app/core/infra/firebase/services/persistence/expense-persistence.service';
import { Expense } from '@core/models/expense.dto';
import { TripPersistenceService } from '@app/core/infra/firebase/services/persistence/trip-persistence';
import { DayPersistenceService } from '@app/core/infra/firebase/services/persistence/day-persistence.service';
import { Item } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { NotesPersistenceService } from '@app/core/infra/firebase/services/persistence/notes-persistence.service';
import { CollaborationService } from '@app/core/services/collaboration.service';
import { insertChronologically } from './day-activity-order.util';
import { suggestedCurrencyForCountry } from '@app/core/utils/country-currency.util';
import { CurrencyConversionService } from '@app/core/services/currency-conversion.service';
import { Observable, filter, map, of, take, tap } from 'rxjs';

type TripEntities = Record<string, Trip>;
type DayEntities = Record<string, Day>;
type PoolActivityEntities = Record<string, PoolActivity>;
type DayActivityInstanceEntities = Record<string, DayActivityInstance>;
type LogisticEntities = Record<string, Logistic>;
type ExpenseEntities = Record<string, Expense>;
type MemberEntities = Record<string, Record<string, TripMember>>; // tripId -> Record<uid, Member>

/** Trie les voyages du dashboard "à venir d'abord" (ROADMAP.md "UX / Interactions") : voyages pas encore terminés (actifs ou futurs) triés par date de début croissante (le plus proche du jour en tête), puis voyages déjà terminés triés du plus récent au plus ancien. */
function sortTripsByProximity(list: TripSummary[]): TripSummary[] {
  const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = dateOnly(new Date());
  const isPast = (trip: TripSummary) => !!trip.latestDay && dateOnly(trip.latestDay) < today;

  return [...list].sort((a, b) => {
    const pastA = isPast(a);
    const pastB = isPast(b);
    if (pastA !== pastB) return pastA ? 1 : -1;
    if (!pastA) return (a.earliestDay?.getTime() ?? Infinity) - (b.earliestDay?.getTime() ?? Infinity);
    return (b.latestDay?.getTime() ?? 0) - (a.latestDay?.getTime() ?? 0);
  });
}

/** Form par défaut d'une nouvelle instance jour (activité neuve ou pool fraîchement dispatché) — `currency` reprend la devise par défaut du trip (voir ROADMAP.md "Devise"), EUR à défaut. */
function defaultInstanceForm(currency = 'EUR'): Omit<DayActivityInstance, 'id' | 'activityId'> {
  return {
    type: ActivityType.ACTIVITE,
    duration: 0,
    price: { amount: 0, currency },
    booking: { status: BookingStatus.NOT_NEEDED },
    notes: '',
  };
}

@Injectable({ providedIn: 'root' })
export class TripStore {
  private readonly activityPersistenceService = inject(ActivityPersistenceService);
  private readonly dayActivityInstancePersistenceService = inject(DayActivityInstancePersistenceService);
  private readonly dayActivitiesPersistenceService = inject(DayActivitiesPersistenceService);
  private readonly logisticPersistenceService = inject(LogisticPersistenceService);
  private readonly expensePersistenceService = inject(ExpensePersistenceService);
  private readonly currencyConversionService = inject(CurrencyConversionService);
  private readonly notesPersistenceService = inject(NotesPersistenceService);
  private readonly tripPersistenceService = inject(TripPersistenceService);
  private readonly dayPersistenceService = inject(DayPersistenceService);
  private readonly collaborationService = inject(CollaborationService);

  constructor() {
    // Dès que les DEUX writers débouncés (pool + instances) n'ont plus rien
    // en cours (tout le lot en attente a été flush + confirmé par Firestore),
    // on relâche le verrou anti-écrasement : un futur snapshot distant peut
    // de nouveau mettre à jour ces activités/instances (édition par un
    // collaborateur, etc.). Les deux writers partagent le même
    // `_pendingActivityIds` (poolId ET instanceId) : attendre que les DEUX
    // soient idle évite de relâcher trop tôt la protection d'une instance
    // encore en cours d'écriture pendant que le pool, lui, est déjà à jour.
    effect(() => {
      if (!this.activityPersistenceService.syncing() && !this.dayActivityInstancePersistenceService.syncing()) {
        this._pendingActivityIds.set(new Set());
      }
    });

    // Même mécanisme anti-flicker que les activités, pour les réservations
    // (un seul writer débouncé ici, contrairement au couple pool/instances).
    effect(() => {
      if (!this.logisticPersistenceService.syncing()) {
        this._pendingLogisticIds.set(new Set());
      }
    });

    // Même mécanisme anti-flicker, pour les dépenses libres (writer débouncé indépendant).
    effect(() => {
      if (!this.expensePersistenceService.syncing()) {
        this._pendingExpenseIds.set(new Set());
      }
    });
  }

  /**
   * État agrégé de sauvegarde, tous writers débouncés confondus — consommé
   * par SaveStatusBarComponent (indicateur discret, voir ROADMAP.md/CLAUDE.md
   * "UX/Interactions"). 'error' prime sur 'saving' : un échec doit rester
   * visible même si un autre writer termine son flush au même instant.
   */
  readonly saveStatus = computed<'idle' | 'saving' | 'error'>(() => {
    const writers = [
      this.activityPersistenceService,
      this.dayActivityInstancePersistenceService,
      this.dayActivitiesPersistenceService,
      this.logisticPersistenceService,
      this.expensePersistenceService,
      this.notesPersistenceService,
    ];
    if (writers.some((w) => w.hasError())) return 'error';
    if (writers.some((w) => w.syncing())) return 'saving';
    return 'idle';
  });

  // ── État normalisé ────────────────────────────────────────────────────────

  /** @internal — écrit uniquement par TripLoaderService */
  readonly _trips = signal<TripEntities>({});
  /** @internal */
  readonly _days = signal<DayEntities>({});
  /** @internal — pool plat de TOUTES les activités (légères : identité + fichiers) connues, quel que soit le trip */
  readonly _poolActivities = signal<PoolActivityEntities>({});
  /** @internal — TOUTES les instances (form) connues, quel que soit le trip — une même activité de pool peut avoir plusieurs instances (une par jour où elle est placée) */
  readonly _dayActivityInstances = signal<DayActivityInstanceEntities>({});
  /** @internal */
  readonly _tripDays = signal<Record<string, string[]>>({});
  /** @internal — instance ids référencés par un jour donné, dans l'ordre */
  readonly _dayActivityIds = signal<Record<string, string[]>>({});
  /** @internal — TOUTES les activités de pool appartenant à un trip (placées sur un/plusieurs jours, ou aucun) */
  readonly _tripActivities = signal<Record<string, string[]>>({});
  /** @internal */
  readonly _tripMembers = signal<MemberEntities>({});
  /**
   * @internal — ids d'activités dont l'édition locale n'a pas encore été
   * confirmée par Firestore (write debouncée pas encore flush + confirmée).
   * Tant qu'un id est dans ce set, un snapshot distant ne doit PAS écraser
   * sa valeur locale (sinon l'UI optimiste "revient en arrière" pendant la
   * fenêtre de debounce à chaque édition).
   */
  readonly _pendingActivityIds = signal<Set<string>>(new Set());
  /** @internal — pool plat de TOUTES les réservations (hôtel/vol/location/autre) connues, quel que soit le trip */
  readonly _logistics = signal<LogisticEntities>({});
  /** @internal — TOUTES les réservations d'un trip, sans ordre particulier (voir `allLogisticsSorted` côté façade pour l'ordre chronologique) */
  readonly _tripLogistics = signal<Record<string, string[]>>({});
  /**
   * @internal — même rôle que `_pendingActivityIds`, pour les réservations
   * (writer débouncé indépendant, voir `LogisticPersistenceService`).
   */
  readonly _pendingLogisticIds = signal<Set<string>>(new Set());
  /** @internal — pool plat de TOUTES les dépenses libres (non rattachées à une activité/logement/transport, voir src/specs/devise.md 3.4) connues, quel que soit le trip */
  readonly _expenses = signal<ExpenseEntities>({});
  /** @internal — TOUTES les dépenses libres d'un trip, sans ordre particulier */
  readonly _tripExpenses = signal<Record<string, string[]>>({});
  /** @internal — même rôle que `_pendingLogisticIds`, pour les dépenses libres (writer débouncé indépendant, voir `ExpensePersistenceService`). */
  readonly _pendingExpenseIds = signal<Set<string>>(new Set());
  /** @internal */
  readonly _notesItems = signal<Record<string, Item>>({});
  /** @internal */
  readonly _tripNotesItems = signal<Record<string, string[]>>({});
  /** @internal */
 readonly _tripsResult = signal<TripSummary[] | undefined>(undefined);
  /**
   * @internal — titre par trip, séparé de `_trips` : la modifier ne doit PAS
   * faire recalculer `activeTrip` (lu par énormément de composants, y compris
   * le skeleton de chargement) juste pour un changement de titre — voir
   * ROADMAP.md, "la modification du nom du trip ne doit pas rafraichir toute
   * la page", et `getTripTitle`.
   */
  readonly _tripTitle = signal<Record<string, string>>({});
  /**
   * @internal — paliers de mode de trajet (distance + mode par palier) par
   * trip, séparés de `_trips` pour la même raison que `_tripTitle`
   * ci-dessus : la modifier ne doit pas faire recalculer `activeTrip()` —
   * voir `getTripTravelTiers`.
   */
  readonly _tripTravelTiers = signal<Record<string, TravelTiers>>({});
  /**
   * @internal — overrides manuels de mode de trajet par trip (clé = paire de
   * lieux, voir `buildPlacePairKey`), séparés de `_trips` pour la même raison
   * que `_tripTitle` ci-dessus — voir `getTravelModeOverrides`.
   */
  readonly _tripTravelModeOverrides = signal<Record<string, Record<string, TravelMode>>>({});
  /**
   * @internal — mêmes id de trip que `_tripTitle` avec une écriture
   * Firestore encore en vol (ROADMAP.md "Bugs / fixes", régression confirmée
   * par retour utilisateur : "toute la page se réactualise" à chaque édition
   * du titre). Tant qu'un tripId est dans ce set,
   * `TripFacade.mergeFromRemote` ignore ENTIÈREMENT le titre/les seuils de
   * trajet de ce trip (même logique que `_pendingActivityIds`) :
   * sans ça, le snapshot de
   * CONFIRMATION qui suit systématiquement l'écriture voyait `_trips[tripId]`
   * (jamais mis à jour par `updateTripTitle`, seul `_tripTitle` l'est,
   * exprès — voir sa doc) comme "différent" du titre fraîchement confirmé,
   * donc TOUJOURS "changé" à chaque édition, même quand rien n'a réellement
   * bougé côté distant — ce qui redonnait une nouvelle référence à
   * `activeTrip()` (et tout ce qui en dépend) à chaque frappe. Une fois
   * l'écriture confirmée (retirée de ce set), un snapshot qui diffère
   * réellement de la valeur effective courante (`_tripTitle[tripId] ??
   * _trips[tripId].title`) met à jour `_trips` ET efface `_tripTitle[tripId]`
   * (voir `mergeFromRemote`) : c'est ce qui permet à un renommage fait par un
   * AUTRE collaborateur de s'appliquer en direct plutôt que de rester masqué
   * indéfiniment par mon propre renommage passé.
   */
  readonly _pendingTripFieldIds = signal<Set<string>>(new Set());
  /**
   * @internal — tripIds avec au moins un `addDay`/`removeDay` encore en vol
   * (ROADMAP.md "Bugs / fixes", régression confirmée par retour utilisateur :
   * "la modification des dates lance toujours le rechargement"). Modifier
   * l'intervalle de dates déclenche PLUSIEURS `addDay`/`removeDay` d'un coup
   * (un par jour ajouté/retiré), chacun une écriture Firestore ponctuelle
   * SÉPARÉE — sans protection, un snapshot de confirmation intermédiaire
   * (reflétant SEULEMENT une partie des jours déjà écrits côté serveur, les
   * autres écritures n'ayant pas encore atterri) semblait "différent" de
   * l'état local optimiste (qui, lui, a déjà TOUS les jours) : `_days`/
   * `_tripDays` étaient alors réécrits À CHAQUE écriture individuelle
   * confirmée, retriggant `activeTrip()` plusieurs fois de suite pour UNE
   * seule action utilisateur. Compteur (pas un simple Set) car plusieurs
   * `addDay`/`removeDay` peuvent être en vol simultanément pour le MÊME trip
   * — tant que le compteur n'est pas retombé à 0, `TripFacade.mergeFromRemote`
   * ignore ENTIÈREMENT le bloc `_days`/`_tripDays` de ce trip (même principe
   * que `_pendingTripFieldIds` ci-dessus).
   */
  readonly _pendingTripDayIds = signal<Set<string>>(new Set());
  private readonly pendingTripDayCounts = new Map<string, number>();
  // ── UI state ──────────────────────────────────────────────────────────────
  readonly _activeTripId = signal<string | null>(null);
  readonly activeTripLoading = signal<boolean>(false);
  private readonly membersByTrip = new Map<string, Signal<Record<string, TripMember>>>();
  // ── Liste des trips (dashboard) ───────────────────────────────────────────
 
  readonly trips = computed(() => sortTripsByProximity(this._tripsResult() ?? []));
  readonly tripsLoading = computed(() => this._tripsResult() === undefined);    

  // ── Sélecteur — trip actif reconstitué ───────────────────────────────────
  readonly activeTrip = computed(() => {
    const id = this._activeTripId();
    if (!id) return null;

    const trip = this._trips()[id];
    if (!trip) return null;

    const dayKeys = this._tripDays()[id] ?? [];
    const daysMap = this._days();

    return {
      ...trip,
      days: dayKeys
        .map(key => daysMap[key])
        .filter((day): day is Day => !!day),
      // Placeholder non-réactif : le pool d'activités n'est pas consommé via
      // `trip.activities` mais via le sélecteur dédié `getAllPoolActivities(tripId)`.
      // Le lire ici rendrait `activeTrip` (et tout ce qui en dépend, dont le
      // skeleton de chargement) réactif à CHAQUE édition d'activité.
      activities: [],
      dayActivityInstances: [],
      // Même raison : les réservations se consomment via `getAllLogistics(tripId)`.
      logistics: [],
      // Même raison : les dépenses libres se consomment via `getAllExpenses(tripId)`.
      expenses: [],
    };
  });

  setActiveTrip(id: string): void {
    this._activeTripId.set(id);
  }

  clearActiveTrip(): void {
    this._activeTripId.set(null);
  }

  hasTrip(id: string): boolean {
    return id in this._trips();
  }

  // ── Sélecteurs memorisés par entité ───────────────────────────────────────

  /**
   * Égalité structurelle (JSON), utilisée comme `equal` de plusieurs
   * `computed()` ci-dessous — CRITIQUE pour l'UI optimiste (ROADMAP.md "Bugs
   * / fixes", régression confirmée par retour utilisateur : "toute la page
   * se réactualise à chaque édition de champ"). Ces sélecteurs COMPOSENT un
   * résultat (`composeInstanceView`/`composePoolView`, objets/tableaux
   * neufs à chaque exécution) à partir de signaux LARGES et PLATS
   * (`_dayActivityInstances`/`_poolActivities`/..., tous jours/toutes
   * activités confondus, voir "état normalisé" dans CLAUDE.md) : éditer
   * N'IMPORTE QUELLE activité fait changer la RÉFÉRENCE de ces signaux
   * source, donc réexécute TOUS les `computed()` qui en dépendent — y
   * compris ceux d'un jour/d'une activité totalement étrangers à l'édition
   * en cours. Sans `equal`, Angular compare le résultat recalculé par
   * IDENTITÉ (`Object.is`) : un tableau/objet neuf mais structurellement
   * IDENTIQUE au précédent est quand même vu comme "changé", donc republié à
   * tous les composants qui le consomment (chaque `ActivityCardComponent`
   * affiché, pas seulement celui réellement édité). Avec `equal`, le
   * `computed()` continue de se réexécuter (coût CPU minime, pas de fuite
   * mémoire), mais ne notifie ses propres consommateurs QUE si le résultat a
   * RÉELLEMENT changé — la stabilité de référence se propage donc bien
   * jusqu'au template, contrairement à une simple préservation de référence
   * en amont (dans `_dayActivityInstances`/`_poolActivities` eux-mêmes, déjà
   * faite dans `TripFacade.mergeFromRemote`), qui ne suffit pas dès qu'un
   * `computed()` intermédiaire retransforme la donnée.
   */
  private structurallyEqual<T>(a: T, b: T): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /** Compose la vue `Activity` consommée par l'UI à partir d'une instance jour et de l'activité de pool qu'elle référence. */
  private composeInstanceView(instance: DayActivityInstance, pool: PoolActivity | undefined): Activity {
    return {
      id: instance.id,
      activityId: instance.activityId,
      title: pool?.title ?? '',
      files: pool?.files ?? [],
      placeId: pool?.placeId,
      address: pool?.address,
      latitude: pool?.latitude,
      longitude: pool?.longitude,
      photoRefs: pool?.photoRefs ?? [],
      type: instance.type,
      duration: instance.duration,
      startTime: instance.startTime,
      endTime: instance.endTime,
      endDayOffset: instance.endDayOffset,
      price: instance.price,
      booking: instance.booking,
      notes: instance.notes,
      source: pool?.source,
    };
  }

  /**
   * Compose la vue `Activity` "légère" d'une activité de pool (contexte général, sans form affiché).
   * Le form n'est pas édité ici, mais le type/résa/etc. affichés (icône, couleur de résa...) doivent
   * refléter une instance existante plutôt qu'un form par défaut figé, sinon un changement de type/résa
   * fait depuis un jour n'apparaît jamais dans la vue générale. S'il y a plusieurs instances (activité
   * placée sur plusieurs jours), on prend la première trouvée à défaut de valeur canonique unique.
   */
  private composePoolView(pool: PoolActivity, instance?: DayActivityInstance): Activity {
    return {
      id: pool.id,
      activityId: pool.id,
      title: pool.title,
      files: pool.files,
      placeId: pool.placeId,
      address: pool.address,
      latitude: pool.latitude,
      longitude: pool.longitude,
      photoRefs: pool.photoRefs,
      source: pool.source,
      ...(instance
        ? {
            type: instance.type,
            duration: instance.duration,
            startTime: instance.startTime,
            endTime: instance.endTime,
            price: instance.price,
            booking: instance.booking,
            notes: instance.notes,
          }
        : defaultInstanceForm()),
    };
  }

  private readonly dayActivitiesByDay = new Map<string, Signal<Activity[]>>();
  private readonly dayActivityViewById = new Map<string, Signal<Activity>>();
  private readonly poolActivityById = new Map<string, Signal<PoolActivity>>();
  private readonly poolActivityViewById = new Map<string, Signal<Activity>>();
  private readonly allPoolActivitiesByTrip = new Map<string, Signal<PoolActivity[]>>();
  private readonly tripTravelTiersByTrip = new Map<string, Signal<TravelTiers>>();
  private readonly tripTravelModeOverridesByTrip = new Map<string, Signal<Record<string, TravelMode>>>();
  private readonly tripTitleByTrip = new Map<string, Signal<string>>();
  private readonly tripDateRangeByTrip = new Map<string, Signal<[Date, Date] | undefined>>();

  /**
   * Plage de dates du trip (1er jour, dernier jour), dérivée de
   * `_tripDays`/`_days` — même raison que `getTripTitle` de
   * ne PAS passer par `activeTrip()` : `TripHeaderComponent` (formulaire
   * titre + dates) ne doit se réactualiser QUE si le titre ou les jours de
   * CE trip changent réellement, jamais pour une raison sans rapport ailleurs
   * dans le trip (voir ROADMAP.md "Bugs / fixes"). `equal` structurel (voir
   * `structurallyEqual`) : réordonner `_tripDays` sans changer l'ensemble des
   * jours (rare, mais possible) ne notifie pas non plus les consommateurs si
   * les bornes min/max restent identiques.
   */
  getTripDateRange(tripId: string): Signal<[Date, Date] | undefined> {
    if (!this.tripDateRangeByTrip.has(tripId)) {
      this.tripDateRangeByTrip.set(
        tripId,
        computed(() => {
          const dayKeys = this._tripDays()[tripId] ?? [];
          if (!dayKeys.length) return undefined;
          const times = dayKeys.map((key) => new Date(key).getTime());
          return [new Date(Math.min(...times)), new Date(Math.max(...times))] as [Date, Date];
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.tripDateRangeByTrip.get(tripId)!;
  }

  /** Paliers de mode de trajet du trip — voir `_tripTravelTiers` pour pourquoi ce n'est pas lu depuis `activeTrip()`. Retombe sur `trip.travelTiers` (valeur d'hydratation) puis `DEFAULT_TRAVEL_TIERS`. */
  getTripTravelTiers(tripId: string): Signal<TravelTiers> {
    if (!this.tripTravelTiersByTrip.has(tripId)) {
      this.tripTravelTiersByTrip.set(
        tripId,
        computed(
          () => this._tripTravelTiers()[tripId] ?? this._trips()[tripId]?.travelTiers ?? DEFAULT_TRAVEL_TIERS,
          { equal: (a, b) => this.structurallyEqual(a, b) },
        ),
      );
    }
    return this.tripTravelTiersByTrip.get(tripId)!;
  }

  /** Overrides manuels de mode de trajet du trip (clé = paire de lieux) — voir `_tripTravelModeOverrides` pour pourquoi ce n'est pas lu depuis `activeTrip()`. Retombe sur `trip.travelModeOverrides` (valeur d'hydratation) puis `{}` (aucun override = tout est automatique). */
  getTravelModeOverrides(tripId: string): Signal<Record<string, TravelMode>> {
    if (!this.tripTravelModeOverridesByTrip.has(tripId)) {
      this.tripTravelModeOverridesByTrip.set(
        tripId,
        computed(
          () => this._tripTravelModeOverrides()[tripId] ?? this._trips()[tripId]?.travelModeOverrides ?? {},
          { equal: (a, b) => this.structurallyEqual(a, b) },
        ),
      );
    }
    return this.tripTravelModeOverridesByTrip.get(tripId)!;
  }

  /** Titre du trip — voir `_tripTitle` pour pourquoi ce n'est pas lu depuis `activeTrip()`. Retombe sur `trip.title` (valeur d'hydratation) tant qu'aucun renommage n'a eu lieu. */
  getTripTitle(tripId: string): Signal<string> {
    if (!this.tripTitleByTrip.has(tripId)) {
      this.tripTitleByTrip.set(
        tripId,
        computed(() => this._tripTitle()[tripId] ?? this._trips()[tripId]?.title ?? ''),
      );
    }
    return this.tripTitleByTrip.get(tripId)!;
  }

  /** Les instances (form) rattachées à un jour, composées avec l'identité de leur activité de pool. */
  getDayActivities(dayId: Date): Signal<Activity[]> {
    const key = dayId.toISOString();
    if (!this.dayActivitiesByDay.has(key)) {
      this.dayActivitiesByDay.set(
        key,
        computed(() => {
          const ids = this._dayActivityIds()[key] ?? [];
          const instances = this._dayActivityInstances();
          const pools = this._poolActivities();
          return ids
            .map((id) => instances[id])
            .filter((i): i is DayActivityInstance => !!i)
            .map((i) => this.composeInstanceView(i, pools[i.activityId]));
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.dayActivitiesByDay.get(key)!;
  }

  private readonly dayActivitiesWithEchoesByDay = new Map<string, Signal<DayActivityEntry[]>>();

  /**
   * Activités du jour + échos (voir `ActivityEcho`) : préfixe, pour ce jour,
   * les échos des activités des jours précédents dont l'étalement
   * (`endDayOffset`, voir `resolveEndDayOffset`) atteint ce jour — purement
   * dérivé (computed), jamais persisté. Chaque jour d'origine est résolu via
   * `_tripDays[tripId]` (ordre de l'itinéraire), pas par arithmétique
   * calendaire. Un écho sur le dernier jour couvert (`offset === i`, celui où
   * l'activité se termine réellement) porte `endTime` ; les échos des jours
   * intermédiaires n'en portent pas (voir `ActivityEchoCardComponent`, qui
   * n'affiche "jusqu'à ..." que si `endTime` est renseigné).
   */
  getDayActivitiesWithEchoes(tripId: string, dayId: Date): Signal<DayActivityEntry[]> {
    const key = `${tripId}:${dayId.toISOString()}`;
    if (!this.dayActivitiesWithEchoesByDay.has(key)) {
      this.dayActivitiesWithEchoesByDay.set(
        key,
        computed(() => {
          const dayKeys = this._tripDays()[tripId] ?? [];
          const idx = dayKeys.indexOf(dayId.toISOString());

          const echoes: ActivityEcho[] = [];
          for (let i = 1; idx - i >= 0; i++) {
            const originDayId = new Date(dayKeys[idx - i]);
            for (const a of this.getDayActivities(originDayId)()) {
              const offset = resolveEndDayOffset(a.startTime, a.endTime, a.endDayOffset);
              if (offset < i) continue;
              echoes.push({
                kind: 'echo',
                originInstanceId: a.id,
                originDayId,
                activityId: a.activityId,
                title: a.title,
                type: a.type,
                startTime: '00:00',
                endTime: offset === i ? a.endTime : undefined,
                photoRefs: a.photoRefs,
              });
            }
          }

          const real: DayActivityEntry[] = this.getDayActivities(dayId)().map((activity) => ({ kind: 'activity' as const, activity }));
          return [...echoes, ...real];
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.dayActivitiesWithEchoesByDay.get(key)!;
  }

  /** Vue composée d'une instance jour donnée, par son instance id. */
  getDayActivity(instanceId: string): Signal<Activity> {
    if (!this.dayActivityViewById.has(instanceId)) {
      this.dayActivityViewById.set(
        instanceId,
        computed(() => {
          const instance = this._dayActivityInstances()[instanceId];
          return this.composeInstanceView(instance, this._poolActivities()[instance?.activityId]);
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.dayActivityViewById.get(instanceId)!;
  }

  /**
   * Résout une instance vers son jour + sa vue composée, ou `undefined` si
   * l'instance n'existe plus (voir `Item.linkedActivityInstanceId`,
   * ROADMAP.md "UX / Interactions" — pas de nettoyage en cascade des liens
   * de listes vers une activité/instance supprimée, contrairement aux
   * instances elles-mêmes lors de la suppression d'un jour, voir `removeDay`).
   * Scanne `_dayActivityIds` (pas d'index inverse dédié, usage rare — ce
   * chip uniquement).
   */
  getDayActivityWithDay(tripId: string, instanceId: string): Signal<{ dayId: Date; activity: Activity } | undefined> {
    return computed(() => {
      const instance = this._dayActivityInstances()[instanceId];
      if (!instance) return undefined;
      const dayKeys = this._tripDays()[tripId] ?? [];
      const dayActivityIds = this._dayActivityIds();
      const dayKey = dayKeys.find((k) => (dayActivityIds[k] ?? []).includes(instanceId));
      if (!dayKey) return undefined;
      return { dayId: new Date(dayKey), activity: this.composeInstanceView(instance, this._poolActivities()[instance.activityId]) };
    }, { equal: (a, b) => this.structurallyEqual(a, b) });
  }

  getPoolActivity(poolId: string): Signal<PoolActivity> {
    if (!this.poolActivityById.has(poolId)) {
      this.poolActivityById.set(
        poolId,
        computed(() => this._poolActivities()[poolId]),
      );
    }
    return this.poolActivityById.get(poolId)!;
  }

  /** Vue composée "légère" d'une activité de pool, pour la carte en contexte général (pas de form). */
  getPoolActivityView(poolId: string): Signal<Activity> {
    if (!this.poolActivityViewById.has(poolId)) {
      this.poolActivityViewById.set(
        poolId,
        computed(() => {
          const pool = this._poolActivities()[poolId];
          if (!pool) return undefined as unknown as Activity;
          const instance = Object.values(this._dayActivityInstances()).find((i) => i.activityId === poolId);
          return this.composePoolView(pool, instance);
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.poolActivityViewById.get(poolId)!;
  }

  /** Le pool complet des activités d'un trip : placées sur un/plusieurs jours, ou aucun. */
  getAllPoolActivities(tripId: string): Signal<PoolActivity[]> {
    if (!this.allPoolActivitiesByTrip.has(tripId)) {
      this.allPoolActivitiesByTrip.set(
        tripId,
        computed(() => {
          const ids = this._tripActivities()[tripId] ?? [];
          const map = this._poolActivities();
          return ids.map((id) => map[id]).filter((a): a is PoolActivity => !!a);
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.allPoolActivitiesByTrip.get(tripId)!;
  }

  private readonly activityPlacementsByTrip = new Map<string, Signal<Map<string, { dayId: Date; instanceId: string }[]>>>();

  /**
   * Pour un trip donné : map poolActivityId -> liste des placements (jour +
   * instance) où elle est présente (une activité de pool peut être placée
   * sur plusieurs jours en même temps, chacun via sa propre instance). Sert
   * à savoir si une activité de pool est "placée quelque part" (présence +
   * longueur > 0), sur quels jours, et via quelle instance (nécessaire pour
   * naviguer vers le bon jour et scroller jusqu'à la bonne carte).
   */
  getActivityPlacements(tripId: string): Signal<Map<string, { dayId: Date; instanceId: string }[]>> {
    if (!this.activityPlacementsByTrip.has(tripId)) {
      this.activityPlacementsByTrip.set(
        tripId,
        computed(() => {
          const dayKeys = this._tripDays()[tripId] ?? [];
          const dayActivityIds = this._dayActivityIds();
          const instances = this._dayActivityInstances();
          const map = new Map<string, { dayId: Date; instanceId: string }[]>();
          for (const dayKey of dayKeys) {
            for (const instanceId of dayActivityIds[dayKey] ?? []) {
              const poolId = instances[instanceId]?.activityId;
              if (!poolId) continue;
              map.set(poolId, [...(map.get(poolId) ?? []), { dayId: new Date(dayKey), instanceId }]);
            }
          }
          return map;
        }),
      );
    }
    return this.activityPlacementsByTrip.get(tripId)!;
  }

  // ── Sélecteurs mémorisés — Réservations ───────────────────────────────────

  private readonly logisticById = new Map<string, Signal<Logistic>>();
  private readonly allLogisticsByTrip = new Map<string, Signal<Logistic[]>>();

  getLogistic(logisticId: string): Signal<Logistic> {
    if (!this.logisticById.has(logisticId)) {
      this.logisticById.set(
        logisticId,
        computed(() => this._logistics()[logisticId]),
      );
    }
    return this.logisticById.get(logisticId)!;
  }

  /** Toutes les réservations d'un trip, sans tri (voir `TripFacade.allLogisticsSorted` pour l'ordre chronologique). */
  getAllLogistics(tripId: string): Signal<Logistic[]> {
    if (!this.allLogisticsByTrip.has(tripId)) {
      this.allLogisticsByTrip.set(
        tripId,
        computed(() => {
          const ids = this._tripLogistics()[tripId] ?? [];
          const map = this._logistics();
          return ids.map((id) => map[id]).filter((r): r is Logistic => !!r);
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.allLogisticsByTrip.get(tripId)!;
  }

  // ── Commandes — Réservations ───────────────────────────────────────────────

  createLogistic(tripId: string, logistic: Logistic): void {
    this._logistics.update((r) => ({ ...r, [logistic.id]: logistic }));
    this._tripLogistics.update((t) => ({
      ...t,
      [tripId]: [...(t[tripId] ?? []), logistic.id],
    }));
    this.markLogisticPending(logistic.id);
    this.logisticPersistenceService.create(tripId, logistic).catch((err) => {
      console.error('[TripStore] Erreur création réservation Firestore :', err);
    });
  }

  updateLogistic(tripId: string, logistic: Logistic): void {
    const previousStatus = this._logistics()[logistic.id]?.booking.status;

    this._logistics.update((r) => ({ ...r, [logistic.id]: logistic }));
    this.markLogisticPending(logistic.id);
    this.logisticPersistenceService.queueUpdate(tripId, logistic);

    this.freezeRateOnBooked(previousStatus, logistic.booking.status, logistic.price, (frozen) => {
      const frozenLogistic = { ...logistic, price: { ...logistic.price!, ...frozen } };
      this._logistics.update((r) => (r[logistic.id] ? { ...r, [logistic.id]: frozenLogistic } : r));
      this.markLogisticPending(logistic.id);
      this.logisticPersistenceService.queueUpdate(tripId, frozenLogistic);
    });
  }

  removeLogistic(tripId: string, logisticId: string): void {
    this._logistics.update((r) => {
      const copy = { ...r };
      delete copy[logisticId];
      return copy;
    });
    this._tripLogistics.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).filter((id) => id !== logisticId),
    }));
    this.logisticPersistenceService.remove(tripId, logisticId).catch((err) => {
      console.error('[TripStore] Erreur suppression réservation Firestore :', err);
    });
  }

  /**
   * Met à jour uniquement le statut vol (cache Firestore partagé, voir
   * `FlightStatusRefreshService`) : n'affecte aucun autre champ de la
   * réservation. Écriture DIRECTE (pas `queueUpdate`/le writer débouncé) :
   * le pending marqué ici ne peut donc pas compter sur l'`effect()` du
   * constructeur (qui surveille `logisticPersistenceService.syncing()`,
   * lequel ne passe jamais à `true` pour cette écriture) — il est retiré
   * explicitement une fois la promesse résolue, pas par ce mécanisme partagé.
   */
  updateFlightStatus(tripId: string, logistic: FlightLogistic, status: FlightStatus, statusFetchedAt: Date): void {
    this._logistics.update((r) => ({ ...r, [logistic.id]: { ...logistic, status, statusFetchedAt } }));
    this.markLogisticPending(logistic.id);
    this.logisticPersistenceService.updateFlightStatus(tripId, logistic.id, status, statusFetchedAt)
      .catch((err) => {
        console.error('[TripStore] Erreur mise à jour statut vol Firestore :', err);
      })
      .finally(() => this.unmarkLogisticPending(logistic.id));
  }

  private markLogisticPending(id: string): void {
    this._pendingLogisticIds.update((s) => {
      const copy = new Set(s);
      copy.add(id);
      return copy;
    });
  }

  private unmarkLogisticPending(id: string): void {
    this._pendingLogisticIds.update((s) => {
      if (!s.has(id)) return s;
      const copy = new Set(s);
      copy.delete(id);
      return copy;
    });
  }

  // ── Sélecteurs mémorisés — Dépenses libres ────────────────────────────────

  private readonly expenseById = new Map<string, Signal<Expense>>();
  private readonly allExpensesByTrip = new Map<string, Signal<Expense[]>>();

  getExpense(expenseId: string): Signal<Expense> {
    if (!this.expenseById.has(expenseId)) {
      this.expenseById.set(
        expenseId,
        computed(() => this._expenses()[expenseId]),
      );
    }
    return this.expenseById.get(expenseId)!;
  }

  /** Toutes les dépenses libres d'un trip, sans tri (voir src/specs/devise.md 3.4). */
  getAllExpenses(tripId: string): Signal<Expense[]> {
    if (!this.allExpensesByTrip.has(tripId)) {
      this.allExpensesByTrip.set(
        tripId,
        computed(() => {
          const ids = this._tripExpenses()[tripId] ?? [];
          const map = this._expenses();
          return ids.map((id) => map[id]).filter((e): e is Expense => !!e);
        }, { equal: (a, b) => this.structurallyEqual(a, b) }),
      );
    }
    return this.allExpensesByTrip.get(tripId)!;
  }

  // ── Commandes — Dépenses libres ────────────────────────────────────────────

  createExpense(tripId: string, expense: Expense): void {
    this._expenses.update((e) => ({ ...e, [expense.id]: expense }));
    this._tripExpenses.update((t) => ({
      ...t,
      [tripId]: [...(t[tripId] ?? []), expense.id],
    }));
    this.markExpensePending(expense.id);
    this.expensePersistenceService.create(tripId, expense).catch((err) => {
      console.error('[TripStore] Erreur création dépense libre Firestore :', err);
    });
  }

  updateExpense(tripId: string, expense: Expense): void {
    this._expenses.update((e) => ({ ...e, [expense.id]: expense }));
    this.markExpensePending(expense.id);
    this.expensePersistenceService.queueUpdate(tripId, expense);
  }

  removeExpense(tripId: string, expenseId: string): void {
    this._expenses.update((e) => {
      const copy = { ...e };
      delete copy[expenseId];
      return copy;
    });
    this._tripExpenses.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).filter((id) => id !== expenseId),
    }));
    this.expensePersistenceService.remove(tripId, expenseId).catch((err) => {
      console.error('[TripStore] Erreur suppression dépense libre Firestore :', err);
    });
  }

  private markExpensePending(id: string): void {
    this._pendingExpenseIds.update((s) => {
      const copy = new Set(s);
      copy.add(id);
      return copy;
    });
  }

  // ── Commandes — Trip ────────────────────────────────────────────────

  saveTrip(trip: Trip): void {
    // 1. Hydratation optimiste des signals locaux
    // _tripsResult : ajout dans la liste du dashboard — bornes de jours
    // calculées ici aussi (voir TripSummary), pas seulement côté data source,
    // pour que la détection du "voyage actif" (ROADMAP.md "UX / Interactions")
    // soit correcte dès la création, avant même le premier snapshot Firestore.
    const dayTimes = trip.days.map((d) => d.id.getTime());
    this._tripsResult.update((list) => [
      ...(list ?? []),
      {
        id: trip.id, title: trip.title, ownerId: trip.ownerId,
        ...(trip.photoRef ? { photoRef: trip.photoRef } : {}),
        ...(dayTimes.length ? { earliestDay: new Date(Math.min(...dayTimes)), latestDay: new Date(Math.max(...dayTimes)) } : {}),
      },
    ]);

    // _trips : entité complète
    this._trips.update((trips) => ({ ...trips, [trip.id]: trip }));

     this._tripMembers.update((map) => ({ ...map, [trip.id]: trip.members }));

    // _days + _tripDays : un entry par jour
    const dayKeys: string[] = [];
    this._days.update((days) => {
      const copy = { ...days };
      for (const day of trip.days) {
        const key = day.id.toISOString();
        copy[key] = day;
        dayKeys.push(key);
      }
      return copy;
    });
    this._tripDays.update((map) => ({ ...map, [trip.id]: dayKeys }));
    this._tripActivities.update((map) => ({ ...map, [trip.id]: [] }));
    this._tripLogistics.update((map) => ({ ...map, [trip.id]: [] }));

    // _notesItems + _tripNotesItems : items des notes (vides à la création)
    const itemIds = trip.notes.items.map((note) => note.id);
    this._notesItems.update((items) => {
      const copy = { ...items };
      for (const item of trip.notes.items) {
        copy[item.id] = item;
      }
      return copy;
    });
    this._tripNotesItems.update((map) => ({ ...map, [trip.id]: itemIds }));

    // 2. Persistance Firestore (fire & forget — pas de debounce sur une création)
    this.tripPersistenceService.createTrip(trip).catch((err) => {
      console.error('[TripStore] Erreur création trip Firestore :', err);
    });
  }

  private markTripFieldPending(tripId: string): void {
    this._pendingTripFieldIds.update((set) => new Set(set).add(tripId));
  }

  /** Voir la doc de `_pendingTripDayIds` — compteur, plusieurs `addDay`/`removeDay` peuvent être en vol en même temps pour le même trip. */
  private markTripDayPending(tripId: string): void {
    const count = (this.pendingTripDayCounts.get(tripId) ?? 0) + 1;
    this.pendingTripDayCounts.set(tripId, count);
    if (count === 1) this._pendingTripDayIds.update((set) => new Set(set).add(tripId));
  }

  /** Retiré même en cas d'échec d'écriture (voir `clearTripFieldPending`) — ne décrémente le compteur partagé qu'une fois, jamais sous 0. */
  private clearTripDayPending(tripId: string): void {
    const count = (this.pendingTripDayCounts.get(tripId) ?? 0) - 1;
    if (count > 0) {
      this.pendingTripDayCounts.set(tripId, count);
      return;
    }
    this.pendingTripDayCounts.delete(tripId);
    this._pendingTripDayIds.update((set) => {
      if (!set.has(tripId)) return set;
      const copy = new Set(set);
      copy.delete(tripId);
      return copy;
    });
  }

  /** Retiré même en cas d'échec d'écriture : un échec n'a rien écrit côté Firestore, rien à protéger d'un prochain snapshot (voir la doc de `_pendingTripFieldIds`). */
  private clearTripFieldPending(tripId: string): void {
    this._pendingTripFieldIds.update((set) => {
      if (!set.has(tripId)) return set;
      const copy = new Set(set);
      copy.delete(tripId);
      return copy;
    });
  }

  updateTripTitle(tripId: string, title: string): void {
    // 1. Signal dédié (voir `_tripTitle`), pas `_trips`.
    this._tripTitle.update((map) => ({ ...map, [tripId]: title }));
    this.markTripFieldPending(tripId);

    this._tripsResult.update((list) =>
      list?.map(item =>
        item.id === tripId
          ? { ...item, title }
          : item
      ) ?? []
    );

    // 2. Persistance Firestore
    this.tripPersistenceService.updateTripTitle(tripId, title)
      .catch((err) => {
        console.error('[TripStore] Erreur update trip Firestore :', err);
      })
      .finally(() => this.clearTripFieldPending(tripId));
  }

  updateTripTravelTiers(tripId: string, tiers: TravelTiers): void {
    if (!this._trips()[tripId]) return;

    // 1. Signal dédié (voir `_tripTravelTiers`), pas `_trips`.
    this._tripTravelTiers.update((map) => ({ ...map, [tripId]: tiers }));
    this.markTripFieldPending(tripId);

    // 2. Persistance Firestore
    this.tripPersistenceService.updateTripTravelTiers(tripId, tiers)
      .catch((err) => {
        console.error('[TripStore] Erreur update paliers trajet trip Firestore :', err);
      })
      .finally(() => this.clearTripFieldPending(tripId));
  }

  /** `mode = null` efface l'override (retour à l'automatique) — voir `selectTravelMode`/`buildPlacePairKey`. */
  setTravelModeOverride(tripId: string, placePairKey: string, mode: TravelMode | null): void {
    if (!this._trips()[tripId]) return;

    const current = this._tripTravelModeOverrides()[tripId] ?? this._trips()[tripId]?.travelModeOverrides ?? {};
    const next = { ...current };
    if (mode === null) delete next[placePairKey];
    else next[placePairKey] = mode;

    // 1. Signal dédié (voir `_tripTravelModeOverrides`), pas `_trips`.
    this._tripTravelModeOverrides.update((map) => ({ ...map, [tripId]: next }));
    this.markTripFieldPending(tripId);

    // 2. Persistance Firestore
    this.tripPersistenceService.updateTripTravelModeOverrides(tripId, next)
      .catch((err) => {
        console.error('[TripStore] Erreur update override mode trajet trip Firestore :', err);
      })
      .finally(() => this.clearTripFieldPending(tripId));
  }

  removeTrip(tripId: string) {
    this.tripPersistenceService.removeTrip(tripId);
    this._trips.update((t) => {
      const copy = { ...t };
      delete copy[tripId];
      return copy;
    });
  }

  // ── Commandes — Activities ────────────────────────────────────────────────

  getTripMembers(tripId: string): Signal<Record<string, TripMember>> {
    if (!this.membersByTrip.has(tripId)) {
      this.membersByTrip.set(
        tripId,
        computed(() => this._tripMembers()[tripId] ?? {})
      );
    }
    return this.membersByTrip.get(tripId)!;
  }

  // 5. Ajouter la commande addCollaborator (Mise à jour optimiste isolée)
  addCollaborator(tripId: string, email: string): Observable<{ success: boolean; uid: string; email: string; displayName: string | null }> {
    return this.collaborationService.addCollaborator(tripId, email).pipe(
      tap(({ uid, email, displayName }) => {
        this._tripMembers.update((map) => {
          const currentMembers = map[tripId] ?? {};
          return {
            ...map,
            [tripId]: {
              ...currentMembers,
              [uid]: { role: 'editor', email, displayName: displayName ?? undefined } as TripMember
            }
          };
        });
      })
    );
  }

  removeCollaborator(tripId: string, memberUid: string): Observable<{ success: boolean }> {
    return this.collaborationService.removeCollaborator(tripId, memberUid).pipe(
      tap(() => {
        this._tripMembers.update((map) => {
          const currentMembers = { ...(map[tripId] ?? {}) };
          delete currentMembers[memberUid];
          return { ...map, [tripId]: currentMembers };
        });
      })
    );
  }

  // ── Commandes — Activities ────────────────────────────────────────────────

  /** Crée une activité de pool ET une instance pour ce jour en une fois (bouton "+" d'un jour) — positionnée en fin de journée tant qu'aucune heure n'est saisie (ROADMAP.md "### UI"), `repositionChronologically` la replace ensuite dès qu'une heure de début est renseignée. */
  createActivity(tripId: string, dayId: Date, poolActivity: PoolActivity, instance: DayActivityInstance): void {
    this.addPoolActivity(tripId, poolActivity);
    this.addDayActivityInstance(tripId, dayId, instance);
  }

  /** Crée une activité dans le pool général du trip uniquement (aucun jour) : elle sera affichée avec des contours en tiret tant qu'elle n'est placée sur aucun jour. */
  createGeneralActivity(tripId: string, poolActivity: PoolActivity): void {
    this.addPoolActivity(tripId, poolActivity);
  }

  private addPoolActivity(tripId: string, poolActivity: PoolActivity): void {
    this._poolActivities.update((a) => ({ ...a, [poolActivity.id]: poolActivity }));
    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).includes(poolActivity.id)
        ? t[tripId]
        : [...(t[tripId] ?? []), poolActivity.id],
    }));
    this.markActivityPending(poolActivity.id);
    this.activityPersistenceService.queueUpdate(tripId, poolActivity);
  }

  private addDayActivityInstance(tripId: string, dayId: Date, instance: DayActivityInstance): void {
    const dayKey = dayId.toISOString();

    this._dayActivityInstances.update((i) => ({ ...i, [instance.id]: instance }));
    this._dayActivityIds.update((d) => ({
      ...d,
      [dayKey]: [...(d[dayKey] ?? []), instance.id],
    }));
    this.markActivityPending(instance.id);

    this.dayActivityInstancePersistenceService.queueUpdate(tripId, instance);
    this.syncDayActivityIds(tripId, dayId);
  }

  /**
   * Crée une nouvelle instance référençant une activité de pool existante et
   * l'attache à ce jour (drop depuis le pool) : ne modifie jamais l'activité
   * de pool elle-même. Devise du form préremplie depuis le pays du lieu
   * Google de CETTE activité si connu (`suggestedCurrencyForCountry`, voir
   * src/specs/devise.md 3.1 — friction de saisie uniquement, jamais un pivot
   * de calcul), sinon 'EUR'. Retourne l'id de l'instance créée.
   */
  attachPoolActivityToDay(tripId: string, poolId: string, targetDayId: Date): string {
    const poolActivity = this._poolActivities()[poolId];
    const currency = suggestedCurrencyForCountry(poolActivity?.countryCode) ?? 'EUR';
    const instance: DayActivityInstance = {
      id: crypto.randomUUID(),
      activityId: poolId,
      ...defaultInstanceForm(currency),
    };
    this.addDayActivityInstance(tripId, targetDayId, instance);
    return instance.id;
  }

  /**
   * Déplace une instance existante d'un jour à l'autre (garde son form) — ne
   * crée jamais de nouvelle instance, ne touche jamais au pool. No-op si
   * elle est déjà sur le jour cible.
   */
  moveDayActivityInstance(tripId: string, instanceId: string, targetDayId: Date): void {
    const targetKey = targetDayId.toISOString();
    const dayKeys = this._tripDays()[tripId] ?? [];
    const dayActivityIds = this._dayActivityIds();

    let previousDayKey: string | null = null;
    for (const key of dayKeys) {
      if ((dayActivityIds[key] ?? []).includes(instanceId)) {
        previousDayKey = key;
        break;
      }
    }

    if (previousDayKey === targetKey) return;

    this._dayActivityIds.update((d) => {
      const copy = { ...d };
      if (previousDayKey) {
        copy[previousDayKey] = (copy[previousDayKey] ?? []).filter((id) => id !== instanceId);
      }
      copy[targetKey] = [...(copy[targetKey] ?? []), instanceId];
      return copy;
    });

    if (previousDayKey) {
      this.syncDayActivityIds(tripId, new Date(previousDayKey));
    }
    this.syncDayActivityIds(tripId, targetDayId);
  }

  /**
   * Point d'entrée unique du drag-and-drop (voir ActivityDayDispatchOverlayComponent) :
   * `origin === 'pool'` crée un nouveau placement (attach), `origin === 'day'`
   * déplace le placement existant — `activityId` vaut respectivement le poolId
   * ou l'instanceId selon l'origine (voir `ActivityCardComponent.buildDraggedInfo`).
   * Retourne l'id de l'instance déposée sur le jour cible (le nouvel id créé
   * pour 'pool', `activityId` lui-même pour 'day') — utilisé par l'overlay
   * pour demander le scroll vers cette instance une fois le jour actif.
   */
  dispatchActivity(tripId: string, activityId: string, origin: 'pool' | 'day', targetDayId: Date): string {
    if (origin === 'pool') {
      return this.attachPoolActivityToDay(tripId, activityId, targetDayId);
    }
    this.moveDayActivityInstance(tripId, activityId, targetDayId);
    return activityId;
  }

  /** Met à jour l'identité/les fichiers d'une activité de pool : se répercute sur toutes ses instances (elles ne stockent que le form). */
  updatePoolActivity(tripId: string, poolActivity: PoolActivity): void {
    this._poolActivities.update((a) => ({ ...a, [poolActivity.id]: poolActivity }));
    this.markActivityPending(poolActivity.id);
    this.activityPersistenceService.queueUpdate(tripId, poolActivity);
  }

  /** Met à jour le form d'une instance jour donnée : n'affecte ni le pool, ni les autres instances de la même activité. */
  updateDayActivityInstance(tripId: string, instance: DayActivityInstance): void {
    const previousStatus = this._dayActivityInstances()[instance.id]?.booking.status;

    this._dayActivityInstances.update((i) => ({ ...i, [instance.id]: instance }));
    this.markActivityPending(instance.id);
    this.dayActivityInstancePersistenceService.queueUpdate(tripId, instance);

    if (instance.startTime) {
      this.repositionChronologically(tripId, instance.id, instance.startTime);
    }

    this.freezeRateOnBooked(previousStatus, instance.booking.status, instance.price, (frozen) => {
      const frozenInstance = { ...instance, price: { ...instance.price, ...frozen } };
      this._dayActivityInstances.update((i) => (i[instance.id] ? { ...i, [instance.id]: frozenInstance } : i));
      this.markActivityPending(instance.id);
      this.dayActivityInstancePersistenceService.queueUpdate(tripId, frozenInstance);
    });
  }

  /**
   * Replace `instanceId` au bon endroit chronologique sur son jour courant
   * (voir `insertChronologically`) — ne retrie jamais les activités non
   * datées entre elles, ne fait rien si l'ordre ne change pas (voir
   * ROADMAP.md "Activités").
   */
  private repositionChronologically(tripId: string, instanceId: string, startTime: string): void {
    const dayKeys = this._tripDays()[tripId] ?? [];
    const dayActivityIds = this._dayActivityIds();
    const dayKey = dayKeys.find((k) => (dayActivityIds[k] ?? []).includes(instanceId));
    if (!dayKey) return;

    const currentIds = dayActivityIds[dayKey] ?? [];
    const instances = this._dayActivityInstances();
    const reordered = insertChronologically(currentIds, instanceId, startTime, (id) => instances[id]?.startTime);
    if (reordered.every((id, i) => id === currentIds[i])) return;

    this._dayActivityIds.update((d) => ({ ...d, [dayKey]: reordered }));
    this.syncDayActivityIds(tripId, new Date(dayKey));
  }

  private markActivityPending(id: string): void {
    this._pendingActivityIds.update((s) => {
      const copy = new Set(s);
      copy.add(id);
      return copy;
    });
  }

  /**
   * Si le statut de réservation vient de basculer sur `BOOKED` (transition
   * stricte — `previousStatus` différent de `BOOKED`, sinon pas de
   * re-figeage à chaque édition ultérieure du form une fois déjà réservé),
   * fige le taux `price.currency` -> EUR au moment présent et appelle
   * `apply` une fois résolu (voir src/specs/devise.md 3.3). `TO_BOOK`/
   * `NOT_NEEDED`/`WAITLIST` restent en conversion dynamique — seul `BOOKED`
   * correspond à l'analogie "reçu réel" de la spec. Pivot technique EUR
   * (décision actée, voir currency-conversion.service.ts) : le taux figé et
   * le montant figé sont exprimés en EUR, jamais dans la devise d'un membre
   * en particulier (aucune devise pivot n'est stockée au niveau du voyage).
   * No-op si le prix est absent/nul. `apply` peut être appelé de façon
   * asynchrone (résolution réseau/cache du taux) — les appelants doivent
   * réappliquer `markXxxPending`/`queueUpdate` dans leur callback, comme un
   * 2e passage d'écriture optimiste indépendant.
   */
  private freezeRateOnBooked(
    previousStatus: BookingStatus | undefined,
    nextStatus: BookingStatus,
    price: { amount: number; currency: string } | undefined,
    apply: (frozen: { frozenRateToEur: number; frozenAmountEur: number; frozenAt: Date }) => void,
  ): void {
    if (nextStatus !== BookingStatus.BOOKED || previousStatus === BookingStatus.BOOKED) return;
    if (!price || price.amount <= 0) return;

    const resolve$: Observable<{ frozenRateToEur: number; frozenAmountEur: number }> =
      price.currency === 'EUR'
        ? of({ frozenRateToEur: 1, frozenAmountEur: price.amount })
        : this.currencyConversionService.convert$(price.amount, price.currency, 'EUR').pipe(
            filter((state) => state.status !== 'loading'),
            take(1),
            map((state) =>
              state.status === 'success'
                ? { frozenRateToEur: state.data.amount / price.amount, frozenAmountEur: state.data.amount }
                : { frozenRateToEur: 1, frozenAmountEur: price.amount },
            ),
          );

    resolve$.subscribe((rate) => apply({ ...rate, frozenAt: new Date() }));
  }

  /**
   * Supprime définitivement une activité de pool ET, en cascade, toutes ses
   * instances (sur tous les jours où elle est placée). À utiliser depuis la
   * carte en contexte pool.
   */
  removePoolActivity(tripId: string, poolId: string): void {
    const dayKeys = this._tripDays()[tripId] ?? [];
    const dayActivityIds = this._dayActivityIds();
    const instances = this._dayActivityInstances();

    const affectedDayKeys: string[] = [];
    const instanceIdsToRemove: string[] = [];
    for (const dayKey of dayKeys) {
      const ids = (dayActivityIds[dayKey] ?? []).filter((id) => instances[id]?.activityId === poolId);
      if (ids.length) {
        affectedDayKeys.push(dayKey);
        instanceIdsToRemove.push(...ids);
      }
    }

    this._poolActivities.update((a) => {
      const copy = { ...a };
      delete copy[poolId];
      return copy;
    });
    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).filter((id) => id !== poolId),
    }));

    if (instanceIdsToRemove.length) {
      const toRemove = new Set(instanceIdsToRemove);
      this._dayActivityInstances.update((i) => {
        const copy = { ...i };
        for (const id of toRemove) delete copy[id];
        return copy;
      });
      this._dayActivityIds.update((d) => {
        const copy = { ...d };
        for (const dayKey of affectedDayKeys) {
          copy[dayKey] = (copy[dayKey] ?? []).filter((id) => !toRemove.has(id));
        }
        return copy;
      });
      for (const dayKey of affectedDayKeys) {
        this.syncDayActivityIds(tripId, new Date(dayKey));
      }
      for (const instanceId of instanceIdsToRemove) {
        this.dayActivityInstancePersistenceService.removeInstance(tripId, instanceId).catch((err) => {
          console.error('[TripStore] Erreur suppression instance Firestore :', err);
        });
      }
    }

    this.activityPersistenceService.removeActivity(tripId, poolId).catch((err) => {
      console.error('[TripStore] Erreur suppression activité Firestore :', err);
    });
  }

  /** Supprime uniquement ce placement (cette instance) : le pool et ses autres instances restent intacts. À utiliser depuis la carte en contexte jour. */
  removeDayActivityInstance(tripId: string, instanceId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();

    this._dayActivityInstances.update((i) => {
      const copy = { ...i };
      delete copy[instanceId];
      return copy;
    });
    this._dayActivityIds.update((d) => ({
      ...d,
      [dayKey]: (d[dayKey] ?? []).filter((id) => id !== instanceId),
    }));
    this.syncDayActivityIds(tripId, dayId);

    this.dayActivityInstancePersistenceService.removeInstance(tripId, instanceId).catch((err) => {
      console.error('[TripStore] Erreur suppression instance Firestore :', err);
    });
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    const dayKey = dayId.toISOString();
    this._dayActivityIds.update((d) => ({ ...d, [dayKey]: ids }));
    this.syncDayActivityIds(tripId, dayId);
  }

  private syncDayActivityIds(tripId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();
    const activityIds = this._dayActivityIds()[dayKey] ?? [];
    this.dayActivitiesPersistenceService.queueUpdate(tripId, dayId, activityIds);
  }

  // ── Commandes — Notes items ────────────────────────────────────────────────

  getNotesItems(tripId: string): Signal<Item[]> {
    return computed(() => {
      const ids = this._tripNotesItems()[tripId] ?? [];
      const map = this._notesItems();
      return ids.map((id) => map[id]);
    });
  }

  /** Recherche inverse "quelles listes pointent vers cette instance d'activité" (voir `Item.linkedActivityInstanceId`, ROADMAP.md "UX / Interactions") — rien n'est stocké côté activité, ce sélecteur EST le lien côté activité. */
  getLinkedNoteItems(tripId: string, instanceId: string): Signal<Item[]> {
    return computed(() => this.getNotesItems(tripId)().filter((item) => item.linkedActivityInstanceId === instanceId));
  }

  createItem(tripId: string, item: Item): void {
    this._notesItems.update((items) => ({ ...items, [item.id]: item }));
    this._tripNotesItems.update((map) => ({
      ...map,
      [tripId]: [...(map[tripId] ?? []), item.id],
    }));
    this.syncNotes(tripId);
  }

  updateItem(tripId: string, itemId: string, patch: Partial<Item>): void {
    const current = this._notesItems()[itemId];
    if (!current) return;

    this._notesItems.update((items) => ({
      ...items,
      [itemId]: { ...current, ...patch },
    }));
    this.syncNotes(tripId);
  }

  removeItem(tripId: string, itemId: string): void {
    this._notesItems.update((items) => {
      const copy = { ...items };
      delete copy[itemId];
      return copy;
    });

    this._tripNotesItems.update((map) => ({
      ...map,
      [tripId]: (map[tripId] ?? []).filter((id) => id !== itemId),
    }));
    this.syncNotes(tripId);
  }

  reorderItems(tripId: string, ids: string[]): void {
    this._tripNotesItems.update((map) => ({ ...map, [tripId]: ids }));
    this.syncNotes(tripId);
  }

  private syncNotes(tripId: string): void {
    const ids = this._tripNotesItems()[tripId] ?? [];
    const items = this._notesItems();

    const list = ids.map((id) => items[id]);
    this.notesPersistenceService.queueUpdate(tripId, list);
  }
    // ── Commandes — Day ────────────────────────────────────────────────

  removeDay(tripId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();

    // Les activités de POOL du jour supprimé restent dans le pool général du
    // trip (identité + fichiers, potentiellement encore placées sur d'autres
    // jours) : seules les INSTANCES de ce jour, elles, n'ont plus de sens
    // sans leur jour et sont supprimées en cascade.
    const instanceIds = this._dayActivityIds()[dayKey] ?? [];
    if (instanceIds.length) {
      const toRemove = new Set(instanceIds);
      this._dayActivityInstances.update(instances => {
        const copy = { ...instances };
        for (const id of toRemove) delete copy[id];
        return copy;
      });
      for (const instanceId of instanceIds) {
        this.dayActivityInstancePersistenceService.removeInstance(tripId, instanceId).catch(err => {
          console.error('[TripStore] Erreur suppression instance Firestore :', err);
        });
      }
    }

    this._dayActivityIds.update(dayActivityIds => {
      const copy = { ...dayActivityIds };
      delete copy[dayKey];
      return copy;
    });

    this._days.update(days => {
      const copy = { ...days };
      delete copy[dayKey];
      return copy;
    });

    this._tripDays.update(trips => ({
      ...trips,
      [tripId]: (trips[tripId] ?? []).filter(id => id !== dayKey),
    }));

    this.markTripDayPending(tripId);
    this.dayPersistenceService.removeDay(tripId, dayId)
      .catch(err => {
        console.error('[TripStore] Erreur suppression day Firestore :', err);
      })
      .finally(() => this.clearTripDayPending(tripId));
  }

  addDay(tripId: string, day: Day): void {
      const dayKey = day.id.toISOString();

      // état local optimiste
      this._days.update(days => ({
        ...days,
        [dayKey]: day,
      }));

      // ajout de la référence dans le trip
      this._tripDays.update(trips => ({
        ...trips,
        [tripId]: [
          ...(trips[tripId] ?? []),
          dayKey,
        ],
      }));

      this._dayActivityIds.update(dayActivityIds => ({
        ...dayActivityIds,
        [dayKey]: [],
      }));

      // Firestore
      this.markTripDayPending(tripId);
      this.dayPersistenceService.addDay(tripId, day)
        .catch((err) => {
          console.error('[TripStore] Erreur ajout day Firestore :', err);
        })
        .finally(() => this.clearTripDayPending(tripId));
    }
}