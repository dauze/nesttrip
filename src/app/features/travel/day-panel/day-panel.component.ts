import { Component, inject, input, signal } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { ActivityCardComponent } from "./activity-card/activity-card.component";
import { Day } from '../../../core/models/dto/trip.interface';
import { moveItemInArray, CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Activity } from '../../../core/models/dto/activity.interface';
import { ActivityService } from '../../../core/services/activity.service';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [
    TimelineComponent,
    ActivityCardComponent,
    DragDropModule
],
  styleUrl:'day-panel.component.scss',
  templateUrl: 'day-panel.component.html',
})
export class DayPanelComponent {
  private readonly activityService = inject(ActivityService);

  readonly day = input.required<Day>();
  readonly tripId = input.required<number>();

  readonly editingField = signal<'time' | 'name' | null>(null);

  onDrop(event: CdkDragDrop<Activity[]>): void {
    moveItemInArray(this.day().activities, event.previousIndex, event.currentIndex);
    this.activityService
    .reorderActivities(this.tripId(), this.day().id, this.day().activities)
    .subscribe();
  }

  // save(field: 'time' | 'name'|'meal', value: string): void {
  //   this.travel.updateSlotField(this.slot().id, { [field]: value });
  //   this.editingField.set(null);
  // }

  // addActivity(): void {
  // const newActivity: Activity = {
  //   id: Date.now(), // ou un uuid, selon ton modèle
  //   name: 'Nouvelle activité',
  //   badges: [],
  //   grid: [{
  //     id: Date.now().toString(),
  //     label: '',
  //     value: '',
  //   }],
  //   notes: '',
  // };

  // const updatedActivities = [...(this.slot().activities ?? []), newActivity];
  // this.travel.updateSlotField(this.slot().id, { activities: updatedActivities });
  // }
}
