import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, input, signal, viewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { ViewportService } from '@core/services/viewport.service';
import { TripChromeService } from '@core/services/trip-chrome.service';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META, LogisticTypeMeta } from './logistic.constants';
import { LogisticCardComponent } from './logistic-card/logistic-card.component';
import { FabBottomProximityDirective } from '@app/shared/directives/fab-bottom-proximity.directive';
import { getScrollContainer, smoothScrollTo } from '@app/shared/utils/scroll-container';
import { pollUntilReady } from '@app/shared/utils/poll-until-ready.util';

type SortMode = 'type' | 'chrono';
const SORT_MODES: SortMode[] = ['type', 'chrono'];

/** Ordre d'affichage fixe des sections en tri "Type" — celui de `LOGISTIC_TYPE_META`. */
const TYPE_ORDER = Object.keys(LOGISTIC_TYPE_META) as LogisticType[];

/** Un groupe (section) de la vue "Type" — un vrai `<app-panel>` par groupe, voir `typeGroups`. */
interface TypeGroup {
  type: LogisticType;
  meta: LogisticTypeMeta;
  logistics: Logistic[];
}

function matchesSearch(title: string, term: string): boolean {
  if (!term) return true;
  return title.toLowerCase().includes(term);
}

/**
 * Sous-menu "Logistique" : liste de `LogisticCardComponent`, deux modes de
 * tri (voir ROADMAP.md, même principe que `TripActivitiesComponent`) :
 * "Chronologie" (`allLogisticsSorted` — en cours/futures d'abord, passées à
 * la fin, inchangé) ou "Type" (regroupement Logement/Vol/Location voiture/
 * Train/Autre, ordre fixe, section masquée si vide), plus une barre de
 * recherche (titre). Le "+" flottant unique, sur ce tab, ouvre le menu
 * "Type" de `TripDetailComponent` (`logisticsAddMenuItems`/`onFabActivate`)
 * — MÊME chemin que le menu "Ajouter" d'un jour (`DayLogisticQuickAddService`) :
 * le type est toujours connu AVANT la création de l'élément (ROADMAP.md
 * "### UI", voir la doc de `typeGroups` pour le pourquoi — un élément créé
 * dans le mauvais type puis basculé APRÈS coup pouvait faire sauter sa carte
 * d'une section à l'autre, cassant la cinématique guidée en cours).
 */
