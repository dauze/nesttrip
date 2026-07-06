export interface DayMapPoint {
  activityId: string;
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number; // position dans la journée -> numéro affiché
}