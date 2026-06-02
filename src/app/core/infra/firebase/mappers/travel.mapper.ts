import {Travelsz} from '@app/features/travel/travel';
import {TravelFirebase} from '../models/travel.dto';
import {activityFromFb, activityToFb} from './activity.mapper';



export function travelFromFb(data: TravelFirebase): Travel {
  return {
    ...data,
    days: Object.entries(data.days).map(([key, value]) => ({
      id: new Date(Number(key)),
      activities: (value.activities ?? []).map(a => activityFromFb(a)),
    })),
  };
}

export function travelToFb(data: Travel): TravelFirebase {
  return {
    ...data,
    days: Object.fromEntries(
      data.days.map(d => [
        String(d.id.getTime()),
        {activities: d.activities.map(a => activityToFb(a))},
      ])
    ),
  };
}
