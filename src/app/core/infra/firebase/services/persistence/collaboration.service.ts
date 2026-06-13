// trips/collaboration.service.ts
import { Injectable } from '@angular/core';
import { TripRole } from '@app/features/trips/trip.model';
import { Functions, getFunctions, httpsCallable } from 'firebase/functions';
import { from, map, Observable } from 'rxjs';
import{firebaseApp} from '@app/app.config'
import{TripRoleFireBase} from '@core/infra/firebase/models/trip.dto'


@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private readonly functions: Functions = getFunctions(firebaseApp, 'europe-west1');

  addCollaborator(tripId: string, inviteeEmail: string, role: TripRole): Observable<{ success: boolean }> {
    const fn = httpsCallable<
      { tripId: string; inviteeEmail: string; role: TripRoleFireBase },
      { success: boolean }
    >(this.functions, 'addCollaborator');

    return from(fn({ tripId, inviteeEmail, role })).pipe(
      map((result) => result.data)
    );
  }
}