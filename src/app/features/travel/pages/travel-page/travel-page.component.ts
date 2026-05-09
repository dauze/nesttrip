import { Component, inject } from '@angular/core';
import { TravelService } from '../../../../core/models/travel.service';
import { DayNavComponent } from '../../components/day-nav/day-nav.component';
import { DayPanelComponent } from '../../components/day-panel/day-panel.component';

@Component({
  selector: 'app-travel-page',
  standalone: true,
  imports: [DayNavComponent, DayPanelComponent],
  template: `
    <header class="site-header">
      <h1>🇨🇳 Pekin/Shanghai – Programme de voyage</h1>
      <p>15–22 mai 2026 · 2 personnes · Logement district de Jing'an</p>
    </header>

    <app-day-nav />

    <main class="day-panel active">
      @if (service.activeDay(); as day) {
        <app-day-panel [day]="day" />
      }
    </main>
    <footer>
      Page réalisée par Dauze en personne, sans l'aide de Claude · Mai 2026
    </footer>
  `,
})
export class TravelPageComponent {
  protected readonly service = inject(TravelService);
}