@Component({
  selector: 'app-logistics-list',
  standalone: true,
  imports: [CardComponent, MessageComponent, ButtonComponent, PanelComponent, SelectButtonComponent, InputTextDirective, LogisticCardComponent, FabBottomProximityDirective],
  templateUrl: './logistics-list.component.html',
  styleUrl: './logistics-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogisticsListComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly logisticFocusService = inject(LogisticFocusService);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly viewport = inject(ViewportService);
  private readonly chromeService = inject(TripChromeService);

  private readonly logisticCards = viewChildren(LogisticCardComponent);

  readonly tripId = input.required<string>();

  // Restaure le tri depuis l'URL (?sort=...) au montage — voir onSortModeChange,
  // qui l'y écrit à chaque changement (même principe que TripActivitiesComponent).
  readonly sortMode = signal<SortMode>(this.readSortModeFromUrl() ?? 'type');
  // Source de vérité UNIQUE dans `TripCreationTargetService` (pas un signal
  // local) : le menu "Type" du "+" flottant vit dans `TripDetailComponent`
  // (voir sa doc, ROADMAP.md "### UI") et doit lire/vider la même recherche
  // pour le préremplissage du titre — voir `TripCreationTargetService.logisticsSearchTerm`.
  readonly searchTerm = this.fabTarget.logisticsSearchTerm;

  readonly sortOptions: SelectButtonOption<SortMode>[] = [
    { label: 'Type', value: 'type', icon: 'pi pi-tag' },
    { label: 'Chronologie', value: 'chrono', icon: 'pi pi-calendar' },
  ];

  private readonly normalizedSearch = computed(() => this.searchTerm().trim().toLowerCase());

  private readonly allSorted = computed(() => this.tripFacade.allLogisticsSorted(this.tripId()));

  private readonly filtered = computed(() => {
    const term = this.normalizedSearch();
    return this.allSorted().filter((r) => matchesSearch(r.title, term));
  });

  readonly hasNoLogisticAtAll = computed(() => this.allSorted().length === 0);

  /** Chronologique + recherche : liste plate inchangée. */
  readonly chronoLogistics = computed(() => this.filtered());

  /**
   * Type + recherche : un vrai groupe par type (`<app-panel [thickBorder]>`
   * dans le template, MÊME composant que les groupes ville/jour du pool
   * d'activités — ROADMAP.md "### UI", décision explicite de l'utilisateur
   * malgré le risque documenté ci-dessous), sections dans l'ordre fixe de
   * `LOGISTIC_TYPE_META`, masquées si vides.
   *
   * Risque connu et ACCEPTÉ (décision utilisateur) : des `@for` imbriqués
   * par type (un par groupe) signifient que si le TYPE d'un élément change
   * (ex. cinématique guidée qui commence par "Vol" avant que l'utilisateur
   * choisisse "Train"), cet élément change de boucle — si la section de
   * destination n'existait pas l'instant d'avant (0 élément de ce type),
   * Angular détruit la carte de l'ANCIENNE section et en recrée une NOUVELLE
   * dans la section qui vient d'apparaître, même avec `track logistic.id`
   * (le tracking ne dédoublonne qu'AU SEIN d'une même boucle). Un dialog CDK
   * de cinématique guidée ouvert sur l'ancienne instance (`ViewContainerRef`
   * local à `LogisticDetailsComponent`, voir `openTitleDialog`/
   * `openTextDialog`) se fermerait alors tout seul — régression déjà
   * rencontrée et corrigée le 2026-07-30 (repro Playwright), réintroduite
   * ici sciemment sur demande explicite de l'utilisateur (rendu identique
   * au pool jugé prioritaire). À surveiller si le problème resurgit en usage
   * réel.
   */
  readonly typeGroups = computed<TypeGroup[]>(() => {
    const items = this.filtered();
    const groups: TypeGroup[] = [];
    for (const type of TYPE_ORDER) {
      const logistics = items.filter((r) => r.type === type);
      if (!logistics.length) continue;
      groups.push({ type, meta: LOGISTIC_TYPE_META[type], logistics });
    }
    return groups;
  });

  readonly matchCount = computed(() => this.filtered().length);

  constructor() {
    // Demande de navigation croisée (voir LogisticFocusService) : consomme
    // la requête dès que ce composant est monté (tab déjà basculé par
    // TripDetailComponent), déplie la carte ciblée et y scrolle — plus de
    // dialog à ouvrir, la carte est déjà dans la liste.
    effect(() => {
      const pending = this.logisticFocusService.pending();
      if (!pending) return;

      afterNextRender(() => this.focusCardWhenReady(pending.logisticId, pending.token, !!pending.startGuided, pending.originDayId), { injector: this.injector });
    });
  }

  /**
   * Retente sur quelques frames avant d'abandonner silencieusement — même
   * raison que `DayScrollSyncService.focusActivityWhenReady` : ce composant
   * vient parfois d'être monté à l'instant (bascule d'onglet juste avant),
   * donc `logisticCards()` (viewChildren) peut ne pas encore refléter le
   * tout premier rendu au moment du `afterNextRender`. Sans retry, la carte
   * ciblée ne se dépliait/scrollait jamais dans ce cas. `startGuided` : créé
   * depuis le menu "Ajouter" d'un jour (voir `DayLogisticQuickAddService`,
   * `LogisticFocusRequest`) — le type est déjà connu, on enchaîne direct sur
   * la cinématique guidée (sans réétape "Type") plutôt que juste déplier.
   * `originDayId` : une fois la cinématique guidée terminée, revient sur ce
   * jour (`DayActivityFocusService.requestFocus`, même service que le tab
   * Activités utilise pour naviguer vers un jour — sans `instanceId`, il se
   * contente de changer de jour actif sans tenter de scroller vers une
   * activité, voir ROADMAP.md "UX / Interactions"). Uniquement sur mobile :
   * `LogisticDetailsComponent.startGuidedEntry` est un no-op immédiat sur
   * desktop (formulaire déjà entièrement visible), donc sans cette garde le
   * retour se déclencherait aussitôt la carte créée, avant même que
   * l'utilisateur ait pu la voir.
   */
  private focusCardWhenReady(logisticId: string, token: number, startGuided: boolean, originDayId?: string): void {
    pollUntilReady(
      () => this.logisticCards().find((c) => c.logisticId() === logisticId),
      (card) => {
        this.logisticFocusService.clear(token);
        card.collapsed.set(false);
        // Deux rAF avant de scroller (ROADMAP.md "Bugs / fixes", même correctif
        // que `DayReorderService` pour le même symptôme) : `collapsed.set(false)`
        // ne déplie pas la carte de façon synchrone (transition CSS + rendu
        // Angular) — sans cette attente, on mesurerait encore la géométrie
        // "carte repliée", pas sa position finale une fois dépliée.
        requestAnimationFrame(() => requestAnimationFrame(() => this.scrollCardToVisibleCenter(card.element)));
        if (startGuided) {
          const done = card.startGuidedEntry();
          if (originDayId && this.viewport.isMobile()) done.then(() => this.dayActivityFocusService.requestFocus(originDayId));
        }
      },
    );
  }

  /**
   * Centre `el` dans la zone RÉELLEMENT visible du scrollport (ROADMAP.md
   * "Bugs / fixes" : "le scroll ne centre pas l'élément logistique,
   * décalage de la hauteur de la toolbar") — remplace le `scrollIntoView`
   * natif utilisé auparavant, aveugle au chrome fixe (`TripChromeService`,
   * `position:fixed`, se masque au scroll sans jamais réduire la hauteur de
   * mesure du scrollport) : centrer "à l'aveugle" revenait à centrer sur une
   * zone dont le haut peut être recouvert par la toolbar, d'où le décalage.
   * `getVisibleChromeHeight()` donne la portion encore effectivement visible
   * du chrome à l'instant du calcul (0 une fois masqué au scroll).
   */
  private scrollCardToVisibleCenter(el: HTMLElement): void {
    const container = getScrollContainer(el);
    if (!container) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();
    const visibleChromeHeight = this.chromeService.getVisibleChromeHeight();

    const targetCenterInContainer = targetRect.top - containerRect.top + targetRect.height / 2;
    const desiredCenterInContainer = visibleChromeHeight + (containerRect.height - visibleChromeHeight) / 2;

    smoothScrollTo(container, container.scrollTop + (targetCenterInContainer - desiredCenterInContainer));
  }

  onSortModeChange(mode: SortMode | undefined): void {
    if (!mode) return;
    this.sortMode.set(mode);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { logisticsSort: mode },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private readSortModeFromUrl(): SortMode | null {
    const value = this.route.snapshot.queryParamMap.get('logisticsSort');
    return SORT_MODES.includes(value as SortMode) ? (value as SortMode) : null;
  }

  onSearchInput(event: Event): void {
    this.fabTarget.setLogisticsSearchTerm((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.fabTarget.setLogisticsSearchTerm('');
  }

  /** Voir `FabBottomProximityDirective`/`TripCreationTargetService.avoidEdge` (ROADMAP.md "UX / Interactions") : évitement de bord du "+" flottant. */
  onFabNearBottomChange(nearBottom: boolean): void {
    this.fabTarget.setAvoidEdge(nearBottom);
  }
}
