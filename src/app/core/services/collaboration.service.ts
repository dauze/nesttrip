import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environnements/environnement';

@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private readonly http = inject(HttpClient);

  addCollaborator(tripId: string, inviteeEmail: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${environment.apiUrl}/collaborators`,
      { tripId, inviteeEmail}
    );
  }
}