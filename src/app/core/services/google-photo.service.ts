import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environnements/environnement';

@Injectable({ providedIn: 'root' })
export class GooglePhotoService {
  private http = inject(HttpClient);

  getPhoto$(ref: string, maxWidth = 400): Observable<string> {
    const url = `${environment.apiUrl}/photos/${ref}?maxWidth=${maxWidth}`;

    return this.http.get(url, { responseType: 'blob' }).pipe(
      map((blob) => URL.createObjectURL(blob)),
      shareReplay(1)
    );
  }
}