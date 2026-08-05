export interface DayMapPoint {
  activityId: string;
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number; // position dans la journée -> numéro affiché
  /** Première photo Google de l'activité (miniature de marker) — absent si aucune photo. */
  photoRef?: string;
  /** ISO du jour de placement — uniquement peuplé en contexte 'general' (pool), pour la navigation au clic (voir TripSummaryComponent). */
  dayId?: string;
}