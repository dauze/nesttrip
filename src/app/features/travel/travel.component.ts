import { Component, inject } from '@angular/core';
import { DayNavComponent } from './day-nav/day-nav.component';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { AuthService } from '../../core/services/auth.service';
import { TabService } from '../../core/services/tab.service';

@Component({
  selector: 'app-travel-page',
  standalone: true,
  imports: [DayNavComponent, DayPanelComponent],
  templateUrl: 'travel.component.html' ,
})
export class TravelPageComponent {
  protected readonly service = inject(TabService);
  protected readonly authService = inject(AuthService);

  logout() {
    this.authService.logout().subscribe();
  }
}
