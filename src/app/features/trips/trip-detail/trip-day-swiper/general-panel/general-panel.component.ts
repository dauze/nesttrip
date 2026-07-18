import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { InfosComponent } from '../infos/infos.component';
import { TripActivitiesComponent } from '../trip-activities/trip-activities.component';
import { Info } from '../infos/info.models';

type GeneralSubTab = 'infos' | 'activities';

@Component({
  selector: 'app-general-panel',
  standalone: true,
  imports: [Button, InfosComponent, TripActivitiesComponent],
  templateUrl: './general-panel.component.html',
  styleUrl: './general-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPanelComponent {
  readonly info = input.required<Info>();
  readonly tripId = input.required<string>();

  readonly activeSubTab = signal<GeneralSubTab>('infos');

  selectSubTab(tab: GeneralSubTab): void {
    this.activeSubTab.set(tab);
  }
}
