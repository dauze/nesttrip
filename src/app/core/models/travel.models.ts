export interface Badge {
  text: string;
  class:  "badge-zone" | "badge-new" | "badge-duration" | "badge-tobook" | "badge-free";
}

export interface TimelineItem {
  id?: string;
  time: string;
  color: 'orange' | 'blue' | 'green' | 'gray'| "yellow"| "red"| "purple";
  content: string;
}

export interface GridItem {
  id?: string;
  label: string;
  value: string;
}

export interface Transport {
  icon: string;
  text: string;
}

export interface Activity {
  id: number;
  name: string;
  badges: Badge[];
  grid?: GridItem[];
  transport?: Transport;
  tip?: string;
  notes?: string; //Notes manuelles
  fileUrl?: string;    // URL de téléchargement Firebase
  fileName?: string;  // Nom affiché
  filePath?: string; 
}

export interface Slot {
  id:number;
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
  id:number;
  title: string;
  items: string[] | TodoItem[];
}

export interface TodoItem {
  text: string;
  checked: boolean;
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
  idVoyage: string;
  order: number;
  navLabel: string;
  content: DayContent;
}