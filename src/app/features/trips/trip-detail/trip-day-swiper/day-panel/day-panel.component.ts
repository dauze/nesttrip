import { afterNextRender, Component, computed, ElementRef, inject, input, QueryList, signal, Signal, viewChild, ViewChildren } from '@angular/core';
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
  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  @ViewChildren(ActivityCardComponent)
  activityCards!: QueryList<ActivityCardComponent>;

  private readonly stickyMap = viewChild<ElementRef<HTMLElement>>('stickyMap');
  readonly stickyHeight = signal(0);
  readonly stickyOffset = this.stickyHeight.asReadonly();
  
  activitiesCollapsed = false;
  private pendingActivityId?: string;

  readonly activities: Signal<Activity[]> = computed(() => this.tripFacade.getActivities(this.dayId())());

  constructor() {
    afterNextRender(() => {
      const el = this.stickyMap()?.nativeElement;
      if (!el) return;

      const observer = new ResizeObserver(entries => {
        const height = entries[0].contentRect.height;
        this.stickyHeight.set(height);
      });

      observer.observe(el);
    });
  }

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

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.activities(), event.previousIndex, event.currentIndex);
    this.tripFacade.reorderActivities(
      this.tripId(),
      this.dayId(),
      this.activities().map((a) => a.id),
    );
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
    const card = this.activityCards.find(
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
}
