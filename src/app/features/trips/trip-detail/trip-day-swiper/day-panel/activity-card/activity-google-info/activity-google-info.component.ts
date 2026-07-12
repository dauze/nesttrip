import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { PanelBeforeToggleEvent, PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
// Assure-toi que PrimeTemplate est bien importé (parfois inclus dans SharedModule)
import { PrimeTemplate } from 'primeng/api'; 

import { Activity } from '../activity.model';
import { LoadingState, PlaceDetails } from '@app/core/models/place.dto';
import { ActivityGalleryComponent } from './activity-gallery/activity-gallery.component';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

@Component({
  selector: 'app-activity-google-info',
  standalone: true,
  // Ajout de PrimeTemplate aux imports si ton environnement l'exige
  imports: [CommonModule, TagModule, PanelModule, DividerModule, PrimeTemplate, ActivityGalleryComponent],
  templateUrl: './activity-google-info.component.html',
})
export class ActivityGoogleInfoComponent {
  readonly activity = input.required<Activity>();
  readonly dayId = input.required<Date>();

  readonly detailsState = input<LoadingState<PlaceDetails>>({ status: 'idle' });
  readonly expandDetails = output<string>();

  readonly details = computed(() => {
    const s = this.detailsState();
    return s.status === 'success' ? s.data : null;
  });

  readonly detailsLoading = computed(() => this.detailsState().status === 'loading');
  readonly isVisible = computed(() => !!this.activity().placeId);

  readonly mapsUrl = computed(() => {
    const address = this.activity().address;
    const title = this.activity().title;
    if (!address?.length && !title?.length) return null;
    const query = encodeURIComponent(address || title);
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${this.activity().placeId}`;
  });

  readonly todayDayName = computed(() => DAY_NAMES[this.dayId().getDay()]);

  readonly isOpenNow = computed(() => {
    const hours = this.details()?.openingHours;
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

  onPanelToggle(event: PanelBeforeToggleEvent) {
    if (!event.collapsed) return;
    
    const placeId = this.activity().placeId;
    if (placeId) {
      this.expandDetails.emit(placeId);
    }
  }

  starsFor(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }
}