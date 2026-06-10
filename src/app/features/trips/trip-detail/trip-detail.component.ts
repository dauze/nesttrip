import { FormsModule } from '@angular/forms';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TravelStore } from '@features/trips/travel.service';
import { Travel } from '@features/trips/travel.model';
import { SwipeDirective } from '@app/shared/directives/swipe.directive';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { InfosComponent } from './infos/infos.component';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    TabsModule,
    CardModule,
    ConfirmDialog,
    InfosComponent,
    DayPanelComponent,
    SwipeDirective,
  ],
  providers: [ConfirmationService],
  templateUrl: 'trip-detail.component.html',
  styleUrl: 'trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit {
  protected readonly travelStore = inject(TravelStore);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.travelStore.setActiveTrip(id);
    }
  }

  readonly activeDay = signal<string>('info');

  private initialized = false;

  constructor() {
    effect(() => {
      const trip = this.travelStore.activeTravel();
      if (!trip || this.initialized) return;

      this.activeDay.set(this.getTodayId(trip));
      this.initialized = true;
    });
  }

  readonly tabs = computed(() => {
    const trip = this.travelStore.activeTravel();
    if (!trip) return [{ id: 'info', label: 'Général' }];

    return [
      { id: 'info', label: 'Général' },
      ...trip.days.map((d) => ({
        id: d.id.toISOString(),
        label: this.formatDate(d.id),
      })),
    ];
  });

  nextTab(): void {
    this.moveTab(1);
  }

  prevTab(): void {
    this.moveTab(-1);
  }

  protected onTabChange(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  private moveTab(offset: number): void {
    const list = this.tabs().map((t) => t.id);
    const i = list.indexOf(this.activeDay());
    const next = list[i + offset];
    if (next) {
      this.activeDay.set(next);
    }
  }

  private getTodayId(trip: Travel): string {
    const today = new Date().toDateString();
    const day = trip.days.find((d) => new Date(d.id).toDateString() === today);
    return day ? day.id.toISOString() : 'info';
  }
}