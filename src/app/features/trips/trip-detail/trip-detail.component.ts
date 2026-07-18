import { Component, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Day, Trip } from '../trip.model';
import { TripDetailSkeletonComponent } from './trip-detail-skeleton.component';
import { TripFacade } from '../trip-facade.service';
import { TripHeaderComponent } from './trip-header/trip-header.component';
import { TripCollaboratorsComponent } from './trip-collaborators/trip-collaborators.component';
import { TripTabsNavComponent } from './trip-tabs-nav/trip-tabs-nav.component';
import { TripDaySwiperComponent } from './trip-day-swiper/trip-day-swiper.component';
import { TripTab } from './trip-tab.model';
import { Location } from '@angular/common';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    SkeletonModule,
    ConfirmDialog,
    TripDetailSkeletonComponent,
    TripHeaderComponent,
    TripCollaboratorsComponent,
    TripTabsNavComponent,
    TripDaySwiperComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: 'trip-detail.component.html',
  styleUrl: 'trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(TripFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly location = inject(Location);

  private readonly headerRef = viewChild(TripHeaderComponent);
  private readonly tabsNavRef = viewChild(TripTabsNavComponent);

  readonly activeDay = signal<string>('notes');
  private initializedTripId: string | null = null;
  readonly currentDayIndex = signal(0);

  readonly contentReady = signal(false);
  private readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tripTitle = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    const fromList = this.facade.trips().find(t => t.id === id);
    return fromList?.title ?? this.facade.activeTrip()?.title ?? '';
  });

  readonly sortedDays = computed(() =>
    this.facade.activeTrip()?.days
      ?.slice()
      .sort((a, b) => a.id.getTime() - b.id.getTime()) ?? []
  );

  readonly tabs = computed<TripTab[]>(() => [
    { id: 'notes', label: 'Général' },
    ...this.sortedDays().map(d => ({
      id: d.id.toISOString(),
      label: this.formatDate(d.id),
    })),
  ]);

  constructor() {
    effect(() => {
      const trip = this.facade.activeTrip();
      const loading = this.facade.activeTripLoading();
      if (!trip || loading) return;
      if (this.initializedTripId === trip.id) return;

      this.initializedTripId = trip.id;

      const dayFromUrl = this.getDayIdFromFragment(this.route.snapshot.fragment);
      const initialDay = dayFromUrl ?? this.getTodayId(trip);
      this.activeDay.set(initialDay);

      const index = this.tabs().findIndex(t => t.id === initialDay);
      if (index >= 0) {
        setTimeout(() => this.tabsNavRef()?.scrollIntoView(index), 100);
      }
    });

    effect(() => {
      const id = this.facade.activeTrip()?.id;
      if (!id) return;

      this.contentReady.set(false);
      this.clearReadyFallback();

      // Filet de sécurité : si le swiper n'a jamais émis `ready` (bug,
      // tab introuvable, event raté) on débloque quand même l'UI après 4s
      // plutôt que de laisser le skeleton tourner indéfiniment.
      this.readyFallbackTimer = setTimeout(() => {
        this.contentReady.set(true);
      }, 4000);
    });
  }

  ngOnInit(): void {
    this.initializedTripId = null;
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.facade.loadTrip(id);
  }

  ngOnDestroy(): void {
    this.facade.unloadTrip();
    this.clearReadyFallback();
  }

  protected onSwiperReady(): void {
    this.contentReady.set(true);
    this.clearReadyFallback();
  }

  private clearReadyFallback(): void {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
  }

  protected onTitleChange(title: string): void {
    const trip = this.facade.activeTrip();
    if (!trip) return;
    this.facade.updateTripTitle({ ...trip, title });
  }

  protected onTabSelected(event: { id: string; index: number }): void {
    this.activeDay.set(event.id);
    this.tabsNavRef()?.scrollIntoView(event.index);
    this.updateFragment(event.id);
  }

  protected onSwiperActiveIdChange(id: string): void {
    this.activeDay.set(id);
    const index = this.tabs().findIndex(t => t.id === id);
    if (index >= 0) this.tabsNavRef()?.scrollIntoView(index);
    this.updateFragment(id);
  }

  protected onDatesChange(range: [Date, Date]): void {
    const trip = this.facade.activeTrip();
    if (!trip) return;

    const [start, end] = range;
    const newDays = this.buildDays(start, end, trip.days);
    const toDelete = this.findDaysToDelete(trip.days, newDays);
    const toAdd = this.findDaysToAdd(trip.days, newDays);

    const applyChanges = () => {
      for (const day of toDelete) this.facade.removeDay(trip.id, day.id);
      for (const day of toAdd) this.facade.addDay(trip.id, day);
      this.activeDay.set('notes');
      setTimeout(() => this.tabsNavRef()?.scrollIntoView(0), 100);
    };

    if (toDelete.length > 0) {
      this.confirmationService.confirm({
        message: 'Certains jours contiennent des activités et vont être supprimés. Êtes-vous sûr de vouloir continuer ?',
        accept: applyChanges,
        reject: () => this.headerRef()?.resetDates(),
      });
    } else {
      applyChanges();
    }
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  private getTodayId(trip: Trip): string {
    const today = new Date().toDateString();
    const day = trip.days.find(d => new Date(d.id).toDateString() === today);
    return day ? day.id.toISOString() : 'notes';
  }

  private buildDays(start: Date, end: Date, existingDays: Day[]): Day[] {
    const days: Day[] = [];
    const existingMap = new Map(existingDays.map(day => [day.id.getTime(), day]));

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);

    while (current <= endNorm) {
      const key = current.getTime();
      days.push(existingMap.get(key) ?? { id: new Date(current), activityIds: [] });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private findDaysToAdd(existingDays: Day[], newDays: Day[]): Day[] {
    const existingIds = new Set(existingDays.map(d => d.id.getTime()));
    return newDays.filter(d => !existingIds.has(d.id.getTime()));
  }

  private findDaysToDelete(existingDays: Day[], newDays: Day[]): Day[] {
    const newIds = new Set(newDays.map(d => d.id.getTime()));
    return existingDays.filter(d => !newIds.has(d.id.getTime()));
  }

  private getDayIdFromFragment(fragment: string | null): string | null {
    if (!fragment) return null;

    const match = fragment.match(/^day-(\d+)$/);
    if (!match) return null;

    const dayIndex = parseInt(match[1], 10) - 1;
    const day = this.sortedDays()[dayIndex];
    return day ? day.id.toISOString() : null;
  }

  private updateFragment(dayId: string): void {
    const dayNumber = this.sortedDays().findIndex(d => d.id.toISOString() === dayId) + 1;
    const basePath = this.location.path(false);
    this.location.replaceState(dayNumber > 0 ? `${basePath}#day-${dayNumber}` : basePath);
  }
}