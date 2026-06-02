import { Component, inject, input } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { Day } from '../travel.model';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Activity } from './activity.model';
import { PanelModule } from 'primeng/panel';
import { Button } from 'primeng/button';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityCardComponent } from './activity-card/activity-card.component';
import { ActivityService } from './activity.service';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, DragDropModule, PanelModule, Button],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly activityService = inject(ActivityService);

  readonly day = input.required<Day>();
  readonly tripId = input.required<number>();

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.day().activities, event.previousIndex, event.currentIndex);
    this.activityService
      .reorderActivities(this.tripId(), this.day().id, this.day().activities)
      .subscribe();
  }
  addActivity() {
    this.activityService
      .createActivity(this.tripId(), this.day().id, {
        id: crypto.getRandomValues(new Uint32Array(1))[0],
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
      })
      .subscribe();
  }
}
