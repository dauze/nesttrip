// src/app/core/info.service.ts
import { Injectable, inject } from '@angular/core';
import { updateDoc } from 'firebase/firestore';
import { from, Observable } from 'rxjs';
import { Info, Item } from '../models/firebase/info.models';
import { TripService } from './trip.service';

@Injectable({ providedIn: 'root' })
export class InfoService {
  private readonly tripService = inject(TripService);

  createInfo(tripId: number, info: Info): Observable<void> {
    return from(updateDoc(this.tripService.tripRef(tripId), { info }));
  }

  createItem(tripId: number, newItem: Item, currentInfo: Info): Observable<void> {
    const updated = this.patchItems(currentInfo, items => [...items, newItem]);
    return from(updateDoc(this.tripService.tripRef(tripId), { info: updated }));
  }

  updateItem(tripId: number, itemId: number, patch: Partial<Item>, currentInfo: Info): Observable<void> {
    const updated = this.patchItems(currentInfo, items =>
      items.map(i => i.id !== itemId ? i : { ...i, ...patch })
    );
    return from(updateDoc(this.tripService.tripRef(tripId), { info: updated }));
  }

  removeItem(tripId: number, itemId: number, currentInfo: Info): Observable<void> {
    const updated = this.patchItems(currentInfo, items =>
      items.filter(i => i.id !== itemId)
    );
    return from(updateDoc(this.tripService.tripRef(tripId), { info: updated }));
  }

  /**
   *  Crée et insère un nouvel Item vide à la fin de la liste existante
   */
  addItem(tripId: number, currentInfo: Info, item: Item ): Observable<void> {
    const updated = this.patchItems(currentInfo, items => [...items, item]);
    return from(updateDoc(this.tripService.tripRef(tripId), { info: updated }));
  }

  private patchItems(
    info: Info,
    patchFn: (items: Item[]) => Item[]
  ): Info {
    return { ...info, items: patchFn(info.items ?? []) };
  }
}