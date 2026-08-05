import { NotesType } from "@app/core/enums/notes.type";

export interface Notes {
  id: string;
  items: Item[];
}

export interface Item {
  id: string;
  title: string;
  type: NotesType;
  elements: Point[];
  /** Activité liée (voir ROADMAP.md "UX / Interactions") — FK vers une DayActivityInstance précise (un placement jour donné, pas juste l'identité de pool), source de vérité unique du lien (rien de stocké côté activité, juste une recherche inverse, voir TripStore.getLinkedNoteItems). */
  linkedActivityInstanceId?: string;
}

export interface Point {
  id: string;
  text: string;
  checked: boolean;
}
