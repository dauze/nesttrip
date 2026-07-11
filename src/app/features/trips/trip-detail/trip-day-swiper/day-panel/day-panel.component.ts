import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, NgZone, Signal, signal, viewChild, viewChildren } from '@angular/core';
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
import { TripDayMapComponent } from './trip-day-map/trip-day-map.component';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, DragDropModule, PanelModule, Button, MessageModule, TripDayMapComponent],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly lockService = inject(SwiperLockService);
  private readonly zone = inject(NgZone);
  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();
  private readonly destroyRef = inject(DestroyRef);

  private readonly activityCards = viewChildren(ActivityCardComponent);
  private readonly mapRef = viewChild(TripDayMapComponent);
  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');

  readonly stickyHeight = signal(0);
  readonly stickyOffset = this.stickyHeight.asReadonly();

  private rafLoop?: number;
  private lastScrollY = -1;
  private idleFrames = 0;
  private readonly IDLE_THRESHOLD = 30;
  private cardOffsetsCache: { card: ActivityCardComponent; top: number; height: number }[] = [];

  activitiesCollapsed = false;
  private pendingActivityId?: string;

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getActivities(this.dayId())());

  readonly dayMapPoints = computed<DayMapPoint[]>(() => {
    const activities = this.activities();
    return activities
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
    afterNextRender(() => {
      const el = this.stickyMap()?.nativeElement;
      if (!el) return;

      const observer = new ResizeObserver(entries => {
        this.stickyHeight.set(entries[0].contentRect.height);
      });
      observer.observe(el);

      this.recomputeCardOffsets();
      window.addEventListener('resize', this.recomputeCardOffsets, { passive: true });
      window.addEventListener('scroll', this.wakeLoop, { passive: true });
      window.addEventListener('touchstart', this.wakeLoop, { passive: true });
      window.addEventListener('touchmove', this.wakeLoop, { passive: true });
      window.addEventListener('wheel', this.wakeLoop, { passive: true });

      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        window.removeEventListener('resize', this.recomputeCardOffsets);
        window.removeEventListener('scroll', this.wakeLoop);
        window.removeEventListener('touchstart', this.wakeLoop);
        window.removeEventListener('touchmove', this.wakeLoop);
        window.removeEventListener('wheel', this.wakeLoop);
        if (this.rafLoop) cancelAnimationFrame(this.rafLoop);
      });
    });
  }

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.activities(), event.previousIndex, event.currentIndex);
    this.tripFacade.reorderActivities(
      this.tripId(),
      this.dayId(),
      this.activities().map((a) => a.id),
    );
    // Le DOM change après un reorder : les positions des cartes ne sont plus valides.
    queueMicrotask(() => this.recomputeCardOffsets());
  }

  addActivity() {
    this.tripFacade.createActivity(this.tripId(), this.dayId(), {
      id: crypto.randomUUID(),
      title: '',
      type: ActivityType.ACTIVITE,
      duration: 0,
      price: {
        amount: 0,
        currency: 'EUR',
      },
      placeId: '',
      booking: {
        status: BookingStatus.NOT_NEEDED,
        deadline: undefined,
      },
      notes: '',
      files: [],
      website: '',
      phone: '',
    });
    queueMicrotask(() => this.recomputeCardOffsets());
  }

  focusActivity(activityId: string) {
    if (this.activitiesCollapsed) {
      this.activitiesCollapsed = false;
      queueMicrotask(() => {
        this.openCard(activityId);
      });
      return;
    }

    this.openCard(activityId);
  }

  onActivitiesPanelToggled() {
    if (this.pendingActivityId) {
      this.openCard(this.pendingActivityId);
      this.pendingActivityId = undefined;
    }
  }

  private openCard(activityId: string): void {
    const card = this.activityCards().find(
      c => c.activity()?.id === activityId
    );

    if (!card) {
      return;
    }

    card.openAndScroll();
  }

  onMapPointClick(point: DayMapPoint) {
    this.focusActivity(point.activityId);
  }

  onDragStarted() {
    this.lockService.lock();
  }

  onDragEnded() {
    this.lockService.unlock();
  }

  private recomputeCardOffsets = (): void => {
    const cards = this.activityCards();
    this.cardOffsetsCache = cards.map(card => {
      const rect = card.element.getBoundingClientRect();
      return {
        card,
        top: rect.top + window.scrollY,
        height: rect.height,
      };
    });
  };

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

  if (currentScrollY !== this.lastScrollY) {
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
  if (this.cardOffsetsCache.length === 0) return;

  // La ligne de déclenchement est PILE le bas de la carte collée
  const triggerLine = scrollY + this.stickyOffset();

  // On cherche la toute PREMIÈRE carte qui se trouve EN DESSOUS de la ligne (qui va arriver)
  const upcomingIndex = this.cardOffsetsCache.findIndex(c => c.top > triggerLine);

  let fromIndex = 0;
  let toIndex = 0;
  let t = 0;

  if (upcomingIndex === -1) {
    // Si toutes les cartes ont dépassé le bas de la map, on reste bloqué sur la dernière
    fromIndex = this.cardOffsetsCache.length - 1;
    toIndex = fromIndex;
    t = 1;
  } else if (upcomingIndex === 0) {
    // Si même la première carte n'a pas encore atteint le bas de la map, on reste sur la première
    fromIndex = 0;
    toIndex = 0;
    t = 0;
  } else {
    // Cas nominal : on transite entre la carte qui vient de passer (from) et celle qui arrive (to)
    fromIndex = upcomingIndex - 1;
    toIndex = upcomingIndex;

    const fromCard = this.cardOffsetsCache[fromIndex];
    const toCard = this.cardOffsetsCache[toIndex];

    // Le trajet (span) se fait entre le haut de la carte précédente et le haut de la carte suivante
    const span = toCard.top - fromCard.top;
    t = span !== 0 ? (triggerLine - fromCard.top) / span : 0;
    t = Math.min(1, Math.max(0, t));
  }

  const from = this.cardOffsetsCache[fromIndex];
  const to = this.cardOffsetsCache[toIndex];

  const fromId = from.card.activity()?.id;
  const toId = to.card.activity()?.id;
  if (!fromId || !toId) return;

  const fromPoint = this.dayMapPoints().find(p => p.activityId === fromId);
  const toPoint = this.dayMapPoints().find(p => p.activityId === toId);
  if (!fromPoint || !toPoint) return;

  // On envoie les bons points et le ratio t parfaitement synchronisé
  this.mapRef()?.followScroll(fromPoint, toPoint, t);
}
}