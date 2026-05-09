import { Injectable, signal, computed } from '@angular/core';
import { Day } from '../models/travel.models';
import { DAYS_DATA } from './travel.data';

@Injectable({ providedIn: 'root' })
export class TravelService {
  private readonly _days = signal<Day[]>(DAYS_DATA);
  private readonly _activeDayId = signal<string>(DAYS_DATA[0]?.id ?? '');

  readonly days = this._days.asReadonly();
  readonly activeDayId = this._activeDayId.asReadonly();

  readonly activeDay = computed(() =>
    this._days().find(d => d.id === this._activeDayId())
  );

  readonly isInfoTab = computed(() => this._activeDayId() === 'infos');

  setActiveDay(id: string): void {
    this._activeDayId.set(id);
  }
}
