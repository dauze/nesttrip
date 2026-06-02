import {InfoType} from "@core/enums/infos.type";

export interface Info {
  id: number;
  items: Item[];
}

export interface Item {
  id: number;
  title: string;
  type: InfoType;
  elements: Point[];
}

export interface Point {
  id: number;
  text: string;
  checked: boolean;
}
