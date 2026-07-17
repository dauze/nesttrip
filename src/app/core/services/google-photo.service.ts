import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class GooglePhotoService {
  private http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<string>>();

  getPhotoUrl$(ref: string, maxWidth = 800): Observable<string> {
    const key = `${ref}__${maxWidth}`;
    let url$ = this.cache.get(key);
    if (!url$) {
      url$ = this.getPhoto$(ref, maxWidth).pipe(
        catchError(() => of('')),
        shareReplay(1),
      );
      this.cache.set(key, url$);
    }
    return url$;
  }

  clear(): void {
    this.cache.clear();
  }

  private getPhoto$(ref: string, maxWidth = 400): Observable<string> {
    const encodedRef = encodeURIComponent(ref);
    const url = `${environment.apiUrl}/photos/${encodedRef}?maxWidth=${maxWidth}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map((blob) => URL.createObjectURL(blob))
    );
  }
}