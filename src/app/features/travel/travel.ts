// trip-layout.component.ts
import { Component, inject, computed, OnInit, Signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { DayPanel } from './day-panel/day-panel';
import { Infos } from './infos/infos';
import {AuthService} from '@core/services/auth.service';
import {TravelService} from './travel.service';
import {Travel} from './travel.model';
import { ToolbarModule } from 'primeng/toolbar';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';

@Component({
  selector: 'app-travel',
  standalone: true,
  imports: [ButtonModule, TabsModule, Infos, ToolbarModule, MenuModule, CardModule, ConfirmDialog, DayPanel],
  providers: [ConfirmationService],
  styleUrl: 'travel.scss',
  templateUrl: 'travel.html',
})
export class Travel implements OnInit{
  protected readonly travelService = inject(TravelService);
  protected readonly authService = inject(AuthService);
  readonly trip: Signal<Trip | undefined> = this.travelService.activeTrip;

  items: MenuItem[] = [
            {
                label: 'Options',
                items: [
                    {
                        label: 'Log out',
                        icon: 'pi pi-sign-out',
                        command: () => this.authService.logout().subscribe()
                    }
                ]
            }
        ];;

  ngOnInit(): void {
    this.travelService.activeTripId.set(1); //TODO changer car en dur
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
}
