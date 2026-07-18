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
}

export interface Point {
  id: string;
  text: string;
  checked: boolean;
}
