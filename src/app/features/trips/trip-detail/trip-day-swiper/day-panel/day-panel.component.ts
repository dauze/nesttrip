import {
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  Signal,
  viewChild,
  viewChildren,
  ViewContainerRef
} from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { DayLogisticBannerComponent } from './day-logistic-banner/day-logistic-banner.component';
import { MergedDayEntry } from './day-logistic-banner/day-timeline-merge';
import { LogisticDayOccurrence } from './day-logistic-banner/logistic-day-occurrence';
import { Activity, ActivityEcho } from '@app/shared/components/activity-card/activity.model';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { ActivityEchoCardComponent } from '@app/shared/components/activity-card/activity-echo-card/activity-echo-card.component';
import { DayLogisticEntryComponent, logisticRowId } from './day-logistic-entry/day-logistic-entry.component';
import { DraggableDayRow } from './draggable-day-row';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { getScrollContainer } from '@app/shared/utils/scroll-container';
import { DayScrollSyncService } from './day-scroll-sync.service';
import { DayReorderService } from './day-reorder.service';
import { DayActivityCreationService } from './day-activity-creation.service';
import { NewActivityDraftComponent } from './new-activity-draft/new-activity-draft.component';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';
import { FabBottomProximityDirective } from '@app/shared/directives/fab-bottom-proximity.directive';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TimelineComponent, ActivityCardComponent, ActivityEchoCardComponent, DayLogisticEntryComponent, PanelComponent, MessageComponent, SkeletonComponent,
    NewActivityDraftComponent, DayLogisticBannerComponent, FabBottomProximityDirective,
  ],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
  // Une instance par jour affiché (pas root) : voir la doc de DayScrollSyncService/DayReorderService.
  providers: [DayScrollSyncService, DayReorderService, DayActivityCreationService],
})
export class DayPanelComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly mapHost = inject(TripDayMapHostService);
  private readonly googleMapPanelService = inject(GoogleMapPanelService);
  private readonly dispatchService = inject(ActivityDispatchService);
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly focusService = inject(DayActivityFocusService);
  private readonly viewport = inject(ViewportService);
  private readonly chromeService = inject(TripChromeService);
  protected readonly scrollSync = inject(DayScrollSyncService);
  protected readonly reorderService = inject(DayReorderService);
  protected readonly creationService = inject(DayActivityCreationService);

  readonly collapsed = this.googleMapPanelService.isCollapsed;

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly logisticEntries = viewChildren(DayLogisticEntryComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');
  /** Conteneur flex de la liste — voir `lockActivityListHeight` : sa hauteur est figée pendant un drag pour ne pas "sauter" quand la carte draguée quitte le flux. */
  private readonly activityList = viewChild<ElementRef<HTMLElement>>('activityList');

  // Ce jour n'a de carte "à lui" que lorsqu'il est actif : l'instance
  // partagée (jamais recréée) est alors physiquement déplacée dans son
  // conteneur sticky par TripDayMapHostService.
  readonly activeMapComponent = computed(() => (this.active() ? this.mapHost.activeMap() : null));

  readonly active = input(false);

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getDayActivities(this.dayId())());

  /** Activités + échos + occurrences logistiques "frontière" (voir day-timeline-merge.ts) : consommé pour l'AFFICHAGE (timeline mini + liste principale) — le drag/la carte/la création restent sur `activities()`, qui ne contient ni écho ni logistique. */
  readonly timelineEntries: Signal<MergedDayEntry[]> = computed(() => this.tripFacade.getMergedDayTimeline(this.tripId(), this.dayId()));

  readonly dayMapPoints = computed<DayMapPoint[]>(() => {
    return this.activities()
      .filter(a => a.placeId && a.latitude && a.longitude)
      .map((a, i) => ({
        activityId: a.id,
        placeId: a.placeId!,
        name: a.title,
        latitude: a.latitude!,
        longitude: a.longitude!,
        order: i + 1,
        photoRef: a.photoRefs?.[0],
      }));
  });

  constructor() {
    // 1. Gestionnaire réactif pour mettre à jour les points de la carte.
    // `moveTo` est répété ici (idempotent, early-return si déjà le bon
    // conteneur) juste avant `points.set`, et TOUT le corps de l'effect est
    // gardé derrière la disponibilité de `container` — même correctif que
    // `TripActivitiesComponent` (voir sa doc, ROADMAP.md "UX / Interactions") :
    // `#stickyMap` n'existe dans le DOM que sous `@if (activities().length > 0)`,
    // donc au tout premier passage où `dayMapPoints()` devient non-vide,
    // `stickyMap()` pouvait encore valoir `undefined` — l'ancien effect
    // séparé plus bas (moveTo/attachMap) n'avait alors pas encore eu la
    // chance de positionner `mapHost.currentOwner()` à `'day'`, laissant
    // l'effect interne de `TripDayMapComponent` (qui recentre sur le 1er
    // point à chaque changement de `points`, sauf si `currentOwner` vaut
    // déjà le bon contexte) lire une valeur périmée — la vue d'ensemble
    // initiale du jour n'apparaissait plus au premier montage.
    effect(() => {
      const map = this.activeMapComponent();
      const container = this.mapContainerEl();
      if (!map || !container) return;
      this.mapHost.moveTo(container, 'day');
      map.points.set(this.dayMapPoints());
    });

    // Visibilité du clone de suivi réactive à l'escalade — pas seulement
    // réévaluée au pointermove suivant (comme avant, voir historique dans
    // `handleDragPointerMove`) : sinon, si le doigt reste immobile pile au
    // moment où l'escalade démarre (fin du survol prolongé de la barre) ou
    // se termine (désescalade), le clone garde son ancien état de visibilité
    // jusqu'au prochain mouvement — fenêtre où ni lui ni la bulle
    // (ActivityDayDispatchOverlayComponent) ne sont visibles.
    effect(() => {
      const escalated = this.dispatchService.dayEscalated();
      const drag = this.reorderService.currentDrag;
      const clone = drag?.cloneEl;
      if (!clone || !drag) return;

      if (escalated) {
        clone.style.visibility = 'hidden';
        return;
      }

      // À la réapparition (désescalade), son `transform` n'a plus bougé
      // depuis le début de l'escalade : `handleDragPointerMove` s'arrête
      // court-circuité tant que `dayEscalated()` est vrai (voir plus bas),
      // donc le clone est resté figé à sa position d'AVANT le survol du
      // calendrier. Sans le repositionner ici, il réapparaît loin de l'endroit
      // où la bulle vient de s'effacer (sous le doigt) — d'où l'impression
      // que "la bulle disparaît" sans que rien ne prenne le relais visible.
      const pointer = this.dispatchService.pointer();
      clone.style.transform = `translate3d(${pointer.x - drag.startClientX}px, ${pointer.y - drag.startClientY}px, 0)`;
      clone.style.visibility = '';
    });

    // 2. Quand ce jour devient actif, on récupère l'instance UNIQUE de la
    // carte (créée une seule fois par TripDaySwiperComponent, jamais
    // recréée) et on la déplace physiquement dans notre conteneur sticky.
    effect(() => {
      if (!this.active()) return;
      const container = this.mapContainerEl();
      const map = this.mapHost.activeMap();
      if (!container || !map) return;

      this.mapHost.moveTo(container, 'day');
      this.scrollSync.attachMap(map);
    });

    this.scrollSync.connect({
      isActive: () => this.active(),
      getSlideEl: () => this.getSlideEl(),
      getFreshOffsets: () => this.getFreshCardOffsets(),
      getDayMapPoints: () => this.dayMapPoints(),
      getMapComponent: () => this.activeMapComponent(),
      getStickyMapEl: () => this.mapContainerEl(),
      isSplitLayout: () => this.viewport.isSplitLayout(),
      getPinnedChromeOffset: () => this.chromeService.stickyContentTop(),
      getLogisticOffsets: () => this.getFreshLogisticOffsets(),
    });

    this.reorderService.connect({
      getCards: () => this.getRows(),
      getTripId: () => this.tripId(),
      getDayId: () => this.dayId(),
      getSlideEl: () => this.getSlideEl(),
      getFreshOffsets: () => this.getFreshRowOffsets(),
      getActivityListEl: () => this.activityList()?.nativeElement ?? null,
      notifyRenderFlush: () => this.cdr.detectChanges(),
    });

    this.creationService.connect({
      getCards: () => this.activityCards(),
      getTripId: () => this.tripId(),
      getDayId: () => this.dayId(),
      getViewContainerRef: () => this.viewContainerRef,
    });

    // effect() (pas un appel direct dans le constructeur) : `dayId` est un
    // input required, pas garanti résolu avant la première détection de
    // changements. Jusqu'à 3 instances de DayPanelComponent peuvent coexister
    // (préchargement des jours voisins, voir TripDaySwiperComponent.preloadAround)
    // — seul le "+" flottant, qui connaît le jour COURANT, appellera jamais ce trigger.
    effect((onCleanup) => {
      const unregisterFab = this.fabTarget.register(this.dayId().toISOString(), () => this.creationService.startCreation());
      onCleanup(unregisterFab);
    });

    // Consommation d'une demande de navigation croisée (voir
    // DayActivityFocusService, émise depuis le tab Activités au clic sur une
    // date). `pending()` ET `active()` sont lus AVANT le `if` (pas de
    // court-circuit) : sinon Angular perdrait la dépendance sur `pending`
    // quand `active()` ne change pas d'une exécution à l'autre (cas où on
    // clique sur une date d'un jour déjà actif — il faut quand même
    // re-scroller).
    effect(() => {
      const pending = this.focusService.pending();
      const isActive = this.active();
      if (!pending || !isActive || pending.dayId !== this.dayId().toISOString()) return;

      this.focusService.clear(pending.token);
      if (pending.instanceId) this.scrollSync.focusActivityWhenReady(pending.instanceId);
    });

    // Le nettoyage (listeners globaux, observers, boucles rAF, geste de
    // reorder éventuellement en cours) est automatique : DayScrollSyncService
    // et DayReorderService étant fournis par CE composant (voir `providers`),
    // Angular appelle leur `ngOnDestroy()` à la destruction de l'instance.
    afterNextRender(() => {
      this.scrollSync.startListening();
    });

    // Répercute cette instance sur `TripChromeService.dayPanelActive` (voir sa
    // doc) : jusqu'à 3 instances de DayPanelComponent peuvent coexister
    // (préchargement des jours voisins), seule celle avec `active()===true`
    // doit compter — `onCleanup` remet `false` si CETTE instance est détruite
    // alors qu'elle était l'active courante (sortie de trip-detail).
    effect((onCleanup) => {
      const isActive = this.active();
      this.chromeService.setDayPanelActive(isActive);
      onCleanup(() => { if (isActive) this.chromeService.setDayPanelActive(false); });
    });
  }

  /** Conteneur de scroll isolé de ce jour : le `swiper-slide` ancêtre (voir shared/utils/scroll-container.ts). */
  private getSlideEl(): HTMLElement | null {
    return getScrollContainer(this.elRef.nativeElement);
  }

  /**
   * Conteneur cible pour la carte partagée en contexte 'day' (ROADMAP.md
   * "### UI") : en layout scindé (desktop, carte en colonne à gauche), le
   * `.sticky-map` local à CE day-panel — la notion de "sortir du scroll" n'a
   * pas de sens là-bas (carte déjà en pleine hauteur de sa propre colonne).
   * En layout empilé (mobile/tablette), le conteneur `position:fixed` partagé
   * posé par `TripDaySwiperComponent` hors du swiper (voir
   * `TripDayMapHostService.dayFixedContainer`) — la carte y est réellement
   * sortie du scroll, plus seulement "sticky" dedans.
   */
  private mapContainerEl(): HTMLElement | null {
    if (this.viewport.isSplitLayout()) return this.stickyMap()?.nativeElement ?? null;
    return this.mapHost.dayFixedContainer();
  }

  /** Clic sur un écho dans la timeline mini (voir TimelineComponent) : navigue vers l'instance réelle sur son jour d'origine. */
  onEchoSelected(echo: ActivityEcho): void {
    this.focusService.requestFocus(echo.originDayId.toISOString(), echo.originInstanceId);
  }

  /** Clic sur une occurrence logistique dans la timeline mini : scroll dans CE jour (pas de navigation vers l'onglet Logistique, contrairement au tap sur la carte elle-même). */
  onLogisticEntrySelected(occurrence: LogisticDayOccurrence): void {
    this.scrollSync.focusLogisticEntry(occurrence.logistic.id, occurrence.role);
  }

  /** Voir `FabBottomProximityDirective`/`TripCreationTargetService.avoidEdge` (ROADMAP.md "UX / Interactions") : évitement de bord du "+" flottant. */
  onFabNearBottomChange(nearBottom: boolean): void {
    this.fabTarget.setAvoidEdge(nearBottom);
  }

  /**
   * Offsets "pseudo-absolus" des cartes, stables quel que soit le scroll
   * courant du slide : `rect.top` (relatif viewport, bouge avec le scroll
   * interne du slide) - `slideRect.top` (position écran fixe du slide, la
   * carte Google ne le déplace jamais verticalement) + `slideEl.scrollTop`
   * (scroll interne courant) — même principe que l'ancien `rect.top + window.scrollY`,
   * juste réancré sur le conteneur de scroll isolé du jour (voir CLAUDE.md).
   */
  getFreshCardOffsets(): { card: ActivityCardComponent; top: number; height: number }[] {
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

  /** Même calcul que `getFreshCardOffsets`, pour les entrées logistique inline de la liste principale — voir `DayScrollSyncService.focusLogisticEntry`. */
  getFreshLogisticOffsets(): { logisticId: string; role: string; top: number }[] {
    const entries = this.logisticEntries();
    const slideEl = this.getSlideEl();
    const slideTop = slideEl?.getBoundingClientRect().top ?? 0;
    const slideScrollTop = slideEl?.scrollTop ?? 0;

    return entries.map(entry => {
      const rect = entry.hostElement.getBoundingClientRect();
      return {
        logisticId: entry.logisticId,
        role: entry.role,
        top: rect.top - slideTop + slideScrollTop,
      };
    });
  }

  /**
   * Liste UNIFIÉE (activités + occurrences logistiques "frontière", voir
   * `DraggableDayRow`) consommée par `DayReorderService` — retour utilisateur
   * explicite, ROADMAP.md "Activités" : "Activité et transport/logement
   * doivent être dans la même pile pour le drag and drop". Parcourt
   * `timelineEntries()` (déjà dans le bon ordre visuel) et résout chaque
   * entrée vers son composant rendu ; les échos sont ignorés (jamais
   * draguables). SÉPARÉE de `activityCards()`/`getFreshCardOffsets()` (voir
   * leur doc) : ceux-ci restent activités-seules, consommés par
   * `DayScrollSyncService` (suivi caméra, `dayMapPoints` ne connaît que les
   * vraies activités) et `DayActivityCreationService`.
   */
  private getRows(): DraggableDayRow[] {
    const activityById = new Map(this.activityCards().map(c => [c.activityId(), c as DraggableDayRow]));
    const logisticById = new Map(this.logisticEntries().map(e => [e.rowId, e as DraggableDayRow]));

    const rows: DraggableDayRow[] = [];
    for (const entry of this.timelineEntries()) {
      if (entry.kind === 'activity') {
        const row = activityById.get(entry.activity.id);
        if (row) rows.push(row);
      } else if (entry.kind === 'logistic') {
        const row = logisticById.get(logisticRowId(entry.occurrence));
        if (row) rows.push(row);
      }
      // 'echo' : jamais draguable, volontairement absent de cette liste.
    }
    return rows;
  }

  /** Même principe que `getFreshCardOffsets`, sur la liste unifiée `getRows()` — dédié à `DayReorderService` uniquement. */
  private getFreshRowOffsets(): { card: DraggableDayRow; top: number; height: number }[] {
    const rows = this.getRows();
    const slideEl = this.getSlideEl();
    const slideTop = slideEl?.getBoundingClientRect().top ?? 0;
    const slideScrollTop = slideEl?.scrollTop ?? 0;

    return rows.map(row => {
      const rect = row.hostElement.getBoundingClientRect();
      return {
        card: row,
        top: rect.top - slideTop + slideScrollTop,
        height: rect.height,
      };
    });
  }
}