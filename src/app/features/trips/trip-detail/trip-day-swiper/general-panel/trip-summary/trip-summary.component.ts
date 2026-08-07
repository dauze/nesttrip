import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewContainerRef, afterNextRender, computed, effect, inject, input, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CURRENCY_OPTIONS } from '@app/shared/components/activity-card/activity.constants';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { DialogService } from '@app/shared/services/dialog.service';
import { ExpensesTableDialogComponent, ExpensesTableDialogData } from './expenses-table/expenses-table-dialog.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Day, TravelTiers } from '@app/features/trips/trip.model';
import { TripHeaderComponent } from '../../../trip-header/trip-header.component';
import { TripCollaboratorsComponent } from '../../../trip-collaborators/trip-collaborators.component';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { LoadingState, PlaceDetails } from '@app/core/models/place.dto';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { GeneralMapCinematicService } from '../trip-activities/general-map-cinematic.service';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { CurrencyConversionService } from '@app/core/services/currency-conversion.service';
import { convertWithRates } from '@app/core/services/currency-conversion.util';
import { suggestedCurrencyForCountry } from '@app/core/utils/country-currency.util';
import { TripTasksTileComponent } from './trip-tasks-tile/trip-tasks-tile.component';
import { TripFilesTileComponent } from './trip-files-tile/trip-files-tile.component';
import { ActivityTypeRingsComponent, RingChartEntry } from './activity-type-rings/activity-type-rings.component';
import { computeExpenseBreakdown, ExpenseItem } from './trip-summary.util';
import { ACTIVITY_TYPE_META } from '@app/shared/components/activity-card/activity.constants';
import { LOGISTIC_TYPE_META } from '../logistics/logistic.constants';

/** Type-key/libellé/icône des dépenses libres dans les anneaux — pas de "type" propre (contrairement à activité/logistique), regroupées sous une seule catégorie. `--nt-activity-activite` (pas `--nt-logistic-other`, qui colore désormais la 5ᵉ entrée "Autre" de `computeExpenseBreakdown` — retour utilisateur : les deux ne doivent pas partager la même couleur, sans quoi une "Dépense libre" repliée dans "Autre" se confond visuellement avec le reste des dépenses libres non repliées). */
const FREE_EXPENSE_META = { label: 'Dépense libre', icon: 'pi pi-wallet', colorVar: '--nt-activity-activite' };

/** Nombre max d'entrées affichées dans les anneaux : 4 types individuels + 1 entrée fixe "Autre" agrégeant le reliquat (voir `computeExpenseBreakdown`) — voir `TripSummaryComponent.expenseBreakdown`. */
const MAX_EXPENSE_ENTRIES = 5;

/**
 * Onglet "Résumé" (voir ROADMAP.md "UX / Interactions", 2026-08-01) : header
 * voyage (`TripHeaderComponent`, qui ne vit plus QUE dans cet onglet — plus
 * de mécanisme de chrome fixe/caché, voir `TripChromeService` et
 * `TripDetailComponent`, simplifié le jour même) + carte du pool d'activités
 * (reprise telle quelle depuis l'ancien onglet Activités, mêmes mécanismes
 * `TripDayMapHostService`/`GeneralMapCinematicService`, voir leur doc — plus
 * jamais repliable dans ce contexte, `app-panel` en mode `bare`) + tuile
 * Dépenses (devise + somme des prix de toutes les activités/réservations du
 * trip, TOUTES devises confondues sans conversion — décision actée — + les 5
 * types de dépense les plus élevés en anneaux, ROADMAP.md "UX / Interactions"
 * 2026-08-05) + tuile Fichiers (fichiers joints aux
 * activités/réservations du trip, groupés par élément d'origine — remplace
 * l'ancienne tuile "Résumé", nombre d'activités/transports/jours, retirée le
 * même jour).
 */
