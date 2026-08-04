import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagComponent } from '@app/shared/components/tag/tag.component';
import { PanelComponent, PanelToggleEvent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';

import { Activity } from '../activity.model';
import { timeToMinutes } from '../activity-time.util';
import { LoadingState, PlaceDetails } from '@app/core/models/place.dto';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

@Component({
  selector: 'app-activity-google-info',
  standalone: true,
  imports: [CommonModule, TagComponent, PanelComponent, DividerComponent],
  templateUrl: './activity-google-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityGoogleInfoComponent {
  readonly activity = input.required<Activity>();
  /** Optionnel : absent quand l'activité n'est pas (encore) rattachée à un jour (vue générale). */
  readonly dayId = input<Date | undefined>(undefined);

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

  readonly todayDayName = computed(() => DAY_NAMES[(this.dayId() ?? new Date()).getDay()]);

  /**
   * `null` = pas de statut à afficher. On juge le statut par rapport à
   * l'heure de DÉBUT de l'activité (`startTime`), pas l'heure actuelle : une
   * activité prévue à 20h sur un lieu fermé maintenant mais ouvert ce
   * soir-là ne doit pas afficher "fermé" juste parce qu'on regarde la carte
   * en pleine journée. Si l'heure de début n'est pas renseignée, on ne peut
   * pas viser un instant précis : on n'affiche alors le statut QUE si le
   * lieu est fermé toute la journée sélectionnée (sans ambiguïté), jamais
   * "ouvert" (on ne sait pas à quelle heure l'activité aura lieu).
   */
  readonly isOpenNow = computed(() => {
    const hours = this.details()?.openingHours;
    if (!hours?.length) return null;

    const day = this.dayId() ?? new Date();
    const todayName = DAY_NAMES[day.getDay()];
    const todayLine = hours.find((h) => h.toLowerCase().startsWith(todayName));
    if (!todayLine) return false;
    if (todayLine.toLowerCase().includes('fermé')) return false;
    // "Ouvert 24h/24" (ou "24 heures sur 24") n'a pas de plage horaire à
    // parser plus bas — sans ce cas à part, l'absence de plage faisait
    // conclure à tort "fermé" sur un lieu ouvert en continu.
    if (/24\s*h(?:eures)?\s*(?:\/|sur)\s*24/i.test(todayLine)) return true;

    const ranges = [...todayLine.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)].map(
      ([, sh, sm, eh, em]) => {
        const start = +sh * 60 + +sm;
        let end = +eh * 60 + +em;
        if (end < start) end += 24 * 60;
        return { start, end };
      },
    );
    if (!ranges.length) return false;

    const startTime = this.activity().startTime;
    if (!startTime) return null;

    const hm = timeToMinutes(startTime);
    return ranges.some(({ start, end }) => hm >= start && hm <= end);
  });

  onPanelToggle(event: PanelToggleEvent) {
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