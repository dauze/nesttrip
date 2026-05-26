// trip.models.ts
import { ActivityFirebase } from "./activity.models";
import { Info } from "./info.models";

export interface TripFirebase {
  id: number;
  title: string;
  days: Record<string, { activities: ActivityFirebase[] }>;
  info: Info;
}