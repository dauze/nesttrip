import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Panel } from 'primeng/panel';
import { Button } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { extractCityFromAddress } from '@app/shared/utils/extract-city';
import { Card } from 'primeng/card';
const UNCATEGORIZED_LABEL = 'À catégoriser';

interface CityGroup {
  city: string;
  activities: Activity[];
}

@Component({
  selector: 'app-trip-activities',
  standalone: true,
  imports: [Panel, Button, MessageModule, ActivityCardComponent, Card],
  templateUrl: './trip-activities.component.html',
  styleUrl: './trip-activities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripActivitiesComponent {
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();

  private readonly allActivities = computed(() => this.tripFacade.getAllActivities(this.tripId())());
  private readonly activityDayIds = computed(() => this.tripFacade.getActivityDayIds(this.tripId())());

  /** L'activité est "dispatchée" si elle est référencée par au moins un jour ; sinon contours en tiret (géré par ActivityCardComponent selon la présence de dayId). */
  readonly dayIdFor = (activityId: string) => this.activityDayIds().get(activityId);

  readonly cityGroups = computed<CityGroup[]>(() => {
    const groups = new Map<string, Activity[]>();

    for (const activity of this.allActivities()) {
      const city = activity.placeId ? extractCityFromAddress(activity.address) : null;
      const key = city ?? UNCATEGORIZED_LABEL;
      groups.set(key, [...(groups.get(key) ?? []), activity]);
    }

    const entries = [...groups.entries()].filter(([city]) => city !== UNCATEGORIZED_LABEL);
    entries.sort(([a], [b]) => a.localeCompare(b));

    const uncategorized = groups.get(UNCATEGORIZED_LABEL);
    if (uncategorized?.length) {
      entries.push([UNCATEGORIZED_LABEL, uncategorized]);
    }

    return entries.map(([city, activities]) => ({ city, activities }));
  });

  addActivity(): void {
    this.tripFacade.createGeneralActivity(this.tripId(), {
      id: crypto.randomUUID(),
      title: '',
      type: ActivityType.ACTIVITE,
      duration: 0,
      price: { amount: 0, currency: 'EUR' },
      placeId: '',
      booking: { status: BookingStatus.NOT_NEEDED, deadline: undefined },
      notes: '',
      files: [],
      photoRefs: [],
    });
  }
}
