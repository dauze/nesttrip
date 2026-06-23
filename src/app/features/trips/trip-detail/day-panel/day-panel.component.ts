import { Component, computed, inject, input, QueryList, Signal, ViewChildren } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Activity } from './activity-card/activity.model';
import { PanelModule } from 'primeng/panel';
import { Button } from 'primeng/button';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityCardComponent } from './activity-card/activity-card.component';
import { TripStore } from '../../trip-store.service';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, DragDropModule, PanelModule, Button, MessageModule],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly tripStore = inject(TripStore);
  readonly tripId = input.required<string>();
  readonly dayId = input.required<Date>();

  @ViewChildren(ActivityCardComponent)
  activityCards!: QueryList<ActivityCardComponent>;
  
  activitiesCollapsed = false;
  private pendingActivityId?: string;

  readonly activities: Signal<Activity[]> = computed(() => this.tripStore.getActivities(this.dayId())());

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.activities(), event.previousIndex, event.currentIndex);
    this.tripStore.reorderActivities(
      this.tripId(),
      this.dayId(),
      this.activities().map((a) => a.id),
    );
  }
  addActivity() {
    this.tripStore.createActivity(this.tripId(), this.dayId(), {
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
}
