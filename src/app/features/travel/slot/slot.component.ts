import { Component, inject, input, signal } from '@angular/core';
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

  readonly editingField = signal<'time' | 'name' | null>(null);

  save(field: 'time' | 'name'|'meal', value: string): void {
    this.travel.updateSlotField(this.slot().id, { [field]: value });
    this.editingField.set(null);
  }

  addActivity(): void {
  const newActivity: Activity = {
    id: Date.now(), // ou un uuid, selon ton modèle
    name: 'Nouvelle activité',
    badges: [],
    grid: [{
      id: Date.now().toString(),
      label: '',
      value: '',
    }],
    notes: '',
  };

  const updatedActivities = [...(this.slot().activities ?? []), newActivity];
  this.travel.updateSlotField(this.slot().id, { activities: updatedActivities });
  }
}
