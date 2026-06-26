import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Trip } from '../../trip.model';
import { DayPanelComponent } from '../day-panel/day-panel.component';
import { InfosComponent } from '../infos/infos.component';
import type { SwiperContainer } from 'swiper/element';
import { TripTab } from '../trip-tab.model';

@Component({
  selector: 'app-trip-day-swiper',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [DayPanelComponent, InfosComponent],
  templateUrl: './trip-day-swiper.component.html',
  styleUrl: './trip-day-swiper.component.scss',
})
export class TripDaySwiperComponent {
  readonly trip = input.required<Trip>();
  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly activeIdChange = output<string>();

  readonly sortedDays = signal<Trip['days']>([]);
  readonly visitedDays = signal<Set<string>>(new Set());

  private readonly swiperRef = viewChild<ElementRef<SwiperContainer>>('swiperRef');
  private readonly viewReady = signal(false);
  private hasPositioned = false;

  constructor() {
    // Garde sortedDays synchronisé avec l'input trip (recalculé à chaque changement de trip()).
    effect(() => {
      const days = this.trip().days.slice().sort((a, b) => a.id.getTime() - b.id.getTime());
      this.sortedDays.set(days);
    });

    effect(() => {
      if (!this.viewReady()) return;

      const id = this.activeId();
      const tabs = this.tabs();
      const index = tabs.findIndex(t => t.id === id);
      if (index < 0) return;

      this.preloadAround(index);

      const swiperInstance = this.swiperRef()?.nativeElement?.swiper;
      if (!swiperInstance) return;

      const isFirstSync = !this.hasPositioned;
      this.hasPositioned = true; // posé avant le early-return ci-dessous

      if (swiperInstance.activeIndex === index) return;
      swiperInstance.slideTo(index, isFirstSync ? 0 : undefined);
    });
  }

  ngAfterViewInit(): void {
    const swiperEl = this.swiperRef()?.nativeElement;
    if (swiperEl) this.setupSwiper(swiperEl);
  }

  protected dayFor(id: string) {
    return this.sortedDays().find(d => d.id.toISOString() === id);
  }

  private setupSwiper(swiperEl: SwiperContainer): void {
    Object.assign(swiperEl, {
      speed: 280,
      observer: true,
      observeParents: true,
      resistanceRatio: 0.85,
      spaceBetween: 8,
      cssMode: false,
    });

    swiperEl.initialize();

    swiperEl.addEventListener('swiperslidechangetransitionstart', () => {
      const newIndex = swiperEl.swiper?.activeIndex;
      if (newIndex == null) return;
      const tab = this.tabs()[newIndex];
      if (!tab) return;
      this.preloadAround(newIndex);
      this.activeIdChange.emit(tab.id);
    });

    this.viewReady.set(true);
  }

  private preloadAround(index: number): void {
    const tabs = this.tabs();
    const indices = [index - 1, index, index + 1].filter(i => i >= 0 && i < tabs.length);
    this.visitedDays.update(set => {
      const next = new Set(set);
      for (const i of indices) next.add(tabs[i].id);
      return next;
    });
  }
}