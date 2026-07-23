import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { NotesComponent } from './notes/notes.component';
import { TripActivitiesComponent } from './trip-activities/trip-activities.component';
import { Notes } from './notes/notes.model';

type GeneralSubTab = 'notes' | 'activities';

@Component({
  selector: 'app-general-panel',
  standalone: true,
  imports: [NotesComponent, TripActivitiesComponent, SelectButtonComponent],
  templateUrl: './general-panel.component.html',
  styleUrl: './general-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPanelComponent {
  readonly notes = input.required<Notes>();
  readonly tripId = input.required<string>();

  readonly activeSubTab = signal<GeneralSubTab>('activities');

  readonly subTabOptions: SelectButtonOption<GeneralSubTab>[] = [
    { label: 'Activités', value: 'activities', icon: 'pi pi-map-marker' },
    { label: 'Notes', value: 'notes', icon: 'pi pi-clipboard' }
  ];

  selectSubTab(tab: GeneralSubTab | undefined): void {
    if (tab) {
      this.activeSubTab.set(tab);
    }
  }
}
