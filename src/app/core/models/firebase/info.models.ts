import { InfoType } from "../../enums/infos.type";

export interface Info {
  id: number;
  items: Item[];
}

export interface Item {
  id: number;
  title: string;
  type: InfoType;
  elements : Point[]
}

export interface Point {
  text: string;
  checked: boolean;
}