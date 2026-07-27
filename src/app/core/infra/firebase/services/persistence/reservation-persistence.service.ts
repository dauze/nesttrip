import { inject, Injectable } from '@angular/core';
import { reservationToFb } from '@core/infra/firebase/mappers/reservation.mapper';
import { Reservation } from '@core/models/reservation.dto';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface ReservationUpdate {
  key: string;
  tripId: string;
  reservation: Reservation;
}

/**
 * Persiste chaque réservation individuellement dans
 * `trips/{tripId}.reservations.{id}` — entité transverse (hôtel/vol/location/
 * autre), indépendante du map `days`. Seule l'édition passe par le debounce ;
 * création et suppression sont des écritures directes non débouncées.
 */
@Injectable({ providedIn: 'root' })
export class ReservationPersistenceService extends DebounceWriter<string, ReservationUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, reservation: Reservation) {
    const key = `${tripId}_${reservation.id}`;
    this.queue(key, { key, tripId, reservation });
  }

  protected override write(updates: ReservationUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
          [`reservations.${u.reservation.id}`]: reservationToFb(u.reservation),
        })
      )
    );
  }

  /** Écriture directe (non débouncée) : création. */
  create(tripId: string, reservation: Reservation): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`reservations.${reservation.id}`]: reservationToFb(reservation),
    });
  }

  /** Écriture directe (non débouncée) : suppression. */
  remove(tripId: string, reservationId: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`reservations.${reservationId}`]: deleteField(),
    });
  }
}
