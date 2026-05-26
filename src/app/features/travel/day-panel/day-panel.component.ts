import { Component, input, signal } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { ActivityCardComponent } from "./activity-card/activity-card.component";
import { Day } from '../../../core/models/dto/trip.interface';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [
    TimelineComponent,
    ActivityCardComponent
],
  styleUrl:'day-panel.component.scss',
  template: `
    <app-timeline [activities]="day().activities" />
    @for (activity of day().activities; track activity.id) {
        <app-activity-card [activity]="activity" [currentDay]="day()" [tripId]="tripId()" />
    }
    <!-- <div class="add-activity-btn-wrapper">
      <button class="btn-primary rounded-btn" (click)="addActivity()">+</button>
    </div> -->
  `,
})
export class DayPanelComponent {
  readonly day = input.required<Day>();
   readonly tripId = input.required<number>();

     readonly editingField = signal<'time' | 'name' | null>(null);

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
