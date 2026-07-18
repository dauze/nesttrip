import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { SelectButton } from 'primeng/selectbutton';
import { InfosComponent } from './infos/infos.component';
import { TripActivitiesComponent } from './trip-activities/trip-activities.component';
import { Info } from './infos/info.models';
import { FormsModule } from '@angular/forms';

type GeneralSubTab = 'infos' | 'activities';

@Component({
  selector: 'app-general-panel',
  standalone: true,
  imports: [InfosComponent, TripActivitiesComponent,SelectButton, FormsModule],
  templateUrl: './general-panel.component.html',
  styleUrl: './general-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPanelComponent {
  readonly info = input.required<Info>();
  readonly tripId = input.required<string>();

  readonly activeSubTab = signal<GeneralSubTab>('infos');

  readonly subTabOptions = [
    { label: 'Infos', value: 'infos', icon: 'pi pi-clipboard' },
    { label: 'Activités', value: 'activities', icon: 'pi pi-map-marker' }
  ];

  selectSubTab(tab: GeneralSubTab): void {
    if (tab) {
      this.activeSubTab.set(tab);
    }
  }
}
