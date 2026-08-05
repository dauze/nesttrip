import { inject, Injectable } from '@angular/core';
import { flightStatusToFb, logisticToFb } from '@core/infra/firebase/mappers/logistic.mapper';
import { FlightStatus, Logistic } from '@core/models/logistic.dto';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface LogisticUpdate {
  key: string;
  tripId: string;
  logistic: Logistic;
}

/**
 * Persiste chaque réservation individuellement dans
 * `trips/{tripId}.logistics.{id}` — entité transverse (hôtel/vol/location/
 * autre), indépendante du map `days`. Seule l'édition passe par le debounce ;
 * création et suppression sont des écritures directes non débouncées.
 */
@Injectable({ providedIn: 'root' })
export class LogisticPersistenceService extends DebounceWriter<string, LogisticUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, logistic: Logistic) {
    const key = `${tripId}_${logistic.id}`;
    this.queue(key, { key, tripId, logistic });
  }

  protected override write(updates: LogisticUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
          [`logistics.${u.logistic.id}`]: logisticToFb(u.logistic),
        })
      )
    );
  }

  /** Écriture directe (non débouncée) : création. */
  create(tripId: string, logistic: Logistic): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`logistics.${logistic.id}`]: logisticToFb(logistic),
    });
  }

  /** Écriture directe (non débouncée) : suppression. */
  remove(tripId: string, logisticId: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`logistics.${logisticId}`]: deleteField(),
    });
  }

  /**
   * Écriture directe (non débouncée) et ciblée (dot-notation sur les deux
   * seuls sous-champs concernés) du statut vol — cache partagé Firestore
   * entre tous les membres du trip (voir `FlightStatusRefreshService`) :
   * ne repasse jamais par `queueUpdate`/l'objet réservation complet, pour ne
   * jamais entrer en conflit avec une édition manuelle en cours de debounce
   * sur les autres champs.
   */
  updateFlightStatus(tripId: string, logisticId: string, status: FlightStatus, statusFetchedAt: Date): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`logistics.${logisticId}.status`]: flightStatusToFb(status),
      [`logistics.${logisticId}.statusFetchedAt`]: String(statusFetchedAt.getTime()),
    });
  }
}
