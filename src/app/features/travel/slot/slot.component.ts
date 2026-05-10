import { Component, inject, input } from '@angular/core';
import { Activity, Slot } from '../../../core/models/travel.models';
import { ActivityComponent } from '../activity/activity.component';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-slot',
  standalone: true,
  imports: [ActivityComponent, SafeHtmlPipe],
  styleUrl:'slot.component.scss',
  templateUrl: 'slot.component.html',
})
export class SlotComponent {
  private readonly travel = inject(TabService);
  readonly slot = input.required<Slot>();

  addActivity(): void {
  const newActivity: Activity = {
    id: Date.now(), // ou un uuid, selon ton modèle
    name: 'Nouvelle activité',
    badges: [],
    grid: [],
    notes: '',
  };

  const updatedActivities = [...(this.slot().activities ?? []), newActivity];
  this.travel.updateSlotField(this.slot().id, { activities: updatedActivities });
}
}
