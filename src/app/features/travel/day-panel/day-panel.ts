import { Component, inject, input } from '@angular/core';
import { Timeline } from './timeline/timeline';
import { Day } from '../../../core/models/dto/trip.interface';
import { moveItemInArray, CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Activity } from '../../../core/models/dto/activity.interface';
import { ActivityService } from '../../../core/services/activity.service';
import { PanelModule } from 'primeng/panel';
import { Button } from 'primeng/button';
import { ActivityType } from '../../../core/enums/activites-type.enum';
import { BookingStatus } from '../../../core/enums/booking.status';
import { ActivityCard } from './activity-card/activity-card';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [
    Timeline,
    ActivityCard,
    DragDropModule,
    PanelModule,
    Button
],
  styleUrl:'day-panel.scss',
  templateUrl: 'day-panel.html',
})
export class DayPanel {
  private readonly activityService = inject(ActivityService);

  readonly day = input.required<Day>();
  readonly tripId = input.required<number>();

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.day().activities, event.previousIndex, event.currentIndex);
    this.activityService.reorderActivities(this.tripId(), this.day().id, this.day().activities).subscribe();
  }
  addActivity(){
    this.activityService.createActivity(this.tripId(), this.day().id, 
    {
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
    }).subscribe();
  }
}
