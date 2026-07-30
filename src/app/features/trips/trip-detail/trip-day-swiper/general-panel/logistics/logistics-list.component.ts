import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, input, signal, viewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META, LogisticTypeMeta } from './logistic.constants';
import { LogisticCardComponent } from './logistic-card/logistic-card.component';
import { LogisticsCreationService } from './logistics-creation.service';

type SortMode = 'type' | 'chrono';
const SORT_MODES: SortMode[] = ['type', 'chrono'];

/** Ordre d'affichage fixe des sections en tri "Type" — celui de `LOGISTIC_TYPE_META`. */
const TYPE_ORDER = Object.keys(LOGISTIC_TYPE_META) as LogisticType[];

/**
 * Une ligne de la vue "Type" : soit un en-tête de section, soit une carte.
 * Volontairement une liste PLATE (une seule boucle `@for`, voir le template)
 * plutôt que des groupes imbriqués avec leur propre `@for` par section —
 * voir `typeRows` pour la raison (régression du 2026-07-30).
 */
type TypeRow =
  | { kind: 'header'; type: LogisticType; meta: LogisticTypeMeta; count: number }
  | { kind: 'item'; logistic: Logistic };

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
 * recherche (titre). Pas de bouton "Ajouter" local, la création passe
 * exclusivement par le "+" flottant unique (voir
 * `GeneralPanelComponent.onFabActivate` -> `triggerCreate()` ci-dessous).
 */
@Component({
  selector: 'app-logistics-list',
  standalone: true,
  imports: [PanelComponent, MessageComponent, ButtonComponent, SelectButtonComponent, InputTextDirective, LogisticCardComponent],
  templateUrl: './logistics-list.component.html',
  styleUrl: './logistics-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LogisticsCreationService],
})
export class LogisticsListComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly logisticFocusService = inject(LogisticFocusService);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly creationService = inject(LogisticsCreationService);

  private readonly logisticCards = viewChildren(LogisticCardComponent);

  readonly tripId = input.required<string>();

  // Restaure le tri depuis l'URL (?sort=...) au montage — voir onSortModeChange,
  // qui l'y écrit à chaque changement (même principe que TripActivitiesComponent).
  readonly sortMode = signal<SortMode>(this.readSortModeFromUrl() ?? 'type');
  readonly searchTerm = signal('');

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
   * Type + recherche : une liste PLATE de lignes (en-tête de section ou
   * carte), sections dans l'ordre fixe de LOGISTIC_TYPE_META, masquées si
   * vides, ordre chronologique conservé à l'intérieur (déjà celui de
   * `filtered()`). Une seule boucle `@for` sur ce tableau (voir le template)
   * — PAS des groupes imbriqués avec chacun leur propre `@for` par type :
   * quand le type d'un élément change (ex. cinématique guidée qui commence
   * par choisir "Vol"), il change de section. Avec des `@for` imbriqués, la
   * section de destination n'existait pas forcément l'instant d'avant (0
   * élément de ce type) — Angular détruit alors la carte de l'ANCIENNE
   * section et en recrée une NOUVELLE dans la section qui vient d'apparaître,
   * même avec `track logistic.id` (le tracking ne dédoublonne qu'AU SEIN
   * d'une même boucle, pas entre deux boucles différentes). Ça coupait net
   * la cinématique guidée en cours (son `ViewContainerRef`, donc tout dialog
   * CDK ouvert dessus, est détruit avec l'ancienne instance) — reproduit et
   * confirmé via Playwright (le dialog "Numéro de vol" se fermait de
   * lui-même, `dialogRef.closed` émettant `undefined`, juste après la
   * sélection du type dans la cinématique guidée). Une seule boucle plate
   * (`track` par id de carte, id préfixé pour les en-têtes) : Angular
   * détecte un simple DÉPLACEMENT de la même entité trackée et déplace le
   * nœud DOM/l'instance de composant au lieu de la détruire.
   */
  readonly typeRows = computed<TypeRow[]>(() => {
    const items = this.filtered();
    const rows: TypeRow[] = [];
    for (const type of TYPE_ORDER) {
      const group = items.filter((r) => r.type === type);
      if (!group.length) continue;
      rows.push({ kind: 'header', type, meta: LOGISTIC_TYPE_META[type], count: group.length });
      for (const logistic of group) rows.push({ kind: 'item', logistic });
    }
    return rows;
  });

  readonly matchCount = computed(() => this.filtered().length);

  constructor() {
    this.creationService.connect({
      getCards: () => this.logisticCards(),
      getTripId: () => this.tripId(),
    });

    // Demande de navigation croisée (voir LogisticFocusService) : consomme
    // la requête dès que ce composant est monté (sous-onglet déjà basculé par
    // GeneralPanelComponent), déplie la carte ciblée et y scrolle — plus de
    // dialog à ouvrir, la carte est déjà dans la liste.
    effect(() => {
      const pending = this.logisticFocusService.pending();
      if (!pending) return;

      afterNextRender(() => this.focusCardWhenReady(pending.logisticId, pending.token, !!pending.startGuided), { injector: this.injector });
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
   */
  private focusCardWhenReady(logisticId: string, token: number, startGuided: boolean, attemptsLeft = 15): void {
    const card = this.logisticCards().find((c) => c.logisticId() === logisticId);
    if (!card) {
      if (attemptsLeft <= 0) return;
      requestAnimationFrame(() => this.focusCardWhenReady(logisticId, token, startGuided, attemptsLeft - 1));
      return;
    }

    this.logisticFocusService.clear(token);
    card.collapsed.set(false);
    card.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (startGuided) card.startGuidedEntry(true);
  }

  /** Point d'entrée unique du "+" flottant, porté par `GeneralPanelComponent` (pas ce composant). */
  triggerCreate(): void {
    this.creationService.startCreation();
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
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }
}
