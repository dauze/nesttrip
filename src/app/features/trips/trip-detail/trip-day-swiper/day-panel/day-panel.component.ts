import {
  afterNextRender,
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
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
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

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [
    TimelineComponent, ActivityCardComponent, PanelComponent, MessageComponent, SkeletonComponent,
    NewActivityDraftComponent,
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
  protected readonly scrollSync = inject(DayScrollSyncService);
  protected readonly reorderService = inject(DayReorderService);
  protected readonly creationService = inject(DayActivityCreationService);

  readonly collapsed = this.googleMapPanelService.isCollapsed;

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');
  /** Conteneur flex de la liste — voir `lockActivityListHeight` : sa hauteur est figée pendant un drag pour ne pas "sauter" quand la carte draguée quitte le flux. */
  private readonly activityList = viewChild<ElementRef<HTMLElement>>('activityList');

  // Ce jour n'a de carte "à lui" que lorsqu'il est actif : l'instance
  // partagée (jamais recréée) est alors physiquement déplacée dans son
  // conteneur sticky par TripDayMapHostService.
  readonly activeMapComponent = computed(() => (this.active() ? this.mapHost.activeMap() : null));

  readonly active = input(false);

  activitiesCollapsed = false;

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getDayActivities(this.dayId())());

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
      }));
  });

  constructor() {
    // 1. Gestionnaire réactif pour mettre à jour les points de la carte
    effect(() => {
      const map = this.activeMapComponent();
      if (map) {
        map.points.set(this.dayMapPoints());
      }
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
      const container = this.stickyMap()?.nativeElement;
      const map = this.mapHost.activeMap();
      if (!container || !map) return;

      this.mapHost.moveTo(container);
      this.scrollSync.attachMap(map);
    });

    this.scrollSync.connect({
      isActive: () => this.active(),
      getSlideEl: () => this.getSlideEl(),
      getFreshOffsets: () => this.getFreshCardOffsets(),
      getDayMapPoints: () => this.dayMapPoints(),
      getMapComponent: () => this.activeMapComponent(),
      getStickyMapEl: () => this.stickyMap()?.nativeElement ?? null,
    });

    this.reorderService.connect({
      getCards: () => this.activityCards(),
      getActivities: () => this.activities(),
      getTripId: () => this.tripId(),
      getDayId: () => this.dayId(),
      getSlideEl: () => this.getSlideEl(),
      getFreshOffsets: () => this.getFreshCardOffsets(),
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
      const unregisterFab = this.fabTarget.registerDay(this.dayId().toISOString(), () => this.creationService.startCreation());
      onCleanup(unregisterFab);
    });

    // Le nettoyage (listeners globaux, observers, boucles rAF, geste de
    // reorder éventuellement en cours) est automatique : DayScrollSyncService
    // et DayReorderService étant fournis par CE composant (voir `providers`),
    // Angular appelle leur `ngOnDestroy()` à la destruction de l'instance.
    afterNextRender(() => {
      this.scrollSync.startListening();
    });
  }

  /** Conteneur de scroll isolé de ce jour : le `swiper-slide` ancêtre (voir shared/utils/scroll-container.ts). */
  private getSlideEl(): HTMLElement | null {
    return getScrollContainer(this.elRef.nativeElement);
  }

  onActivitiesPanelToggled() {
    // Laisse le temps à l'animation PrimeNG de se terminer avant d'ajuster le scroll
    setTimeout(() => this.scrollSync.wakeLoop(), 300);
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
}