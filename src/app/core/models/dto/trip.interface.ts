import { Info } from "../firebase/info.models";
import { Activity } from "./activity.interface";


export interface Trip {
  id: number;
  title: string;
  days: Day[];
  info: Info;
}

export interface Day {
  id: Date;
  activities: Activity[];
}