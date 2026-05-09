import { Component, input } from '@angular/core';
import { Day } from '../../../../core/models/travel.models';
import { HeroComponent } from '../hero/hero.component';
import { AlertBoxComponent } from '../alert-box/alert-box.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { SlotComponent } from '../slot/slot.component';
import { InfoBoxComponent } from '../info-box/info-box.component';

@Component({
  selector: 'app-day-panel',
  standalone: true,
  imports: [
    HeroComponent,
    AlertBoxComponent,
    TimelineComponent,
    SlotComponent,
    InfoBoxComponent,
  ],
  template: `
    @if (day().id === 'infos') {
      <!-- Onglet infos pratiques -->
      <app-hero [day]="day().content" />
      @for (element of day().content.elements; track element.title) {
        <app-info-box [element]="element" />
      }
    } @else {
      <!-- Onglet jour normal -->
      @if (day().content.alerts) {
        <app-alert-box [alerts]="day().content.alerts!" />
      }
      <app-hero [day]="day().content" />
      @if (day().content.timeline) {
        <app-timeline [items]="day().content.timeline!" />
      }
      @for (slot of day().content.slots; track slot.name) {
        <app-slot [slot]="slot" />
      }
    }
  `,
})
export class DayPanelComponent {
  readonly day = input.required<Day>();
}
