import {FormsModule} from '@angular/forms';
import {Component, computed, inject, OnInit, signal, Signal, effect} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { InfosComponent } from './infos/infos.component';
import { AuthService } from '@core/services/auth.service';
import { TravelService } from './travel.service';
import { Travel } from './travel.model';
import { ToolbarModule } from 'primeng/toolbar';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {SwipeDirective} from '../../shared/directives/swipe.directive';

@Component({
  selector: 'app-travel',
  standalone: true,
  imports: [
    ButtonModule,
    TabsModule,
    FormsModule,
    InfosComponent,
    ToolbarModule,
    MenuModule,
    CardModule,
    ConfirmDialog,
    DayPanelComponent,
    SwipeDirective
  ],
  providers: [ConfirmationService],
  styleUrl: 'travel.component.scss',
  templateUrl: 'travel.component.html',
})
export class TravelComponent implements OnInit {
  protected readonly travelService = inject(TravelService);
  protected readonly authService = inject(AuthService);
  readonly trip: Signal<Travel | undefined> = this.travelService.activeTravel;

  items: MenuItem[] = [
    {
      label: 'Options',
      items: [
        {
          label: 'Log out',
          icon: 'pi pi-sign-out',
          command: () => this.authService.logout().subscribe(),
        },
      ],
    },
  ];

  ngOnInit(): void {
    this.travelService.activeTravelId.set(1); //TODO changer car en dur
  }

  activeDay = signal<string>('info');

  private initialized = false;

  constructor() {
    effect(() => {
      const trip = this.trip();
      if (!trip || this.initialized) return;

      this.activeDay.set(this.getTodayId(trip));
      this.initialized = true;
    });
  }

  protected readonly tabs = computed(() => [
    {id: 'info', label: 'Général'},
    ...(this.trip()
      ? this.trip()!.days.map((d) => ({
        id: d.id.toISOString(),
        label: this.formatDate(d.id),
      }))
      : []),
  ]);

  nextTab() {
    this.moveTab(1);
  }

  prevTab() {
    this.moveTab(-1);
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  protected onTabChange(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private moveTab(offset: number) {
    const list = this.tabs().map(t => t.id);
    const i = list.indexOf(this.activeDay());

    const next = list[i + offset];
    if (next) {
      this.activeDay.set(next);
    }
  }

  private getTodayId(trip: Travel): string {
    const today = new Date().toDateString();

    const day = trip.days.find(d =>
      new Date(d.id).toDateString() === today
    );

    return day ? day.id.toISOString() : 'info';
  }
}
