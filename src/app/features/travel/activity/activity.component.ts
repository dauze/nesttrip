import { Component, inject, input } from '@angular/core';
import { Activity } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  templateUrl: 'activity.component.html',
  styleUrl:'activity.component.scss'
})
export class ActivityComponent {
  readonly travel = inject(TabService);
  readonly activity = input.required<Activity>();
  readonly idSlot = input.required<number>();

  onNotesBlur(event: FocusEvent): void {
    const notes = (event.target as HTMLTextAreaElement).value;
    this.travel.updateActivityNotes(this.idSlot(), this.activity().id, notes);
  }
}
