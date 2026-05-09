import { Component, inject } from '@angular/core';
import { DayNavComponent } from '../../components/day-nav/day-nav.component';
import { DayPanelComponent } from '../../components/day-panel/day-panel.component';
import { AuthService } from '../../../../core/services/auth.service';
import { TabService } from '../../../../core/services/tab.service';

@Component({
  selector: 'app-travel-page',
  standalone: true,
  imports: [DayNavComponent, DayPanelComponent],
  template: `
    <header class="site-header">
      <div class="header-top">
        <h1>🇨🇳 Pekin/Shanghai – Programme de voyage</h1>
        <button type="button" class="btn-logout" (click)="logout()">Log out</button>
      </div>
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
  protected readonly service = inject(TabService);
  protected readonly authService = inject(AuthService);

  logout() {
    this.authService.logout().subscribe();
  }
}
