import { 
  afterNextRender, 
  Component, 
  ComponentRef, 
  computed, 
  DestroyRef, 
  effect, 
  ElementRef, 
  inject, 
  input, 
  NgZone, 
  Signal, 
  signal, 
  viewChild, 
  viewChildren 
} from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Activity } from './activity-card/activity.model';
import { PanelModule } from 'primeng/panel';
import { Button } from 'primeng/button';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityCardComponent } from './activity-card/activity-card.component';
import { MessageModule } from 'primeng/message';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';
import { TripDayMapComponent } from './trip-day-map/trip-day-map.component';
import { CdkPortalOutlet, ComponentPortal, PortalModule } from '@angular/cdk/portal';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, DragDropModule, PanelModule, Button, MessageModule, PortalModule],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly lockService = inject(SwiperLockService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  readonly mapPortal = input.required<ComponentPortal<TripDayMapComponent>>();
  readonly sharedMap = input<TripDayMapComponent>();

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');
  readonly portalOutlet = viewChild(CdkPortalOutlet);


  private scrollTimeout?: number;
  private isTouching = false;
  private isAutoScrolling = false;
  private readonly activeMapComponent = signal<TripDayMapComponent | null>(null);
  private mapSubscription?: { unsubscribe: () => void };

  readonly stickyHeight = signal(0);
  readonly stickyOffset = this.stickyHeight.asReadonly();
  readonly active = input(false);
  private rafLoop?: number;
  private lastScrollY = -1;
  private idleFrames = 0;
  private readonly IDLE_THRESHOLD = 30;
  private readonly ACTIVITY_SCROLL_GAP = 8;
    private readonly SNAP_DELAY = 500;
  private readonly SNAP_DISTANCE = 60;

  activitiesCollapsed = false;
  private pendingActivityId?: string;

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getActivities(this.dayId())());

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

    afterNextRender(() => {
      const el = this.stickyMap()?.nativeElement;
      if (!el) return;

      const mainContainer = el.parentElement; 
      let globalObserver: ResizeObserver | undefined;

      if (mainContainer) {
        // Le conteneur change de taille -> on recalcule la cinématique à la volée via wakeLoop
        globalObserver = new ResizeObserver(() => this.wakeLoop());
        globalObserver.observe(mainContainer);
      }

      // Écouteurs globaux branchés directement sur la boucle cinématique dynamique
      this.wakeLoop();
      window.addEventListener('resize', this.wakeLoop, { passive: true });
      window.addEventListener(
          'scroll',
          this.onWindowScroll,
          { passive: true }
        );

        window.addEventListener(
          'touchstart',
          this.onTouchStart,
          { passive: true }
        );

        window.addEventListener(
          'touchend',
          this.onTouchEnd,
          { passive: true }
        );
      window.addEventListener('touchstart', this.wakeLoop, { passive: true });
      window.addEventListener('touchmove', this.wakeLoop, { passive: true });
      window.addEventListener('wheel', this.wakeLoop, { passive: true });

      // Gestion de l'arrivée dynamique du composant Carte via le Portail CDK
      let mapObserver: ResizeObserver | undefined;
      const outlet = this.portalOutlet();
      
      if (outlet) {
        outlet.attached.subscribe((ref) => {
          if (ref && ref instanceof ComponentRef) {
            const mapComponent = ref.instance as TripDayMapComponent;
            this.activeMapComponent.set(mapComponent);

            // Reconnexion de l'événement de clic sur un marqueur
            this.mapSubscription?.unsubscribe();
            this.mapSubscription = mapComponent.activitySelected.subscribe((point) => {
              this.onMapPointClick(point);
            });

            if (mapObserver) mapObserver.disconnect();
            
            // On observe la vraie hauteur HTML du composant injecté
            mapObserver = new ResizeObserver(entries => {
              if (entries[0]) {
                window.requestAnimationFrame(() => {
                  this.stickyHeight.set(entries[0].contentRect.height);
                  this.wakeLoop(); 
                });
              }
            });
            
            mapObserver.observe(mapComponent.elementRef.nativeElement);

            // Correction d'affichage de l'API Google Maps après transfert du DOM
            setTimeout(() => {
              const nativeMap = mapComponent.googleMap;
              if (nativeMap) {
                google.maps.event.trigger(nativeMap, 'resize');
              }
            }, 100);
          }
        });
      }

      // Nettoyage complet à la destruction du composant
      this.destroyRef.onDestroy(() => {
        this.mapSubscription?.unsubscribe();
        if (mapObserver) mapObserver.disconnect();
        if (globalObserver) globalObserver.disconnect();
        window.removeEventListener('resize', this.wakeLoop);
       window.removeEventListener(
          'scroll',
          this.onWindowScroll
        );

        window.removeEventListener(
          'touchstart',
          this.onTouchStart
        );

        window.removeEventListener(
          'touchend',
          this.onTouchEnd
        );
        window.removeEventListener('touchmove', this.wakeLoop);
        window.removeEventListener('wheel', this.wakeLoop);
        if (this.rafLoop) cancelAnimationFrame(this.rafLoop);
      });
    });
  }

  protected onMapAttached(ref: any): void {
    // Le CdkPortalOutlet renvoie un ComponentRef quand il instancie/attache un composant
    const mapComponent = ref.instance as TripDayMapComponent;
    this.activeMapComponent.set(mapComponent);

    // Force le recalcul de géométrie de l'API Google Maps
    setTimeout(() => {
      const nativeMap = mapComponent.googleMap;
      if (nativeMap) {
        google.maps.event.trigger(nativeMap, 'resize');
        if (mapComponent.center()) {
          nativeMap.setCenter(mapComponent.center());
        }
      }
    }, 50);

    // Reconnexion de l'événement de clic (activitySelected)
    this.mapSubscription?.unsubscribe();
    this.mapSubscription = mapComponent.activitySelected.subscribe((point) => {
      this.onMapPointClick(point);
    });
  }

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.activities(), event.previousIndex, event.currentIndex);
    this.tripFacade.reorderActivities(
      this.tripId(),
      this.dayId(),
      this.activities().map((a) => a.id),
    );
    queueMicrotask(() => this.wakeLoop());
  }

  addActivity() {
    this.tripFacade.createActivity(this.tripId(), this.dayId(), {
      id: crypto.randomUUID(),
      title: '',
      type: ActivityType.ACTIVITE,
      duration: 0,
      price: { amount: 0, currency: 'EUR' },
      placeId: '',
      booking: { status: BookingStatus.NOT_NEEDED, deadline: undefined },
      notes: '',
      files: [],
      photoRefs: []
    });
    queueMicrotask(() => this.wakeLoop());
  }

  focusActivity(activityId: string): void {
    const freshOffsets = this.getFreshCardOffsets();

    const target = freshOffsets.find(
      item => item.card.activity()?.id === activityId
    );

    if (!target) {
      return;
    }

    const stickyElement = this.stickyMap()?.nativeElement;

    const stickyHeight = stickyElement
      ? stickyElement.getBoundingClientRect().height
      : this.stickyHeight();

    const targetScroll =
      target.top - stickyHeight - this.ACTIVITY_SCROLL_GAP;

    this.smoothScrollTo(targetScroll, 700);
  }

  onActivitiesPanelToggled() {
    if (this.pendingActivityId) {
      this.openCard(this.pendingActivityId);
      this.pendingActivityId = undefined;
    }
    // Laisse le temps à l'animation PrimeNG de se terminer avant d'ajuster le scroll
    setTimeout(() => this.wakeLoop(), 300);
  }

  private openCard(activityId: string): void {
    const card = this.activityCards().find(c => c.activity()?.id === activityId);
    if (card) {
      card.openAndScroll();
    }
  }

  onDragStarted() {
    this.lockService.lock();
  }

  onDragEnded() {
    this.lockService.unlock();
  }

  onMapPointClick(point: DayMapPoint) {
    this.focusActivity(point.activityId);
  }

  private wakeLoop = (): void => {
    this.idleFrames = 0;
    if (!this.rafLoop) {
      this.zone.runOutsideAngular(() => {
        this.rafLoop = requestAnimationFrame(this.tick);
      });
    }
  };

  private tick = (): void => {
    const currentScrollY = window.scrollY;

   if (currentScrollY !== this.lastScrollY || this.isAutoScrolling) {
      this.lastScrollY = currentScrollY;
      this.idleFrames = 0;
      this.updateMapFromScroll(currentScrollY);
    } else {
      this.idleFrames++;
    }

    if (this.idleFrames < this.IDLE_THRESHOLD) {
      this.rafLoop = requestAnimationFrame(this.tick);
    } else {
      this.rafLoop = undefined;
    }
  };

  private updateMapFromScroll(scrollY: number) {
    if (!this.active()) {
      return;
    }
  const freshOffsets = this.getFreshCardOffsets();
  if (freshOffsets.length === 0) return;

  const mapElement = this.stickyMap()?.nativeElement;
  if (!mapElement) return;

  // 1. Récupérer la hauteur réelle de la carte via son composant actif
  const activeMapComponent = this.activeMapComponent();
  const mapHeight = activeMapComponent?.elementRef?.nativeElement?.getBoundingClientRect().height || this.stickyHeight();

  // 2. Récupérer la hauteur du conteneur sticky global (qui contient ta timeline)
  // Comme getBoundingClientRect().height reste vraie même en sticky, on l'utilise !
  const stickyContainerHeight = mapElement.getBoundingClientRect().height;

  // 3. LA LIGNE DE DÉCLENCHEMENT EXACTE (SANS PIÈGE DU STICKY) :
  // C'est le scroll actuel + l'espace total occupé par tes éléments fixes à l'écran.
  // Si la map et la timeline sont l'une sur l'autre dans le bloc sticky, stickyContainerHeight englobe déjà le tout.
  // Par sécurité, on s'assure de prendre au moins la hauteur de la map.
  const totalStickyShield = Math.max(stickyContainerHeight, mapHeight);
  const triggerLine = scrollY + totalStickyShield;

  // 4. Trouver l'index de la carte par rapport à cette ligne
  const upcomingIndex = freshOffsets.findIndex(offset => offset.top > triggerLine);

  let fromIndex = 0;
  let toIndex = 0;
  let t = 0;

  if (upcomingIndex === -1) {
    fromIndex = freshOffsets.length - 1;
    toIndex = fromIndex;
    t = 1;
  } else if (upcomingIndex === 0) {
    fromIndex = 0;
    toIndex = 0;
    t = 0;
  } else {
    fromIndex = upcomingIndex - 1;
    toIndex = upcomingIndex;

    const fromCard = freshOffsets[fromIndex];
    const toCard = freshOffsets[toIndex];

    const span = toCard.top - fromCard.top;
    t = span !== 0 ? (triggerLine - fromCard.top) / span : 0;
    t = Math.min(1, Math.max(0, t));
  }

  const from = freshOffsets[fromIndex];
  const to = freshOffsets[toIndex];

  const fromId = from.card.activity()?.id;
  const toId = to.card.activity()?.id;
  if (!fromId || !toId) return;

  const fromPoint = this.dayMapPoints().find(p => p.activityId === fromId);
  const toPoint = this.dayMapPoints().find(p => p.activityId === toId);
  if (!fromPoint || !toPoint) return;

  this.mapRef()?.followScroll(fromPoint, toPoint, t);
}

  private get mapRef(): () => TripDayMapComponent | null {
    return () => this.activeMapComponent();
  }

  getFreshCardOffsets(): { card: ActivityCardComponent; top: number; height: number }[] {
    const cards = this.activityCards();
    const currentScrollY = window.scrollY;

    return cards.map(card => {
      const rect = card.element.getBoundingClientRect();
      return {
        card,
        top: rect.top + currentScrollY, 
        height: rect.height,
      };
    });
  }

  private smoothScrollTo(targetY: number, duration = 600): void {
      if (!this.active()) {
    return;
  }

  this.isAutoScrolling = true;
  const startY = window.scrollY;
  const distance = targetY - startY;

  const startTime = performance.now();

  const easeOutCubic = (t: number) =>
    1 - Math.pow(1 - t, 3);

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const eased = easeOutCubic(progress);

    window.scrollTo(
      0,
      startY + distance * eased
    );

     this.wakeLoop();


   if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      this.isAutoScrolling = false;
      this.wakeLoop();
    }
  };

  requestAnimationFrame(animate);
}


  private readonly onWindowScroll = (): void => {

    if (!this.active() || this.isTouching || this.isAutoScrolling) {
      return;
    }

    clearTimeout(this.scrollTimeout);

    this.scrollTimeout = window.setTimeout(() => {
      this.trySnapActivity();
    }, this.SNAP_DELAY);
  };


  private readonly onTouchStart = (): void => {
    this.isTouching = true;
  };


  private readonly onTouchEnd = (): void => {
    this.isTouching = false;

    clearTimeout(this.scrollTimeout);

    this.scrollTimeout = window.setTimeout(() => {
      this.trySnapActivity();
    }, this.SNAP_DELAY);
  };


  private trySnapActivity(): void {
    if (!this.active()) {
      return;
    }
    const stickyElement = this.stickyMap()?.nativeElement;

    if (!stickyElement) {
      return;
    }

    const stickyHeight =
      stickyElement.getBoundingClientRect().height;

    const anchor = window.scrollY + stickyHeight;

    const cards = this.getFreshCardOffsets();

    if (!cards.length) {
      return;
    }

  const candidate = cards.find(card => {
    const distance = card.top - anchor;

    return Math.abs(distance) <= this.SNAP_DISTANCE;
  });

  if (!candidate) {
    return;
  }

  const delta = candidate.top - anchor;

    if (Math.abs(delta) > this.SNAP_DISTANCE) {
      return;
    }

    const maxScroll =
      document.documentElement.scrollHeight -
      window.innerHeight;

    // Ne jamais perturber l'accès au bouton +
    if (window.scrollY >= maxScroll - 200) {
      return;
    }

    this.smoothScrollTo(
      candidate.top - stickyHeight - 5,
      400
    );
  }
}