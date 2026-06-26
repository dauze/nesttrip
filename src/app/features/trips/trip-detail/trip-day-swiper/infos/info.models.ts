import {InfoType} from "@core/enums/infos.type";

export interface Info {
  id: string;
  items: Item[];
}

export interface Item {
  id: string;
  title: string;
  type: InfoType;
  elements: Point[];
}

export interface Point {
  id: string;
  text: string;
  checked: boolean;
}
