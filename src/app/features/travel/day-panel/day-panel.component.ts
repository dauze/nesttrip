import { Component, computed, inject, input, Signal } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Activity } from './activity.model';
import { PanelModule } from 'primeng/panel';
import { Button } from 'primeng/button';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityCardComponent } from './activity-card/activity-card.component';
import { TravelStore } from '@features/travel/travel.service';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [TimelineComponent, ActivityCardComponent, DragDropModule, PanelModule, Button],
  styleUrl: 'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly travelStore = inject(TravelStore);
  readonly tripId = input.required<number>();
  readonly dayId = input.required<Date>();

  readonly activities: Signal<Activity[]> = computed(() => this.travelStore.getActivities(this.dayId())());

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.activities(), event.previousIndex, event.currentIndex);
    this.travelStore.reorderActivities(
      this.tripId(),
      this.dayId(),
      this.activities().map((a) => a.id),
    );
  }
  addActivity() {
    this.travelStore.createActivity(this.tripId(), this.dayId(), {
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
    });
  }
}
