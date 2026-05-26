// trip-layout.component.ts
import { Component, inject, input, computed, OnInit, Signal, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { InfosComponent } from './infos/infos.component';
import { AuthService } from '../../core/services/auth.service';
import { TripService } from '../../core/services/trip.service';
import { Trip } from '../../core/models/dto/trip.interface';

@Component({
  selector: 'app-travel',
  standalone: true,
  imports: [ButtonModule, TabsModule, DayPanelComponent, InfosComponent],
  styleUrl: 'travel.component.scss',
  templateUrl: 'travel.component.html',
})
export class TravelComponent implements OnInit{
 protected readonly tripService = inject(TripService);
protected readonly authService = inject(AuthService);
readonly trip: Signal<Trip | undefined> = this.tripService.activeTrip;

ngOnInit(): void {
  this.tripService.activeTripId.set(1); //TODO changer car en dur
}


  protected readonly tabs = computed(() => [
    { id: 'info', label: 'Général' },
    ...(this.trip() ? this.trip()!.days.map(d => ({
      id: d.id.toISOString(),
      label: this.formatDate(d.id),
    })) : []),
  ]);

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  protected onTabChange(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected logout(): void {
    this.authService.logout().subscribe();
  }
}