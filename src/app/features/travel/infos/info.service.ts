import {Injectable, inject} from '@angular/core';
import {arrayUnion, updateDoc} from 'firebase/firestore';
import {from, Observable} from 'rxjs';
import {TravelService} from '../travel.service';
import {Item, Info} from './info.models';

@Injectable({providedIn: 'root'})
export class InfoService {
    private readonly travelService = inject(TravelService);

    createItem(tripId: number, newItem: Item): Observable<void> {
        return from(updateDoc(this.travelService.tripRef(tripId), {
            [`info.items`]: arrayUnion(newItem)
        }));
    }

    updateItem(tripId: number, itemId: number, patch: Partial<Item>, currentInfo: Info): Observable<void> {
        const updated = currentInfo.items.map(i => i.id !== itemId ? i : {...i, ...patch});
        return from(updateDoc(this.travelService.tripRef(tripId), {
            [`info.items`]: updated
        }));
    }

    removeItem(tripId: number, itemId: number, currentInfo: Info): Observable<void> {
        const updated = currentInfo.items.filter(i => i.id !== itemId);
        return from(updateDoc(this.travelService.tripRef(tripId), {
            [`info.items`]: updated
        }));
    }

    reorderItems(tripId: number, items: Item[]) {
        return from(updateDoc(this.travelService.tripRef(tripId), {
            [`info.items`]: items
        }));
    }
}