@Component({
  selector: 'app-trip-summary',
  standalone: true,
  imports: [DecimalPipe, CardComponent, SkeletonComponent, ButtonComponent, TripHeaderComponent, TripCollaboratorsComponent, TripTasksTileComponent, TripFilesTileComponent, ActivityTypeRingsComponent],
  templateUrl: './trip-summary.component.html',
  styleUrl: './trip-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Une instance de GeneralMapCinematicService par montage (détruite/recréée
  // à chaque va-et-vient sur ce tab, voir le `@if (visitedDays().has('summary'))`
  // de TripDaySwiperComponent) — même portée que TripActivitiesComponent avant elle.
  providers: [GeneralMapCinematicService],
})
export class TripSummaryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  protected readonly tripFacade = inject(TripFacade);
  private readonly mapHost = inject(TripDayMapHostService);
  private readonly mapCinematic = inject(GeneralMapCinematicService);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly currencyConversionService = inject(CurrencyConversionService);

  private readonly mapContainerRef = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private readonly headerRef = viewChild(TripHeaderComponent);

  readonly tripId = input.required<string>();
  /** Slide "Résumé" active (voir TripDaySwiperComponent) : ce contexte ne possède la carte partagée que dans ce cas — voir TripDayMapHostService. */
  readonly active = input(false);

  /**
   * Lu depuis la liste des trips AVANT `activeTrip()` (Firestore async pas
   * encore résolu au tout premier rendu) — même pattern que l'ancien
   * `TripDetailComponent.tripTitle`, déplacé ici avec le header voyage (voir
   * ROADMAP.md "UX / Interactions", 2026-08-01).
   *
   * Une fois le trip hydraté (`tripFacade.hasTrip`), le signal dédié
   * (`getTripTitle`) prend le dessus et le reste DÉFINITIVEMENT — `trips()`
   * (liste) vient d'une souscription Firestore complètement SÉPARÉE
   * (`getTrips$`, requête sur toute la collection pour l'accueil), qui
   * recalcule `title` directement depuis le document brut à CHAQUE snapshot,
   * sans passer par `_pendingTripFieldIds` : rien ne protège cette valeur
   * pendant qu'une écriture est en vol. La préférer inconditionnellement
   * (comme avant ce correctif) court-circuitait donc la protection déjà en
   * place côté `getTripTitle`, seul le hasard du timing des deux
   * souscriptions Firestore (doc vs collection) déterminant laquelle gagnait.
   */
  readonly tripTitle = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return '';
    if (this.tripFacade.hasTrip(id)) return this.tripFacade.getTripTitle(id)();
    const fromList = this.tripFacade.trips().find(t => t.id === id);
    return fromList?.title ?? this.tripFacade.getTripTitle(id)();
  });

  /**
   * Même pattern/correctif que `tripTitle` ci-dessus — voir sa doc. Signal
   * dédié (voir `TripFacade.getTripDateRange`/`TripStore._tripDays`), pas
   * `activeTrip()` : `TripHeaderComponent` ne doit se réactualiser que si le
   * titre ou les jours de CE trip changent réellement (ROADMAP.md "Bugs /
   * fixes", retour utilisateur : "toute la page rafraîchit" à l'édition du
   * titre/de l'intervalle de dates, et un changement distant ne se voyait
   * pas en direct).
   *
   * **Régression corrigée (2026-08-05)** : `fromList` était préféré
   * INCONDITIONNELLEMENT, y compris une fois le trip hydraté — `trips()`
   * (liste) dérive `earliestDay`/`latestDay` directement des clés brutes du
   * champ Firestore `days` à CHAQUE snapshot de la requête sur la COLLECTION
   * `trips`, une souscription entièrement SÉPARÉE de celle du trip actif
   * (`getTrip$`) et donc jamais protégée par `_pendingTripDayIds` (voir sa
   * doc). Le multi-écriture d'une édition d'intervalle (plusieurs
   * `addDay`/`removeDay`) laissait une fenêtre bien plus large qu'une seule
   * écriture de titre pour que cette souscription non protégée délivre un
   * snapshot reflétant un état INTERMÉDIAIRE (ou encore l'ancien état) —
   * écrasant alors silencieusement le formulaire de dates avec une valeur
   * périmée, symptôme "après modification, ce sont les anciennes dates qui
   * sont affichées". `getTripDateRange` (protégé) est désormais préféré dès
   * que le trip est hydraté ; `fromList` ne sert plus que de valeur de tout
   * premier rendu, avant que `loadTrip`/`getTrip$` n'ait résolu.
   */
  readonly tripDateRange = computed<[Date, Date] | undefined>(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return undefined;
    if (this.tripFacade.hasTrip(id)) return this.tripFacade.getTripDateRange(id)();
    const fromList = this.tripFacade.trips().find(t => t.id === id);
    if (fromList?.earliestDay && fromList?.latestDay) return [fromList.earliestDay, fromList.latestDay];
    return this.tripFacade.getTripDateRange(id)();
  });

  /** Carte partagée avec la vue jour/l'ancien onglet Activités, "prêtée" à ce contexte tant qu'il est actif. */
  readonly activeMapComponent = computed(() => (this.active() ? this.mapHost.activeMap() : null));

  readonly currencyOptions = CURRENCY_OPTIONS;

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

  /** Devise "d'agrégation" (voir src/specs/devise.md 3.1) : celle de l'utilisateur qui CONSULTE, la seule devise "par défaut" encore utilisée dans le trip (le concept de devise par défaut PROPRE au trip a été retiré — préremplissage des nouvelles cartes en 'EUR' partout, voir day-activity-creation.service.ts/logistic-details.component.ts). */
  protected readonly userCurrency = computed(() => this.userProfileService.defaultCurrency());

  /**
   * Tous les éléments contribuant aux dépenses du trip (activités +
   * réservations + dépenses libres), montants CONVERTIS dans `userCurrency`
   * (corrige le bug de la somme brute multi-devises, spec section 2.2) —
   * `null` tant que les taux du jour ne sont pas encore résolus. Source
   * unique pour `totalExpense` ET `expenseBreakdown` : les deux doivent
   * rester cohérents entre eux (la somme des anneaux doit retomber sur le
   * total centré). Statut `BOOKED`/dépense libre (`frozenAmountEur` déjà
   * renseigné, voir src/specs/devise.md 3.3/3.4) : reconverti depuis le
   * montant EUR FIGÉ (pivot technique, voir currency-conversion.service.ts),
   * jamais depuis le montant/devise d'origine — c'est exactement ce qui rend
   * ce montant stable dans le temps malgré la dérive du taux de marché.
   */
  private readonly convertedExpenseItems = computed<ExpenseItem[] | null>(() => {
    const ratesState = this.currencyConversionService.ratesState();
    if (ratesState.status !== 'success') return null;
    const target = this.userCurrency();
    const rates = ratesState.data.rates;

    const items: ExpenseItem[] = [];
    const pushItem = (
      typeKey: string, label: string, icon: string, colorVar: string,
      price: { amount: number; currency: string; frozenAmountEur?: number } | undefined,
    ) => {
      if (!price || price.amount <= 0) return;
      const [sourceAmount, sourceCurrency] =
        price.frozenAmountEur !== undefined ? [price.frozenAmountEur, 'EUR'] : [price.amount, price.currency];
      const converted = convertWithRates(sourceAmount, sourceCurrency, target, rates);
      // Devise non résolue (absente des taux du jour) : ignorée du total
      // plutôt que fausser silencieusement la somme avec un montant brut
      // dans la mauvaise devise.
      if (converted !== null) items.push({ typeKey, label, icon, colorVar, amount: converted });
    };

    for (const { activity } of this.allPlacedActivities()) {
      const meta = ACTIVITY_TYPE_META[activity.type];
      pushItem(`activity:${activity.type}`, meta.label, meta.icon, meta.colorVar, activity.price);
    }
    for (const logistic of this.tripFacade.getAllLogistics(this.tripId())()) {
      const meta = LOGISTIC_TYPE_META[logistic.type];
      pushItem(`logistic:${logistic.type}`, meta.label, meta.icon, meta.colorVar, logistic.price);
    }
    for (const expense of this.tripFacade.getAllExpenses(this.tripId())()) {
      pushItem('expense:free', FREE_EXPENSE_META.label, FREE_EXPENSE_META.icon, FREE_EXPENSE_META.colorVar, expense);
    }

    return items;
  });

  /** Total réellement converti dans `userCurrency` (remplace l'ancienne somme brute multi-devises) — `null` tant que les taux du jour ne sont pas résolus. */
  readonly totalExpense = computed<number | null>(() => {
    const items = this.convertedExpenseItems();
    return items ? items.reduce((sum, item) => sum + item.amount, 0) : null;
  });

  readonly currencySymbol = computed(() => {
    const currency = this.userCurrency();
    return this.currencyOptions.find(o => o.value === currency)?.label.split(' ')[0] ?? currency;
  });

  /** `placeId` du voyage (destination) — lu depuis `activeTrip()` (champ primitif, pas exclu contrairement à activities/logistics/expenses, voir CLAUDE.md). */
  private readonly tripPlaceId = computed(() => {
    const trip = this.tripFacade.activeTrip();
    return trip && trip.id === this.tripId() ? trip.placeId : undefined;
  });

  private readonly destinationDetailsState = toSignal(
    toObservable(this.tripPlaceId).pipe(
      switchMap((placeId) =>
        placeId ? this.googlePlaceService.getPlaceDetails$(placeId) : of({ status: 'idle' } as LoadingState<PlaceDetails>),
      ),
    ),
    { initialValue: { status: 'idle' } as LoadingState<PlaceDetails> },
  );

  /** Devise locale de la destination du voyage, déduite du `placeId` du TRIP (pas d'une carte précise) — purement informative, jamais un pivot de calcul (voir src/specs/devise.md 3.1/3.5). */
  private readonly destinationCurrency = computed(() => {
    const state = this.destinationDetailsState();
    return state.status === 'success' ? suggestedCurrencyForCountry(state.data.countryCode) : undefined;
  });

  /** Sous-texte "(~46 200 ฿)" sous le total (voir src/specs/devise.md 3.5) — `null` si le pays est inconnu, non résolu, ou déjà la même devise que `userCurrency` (rien d'utile à ajouter). */
  readonly destinationTotal = computed(() => {
    const total = this.totalExpense();
    const destination = this.destinationCurrency();
    const source = this.userCurrency();
    if (total === null || !destination || destination === source) return null;

    const ratesState = this.currencyConversionService.ratesState();
    if (ratesState.status !== 'success') return null;

    const converted = convertWithRates(total, source, destination, ratesState.data.rates);
    if (converted === null) return null;

    const symbol = this.currencyOptions.find(o => o.value === destination)?.label.split(' ')[0] ?? destination;
    return { amount: converted, symbol };
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
   * Dépenses regroupées par TYPE (vol, logement, activités, visites,
   * dépenses libres...) — un anneau par type, les 4 dont la somme est la
   * plus élevée individuellement + un anneau fixe "Autre" agrégeant le
   * reliquat (ROADMAP.md "### UI" : "il faut que les 4 premier soient les
   * plus grand, et que le 5ime sois un libellé fixe 'Autre'", voir
   * `computeExpenseBreakdown`). Même périmètre que
   * `totalExpense` ci-dessus (activités posées sur un jour, un placement sur
   * 2 jours comptant 2 fois — ROADMAP.md 2026-08-01 — + réservations
   * logistiques + dépenses libres) ; les éléments à 0/sans prix sont
   * ignorés. Montants déjà CONVERTIS dans `userCurrency` par
   * `convertedExpenseItems` (spec section 2.2 : ce n'est plus une somme
   * brute multi-devises comme avant cette refonte).
   */
  readonly expenseBreakdown = computed<RingChartEntry[]>(() => {
    const items = this.convertedExpenseItems();
    return items ? computeExpenseBreakdown(items, this.currencySymbol(), MAX_EXPENSE_ENTRIES) : [];
  });

  private mapClickSub?: { unsubscribe: () => void };

  constructor() {
    this.destroyRef.onDestroy(() => this.mapClickSub?.unsubscribe());

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

  protected onTravelTiersChange(tiers: TravelTiers): void {
    this.tripFacade.updateTripTravelTiers(this.tripId(), tiers);
  }

  /** Tableau détaillé de toutes les dépenses du voyage (voir src/specs/devise.md 3.5) — position/style provisoires, deviendra le lien discret sous l'anneau une fois la refonte visuelle faite. */
  protected openExpensesTable(): void {
    this.dialogService.open<void, ExpensesTableDialogData>(ExpensesTableDialogComponent, {
      viewContainerRef: this.viewContainerRef,
      data: { tripId: this.tripId() },
    });
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
