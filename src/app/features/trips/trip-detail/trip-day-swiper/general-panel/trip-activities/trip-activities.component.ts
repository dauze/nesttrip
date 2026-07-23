import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { extractCityFromAddress } from '@app/shared/utils/extract-city';
import { CardComponent } from '@app/shared/components/card/card.component';

const UNCATEGORIZED_LABEL = 'À catégoriser';

interface CityGroup {
  city: string;
  activities: PoolActivity[];
}

@Component({
  selector: 'app-trip-activities',
  standalone: true,
  imports: [PanelComponent, ButtonComponent, MessageComponent, ActivityCardComponent, CardComponent],
  templateUrl: './trip-activities.component.html',
  styleUrl: './trip-activities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripActivitiesComponent {
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();

  private readonly allActivities = computed(() => this.tripFacade.getAllPoolActivities(this.tripId())());

  readonly cityGroups = computed<CityGroup[]>(() => {
    const groups = new Map<string, PoolActivity[]>();

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
      placeId: '',
      files: [],
      photoRefs: [],
    });
  }
}
