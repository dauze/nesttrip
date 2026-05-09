import { Component, effect, inject, input, signal } from '@angular/core';
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

  readonly notesValue = signal('');

  constructor() {
    effect(() => {
      this.notesValue.set(this.activity().notes ?? '');
    });
  }

  onNotesBlur(): void {
    this.travel.updateActivityNotes(this.idSlot(), this.activity().id, this.notesValue());
  }
}
