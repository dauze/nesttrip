import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input, viewChildren } from '@angular/core';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import { extractCityFromAddress } from '@app/shared/utils/extract-city';
import { CardComponent } from '@app/shared/components/card/card.component';
import { TripActivitiesCreationService } from './trip-activities-creation.service';
import { NewActivityDraftComponent } from '../../day-panel/new-activity-draft/new-activity-draft.component';

const UNCATEGORIZED_LABEL = 'À catégoriser';

interface CityGroup {
  city: string;
  activities: PoolActivity[];
}

@Component({
  selector: 'app-trip-activities',
  standalone: true,
  imports: [PanelComponent, MessageComponent, ActivityCardComponent, CardComponent, NewActivityDraftComponent],
  templateUrl: './trip-activities.component.html',
  styleUrl: './trip-activities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TripActivitiesCreationService],
})
export class TripActivitiesComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly creationService = inject(TripActivitiesCreationService);

  private readonly activityCards = viewChildren(ActivityCardComponent);

  readonly tripId = input.required<string>();

  private readonly allActivities = computed(() => this.tripFacade.getAllPoolActivities(this.tripId())());

  constructor() {
    this.creationService.connect({
      getCards: () => this.activityCards(),
      getTripId: () => this.tripId(),
      getViewContainerRef: () => this.viewContainerRef,
    });
  }

  /** Point d'entrée pour le bouton "+" flottant, porté par `GeneralPanelComponent` (pas ce composant). */
  triggerCreate(): void {
    this.creationService.startCreation();
  }

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
}
