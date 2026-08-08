import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MenuComponent, AppMenuItem } from '@app/shared/components/menu/menu.component';
import { LOGISTIC_TYPE_META } from './trip-day-swiper/general-panel/logistics/logistic.constants';
import { LogisticType } from '@core/models/logistic.dto';
import { DayLogisticQuickAddService } from './day-logistic-quick-add.service';
import { ActivatedRoute } from '@angular/router';
import { Trip } from '../trip.model';
import { TripDetailSkeletonComponent } from './trip-detail-skeleton.component';
import { TripFacade } from '../trip-facade.service';
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
import { CoachMarkOverlayComponent } from '@app/shared/components/coach-mark-overlay/coach-mark-overlay.component';
import { OnboardingTourService } from '@app/core/services/onboarding-tour.service';
import { OnboardingAnchorDirective } from '@app/shared/directives/onboarding-anchor.directive';
import { ACTIVITIES_INTRO, DAY_NAV_TOUR, IMMEDIATE_TOUR, LOGISTICS_INTRO, NOTES_INTRO } from '@app/core/services/onboarding-sequences';

const TRIP_DETAIL_ACTIVE_CLASS = 'trip-detail-active';
/** Ids des 4 tabs de premier niveau Résumé/Activités/Logistique/Listes (voir `tabs`) — tout le reste de `activeDay()` est un id de jour (ISO). */
const GENERAL_TAB_IDS = ['summary', 'activities', 'logistics', 'notes'];

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TripDetailSkeletonComponent,
    TripTabsNavComponent,
    TripDaySwiperComponent,
    ActivityDayDispatchOverlayComponent,
    FloatingAddButtonComponent,
    MobileTripNavComponent,
    SelectionActionBarComponent,
    MenuComponent,
    CoachMarkOverlayComponent,
    OnboardingAnchorDirective,
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
  private readonly onboardingTour = inject(OnboardingTourService);

  private readonly tabsNavRef = viewChild(TripTabsNavComponent);
  private readonly dragPortalRef = viewChild<ElementRef<HTMLElement>>('dragPortal');
  private readonly addMenu = viewChild.required<MenuComponent>('addMenu');
  private readonly logisticsAddMenu = viewChild.required<MenuComponent>('logisticsAddMenu');
  private readonly fabElementRef = viewChild(FloatingAddButtonComponent, { read: ElementRef });

  /**
   * Options du menu "Ajouter" — n'existe plus que depuis un jour ou depuis
   * l'onglet Résumé (voir ROADMAP.md "UX / Interactions", précisé le
   * 2026-08-02) : sur les tabs Activités/Logistique/Listes, le "+" crée
   * désormais directement l'élément propre à l'écran affiché (voir
   * `onFabActivate`), sans passer par ce menu. "Autre" est exclu des types
   * logistiques proposés ici (reste un type valide côté données/formulaire,
   * juste retiré de ce menu de création rapide).
   * - Activité : sur un jour, chemin inchangé (`fabTarget.trigger`) ; sur
   *   Résumé (seul cas restant sans "+" contextuel dédié), bascule d'abord
   *   vers le tab Activités PUIS pose une demande de création différée
   *   (`requestCreateOnMount`, consommée par `TripActivitiesComponent` une
   *   fois monté — même schéma que NotesFocusService/LogisticFocusService).
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
        if (!GENERAL_TAB_IDS.includes(this.activeDay())) {
          this.fabTarget.trigger(this.activeDay());
          return;
        }
        this.fabTarget.requestCreateOnMount('activities');
        const index = this.tabs().findIndex(t => t.id === 'activities');
        this.onTabSelected({ id: 'activities', index });
      },
    },
    ...(Object.entries(LOGISTIC_TYPE_META) as [LogisticType, typeof LOGISTIC_TYPE_META[LogisticType]][])
      .filter(([type]) => type !== 'other')
      .map(([type, meta]) => ({
        label: meta.label,
        icon: meta.icon,
        command: () => this.dayLogisticQuickAdd.create(type, GENERAL_TAB_IDS.includes(this.activeDay()) ? undefined : new Date(this.activeDay())),
      })),
    { label: 'Liste', icon: 'pi pi-clipboard', command: () => this.notesFocusService.requestCreate() },
  ]);

  /**
   * Options du menu "Type" ouvert par le "+" flottant SUR le tab Logistique
   * lui-même (ROADMAP.md "### UI", retour utilisateur) : contrairement à
   * `addMenuItems`, les 5 types (dont "Autre", inclus ici) plutôt qu'une
   * liste de 4 excluant "Autre" — ici il n'y a rien d'autre à choisir
   * (on est déjà sur l'écran Logistique), donc "Autre" doit être un choix
   * explicite. Type connu AVANT toute création (`DayLogisticQuickAddService.create`,
   * `dayDate` absent — pas rattaché à un jour précis) : contrairement à
   * l'ancien flux (`LogisticsCreationService`, retiré) qui créait toujours
   * l'élément en type 'other' D'ABORD puis lui faisait changer de type dans
   * la foulée via la cinématique guidée — un élément fraîchement créé qui
   * change de type peut changer de section dans le tri "Type" (groupes
   * réels, `<app-panel>` par type, voir `LogisticsListComponent`), auquel
   * cas Angular détruit/recrée sa carte et coupe net tout dialog CDK de
   * cinématique guidée déjà ouvert dessus — reproduit et confirmé via
   * Playwright. En connaissant le type AVANT la création, l'élément naît
   * direct dans la bonne section, aucun changement de type après coup.
   */
  protected readonly logisticsAddMenuItems = computed<AppMenuItem[]>(() =>
    (Object.entries(LOGISTIC_TYPE_META) as [LogisticType, typeof LOGISTIC_TYPE_META[LogisticType]][])
      .map(([type, meta]) => ({
        label: meta.label,
        icon: meta.icon,
        command: () => {
          this.dayLogisticQuickAdd.create(type, undefined, this.fabTarget.logisticsSearchTerm());
          this.fabTarget.setLogisticsSearchTerm('');
        },
      })),
  );

  readonly activeDay = signal<string>('activities');
  private initializedTripId: string | null = null;
  private popStateSub?: { unsubscribe(): void };
  readonly currentDayIndex = signal(0);

  readonly contentReady = signal(false);
  private readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private contentReadyTripId: string | null = null;


  readonly sortedDays = computed(() =>
    this.facade.activeTrip()?.days
      ?.slice()
      .sort((a, b) => a.id.getTime() - b.id.getTime()) ?? []
  );

  /**
   * Résumé/Activités/Logistique/Listes sont 4 tabs/slides de premier niveau
   * (au lieu d'un unique onglet "Général" avec switch interne, voir
   * ROADMAP.md "UX / Interactions") — même ordre qu'avant (ce bloc précède
   * toujours les jours), "Résumé" ajouté en tête le 2026-08-01. `id: 'notes'`
   * gardé tel quel en interne pour "Listes" (NotesFocusService, fragment
   * d'URL...) : seul le libellé change.
   */
  readonly tabs = computed<TripTab[]>(() => [
    { id: 'summary', label: 'Résumé' },
    { id: 'activities', label: 'Activités' },
    { id: 'logistics', label: 'Logement & Transport' },
    { id: 'notes', label: 'Listes' },
    ...this.sortedDays().map(d => this.formatDayTab(d.id)),
  ]);

  /**
   * "+" flottant UNIQUE (voir TripCreationTargetService) : icône/libellé
   * contextuels sur les tabs Activités/Logistique/Listes (création directe,
   * voir `onFabActivate`), génériques sinon (jour ou Résumé, ouvre le menu
   * "Ajouter" — voir addMenuItems, ROADMAP.md "UX / Interactions").
   */
  protected readonly fabIcon = computed(() => {
    switch (this.activeDay()) {
      case 'activities': return 'pi pi-map-marker';
      case 'logistics': return 'pi pi-bookmark';
      case 'notes': return 'pi pi-clipboard';
      default: return 'pi pi-plus';
    }
  });

  protected readonly fabAriaLabel = computed(() => {
    switch (this.activeDay()) {
      case 'activities': return 'Ajouter une activité';
      case 'logistics': return 'Ajouter un élément logistique';
      case 'notes': return 'Ajouter une liste';
      default: return 'Ajouter';
    }
  });

  /**
   * Sur Activités/Listes : création directe de l'élément propre à l'écran
   * affiché (`fabTarget.trigger`, cible enregistrée par ces composants). Sur
   * Logistique : ouvre le menu "Type" (voir `logisticsAddMenuItems`, type
   * connu AVANT création — pas de `fabTarget.trigger` ici, ce tab n'a plus
   * de cible enregistrée). Sur un jour ET sur Résumé : ouvre le menu
   * "Ajouter" (voir addMenuItems) ancré sur le bouton lui-même.
   */
  protected onFabActivate(): void {
    const day = this.activeDay();
    if (day === 'activities' || day === 'notes') {
      this.fabTarget.trigger(day);
      return;
    }
    const anchor = this.fabElementRef()?.nativeElement;
    if (!anchor) return;
    if (day === 'logistics') {
      this.logisticsAddMenu().toggleAt(anchor);
      return;
    }
    this.addMenu().toggleAt(anchor);
  }

  protected onSelectionCancel(): void {
    this.selectionService.cancel();
  }

  protected onSelectionDelete(): void {
    const tripId = this.facade.activeTrip()?.id;
    if (tripId) this.itemDeletionService.confirmDeleteSelected(tripId);
  }

  constructor() {
    this.bindPopState();

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

    // Le skeleton (voir `contentReady`) ne doit réapparaître que lors d'un
    // VRAI changement de trip (navigation vers un autre id) — pas à chaque
    // fois que `activeTrip()` change de RÉFÉRENCE, ce qui arrive aussi pour
    // le MÊME trip dès qu'un jour est ajouté/supprimé (`_tripDays`/`_days`,
    // voir CLAUDE.md "activeTrip") : `activeTrip()` recompose alors un nouvel
    // objet `Trip` même quand `id` n'a pas bougé. Sans le garde-fou
    // `contentReadyTripId` (même principe que `initializedTripId` juste
    // au-dessus), CE bloc se redéclenchait à CHAQUE édition d'intervalle de
    // dates (locale OU distante, ROADMAP.md "Bugs / fixes", retour
    // utilisateur : "la modification des dates entraîne l'affichage du
    // skeleton") — masquant jusqu'à 4s (filet de sécurité ci-dessous) un
    // contenu déjà à jour, avec l'impression trompeuse que "les dates n'ont
    // pas changé" une fois le skeleton reparti.
    effect(() => {
      const id = this.facade.activeTrip()?.id;
      if (!id || this.contentReadyTripId === id) return;
      this.contentReadyTripId = id;

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

    // Demande de navigation croisée symétrique (voir NotesFocusService) :
    // entrée "Liste" du menu "Ajouter" (création) OU chip "liste liée" depuis
    // une activité (voir `ActivityFormComponent`, ROADMAP.md "UX /
    // Interactions") basculent ici sur le tab Listes — NotesComponent
    // consomme ensuite la même requête (crée ou scrolle selon `itemId`).
    effect(() => {
      const pending = this.notesFocusService.pending();
      if (!pending || this.activeDay() === 'notes') return;

      this.activeDay.set('notes');
      const index = this.tabs().findIndex(t => t.id === 'notes');
      if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
      this.updateFragment('notes');
    });

    // Tour de navigation (src/specs/Parcours-new-user.md, étape 3) : mobile
    // uniquement (voir ViewportService.isMobileChrome, décision actée avec
    // l'utilisateur — la spec ne décrit que la barre de nav morphing mobile,
    // sans équivalent sur TripTabsNavComponent/desktop). Garde-fou migration
    // fonctionnalité (`UserProfileService.hasSeenOnboarding` retombe alors sur
    // `false`, comme un vrai nouvel utilisateur) — sans ce garde, ces comptes
    // reverraient le tour au prochain trip ouvert après déploiement.
    //
    // Vague immédiate, à l'arrivée sur Résumé : `OnboardingTourService.start`
    // est no-op si déjà vue ou si une séquence tourne déjà, donc rien
    // n'empêche cet effect de se redéclencher à chaque retour sur Résumé
    // (reprise si interrompu).
    effect(() => {
      if (!this.viewport.isMobileChrome() || this.activeDay() !== 'summary') return;
      if (!this.facade.activeTrip() || this.facade.activeTripLoading()) return;
      this.onboardingTour.start(IMMEDIATE_TOUR);
    });

    // Vagues différées (JIT), au 1er clic sur chaque onglet. Garde-fou
    // `activeDay() === 'activities'` par défaut (voir le `signal` plus haut,
    // valeur de départ avant que le trip ne soit chargé) : sans le même garde
    // `activeTrip()`/`activeTripLoading()` que l'effect ci-dessus, ce bloc
    // déclencherait à tort `ACTIVITIES_INTRO` dès le montage, avant même que
    // l'onglet initial réel ne soit posé.
    effect(() => {
      if (!this.viewport.isMobileChrome()) return;
      if (!this.facade.activeTrip() || this.facade.activeTripLoading()) return;
      const day = this.activeDay();
      if (day === 'activities') this.onboardingTour.start(ACTIVITIES_INTRO);
      else if (day === 'logistics') this.onboardingTour.start(LOGISTICS_INTRO);
      else if (day === 'notes') this.onboardingTour.start(NOTES_INTRO);
      else if (!GENERAL_TAB_IDS.includes(day)) this.onboardingTour.start(DAY_NAV_TOUR);
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
    this.popStateSub?.unsubscribe();
    document.documentElement.classList.remove(TRIP_DETAIL_ACTIVE_CLASS);
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
    return day ? day.id.toISOString() : 'summary';
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

  /**
   * `location.go` (push), pas `location.replaceState` (voir ROADMAP.md "UX /
   * Interactions") : chaque changement de tab/jour doit pouvoir être annulé
   * par le bouton "retour" du navigateur — `replaceState` écrasait
   * systématiquement l'entrée d'historique courante, rendant le retour
   * inopérant (il sortait du trip entièrement au lieu de revenir sur le
   * tab/jour précédent). `location.go` ne déclenche jamais `popstate` de
   * lui-même (voir doc Angular `Location.go`) : pas de risque de boucle avec
   * `bindPopState` ci-dessous, qui ne réagit qu'aux VRAIS retours/avances.
   */
  private updateFragment(tabId: string): void {
    const basePath = this.location.path(false);
    const fragment = this.fragmentFor(tabId);
    const newPath = fragment ? `${basePath}#${fragment}` : basePath;
    if (newPath === this.location.path(true)) return;
    this.location.go(newPath);
  }

  private fragmentFor(tabId: string): string | null {
    if (GENERAL_TAB_IDS.includes(tabId)) return tabId;
    const dayNumber = this.sortedDays().findIndex(d => d.id.toISOString() === tabId) + 1;
    return dayNumber > 0 ? `day-${dayNumber}` : null;
  }

  /**
   * Consomme les VRAIS retours/avances navigateur (`Location.subscribe` ne
   * réagit qu'au `popstate` réel — jamais à nos propres `location.go`
   * programmatiques, voir la doc de `updateFragment`) : resynchronise
   * `activeDay`/le swiper/la barre de tabs sur le fragment retrouvé dans
   * l'URL, sans repousser de nouvelle entrée d'historique (sinon "retour"
   * avancerait à nouveau au lieu de reculer).
   */
  private bindPopState(): void {
    this.popStateSub = this.location.subscribe((event) => {
      const hashIndex = (event.url ?? '').indexOf('#');
      const fragment = hashIndex >= 0 ? decodeURIComponent(event.url!.slice(hashIndex + 1)) : null;
      const dayId = this.getDayIdFromFragment(fragment);
      if (!dayId || dayId === this.activeDay()) return;

      this.activeDay.set(dayId);
      const index = this.tabs().findIndex(t => t.id === dayId);
      if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
    });
  }
}