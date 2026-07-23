import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private readonly http = inject(HttpClient);

  addCollaborator(
    tripId: string,
    inviteeEmail: string,
  ): Observable<{ success: boolean; uid: string; email: string; displayName: string | null }> {
    return this.http.post<{ success: boolean; uid: string; email: string; displayName: string | null }>(
      `${environment.apiUrl}/collaborators`,
      { tripId, inviteeEmail }
    );
  }

  removeCollaborator(tripId: string, memberUid: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/collaborators/${tripId}/${memberUid}`
    );
  }

  removeCompanion(companionUid: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/companions/${companionUid}`
    );
  }
}
