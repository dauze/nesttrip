import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { Activity } from '../activity.model';
import { Place } from '@app/core/models/place.dto';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

@Component({
  selector: 'app-activity-google-info',
  standalone: true,
  imports: [CommonModule, TagModule, PanelModule, DividerModule],
  templateUrl: './activity-google-info.component.html',
})
export class ActivityGoogleInfoComponent {
  readonly activity = input.required<Activity>();
  readonly lazyGoogleData = input<Place | null>(null);
  readonly loading = input(false);
  readonly dayId = input.required<Date>();

  readonly isVisible = computed(() => !!this.activity().placeId && !this.loading() && !!this.lazyGoogleData());

  readonly mapsUrl = computed(() => {
    const gd = this.lazyGoogleData();
    const address = gd?.address;
    const name = gd?.name;
    if (!address?.length || !name?.length) return null;
    const query = encodeURIComponent(address || name);
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${this.activity().placeId}`;
  });

  readonly todayDayName = computed(() => DAY_NAMES[this.dayId().getDay()]);

  readonly isOpenNow = computed(() => {
    const hours = this.lazyGoogleData()?.openingHours;
    if (!hours?.length) return null;

    const day = this.dayId();
    const now = new Date();
    const checkTime = new Date(day);
    checkTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const todayName = DAY_NAMES[checkTime.getDay()];
    const todayLine = hours.find((h) => h.toLowerCase().startsWith(todayName));
    if (!todayLine) return false;
    if (todayLine.toLowerCase().includes('fermé')) return false;

    const ranges = [...todayLine.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)];
    const hm = checkTime.getHours() * 60 + checkTime.getMinutes();

    return ranges.some(([, sh, sm, eh, em]) => {
      const start = +sh * 60 + +sm;
      let end = +eh * 60 + +em;
      if (end < start) end += 24 * 60;
      return hm >= start && hm <= end;
    });
  });

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }
}