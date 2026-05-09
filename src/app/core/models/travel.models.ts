export interface Badge {
  text: string;
  class:  "badge-zone" | "badge-new" | "badge-duration" | "badge-tobook" | "badge-free";
}

export interface TimelineItem {
  time: string;
  color: 'orange' | 'blue' | 'green' | 'gray'| "yellow"| "red"| "purple";
  content: string;
}

export interface GridItem {
  label: string;
  value: string;
}

export interface Transport {
  icon: string;
  text: string;
}

export interface Activity {
  name: string;
  badges: Badge[];
  grid?: GridItem[];
  transport?: Transport;
  tip?: string;
}

export interface Slot {
  type: 'morning' | 'afternoon' | 'evening' | 'meal' | 'transit';
  icon: string;
  time: string;
  name: string;
  activities?: Activity[];
  meal?: string;
}

export interface Alerts {
  title: string;
  points: string[];
}

export interface InfoElement {
  title: string;
  items: string[];
}

export interface DayContent {
  title: string;
  subtitle: string;
  badges?: Badge[];
  timeline?: TimelineItem[];
  slots?: Slot[];
  alerts?: Alerts;
  // Info tab specific
  elements?: InfoElement[];
}

export interface Day {
  id: string;
  navLabel: string;
  content: DayContent;
}
